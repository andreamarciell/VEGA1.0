import type { Handler } from '@netlify/functions';
import { createServiceClient } from './_supabaseAdmin';
import { queryBigQuery, insertBigQuery, createTableIfNotExists, parseBigQueryDate } from './_bigqueryClient';
import {
  cercaFrazionateDep,
  cercaFrazionateWit,
  cercaPatternAML,
  calculateRiskLevel,
  getRiskEngineConfig,
  getDayKey,
  getWeekKey,
  getMonthKey,
  filtraPrelieviConAnnullamenti,
  type Transaction
} from './_riskCalculation';

const handler: Handler = async (event) => {
  // Verifica che sia una chiamata scheduled (da Netlify cron) o manuale
  const isScheduled = event.headers['user-agent']?.includes('Netlify-Scheduled-Function');
  const triggerReason = isScheduled ? 'scheduled' : 'manual';
  
  if (isScheduled) {
    console.log('Scheduled risk calculation started');
  } else {
    // Permette anche chiamate manuali (per test)
    console.log('Manual risk calculation triggered');
  }

  const supabase = createServiceClient();

  try {
    // Crea la tabella history su BigQuery se non esiste
    console.log('Ensuring player_risk_scores_history table exists...');
    await createTableIfNotExists('toppery_test', 'player_risk_scores_history', [
      { name: 'account_id', type: 'STRING', mode: 'REQUIRED' },
      { name: 'risk_score', type: 'INTEGER', mode: 'REQUIRED' },
      { name: 'risk_level', type: 'STRING', mode: 'REQUIRED' },
      { name: 'status', type: 'STRING', mode: 'REQUIRED' },
      { name: 'calculated_at', type: 'TIMESTAMP', mode: 'REQUIRED' },
      { name: 'trigger_reason', type: 'STRING', mode: 'REQUIRED' },
      { name: 'created_at', type: 'TIMESTAMP', mode: 'REQUIRED' }
    ]);

    // Query tutti i profili da BigQuery
    console.log('Fetching profiles from BigQuery...');
    const profiles = await queryBigQuery<{ account_id: string; nick: string; first_name: string; last_name: string }>(
      `SELECT account_id, nick, first_name, last_name
      FROM \`toppery_test.Profiles\`
      ORDER BY account_id ASC`
    );
    console.log(`Found ${profiles.length} profiles from BigQuery`);

    // Deduplica per account_id (nel caso ci siano duplicati in BigQuery)
    const uniqueProfilesMap = new Map<string, { account_id: string; nick: string; first_name: string; last_name: string }>();
    const duplicateIds = new Set<string>();
    profiles.forEach(profile => {
      // Normalizza account_id a stringa e rimuovi spazi per garantire matching corretto
      const accountIdKey = String(profile.account_id).trim();
      if (!uniqueProfilesMap.has(accountIdKey)) {
        uniqueProfilesMap.set(accountIdKey, profile);
      } else {
        duplicateIds.add(accountIdKey);
      }
    });
    const uniqueProfiles = Array.from(uniqueProfilesMap.values());
    
    // Logga un riepilogo dei duplicati invece di un warning per ognuno
    if (duplicateIds.size > 0) {
      console.warn(`Found ${duplicateIds.size} duplicate account_ids in BigQuery: ${Array.from(duplicateIds).slice(0, 10).join(', ')}${duplicateIds.size > 10 ? '...' : ''}`);
    }
    
    console.log(`Deduplicated to ${uniqueProfiles.length} unique profiles (${profiles.length} total from BigQuery)`);
    console.log(`Processing ${uniqueProfiles.length} unique profiles`);

    const updates: Array<{ 
      account_id: string; 
      risk_score: number; 
      risk_level: string;
      transactions: Transaction[];
    }> = [];

    // Per ogni giocatore, calcola il rischio
    for (let i = 0; i < uniqueProfiles.length; i++) {
      const profile = uniqueProfiles[i];
      const accountId = profile.account_id;
      
      try {
        if (i % 10 === 0) {
          console.log(`Processing player ${i + 1}/${uniqueProfiles.length}: ${accountId}`);
        }

        // Query movements da BigQuery
        const movements = await queryBigQuery<{ id: string; created_at: string; account_id: string; reason: string; amount: number; ts_extension: string | null }>(
          `SELECT id, created_at, account_id, reason, amount, ts_extension
          FROM \`toppery_test.Movements\`
          WHERE account_id = @account_id
          ORDER BY created_at ASC`,
          { account_id: accountId }
        );

        // Converti in Transaction[]
        const transactions: Transaction[] = movements.map(mov => ({
          data: parseBigQueryDate(mov.created_at),
          causale: mov.reason || '',
          importo: mov.amount || 0
        }));

        if (transactions.length > 0) {
          // Calcola frazionate e patterns
          const frazionateDep = cercaFrazionateDep(transactions);
          const frazionateWit = cercaFrazionateWit(transactions);
          const patterns = cercaPatternAML(transactions);
          
          // Calcola rischio
          const risk = await calculateRiskLevel(frazionateDep, frazionateWit, patterns, transactions);
          
          updates.push({
            account_id: accountId,
            risk_score: risk.score,
            risk_level: risk.level,
            transactions: transactions
          });
        } else {
          // Nessuna transazione = rischio basso
          updates.push({
            account_id: accountId,
            risk_score: 0,
            risk_level: 'Low',
            transactions: []
          });
        }
      } catch (error) {
        console.error(`Error processing player ${accountId}:`, error);
        // Continua con il prossimo
      }
    }

    // Salva tutti i risultati: current score su Supabase e history su BigQuery
    console.log(`Saving ${updates.length} risk scores (current to Supabase, history to BigQuery)...`);
    
    let savedCount = 0;
    let errorCount = 0;
    const historyRows: Array<{
      account_id: string;
      risk_score: number;
      risk_level: string;
      status: string;
      calculated_at: string;
      trigger_reason: string;
      created_at: string;
    }> = [];
    
    for (const update of updates) {
      // Leggi lo status esistente e last_action_at per preservarlo
      const { data: existing } = await supabase
        .from('player_risk_scores')
        .select('status, last_action_at')
        .eq('account_id', update.account_id)
        .single();

      const oldStatus = existing?.status || 'active';
      
      // Determina il nuovo status:
      let newStatus = oldStatus;
      
      // Variabili per il log del re-trigger
      let hasNewFrazionate = false;
      let hasNewVolumeThresholds = false;
      
      // Status veramente manuali che devono essere preservati
      const manualStatuses = ['reviewed', 'escalated', 'archived'];
      const isManualStatus = newStatus && manualStatuses.includes(newStatus);
      
      if (isManualStatus) {
        // Se lo status è manuale, verifica se ci sono nuove transazioni/frazionate
        // dall'ultima azione che generano nuove allerte
        
        const allTransactions = update.transactions;
        
        // Se c'è un last_action_at, verifica se ci sono nuove transazioni
        let hasNewTransactions = false;
        if (existing?.last_action_at) {
          const lastActionDate = new Date(existing.last_action_at);
          hasNewTransactions = allTransactions.some(tx => tx.data > lastActionDate);
        } else {
          // Se non c'è last_action_at, considera tutte le transazioni come "nuove"
          hasNewTransactions = allTransactions.length > 0;
        }

        // Se ci sono nuove transazioni, verifica se generano nuove allerte
        if (hasNewTransactions) {
          // Calcola frazionate su TUTTE le transazioni (per vedere se le nuove
          // transazioni, combinate con quelle esistenti, creano nuove frazionate)
          const frazionateDep = cercaFrazionateDep(allTransactions);
          const frazionateWit = cercaFrazionateWit(allTransactions);
          
          // Verifica se ci sono frazionate che includono transazioni dopo last_action_at
          hasNewFrazionate = false;
          if (existing?.last_action_at) {
            const lastActionDate = new Date(existing.last_action_at);
            
            // Verifica se ci sono frazionate che contengono transazioni dopo last_action_at
            // Per ogni frazionata, verifica se contiene transazioni dopo last_action_at
            const checkFrazionate = (frazionate: typeof frazionateDep, isDeposit: boolean) => {
              return frazionate.some(fraz => {
                // Le frazionate hanno start e end come date string (YYYY-MM-DD)
                const frazStartDate = new Date(fraz.start + 'T00:00:00');
                const frazEndDate = new Date(fraz.end + 'T23:59:59');
                
                // Se la frazionata inizia dopo last_action_at, è sicuramente nuova
                if (frazStartDate > lastActionDate) {
                  return true;
                }
                
                // Se la frazionata termina dopo last_action_at, verifica se ci sono
                // transazioni effettive nel range [last_action_at, end] che potrebbero
                // far parte della frazionata
                if (frazEndDate > lastActionDate) {
                  // Verifica se ci sono transazioni nel range della frazionata dopo last_action_at
                  const relevantTxs = allTransactions.filter(tx => {
                    const txDate = new Date(tx.data);
                    const txDay = new Date(txDate);
                    txDay.setHours(0, 0, 0, 0);
                    
                    // Verifica se la transazione è nel range della frazionata
                    const txDayStr = `${txDay.getFullYear()}-${String(txDay.getMonth() + 1).padStart(2, '0')}-${String(txDay.getDate()).padStart(2, '0')}`;
                    const isInRange = txDayStr >= fraz.start && txDayStr <= fraz.end;
                    
                    // Verifica se è del tipo corretto (deposito o prelievo)
                    const lower = tx.causale.toLowerCase();
                    const isCorrectType = isDeposit 
                      ? lower.includes('ricarica conto gioco per accredito diretto')
                      : (lower.includes('voucher') || lower.includes('pvr'));
                    
                    return isInRange && isCorrectType && txDate > lastActionDate;
                  });
                  
                  return relevantTxs.length > 0;
                }
                
                return false;
              });
            };
            
            // Verifica sia per depositi che per prelievi
            hasNewFrazionate = checkFrazionate(frazionateDep, true) || checkFrazionate(frazionateWit, false);
          } else {
            // Se non c'è last_action_at, considera tutte le frazionate come "nuove"
            hasNewFrazionate = frazionateDep.length > 0 || frazionateWit.length > 0;
          }
          
          // Verifica anche se ci sono nuove transazioni che superano le soglie di volume
          // (depositi/prelievi oltre soglia giornaliera, settimanale o mensile)
          hasNewVolumeThresholds = false;
          if (existing?.last_action_at) {
            const lastActionDate = new Date(existing.last_action_at);
            const config = await getRiskEngineConfig();
            
            // Filtra depositi e prelievi
            const depositi = allTransactions.filter(tx => {
              const causale = tx.causale.toLowerCase();
              const isPrelievo = causale.includes('prelievo') || causale.includes('withdraw');
              if (isPrelievo) return false;
              return causale.includes('ricarica') || causale.includes('deposit') || causale.includes('deposito') || causale.includes('accredito');
            });
            
            const prelievi = filtraPrelieviConAnnullamenti(allTransactions);
            
            // Raggruppa per intervalli temporali su TUTTE le transazioni
            // ma verifica solo i periodi che includono transazioni dopo last_action_at
            const depositiPerGiorno = new Map<string, number>();
            const depositiPerSettimana = new Map<string, number>();
            const depositiPerMese = new Map<string, number>();
            
            const prelieviPerGiorno = new Map<string, number>();
            const prelieviPerSettimana = new Map<string, number>();
            const prelieviPerMese = new Map<string, number>();
            
            // Set per tracciare quali periodi includono transazioni dopo last_action_at
            const giorniConNuoveTransazioni = new Set<string>();
            const settimaneConNuoveTransazioni = new Set<string>();
            const mesiConNuoveTransazioni = new Set<string>();
            
            // Calcola volumi su TUTTE le transazioni
            depositi.forEach(tx => {
              const importo = Math.abs(tx.importo);
              const dayKey = getDayKey(tx.data);
              const weekKey = getWeekKey(tx.data);
              const monthKey = getMonthKey(tx.data);
              
              depositiPerGiorno.set(dayKey, (depositiPerGiorno.get(dayKey) || 0) + importo);
              depositiPerSettimana.set(weekKey, (depositiPerSettimana.get(weekKey) || 0) + importo);
              depositiPerMese.set(monthKey, (depositiPerMese.get(monthKey) || 0) + importo);
              
              // Se la transazione è dopo last_action_at, segna il periodo
              if (tx.data > lastActionDate) {
                giorniConNuoveTransazioni.add(dayKey);
                settimaneConNuoveTransazioni.add(weekKey);
                mesiConNuoveTransazioni.add(monthKey);
              }
            });
            
            prelievi.forEach(tx => {
              const importo = Math.abs(tx.importo);
              const dayKey = getDayKey(tx.data);
              const weekKey = getWeekKey(tx.data);
              const monthKey = getMonthKey(tx.data);
              
              prelieviPerGiorno.set(dayKey, (prelieviPerGiorno.get(dayKey) || 0) + importo);
              prelieviPerSettimana.set(weekKey, (prelieviPerSettimana.get(weekKey) || 0) + importo);
              prelieviPerMese.set(monthKey, (prelieviPerMese.get(monthKey) || 0) + importo);
              
              // Se la transazione è dopo last_action_at, segna il periodo
              if (tx.data > lastActionDate) {
                giorniConNuoveTransazioni.add(dayKey);
                settimaneConNuoveTransazioni.add(weekKey);
                mesiConNuoveTransazioni.add(monthKey);
              }
            });
            
            const { daily: THRESHOLD_GIORNALIERO, weekly: THRESHOLD_SETTIMANALE, monthly: THRESHOLD_MENSILE } = config.volumeThresholds;
            
            // Verifica se ci sono periodi che includono transazioni dopo last_action_at e che superano le soglie
            if (config.riskMotivations.volumes_daily.enabled) {
              for (const dayKey of giorniConNuoveTransazioni) {
                const volumeDep = depositiPerGiorno.get(dayKey) || 0;
                const volumeWit = prelieviPerGiorno.get(dayKey) || 0;
                if (volumeDep > THRESHOLD_GIORNALIERO || volumeWit > THRESHOLD_GIORNALIERO) {
                  hasNewVolumeThresholds = true;
                  break;
                }
              }
            }
            
            if (!hasNewVolumeThresholds && config.riskMotivations.volumes_weekly.enabled) {
              for (const weekKey of settimaneConNuoveTransazioni) {
                const volumeDep = depositiPerSettimana.get(weekKey) || 0;
                const volumeWit = prelieviPerSettimana.get(weekKey) || 0;
                if (volumeDep > THRESHOLD_SETTIMANALE || volumeWit > THRESHOLD_SETTIMANALE) {
                  hasNewVolumeThresholds = true;
                  break;
                }
              }
            }
            
            if (!hasNewVolumeThresholds && config.riskMotivations.volumes_monthly.enabled) {
              for (const monthKey of mesiConNuoveTransazioni) {
                const volumeDep = depositiPerMese.get(monthKey) || 0;
                const volumeWit = prelieviPerMese.get(monthKey) || 0;
                if (volumeDep > THRESHOLD_MENSILE || volumeWit > THRESHOLD_MENSILE) {
                  hasNewVolumeThresholds = true;
                  break;
                }
              }
            }
          } else {
            // Se non c'è last_action_at, verifica se ci sono transazioni che superano le soglie
            const config = await getRiskEngineConfig();
            const depositi = allTransactions.filter(tx => {
              const causale = tx.causale.toLowerCase();
              const isPrelievo = causale.includes('prelievo') || causale.includes('withdraw');
              if (isPrelievo) return false;
              return causale.includes('ricarica') || causale.includes('deposit') || causale.includes('deposito') || causale.includes('accredito');
            });
            
            const prelievi = filtraPrelieviConAnnullamenti(allTransactions);
            
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
            
            if (config.riskMotivations.volumes_daily.enabled) {
              for (const volume of depositiPerGiorno.values()) {
                if (volume > THRESHOLD_GIORNALIERO) {
                  hasNewVolumeThresholds = true;
                  break;
                }
              }
              if (!hasNewVolumeThresholds) {
                for (const volume of prelieviPerGiorno.values()) {
                  if (volume > THRESHOLD_GIORNALIERO) {
                    hasNewVolumeThresholds = true;
                    break;
                  }
                }
              }
            }
            
            if (!hasNewVolumeThresholds && config.riskMotivations.volumes_weekly.enabled) {
              for (const volume of depositiPerSettimana.values()) {
                if (volume > THRESHOLD_SETTIMANALE) {
                  hasNewVolumeThresholds = true;
                  break;
                }
              }
              if (!hasNewVolumeThresholds) {
                for (const volume of prelieviPerSettimana.values()) {
                  if (volume > THRESHOLD_SETTIMANALE) {
                    hasNewVolumeThresholds = true;
                    break;
                  }
                }
              }
            }
            
            if (!hasNewVolumeThresholds && config.riskMotivations.volumes_monthly.enabled) {
              for (const volume of depositiPerMese.values()) {
                if (volume > THRESHOLD_MENSILE) {
                  hasNewVolumeThresholds = true;
                  break;
                }
              }
              if (!hasNewVolumeThresholds) {
                for (const volume of prelieviPerMese.values()) {
                  if (volume > THRESHOLD_MENSILE) {
                    hasNewVolumeThresholds = true;
                    break;
                  }
                }
              }
            }
          }
          
          // Se ci sono nuove frazionate O nuove soglie di volume superate E il risk_level calcolato è High o Elevato,
          // aggiorna lo status. Altrimenti preserva lo status manuale.
          if ((hasNewFrazionate || hasNewVolumeThresholds) && (update.risk_level === 'High' || update.risk_level === 'Elevato')) {
            if (update.risk_level === 'Elevato') {
              newStatus = 'critical-risk';
            } else {
              newStatus = 'high-risk';
            }
          }
          // Se non ci sono nuove frazionate o nuove soglie superate o il rischio è Low/Medium, mantieni lo status manuale
        }
        // Se non ci sono nuove transazioni, preserva lo status manuale
      } else {
        // Aggiorna automaticamente lo status in base al risk_level calcolato
        // (sia per 'active' che per 'high-risk'/'critical-risk' esistenti)
        if (update.risk_level === 'Elevato') {
          newStatus = 'critical-risk';
        } else if (update.risk_level === 'High') {
          newStatus = 'high-risk';
        } else {
          // Per Low e Medium, imposta 'active'
          newStatus = 'active';
        }
      }

      const now = new Date();
      // Normalizza account_id a stringa per garantire consistenza
      const accountIdKey = String(update.account_id);
      const { error } = await supabase
        .from('player_risk_scores')
        .upsert({
          account_id: accountIdKey,
          risk_score: update.risk_score,
          risk_level: update.risk_level,
          status: newStatus,
          calculated_at: now.toISOString(),
          updated_at: now.toISOString()
        }, {
          onConflict: 'account_id'
        });

      if (error) {
        console.error(`Error saving risk score for ${update.account_id}:`, error);
        console.error('Error details:', JSON.stringify(error, null, 2));
        errorCount++;
      } else {
        savedCount++;
        // Log progresso ogni 10 salvataggi
        if (savedCount % 10 === 0) {
          console.log(`Saved ${savedCount}/${updates.length} risk scores so far...`);
        }
        
        // Log automatic re-trigger se lo status è cambiato da manuale a high-risk/critical-risk
        const manualStatuses = ['reviewed', 'escalated', 'archived'];
        const isAutoRetrigger = manualStatuses.includes(oldStatus) && 
                                (newStatus === 'high-risk' || newStatus === 'critical-risk');
        
        // Determina il trigger_reason per la history
        let historyTriggerReason = triggerReason;
        if (isAutoRetrigger) {
          historyTriggerReason = 'retrigger';
          const retriggerReason = (hasNewFrazionate && hasNewVolumeThresholds) 
            ? 'Nuove frazionate e soglie di volume superate'
            : hasNewFrazionate 
            ? 'Nuove frazionate rilevate'
            : 'Soglie di volume superate';
          
          await supabase
            .from('player_activity_log')
            .insert({
              account_id: update.account_id,
              activity_type: 'auto_retrigger',
              old_status: oldStatus,
              new_status: newStatus,
              content: `Re-trigger automatico: ${retriggerReason}`,
              created_by: 'system'
            });
        }

        // Prepara riga per history BigQuery
        const now = new Date();
        historyRows.push({
          account_id: update.account_id,
          risk_score: update.risk_score,
          risk_level: update.risk_level,
          status: newStatus,
          calculated_at: now.toISOString(),
          trigger_reason: historyTriggerReason,
          created_at: now.toISOString()
        });
      }
    }

    // Salva history su BigQuery (batch insert)
    if (historyRows.length > 0) {
      try {
        console.log(`Saving ${historyRows.length} history records to BigQuery...`);
        await insertBigQuery('toppery_test', 'player_risk_scores_history', historyRows);
        console.log(`Successfully saved ${historyRows.length} history records to BigQuery`);
      } catch (historyError) {
        console.error('Error saving history to BigQuery:', historyError);
        // Non blocchiamo il processo se la history fallisce, ma loggiamo l'errore
      }
    }

    console.log(`Risk calculation completed: ${savedCount} saved, ${errorCount} errors`);

    return {
      statusCode: 200,
      body: JSON.stringify({
        success: true,
        processed: updates.length,
        saved: savedCount,
        errors: errorCount,
        message: `Risk scores calculated and saved for ${savedCount} players`
      })
    };
  } catch (error) {
    console.error('Error in calculateRiskScores:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({
        error: 'Failed to calculate risk scores',
        message: error instanceof Error ? error.message : 'Unknown error'
      })
    };
  }
};

export { handler };
