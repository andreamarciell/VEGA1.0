import { useEffect, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { useAmlStore } from '@/store/amlStore';
import { Chart, registerables } from 'chart.js';
import { Brain, AlertTriangle, FileText, BarChart3, Clock, CreditCard, TrendingUp, Shield, MessageSquare, Send } from 'lucide-react';

Chart.register(...registerables);

type TxPayload = { ts: string; amount: number; dir: 'in'|'out'; method?: string; reason?: string };

function parseNum(v: any): number {
  if (typeof v === 'number') return v;
  const s = String(v ?? '').replace(/\./g, '').replace(',', '.').replace(/[^\d.-]/g, '');
  const n = parseFloat(s);
  return Number.isFinite(n) ? n : 0;
}

/** Helper per il parsing di date in formato italiano DD/MM/YYYY HH:mm:ss */
function parseItalianDate(s: string): Date {
  if (!s) return new Date();
  
  // Prova a parsare il formato DD/MM/YYYY HH:mm:ss
  const match = String(s).match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})\s+(\d{1,2}):(\d{1,2}):(\d{1,2})$/);
  if (match) {
    const [, day, month, year, hours, minutes, seconds] = match;
    return new Date(
      parseInt(year, 10),
      parseInt(month, 10) - 1, // month è 0-indexed
      parseInt(day, 10),
      parseInt(hours, 10),
      parseInt(minutes, 10),
      parseInt(seconds, 10)
    );
  }
  
  // Fallback: prova parsing standard
  const d = new Date(s);
  return isNaN(d.getTime()) ? new Date() : d;
}

function sanitizeReason(s?: string) {
  return (s || '')
    .toString()
    .toLowerCase()
    .replace(/\b[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}\b/g, '[email]')
    .replace(/\b(id|player|user|account)[-_ ]?\d+\b/g, '[id]')
    .replace(/[0-9]{6,}/g, '[num]');
}

function classifyMoveStrict(reason: string): 'deposit'|'withdraw'|'cancel_withdraw'|'other' {
  const s = String(reason || '').toLowerCase();
  const hasPrelievo = /(^|\b)prelievo(\b|$)/.test(s);
  const isCancelled = /(\bannullamento\b|\bstorno\b|\brimborso\b)/.test(s);
  if (/(^|\b)(deposito|ricarica)(\b|$)/.test(s)) return 'deposit';
  if (hasPrelievo && isCancelled) return 'cancel_withdraw';
  if (hasPrelievo) return 'withdraw';
  return 'other';
}

/** Build payload from the Excel originally loaded and persisted in localStorage */

function buildAnonPayload(): { txs: TxPayload[]; gameplay?: { ts: string; amount: number; reason: string; }[] } {
  const raw = localStorage.getItem('amlTransactions');
  if (!raw) return { txs: [], gameplay: [] };
  try {
    const arr = JSON.parse(raw) as any[];

    // --- existing txs pipeline (unchanged) ---
    const txs: TxPayload[] = arr.map((t) => {
      const d = new Date(t?.data ?? t?.date ?? t?.ts);
      const causale = String(t?.causale ?? t?.reason ?? '');
      const amount = parseNum(t?.importo ?? t?.amount ?? 0);
      const move = classifyMoveStrict(causale);
      const dir: 'in'|'out' = (move === 'withdraw') ? 'out' : 'in';
      return {
        ts: isNaN(d.getTime()) ? new Date().toISOString() : d.toISOString(),
        amount: Number.isFinite(amount) ? amount : 0,
        dir,
        method: (t?.metodo ?? t?.method ?? t?.payment_method ?? t?.paymentMethod ?? t?.tipo ?? causale),
        reason: sanitizeReason(causale),
      };
    })
    // keep ONLY deposit/withdraw/cancel_withdraw movements (we need cancellations for net sum of withdrawals)
    .filter((x) => {
      const m = classifyMoveStrict(x.reason || '');
      return m === 'deposit' || m === 'withdraw' || m === 'cancel_withdraw';
    })
    // final guard
    .filter(x => Number.isFinite(x.amount) && !!x.ts);

    // --- NEW: lightweight gameplay causali for AI (does not affect totals/charts) ---
    const gp: { ts: string; amount: number; reason: string; }[] = [];
    for (const t of arr) {
      const r = String(t?.causale ?? t?.reason ?? '');
      if (!r) continue;
      const rl = r.toLowerCase();
      // select only gameplay-related reasons (slot sessions, bets, wins)
      if (/(session\s+slot|giocata\s+scommessa|vincita\s+scommessa)/i.test(rl)) {
        const dateStr = t?.data ?? t?.date ?? t?.ts;
        const d = parseItalianDate(String(dateStr || ''));
        const amount = parseNum(t?.importo ?? t?.amount ?? 0);
        gp.push({
          ts: isNaN(d.getTime()) ? new Date().toISOString() : d.toISOString(),
          amount: Number.isFinite(amount) ? amount : 0,
          reason: sanitizeReason(r),
        });
      }
    }

    return { txs, gameplay: gp };
  } catch {
    return { txs: [], gameplay: [] };
  }
}


// ---------------- Component: AnalisiAvanzata ----------------
export default function AnalisiAvanzata() {
  const { advancedAnalysis, setAdvancedAnalysis } = useAmlStore();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [followUpQuestion, setFollowUpQuestion] = useState('');
  const [followUpLoading, setFollowUpLoading] = useState(false);
  const [followUpResponse, setFollowUpResponse] = useState<string | null>(null);

  const chart1Ref = useRef<HTMLCanvasElement | null>(null);
  const chart2Ref = useRef<HTMLCanvasElement | null>(null);
  const chart3Ref = useRef<HTMLCanvasElement | null>(null);
  const chartInstances = useRef<{c1?: any; c2?: any; c3?: any; c4?: any; c5?: any}>({});
  const chart4Ref = useRef<HTMLCanvasElement | null>(null);
  const chart5Ref = useRef<HTMLCanvasElement | null>(null);

  async function handleRun() {
    setError(null);
    setLoading(true);
    try {
      const payload = buildAnonPayload();
      if (!payload.txs || payload.txs.length === 0) {
        setError('nessuna transazione valida trovata (deposito/ricarica o prelievo)');
        return;
      }
      const res = await fetch('/api/v1/aml/advanced-analysis', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const text = await res.text();
      if (!res.ok) throw new Error(`analisi fallita (${res.status}): ${text.slice(0,200)}`);
      const data = JSON.parse(text);
      setAdvancedAnalysis(data);
    } catch (e:any) {
      setError(e?.message || 'errore sconosciuto');
    } finally {
      setLoading(false);
    }
  }

  async function handleFollowUpQuestion() {
    if (!followUpQuestion.trim() || !advancedAnalysis) return;
    
    setFollowUpLoading(true);
    setFollowUpResponse(null);
    
    try {
      const payload = buildAnonPayload();
      const res = await fetch('/api/v1/aml/advanced-analysis', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...payload,
          follow_up_question: followUpQuestion.trim(),
          previous_analysis: advancedAnalysis
        }),
      });
      
      const text = await res.text();
      if (!res.ok) throw new Error(`Domanda fallita (${res.status}): ${text.slice(0,200)}`);
      
      const data = JSON.parse(text);
      setFollowUpResponse(data.follow_up_response || data.summary || 'Nessuna risposta ricevuta');
    } catch (e: any) {
      setFollowUpResponse(`Errore: ${e?.message || 'errore sconosciuto'}`);
    } finally {
      setFollowUpLoading(false);
    }
  }

  // helper: build daily series from local payload
function computeDailySeries() {
  const payload = buildAnonPayload();
  const byDay = new Map<string, {day: string; deposits: number; withdrawals: number; count: number}>();
  for (const t of payload.txs) {
    const day = t.ts.slice(0,10);
    const rec = byDay.get(day) || { day, deposits: 0, withdrawals: 0, count: 0 };
    const m = classifyMoveStrict(t.reason || '');
    if (m === 'withdraw') rec.withdrawals += Math.abs(Number(t.amount) || 0);
    else if (m === 'deposit') rec.deposits += Math.abs(Number(t.amount) || 0);
    rec.count += 1;
    byDay.set(day, rec);
  }
  return Array.from(byDay.values()).sort((a,b)=>a.day.localeCompare(b.day));
}

// draw charts when analysis changes
  useEffect(() => {
    const a = advancedAnalysis;
    if (!a?.indicators) return;

    try {
      // destroy previous
      if (chartInstances.current.c1) { chartInstances.current.c1.destroy(); chartInstances.current.c1 = undefined; }
      if (chartInstances.current.c2) { chartInstances.current.c2.destroy(); chartInstances.current.c2 = undefined; }
      if (chartInstances.current.c3) { chartInstances.current.c3.destroy(); chartInstances.current.c3 = undefined; }
      if (chartInstances.current.c4) { chartInstances.current.c4.destroy(); chartInstances.current.c4 = undefined; }
      if (chartInstances.current.c5) { chartInstances.current.c5.destroy(); chartInstances.current.c5 = undefined; }

      const ctx1 = chart1Ref.current?.getContext('2d');
      if (ctx1) {
        const labels = (a.indicators.net_flow_by_month || []).map((r:any)=>r.month);
        const deps = (a.indicators.net_flow_by_month || []).map((r:any)=>r.deposits);
        const withs = (a.indicators.net_flow_by_month || []).map((r:any)=>r.withdrawals);
        chartInstances.current.c1 = new Chart(ctx1, {
          type: 'bar',
          data: {
            labels,
            datasets: [
              { label: 'Depositi', data: deps },
              { label: 'Prelievi', data: withs },
            ]
          },
          options: { responsive: true, maintainAspectRatio: false, layout: { padding: { top: 8, right: 8, bottom: 18, left: 8 } } }
        });
      }

      const ctx2 = chart2Ref.current?.getContext('2d');
      if (ctx2) {
        const hours = (a.indicators.hourly_histogram || []).map((h:any)=>h.hour);
        const counts = (a.indicators.hourly_histogram || []).map((h:any)=>h.count);
        chartInstances.current.c2 = new Chart(ctx2, {
          type: 'line',
          data: { labels: hours, datasets: [{ label: 'Transazioni/ora', data: counts }] },
          options: { responsive: true, maintainAspectRatio: false, layout: { padding: { top: 8, right: 8, bottom: 18, left: 8 } }, elements: { point: { radius: 2 } }, layout: { padding: { top: 8, right: 8, bottom: 18, left: 8 } } }
        });
      }

      const ctx3 = chart3Ref.current?.getContext('2d');
      if (ctx3) {
        const md = a.indicators.method_breakdown || [];
        chartInstances.current.c3 = new Chart(ctx3, {
          type: 'doughnut',
          data: {
            labels: md.map((x:any)=>x.method),
            datasets: [{ data: md.map((x:any)=>x.pct) }]
          },
          options: { responsive: true, maintainAspectRatio: false, layout: { padding: { top: 8, right: 8, bottom: 18, left: 8 } } }
        });
      }
    } catch (e) {
      console.error('[AnalisiAvanzata] chart error', e);
    }
  
    // Daily charts (from local transactions)
    try {
      const dailyRows = computeDailySeries();
      const ctx4 = chart4Ref.current?.getContext('2d');
      if (ctx4 && dailyRows.length) {
        chartInstances.current.c4 = new Chart(ctx4, {
          type: 'line',
          data: {
            labels: dailyRows.map(r => r.day),
            datasets: [
              { label: 'Depositi', data: dailyRows.map(r => r.deposits) },
              { label: 'Prelievi', data: dailyRows.map(r => r.withdrawals) },
            ]
          },
          options: { responsive: true, maintainAspectRatio: false, layout: { padding: { top: 8, right: 8, bottom: 18, left: 8 } } }
        });
      }
      const ctx5 = chart5Ref.current?.getContext('2d');
      if (ctx5 && dailyRows.length) {
        chartInstances.current.c5 = new Chart(ctx5, {
          type: 'bar',
          data: {
            labels: dailyRows.map(r => r.day),
            datasets: [{ label: 'Conteggio transazioni', data: dailyRows.map(r => r.count) }]
          },
          options: { responsive: true, maintainAspectRatio: false, layout: { padding: { top: 8, right: 8, bottom: 18, left: 8 } } }
        });
      }
    } catch (e) { console.error('[AnalisiAvanzata] daily charts error', e); }

    }, [advancedAnalysis]);

  const risk = advancedAnalysis?.risk_score ?? null;
  const summary = advancedAnalysis?.summary ?? '';

  const getRiskLevel = (score: number) => {
    if (score <= 20) return { level: 'Basso', color: 'bg-green-100 text-green-800', bgColor: 'bg-green-500' };
    if (score <= 40) return { level: 'Moderato', color: 'bg-yellow-100 text-yellow-800', bgColor: 'bg-yellow-500' };
    if (score <= 60) return { level: 'Medio-Alto', color: 'bg-orange-100 text-orange-800', bgColor: 'bg-orange-500' };
    if (score <= 80) return { level: 'Alto', color: 'bg-red-100 text-red-800', bgColor: 'bg-red-500' };
    return { level: 'Critico', color: 'bg-red-100 text-red-800', bgColor: 'bg-red-600' };
  };

  return (
    <div className="space-y-8 max-w-7xl mx-auto">
      {/* Header Section */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold flex items-center gap-3">
            <Brain className="h-8 w-8 text-primary" />
            Analisi AI
          </h2>
        </div>
        <Button 
          onClick={handleRun} 
          disabled={loading}
          size="lg"
          className="flex items-center gap-2"
        >
          {loading ? (
            <>
              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
              Analisi in corso...
            </>
          ) : (
            <>
              <BarChart3 className="h-4 w-4" />
              Esegui Analisi
            </>
          )}
        </Button>
      </div>

      {error && (
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {/* Risk Assessment Section */}
      {risk !== null && (
        <Card className="p-6">
          <div className="flex items-start justify-between mb-6">
            <div>
              <h3 className="text-xl font-semibold flex items-center gap-2 mb-2">
                <Shield className="h-5 w-5" />
                Valutazione del Rischio
              </h3>
              <p className="text-muted-foreground">
                Analisi basata su pattern comportamentali e indicatori AML
              </p>
            </div>
            <div className="text-right">
              <div className={`text-5xl font-bold ${getRiskLevel(risk).bgColor} text-white rounded-lg px-4 py-2`}>
                {risk}%
              </div>
              <Badge variant="secondary" className={`mt-2 ${getRiskLevel(risk).color}`}>
                Rischio {getRiskLevel(risk).level}
              </Badge>
            </div>
          </div>

          {/* Risk Factors */}
          {advancedAnalysis?.risk_factors && advancedAnalysis.risk_factors.length > 0 && (
            <div className="mb-6">
              <h4 className="font-semibold mb-3 flex items-center gap-2">
                <AlertTriangle className="h-4 w-4 text-orange-500" />
                Fattori di Rischio Identificati
              </h4>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                {advancedAnalysis.risk_factors.map((factor, index) => (
                  <div key={index} className="flex items-start gap-2 p-3 bg-orange-50 dark:bg-orange-950/20 rounded-lg">
                    <div className="w-2 h-2 bg-orange-500 rounded-full mt-2 flex-shrink-0"></div>
                    <span className="text-sm">{factor}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          <Separator className="my-6" />

          {/* Analysis Summary */}
          <div>
            <h4 className="font-semibold mb-3 flex items-center gap-2">
              <FileText className="h-4 w-4" />
              Analisi Dettagliata
            </h4>
            <div className="prose prose-sm max-w-none">
              <p className="text-sm leading-relaxed whitespace-pre-line">{summary}</p>
            </div>
          </div>

          {/* Compliance Notes */}
          {advancedAnalysis?.compliance_notes && (
            <>
              <Separator className="my-6" />
              <div>
                <h4 className="font-semibold mb-3 flex items-center gap-2">
                  <TrendingUp className="h-4 w-4 text-blue-500" />
                  Note
                </h4>
                <div className="p-4 bg-blue-50 dark:bg-blue-950/20 rounded-lg">
                  <p className="text-sm text-blue-800 dark:text-blue-200">{advancedAnalysis.compliance_notes}</p>
                </div>
              </div>
            </>
          )}
        </Card>
      )}

      {/* Follow-up Questions Section */}
      {risk !== null && (
        <Card className="p-6">
          <h3 className="text-xl font-semibold flex items-center gap-2 mb-4">
            <MessageSquare className="h-5 w-5" />
            Chiedi all'AI
          </h3>
          <p className="text-muted-foreground mb-4">
            Fai domande specifiche sui dati analizzati per ottenere approfondimenti 
          </p>
          
          <div className="space-y-4">
            <div className="flex gap-3">
              <Textarea
                placeholder="Es: Analizza il gameplay..."
                value={followUpQuestion}
                onChange={(e) => setFollowUpQuestion(e.target.value)}
                className="flex-1"
                rows={3}
              />
              <Button 
                onClick={handleFollowUpQuestion}
                disabled={!followUpQuestion.trim() || followUpLoading}
                className="flex items-center gap-2"
              >
                {followUpLoading ? (
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                ) : (
                  <Send className="h-4 w-4" />
                )}
                Invia
              </Button>
            </div>

            {followUpResponse && (
              <div className="p-4 bg-muted rounded-lg">
                <h4 className="font-semibold mb-2">Risposta:</h4>
                <p className="text-sm leading-relaxed">{followUpResponse}</p>
              </div>
            )}
          </div>
        </Card>
      )}


      {/* Charts Section */}
      {advancedAnalysis?.indicators && (
        <div className="space-y-6">
          <h3 className="text-xl font-semibold flex items-center gap-2">
            <BarChart3 className="h-5 w-5" />
            Indicatori e Grafici
          </h3>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <Card className="p-4 h-80">
              <div className="font-medium mb-3 flex items-center gap-2">
                <TrendingUp className="h-4 w-4" />
                Net Flow Mensile
              </div>
              <canvas ref={chart1Ref} className="w-full h-full" />
            </Card>
            
            <Card className="p-4 h-80">
              <div className="font-medium mb-3 flex items-center gap-2">
                <Clock className="h-4 w-4" />
                Distribuzione Oraria
              </div>
              <canvas ref={chart2Ref} className="w-full h-full" />
            </Card>
            
            <Card className="p-4 h-80">
              <div className="font-medium mb-3 flex items-center gap-2">
                <CreditCard className="h-4 w-4" />
                Metodi di Pagamento
              </div>
              <canvas ref={chart3Ref} className="w-full h-full" />
            </Card>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <Card className="p-4 h-80">
              <div className="font-medium mb-3">Andamento Giornaliero (Depositi & Prelievi)</div>
              <canvas ref={chart4Ref} className="w-full h-full" />
            </Card>
            
            <Card className="p-4 h-80">
              <div className="font-medium mb-3">Attività Giornaliera (Conteggio Transazioni)</div>
              <canvas ref={chart5Ref} className="w-full h-full" />
            </Card>
          </div>
        </div>
      )}
    </div>
  );
}

