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
        'Access-Control-Allow-Methods': 'GET,OPTIONS',
        'Access-Control-Allow-Credentials': 'true',
      },
    };
  }

  if (event.httpMethod !== 'GET') {
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

    // Get organization members from Clerk
    const memberships = await clerkClient.organizations.getOrganizationMembershipList({
      organizationId: clerkOrgId,
    });

    const users = memberships.data.map(membership => ({
      id: membership.publicUserData?.userId || '',
      email: membership.publicUserData?.identifier || '',
      role: membership.role,
      created_at: membership.createdAt,
      updated_at: membership.updatedAt
    }));

    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': allowed,
        'Access-Control-Allow-Credentials': 'true'
      },
      body: JSON.stringify({
        success: true,
        tenant: {
          id: tenant.id,
          clerk_org_id: tenant.clerk_org_id,
          display_name: tenant.display_name
        },
        users
      })
    };
  } catch (error: any) {
    console.error('Error getting tenant users:', error);
    
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
