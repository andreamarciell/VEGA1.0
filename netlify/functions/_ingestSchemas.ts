import { z } from 'zod';

/**
 * Schemi Zod per validazione dati ingest via API
 * Basati su strutture BigQuery (syncFromDatabase.ts) e interfacce TypeScript (src/types/aml.ts)
 */

// Helper per validare account_id (deve essere convertibile a numero per INT64 BigQuery)
const accountIdSchema = z.union([
  z.string().regex(/^-?\d+$/, 'account_id must be a numeric string'),
  z.number().int('account_id must be an integer')
]).transform((val) => {
  // Normalizza a stringa per consistenza
  return typeof val === 'number' ? String(val) : val;
});

// Helper per validare timestamp ISO 8601 o compatibile BigQuery
const timestampSchema = z.string().datetime({ message: 'Timestamp must be in ISO 8601 format' })
  .or(z.string().regex(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d{3})?(Z|[+-]\d{2}:\d{2})?$/, 'Invalid timestamp format'));

/**
 * Schema per Movement (transazione)
 * Basato su struttura BigQuery Movements table
 */
export const MovementSchema = z.object({
  id: z.string().min(1, 'Movement id is required'),
  created_at: timestampSchema,
  account_id: accountIdSchema,
  reason: z.string().min(1, 'Reason is required'),
  amount: z.number('Amount must be a number'),
  ts_extension: z.string().nullable().optional(),
  deposit_domain: z.string().nullable().optional(),
  withdrawal_mode: z.string().nullable().optional(),
  balance_after: z.number().nullable().optional()
});

/**
 * Schema per Profile (profilo giocatore)
 * Basato su struttura BigQuery Profiles table
 */
export const ProfileSchema = z.object({
  account_id: accountIdSchema,
  nick: z.string().min(1, 'Nick is required'),
  first_name: z.string().min(1, 'First name is required'),
  last_name: z.string().min(1, 'Last name is required')
});

/**
 * Schema per Session (sessione di login)
 * Basato su struttura BigQuery Sessions table
 */
export const SessionSchema = z.object({
  id: z.string().min(1, 'Session id is required'),
  account_id: accountIdSchema,
  ip_address: z.string().ip({ message: 'Invalid IP address format' }).or(z.string().regex(/^[\d.]+$/, 'Invalid IP address format')),
  login_time: timestampSchema,
  logout_time: timestampSchema.nullable().optional(),
  platform: z.string().nullable().optional()
});

/**
 * Schema per payload formato Real-Time (singola transazione)
 * Supporta: { movement: {...} } o { profile: {...} } o { session: {...} }
 */
export const RealTimePayloadSchema = z.object({
  movement: MovementSchema.optional(),
  profile: ProfileSchema.optional(),
  session: SessionSchema.optional()
}).refine(
  (data) => data.movement || data.profile || data.session,
  {
    message: 'Payload must contain at least one of: movement, profile, or session'
  }
);

/**
 * Schema per payload formato Micro-Batch (array)
 * Supporta: { movements: [...], profiles: [...], sessions: [...] }
 */
export const MicroBatchPayloadSchema = z.object({
  movements: z.array(MovementSchema).optional(),
  profiles: z.array(ProfileSchema).optional(),
  sessions: z.array(SessionSchema).optional()
}).refine(
  (data) => (data.movements && data.movements.length > 0) || 
            (data.profiles && data.profiles.length > 0) || 
            (data.sessions && data.sessions.length > 0),
  {
    message: 'Payload must contain at least one non-empty array: movements, profiles, or sessions'
  }
);

/**
 * Schema principale per payload ingest
 * Supporta sia formato Real-Time che Micro-Batch
 */
export const IngestPayloadSchema = z.union([
  RealTimePayloadSchema,
  MicroBatchPayloadSchema
]);

// Type exports per TypeScript
export type Movement = z.infer<typeof MovementSchema>;
export type Profile = z.infer<typeof ProfileSchema>;
export type Session = z.infer<typeof SessionSchema>;
export type RealTimePayload = z.infer<typeof RealTimePayloadSchema>;
export type MicroBatchPayload = z.infer<typeof MicroBatchPayloadSchema>;
export type IngestPayload = z.infer<typeof IngestPayloadSchema>;

/**
 * Normalizza payload in formato unificato (sempre array)
 * Utile per processare sia real-time che micro-batch nello stesso modo
 */
export function normalizePayload(payload: IngestPayload): {
  movements: Movement[];
  profiles: Profile[];
  sessions: Session[];
} {
  const result = {
    movements: [] as Movement[],
    profiles: [] as Profile[],
    sessions: [] as Session[]
  };

  // Se è formato real-time (singolo oggetto)
  if ('movement' in payload && payload.movement) {
    result.movements.push(payload.movement);
  }
  if ('profile' in payload && payload.profile) {
    result.profiles.push(payload.profile);
  }
  if ('session' in payload && payload.session) {
    result.sessions.push(payload.session);
  }

  // Se è formato micro-batch (array)
  if ('movements' in payload && payload.movements) {
    result.movements.push(...payload.movements);
  }
  if ('profiles' in payload && payload.profiles) {
    result.profiles.push(...payload.profiles);
  }
  if ('sessions' in payload && payload.sessions) {
    result.sessions.push(...payload.sessions);
  }

  return result;
}
