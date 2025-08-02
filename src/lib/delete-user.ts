import { createClient } from '@supabase/supabase-js';
import type { NextApiRequest, NextApiResponse } from 'next';

// Inizializza il client Supabase con i permessi di AMMINISTRATORE
// Questo client usa la chiave segreta (service_role) e può bypassare le policy RLS
const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || '',
  process.env.SUPABASE_SERVICE_ROLE_KEY || ''
);

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

    // NOTA: In un'applicazione di produzione, qui andrebbe inserita la logica 
    // per verificare che chi chiama l'API sia effettivamente un admin.

    // Esegue l'eliminazione dell'utente con i privilegi di admin
    const { error } = await supabaseAdmin.auth.admin.deleteUser(userId);

    if (error) {
      throw error; // Lancia l'errore se l'operazione fallisce
    }

    res.status(200).json({ message: 'User deleted successfully' });

  } catch (error: any) {
    console.error('API Error deleting user:', error.message);
    res.status(500).json({ error: error.message || 'Failed to delete user' });
  }
}
