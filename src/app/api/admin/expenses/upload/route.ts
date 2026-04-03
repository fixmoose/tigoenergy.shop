import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'
import { cookies } from 'next/headers'

export async function PUT(req: NextRequest) {
    const cookieStore = await cookies()
    if (cookieStore.get('tigo-admin')?.value !== '1') {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const formData = await req.formData()
    const file = formData.get('file') as File
    const expenseId = formData.get('expenseId') as string
    const path = formData.get('path') as string

    if (!file || !expenseId || !path) {
        return NextResponse.json({ error: 'Missing file, expenseId, or path' }, { status: 400 })
    }

    const supabase = await createAdminClient()

    const { error: uploadError } = await supabase.storage.from('invoices').upload(path, file, {
        upsert: true,
    })

    if (uploadError) {
        return NextResponse.json({ error: uploadError.message }, { status: 500 })
    }

    const receiptUrl = `/api/storage?bucket=invoices&path=${encodeURIComponent(path)}`

    // Update expense with receipt URL
    const { error: updateError } = await supabase
        .from('expenses')
        .update({ receipt_url: receiptUrl, updated_at: new Date().toISOString() })
        .eq('id', expenseId)

    if (updateError) {
        return NextResponse.json({ error: updateError.message }, { status: 500 })
    }

    return NextResponse.json({ success: true, receipt_url: receiptUrl })
}
