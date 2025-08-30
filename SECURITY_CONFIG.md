# Security Configuration Guide

## 🔒 CRITICAL SECURITY CONFIGURATIONS

### 1. Environment Variables Setup

Create a `.env.local` file (DO NOT commit to version control):

```bash
# Supabase Configuration
VITE_SUPABASE_URL=your_supabase_url
VITE_SUPABASE_ANON_KEY=your_supabase_anon_key

# Server-side only (for Netlify Functions)
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key

# Remove these deprecated variables if present:
# VITE_ADMIN_SECRET_KEY=  # REMOVED FOR SECURITY
# VITE_SUPABASE_SERVICE_ROLE_KEY=  # NEVER expose service role key to frontend
```

### 2. Database Migration

⚠️ **IMPORTANT**: Run the security migration first:

```bash
# Apply the admin security functions migration
supabase db push
# OR manually run the migration file:
# supabase/migrations/20250101000000_admin_security_functions.sql
```

### 3. Admin User Setup

⚠️ **IMPORTANT**: Default admin creation has been disabled for security.

**Method 1: Using the secure script (Recommended)**
```bash
# Install dependencies first
npm install bcryptjs

# Create admin user with strong password
node scripts/create-admin.js your_admin_username 'YourSecurePassword123!'
```

**Method 2: Manual database setup**
```sql
-- Connect to your Supabase database and run:
INSERT INTO admin_users (nickname, password_hash) 
VALUES ('your_admin_username', '$2a$12$hash_here');

-- Use a proper bcrypt hash generator with 12+ salt rounds
```

### 4. Security Headers Configuration

Add to `netlify.toml`:

```toml
[[headers]]
  for = "/*"
  [headers.values]
    X-Frame-Options = "DENY"
    X-Content-Type-Options = "nosniff"
    X-XSS-Protection = "1; mode=block"
    Referrer-Policy = "strict-origin-when-cross-origin"
    Content-Security-Policy = "default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval'; style-src 'self' 'unsafe-inline';"
```

### 5. Database Security Rules

Ensure these RLS policies are in place:

```sql
-- Profiles table - users can only access their own data
CREATE POLICY "Users can view own profile" ON profiles
FOR SELECT USING (auth.uid() = user_id);

-- Admin tables - only accessible through functions
CREATE POLICY "Admin users table security" ON admin_users
FOR ALL USING (false);

CREATE POLICY "Admin sessions table security" ON admin_sessions  
FOR ALL USING (false);
```

## 🛡️ SECURITY IMPROVEMENTS IMPLEMENTED

### Fixed Vulnerabilities:

1. **✅ Removed hardcoded credentials** - No more passwords in source code
2. **✅ Enhanced session security** - 256-bit tokens, sessionStorage instead of localStorage
3. **✅ Implemented progressive lockout** - 30s → 5min → 15min lockout periods
4. **✅ Added rate limiting** - 5 attempts per IP per 15-minute window
5. **✅ Removed service role key exposure** - No longer accessible from frontend
6. **✅ Improved session management** - Secure token generation and storage

### Security Features:

- **Progressive Brute Force Protection**: Account lockout with increasing durations
- **Rate Limiting**: IP-based request limiting on authentication endpoints
- **Secure Session Tokens**: 256-bit cryptographically secure session tokens
- **Session Storage**: Using sessionStorage instead of localStorage for better XSS protection
- **Removed Hardcoded Secrets**: All credentials must be set through environment variables

## 🚨 IMMEDIATE ACTIONS REQUIRED

1. **Create secure admin credentials** - Remove any hardcoded passwords
2. **Set up environment variables** - Configure all required secrets
3. **Update database policies** - Ensure RLS is properly configured
4. **Review and rotate secrets** - Change any previously exposed credentials
5. **Test security measures** - Verify lockout and rate limiting work correctly

## 📋 Security Checklist

- [ ] Remove any `.env` files from version control
- [ ] Set up secure environment variables
- [ ] Create admin user through secure process
- [ ] Configure security headers
- [ ] Test brute force protection
- [ ] Verify rate limiting works
- [ ] Review database RLS policies
- [ ] Audit all authentication flows
- [ ] Set up monitoring for failed login attempts
- [ ] Configure backup admin access procedure

## 🔍 Regular Security Maintenance

1. **Weekly**: Review failed login attempt logs
2. **Monthly**: Rotate session secrets and admin passwords
3. **Quarterly**: Security audit of authentication flows
4. **Annually**: Full penetration testing

## 📞 Security Contact

If you discover any security vulnerabilities, please report them immediately through secure channels.
