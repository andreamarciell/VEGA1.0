import { Pool, PoolConfig } from 'pg';

/**
 * Database connection pool cache
 * Maps database names to their connection pools
 */
const poolCache = new Map<string, Pool>();

/**
 * Master database pool (singleton)
 */
let masterPool: Pool | null = null;

/**
 * Parse database URL or construct connection config
 */
function parseDbConfig(dbUrl?: string, dbName?: string): PoolConfig {
  const dbUser = process.env.DB_USER || 'postgres';
  const dbPassword = process.env.DB_PASSWORD;
  
  if (!dbPassword) {
    throw new Error('DB_PASSWORD environment variable is required');
  }

  // If full URL is provided, parse it
  if (dbUrl) {
    try {
      const url = new URL(dbUrl);
      return {
        host: url.hostname,
        port: parseInt(url.port || '5432', 10),
        database: dbName || url.pathname.slice(1) || 'postgres',
        user: url.username || dbUser,
        password: url.password || dbPassword,
        ssl: process.env.PGSSLMODE === 'require' ? { rejectUnauthorized: false } : false,
        max: 20, // Maximum number of clients in the pool
        idleTimeoutMillis: 30000,
        connectionTimeoutMillis: 10000,
      };
    } catch (error) {
      // If URL parsing fails, treat dbUrl as hostname
      return {
        host: dbUrl,
        port: parseInt(process.env.PGPORT || '5432', 10),
        database: dbName || 'postgres',
        user: dbUser,
        password: dbPassword,
        ssl: process.env.PGSSLMODE === 'require' ? { rejectUnauthorized: false } : false,
        max: 20,
        idleTimeoutMillis: 30000,
        connectionTimeoutMillis: 10000,
      };
    }
  }

  // Construct from individual env vars
  const host = process.env.PGHOST || 'localhost';
  const port = parseInt(process.env.PGPORT || '5432', 10);
  
  return {
    host,
    port,
    database: dbName || process.env.PGDATABASE || 'postgres',
    user: dbUser,
    password: dbPassword,
    ssl: process.env.PGSSLMODE === 'require' ? { rejectUnauthorized: false } : false,
    max: 20,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 10000,
  };
}

/**
 * Get or create the master database pool (vega_master)
 * This pool connects to the master database that contains tenant mappings
 */
export function getMasterPool(): Pool {
  if (masterPool) {
    return masterPool;
  }

  const masterDbUrl = process.env.MASTER_DB_URL;
  if (!masterDbUrl) {
    throw new Error('MASTER_DB_URL environment variable is required');
  }

  const config = parseDbConfig(masterDbUrl, 'vega_master');
  masterPool = new Pool(config);

  // Handle pool errors
  masterPool.on('error', (err) => {
    console.error('Unexpected error on master pool client', err);
  });

  return masterPool;
}

/**
 * Get or create a tenant database pool
 * Pools are cached by database name to avoid creating multiple connections
 * 
 * @param dbName - The name of the tenant database
 * @returns Pool instance for the tenant database
 */
export function getTenantPool(dbName: string): Pool {
  // Validate database name to prevent SQL injection
  if (!/^[a-zA-Z0-9_-]+$/.test(dbName)) {
    throw new Error(`Invalid database name: ${dbName}. Only alphanumeric, underscore, and hyphen characters are allowed.`);
  }

  // Check cache first
  if (poolCache.has(dbName)) {
    const pool = poolCache.get(dbName)!;
    // Verify pool is still valid
    if (!pool.ended) {
      return pool;
    }
    // Remove invalid pool from cache
    poolCache.delete(dbName);
  }

  // Extract host from MASTER_DB_URL (tenant DBs are on same instance)
  const masterDbUrl = process.env.MASTER_DB_URL;
  if (!masterDbUrl) {
    throw new Error('MASTER_DB_URL environment variable is required');
  }

  // Parse master URL to get host/port, but use tenant db name
  const config = parseDbConfig(masterDbUrl, dbName);
  const pool = new Pool(config);

  // Handle pool errors
  pool.on('error', (err) => {
    console.error(`Unexpected error on tenant pool client (${dbName})`, err);
    // Remove from cache on error
    poolCache.delete(dbName);
  });

  // Cache the pool
  poolCache.set(dbName, pool);

  return pool;
}

/**
 * Close all database pools (useful for graceful shutdown)
 */
export async function closeAllPools(): Promise<void> {
  const closePromises: Promise<void>[] = [];

  // Close master pool
  if (masterPool && !masterPool.ended) {
    closePromises.push(masterPool.end());
  }

  // Close all tenant pools
  for (const [dbName, pool] of poolCache.entries()) {
    if (!pool.ended) {
      closePromises.push(pool.end());
    }
  }

  await Promise.all(closePromises);
  poolCache.clear();
  masterPool = null;
}

/**
 * Get a direct client from master pool (for DDL operations like CREATE DATABASE)
 * Note: CREATE DATABASE cannot be executed in a transaction, so we need a direct client
 */
export async function getMasterClient() {
  const pool = getMasterPool();
  return await pool.connect();
}
