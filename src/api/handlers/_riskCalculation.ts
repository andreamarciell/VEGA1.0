import { createServiceClient } from './_supabaseAdmin';

export interface Transaction {
  data: Date;
  causale: string;
  importo: number;
}

export interface Frazionata {
  start: string;
  end: string;
  total: number;
}

// Calcola frazionate depositi (ricarica conto gioco per accredito diretto)
export function cercaFrazionateDep(transactions: Transaction[]): Frazionata[] {
  const THRESHOLD = 5000.00;
  const frazionate: Frazionata[] = [];

  const startOfDay = (d: Date) => {
    const t = new Date(d);
    t.setHours(0, 0, 0, 0);
    return t;
  };

  const fmtDateLocal = (d: Date) => {
    const dt = startOfDay(d);
    const y = dt.getFullYear();
    const m = String(dt.getMonth() + 1).padStart(2, '0');
    const da = String(dt.getDate()).padStart(2, '0');
    return `${y}-${m}-${da}`;
  };

  const depositi = transactions.filter(tx => {
    const lower = tx.causale.toLowerCase();
    return lower.includes('ricarica conto gioco per accredito diretto');
  }).sort((a, b) => a.data.getTime() - b.data.getTime());

  let i = 0;
  while (i < depositi.length) {
    const firstTx = depositi[i];
    const windowStart = startOfDay(firstTx.data);
    const windowEndLimit = new Date(windowStart);
    windowEndLimit.setDate(windowEndLimit.getDate() + 7);

    let runningSum = 0;
    const cluster: Transaction[] = [];
    let triggerDate: Date | null = null;

    let j = i;
    while (j < depositi.length) {
      const t = depositi[j];
      const tDay = startOfDay(t.data);

      if (tDay.getTime() >= windowEndLimit.getTime()) break;

      runningSum += Math.abs(t.importo);
      cluster.push(t);

      if (runningSum >= THRESHOLD && !triggerDate) {
        triggerDate = tDay;
        j++;
        while (j < depositi.length) {
          const nextT = depositi[j];
          const nextTDay = startOfDay(nextT.data);
          if (nextTDay.getTime() > triggerDate.getTime()) break;
          runningSum += Math.abs(nextT.importo);
          cluster.push(nextT);
          j++;
        }

        frazionate.push({
          start: fmtDateLocal(windowStart),
          end: fmtDateLocal(triggerDate),
          total: runningSum,
        });

        const nextDay = new Date(triggerDate);
        nextDay.setDate(nextDay.getDate() + 1);
        let nextI = j;
        while (nextI < depositi.length && startOfDay(depositi[nextI].data).getTime() < nextDay.getTime()) {
          nextI++;
        }
        i = nextI;
        break;
      }
      j++;
    }

    if (!triggerDate) {
      i++;
    }
  }

  return frazionate;
}

// Calcola frazionate prelievi (voucher o pvr)
export function cercaFrazionateWit(transactions: Transaction[]): Frazionata[] {
  const THRESHOLD = 5000.00;
  const frazionate: Frazionata[] = [];

  const startOfDay = (d: Date) => {
    const t = new Date(d);
    t.setHours(0, 0, 0, 0);
    return t;
  };

  const fmtDateLocal = (d: Date) => {
    const dt = startOfDay(d);
    const y = dt.getFullYear();
    const m = String(dt.getMonth() + 1).padStart(2, '0');
    const da = String(dt.getDate()).padStart(2, '0');
    return `${y}-${m}-${da}`;
  };

  const prelievi = transactions.filter(tx => {
    const lower = tx.causale.toLowerCase();
    return lower.includes('voucher') || lower.includes('pvr');
  }).sort((a, b) => a.data.getTime() - b.data.getTime());

  let i = 0;
  while (i < prelievi.length) {
    const firstTx = prelievi[i];
    const windowStart = startOfDay(firstTx.data);
    const windowEndLimit = new Date(windowStart);
    windowEndLimit.setDate(windowEndLimit.getDate() + 7);

    let runningSum = 0;
    const cluster: Transaction[] = [];
    let triggerDate: Date | null = null;

    let j = i;
    while (j < prelievi.length) {
      const t = prelievi[j];
      const tDay = startOfDay(t.data);

      if (tDay.getTime() >= windowEndLimit.getTime()) break;

      runningSum += Math.abs(t.importo);
      cluster.push(t);

      if (runningSum >= THRESHOLD && !triggerDate) {
        triggerDate = tDay;
        j++;
        while (j < prelievi.length) {
          const nextT = prelievi[j];
          const nextTDay = startOfDay(nextT.data);
          if (nextTDay.getTime() > triggerDate.getTime()) break;
          runningSum += Math.abs(nextT.importo);
          cluster.push(nextT);
          j++;
        }

        frazionate.push({
          start: fmtDateLocal(windowStart),
          end: fmtDateLocal(triggerDate),
          total: runningSum,
        });

        const nextDay = new Date(triggerDate);
        nextDay.setDate(nextDay.getDate() + 1);
        let nextI = j;
        while (nextI < prelievi.length && startOfDay(prelievi[nextI].data).getTime() < nextDay.getTime()) {
          nextI++;
        }
        i = nextI;
        break;
      }
      j++;
    }

    if (!triggerDate) {
      i++;
    }
  }

  return frazionate;
}

// Calcola patterns AML
export function cercaPatternAML(transactions: Transaction[]): string[] {
  const patterns: string[] = [];
  const depositi = transactions.filter(tx => 
    tx.causale.toLowerCase().includes('ricarica conto gioco per accredito diretto')
  );
  const prelievi = transactions.filter(tx => {
    const causale = tx.causale.toLowerCase();
    return (causale.includes('prelievo') || causale.includes('withdraw')) &&
           !causale.includes('deposito') && !causale.includes('deposit');
  });

  // Ciclo deposito-prelievo rapido
  for (const dep of depositi) {
    const matchingPrelievi = prelievi.filter(pr => {
      const diffTime = pr.data.getTime() - dep.data.getTime();
      const diffDays = diffTime / (1000 * 60 * 60 * 24);
      return diffDays >= 0 && diffDays <= 2;
    });
    if (matchingPrelievi.length > 0) {
      patterns.push("Ciclo deposito-prelievo rapido rilevato");
      break;
    }
  }

  // Abuso bonus
  const bonusTx = transactions.filter(tx => tx.causale.toLowerCase().includes("bonus"));
  if (transactions.length > 0 && bonusTx.length > 0) {
    const percentualeBonus = (bonusTx.length / transactions.length) * 100;
    if (percentualeBonus >= 10) {
      patterns.push("Abuso bonus sospetto rilevato");
    }
  }

  return patterns;
}

// Helper functions per intervalli temporali
export function getDayKey(date: Date): string {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function getWeekKey(date: Date): string {
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

export function getMonthKey(date: Date): string {
  const d = new Date(date);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

// Filtra prelievi con annullamenti
export function filtraPrelieviConAnnullamenti(transactions: Transaction[]): Transaction[] {
  const annullamenti = transactions.filter(tx => {
    const causale = tx.causale.toLowerCase();
    return (
      causale.includes('annullamento prelievo conto da admin') ||
      causale.includes('annullamento prelievo conto da utente')
    );
  });

  const prelievi = transactions.filter(tx => {
    const causale = tx.causale.toLowerCase();
    const isPrelievo = (causale.includes('prelievo') || causale.includes('withdraw')) &&
                       !causale.includes('annullamento') &&
                       !causale.includes('deposito') && !causale.includes('deposit');
    return isPrelievo;
  });

  const prelieviDaEscludere = new Set<Transaction>();
  
  annullamenti.forEach(annullamento => {
    const importoAnnullamento = Math.abs(annullamento.importo);
    const dataAnnullamento = annullamento.data;

    const prelieviCandidati = prelievi
      .filter(tx => {
        if (prelieviDaEscludere.has(tx)) return false;
        const importoTx = Math.abs(tx.importo);
        const dataTx = tx.data;
        const importoMatch = Math.abs(importoTx - importoAnnullamento) < 0.01;
        const dataMatch = dataTx <= dataAnnullamento;
        const diffGiorni = (dataAnnullamento.getTime() - dataTx.getTime()) / (1000 * 60 * 60 * 24);
        const limiteTemporale = diffGiorni <= 90;
        return importoMatch && dataMatch && limiteTemporale;
      })
      .sort((a, b) => b.data.getTime() - a.data.getTime());

    if (prelieviCandidati.length > 0) {
      prelieviDaEscludere.add(prelieviCandidati[0]);
    }
  });

  return transactions.filter(tx => {
    const causale = tx.causale.toLowerCase();
    const isAnnullamento = causale.includes('annullamento prelievo conto da admin') ||
                          causale.includes('annullamento prelievo conto da utente');
    if (isAnnullamento) return false;
    
    const isDeposito = (causale.includes('ricarica') || causale.includes('deposit') || causale.includes('deposito') || causale.includes('accredito')) &&
                       !causale.includes('prelievo') && !causale.includes('withdraw');
    if (isDeposito) return false;
    
    const isPrelievo = (causale.includes('prelievo') || causale.includes('withdraw')) &&
                       !causale.includes('deposito') && !causale.includes('deposit') &&
                       !causale.includes('annullamento');
    
    if (!isPrelievo) return false;
    
    return !prelieviDaEscludere.has(tx);
  });
}

// Configurazione di default
export function getDefaultRiskConfig() {
  return {
    volumeThresholds: {
      daily: 5000,
      weekly: 10000,
      monthly: 15000,
    },
    riskMotivations: {
      frazionate: {
        name: "Rilevato structuring tramite operazioni frazionate.",
        weight: "major",
        enabled: true,
      },
      bonus_concentration: {
        name: "Rilevata concentrazione di bonus.",
        weight: "major",
        threshold_percentage: 10,
        enabled: true,
      },
      casino_live: {
        name: "Rilevata attività significativa su casino live.",
        weight: "minor",
        threshold_percentage: 40,
        enabled: true,
      },
      volumes_daily: {
        name: "Rilevati volumi significativamente elevati su base giornaliera",
        weight: "base",
        enabled: true,
      },
      volumes_weekly: {
        name: "Rilevati volumi significativamente elevati su base settimanale",
        weight: "base",
        enabled: true,
      },
      volumes_monthly: {
        name: "Rilevati volumi significativamente elevati su base mensile",
        weight: "base",
        enabled: true,
      },
    },
    riskLevels: {
      base_levels: {
        monthly_exceeded: "High",
        weekly_or_daily_exceeded: "Medium",
        default: "Low",
      },
      escalation_rules: {
        Low: {
          major_aggravants: "High",
          minor_aggravants: "Medium",
        },
        Medium: {
          major_aggravants: "High",
        },
        High: {
          any_aggravants: "Elevato",
        },
      },
      score_mapping: {
        Elevato: 100,
        High: 80,
        Medium: 50,
        Low: 20,
      },
    },
  };
}

// Legge configurazione dal database Supabase interno
export async function getRiskEngineConfig(): Promise<any> {
  try {
    const service = createServiceClient();
    
    const { data, error } = await service
      .from('risk_engine_config')
      .select('config_key, config_value')
      .eq('is_active', true);

    if (error) {
      console.error('Error fetching risk config from Supabase, using defaults:', error);
      return getDefaultRiskConfig();
    }

    if (!data || data.length === 0) {
      console.log('No risk config found in Supabase, using defaults');
      return getDefaultRiskConfig();
    }

    const config: any = {};
    data.forEach((row: any) => {
      config[row.config_key] = row.config_value;
    });

    return {
      volumeThresholds: config.volume_thresholds || getDefaultRiskConfig().volumeThresholds,
      riskMotivations: config.risk_motivations || getDefaultRiskConfig().riskMotivations,
      riskLevels: config.risk_levels || getDefaultRiskConfig().riskLevels,
    };
  } catch (error) {
    console.error('Exception fetching risk config from Supabase, using defaults:', error);
    return getDefaultRiskConfig();
  }
}

// Calcola rischio completo (stessa logica di riskEngine.ts)
export async function calculateRiskLevel(
  frazionateDep: Frazionata[],
  frazionateWit: Frazionata[],
  patterns: string[],
  transactions: Transaction[]
): Promise<{ score: number; level: 'Low' | 'Medium' | 'High' | 'Elevato' }> {
  const config = await getRiskEngineConfig();
  const motivations: string[] = [];

  // Calcola volumi depositi e prelievi
  const depositi = transactions.filter(tx => {
    const causale = tx.causale.toLowerCase();
    const isPrelievo = causale.includes('prelievo') || causale.includes('withdraw');
    if (isPrelievo) return false;
    return causale.includes('ricarica') || causale.includes('deposit') || causale.includes('deposito') || causale.includes('accredito');
  });

  const prelievi = filtraPrelieviConAnnullamenti(transactions);

  // Raggruppa per intervalli temporali
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

  const { daily: THRESHOLD_GIORNALIERO, weekly: THRESHOLD_SETTIMANALE, monthly: THRESHOLD_MENSILE } = config.volumeThresholds;

  // Controlla soglie
  let hasDailyExceeded = false;
  let hasWeeklyExceeded = false;
  let hasMonthlyExceeded = false;

  if (config.riskMotivations.volumes_daily.enabled) {
    for (const volume of depositiPerGiorno.values()) {
      if (volume > THRESHOLD_GIORNALIERO) {
        hasDailyExceeded = true;
        break;
      }
    }
    for (const volume of prelieviPerGiorno.values()) {
      if (volume > THRESHOLD_GIORNALIERO) {
        hasDailyExceeded = true;
        break;
      }
    }
  }

  if (config.riskMotivations.volumes_weekly.enabled) {
    for (const volume of depositiPerSettimana.values()) {
      if (volume > THRESHOLD_SETTIMANALE) {
        hasWeeklyExceeded = true;
        break;
      }
    }
    for (const volume of prelieviPerSettimana.values()) {
      if (volume > THRESHOLD_SETTIMANALE) {
        hasWeeklyExceeded = true;
        break;
      }
    }
  }

  if (config.riskMotivations.volumes_monthly.enabled) {
    for (const volume of depositiPerMese.values()) {
      if (volume > THRESHOLD_MENSILE) {
        hasMonthlyExceeded = true;
        break;
      }
    }
    for (const volume of prelieviPerMese.values()) {
      if (volume > THRESHOLD_MENSILE) {
        hasMonthlyExceeded = true;
        break;
      }
    }
  }

  // Determina livello base
  let baseLevel: 'Low' | 'Medium' | 'High' = config.riskLevels.base_levels.default as 'Low';
  
  if (hasMonthlyExceeded) {
    baseLevel = config.riskLevels.base_levels.monthly_exceeded as 'High';
  } else if (hasWeeklyExceeded || hasDailyExceeded) {
    baseLevel = config.riskLevels.base_levels.weekly_or_daily_exceeded as 'Medium';
  }

  // Rileva aggravanti
  const allFrazionate = [...frazionateDep, ...frazionateWit];
  const hasFrazionate = allFrazionate.length > 0 && config.riskMotivations.frazionate.enabled;
  
  const hasBonusConcentrationPattern = patterns.some(p => 
    p.includes("Abuso bonus") || p.includes("Abuso bonus sospetto")
  );
  
  const bonusTx = transactions.filter(tx => {
    const causale = tx.causale.toLowerCase();
    return causale.includes('bonus');
  });
  
  const bonusThreshold = config.riskMotivations.bonus_concentration.threshold_percentage || 10;
  const hasBonusConcentrationDirect = transactions.length > 0 && bonusTx.length > 0 && 
    (bonusTx.length / transactions.length) * 100 >= bonusThreshold;
  
  const hasBonusConcentration = config.riskMotivations.bonus_concentration.enabled && 
    (hasBonusConcentrationPattern || hasBonusConcentrationDirect);
  
  // Casino live
  const movimentiGioco = transactions.filter(tx => {
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

  // Applica logica di escalation
  let finalLevel: 'Low' | 'Medium' | 'High' | 'Elevato' = baseLevel;
  
  const hasMajorAggravants = hasFrazionate || hasBonusConcentration;
  const hasMinorAggravant = hasCasinoLive;

  const escalationRules = config.riskLevels.escalation_rules;
  
  if (baseLevel === 'Low') {
    if (hasFrazionate) {
      finalLevel = (escalationRules.Low?.major_aggravants || 'High') as 'High';
    } else if (hasBonusConcentration) {
      finalLevel = (escalationRules.Low?.major_aggravants || 'High') as 'High';
    } else if (hasCasinoLive) {
      finalLevel = (escalationRules.Low?.minor_aggravants || 'Medium') as 'Medium';
    }
  } else if (baseLevel === 'Medium') {
    if (hasMajorAggravants) {
      finalLevel = (escalationRules.Medium?.major_aggravants || 'High') as 'High';
    }
  } else if (baseLevel === 'High') {
    if (hasMajorAggravants || hasMinorAggravant) {
      finalLevel = (escalationRules.High?.any_aggravants || 'Elevato') as 'Elevato';
    }
  }

  // Calcola score usando la configurazione
  const score = config.riskLevels.score_mapping[finalLevel] || 0;

  return { score, level: finalLevel };
}
