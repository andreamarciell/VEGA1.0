// Script per testare direttamente il processo di login
// Questo script simula esattamente quello che fa l'Edge Function

import { createClient } from '@supabase/supabase-js';

// Configura le variabili d'ambiente
const supabaseUrl = process.env.VITE_SUPABASE_URL || 'your_supabase_url';
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || 'your_service_role_key';
const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY || 'your_anon_key';

if (!supabaseUrl || !supabaseServiceKey || !supabaseAnonKey || 
    supabaseUrl === 'your_supabase_url' || supabaseServiceKey === 'your_service_role_key' || 
    supabaseAnonKey === 'your_anon_key') {
  console.error('❌ Configura le variabili d\'ambiente:');
  console.error('   VITE_SUPABASE_URL=your_actual_url');
  console.error('   SUPABASE_SERVICE_ROLE_KEY=your_service_role_key');
  console.error('   VITE_SUPABASE_ANON_KEY=your_anon_key');
  process.exit(1);
}

const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);
const supabaseClient = createClient(supabaseUrl, supabaseAnonKey);

async function testLoginProcess(username, password) {
  console.log(`🔍 Testing login process for username: ${username}\n`);

  try {
    // STEP 1: Cerca il profilo utente
    console.log('1️⃣ Searching for user profile...');
    const { data: profile, error: profileError } = await supabaseAdmin
      .from('profiles')
      .select('user_id')
      .eq('username', username)
      .single();

    console.log('📊 Profile search result:', { profile, profileError });

    if (profileError || !profile) {
      console.error('❌ Profile not found or error:', profileError);
      return { success: false, step: 'profile_search', error: profileError };
    }

    console.log('✅ Profile found:', profile);

    // STEP 2: Ottieni i dettagli dell'utente da auth.users
    console.log('\n2️⃣ Getting auth user details...');
    const { data: authUser, error: authUserError } = await supabaseAdmin.auth.admin
      .getUserById(profile.user_id);

    console.log('📊 Auth user result:', { 
      hasUser: !!authUser?.user, 
      userId: authUser?.user?.id,
      email: authUser?.user?.email,
      error: authUserError 
    });

    if (authUserError || !authUser.user) {
      console.error('❌ Auth user error:', authUserError);
      return { success: false, step: 'auth_user', error: authUserError };
    }

    const email = authUser.user.email;
    console.log('✅ Auth user found, email:', email);

    if (!email) {
      console.error('❌ No email associated with user');
      return { success: false, step: 'email_check', error: 'No email found' };
    }

    // STEP 3: Prova il login con email e password
    console.log('\n3️⃣ Attempting login with Supabase auth...');
    const { data, error } = await supabaseClient.auth.signInWithPassword({
      email: email,
      password: password
    });

    console.log('📊 Login result:', { 
      hasData: !!data, 
      hasUser: !!data?.user,
      hasSession: !!data?.session,
      error: error 
    });

    if (error) {
      console.error('❌ Login failed:', error.message);
      return { success: false, step: 'login', error: error };
    }

    console.log('✅ Login successful!');
    console.log('   User ID:', data.user.id);
    console.log('   Email:', data.user.email);
    console.log('   Session created:', !!data.session);

    return { success: true, data };

  } catch (error) {
    console.error('💥 Unexpected error:', error);
    return { success: false, step: 'unexpected', error: error };
  }
}

async function main() {
  console.log('🚀 Testing Supabase Login Process\n');

  // Test con credenziali specifiche
  const testUsername = process.argv[2];
  const testPassword = process.argv[3];

  if (!testUsername || !testPassword) {
    console.error('❌ Usage: node test-login-direct.js <username> <password>');
    console.error('   Example: node test-login-direct.js testuser mypassword');
    process.exit(1);
  }

  console.log(`🧪 Testing with credentials:`);
  console.log(`   Username: ${testUsername}`);
  console.log(`   Password: ${testPassword ? '***' : 'MISSING'}\n`);

  const result = await testLoginProcess(testUsername, testPassword);

  console.log('\n🏁 Test completed');
  console.log('Result:', result);

  if (result.success) {
    console.log('🎉 Login test PASSED!');
    process.exit(0);
  } else {
    console.log('❌ Login test FAILED at step:', result.step);
    console.log('Error:', result.error);
    process.exit(1);
  }
}

// Esegui il test
main().catch(error => {
  console.error('💥 Fatal error:', error);
  process.exit(1);
});
