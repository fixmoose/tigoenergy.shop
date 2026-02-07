#!/usr/bin/env node
const { createClient } = require('@supabase/supabase-js')

const { SUPABASE_SERVICE_ROLE_KEY, SUPABASE_URL } = process.env
if (!SUPABASE_SERVICE_ROLE_KEY || !SUPABASE_URL) {
  console.error('Please set SUPABASE_SERVICE_ROLE_KEY and SUPABASE_URL in the environment before running this script.')
  console.error('Example: SUPABASE_URL=https://xyz.supabase.co SUPABASE_SERVICE_ROLE_KEY=<key> node scripts/create-storage-bucket.js')
  process.exit(1)
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)

async function main() {
  const bucketId = 'product-images'
  const { data, error } = await supabase.storage.createBucket(bucketId, { public: true })
  if (error) {
    if (error.message && /already exists/i.test(error.message)) {
      console.log('Bucket already exists:', bucketId)
      return
    }
    console.error('Failed to create bucket:', error)
    process.exit(1)
  }

  console.log('Created bucket:', data)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
