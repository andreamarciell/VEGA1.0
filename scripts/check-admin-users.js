// Quick script to check admin users in database
const { createClient } = require('@supabase/supabase-js');

async function checkAdminUsers() {
  const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceRoleKey) {
    console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY environment variables');
    process.exit(1);
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey);

  try {
    // Check if admin_users table exists and has data
    console.log('🔍 Checking admin_users table...');
    const { data: adminUsers, error } = await supabase
      .from('admin_users')
      .select('id, nickname, created_at, last_login')
      .limit(10);

    if (error) {
      console.error('❌ Error accessing admin_users table:', error);
      return;
    }

    console.log('✅ Admin users found:', adminUsers.length);
    adminUsers.forEach(user => {
      console.log(`  - ${user.nickname} (ID: ${user.id})`);
    });

    // Check admin_sessions table structure
    console.log('\n🔍 Checking admin_sessions table structure...');
    const { data: sessions, error: sessionsError } = await supabase
      .from('admin_sessions')
      .select('*')
      .limit(1);

    if (sessionsError) {
      console.error('❌ Error accessing admin_sessions table:', sessionsError);
    } else {
      console.log('✅ Admin sessions table accessible');
      if (sessions.length > 0) {
        console.log('📊 Session columns:', Object.keys(sessions[0]));
      }
    }

    // Test admin_get_user_for_auth function
    if (adminUsers.length > 0) {
      const testNickname = adminUsers[0].nickname;
      console.log(`\n🔍 Testing admin_get_user_for_auth with nickname: ${testNickname}`);
      
      const { data: authData, error: authError } = await supabase.rpc('admin_get_user_for_auth', {
        admin_nickname: testNickname
      });

      if (authError) {
        console.error('❌ Error calling admin_get_user_for_auth:', authError);
      } else {
        console.log('✅ admin_get_user_for_auth working:', { found: authData?.found });
      }
    }

  } catch (error) {
    console.error('❌ Unexpected error:', error);
  }
}

checkAdminUsers();
