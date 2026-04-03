import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'
import { cookies } from 'next/headers'

export async function GET(req: NextRequest) {
    const cookieStore = await cookies()
    if (cookieStore.get('tigo-admin')?.value !== '1') {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(req.url)
    const year = searchParams.get('year') || new Date().getFullYear().toString()
    const month = searchParams.get('month')

    const start = month
        ? `${year}-${month.padStart(2, '0')}-01`
        : `${year}-01-01`

    const nextMonthYear = month && parseInt(month) === 12 ? parseInt(year) + 1 : parseInt(year)
    const nextMonth = month && parseInt(month) < 12 ? parseInt(month) + 1 : 1
    const end = month
        ? `${nextMonthYear}-${nextMonth.toString().padStart(2, '0')}-01`
        : `${parseInt(year) + 1}-01-01`

    const supabase = await createAdminClient()

    const { data: expenses, error } = await supabase
        .from('expenses')
        .select('*')
        .gte('date', start)
        .lt('date', end)
        .order('date', { ascending: false })

    if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 })
    }

    // Summary by category
    const byCategory: Record<string, { count: number; total: number; vat: number }> = {}
    let totalAmount = 0
    let totalVat = 0

    for (const e of expenses || []) {
        const cat = e.category || 'Other'
        if (!byCategory[cat]) byCategory[cat] = { count: 0, total: 0, vat: 0 }
        byCategory[cat].count++
        byCategory[cat].total += Number(e.amount_eur) || 0
        byCategory[cat].vat += Number(e.vat_amount) || 0
        totalAmount += Number(e.amount_eur) || 0
        totalVat += Number(e.vat_amount) || 0
    }

    return NextResponse.json({
        success: true,
        data: {
            expenses,
            summary: {
                totalAmount,
                totalVat,
                totalNet: totalAmount - totalVat,
                count: (expenses || []).length,
                byCategory: Object.entries(byCategory)
                    .sort(([, a], [, b]) => b.total - a.total)
                    .map(([category, data]) => ({ category, ...data })),
            }
        }
    })
}

export async function POST(req: NextRequest) {
    const cookieStore = await cookies()
    if (cookieStore.get('tigo-admin')?.value !== '1') {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await req.json()
    const { date, description, category, amount_eur, vat_amount, supplier, invoice_number, notes } = body

    if (!date || !description || !category || amount_eur == null) {
        return NextResponse.json({ error: 'Missing required fields: date, description, category, amount_eur' }, { status: 400 })
    }

    const supabase = await createAdminClient()

    const { data, error } = await supabase
        .from('expenses')
        .insert({
            date,
            description,
            category,
            amount_eur: Number(amount_eur),
            vat_amount: Number(vat_amount) || 0,
            supplier: supplier || null,
            invoice_number: invoice_number || null,
            notes: notes || null,
        })
        .select()
        .single()

    if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ success: true, data })
}

export async function PUT(req: NextRequest) {
    const cookieStore = await cookies()
    if (cookieStore.get('tigo-admin')?.value !== '1') {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await req.json()
    const { id, ...updates } = body

    if (!id) {
        return NextResponse.json({ error: 'Missing expense id' }, { status: 400 })
    }

    const supabase = await createAdminClient()

    const { data, error } = await supabase
        .from('expenses')
        .update({ ...updates, updated_at: new Date().toISOString() })
        .eq('id', id)
        .select()
        .single()

    if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ success: true, data })
}

export async function DELETE(req: NextRequest) {
    const cookieStore = await cookies()
    if (cookieStore.get('tigo-admin')?.value !== '1') {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(req.url)
    const id = searchParams.get('id')

    if (!id) {
        return NextResponse.json({ error: 'Missing expense id' }, { status: 400 })
    }

    const supabase = await createAdminClient()

    const { error } = await supabase
        .from('expenses')
        .delete()
        .eq('id', id)

    if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ success: true })
}
