/** Netlify Function: amlAdvancedAnalysis
 * POST body: { txs: [{ ts, amount, dir, method?, reason? }] }
 * Returns: { risk_score:number, summary:string, indicators:{ net_flow_by_month, hourly_histogram, method_breakdown } }
 */
export const handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: JSON.stringify({ error: 'method not allowed' }) };
  }
  try {
    const { txs } = JSON.parse(event.body || '{}');
    if (!Array.isArray(txs) || txs.length === 0) {
      return { statusCode: 400, body: JSON.stringify({ error: 'payload mancante' }) };
    }

    const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY;
    if (!OPENROUTER_API_KEY) {
      return { statusCode: 500, body: JSON.stringify({ error: 'OPENROUTER_API_KEY mancante' }) };
    }

    // helpers
    function parseAmount(v) {
      if (typeof v === 'number') return v;
      const s = String(v ?? '').replace(/\./g, '').replace(',', '.').replace(/[^0-9.-]/g, '');
      const n = parseFloat(s);
      return Number.isFinite(n) ? n : 0;
    }
    function normalizeDir(dir, amount, reason='') {
      const s = String(dir || reason || '').toLowerCase();
      if (/(preliev|withdraw|payout|cash ?out|incasso|uscita)/.test(s)) return 'out';
      if (/(deposit|deposi|versament|ricaric|caric)/.test(s)) return 'in';
      if (typeof amount === 'number' && amount < 0) return 'out';
      return 'in';
    }
    function normalizeMethod(method, reason='') {
      const x = String(method || reason || '').toLowerCase();
      if (/(visa|mastercard|amex|maestro|carta|card|apple ?pay|google ?pay)/.test(x)) return 'card';
      if (/(sepa|bonifico|bank|iban|wire|swift|transfer|trustly|klarna|sofort|revolut)/.test(x)) return 'bank';
      if (/(skrill|neteller|paypal|ewallet|wallet|pay ?pal)/.test(x)) return 'ewallet';
      if (/(crypto|btc|bitcoin|eth|ethereum|usdt|usdc|trx|binance|binance ?pay)/.test(x)) return 'crypto';
      if (/(paysafecard|voucher|coupon|gift ?card|prepaid)/.test(x)) return 'voucher';
      if (/(bonus|promo|cashback)/.test(x)) return 'bonus';
      if (/(refund|chargeback|rimborso|storno)/.test(x)) return 'refund';
      return 'other';
    }

    // sanitize & normalize txs
    const sanitized = txs.map(t => {
      const rawAmount = (t.amount ?? t.importo ?? 0);
      const amount = parseAmount(rawAmount);
      const reason = String(t.reason ?? t.causale ?? '')
        .toLowerCase()
        .replace(/\b[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}\b/g, '[email]')
        .replace(/\b(id|player|user|account)[-_ ]?\d+\b/g, '[id]')
        .replace(/[0-9]{6,}/g, '[num]');
      const methodRaw = t.method ?? t.metodo ?? t.payment_method ?? t.paymentMethod ?? t.tipo ?? '';
      const moveType = classifyMove(reason);
      const dir = moveType === 'withdraw' ? 'out' : (moveType === 'deposit' ? 'in' : (typeof amount === 'number' && amount < 0 ? 'out' : 'in'));
      const ts = new Date(t.ts || t.date || t.data);
      return {
        ts: isNaN(ts.getTime()) ? new Date().toISOString() : ts.toISOString(),
        amount,
        dir,
        method: normalizeMethod(methodRaw, reason),
        type: moveType,
        reason
      };
    })

