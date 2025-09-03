// Script per creare profili mancanti per utenti esistenti
// Questo script identifica utenti in auth.users senza profili e li crea

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

async function createMissingProfiles() {
  console.log('🔧 Creating missing profiles for existing users...\n');

  try {
    // STEP 1: Ottieni tutti gli utenti auth
    console.log('1️⃣ Fetching all auth users...');
    const { data: authUsers, error: authError } = await supabase.auth.admin.listUsers();

    if (authError) {
      console.error('❌ Error fetching auth users:', authError.message);
      return;
    }

    console.log(`📊 Found ${authUsers.users.length} auth users`);

    // STEP 2: Ottieni tutti i profili esistenti
    console.log('\n2️⃣ Fetching existing profiles...');
    const { data: existingProfiles, error: profilesError } = await supabase
      .from('profiles')
      .select('user_id');

    if (profilesError) {
      console.error('❌ Error fetching profiles:', profilesError.message);
      return;
    }

    const existingProfileIds = new Set(existingProfiles.map(p => p.user_id));
    console.log(`📊 Found ${existingProfiles.length} existing profiles`);

    // STEP 3: Identifica utenti senza profili
    const usersWithoutProfiles = authUsers.users.filter(user => !existingProfileIds.has(user.id));
    
    if (usersWithoutProfiles.length === 0) {
      console.log('✅ All users already have profiles!');
      return;
    }

    console.log(`\n3️⃣ Found ${usersWithoutProfiles.length} users without profiles`);

    // STEP 4: Crea profili per utenti mancanti
    console.log('\n4️⃣ Creating missing profiles...');
    let createdCount = 0;
    let errorCount = 0;

    for (const user of usersWithoutProfiles) {
      try {
        // Genera username dall'email se non presente nei metadata
        let username = user.user_metadata?.username;
        
        if (!username) {
          // Estrai la parte prima della @ dall'email
          username = user.email.split('@')[0];
          
          // Verifica se l'username è già preso
          const { data: existingUsername } = await supabase
            .from('profiles')
            .select('username')
            .eq('username', username)
            .single();

          if (existingUsername) {
            // Aggiungi un numero per rendere unico
            let counter = 1;
            let uniqueUsername = username;
            while (true) {
              uniqueUsername = `${username}${counter}`;
              const { data: exists } = await supabase
                .from('profiles')
                .select('username')
                .eq('username', uniqueUsername)
                .single();
              
              if (!exists) break;
              counter++;
            }
            username = uniqueUsername;
          }
        }

        // Crea il profilo
        const { error: insertError } = await supabase
          .from('profiles')
          .insert({
            user_id: user.id,
            username: username,
            email: user.email,
            created_at: new Date().toISOString()
          });

        if (insertError) {
          console.error(`❌ Failed to create profile for ${user.email}:`, insertError.message);
          errorCount++;
        } else {
          console.log(`✅ Created profile for ${user.email} with username: ${username}`);
          createdCount++;
        }

      } catch (error) {
        console.error(`❌ Error creating profile for ${user.email}:`, error.message);
        errorCount++;
      }
    }

    // STEP 5: Riepilogo
    console.log('\n🏁 Profile creation completed!');
    console.log(`✅ Successfully created: ${createdCount} profiles`);
    if (errorCount > 0) {
      console.log(`❌ Failed to create: ${errorCount} profiles`);
    }

  } catch (error) {
    console.error('💥 Unexpected error:', error);
  }
}

// Esegui la creazione dei profili
createMissingProfiles().then(() => {
  console.log('\n🎉 Process completed');
  process.exit(0);
}).catch(error => {
  console.error('💥 Fatal error:', error);
  process.exit(1);
});
