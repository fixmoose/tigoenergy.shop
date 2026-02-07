import { createClient } from '@supabase/supabase-js'
import { readFileSync } from 'fs'
import { resolve } from 'path'

// Read .env.local manually
const envPath = resolve(process.cwd(), '.env.local')
const envContent = readFileSync(envPath, 'utf-8')
const envVars = {}
envContent.split('\n').forEach(line => {
  const [key, ...valueParts] = line.split('=')
  if (key && valueParts.length) {
    envVars[key.trim()] = valueParts.join('=').trim()
  }
})

const supabaseUrl = envVars.NEXT_PUBLIC_SUPABASE_URL
const supabaseServiceKey = envVars.SUPABASE_SERVICE_ROLE_KEY

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('Missing env vars')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: { autoRefreshToken: false, persistSession: false }
})

const adminEmail = envVars.ADMIN_EMAIL || 'dejan@haywilson.com'
const adminPassword = envVars.ADMIN_PASSWORD

if (!adminPassword) {
  console.error('Missing ADMIN_PASSWORD env var')
  process.exit(1)
}

async function createAdmin() {
  const { data, error } = await supabase.auth.admin.createUser({
    email: adminEmail,
    password: adminPassword,
    email_confirm: true,
    user_metadata: { role: 'admin' }
  })

  if (error) {
    console.error('Error creating user:', error.message)
    const { data: users } = await supabase.auth.admin.listUsers()
    const existing = users?.users?.find(u => u.email === adminEmail)
    if (existing) {
      console.log('User already exists:', existing.id)
      const { error: updateError } = await supabase.auth.admin.updateUserById(existing.id, {
        password: adminPassword,
        email_confirm: true,
        user_metadata: { role: 'admin' }
      })
      if (updateError) console.error('Update error:', updateError.message)
      else console.log('Password updated successfully')
    }
  } else {
    console.log('Admin user created:', data.user?.id)
  }
}

createAdmin()
