#!/usr/bin/env node

/**
 * Secure Admin User Creation Script
 * 
 * This script creates an admin user with a securely hashed password.
 * Run this script ONLY on secure environments, never in production client code.
 * 
 * Usage: node scripts/create-admin.js <nickname> <password>
 */

const bcrypt = require('bcryptjs');
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

async function createAdminUser(nickname, password) {
  // Validate environment variables
  const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  
  if (!supabaseUrl || !serviceKey) {
    console.error('❌ Missing required environment variables:');
    console.error('   - VITE_SUPABASE_URL or SUPABASE_URL');
    console.error('   - SUPABASE_SERVICE_ROLE_KEY');
    process.exit(1);
  }

  if (!nickname || !password) {
    console.error('❌ Usage: node scripts/create-admin.js <nickname> <password>');
    console.error('   Example: node scripts/create-admin.js admin SecurePassword123!');
    process.exit(1);
  }

  // Validate password strength
  if (password.length < 12) {
    console.error('❌ Password must be at least 12 characters long');
    process.exit(1);
  }

  const hasUpper = /[A-Z]/.test(password);
  const hasLower = /[a-z]/.test(password);
  const hasNumber = /[0-9]/.test(password);
  const hasSpecial = /[!@#$%^&*(),.?":{}|<>]/.test(password);

  if (!hasUpper || !hasLower || !hasNumber || !hasSpecial) {
    console.error('❌ Password must contain:');
    console.error('   - At least one uppercase letter');
    console.error('   - At least one lowercase letter');
    console.error('   - At least one number');
    console.error('   - At least one special character');
    process.exit(1);
  }

  try {
    console.log('🔒 Creating secure admin user...');
    
    // Create Supabase client with service role key
    const supabase = createClient(supabaseUrl, serviceKey);
    
    // Hash password with high salt rounds
    console.log('🔐 Hashing password...');
    const passwordHash = await bcrypt.hash(password, 12);
    
    // Check if admin user already exists
    const { data: existingAdmin } = await supabase
      .from('admin_users')
      .select('nickname')
      .eq('nickname', nickname)
      .single();
    
    if (existingAdmin) {
      console.error(`❌ Admin user '${nickname}' already exists`);
      process.exit(1);
    }
    
    // Create admin user
    console.log('👤 Creating admin user...');
    const { data, error } = await supabase
      .from('admin_users')
      .insert([{
        nickname: nickname,
        password_hash: passwordHash
      }])
      .select()
      .single();
    
    if (error) {
      console.error('❌ Failed to create admin user:', error.message);
      process.exit(1);
    }
    
    console.log('✅ Admin user created successfully!');
    console.log(`   Nickname: ${data.nickname}`);
    console.log(`   ID: ${data.id}`);
    console.log(`   Created: ${data.created_at}`);
    console.log('');
    console.log('🚨 SECURITY REMINDER:');
    console.log('   1. Store the password securely');
    console.log('   2. Clear your shell history if it contains the password');
    console.log('   3. Consider rotating the password regularly');
    console.log('   4. Never commit passwords to version control');
    
  } catch (error) {
    console.error('❌ Error creating admin user:', error.message);
    process.exit(1);
  }
}

// Get command line arguments
const args = process.argv.slice(2);
const nickname = args[0];
const password = args[1];

createAdminUser(nickname, password);
