import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { cookies } from 'next/headers'
import { createClient } from '@/lib/supabase/server'

export async function GET(req: NextRequest) {
    console.log('[signout] Signing out user')

    const supabase = await createClient()
    await supabase.auth.signOut()

    // Delete the admin cookie using next/headers cookies API
    const cookieStore = await cookies()
    cookieStore.delete('tigo-admin')

    console.log('[signout] Deleted tigo-admin cookie, redirecting to /')

    // Redirect to homepage
    return NextResponse.redirect(new URL('/', req.url))
}
