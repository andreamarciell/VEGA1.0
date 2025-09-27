import { createClient } from '@supabase/supabase-js';

export function createServiceClient() {
  const url = process.env.SUPABASE_URL!;
  const serviceRole = process.env.SUPABASE_SERVICE_ROLE_KEY!; // solo su server
  return createClient(url, serviceRole);
}
