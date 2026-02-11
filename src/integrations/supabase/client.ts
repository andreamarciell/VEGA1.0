// TEMPORARY STUB - This file is deprecated after migration to Clerk
// TODO: Remove all references to this file and update code to use Clerk instead

// Stub Supabase client for backward compatibility during migration
export const supabase = {
  auth: {
    getSession: () => Promise.resolve({ data: { session: null }, error: null }),
    signOut: () => Promise.resolve({ error: null }),
    updateUser: () => Promise.resolve({ error: new Error('Supabase auth is deprecated. Use Clerk instead.') }),
    resetPasswordForEmail: () => Promise.resolve({ error: new Error('Supabase auth is deprecated. Use Clerk instead.') }),
    onAuthStateChange: () => ({ data: { subscription: null }, error: null }),
    setSession: () => Promise.resolve({ error: new Error('Supabase auth is deprecated. Use Clerk instead.') })
  },
  rpc: () => Promise.resolve({ data: null, error: new Error('Supabase RPC is deprecated. Use API endpoints instead.') }),
  from: () => ({
    select: () => Promise.resolve({ data: null, error: new Error('Supabase queries are deprecated. Use API endpoints instead.') })
  })
} as any;

export default supabase;
