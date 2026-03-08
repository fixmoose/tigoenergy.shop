
import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'

interface Props {
    params: Promise<{ id: string }>
}

export default async function SharedCartHandler({ params }: Props) {
    const { id } = await params
    const cookieStore = await cookies()
    const supabase = await createClient()

    // Verify the cart exists
    const { data: cart, error } = await supabase
        .from('carts')
        .select('id, items')
        .eq('id', id)
        .single()

    if (error || !cart) {
        // Handle invalid cart link
        return (
            <div className="min-h-screen flex items-center justify-center bg-gray-50 flex-col gap-4">
                <div className="text-4xl text-gray-300">⚠️</div>
                <h1 className="text-2xl font-bold text-gray-800">Invalid or Expired Cart Link</h1>
                <p className="text-gray-500">This shared cart may have been deleted or expired.</p>
                <a href="/" className="px-6 py-2 bg-blue-600 text-white rounded-lg font-bold">Go to Shop</a>
            </div>
        )
    }

    // Set the cartId cookie to "claim" this cart
    cookieStore.set('cartId', id, {
        path: '/',
        maxAge: 60 * 60 * 24 * 30, // 30 days
        sameSite: 'lax',
        secure: process.env.NODE_ENV === 'production'
    })

    // Redirect to the cart page
    redirect('/cart')
}
