
import { NextResponse } from 'next/server'
import { NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { cookies } from 'next/headers'

export async function POST(request: NextRequest) {
    try {
        // Verify admin status via cookie (same as middleware)
        const cookieStore = await cookies()
        const isAdmin = cookieStore.get('tigo-admin')?.value === '1'
        if (!isAdmin) return NextResponse.json({ error: 'Admin access required' }, { status: 403 })

        const supabase = await createClient()

        const { items, is_b2b = false } = await request.json()
        if (!items || !Array.isArray(items)) {
            return NextResponse.json({ error: 'Invalid items' }, { status: 400 })
        }

        // Create the cart — try with is_b2b first, fall back without it
        let cart: any = null
        let error: any = null

        const withB2b = await supabase
            .from('carts')
            .insert({ items, is_b2b })
            .select('id')
            .single()

        if (withB2b.error?.message?.includes('is_b2b')) {
            // Column doesn't exist yet — insert without it
            const withoutB2b = await supabase
                .from('carts')
                .insert({ items })
                .select('id')
                .single()
            cart = withoutB2b.data
            error = withoutB2b.error
        } else {
            cart = withB2b.data
            error = withB2b.error
        }

        if (error) throw error

        return NextResponse.json({ success: true, cartId: cart.id })
    } catch (err: any) {
        console.error('Shared cart error:', err)
        return NextResponse.json({ error: err.message }, { status: 500 })
    }
}
