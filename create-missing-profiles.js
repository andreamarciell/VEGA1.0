// Script per creare i profili mancanti per gli utenti esistenti
// Esegui questo script se gli utenti esistono in auth.users ma non in profiles

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

async function createMissingProfiles() {
  console.log('🔧 Creating missing profiles for existing users...\n');

  try {
    // 1. Ottieni tutti gli utenti da auth.users
    console.log('1️⃣ Fetching all auth users...');
    const { data: authUsers, error: authError } = await supabase.auth.admin.listUsers();

    if (authError) {
      console.error('❌ Error fetching auth users:', authError);
      return;
    }

    console.log(`📊 Found ${authUsers.users.length} auth users\n`);

    // 2. Ottieni tutti i profili esistenti
    console.log('2️⃣ Fetching existing profiles...');
    const { data: existingProfiles, error: profilesError } = await supabase
      .from('profiles')
      .select('user_id');

    if (profilesError) {
      console.error('❌ Error fetching profiles:', profilesError);
      return;
    }

    const existingProfileUserIds = existingProfiles.map(p => p.user_id);
    console.log(`📊 Found ${existingProfiles.length} existing profiles\n`);

    // 3. Identifica utenti senza profilo
    const usersWithoutProfile = authUsers.users.filter(user => !existingProfileUserIds.includes(user.id));
    
    if (usersWithoutProfile.length === 0) {
      console.log('✅ All users already have profiles!');
      return;
    }

    console.log(`⚠️  Found ${usersWithoutProfile.length} users without profiles\n`);

    // 4. Crea profili per gli utenti mancanti
    console.log('3️⃣ Creating missing profiles...');
    let createdCount = 0;
    let errorCount = 0;

    for (const user of usersWithoutProfile) {
      try {
        // Genera un username basato sull'email se non esiste
        let username = user.user_metadata?.username;
        if (!username) {
          username = user.email.split('@')[0]; // Usa la parte prima della @ come username
          
          // Aggiungi un numero se l'username esiste già
          let counter = 1;
          let finalUsername = username;
          while (existingProfileUserIds.includes(finalUsername) || 
                 existingProfiles.some(p => p.username === finalUsername)) {
            finalUsername = `${username}${counter}`;
            counter++;
          }
          username = finalUsername;
        }

        console.log(`   Creating profile for user ${user.email} with username: ${username}`);

        const { error: insertError } = await supabase
          .from('profiles')
          .insert({
            user_id: user.id,
            username: username
          });

        if (insertError) {
          console.error(`   ❌ Error creating profile for ${user.email}:`, insertError.message);
          errorCount++;
        } else {
          console.log(`   ✅ Profile created for ${user.email}`);
          createdCount++;
          existingProfileUserIds.push(user.id);
        }
      } catch (error) {
        console.error(`   ❌ Unexpected error creating profile for ${user.email}:`, error.message);
        errorCount++;
      }
    }

    console.log(`\n🏁 Profile creation completed:`);
    console.log(`   ✅ Created: ${createdCount}`);
    console.log(`   ❌ Errors: ${errorCount}`);
    console.log(`   📊 Total: ${createdCount + errorCount}`);

    if (createdCount > 0) {
      console.log('\n🎉 Users can now login with their usernames!');
      console.log('   Try logging in with one of the created usernames.');
    }

  } catch (error) {
    console.error('❌ Unexpected error:', error);
  }
}

// Esegui la creazione dei profili
createMissingProfiles().then(() => {
  console.log('\n🏁 Script completed');
  process.exit(0);
}).catch(error => {
  console.error('💥 Fatal error:', error);
  process.exit(1);
});
