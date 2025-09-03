// Script per debuggare la tabella profiles
// Questo script verifica se la tabella profiles esiste e contiene dati

import { createClient } from '@supabase/supabase-js';

// Configura le variabili d'ambiente
const supabaseUrl = process.env.VITE_SUPABASE_URL || 'your_supabase_url';
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || 'your_service_role_key';

if (!supabaseUrl || !supabaseServiceKey || 
    supabaseUrl === 'your_supabase_url' || supabaseServiceKey === 'your_service_role_key') {
  console.error('❌ Configura le variabili d\'ambiente:');
  console.error('   VITE_SUPABASE_URL=your_actual_url');
  console.error('   SUPABASE_SERVICE_ROLE_KEY=your_service_role_key');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function debugProfiles() {
  console.log('🔍 Debugging profiles table...\n');

  try {
    // STEP 1: Verifica se la tabella profiles esiste
    console.log('1️⃣ Checking if profiles table exists...');
    const { data: tableInfo, error: tableError } = await supabase
      .from('profiles')
      .select('*')
      .limit(1);

    if (tableError) {
      console.error('❌ Error accessing profiles table:', tableError.message);
      console.error('   This might mean the table doesn\'t exist or RLS is blocking access');
      return;
    }

    console.log('✅ Profiles table exists and is accessible');

    // STEP 2: Conta quanti profili ci sono
    console.log('\n2️⃣ Counting total profiles...');
    const { count, error: countError } = await supabase
      .from('profiles')
      .select('*', { count: 'exact', head: true });

    if (countError) {
      console.error('❌ Error counting profiles:', countError.message);
    } else {
      console.log(`📊 Total profiles found: ${count}`);
    }

    // STEP 3: Lista i primi 10 profili
    console.log('\n3️⃣ Listing first 10 profiles...');
    const { data: profiles, error: profilesError } = await supabase
      .from('profiles')
      .select('username, user_id, created_at')
      .order('created_at', { ascending: false })
      .limit(10);

    if (profilesError) {
      console.error('❌ Error fetching profiles:', profilesError.message);
    } else if (profiles && profiles.length > 0) {
      console.log('📋 First 10 profiles:');
      profiles.forEach((profile, index) => {
        console.log(`   ${index + 1}. Username: ${profile.username}, User ID: ${profile.user_id}`);
      });
    } else {
      console.log('⚠️  No profiles found in the table');
    }

    // STEP 4: Verifica se ci sono utenti in auth.users
    console.log('\n4️⃣ Checking auth.users table...');
    const { data: authUsers, error: authError } = await supabase.auth.admin.listUsers();

    if (authError) {
      console.error('❌ Error accessing auth.users:', authError.message);
    } else {
      console.log(`📊 Total auth users: ${authUsers.users.length}`);
      
      if (authUsers.users.length > 0) {
        console.log('📋 First 5 auth users:');
        authUsers.users.slice(0, 5).forEach((user, index) => {
          console.log(`   ${index + 1}. ID: ${user.id}, Email: ${user.email}, Created: ${user.created_at}`);
        });
      }
    }

    // STEP 5: Identifica utenti senza profili
    if (profiles && authUsers?.users) {
      console.log('\n5️⃣ Identifying users without profiles...');
      const profileUserIds = new Set(profiles.map(p => p.user_id));
      const usersWithoutProfiles = authUsers.users.filter(user => !profileUserIds.has(user.id));
      
      if (usersWithoutProfiles.length > 0) {
        console.log(`⚠️  Found ${usersWithoutProfiles.length} users without profiles:`);
        usersWithoutProfiles.slice(0, 5).forEach((user, index) => {
          console.log(`   ${index + 1}. ID: ${user.id}, Email: ${user.email}`);
        });
        
        if (usersWithoutProfiles.length > 5) {
          console.log(`   ... and ${usersWithoutProfiles.length - 5} more`);
        }
      } else {
        console.log('✅ All auth users have corresponding profiles');
      }
    }

  } catch (error) {
    console.error('💥 Unexpected error:', error);
  }
}

// Esegui il debug
debugProfiles().then(() => {
  console.log('\n🏁 Debug completed');
  process.exit(0);
}).catch(error => {
  console.error('💥 Fatal error:', error);
  process.exit(1);
});
