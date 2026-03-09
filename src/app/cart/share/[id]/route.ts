import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'

export async function GET(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    const { id } = await params
    const supabase = await createAdminClient()

    // Verify the cart exists
    const { data: cart, error } = await supabase
        .from('carts')
        .select('id')
        .eq('id', id)
        .single()

    if (error || !cart) {
        return NextResponse.redirect(new URL('/?cart_error=invalid', request.url))
    }

    // Set cartId cookie and redirect to /cart
    const response = NextResponse.redirect(new URL('/cart', request.url))
    response.cookies.set('cartId', id, {
        path: '/',
        maxAge: 60 * 60 * 24 * 30,
        sameSite: 'lax',
        secure: process.env.NODE_ENV === 'production',
    })
    return response
}
