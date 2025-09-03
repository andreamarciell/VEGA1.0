// Script per testare direttamente l'Edge Function
// Questo script chiama l'Edge Function e mostra la risposta

import fetch from 'node-fetch';

async function testEdgeFunction(username, password) {
  console.log(`🔍 Testing Edge Function directly...\n`);

  const edgeFunctionUrl = process.env.EDGE_FUNCTION_URL || 'your_edge_function_url';
  
  if (edgeFunctionUrl === 'your_edge_function_url') {
    console.error('❌ Configura EDGE_FUNCTION_URL');
    console.error('   export EDGE_FUNCTION_URL="https://your-project.supabase.co/functions/v1/login-with-username"');
    process.exit(1);
  }

  try {
    console.log('1️⃣ Calling Edge Function...');
    console.log('   URL:', edgeFunctionUrl);
    console.log('   Username:', username);
    console.log('   Password:', password ? '***' : 'MISSING');

    const response = await fetch(edgeFunctionUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.SUPABASE_ANON_KEY || 'your_anon_key'}`
      },
      body: JSON.stringify({
        username: username,
        password: password
      })
    });

    console.log('\n2️⃣ Response received:');
    console.log('   Status:', response.status);
    console.log('   Status Text:', response.statusText);
    console.log('   Headers:', Object.fromEntries(response.headers.entries()));

    const responseText = await response.text();
    console.log('   Body:', responseText);

    let responseData;
    try {
      responseData = JSON.parse(responseText);
    } catch (e) {
      console.log('   Body is not valid JSON');
    }

    if (response.ok) {
      console.log('\n✅ Edge Function call successful!');
      if (responseData) {
        console.log('   Response data:', responseData);
      }
    } else {
      console.log('\n❌ Edge Function call failed!');
      if (responseData && responseData.error) {
        console.log('   Error message:', responseData.error);
      }
    }

    return {
      success: response.ok,
      status: response.status,
      data: responseData,
      error: responseData?.error
    };

  } catch (error) {
    console.error('\n💥 Network error:', error.message);
    return {
      success: false,
      error: error.message
    };
  }
}

async function main() {
  console.log('🚀 Testing Edge Function Login\n');

  const testUsername = process.argv[2];
  const testPassword = process.argv[3];

  if (!testUsername || !testPassword) {
    console.error('❌ Usage: node check-edge-function.js <username> <password>');
    console.error('   Example: node check-edge-function.js testuser mypassword');
    console.error('\n⚠️  Make sure to set EDGE_FUNCTION_URL environment variable');
    process.exit(1);
  }

  const result = await testEdgeFunction(testUsername, testPassword);

  console.log('\n🏁 Test completed');
  console.log('Result:', result);

  if (result.success) {
    console.log('🎉 Edge Function test PASSED!');
    process.exit(0);
  } else {
    console.log('❌ Edge Function test FAILED!');
    console.log('Status:', result.status);
    console.log('Error:', result.error);
    process.exit(1);
  }
}

// Esegui il test
main().catch(error => {
  console.error('💥 Fatal error:', error);
  process.exit(1);
});
