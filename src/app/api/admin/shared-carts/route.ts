
import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function POST(request: Request) {
    try {
        const supabase = await createClient()

        // Verify admin status
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

        const { data: admin } = await supabase
            .from('admin_users')
            .select('role')
            .eq('auth_user_id', user.id)
            .single()

        if (!admin) return NextResponse.json({ error: 'Admin access required' }, { status: 403 })

        const { items } = await request.json()
        if (!items || !Array.isArray(items)) {
            return NextResponse.json({ error: 'Invalid items' }, { status: 400 })
        }

        // Create the cart
        const { data: cart, error } = await supabase
            .from('carts')
            .insert({
                items,
                // We don't attach a user_id yet, the link recipient will "claim" it
            })
            .select('id')
            .single()

        if (error) throw error

        return NextResponse.json({ success: true, cartId: cart.id })
    } catch (err: any) {
        console.error('Shared cart error:', err)
        return NextResponse.json({ error: err.message }, { status: 500 })
    }
}
