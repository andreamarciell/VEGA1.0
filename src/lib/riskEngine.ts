import { getRiskEngineConfig } from './riskEngineConfig';

// Types
export interface Transaction {
  data: Date;
  dataStr: string;
  causale: string;
  importo: number;
  importo_raw: any;
  TSN?: string;
  "TS extension"?: string;
  durationMinutes?: number;
}

export interface Frazionata {
  start: string;
  end: string;
  total: number;
  transactions: Array<{
    date: string;
    amount: number;
    causale: string;
    raw?: any;
  }>;
}

export interface VolumeDetails {
  totale: number;
  periodoGiorni: number;
  mediaGiornaliera: number;
  picco: {
    valore: number;
    dataInizio: Date;
    dataFine: Date;
  } | null;
  metodiPagamento: Array<{
    metodo: string;
    volume: number;
    percentuale: number;
    count: number;
  }>;
  transazioni: Transaction[];
}

export interface RiskCalculationResult {
  score: number;
  level: string;
  motivations: string[];
  details?: {
    depositi?: VolumeDetails;
    prelievi?: VolumeDetails;
  };
  motivationIntervals?: Map<string, { interval: 'giornaliera' | 'settimanale' | 'mensile'; key: string; type: 'depositi' | 'prelievi' }>;
}

// Helper function per calcolare i dettagli dei volumi
function calcolaDettagliVolume(
  transazioni: Transaction[], 
  tipo: 'depositi' | 'prelievi'
): VolumeDetails | null {
  if (transazioni.length === 0) return null;
  
  let transazioniValide: Transaction[];
  if (tipo === 'depositi') {
    transazioniValide = transazioni.filter(tx => {
      const causale = tx.causale.toLowerCase();
      return causale.includes('deposito') || causale.includes('ricarica conto gioco per accredito diretto');
    });
  } else {
    // Per i prelievi, esclude esplicitamente gli annullamenti
    transazioniValide = transazioni.filter(tx => {
      const causale = tx.causale.toLowerCase();
      const isAnnullamento = causale.includes('annullamento prelievo conto da admin') ||
                            causale.includes('annullamento prelievo conto da utente');
      return !isAnnullamento;
    });
  }
  
  if (transazioniValide.length === 0) return null;
  
  const totale = transazioniValide.reduce((sum, tx) => sum + Math.abs(tx.importo), 0);
  const dateOrdinate = transazioniValide.map(tx => tx.data).sort((a, b) => a.getTime() - b.getTime());
  const dataInizio = dateOrdinate[0];
  const dataFine = dateOrdinate[dateOrdinate.length - 1];
  const periodoGiorni = Math.max(1, Math.ceil((dataFine.getTime() - dataInizio.getTime()) / (1000 * 60 * 60 * 24)));
  const mediaGiornaliera = totale / periodoGiorni;
  
  let piccoMassimo = 0;
  let piccoInizio: Date | null = null;
  let piccoFine: Date | null = null;
  
  for (let i = 0; i < dateOrdinate.length; i++) {
    const dataInizioFinestra = dateOrdinate[i];
    const dataFineFinestra = new Date(dataInizioFinestra.getTime() + 7 * 24 * 60 * 60 * 1000);
    const transazioniFinestra = transazioniValide.filter(tx => 
      tx.data >= dataInizioFinestra && tx.data <= dataFineFinestra
    );
    const volumeFinestra = transazioniFinestra.reduce((sum, tx) => sum + Math.abs(tx.importo), 0);
    
    if (volumeFinestra > piccoMassimo) {
      piccoMassimo = volumeFinestra;
      piccoInizio = dataInizioFinestra;
      piccoFine = dataFineFinestra;
    }
  }
  
  const picco = piccoMassimo > 0 && piccoInizio && piccoFine ? {
    valore: piccoMassimo,
    dataInizio: piccoInizio,
    dataFine: piccoFine
  } : null;
  
  const metodiMap: Record<string, { volume: number; count: number }> = {};
  transazioniValide.forEach(tx => {
    const causale = tx.causale.toLowerCase();
    let metodo = 'Altro';
    
    const txAny = tx as any;
    const metodoFromProps = txAny.metodo || txAny.method || txAny.payment_method || 
                           txAny.paymentMethod || txAny.tipo || '';
    
    if (tipo === 'depositi') {
      if (metodoFromProps && typeof metodoFromProps === 'string') {
        const metodoLower = metodoFromProps.toLowerCase();
        if (metodoLower.includes('safecharge') || metodoLower.includes('novapay') || 
            metodoLower.includes('nuvei') || metodoLower.includes('carta') || metodoLower.includes('card')) {
          metodo = 'Carte';
        } else if (metodoLower.includes('bonifico') || metodoLower.includes('wire')) {
          metodo = 'Bonifico';
        } else if (metodoLower.includes('paypal')) {
          metodo = 'PayPal';
        } else if (metodoLower.includes('skrill')) {
          metodo = 'Skrill';
        } else if (metodoLower.includes('neteller')) {
          metodo = 'Neteller';
        } else if (metodoLower.includes('contante') || metodoLower.includes('cash') || 
                   (metodoLower.includes('accredito') && metodoLower.includes('diretto'))) {
          metodo = 'Accredito Diretto/Contante';
        }
      }
      
      if (metodo === 'Altro') {
        if (causale.includes('ricarica conto gioco per accredito diretto')) {
          metodo = 'Accredito Diretto/Contante';
        } else if (causale.includes('deposito')) {
          if (causale.includes('safecharge') || causale.includes('novapay') || 
              causale.includes('nuvei') || causale.includes('carta') || causale.includes('card')) {
            metodo = 'Carte';
          } else if (causale.includes('bonifico') || causale.includes('wire transfer')) {
            metodo = 'Bonifico';
          } else if (causale.includes('paypal')) {
            metodo = 'PayPal';
          } else if (causale.includes('skrill')) {
            metodo = 'Skrill';
          } else if (causale.includes('neteller')) {
            metodo = 'Neteller';
          } else {
            metodo = 'Carte';
          }
        }
      }
    } else {
      if (metodoFromProps && typeof metodoFromProps === 'string') {
        const metodoLower = metodoFromProps.toLowerCase();
        if (metodoLower.includes('carta') || metodoLower.includes('card')) {
          metodo = 'Carta';
        } else if (metodoLower.includes('bonifico') || metodoLower.includes('wire')) {
          metodo = 'Bonifico';
        } else if (metodoLower.includes('paypal')) {
          metodo = 'PayPal';
        } else if (metodoLower.includes('skrill')) {
          metodo = 'Skrill';
        } else if (metodoLower.includes('neteller')) {
          metodo = 'Neteller';
        } else if (metodoLower.includes('voucher') || metodoLower.includes('pvr')) {
          metodo = 'Voucher/PVR';
        } else if (metodoLower.includes('contante') || metodoLower.includes('cash') || 
                   metodoLower.includes('accredito') || metodoLower.includes('dirett')) {
          metodo = 'Accredito Diretto/Contante';
        }
      }
      
      if (metodo === 'Altro') {
        if (causale.includes('carta') || causale.includes('card') || 
            causale.includes('visa') || causale.includes('mastercard')) {
          metodo = 'Carta';
        } else if (causale.includes('bonifico') || causale.includes('wire transfer')) {
          metodo = 'Bonifico';
        } else if (causale.includes('paypal')) {
          metodo = 'PayPal';
        } else if (causale.includes('skrill')) {
          metodo = 'Skrill';
        } else if (causale.includes('neteller')) {
          metodo = 'Neteller';
        } else if (causale.includes('voucher') || causale.includes('pvr')) {
          metodo = 'Voucher/PVR';
        } else if (causale.includes('accredito diretto') || causale.includes('contante') || 
                   causale.includes('cash')) {
          metodo = 'Accredito Diretto/Contante';
        }
      }
    }
    
    if (!metodiMap[metodo]) {
      metodiMap[metodo] = { volume: 0, count: 0 };
    }
    metodiMap[metodo].volume += Math.abs(tx.importo);
    metodiMap[metodo].count += 1;
  });
  
  const metodiPagamento = Object.entries(metodiMap)
    .map(([metodo, dati]) => ({
      metodo,
      volume: dati.volume,
      percentuale: (dati.volume / totale) * 100,
      count: dati.count
    }))
    .sort((a, b) => b.volume - a.volume);
  
  return {
    totale,
    periodoGiorni,
    mediaGiornaliera,
    picco,
    metodiPagamento,
    transazioni: transazioniValide
  };
}

// Helper function per filtrare prelievi annullati
function filtraPrelieviConAnnullamenti(transactions: Transaction[]): Transaction[] {
  const annullamenti = transactions.filter(tx => {
    const causale = tx.causale.toLowerCase();
    return (
      causale.includes('annullamento prelievo conto da admin') ||
      causale.includes('annullamento prelievo conto da utente')
    );
  });

  const transazioniDaEscludere = new Set<Transaction>();
  
  annullamenti.forEach(annullamento => {
    transazioniDaEscludere.add(annullamento);
  });

  annullamenti.forEach(annullamento => {
    const importoAnnullamento = Math.abs(annullamento.importo);
    const tsnAnnullamento = annullamento.TSN || annullamento["TS extension"];
    const dataAnnullamento = annullamento.data;

    const prelievoCorrispondente = transactions.find(tx => {
      const causale = tx.causale.toLowerCase();
      const isPrelievo = (causale.includes('prelievo') || causale.includes('withdraw')) &&
                        !causale.includes('annullamento');
      
      if (!isPrelievo) return false;
      if (transazioniDaEscludere.has(tx)) return false;
      
      const importoTx = Math.abs(tx.importo);
      const tsnTx = tx.TSN || tx["TS extension"];
      const dataTx = tx.data;
      
      const importoMatch = Math.abs(importoTx - importoAnnullamento) < 0.01;
      const tsnMatch = tsnAnnullamento && tsnTx && tsnAnnullamento === tsnTx;
      const dataMatch = dataTx <= dataAnnullamento;
      
      return importoMatch && dataMatch && (tsnMatch || (!tsnAnnullamento && !tsnTx));
    });

    if (prelievoCorrispondente) {
      transazioniDaEscludere.add(prelievoCorrispondente);
    }
  });

  return transactions.filter(tx => {
    const causale = tx.causale.toLowerCase();
    
    // Esclude esplicitamente gli annullamenti di prelievo (da utente o admin)
    const isAnnullamento = causale.includes('annullamento prelievo conto da admin') ||
                          causale.includes('annullamento prelievo conto da utente');
    if (isAnnullamento) return false;
    
    // Esclude esplicitamente i depositi
    const isDeposito = (causale.includes('ricarica') || causale.includes('deposit') || causale.includes('deposito') || causale.includes('accredito')) &&
                       !causale.includes('prelievo') && !causale.includes('withdraw');
    if (isDeposito) return false;
    
    // Include solo prelievi: "Prelievo carta di credito" o altri prelievi
    // Esclude "Deposito safecharge" e "Deposito NuveiCC (Novapay)"
    const isPrelievo = (causale.includes('prelievo') || causale.includes('withdraw')) &&
                       !causale.includes('deposito') && !causale.includes('deposit') &&
                       !causale.includes('annullamento');
    
    if (!isPrelievo) return false;
    // Esclude anche i prelievi che sono stati annullati (già aggiunti a transazioniDaEscludere)
    return !transazioniDaEscludere.has(tx);
  });
}

// Helper functions per raggruppare transazioni per intervalli temporali
function getDayKey(date: Date): string {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function getWeekKey(date: Date): string {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  const dayOfWeek = d.getDay();
  const diff = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
  const monday = new Date(d);
  monday.setDate(d.getDate() + diff);
  const year = monday.getFullYear();
  const month = String(monday.getMonth() + 1).padStart(2, '0');
  const day = String(monday.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function getMonthKey(date: Date): string {
  const d = new Date(date);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

// Main risk calculation function
export async function calculateRiskLevel(
  frazionateDep: Frazionata[],
  frazionateWit: Frazionata[],
  patterns: string[],
  txs: Transaction[],
  accessi: any[]
): Promise<RiskCalculationResult> {
  const config = await getRiskEngineConfig();
  const motivations: string[] = [];
  const motivationIntervals = new Map<string, { interval: 'giornaliera' | 'settimanale' | 'mensile'; key: string; type: 'depositi' | 'prelievi' }>();

  // Calcola volumi depositi e prelievi
  const depositi = txs.filter(tx => {
    const causale = tx.causale.toLowerCase();
    // Include depositi: ricarica, deposit/deposito, accredito
    // Esclude esplicitamente i prelievi
    const isPrelievo = causale.includes('prelievo') || causale.includes('withdraw');
    if (isPrelievo) return false;
    return causale.includes('ricarica') || causale.includes('deposit') || causale.includes('deposito') || causale.includes('accredito');
  });
  const detailsDepositi = calcolaDettagliVolume(depositi, 'depositi');

  const prelievi = filtraPrelieviConAnnullamenti(txs);
  const detailsPrelievi = calcolaDettagliVolume(prelievi, 'prelievi');

  // Raggruppa depositi e prelievi per intervalli temporali
  const depositiPerGiorno = new Map<string, number>();
  const depositiPerSettimana = new Map<string, number>();
  const depositiPerMese = new Map<string, number>();
  
  const prelieviPerGiorno = new Map<string, number>();
  const prelieviPerSettimana = new Map<string, number>();
  const prelieviPerMese = new Map<string, number>();

  depositi.forEach(tx => {
    const importo = Math.abs(tx.importo);
    const dayKey = getDayKey(tx.data);
    const weekKey = getWeekKey(tx.data);
    const monthKey = getMonthKey(tx.data);
    
    depositiPerGiorno.set(dayKey, (depositiPerGiorno.get(dayKey) || 0) + importo);
    depositiPerSettimana.set(weekKey, (depositiPerSettimana.get(weekKey) || 0) + importo);
    depositiPerMese.set(monthKey, (depositiPerMese.get(monthKey) || 0) + importo);
  });

  prelievi.forEach(tx => {
    const importo = Math.abs(tx.importo);
    const dayKey = getDayKey(tx.data);
    const weekKey = getWeekKey(tx.data);
    const monthKey = getMonthKey(tx.data);
    
    prelieviPerGiorno.set(dayKey, (prelieviPerGiorno.get(dayKey) || 0) + importo);
    prelieviPerSettimana.set(weekKey, (prelieviPerSettimana.get(weekKey) || 0) + importo);
    prelieviPerMese.set(monthKey, (prelieviPerMese.get(monthKey) || 0) + importo);
  });

  // Usa le soglie dalla configurazione
  const { daily: THRESHOLD_GIORNALIERO, weekly: THRESHOLD_SETTIMANALE, monthly: THRESHOLD_MENSILE } = config.volumeThresholds;

  // Controlla soglie giornaliere
  let hasDailyExceeded = false;
  if (config.riskMotivations.volumes_daily.enabled) {
    for (const [dayKey, volume] of depositiPerGiorno.entries()) {
      if (volume > THRESHOLD_GIORNALIERO) {
        hasDailyExceeded = true;
        const motivation = `${config.riskMotivations.volumes_daily.name} di deposito (>€${THRESHOLD_GIORNALIERO.toLocaleString('it-IT')}) per il giorno ${dayKey}.`;
        motivations.push(motivation);
        motivationIntervals.set(motivation, { interval: 'giornaliera', key: dayKey, type: 'depositi' });
        break;
      }
    }
    for (const [dayKey, volume] of prelieviPerGiorno.entries()) {
      if (volume > THRESHOLD_GIORNALIERO) {
        hasDailyExceeded = true;
        const motivation = `${config.riskMotivations.volumes_daily.name} di prelievo (>€${THRESHOLD_GIORNALIERO.toLocaleString('it-IT')}) per il giorno ${dayKey}.`;
        motivations.push(motivation);
        motivationIntervals.set(motivation, { interval: 'giornaliera', key: dayKey, type: 'prelievi' });
        break;
      }
    }
  }

  // Controlla soglie settimanali
  let hasWeeklyExceeded = false;
  if (config.riskMotivations.volumes_weekly.enabled) {
    for (const [weekKey, volume] of depositiPerSettimana.entries()) {
      if (volume > THRESHOLD_SETTIMANALE) {
        hasWeeklyExceeded = true;
        const motivation = `${config.riskMotivations.volumes_weekly.name} di deposito (>€${THRESHOLD_SETTIMANALE.toLocaleString('it-IT')}) per la settimana ${weekKey}.`;
        motivations.push(motivation);
        motivationIntervals.set(motivation, { interval: 'settimanale', key: weekKey, type: 'depositi' });
        break;
      }
    }
    for (const [weekKey, volume] of prelieviPerSettimana.entries()) {
      if (volume > THRESHOLD_SETTIMANALE) {
        hasWeeklyExceeded = true;
        const motivation = `${config.riskMotivations.volumes_weekly.name} di prelievo (>€${THRESHOLD_SETTIMANALE.toLocaleString('it-IT')}) per la settimana ${weekKey}.`;
        motivations.push(motivation);
        motivationIntervals.set(motivation, { interval: 'settimanale', key: weekKey, type: 'prelievi' });
        break;
      }
    }
  }

  // Controlla soglie mensili
  let hasMonthlyExceeded = false;
  if (config.riskMotivations.volumes_monthly.enabled) {
    for (const [monthKey, volume] of depositiPerMese.entries()) {
      if (volume > THRESHOLD_MENSILE) {
        hasMonthlyExceeded = true;
        const motivation = `${config.riskMotivations.volumes_monthly.name} di deposito (>€${THRESHOLD_MENSILE.toLocaleString('it-IT')}) per il mese ${monthKey}.`;
        motivations.push(motivation);
        motivationIntervals.set(motivation, { interval: 'mensile', key: monthKey, type: 'depositi' });
        break;
      }
    }
    for (const [monthKey, volume] of prelieviPerMese.entries()) {
      if (volume > THRESHOLD_MENSILE) {
        hasMonthlyExceeded = true;
        const motivation = `${config.riskMotivations.volumes_monthly.name} di prelievo (>€${THRESHOLD_MENSILE.toLocaleString('it-IT')}) per il mese ${monthKey}.`;
        motivations.push(motivation);
        motivationIntervals.set(motivation, { interval: 'mensile', key: monthKey, type: 'prelievi' });
        break;
      }
    }
  }

  // Determina il livello base
  let baseLevel: 'Low' | 'Medium' | 'High' = config.riskLevels.base_levels.default as 'Low';
  
  if (hasMonthlyExceeded) {
    baseLevel = config.riskLevels.base_levels.monthly_exceeded as 'High';
  } else if (hasWeeklyExceeded || hasDailyExceeded) {
    baseLevel = config.riskLevels.base_levels.weekly_or_daily_exceeded as 'Medium';
  }

  // Rileva aggravanti
  const allFrazionate = [...frazionateDep, ...frazionateWit];
  const hasFrazionate = allFrazionate.length > 0 && config.riskMotivations.frazionate.enabled;
  
  // Bonus concentration
  const hasBonusConcentrationPattern = patterns.some(p => 
    p.includes("Abuso bonus") || p.includes("Abuso bonus sospetto")
  );
  
  const bonusTx = txs.filter(tx => {
    const causale = tx.causale.toLowerCase();
    return causale.includes('bonus');
  });
  
  const bonusThreshold = config.riskMotivations.bonus_concentration.threshold_percentage || 10;
  const hasBonusConcentrationDirect = txs.length > 0 && bonusTx.length > 0 && 
    (bonusTx.length / txs.length) * 100 >= bonusThreshold;
  
  const hasBonusConcentration = config.riskMotivations.bonus_concentration.enabled && 
    (hasBonusConcentrationPattern || hasBonusConcentrationDirect);
  
  // Casino live
  const movimentiGioco = txs.filter(tx => {
    const causale = tx.causale.toLowerCase();
    const isDeposit = causale.includes('ricarica') || causale.includes('deposit') || causale.includes('accredito');
    const isWithdraw = causale.includes('prelievo') || causale.includes('withdraw');
    const isBonus = causale.includes('bonus');
    
    const isGame = causale.includes('session') || 
                   causale.includes('giocata') || 
                   causale.includes('scommessa') ||
                   causale.includes('bingo') ||
                   causale.includes('poker') ||
                   causale.includes('casino live') ||
                   causale.includes('evolution') ||
                   causale.includes('gratta') ||
                   causale.includes('vinci');
    
    return isGame && !isDeposit && !isWithdraw && !isBonus;
  });
  
  const liveSessions = movimentiGioco.filter(tx => {
    const causale = tx.causale.toLowerCase();
    return causale.includes('live') || 
           causale.includes('casino live') || 
           causale.includes('evolution') ||
           (causale.includes('session') && causale.includes('live'));
  });
  
  const casinoLiveThreshold = config.riskMotivations.casino_live.threshold_percentage || 40;
  const hasCasinoLive = config.riskMotivations.casino_live.enabled && 
    movimentiGioco.length > 0 && 
    (liveSessions.length / movimentiGioco.length) * 100 >= casinoLiveThreshold;

  // Applica logica di escalation usando la configurazione
  let finalLevel: 'Low' | 'Medium' | 'High' | 'Elevato' = baseLevel;
  
  const hasMajorAggravants = hasFrazionate || hasBonusConcentration;
  const hasMinorAggravant = hasCasinoLive;

  const escalationRules = config.riskLevels.escalation_rules;
  
  // Logica di escalation
  if (baseLevel === 'Low') {
    if (hasFrazionate) {
      finalLevel = (escalationRules.Low?.major_aggravants || 'High') as 'High';
      motivations.push(config.riskMotivations.frazionate.name);
    } else if (hasBonusConcentration) {
      finalLevel = (escalationRules.Low?.major_aggravants || 'High') as 'High';
      motivations.push(config.riskMotivations.bonus_concentration.name);
    } else if (hasCasinoLive) {
      finalLevel = (escalationRules.Low?.minor_aggravants || 'Medium') as 'Medium';
      motivations.push(config.riskMotivations.casino_live.name);
    }
  } else if (baseLevel === 'Medium') {
    if (hasMajorAggravants) {
      finalLevel = (escalationRules.Medium?.major_aggravants || 'High') as 'High';
      if (hasFrazionate) {
        motivations.push(config.riskMotivations.frazionate.name);
      }
      if (hasBonusConcentration) {
        motivations.push(config.riskMotivations.bonus_concentration.name);
      }
    }
    if (hasCasinoLive && !hasMajorAggravants) {
      motivations.push(config.riskMotivations.casino_live.name);
    }
  } else if (baseLevel === 'High') {
    if (hasMajorAggravants || hasMinorAggravant) {
      finalLevel = (escalationRules.High?.any_aggravants || 'Elevato') as 'Elevato';
      if (hasFrazionate) {
        motivations.push(config.riskMotivations.frazionate.name);
      }
      if (hasBonusConcentration) {
        motivations.push(config.riskMotivations.bonus_concentration.name);
      }
      if (hasCasinoLive) {
        motivations.push(config.riskMotivations.casino_live.name);
      }
    }
  }

  // Calcola score usando la configurazione
  const score = config.riskLevels.score_mapping[finalLevel] || 0;

  return { 
    score, 
    level: finalLevel, 
    motivations,
    details: {
      depositi: detailsDepositi || undefined,
      prelievi: detailsPrelievi || undefined
    },
    motivationIntervals: motivationIntervals.size > 0 ? motivationIntervals : undefined
  };
}
