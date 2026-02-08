import { createServiceClient } from './_supabaseAdmin';
import { createClient } from '@supabase/supabase-js';

/**
 * Result of getting user tenant code
 */
export interface TenantCodeResult {
  tenantCode: string | null;
  error: string | null;
  userId: string | null;
}

/**
 * Retrieves the tenant_code for the currently logged-in user
 * @param event - The API event containing headers (cookie or authorization)
 * @returns TenantCodeResult with tenant_code or error
 */
export async function getUserTenantCode(event: any): Promise<TenantCodeResult> {
  try {
    // Extract authentication from cookie or header
    const cookie = event.headers.cookie || '';
    const authHeader = event.headers.authorization || event.headers['Authorization'] || '';
    
    if (!cookie && !authHeader) {
      return {
        tenantCode: null,
        error: 'No authentication provided',
        userId: null
      };
    }

    // Create Supabase client to verify session
    const supabaseClient = createClient(
      process.env.SUPABASE_URL!,
      process.env.SUPABASE_ANON_KEY!,
      {
        global: {
          headers: cookie ? { Cookie: cookie } : authHeader ? { Authorization: authHeader } : {}
        }
      }
    );

    // Verify user session
    const { data: { user }, error: userError } = await supabaseClient.auth.getUser();

    if (userError || !user) {
      return {
        tenantCode: null,
        error: 'Unauthorized - valid user session required',
        userId: null
      };
    }

    // Get tenant_code from profile
    const supabase = createServiceClient();
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('tenant_code, user_id')
      .eq('user_id', user.id)
      .single();

    if (profileError) {
      console.error('Error fetching profile for tenant_code:', profileError);
      return {
        tenantCode: null,
        error: 'Failed to fetch user profile',
        userId: user.id
      };
    }

    if (!profile?.tenant_code) {
      return {
        tenantCode: null,
        error: 'User does not have a tenant_code assigned. Please contact support.',
        userId: user.id
      };
    }

    return {
      tenantCode: profile.tenant_code,
      error: null,
      userId: user.id
    };
  } catch (error) {
    console.error('Error in getUserTenantCode:', error);
    return {
      tenantCode: null,
      error: error instanceof Error ? error.message : 'Unknown error',
      userId: null
    };
  }
}

/**
 * Validates that an account_id belongs to the user's tenant_code
 * @param accountId - The account_id to validate
 * @param userTenantCode - The tenant_code of the logged-in user
 * @returns true if account_id belongs to tenant, false otherwise
 */
export async function validateAccountIdBelongsToTenant(
  accountId: string,
  userTenantCode: string
): Promise<{ valid: boolean; error?: string }> {
  try {
    const supabase = createServiceClient();
    
    // Check if account_id exists in account_dataset_mapping with matching tenant_code
    const { data: mapping, error } = await supabase
      .from('account_dataset_mapping')
      .select('tenant_code, account_id')
      .eq('account_id', accountId)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        // No rows returned - account_id doesn't exist
        return {
          valid: false,
          error: 'Account ID not found'
        };
      }
      console.error('Error validating account_id tenant:', error);
      return {
        valid: false,
        error: 'Failed to validate account_id'
      };
    }

    if (!mapping?.tenant_code) {
      return {
        valid: false,
        error: 'Account ID does not have a tenant_code assigned'
      };
    }

    if (mapping.tenant_code !== userTenantCode) {
      return {
        valid: false,
        error: 'Account ID does not belong to your tenant'
      };
    }

    return { valid: true };
  } catch (error) {
    console.error('Exception validating account_id tenant:', error);
    return {
      valid: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
}

/**
 * Gets all account_ids that belong to a specific tenant_code
 * @param tenantCode - The tenant_code to filter by
 * @returns Array of account_ids
 */
export async function getAccountIdsForTenant(tenantCode: string): Promise<string[]> {
  try {
    const supabase = createServiceClient();
    
    const { data: mappings, error } = await supabase
      .from('account_dataset_mapping')
      .select('account_id')
      .eq('tenant_code', tenantCode);

    if (error) {
      console.error('Error fetching account_ids for tenant:', error);
      return [];
    }

    return mappings?.map(m => m.account_id) || [];
  } catch (error) {
    console.error('Exception fetching account_ids for tenant:', error);
    return [];
  }
}
