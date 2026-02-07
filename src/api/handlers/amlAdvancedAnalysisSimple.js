'use strict';

module.exports.handler = async (event) => {
  // Basic method guard
  if (event && event.httpMethod && event.httpMethod !== 'POST') {
    return { 
      statusCode: 405, 
      headers: { 'Content-Type': 'application/json' }, 
      body: JSON.stringify({ error: 'method not allowed' }) 
    };
  }

  try {
    // Parse body
    let parsedBody;
    try { 
      parsedBody = JSON.parse(event && event.body ? event.body : '{}'); 
    } catch (e) { 
      return { 
        statusCode: 400, 
        headers: { 'Content-Type': 'application/json' }, 
        body: JSON.stringify({ error: 'Invalid JSON', details: e.message }) 
      };
    }
    
    const txs = Array.isArray(parsedBody.txs) ? parsedBody.txs : [];
    
    if (txs.length === 0) {
      return { 
        statusCode: 400, 
        headers: { 'Content-Type': 'application/json' }, 
        body: JSON.stringify({ error: 'payload mancante' }) 
      };
    }

    // Simple response without AI for testing
    const totals = txs.reduce((acc, t) => {
      const amount = Math.abs(Number(t.amount) || 0);
      if (t.dir === 'out') {
        acc.withdrawals += amount;
      } else {
        acc.deposits += amount;
      }
      return acc;
    }, { deposits: 0, withdrawals: 0 });

    return { 
      statusCode: 200, 
      headers: { 'Content-Type': 'application/json' }, 
      body: JSON.stringify({ 
        risk_score: 35, 
        summary: `Depositi EUR ${totals.deposits.toFixed(2)}, Prelievi EUR ${totals.withdrawals.toFixed(2)}. Test function working.`,
        risk_factors: ['Test factor'],
        compliance_notes: 'Test compliance note',
        indicators: { 
          net_flow_by_month: [], 
          hourly_histogram: [], 
          method_breakdown: [] 
        }
      }) 
    };
    
  } catch (e) {
    return { 
      statusCode: 500, 
      headers: { 'Content-Type': 'application/json' }, 
      body: JSON.stringify({ 
        error: 'Internal server error', 
        message: e.message,
        stack: e.stack 
      }) 
    };
  }
};
