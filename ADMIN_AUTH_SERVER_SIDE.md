# Server-Side Admin Authentication System

## Overview

This document describes the complete server-side admin authentication system implemented for TopperyAML, replacing the insecure client-side admin authentication.

## 🔐 Security Architecture

### Authentication Flow
1. **Admin Login**: User provides email/password → Server validates → Creates HttpOnly cookie
2. **Session Validation**: Each admin request validates session cookie → Checks database
3. **Admin Logout**: Server invalidates session → Clears cookie

### Key Security Features
- **HttpOnly Cookies**: Session tokens never accessible to JavaScript
- **SHA-256 Hashed Tokens**: Database stores only hashed versions
- **CORS Protection**: Origin validation on all endpoints
- **Session Expiration**: Configurable TTL with automatic cleanup
- **Admin Role Validation**: Supabase auth metadata verification

## 🏗️ Implementation Components

### 1. Netlify Functions

#### `netlify/functions/adminLogin.ts`
**Purpose**: Secure admin authentication endpoint
```typescript
POST /.netlify/functions/adminLogin
Body: { email: string, password: string }
Response: Sets HttpOnly cookie, returns { ok: true }
```

**Security Features**:
- Email/password validation with regex
- Supabase auth integration
- Admin role verification in user metadata
- SHA-256 token hashing
- Secure cookie configuration

#### `netlify/functions/adminLogout.ts`
**Purpose**: Session termination endpoint
```typescript
POST /.netlify/functions/adminLogout
Response: Clears HttpOnly cookie, returns { ok: true }
```

#### `netlify/functions/_adminGuard.ts`
**Purpose**: Reusable admin session validation middleware
```typescript
export async function requireAdmin(event): Promise<{ ok: boolean, userId?: string }>
```

**Features**:
- Cookie parsing and token extraction
- SHA-256 hash verification
- Database session lookup
- Expiration validation

#### `netlify/functions/adminGetUsers.ts`
**Purpose**: Secure user list endpoint
```typescript
GET /.netlify/functions/adminGetUsers
Response: Array of user profiles (admin-only)
```

#### `netlify/functions/createUser.ts` (Updated)
**Purpose**: Secure user creation endpoint
```typescript
POST /.netlify/functions/createUser
Body: { email: string, password: string }
Response: { userId: string }
```

**Changes**: Now uses `requireAdmin()` instead of JWT validation

### 2. Database Schema

#### `admin_sessions` Table Structure
```sql
CREATE TABLE admin_sessions (
  id SERIAL PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  token_hash TEXT NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX idx_admin_sessions_token_hash ON admin_sessions (token_hash);
CREATE INDEX idx_admin_sessions_expires_at ON admin_sessions (expires_at);
```

#### RLS Policies
```sql
-- Deny all direct client access
CREATE POLICY "deny all admin_sessions" ON admin_sessions
FOR ALL USING (false) WITH CHECK (false);
```

### 3. Frontend Updates

#### `src/pages/admin/AdminLogin.tsx`
**Changes**:
- Removed client-side auth calls
- Added server-side fetch to `/adminLogin`
- Changed from nickname to email authentication
- Added `credentials: 'include'` for cookies

#### `src/pages/admin/AdminControl.tsx`
**Changes**:
- Updated logout to call `/adminLogout`
- Removed client-side session management

#### `src/components/admin/AdminUserManagement.tsx`
**Changes**:
- Updated to use `/adminGetUsers` endpoint
- Removed security warnings
- Added success notification

#### `src/lib/adminAuth.ts`
**Changes**:
- `getAllUsers()`: Now calls server endpoint
- `createUser()`: Now uses cookie authentication
- Disabled functions: Return security errors

## 🔧 Environment Variables

### Netlify Environment Variables
```bash
SUPABASE_URL=your_supabase_url
SUPABASE_ANON_KEY=your_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
ALLOWED_ORIGIN=https://your-domain.app
ADMIN_SESSION_TTL_SEC=28800  # 8 hours (optional)
```

### Supabase Edge Functions Environment Variables
```bash
ALLOWED_ORIGIN=https://your-domain.app
```

## 🚀 Deployment Instructions

### 1. Database Migrations
Run these migrations in order:
```sql
-- 1. Update admin_sessions schema
supabase/migrations/20250927_update_admin_sessions_schema.sql

-- 2. Revoke client access to admin functions  
supabase/migrations/20250927_revoca_admin_get_profiles.sql

-- 3. Add deny-all RLS policies
supabase/migrations/20250927_rls_admin_deny_all.sql
```

### 2. Environment Variables
Set all required environment variables in:
- Netlify dashboard → Site settings → Environment variables
- Supabase dashboard → Edge Functions → Environment variables

### 3. Service Role Key Rotation
⚠️ **CRITICAL**: Rotate your `SUPABASE_SERVICE_ROLE_KEY`:
1. Go to Supabase Dashboard → Settings → API
2. Click "Reset" next to service_role key
3. Update the new key in all environment variables

### 4. Admin User Setup
Create admin users with proper role metadata:

**Option A**: Via Supabase Auth Dashboard
1. Create user with email/password
2. Add custom claim: `role: "admin"` in user_metadata or app_metadata

**Option B**: Via SQL (service_role access)
```sql
-- Update existing user to admin
UPDATE auth.users 
SET raw_user_meta_data = raw_user_meta_data || '{"role": "admin"}'::jsonb
WHERE email = 'admin@example.com';
```

## 🧪 Testing Checklist

### Authentication Flow
- [ ] Admin login with valid email/password succeeds
- [ ] Admin login with invalid credentials fails
- [ ] Non-admin users cannot access admin functions
- [ ] HttpOnly cookie is set on successful login
- [ ] Session persists across page reloads
- [ ] Logout clears session cookie

### Admin Functions
- [ ] User list loads in admin panel
- [ ] User creation works with admin session
- [ ] Admin functions fail without valid session
- [ ] Session expiration is enforced

### Security
- [ ] No SERVICE_ROLE_KEY in client bundle
- [ ] CORS blocks unauthorized origins
- [ ] Direct database calls to admin tables fail
- [ ] Session tokens are properly hashed in database

## 🛡️ Security Benefits

### Before (Client-Side)
❌ SERVICE_ROLE_KEY exposed in browser
❌ Direct database access from client
❌ Session tokens stored in localStorage
❌ Admin functions callable by anyone

### After (Server-Side)
✅ SERVICE_ROLE_KEY only on server
✅ Database access via protected endpoints
✅ HttpOnly cookies prevent XSS
✅ Admin role validation required
✅ Session tokens hashed in database
✅ CORS protection enabled
✅ Automatic session expiration

## 🔄 Migration from Client-Side

The migration maintains backward compatibility:
1. Existing admin users continue to work (with email instead of nickname)
2. All admin UI components work unchanged
3. User creation and management functions preserved
4. Database schema extends existing tables

## 📋 Maintenance

### Session Cleanup
Implement periodic cleanup of expired sessions:
```sql
DELETE FROM admin_sessions 
WHERE expires_at < NOW();
```

### Monitoring
Monitor these metrics:
- Failed login attempts
- Active admin sessions
- Admin function usage
- Session token generation rate

### Updates
When updating admin functions:
1. Use `requireAdmin()` guard in all admin endpoints
2. Set `credentials: 'include'` in frontend requests
3. Validate origin with `ALLOWED_ORIGIN`
4. Hash sensitive tokens before database storage

---

**Security Level**: Enterprise-Grade
**Authentication Method**: Server-Side Session Management
**Session Storage**: HttpOnly Cookies + Database
**Access Control**: Role-Based with Supabase Auth Integration
