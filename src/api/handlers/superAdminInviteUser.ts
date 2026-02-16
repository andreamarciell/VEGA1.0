import type { ApiHandler } from '../types';
import { getMasterPool } from '../../lib/db.js';
import { createClerkClient } from '@clerk/backend';

const clerkSecretKey = process.env.CLERK_SECRET_KEY;
if (!clerkSecretKey) {
  console.warn('CLERK_SECRET_KEY not configured - Clerk operations will fail');
}
const clerkClient = createClerkClient({ secretKey: clerkSecretKey || '' });

export const handler: ApiHandler = async (event) => {
  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 204,
      headers: {
        'Access-Control-Allow-Origin': process.env.ALLOWED_ORIGIN || '*',
        'Access-Control-Allow-Headers': 'content-type, authorization',
        'Access-Control-Allow-Methods': 'POST,OPTIONS',
        'Access-Control-Allow-Credentials': 'true',
      },
    };
  }

  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': process.env.ALLOWED_ORIGIN || '*',
        'Access-Control-Allow-Credentials': 'true'
      },
      body: JSON.stringify({ error: 'Method not allowed' })
    };
  }

  const allowed = process.env.ALLOWED_ORIGIN || '*';
  const tenantId = event.pathParameters?.tenantId;

  if (!tenantId) {
    return {
      statusCode: 400,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': allowed,
        'Access-Control-Allow-Credentials': 'true'
      },
      body: JSON.stringify({ 
        error: 'Bad request',
        message: 'Tenant ID is required'
      })
    };
  }

  try {
    const body = JSON.parse(event.body || '{}');
    const { email, role } = body;

    if (!email || !role) {
      return {
        statusCode: 400,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': allowed,
          'Access-Control-Allow-Credentials': 'true'
        },
        body: JSON.stringify({ 
          error: 'Bad request',
          message: 'email and role are required'
        })
      };
    }

    // Validate role
    const validRoles = ['admin', 'basic_member', 'org:admin', 'org:member'];
    if (!validRoles.includes(role)) {
      return {
        statusCode: 400,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': allowed,
          'Access-Control-Allow-Credentials': 'true'
        },
        body: JSON.stringify({ 
          error: 'Bad request',
          message: `Invalid role. Must be one of: ${validRoles.join(', ')}`
        })
      };
    }

    // Get tenant info from master database
    const masterPool = getMasterPool();
    const tenantResult = await masterPool.query(
      'SELECT id, clerk_org_id, display_name FROM tenants WHERE id = $1',
      [tenantId]
    );

    if (tenantResult.rows.length === 0) {
      return {
        statusCode: 404,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': allowed,
          'Access-Control-Allow-Credentials': 'true'
        },
        body: JSON.stringify({ 
          error: 'Not found',
          message: 'Tenant not found'
        })
      };
    }

    const tenant = tenantResult.rows[0];
    const clerkOrgId = tenant.clerk_org_id;

    if (!clerkSecretKey) {
      return {
        statusCode: 500,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': allowed,
          'Access-Control-Allow-Credentials': 'true'
        },
        body: JSON.stringify({ 
          error: 'Server configuration error',
          message: 'CLERK_SECRET_KEY not configured'
        })
      };
    }

    // Create organization invitation via Clerk
    const invitation = await clerkClient.organizations.createOrganizationInvitation({
      organizationId: clerkOrgId,
      emailAddress: email,
      role: role as 'admin' | 'basic_member' | 'org:admin' | 'org:member',
    });

    return {
      statusCode: 201,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': allowed,
        'Access-Control-Allow-Credentials': 'true'
      },
      body: JSON.stringify({
        success: true,
        message: 'User invitation created successfully',
        invitation: {
          id: invitation.id,
          email: invitation.emailAddress,
          role: invitation.role,
          status: invitation.status,
          created_at: invitation.createdAt
        }
      })
    };
  } catch (error: any) {
    console.error('Error inviting user:', error);
    
    // Handle Clerk-specific errors
    if (error.errors) {
      const clerkError = error.errors[0];
      return {
        statusCode: 400,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': allowed,
          'Access-Control-Allow-Credentials': 'true'
        },
        body: JSON.stringify({
          error: 'Invitation failed',
          message: clerkError.message || 'Failed to create invitation'
        })
      };
    }
    
    return {
      statusCode: 500,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': allowed,
        'Access-Control-Allow-Credentials': 'true'
      },
      body: JSON.stringify({
        error: 'Internal server error',
        message: error.message || 'Unknown error'
      })
    };
  }
};
