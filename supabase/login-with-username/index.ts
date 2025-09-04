    // supabase/functions/login-with-username/index.ts

    import { createClient } from 'npm:@supabase/supabase-js@2';
    import { corsHeaders } from './_shared/cors.ts';

    // Inizializza il client di Supabase con i permessi di amministratore (service_role)
    // per poter interrogare la tabella auth.users in modo sicuro.
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Rate limiting storage (in production, use Redis or database)
    const rateLimitMap = new Map<string, { attempts: number; resetTime: number }>();
    const RATE_LIMIT_WINDOW = 15 * 60 * 1000; // 15 minutes
    const MAX_ATTEMPTS = 5; // Max 5 attempts per IP per window

    // Security logging utility
    const logSecurityEvent = (event: string, details: any) => {
      console.log(`[SECURITY] ${event}:`, {
        timestamp: new Date().toISOString(),
        ...details
      });
    };

    // Input validation utility
    const validateInput = (username: string, password: string): { isValid: boolean; error: string | null } => {
      if (!username || !password) {
        return { isValid: false, error: "Username and password are required" };
      }
      
      // Basic validation - only check for non-empty values
      if (!username.trim() || !password.trim()) {
        return { isValid: false, error: "Username and password cannot be empty" };
      }
      
      return { isValid: true, error: null };
    };

    // Sanitize input utility
    const sanitizeInput = (input: string): string => {
      return input.trim().replace(/[<>]/g, '');
    };

    Deno.serve(async (req) => {
      // Gestione della richiesta pre-flight CORS per permettere le chiamate dal browser
      if (req.method === 'OPTIONS') {
        return new Response('ok', { headers: corsHeaders });
      }

      try {
        // Rate limiting by IP address
        const clientIP = req.headers.get('x-forwarded-for') || req.headers.get('x-real-ip') || 'unknown';
        const userAgent = req.headers.get('user-agent') || 'unknown';
        const now = Date.now();
        
        const rateLimit = rateLimitMap.get(clientIP);
        if (rateLimit) {
          if (now < rateLimit.resetTime) {
            if (rateLimit.attempts >= MAX_ATTEMPTS) {
              logSecurityEvent('Rate limit exceeded', { clientIP, attempts: rateLimit.attempts });
              return new Response(JSON.stringify({ 
                error: 'Too many login attempts. Please try again later.' 
              }), {
                headers: { ...corsHeaders, 'Content-Type': 'application/json' },
                status: 429,
              });
            }
            rateLimit.attempts++;
          } else {
            // Reset window
            rateLimitMap.set(clientIP, { attempts: 1, resetTime: now + RATE_LIMIT_WINDOW });
          }
        } else {
          rateLimitMap.set(clientIP, { attempts: 1, resetTime: now + RATE_LIMIT_WINDOW });
        }

        const { username, password } = await req.json();

        // Input validation
        const validation = validateInput(username, password);
        if (!validation.isValid) {
          logSecurityEvent('Invalid input format', { clientIP, username: username ? 'provided' : 'missing' });
          return new Response(JSON.stringify({ 
            error: 'Invalid input format' 
          }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 400,
          });
        }

        // Sanitize username
        const sanitizedUsername = sanitizeInput(username);

        // Log login attempt
        logSecurityEvent('Login attempt', { clientIP, username: sanitizedUsername });

        // 1. Trova il profilo utente basato sullo username nella tabella 'profiles'
        const { data: profile, error: profileError } = await supabaseAdmin
          .from('profiles')
          .select('user_id') // Selezioniamo solo lo user_id
          .eq('username', sanitizedUsername)
          .single(); // Ci aspettiamo un solo risultato

        if (profileError || !profile) {
          // Non restituire un errore specifico per non rivelare se un utente esiste
          logSecurityEvent('Login failed - user not found', { clientIP, username: sanitizedUsername });
          return new Response(JSON.stringify({ 
            error: 'Invalid username or password' 
          }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 401,
          });
        }

        // 2. Ottieni i dettagli dell'utente (incluso l'email) dalla tabella auth
        const { data: authUser, error: authUserError } = await supabaseAdmin.auth.admin
          .getUserById(profile.user_id);

        if (authUserError || !authUser.user) {
          logSecurityEvent('Login failed - auth user error', { clientIP, username: sanitizedUsername, error: authUserError?.message });
          return new Response(JSON.stringify({ 
            error: 'Invalid username or password' 
          }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 401,
          });
        }
        
        const email = authUser.user.email;
        if (!email) {
          logSecurityEvent('Login failed - no email associated', { clientIP, username: sanitizedUsername, userId: profile.user_id });
          return new Response(JSON.stringify({ 
            error: 'Invalid username or password' 
          }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 401,
          });
        }

        // 3. Esegui il login con l'email trovata e la password fornita
        // Usiamo un client Supabase standard (con chiave anon) per l'operazione di login
        console.log('🔐 Attempting login with email:', email);
        
        const supabaseClient = createClient(
            Deno.env.get('SUPABASE_URL') ?? '',
            Deno.env.get('SUPABASE_ANON_KEY') ?? '',
            { global: { headers: { Authorization: req.headers.get('Authorization')! } } }
        );
          
        const { data, error } = await supabaseClient.auth.signInWithPassword({
            email: email,
            password: password,
        });

        console.log('📊 Login result:', { data, error });

        if (error) {
          // Log failed login attempt
          console.log('❌ Login failed with error:', error.message);
          
          logSecurityEvent('Login failed - invalid credentials', { 
            clientIP, 
            username: sanitizedUsername, 
            email: email,
            error: error.message 
          });
          
          // Return generic error to avoid information disclosure
          return new Response(JSON.stringify({ 
            error: 'Invalid username or password' 
          }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 401,
          });
        }

        // Log successful login
        logSecurityEvent('Login successful', { 
          clientIP, 
          username: sanitizedUsername, 
          email: email,
          userId: profile.user_id 
        });

        // Se il login ha successo, restituisci i dati della sessione al client
        return new Response(JSON.stringify(data), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 200,
        });

      } catch (error) {
        // Log unexpected errors
        logSecurityEvent('Login error - unexpected', { 
          clientIP: req.headers.get('x-forwarded-for') || req.headers.get('x-real-ip') || 'unknown',
          error: error.message,
          stack: error.stack 
        });
        
        // Restituisci un errore generico per non rivelare dettagli interni
        return new Response(JSON.stringify({ 
          error: 'Authentication failed' 
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 500,
        });
      }
    });
    