import type { Handler } from '@netlify/functions';
import { createClient } from '@supabase/supabase-js';
import crypto from 'crypto';
import bcrypt from 'bcryptjs';

const SEC = Number(process.env.ADMIN_SESSION_TTL_SEC || 60 * 60 * 8); // 8h
const COOKIE = 'admin_session';

function setCookie(token: string) {
  const attrs = [
    `${COOKIE}=${token}`,
    'Path=/',
    'HttpOnly',
    'Secure',
    'SameSite=Strict',
    `Max-Age=${SEC}`
  ].join('; ');
  return attrs;
}

const handler: Handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') {
    return { 
      statusCode: 204, 
      headers: { 
        'Access-Control-Allow-Origin': process.env.ALLOWED_ORIGIN || '', 
        'Access-Control-Allow-Headers': 'content-type,authorization', 
        'Access-Control-Allow-Methods': 'POST,OPTIONS',
        'Access-Control-Allow-Credentials': 'true',
        'Vary': 'Origin' 
      }, 
      body: '' 
    };
  }
  if (event.httpMethod !== 'POST') return { statusCode: 405, body: 'Method Not Allowed' };

  const origin = event.headers.origin || '';
  const allowed = process.env.ALLOWED_ORIGIN || '';
  if (allowed && origin && origin !== allowed) return { statusCode: 403, body: 'Forbidden origin' };

  if (!event.body) return { statusCode: 400, body: 'Missing body' };
  let payload: { nickname?: string; password?: string };
  try { payload = JSON.parse(event.body); } catch { return { statusCode: 400, body: 'Invalid JSON' }; }

  const nickname = payload.nickname?.trim() || '';
  const password = payload.password || '';
  const nicknameOk = /^[a-zA-Z0-9_-]{3,20}$/.test(nickname);
  if (!nicknameOk || password.length < 8) return { statusCode: 400, body: 'Invalid credentials' };

  // ---- PROGRESSIVE LOCKOUT SYSTEM ----
  const service = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

  // Check if admin account is currently locked
  console.log('Checking lockout status for admin nickname:', nickname);
  const { data: lockoutStatus, error: lockoutError } = await service.rpc('check_admin_account_lockout_status', {
    p_nickname: nickname
  });

  if (lockoutError) {
    console.error('Error checking admin lockout status:', lockoutError);
    // If we can't check lockout status, still allow login but log the error
    console.warn('Proceeding with login despite lockout check error');
  } else if (lockoutStatus?.is_locked) {
    console.log('Admin account is locked:', lockoutStatus);
    await new Promise(r => setTimeout(r, 800)); // Add delay for security
    
    return {
      statusCode: 423, // Locked
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': allowed || '',
        'Access-Control-Allow-Credentials': 'true'
      },
      body: JSON.stringify({
        error: 'Admin account is locked',
        lockoutInfo: {
          isLocked: true,
          remainingSeconds: lockoutStatus.remaining_seconds || 0,
          message: lockoutStatus.message || 'Admin account is locked due to multiple failed attempts'
        }
      })
    };
  }

  
  // Get admin user from admin_users table using the secure RPC function
  console.log('Looking for admin user with nickname:', nickname);
  const { data: adminData, error: adminError } = await service.rpc('admin_get_user_for_auth', {
    admin_nickname: nickname
  });

  if (adminError) {
    console.error('Error fetching admin user:', adminError);
    await new Promise(r => setTimeout(r, 300));
    
    // Record failed login attempt using new lockout system
    const { data: lockoutResult, error: lockoutRecordError } = await service.rpc('record_admin_failed_login_attempt', {
      p_nickname: nickname
    });
    
    if (lockoutRecordError) {
      console.error('Error recording admin failed login attempt:', lockoutRecordError);
    } else {
      console.log('Admin failed login attempt recorded:', lockoutResult);
    }
    
    return { statusCode: 401, body: 'Invalid credentials' };
  }

  if (!adminData?.found) {
    console.log('Admin user not found for nickname:', nickname);
    await new Promise(r => setTimeout(r, 300));
    
    // Record failed login attempt using new lockout system
    const { data: lockoutResult, error: lockoutRecordError } = await service.rpc('record_admin_failed_login_attempt', {
      p_nickname: nickname
    });
    
    if (lockoutRecordError) {
      console.error('Error recording admin failed login attempt:', lockoutRecordError);
    } else {
      console.log('Admin failed login attempt recorded:', lockoutResult);
    }
    
    return { statusCode: 401, body: 'Invalid credentials' };
  }

  console.log('Admin user found:', { id: adminData.admin_id, nickname: adminData.nickname });

  // Verify password using bcrypt
  const isPasswordValid = await bcrypt.compare(password, adminData.password_hash);
  if (!isPasswordValid) {
    // Add delay to prevent timing attacks
    await new Promise(r => setTimeout(r, 300));
    
    // Record failed login attempt using new lockout system
    const { data: lockoutResult, error: lockoutRecordError } = await service.rpc('record_admin_failed_login_attempt', {
      p_nickname: nickname
    });
    
    if (lockoutRecordError) {
      console.error('Error recording admin failed login attempt:', lockoutRecordError);
    } else {
      console.log('Admin failed login attempt recorded:', lockoutResult);
    }
    
    return { statusCode: 401, body: 'Invalid credentials' };
  }

  // Create session token
  const token = crypto.randomBytes(32).toString('hex');
  const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
  const expiresAt = new Date(Date.now() + SEC * 1000).toISOString();

  // Create admin session using the secure RPC function
  console.log('Creating admin session for user:', adminData.admin_id);
  const { data: sessionData, error: sessionError } = await service.rpc('admin_create_session', {
    admin_user_id: adminData.admin_id,
    session_token: tokenHash,
    expires_at: expiresAt
  });

  if (sessionError) {
    console.error('Failed to create admin session:', sessionError);
    console.error('Session data:', { admin_user_id: adminData.admin_id, expires_at: expiresAt });
    return { statusCode: 500, body: `Session error: ${sessionError.message}` };
  }
  
  console.log('Admin session created successfully');

  // Update last login
  const { error: updateError } = await service.rpc('admin_update_last_login', {
    admin_user_id: adminData.admin_id
  });

  if (updateError) {
    console.warn('Failed to update last login:', updateError);
    // Don't fail the login for this
  }

  // Reset admin account lockout on successful login
  const { data: resetResult, error: resetError } = await service.rpc('reset_admin_account_lockout', {
    p_nickname: nickname
  });
  
  if (resetError) {
    console.error('Error resetting admin account lockout:', resetError);
  } else {
    console.log('Admin account lockout reset successfully:', resetResult);
  }

  return {
    statusCode: 200,
    headers: {
      'Set-Cookie': setCookie(token),
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': allowed || '',
      'Access-Control-Allow-Credentials': 'true'
    },
    body: JSON.stringify({ ok: true })
  };
};

export { handler };
