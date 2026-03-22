import { NextRequest, NextResponse } from 'next/server'
import { createClient, createAdminClient } from '@/lib/supabase/server'
import { cookies } from 'next/headers'

/**
 * Serves files from Supabase Storage via authenticated API route.
 * Usage: /api/storage?bucket=invoices&path=orders/xxx/file.pdf
 *
 * Allows admin (via cookie) or the order owner to download stored files.
 */
export async function GET(req: NextRequest) {
    const bucket = req.nextUrl.searchParams.get('bucket')
    const path = req.nextUrl.searchParams.get('path')

    if (!bucket || !path) {
        return NextResponse.json({ error: 'Missing bucket or path' }, { status: 400 })
    }

    // Auth: allow admin cookie, warehouse email, or authenticated user
    const cookieStore = await cookies()
    let isAdmin = cookieStore.get('tigo-admin')?.value === '1'

    // Allow warehouse members by email param
    if (!isAdmin) {
        const warehouseEmail = req.nextUrl.searchParams.get('warehouse_email')
        if (warehouseEmail) {
            const admin = await createAdminClient()
            const { data: driver } = await admin.from('drivers').select('id').eq('email', warehouseEmail).eq('is_warehouse', true).single()
            if (driver) isAdmin = true
        }
    }

    if (!isAdmin) {
        const supabase = await createClient()
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
        }

        // Extract order ID from path to verify ownership
        const orderIdMatch = path.match(/^orders\/([^/]+)\//)
        if (orderIdMatch) {
            const orderId = orderIdMatch[1]
            const { data: order } = await supabase
                .from('orders')
                .select('customer_email')
                .eq('id', orderId)
                .single()

            if (!order || order.customer_email !== user.email) {
                const isAdminUser = user.email?.endsWith('@tigoenergy.com') || user.user_metadata?.role === 'admin'
                if (!isAdminUser) {
                    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
                }
            }
        }
    }

    // Use admin client to bypass storage RLS
    const admin = await createAdminClient()
    const { data, error } = await admin.storage.from(bucket).download(path)

    if (error || !data) {
        console.error('Storage download error:', error)
        return NextResponse.json({ error: 'File not found' }, { status: 404 })
    }

    const arrayBuffer = await data.arrayBuffer()
    const fileName = path.split('/').pop() || 'file'
    const ext = fileName.split('.').pop()?.toLowerCase()
    const contentType = ext === 'pdf' ? 'application/pdf'
        : ext === 'png' ? 'image/png'
        : ext === 'jpg' || ext === 'jpeg' ? 'image/jpeg'
        : 'application/octet-stream'

    return new NextResponse(Buffer.from(arrayBuffer), {
        headers: {
            'Content-Type': contentType,
            'Content-Disposition': `inline; filename="${fileName}"`,
            'Cache-Control': 'private, max-age=3600',
        },
    })
}
