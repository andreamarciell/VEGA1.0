
/* DOCX Exporter (safe, Vite-friendly) */
export type AnyRecord = Record<string, any>;

function resolveTemplateUrl(nameGuess?: string): string {
  const guess = (nameGuess || '').toLowerCase();
  try {
    const map = (import.meta as any).glob('/src/assets/templates/*', { eager: true, as: 'url' }) as Record<string, string>;
    const entries = Object.entries(map);
    if (entries.length) {
      if (guess) {
        const hit = entries.find(([k]) => k.toLowerCase().includes(guess));
        if (hit) return hit[1];
      }
      const adv = entries.find(([k]) => /adverse/i.test(k) && /\.docx$/i.test(k)) || entries.find(([k]) => /\.docx$/i.test(k));
      if (adv) return adv[1];
    }
  } catch {}
  return '/assets/review_template.docx';
}

function toStringArray(input: unknown): string[] {
  if (!input) return [];
  if (Array.isArray(input)) return input.map(x => String(x ?? '')).filter(Boolean);
  return String(input).replace(/\r\n/g, '\n').split('\n').map(s => s.trim()).filter(Boolean);
}

function htmlToPlain(html: string): string {
  const el = (globalThis as any).document?.createElement?.('div');
  if (el) {
    el.innerHTML = html || '';
    return (el.textContent || (el as any).innerText || '').replace(/\s+/g,' ').trim();
  }
  return String(html || '').replace(/<[^>]*>/g,' ').replace(/\s+/g,' ').trim();
}

type ExportOptions = { templateName?: string; fileName?: string; };

export async function exportToDocx(data: AnyRecord, opts: ExportOptions = {}) {
  const PizZip = (await import('pizzip')).default;
  const Docxtemplater = (await import('docxtemplater')).default;

  const templateUrl = resolveTemplateUrl(opts.templateName);
  const res = await fetch(templateUrl);
  if (!res.ok) throw new Error(`Template not found (${res.status}) at ${templateUrl}`);
  const array = await res.arrayBuffer();
  const zip = new PizZip(array);
  const doc = new Docxtemplater(zip, { paragraphLoop: true, linebreaks: true });

  const d = data || {};
  const cp = d.customerProfile || {};
  const bullets = toStringArray(d.reputationalIndicators);
  const richArr: string[] = Array.isArray(d.reputationalIndicatorsRich) ? d.reputationalIndicatorsRich : [];

  // Build payload for template
  const payload: AnyRecord = {
    ...d,
    customerProfile: {
      name: cp.name || '',
      surname: cp.surname || '',
      username: cp.username || '',
      email: cp.email || '',
      birthDate: cp.birthDate || '',
      nationality: cp.nationality || '',
      latestLoginNationality: cp.latestLoginNationality || ''
    },
    reputationalIndicatorsBullets: bullets,
    reputationalIndicatorsRich: richArr,
    reputationalIndicatorsPlainJoined: bullets.join('\n')
  };

  // Render
  doc.setData(payload);
  try {
    doc.render();
  } catch (e: any) {
    // rethrow with message to avoid swallowing errors
    throw new Error(e && e.message ? e.message : 'docx render failed');
  }
  const out = doc.getZip().generate({ type: 'blob' });
  const name = opts.fileName || 'review.docx';
  const url = URL.createObjectURL(out);
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  setTimeout(() => { URL.revokeObjectURL(url); a.remove(); }, 0);
}
