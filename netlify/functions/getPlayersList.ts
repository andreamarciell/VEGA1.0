import type { Handler } from '@netlify/functions';
import { Pool } from 'pg';

interface Profile {
  account_id: string;
  nick: string;
  first_name: string;
  last_name: string;
  cf: string | null;
  domain: string | null;
  point: string | null;
  current_balance: number | null;
  created_at: string;
}

interface Movement {
  id: string;
  created_at: string;
  account_id: string;
  reason: string;
  amount: number;
  ts_extension: string | null;
}

interface SessionLog {
  id: string;
  account_id: string;
  ip_address: string;
  login_time: string;
}

interface PlayerRisk {
  account_id: string;
  nick: string;
  first_name: string;
  last_name: string;
  domain: string | null;
  current_balance: number | null;
  risk_score: number;
  risk_level: 'Low' | 'Medium' | 'High' | 'Elevato';
}

interface Transaction {
  data: Date;
  causale: string;
  importo: number;
}

interface Frazionata {
  start: string;
  end: string;
  total: number;
}

// Calcola frazionate depositi (ricarica conto gioco per accredito diretto)
function cercaFrazionateDep(transactions: Transaction[]): Frazionata[] {
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
function cercaFrazionateWit(transactions: Transaction[]): Frazionata[] {
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
function cercaPatternAML(transactions: Transaction[]): string[] {
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

// Calcola rischio semplificato (basato su logica riskEngine)
function calculateRisk(
  frazionateDep: Frazionata[],
  frazionateWit: Frazionata[],
  patterns: string[],
  transactions: Transaction[]
): { score: number; level: 'Low' | 'Medium' | 'High' | 'Elevato' } {
  let baseScore = 0;
  let level: 'Low' | 'Medium' | 'High' | 'Elevato' = 'Low';

  // Calcola volumi
  const depositi = transactions.filter(tx => {
    const causale = tx.causale.toLowerCase();
    return causale.includes('ricarica') || causale.includes('deposit') || causale.includes('deposito') || causale.includes('accredito');
  });
  const prelievi = transactions.filter(tx => {
    const causale = tx.causale.toLowerCase();
    return (causale.includes('prelievo') || causale.includes('withdraw')) &&
           !causale.includes('annullamento');
  });

  const totDepositi = depositi.reduce((sum, tx) => sum + Math.abs(tx.importo), 0);
  const totPrelievi = prelievi.reduce((sum, tx) => sum + Math.abs(tx.importo), 0);

  // Soglie volume (semplificate)
  const THRESHOLD_MENSILE = 10000;
  const THRESHOLD_SETTIMANALE = 5000;
  const THRESHOLD_GIORNALIERO = 2000;

  // Raggruppa per mese
  const depositiPerMese = new Map<string, number>();
  depositi.forEach(tx => {
    const monthKey = `${tx.data.getFullYear()}-${String(tx.data.getMonth() + 1).padStart(2, '0')}`;
    depositiPerMese.set(monthKey, (depositiPerMese.get(monthKey) || 0) + Math.abs(tx.importo));
  });

  let hasMonthlyExceeded = false;
  for (const volume of depositiPerMese.values()) {
    if (volume > THRESHOLD_MENSILE) {
      hasMonthlyExceeded = true;
      break;
    }
  }

  // Determina livello base
  if (hasMonthlyExceeded) {
    baseScore = 50;
    level = 'High';
  } else if (totDepositi > THRESHOLD_SETTIMANALE || totPrelievi > THRESHOLD_SETTIMANALE) {
    baseScore = 30;
    level = 'Medium';
  } else {
    baseScore = 10;
    level = 'Low';
  }

  // Aggravanti
  const hasFrazionate = frazionateDep.length > 0 || frazionateWit.length > 0;
  const hasPatterns = patterns.length > 0;

  if (hasFrazionate) {
    baseScore += 40;
    if (level === 'Low') level = 'High';
    else if (level === 'Medium') level = 'High';
    else if (level === 'High') level = 'Elevato';
  }

  if (hasPatterns) {
    baseScore += 20;
    if (level === 'Low') level = 'Medium';
    else if (level === 'Medium') level = 'High';
  }

  // Mappa score a livello finale
  if (baseScore >= 80) level = 'Elevato';
  else if (baseScore >= 50) level = 'High';
  else if (baseScore >= 30) level = 'Medium';
  else level = 'Low';

  return { score: Math.min(baseScore, 100), level };
}

const handler: Handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 204,
      headers: {
        'Access-Control-Allow-Origin': process.env.ALLOWED_ORIGIN || '*',
        'Access-Control-Allow-Headers': 'content-type',
        'Access-Control-Allow-Methods': 'GET,OPTIONS',
        'Access-Control-Allow-Credentials': 'true',
        'Vary': 'Origin'
      },
      body: ''
    };
  }

  if (event.httpMethod !== 'GET') {
    return { statusCode: 405, body: 'Method Not Allowed' };
  }

  const origin = event.headers.origin || '';
  const allowed = process.env.ALLOWED_ORIGIN || '*';

  const connectionString = process.env.EXTERNAL_DB_CONNECTION_STRING;
  if (!connectionString) {
    console.error('EXTERNAL_DB_CONNECTION_STRING not configured');
    return {
      statusCode: 500,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': allowed,
        'Access-Control-Allow-Credentials': 'true'
      },
      body: JSON.stringify({ error: 'Database connection not configured' })
    };
  }

  if (!connectionString.includes('sslmode=require')) {
    console.error('SSL mode not set to require');
    return {
      statusCode: 500,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': allowed,
        'Access-Control-Allow-Credentials': 'true'
      },
      body: JSON.stringify({ error: 'SSL mode must be require' })
    };
  }

  const pool = new Pool({
    connectionString,
    ssl: {
      rejectUnauthorized: false
    }
  });

  try {
    // Test connessione
    console.log('Step 1: Testing database connection...');
    await pool.query('SELECT 1');
    console.log('Step 1: Database connection successful');

    // Query tutti i profili
    console.log('Step 2: Fetching profiles from database...');
    const profilesResult = await pool.query<Profile>(
      `SELECT 
        account_id, nick, first_name, last_name, cf, domain, 
        point, current_balance, created_at
      FROM profiles
      ORDER BY account_id ASC`
    );
    console.log(`Step 2: Found ${profilesResult.rows.length} profiles`);

    const players: PlayerRisk[] = [];

    // Per ogni giocatore, calcola il rischio
    console.log(`Step 3: Processing ${profilesResult.rows.length} players...`);
    for (let i = 0; i < profilesResult.rows.length; i++) {
      const profile = profilesResult.rows[i];
      const accountId = profile.account_id;
      
      try {
        console.log(`Step 3.${i + 1}: Processing player ${accountId} (${i + 1}/${profilesResult.rows.length})...`);

        // Query movements per questo account
        console.log(`Step 3.${i + 1}.a: Fetching movements for ${accountId}...`);
        const movementsResult = await pool.query<Movement>(
          `SELECT id, created_at, account_id, reason, amount, ts_extension
          FROM movements
          WHERE account_id = $1
          ORDER BY created_at ASC`,
          [accountId]
        );
        console.log(`Step 3.${i + 1}.a: Found ${movementsResult.rows.length} movements for ${accountId}`);

        // Query sessions_log per questo account (solo per conteggio, non per calcolo rischio)
        console.log(`Step 3.${i + 1}.b: Fetching sessions for ${accountId}...`);
        const sessionsResult = await pool.query<SessionLog>(
          `SELECT id, account_id, ip_address, login_time
          FROM sessions_log
          WHERE account_id = $1`,
          [accountId]
        );
        console.log(`Step 3.${i + 1}.b: Found ${sessionsResult.rows.length} sessions for ${accountId}`);

        // Converti movements in Transaction[]
        console.log(`Step 3.${i + 1}.c: Converting movements to transactions...`);
        const transactions: Transaction[] = movementsResult.rows.map(mov => ({
          data: new Date(mov.created_at),
          causale: mov.reason || '',
          importo: mov.amount || 0
        }));
        console.log(`Step 3.${i + 1}.c: Converted ${transactions.length} transactions`);

        // Calcola frazionate e patterns solo se ci sono transazioni
        if (transactions.length > 0) {
          console.log(`Step 3.${i + 1}.d: Calculating risk for ${accountId}...`);
          const frazionateDep = cercaFrazionateDep(transactions);
          console.log(`Step 3.${i + 1}.d.1: Found ${frazionateDep.length} frazionate depositi`);
          
          const frazionateWit = cercaFrazionateWit(transactions);
          console.log(`Step 3.${i + 1}.d.2: Found ${frazionateWit.length} frazionate prelievi`);
          
          const patterns = cercaPatternAML(transactions);
          console.log(`Step 3.${i + 1}.d.3: Found ${patterns.length} patterns`);
          
          const risk = calculateRisk(frazionateDep, frazionateWit, patterns, transactions);
          console.log(`Step 3.${i + 1}.d.4: Risk calculated - Score: ${risk.score}, Level: ${risk.level}`);

          players.push({
            account_id: accountId,
            nick: profile.nick,
            first_name: profile.first_name,
            last_name: profile.last_name,
            domain: profile.domain,
            current_balance: profile.current_balance,
            risk_score: risk.score,
            risk_level: risk.level
          });
        } else {
          console.log(`Step 3.${i + 1}.d: No transactions for ${accountId}, setting risk to Low`);
          // Nessuna transazione = rischio basso
          players.push({
            account_id: accountId,
            nick: profile.nick,
            first_name: profile.first_name,
            last_name: profile.last_name,
            domain: profile.domain,
            current_balance: profile.current_balance,
            risk_score: 0,
            risk_level: 'Low'
          });
        }
        
        console.log(`Step 3.${i + 1}: Completed processing player ${accountId}`);
      } catch (playerError) {
        console.error(`Error processing player ${accountId}:`, playerError);
        console.error(`Player error stack:`, playerError instanceof Error ? playerError.stack : 'No stack');
        // Continua con il prossimo giocatore invece di fallire tutto
        players.push({
          account_id: accountId,
          nick: profile.nick,
          first_name: profile.first_name,
          last_name: profile.last_name,
          domain: profile.domain,
          current_balance: profile.current_balance,
          risk_score: 0,
          risk_level: 'Low'
        });
      }
    }

    console.log(`Step 4: Processed ${players.length} players, closing connection...`);
    await pool.end();
    console.log('Step 4: Connection closed');

    console.log('Step 5: Returning results...');
    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': allowed,
        'Access-Control-Allow-Credentials': 'true'
      },
      body: JSON.stringify({ players })
    };
  } catch (error) {
    console.error('=== ERROR IN getPlayersList ===');
    console.error('Error type:', error instanceof Error ? error.constructor.name : typeof error);
    console.error('Error message:', error instanceof Error ? error.message : String(error));
    console.error('Error stack:', error instanceof Error ? error.stack : 'No stack trace');
    console.error('Error details:', JSON.stringify(error, Object.getOwnPropertyNames(error)));
    
    // Chiudi il pool in modo sicuro
    try {
      if (pool) {
        await pool.end();
      }
    } catch (closeError) {
      console.error('Error closing pool:', closeError);
    }
    
    return {
      statusCode: 500,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': allowed,
        'Access-Control-Allow-Credentials': 'true'
      },
      body: JSON.stringify({
        error: 'Failed to get players list',
        message: error instanceof Error ? error.message : 'Unknown error',
        type: error instanceof Error ? error.constructor.name : typeof error
      })
    };
  }
};

export { handler };
