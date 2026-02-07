'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import type { Review } from '@/types/database'
import { verifyRecaptcha } from '@/lib/recaptcha'

export async function getReviews(productId: string) {
    const supabase = await createClient()

    const { data, error } = await supabase
        .from('reviews')
        .select('*')
        .eq('product_id', productId)
        .order('created_at', { ascending: false })

    if (error) {
        console.error('Error fetching reviews:', error)
        return []
    }

    return data as Review[]
}

export async function getAllReviews() {
    const supabase = await createClient()

    const { data, error } = await supabase
        .from('reviews')
        .select('*, products(name_en)')
        .order('created_at', { ascending: false })

    if (error) {
        console.error('Error fetching all reviews:', error)
        return []
    }

    return data
}

export async function createReview(formData: FormData) {
    // Verify reCAPTCHA
    const recaptchaToken = formData.get('recaptcha_token') as string
    const recaptcha = await verifyRecaptcha(recaptchaToken)
    if (!recaptcha.success) {
        throw new Error('reCAPTCHA verification failed. Please try again.')
    }

    const supabase = await createClient()

    const product_id = formData.get('product_id') as string
    const reviewer_name = formData.get('reviewer_name') as string
    const rating = Number(formData.get('rating'))
    const comment = formData.get('comment') as string

    // Get current user for user_id (optional)
    const { data: { user } } = await supabase.auth.getUser()

    if (!reviewer_name || !rating) {
        throw new Error('Name and rating are required')
    }

    const { error } = await supabase
        .from('reviews')
        .insert({
            product_id,
            user_id: user?.id || null,
            reviewer_name,
            rating,
            comment: comment || null,
        })

    if (error) {
        throw new Error(error.message)
    }

    revalidatePath(`/products/${product_id}`) // Ideally slug, but checking revalidate strategy
    // We need to revalidate the product page. Since we don't have slug here easily unless passed, 
    // lets revalidate the whole products path or standard path.
    // Actually, client component calls this, maybe we just revalidatePath('/products') and specific?
    // Easier: revalidatePath('/', 'layout') is overkill.
    // We will assume the page revalidates on visit or use aggressive revalidation.
    revalidatePath('/products/[slug]', 'page')
}

export async function deleteReview(reviewId: string) {
    const supabase = await createClient()

    // Check auth/admin if policies enforce it, or if policies allow auth user to delete own.
    // Admin logic: usually restricted. Here we assume the caller has rights or RLS handles it.

    const { error } = await supabase
        .from('reviews')
        .delete()
        .eq('id', reviewId)

    if (error) {
        throw new Error(error.message)
    }

    revalidatePath('/admin/reviews')
    revalidatePath('/products/[slug]', 'page')
}
