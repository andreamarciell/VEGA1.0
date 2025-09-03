// Script per debuggare la tabella profiles
// Esegui questo script per verificare se ci sono utenti nella tabella profiles

const { createClient } = require('@supabase/supabase-js');

// Configura le variabili d'ambiente
const supabaseUrl = process.env.VITE_SUPABASE_URL || 'your_supabase_url';
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || 'your_service_role_key';

if (!supabaseUrl || !supabaseServiceKey || supabaseUrl === 'your_supabase_url') {
  console.error('❌ Configura le variabili d\'ambiente:');
  console.error('   VITE_SUPABASE_URL=your_actual_url');
  console.error('   SUPABASE_SERVICE_ROLE_KEY=your_service_role_key');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function debugProfiles() {
  console.log('🔍 Debugging profiles table...\n');

  try {
    // 1. Controlla se la tabella profiles esiste
    console.log('1️⃣ Checking if profiles table exists...');
    const { data: tables, error: tablesError } = await supabase
      .from('information_schema.tables')
      .select('table_name')
      .eq('table_schema', 'public')
      .eq('table_name', 'profiles');

    if (tablesError) {
      console.error('❌ Error checking tables:', tablesError);
      return;
    }

    if (tables.length === 0) {
      console.error('❌ Profiles table does not exist!');
      return;
    }

    console.log('✅ Profiles table exists\n');

    // 2. Conta quanti profili ci sono
    console.log('2️⃣ Counting profiles...');
    const { count, error: countError } = await supabase
      .from('profiles')
      .select('*', { count: 'exact', head: true });

    if (countError) {
      console.error('❌ Error counting profiles:', countError);
      return;
    }

    console.log(`📊 Total profiles: ${count}\n`);

    // 3. Lista i primi 10 profili
    console.log('3️⃣ Listing first 10 profiles...');
    const { data: profiles, error: profilesError } = await supabase
      .from('profiles')
      .select('id, user_id, username, created_at')
      .limit(10);

    if (profilesError) {
      console.error('❌ Error fetching profiles:', profilesError);
      return;
    }

    if (profiles.length === 0) {
      console.log('⚠️  No profiles found in the table');
      console.log('   This means users exist in auth.users but not in profiles');
      console.log('   The trigger handle_new_user might not be working\n');
    } else {
      console.log('📋 Profiles found:');
      profiles.forEach((profile, index) => {
        console.log(`   ${index + 1}. ID: ${profile.id}`);
        console.log(`      User ID: ${profile.user_id}`);
        console.log(`      Username: ${profile.username}`);
        console.log(`      Created: ${profile.created_at}`);
        console.log('');
      });
    }

    // 4. Controlla se ci sono utenti in auth.users
    console.log('4️⃣ Checking auth.users table...');
    const { data: authUsers, error: authError } = await supabase.auth.admin.listUsers();

    if (authError) {
      console.error('❌ Error fetching auth users:', authError);
      return;
    }

    console.log(`📊 Total auth users: ${authUsers.users.length}`);
    
    if (authUsers.users.length > 0) {
      console.log('📋 First 5 auth users:');
      authUsers.users.slice(0, 5).forEach((user, index) => {
        console.log(`   ${index + 1}. ID: ${user.id}`);
        console.log(`      Email: ${user.email}`);
        console.log(`      Created: ${user.created_at}`);
        console.log(`      Last Sign In: ${user.last_sign_in_at || 'Never'}`);
        console.log('');
      });
    }

    // 5. Verifica se ci sono utenti senza profilo
    if (profiles.length > 0 && authUsers.users.length > 0) {
      console.log('5️⃣ Checking for users without profiles...');
      
      const profileUserIds = profiles.map(p => p.user_id);
      const usersWithoutProfile = authUsers.users.filter(user => !profileUserIds.includes(user.id));
      
      if (usersWithoutProfile.length > 0) {
        console.log(`⚠️  Found ${usersWithoutProfile.length} users without profiles:`);
        usersWithoutProfile.slice(0, 5).forEach((user, index) => {
          console.log(`   ${index + 1}. ID: ${user.id}`);
          console.log(`      Email: ${user.email}`);
          console.log(`      Created: ${user.created_at}`);
        });
        
        if (usersWithoutProfile.length > 5) {
          console.log(`   ... and ${usersWithoutProfile.length - 5} more`);
        }
      } else {
        console.log('✅ All auth users have profiles');
      }
    }

  } catch (error) {
    console.error('❌ Unexpected error:', error);
  }
}

// Esegui il debug
debugProfiles().then(() => {
  console.log('🏁 Debug completed');
  process.exit(0);
}).catch(error => {
  console.error('💥 Fatal error:', error);
  process.exit(1);
});
