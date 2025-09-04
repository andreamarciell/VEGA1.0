    // supabase/functions/login-with-username/index.ts

    import { createClient } from 'npm:@supabase/supabase-js@2';
import { corsHeaders } from './_shared/cors.ts';

// Security headers for Edge Functions
const SECURITY_HEADERS = {
  'X-Content-Type-Options': 'nosniff',
  'X-Frame-Options': 'DENY',
  'X-XSS-Protection': '1; mode=block',
  'Referrer-Policy': 'strict-origin-when-cross-origin',
  'Strict-Transport-Security': 'max-age=31536000; includeSubDomains',
  'X-Permitted-Cross-Domain-Policies': 'none'
};

const getSecureHeaders = () => ({
  ...corsHeaders,
  ...SECURITY_HEADERS,
  'Content-Type': 'application/json'
});

    // Inizializza il client di Supabase con i permessi di amministratore (service_role)
    // per poter interrogare la tabella auth.users in modo sicuro.
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Enhanced rate limiting configuration - more restrictive for security
    const RATE_LIMIT_WINDOW_MINUTES = 5; // 5 minutes (reduced from 15)
    const MAX_ATTEMPTS = 3; // Max 3 attempts per IP per window (reduced from 5)

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

    // Check account lockout status
    const checkAccountLockout = async (username: string): Promise<{ isLocked: boolean; remainingSeconds: number; message: string }> => {
      try {
        const { data, error } = await supabaseAdmin.rpc('check_account_lockout_status', {
          p_username: username
        });

        if (error) {
          console.error('Error checking account lockout:', error);
          return { isLocked: false, remainingSeconds: 0, message: 'Unable to check account status' };
        }

        return {
          isLocked: data.is_locked || false,
          remainingSeconds: Math.max(0, data.remaining_seconds || 0),
          message: data.message || 'Account status checked'
        };
      } catch (error) {
        console.error('Exception checking account lockout:', error);
        return { isLocked: false, remainingSeconds: 0, message: 'Unable to check account status' };
      }
    };

    // Record failed login attempt
    const recordFailedAttempt = async (username: string): Promise<any> => {
      try {
        const { data, error } = await supabaseAdmin.rpc('record_failed_login_attempt', {
          p_username: username
        });

        if (error) {
          console.error('Error recording failed attempt:', error);
          return null;
        }

        return data;
      } catch (error) {
        console.error('Exception recording failed attempt:', error);
        return null;
      }
    };

    // Reset account lockout on successful login
    const resetAccountLockout = async (username: string): Promise<void> => {
      try {
        await supabaseAdmin.rpc('reset_account_lockout', {
          p_username: username
        });
      } catch (error) {
        console.error('Error resetting account lockout:', error);
      }
    };

    // Enhanced rate limit check with progressive delays
    const checkRateLimit = async (clientIP: string): Promise<{ allowed: boolean; remainingAttempts: number; resetTime: string; delaySeconds: number }> => {
      try {
        const { data, error } = await supabaseAdmin.rpc('check_rate_limit_with_delays', {
          p_ip_address: clientIP,
          p_window_minutes: RATE_LIMIT_WINDOW_MINUTES,
          p_max_attempts: MAX_ATTEMPTS
        });

        if (error) {
          console.error('Enhanced rate limit check error:', error);
          // Fail secure - deny request on error for better security
          return { allowed: false, remainingAttempts: 0, resetTime: new Date(Date.now() + 300000).toISOString(), delaySeconds: 300 };
        }

        return {
          allowed: data[0]?.allowed || false,
          remainingAttempts: data[0]?.remaining_attempts || 0,
          resetTime: data[0]?.reset_time || new Date().toISOString(),
          delaySeconds: data[0]?.delay_seconds || 0
        };
      } catch (error) {
        console.error('Enhanced rate limit check exception:', error);
        // Fail secure - deny request on exception for better security
        return { allowed: false, remainingAttempts: 0, resetTime: new Date(Date.now() + 300000).toISOString(), delaySeconds: 300 };
      }
    };

    // Record login attempt in database with delay tracking
    const recordLoginAttempt = async (
      clientIP: string, 
      userAgent: string, 
      username?: string, 
      success?: boolean, 
      errorType?: string
    ): Promise<void> => {
      try {
        await supabaseAdmin.rpc('record_login_attempt_with_delay', {
          p_ip_address: clientIP,
          p_user_agent: userAgent,
          p_username: username || null,
          p_success: success || false,
          p_error_type: errorType || null
        });
      } catch (error) {
        console.error('Error recording login attempt with delay:', error);
      }
    };

    Deno.serve(async (req) => {
      // Gestione della richiesta pre-flight CORS per permettere le chiamate dal browser
      if (req.method === 'OPTIONS') {
        return new Response('ok', { headers: corsHeaders });
      }

      try {
        // Rate limiting by IP address using database
        const clientIP = req.headers.get('x-forwarded-for') || req.headers.get('x-real-ip') || 'unknown';
        const userAgent = req.headers.get('user-agent') || 'unknown';
        
        // Check rate limit using database
        const rateLimitCheck = await checkRateLimit(clientIP);
        if (!rateLimitCheck.allowed) {
          logSecurityEvent('Rate limit exceeded with progressive delay', { 
            clientIP, 
            remainingAttempts: rateLimitCheck.remainingAttempts,
            resetTime: rateLimitCheck.resetTime,
            delaySeconds: rateLimitCheck.delaySeconds
          });
          
          // Record this rate limit violation
          await recordLoginAttempt(clientIP, userAgent, undefined, false, 'rate_limit_exceeded');
          
          const delayMessage = rateLimitCheck.delaySeconds > 60 
            ? `Please wait ${Math.ceil(rateLimitCheck.delaySeconds / 60)} minutes before trying again.`
            : `Please wait ${rateLimitCheck.delaySeconds} seconds before trying again.`;
          
          return new Response(JSON.stringify({ 
            error: 'Too many login attempts. ' + delayMessage,
            retryAfter: rateLimitCheck.delaySeconds,
            resetTime: rateLimitCheck.resetTime,
            remainingAttempts: rateLimitCheck.remainingAttempts
          }), {
            headers: { 
              ...getSecureHeaders(),
              'Retry-After': rateLimitCheck.delaySeconds.toString()
            },
            status: 429,
          });
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

        // Check if account is locked before proceeding
        const lockoutStatus = await checkAccountLockout(sanitizedUsername);
        if (lockoutStatus.isLocked) {
          logSecurityEvent('Login blocked - account locked', { 
            clientIP, 
            username: sanitizedUsername,
            remainingSeconds: lockoutStatus.remainingSeconds 
          });
          
          return new Response(JSON.stringify({ 
            error: 'Account is locked',
            lockoutInfo: {
              isLocked: true,
              remainingSeconds: lockoutStatus.remainingSeconds,
              message: lockoutStatus.message
            }
          }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 423, // Locked
          });
        }

        // 1. Trova il profilo utente basato sullo username nella tabella 'profiles'
        const { data: profile, error: profileError } = await supabaseAdmin
          .from('profiles')
          .select('user_id') // Selezioniamo solo lo user_id
          .eq('username', sanitizedUsername)
          .single(); // Ci aspettiamo un solo risultato

        if (profileError || !profile) {
          // Record failed attempt for non-existent user
          await recordFailedAttempt(sanitizedUsername);
          await recordLoginAttempt(clientIP, userAgent, sanitizedUsername, false, 'user_not_found');
          
          // Generic error message - don't reveal whether user exists
          logSecurityEvent('Login failed - authentication error', { clientIP });
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
          // Record failed attempt
          await recordFailedAttempt(sanitizedUsername);
          
          logSecurityEvent('Login failed - authentication error', { clientIP });
          return new Response(JSON.stringify({ 
            error: 'Invalid username or password' 
          }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 401,
          });
        }
        
        const email = authUser.user.email;
        if (!email) {
          // Record failed attempt
          await recordFailedAttempt(sanitizedUsername);
          
          logSecurityEvent('Login failed - authentication error', { clientIP });
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
          // Record failed login attempt
          const lockoutResult = await recordFailedAttempt(sanitizedUsername);
          await recordLoginAttempt(clientIP, userAgent, sanitizedUsername, false, 'invalid_credentials');
          console.log('❌ Login failed with error:', error.message);
          
          logSecurityEvent('Login failed - authentication error', { clientIP });
          
          // Check if account is now locked after this failed attempt
          if (lockoutResult && lockoutResult.is_locked) {
            return new Response(JSON.stringify({ 
              error: 'Account is now locked due to multiple failed attempts',
              lockoutInfo: {
                isLocked: true,
                remainingSeconds: lockoutResult.remaining_seconds,
                message: lockoutResult.message
              }
            }), {
              headers: { ...corsHeaders, 'Content-Type': 'application/json' },
              status: 423, // Locked
            });
          }
          
          // Return generic error to avoid information disclosure
          return new Response(JSON.stringify({ 
            error: 'Invalid username or password' 
          }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 401,
          });
        }

        // Login successful - reset account lockout
        await resetAccountLockout(sanitizedUsername);
        
        // Record successful login attempt
        await recordLoginAttempt(clientIP, userAgent, sanitizedUsername, true, null);

        // Log successful login (minimal info for privacy)
        logSecurityEvent('Login successful', { clientIP });

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
    