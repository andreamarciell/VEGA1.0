import { createClient } from '@supabase/supabase-js';
import type { NextApiRequest, NextApiResponse } from 'next';

// Validazione delle variabili d'ambiente richieste
const validateEnvironment = () => {
  const requiredVars = {
    SUPABASE_URL: process.env.SUPABASE_URL,
    SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY
  };

  const missingVars = Object.entries(requiredVars)
    .filter(([_, value]) => !value)
    .map(([key]) => key);

  if (missingVars.length > 0) {
    throw new Error(`Missing required environment variables: ${missingVars.join(', ')}`);
  }

  return requiredVars;
};

// Inizializza il client Supabase con i permessi di AMMINISTRATORE
// Questo client usa la chiave segreta (service_role) e può bypassare le policy RLS
const createSupabaseAdminClient = () => {
  try {
    const env = validateEnvironment();
    return createClient(env.SUPABASE_URL!, env.SUPABASE_SERVICE_ROLE_KEY!);
  } catch (error) {
    console.error('Failed to create Supabase admin client:', error);
    throw new Error('Service configuration error');
  }
};

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  // Accetta solo richieste di tipo POST
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  try {
    const { userId } = req.body;

    // Controlla che l'ID utente sia stato fornito
    if (!userId) {
      return res.status(400).json({ error: 'User ID is required' });
    }

    // Validazione formato UUID
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(userId)) {
      return res.status(400).json({ error: 'Invalid user ID format' });
    }

    // NOTA: In un'applicazione di produzione, qui andrebbe inserita la logica 
    // per verificare che chi chiama l'API sia effettivamente un admin.

    const supabaseAdmin = createSupabaseAdminClient();

    // Esegue l'eliminazione dell'utente con i privilegi di admin
    const { error } = await supabaseAdmin.auth.admin.deleteUser(userId);

    if (error) {
      console.error('Supabase error deleting user:', error);
      throw error; // Lancia l'errore se l'operazione fallisce
    }

    // Log di sicurezza per audit trail
    console.log(`[SECURITY] User deleted successfully: ${userId} at ${new Date().toISOString()}`);

    res.status(200).json({ message: 'User deleted successfully' });

  } catch (error: any) {
    console.error('API Error deleting user:', error.message);
    
    // Non rivelare dettagli interni al client
    const isSupabaseError = error.message?.includes('Supabase') || error.message?.includes('auth');
    const clientMessage = isSupabaseError 
      ? 'Failed to delete user' 
      : 'An unexpected error occurred';
    
    res.status(500).json({ error: clientMessage });
  }
}
