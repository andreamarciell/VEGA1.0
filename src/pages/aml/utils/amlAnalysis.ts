import { AmlResults, AmlTransaction } from '../AmlDashboard';

export function analyzeTransactions(transactions: AmlTransaction[]): AmlResults {
  // Sort transactions by date
  const sortedTransactions = [...transactions].sort((a, b) => a.data.getTime() - b.data.getTime());
  
  const alerts: string[] = [];
  const motivations: string[] = [];
  const patterns: string[] = [];
  const frazionate: AmlResults['frazionate'] = [];

  // Analysis thresholds
  const VELOCITY_THRESHOLD = 5; // deposits within short time
  const LARGE_AMOUNT_THRESHOLD = 10000;
  const FRACTIONATION_THRESHOLD = 3000; // amounts close to reporting threshold

  // 1. Velocity Analysis
  analyzeVelocity(sortedTransactions, alerts);

  // 2. Bonus Concentration Analysis
  analyzeBonusConcentration(sortedTransactions, alerts);

  // 3. Casino Live Analysis
  analyzeCasinoLive(sortedTransactions, alerts);

  // 4. Fractionation Analysis
  const frazionateResults = analyzeFractionation(sortedTransactions);
  frazionate.push(...frazionateResults);

  // 5. Unusual Patterns Analysis
  analyzeUnusualPatterns(sortedTransactions, patterns);

  // Generate motivations based on alerts
  generateMotivations(alerts, motivations);

  // Calculate risk score and level
  const riskScore = calculateRiskScore(alerts, frazionate, patterns);
  const riskLevel = determineRiskLevel(riskScore);

  // Generate sessions data for hourly analysis
  const sessions = sortedTransactions.map(tx => ({
    timestamp: tx.data.toISOString()
  }));

  return {
    riskLevel,
    riskScore,
    motivations,
    frazionate,
    patterns,
    alerts,
    sessions
  };
}

function analyzeVelocity(transactions: AmlTransaction[], alerts: string[]): void {
  // Group transactions by day
  const dailyTransactions: { [key: string]: AmlTransaction[] } = {};
  
  transactions.forEach(tx => {
    const dateKey = tx.data.toISOString().split('T')[0];
    if (!dailyTransactions[dateKey]) {
      dailyTransactions[dateKey] = [];
    }
    dailyTransactions[dateKey].push(tx);
  });

  // Check for velocity patterns
  Object.entries(dailyTransactions).forEach(([date, txs]) => {
    if (txs.length >= 5) {
      const totalAmount = txs.reduce((sum, tx) => sum + tx.importo, 0);
      alerts.push(`Velocity deposit: ${txs.length} depositi €${totalAmount.toFixed(2)} in ${date}`);
    }

    // Check for multiple deposits in short time window
    const deposits = txs.filter(tx => 
      tx.causale.toLowerCase().includes('deposito') || 
      tx.causale.toLowerCase().includes('deposit') ||
      tx.importo > 0
    );

    if (deposits.length >= 3) {
      const timeWindow = getTimeWindow(deposits);
      if (timeWindow < 60) { // less than 60 minutes
        alerts.push(`Velocity deposit: ${deposits.length} depositi in ${timeWindow} min`);
      }
    }
  });
}

function analyzeBonusConcentration(transactions: AmlTransaction[], alerts: string[]): void {
  const bonusTransactions = transactions.filter(tx => 
    tx.causale.toLowerCase().includes('bonus') ||
    tx.causale.toLowerCase().includes('promo')
  );

  if (bonusTransactions.length > 0) {
    const totalBonus = bonusTransactions.reduce((sum, tx) => sum + tx.importo, 0);
    const totalTransactions = transactions.reduce((sum, tx) => sum + tx.importo, 0);
    const bonusPercentage = (totalBonus / totalTransactions) * 100;

    if (bonusPercentage > 15) {
      alerts.push(`Bonus concentration: bonus €${totalBonus.toFixed(2)} (${bonusPercentage.toFixed(1)}% del totale)`);
    }

    // Check for bonus abuse patterns
    if (bonusTransactions.length > 10) {
      alerts.push(`Bonus concentration: ${bonusTransactions.length} transazioni bonus rilevate`);
    }
  }
}

function analyzeCasinoLive(transactions: AmlTransaction[], alerts: string[]): void {
  const liveTransactions = transactions.filter(tx => 
    tx.causale.toLowerCase().includes('live') ||
    tx.causale.toLowerCase().includes('session slot (live)')
  );

  if (liveTransactions.length > 0) {
    const totalLive = liveTransactions.reduce((sum, tx) => sum + tx.importo, 0);
    const avgAmount = totalLive / liveTransactions.length;

    if (avgAmount > 500) {
      alerts.push(`Casino live: media €${avgAmount.toFixed(2)} per sessione live`);
    }

    // Check for suspicious live session patterns
    if (liveTransactions.length > 20) {
      alerts.push(`Casino live: ${liveTransactions.length} sessioni live rilevate`);
    }
  }
}

function analyzeFractionation(transactions: AmlTransaction[]): AmlResults['frazionate'] {
  const frazionate: AmlResults['frazionate'] = [];
  const FRACTIONATION_THRESHOLD = 3000;
  
  // Group transactions by day and look for patterns
  const dailyGroups: { [key: string]: AmlTransaction[] } = {};
  
  transactions.forEach(tx => {
    const dateKey = tx.data.toISOString().split('T')[0];
    if (!dailyGroups[dateKey]) {
      dailyGroups[dateKey] = [];
    }
    dailyGroups[dateKey].push(tx);
  });

  Object.entries(dailyGroups).forEach(([date, txs]) => {
    // Look for amounts close to thresholds
    const suspiciousAmounts = txs.filter(tx => 
      (tx.importo >= FRACTIONATION_THRESHOLD * 0.8 && tx.importo < FRACTIONATION_THRESHOLD) ||
      (tx.importo >= 9000 && tx.importo < 10000) // Close to 10k threshold
    );

    if (suspiciousAmounts.length >= 2) {
      const total = suspiciousAmounts.reduce((sum, tx) => sum + tx.importo, 0);
      const endDate = new Date(date);
      endDate.setDate(endDate.getDate() + 1);
      
      frazionate.push({
        start: date,
        end: endDate.toISOString().split('T')[0],
        total,
        transactions: suspiciousAmounts
      });
    }
  });

  return frazionate;
}

function analyzeUnusualPatterns(transactions: AmlTransaction[], patterns: string[]): void {
  // Check for round amounts (potential structuring)
  const roundAmounts = transactions.filter(tx => tx.importo % 100 === 0 && tx.importo >= 1000);
  if (roundAmounts.length > transactions.length * 0.3) {
    patterns.push(`Pattern sospetto: ${roundAmounts.length} transazioni con importi tondi rilevate`);
  }

  // Check for unusual timing patterns
  const nightTransactions = transactions.filter(tx => {
    const hour = tx.data.getHours();
    return hour >= 22 || hour < 6;
  });

  if (nightTransactions.length > transactions.length * 0.4) {
    patterns.push(`Pattern orario sospetto: ${((nightTransactions.length / transactions.length) * 100).toFixed(1)}% delle transazioni in orario notturno`);
  }

  // Check for repetitive amounts
  const amountCounts: { [key: number]: number } = {};
  transactions.forEach(tx => {
    amountCounts[tx.importo] = (amountCounts[tx.importo] || 0) + 1;
  });

  const repeatedAmounts = Object.entries(amountCounts).filter(([_, count]) => count >= 5);
  if (repeatedAmounts.length > 0) {
    repeatedAmounts.forEach(([amount, count]) => {
      patterns.push(`Importo ripetuto: €${amount} utilizzato ${count} volte`);
    });
  }
}

function generateMotivations(alerts: string[], motivations: string[]): void {
  if (alerts.some(alert => alert.includes('Velocity deposit'))) {
    motivations.push('Rilevate operazioni di deposito ad alta frequenza');
  }

  if (alerts.some(alert => alert.includes('Bonus concentration'))) {
    motivations.push('Concentrazione anomala di operazioni bonus');
  }

  if (alerts.some(alert => alert.includes('Casino live'))) {
    motivations.push('Pattern di gioco live sospetti rilevati');
  }

  if (motivations.length === 0) {
    motivations.push('Profilo di rischio standard - monitoraggio continuativo');
  }
}

function calculateRiskScore(alerts: string[], frazionate: any[], patterns: string[]): number {
  let score = 0;
  
  // Base score for alerts
  score += alerts.length * 10;
  
  // Additional points for fractionation
  score += frazionate.length * 15;
  
  // Points for unusual patterns
  score += patterns.length * 5;

  // Specific high-risk patterns
  alerts.forEach(alert => {
    if (alert.includes('Velocity deposit')) score += 20;
    if (alert.includes('Bonus concentration')) score += 15;
    if (alert.includes('Casino live')) score += 10;
  });

  return Math.min(score, 100); // Cap at 100
}

function determineRiskLevel(score: number): 'Low' | 'Medium' | 'High' {
  if (score >= 70) return 'High';
  if (score >= 40) return 'Medium';
  return 'Low';
}

function getTimeWindow(transactions: AmlTransaction[]): number {
  if (transactions.length < 2) return 0;
  
  const times = transactions.map(tx => tx.data.getTime()).sort((a, b) => a - b);
  const firstTime = times[0];
  const lastTime = times[times.length - 1];
  
  return Math.round((lastTime - firstTime) / (1000 * 60)); // Convert to minutes
}