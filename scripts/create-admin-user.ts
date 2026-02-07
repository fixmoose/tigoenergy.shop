#!/usr/bin/env node
import 'dotenv/config'
import { createClient } from '@supabase/supabase-js'

const [, , email, password] = process.argv
if (!email || !password) {
  console.error('Usage: node scripts/create-admin-user.js <email> <password>')
  process.exit(1)
}

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL
const SERVICE_ROLE = process.env.SUPABASE_SERVICE_ROLE_KEY
if (!SUPABASE_URL || !SERVICE_ROLE) {
  console.error('Set SUPABASE_SERVICE_ROLE_KEY and SUPABASE_URL in env')
  process.exit(1)
}

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE)

async function run() {
  try {
    // Create user with admin role in metadata
    const res = await supabase.auth.admin.createUser({
      email,
      password,
      user_metadata: { role: 'admin' },
    })

    if (res.error) {
      console.error('Error creating user:', res.error)
      process.exit(1)
    }

    console.log('Admin user created:', res.data.user?.id)
  } catch (err) {
    console.error('Unexpected error', err)
    process.exit(1)
  }
}

run()
