Admin user creation

You can create an admin user in Supabase in two ways:

1) Run the helper script (requires SUPABASE_SERVICE_ROLE_KEY in env):

   node ./scripts/create-admin-user.js admin@example.com s3curePass

2) Call POST /api/admin/create-user with header `x-admin-init-token` set to the value of `ADMIN_INIT_TOKEN` (set in env). Body: { email, password }

The script sets `user_metadata.role = 'admin'` for the created user.

NOTE: Ensure the Supabase project has a storage bucket named `product-images` for product image uploads to work.