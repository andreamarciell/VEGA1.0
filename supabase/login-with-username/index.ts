    // supabase/functions/login-with-username/index.ts

    import { createClient } from 'npm:@supabase/supabase-js@2';
    import { corsHeaders } from '../_shared/cors.ts';

    // Inizializza il client di Supabase con i permessi di amministratore (service_role)
    // per poter interrogare la tabella auth.users in modo sicuro.
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    Deno.serve(async (req) => {
      // Gestione della richiesta pre-flight CORS per permettere le chiamate dal browser
      if (req.method === 'OPTIONS') {
        return new Response('ok', { headers: corsHeaders });
      }

      try {
        const { username, password } = await req.json();

        if (!username || !password) {
          throw new Error("Username and password are required.");
        }

        // 1. Trova il profilo utente basato sullo username nella tabella 'profiles'
        const { data: profile, error: profileError } = await supabaseAdmin
          .from('profiles')
          .select('user_id') // Selezioniamo solo lo user_id
          .eq('username', username)
          .single(); // Ci aspettiamo un solo risultato

        if (profileError || !profile) {
          // Non restituire un errore specifico per non rivelare se un utente esiste
          throw new Error("Invalid username or password.");
        }

        // 2. Ottieni i dettagli dell'utente (incluso l'email) dalla tabella auth
        const { data: authUser, error: authUserError } = await supabaseAdmin.auth.admin
          .getUserById(profile.user_id);

        if (authUserError || !authUser.user) {
          throw new Error("Could not find user details.");
        }
        
        const email = authUser.user.email;
        if (!email) {
            throw new Error("No email associated with this user account.");
        }

        // 3. Esegui il login con l'email trovata e la password fornita
        // Usiamo un client Supabase standard (con chiave anon) per l'operazione di login
        const supabaseClient = createClient(
            Deno.env.get('SUPABASE_URL') ?? '',
            Deno.env.get('SUPABASE_ANON_KEY') ?? '',
            { global: { headers: { Authorization: req.headers.get('Authorization')! } } }
        );
          
        const { data, error } = await supabaseClient.auth.signInWithPassword({
            email: email,
            password: password,
        });

        if (error) {
          // L'errore qui è probabilmente "Invalid login credentials"
          throw new Error(error.message);
        }

        // Se il login ha successo, restituisci i dati della sessione al client
        return new Response(JSON.stringify(data), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 200,
        });

      } catch (error) {
        // Restituisci qualsiasi errore in un formato JSON standard
        return new Response(JSON.stringify({ error: error.message }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 400,
        });
      }
    });
    