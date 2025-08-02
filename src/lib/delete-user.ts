import { createClient } from '@supabase/supabase-js';
import type { NextApiRequest, NextApiResponse } from 'next';

// Inizializza il client Supabase con i permessi di AMMINISTRATORE
// Questo client usa la chiave segreta (service_role) e può bypassare le policy RLS
const supabaseAdmin = createClient(
  process.env.VITE_PUBLIC_SUPABASE_URL || 'https://vobftcreopaqrfoonybp.supabase.co',
  process.env.VITE_SUPABASE_SERVICE_ROLE_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZvYmZ0Y3Jlb3BhcXJmb29ueWJwIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1MzM5MDE0NywiZXhwIjoyMDY4OTY2MTQ3fQ.hrThLxR0Xmz_5SGRuWYENedV08B4jObecp72vsxUX-4'
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
