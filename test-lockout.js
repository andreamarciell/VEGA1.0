// Simple test script to verify lockout functionality
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://vobftcreopaqrfoonybp.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZvYmZ0Y3Jlb3BhcXJmb29ueWJwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTMzOTAxNDcsImV4cCI6MjA2ODk2NjE0N30.1n0H8fhQLwKWe9x8sdQYXKX002Bo4VywijxGLxX8jbo';

const supabase = createClient(supabaseUrl, supabaseKey);

async function testLockout() {
  const testUsername = 'test_lockout_user_' + Date.now();
  
  console.log('🧪 Testing lockout system with username:', testUsername);
  
  try {
    // Test 1: Check initial status
    console.log('\n1️⃣ Checking initial status...');
    const { data: initial, error: initialError } = await supabase.rpc('check_account_lockout_status', {
      p_username: testUsername
    });
    
    if (initialError) {
      console.error('❌ Error checking initial status:', initialError);
      return;
    }
    
    console.log('✅ Initial status:', initial);
    
    // Test 2: Record 3 failed attempts
    console.log('\n2️⃣ Recording 3 failed attempts...');
    for (let i = 1; i <= 3; i++) {
      const { data: attempt, error: attemptError } = await supabase.rpc('record_failed_login_attempt', {
        p_username: testUsername
      });
      
      if (attemptError) {
        console.error(`❌ Error recording attempt ${i}:`, attemptError);
        return;
      }
      
      console.log(`🔄 Attempt ${i}:`, {
        failed_attempts: attempt.failed_attempts,
        is_locked: attempt.is_locked,
        remaining_seconds: attempt.remaining_seconds,
        message: attempt.message
      });
      
      if (i === 3 && attempt.is_locked) {
        console.log('🔒 Account locked after 3 attempts - SUCCESS!');
        break;
      } else if (i === 3 && !attempt.is_locked) {
        console.log('❌ Account NOT locked after 3 attempts - PROBLEM!');
      }
    }
    
    // Test 3: Check status after 3 attempts
    console.log('\n3️⃣ Checking status after 3 attempts...');
    const { data: afterAttempts, error: afterError } = await supabase.rpc('check_account_lockout_status', {
      p_username: testUsername
    });
    
    if (afterError) {
      console.error('❌ Error checking status after attempts:', afterError);
      return;
    }
    
    console.log('✅ Status after 3 attempts:', afterAttempts);
    
    if (afterAttempts.is_locked) {
      console.log('🎉 LOCKOUT SYSTEM WORKING CORRECTLY!');
    } else {
      console.log('❌ LOCKOUT SYSTEM NOT WORKING - Account should be locked');
    }
    
  } catch (error) {
    console.error('❌ Test failed with exception:', error);
  }
}

// Run the test
testLockout();
