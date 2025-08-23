
import { Document, Packer, Paragraph, TextRun, HeadingLevel, AlignmentType, ExternalHyperlink, PageBreak } from "docx";
import type { FormState } from "../context/FormContext";

/**
 * Public API: generate a .docx Blob from the current review state.
 */
export async function exportToDocx(state: FormState): Promise<Blob> {
  const doc = buildDocument(state);
  const blob = await Packer.toBlob(doc);
  return blob;
}

// ---------------- core ----------------

function buildDocument(state: FormState): Document {
  const type = state?.reviewType ?? "adverse";

  const children: Paragraph[] = [];

  // Title
  children.push(new Paragraph({
    heading: HeadingLevel.HEADING_1,
    children: [new TextRun(type === "adverse" ? "Adverse Media Check" : "Customer Review")],
  }));

  children.push(blank());

  if (type === "adverse") {
    const adv = state?.adverseData as any;
    pushSection(children, "Indicatori Reputazionali", adv?.reputationalIndicatorsHtml || adv?.reputationalIndicators);
    pushSources(children, adv?.reputationalSources);
    pushSection(children, "Conclusione", adv?.conclusion);
    pushAttachments(children, adv?.attachments);
  } else {
    const full = state?.fullData as any;
    pushKV(children, "Motivo della Review", full?.reasonForReview);
    pushKV(children, "Review eseguita da", full?.performedBy || full?.reviewPerformedBy);
    pushKV(children, "Data Review", full?.reviewDate);
    pushKV(children, "Profilo Cliente", full?.customerProfile && JSON.stringify(full.customerProfile, null, 2));
    pushKV(children, "Metodi di Pagamento", full?.paymentMethods && JSON.stringify(full.paymentMethods, null, 2));
    pushKV(children, "Metodi di Pagamento di Terzi", full?.thirdPartyPaymentMethods && JSON.stringify(full.thirdPartyPaymentMethods, null, 2));
    pushKV(children, "Attività Aggiuntive", full?.additionalActivities);
    pushKV(children, "Fonte dei Fondi", full?.sourceOfFunds);
    pushSection(children, "Indicatori Reputazionali", full?.reputationalIndicatorsHtml || full?.reputationalIndicators);
    pushKV(children, "Conclusione & Livello di Rischio", full?.conclusionAndRiskLevel);
    pushKV(children, "Azioni di Follow-up", full?.followUpActions);
    // Background as bullet-ish lines
    if (Array.isArray(full?.backgroundInformation) && full.backgroundInformation.length) {
      children.push(sectionHeading("Background"));
      for (const it of full.backgroundInformation) {
        const line = [it?.date, it?.description].filter(Boolean).join(" — ");
        children.push(paragraphFromText(line));
      }
      children.push(blank());
    }
    pushAttachments(children, full?.attachments);
  }

  return new Document({
    sections: [{
      properties: {},
      children,
    }],
  });
}

// --------------- helpers ---------------

function pushSection(out: Paragraph[], title: string, content: string | undefined) {
  if (!content) return;
  out.push(sectionHeading(title));
  out.push(...htmlToParagraphs(content));
  out.push(blank());
}

function pushKV(out: Paragraph[], title: string, value: any) {
  if (value == null || value === "") return;
  out.push(sectionHeading(title));
  out.push(paragraphFromText(String(value)));
  out.push(blank());
}

function pushSources(out: Paragraph[], sources: Array<{author?: string; url?: string}> | undefined) {
  if (!Array.isArray(sources) || sources.length === 0) return;
  out.push(sectionHeading("Fonti"));
  for (const s of sources) {
    const label = s?.author || s?.url || "";
    const url = s?.url || "";
    if (url) {
      out.push(new Paragraph({
        children: [
          new ExternalHyperlink({
            link: url,
            children: [new TextRun({ text: label, underline: {}, })],
          }),
        ],
      }));
    } else if (label) {
      out.push(paragraphFromText(label));
    }
  }
  out.push(blank());
}

function pushAttachments(out: Paragraph[], attachments: Array<{label?: string; url?: string; link?: string; href?: string}> | undefined) {
  if (!Array.isArray(attachments) || attachments.length === 0) return;
  out.push(sectionHeading("Allegati"));
  for (const a of attachments) {
    const label = a?.label || a?.url || a?.link || a?.href || "";
    const url = a?.url || a?.link || a?.href || "";
    if (url) {
      out.push(new Paragraph({
        children: [
          new ExternalHyperlink({
            link: url,
            children: [new TextRun({ text: label, underline: {} })],
          }),
        ],
      }));
    } else if (label) {
      out.push(paragraphFromText(label));
    }
  }
  out.push(blank());
}

function sectionHeading(text: string): Paragraph {
  return new Paragraph({
    heading: HeadingLevel.HEADING_2,
    children: [new TextRun(text)],
  });
}

function blank(): Paragraph {
  return new Paragraph({});
}

function paragraphFromText(text: string): Paragraph {
  return new Paragraph({
    children: runsFromPlainWithLinks(text),
  });
}

// Very small HTML support focused on paragraphs and anchors
function htmlToParagraphs(html: string): Paragraph[] {
  try {
    const doc = new DOMParser().parseFromString(html, "text/html");
    const body = doc.body;
    const out: Paragraph[] = [];
    for (const node of Array.from(body.childNodes)) {
      out.push(...nodeToParagraphs(node));
    }
    return out.length ? out : [paragraphFromText(body.textContent || "")];
  } catch {
    return [paragraphFromText(html)];
  }
}

function nodeToParagraphs(node: Node): Paragraph[] {
  switch (node.nodeType) {
    case Node.TEXT_NODE:
      return [paragraphFromText(node.textContent || "")];
    case Node.ELEMENT_NODE: {
      const el = node as HTMLElement;
      const tag = el.tagName.toLowerCase();
      if (tag === "p" || tag === "div") {
        return [inlineContainerToParagraph(el)];
      }
      if (tag === "br") {
        return [new Paragraph({ children: [new TextRun({ text: "", break: 1 })] })];
      }
      if (tag === "h1" || tag === "h2" || tag === "h3") {
        const level = tag === "h1" ? HeadingLevel.HEADING_1 : tag === "h2" ? HeadingLevel.HEADING_2 : HeadingLevel.HEADING_3;
        return [new Paragraph({ heading: level, children: inlineToRuns(el) })];
      }
      if (tag === "ul" || tag === "ol") {
        const items = Array.from(el.querySelectorAll(":scope > li"));
        const out: Paragraph[] = [];
        let idx = 1;
        for (const li of items) {
          const prefix = tag === "ol" ? `${idx++}. ` : "• ";
          out.push(new Paragraph({ children: [new TextRun(prefix), ...inlineToRuns(li as HTMLElement)] }));
        }
        return out;
      }
      // Fallback: render inner content
      return [inlineContainerToParagraph(el)];
    }
    default:
      return [];
  }
}

function inlineContainerToParagraph(el: HTMLElement): Paragraph {
  return new Paragraph({ children: inlineToRuns(el) });
}

function inlineToRuns(el: HTMLElement): (TextRun | ExternalHyperlink)[] {
  const out: (TextRun | ExternalHyperlink)[] = [];
  for (const node of Array.from(el.childNodes)) {
    if (node.nodeType === Node.TEXT_NODE) {
      out.push(...runsFromPlainWithLinks(node.textContent || ""));
    } else if (node.nodeType === Node.ELEMENT_NODE) {
      const tag = (node as HTMLElement).tagName.toLowerCase();
      if (tag === "b" || tag === "strong") {
        out.push(new TextRun({ text: node.textContent || "", bold: true }));
      } else if (tag === "i" || tag === "em") {
        out.push(new TextRun({ text: node.textContent || "", italics: true }));
      } else if (tag === "u") {
        out.push(new TextRun({ text: node.textContent || "", underline: {} }));
      } else if (tag === "br") {
        out.push(new TextRun({ text: "", break: 1 }));
      } else if (tag === "a") {
        const a = node as HTMLAnchorElement;
        const url = a.getAttribute("href") || "";
        const label = a.textContent || url;
        out.push(new ExternalHyperlink({ link: url, children: [new TextRun({ text: label, underline: {} })] }));
      } else {
        // recurse
        out.push(...inlineToRuns(node as HTMLElement));
      }
    }
  }
  return out;
}

// Turns plain text into runs and preserves URL-like substrings as hyperlinks.
function runsFromPlainWithLinks(text: string): (TextRun | ExternalHyperlink)[] {
  const out: (TextRun | ExternalHyperlink)[] = [];
  const urlRe = /(https?:\/\/[^\s)]+)|(www\.[^\s)]+)/gi;
  let last = 0;
  let m: RegExpExecArray | null;
  while ((m = urlRe.exec(text))) {
    if (m.index > last) out.push(new TextRun(text.slice(last, m.index)));
    const raw = m[0];
    const url = raw.startsWith("http") ? raw : "http://" + raw;
    out.push(new ExternalHyperlink({ link: url, children: [new TextRun({ text: raw, underline: {} })] }));
    last = m.index + raw.length;
  }
  if (last < text.length) out.push(new TextRun(text.slice(last)));
  return out;
}

// Back-compat: keep named export used elsewhere
export async function exportDocxFromHtml(html: string): Promise<Blob> {
  // we don't rely on html-to-docx anymore; we parse the HTML ourselves
  const state: any = { reviewType: "adverse", adverseData: { reputationalIndicatorsHtml: html } };
  return exportToDocx(state);
}

// For consumers that import composeHtml (no-op now)
export function composeHtml(_state: any): string {
  return "";
}
