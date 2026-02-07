
import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export async function POST(request: Request) {
    try {
        const { username } = await request.json()
        const supabase = await createClient()

        if (!username || username.length < 3) {
            return NextResponse.json({ error: 'Username too short' }, { status: 400 })
        }

        const { data } = await supabase
            .from('customers')
            .select('id')
            .eq('username', username)
            .single()

        return NextResponse.json({
            available: !data,
            username: username
        })
    } catch (error) {
        return NextResponse.json({ error: 'Internal error' }, { status: 500 })
    }
}
