import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export async function GET(request: Request) {
    const { searchParams, origin } = new URL(request.url)
    const code = searchParams.get('code')
    const next = searchParams.get('next') ?? '/auth/welcome'

    if (code) {
        const supabase = await createClient()
        const { error } = await supabase.auth.exchangeCodeForSession(code)

        if (!error) {
            // Redirect to welcome page (same tab - no new window)
            return NextResponse.redirect(`${origin}${next}`)
        }
    }

    // Return to login with error if something went wrong
    return NextResponse.redirect(`${origin}/auth/login?error=Could not verify email`)
}
