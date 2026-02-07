import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { orderIds, reportDate } = await request.json()

    if (!orderIds || !Array.isArray(orderIds) || orderIds.length === 0) {
      return NextResponse.json({ success: false, error: 'No order IDs provided' }, { status: 400 })
    }

    // Mark orders as Intrastat reported
    const { data, error } = await supabase
      .from('orders')
      .update({
        intrastat_reported: true,
        intrastat_report_date: reportDate || new Date().toISOString().split('T')[0],
      })
      .in('id', orderIds)
      .eq('transaction_type', 'intra_eu_distance_sale')
      .select('id')

    if (error) {
      return NextResponse.json({ success: false, error: error.message }, { status: 500 })
    }

    return NextResponse.json({
      success: true,
      data: {
        updated: data?.length || 0,
        requested: orderIds.length,
      },
    })
  } catch (err) {
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 })
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { orderIds } = await request.json()

    if (!orderIds || !Array.isArray(orderIds) || orderIds.length === 0) {
      return NextResponse.json({ success: false, error: 'No order IDs provided' }, { status: 400 })
    }

    // Unmark orders as Intrastat reported (for corrections)
    const { data, error } = await supabase
      .from('orders')
      .update({
        intrastat_reported: false,
        intrastat_report_date: null,
      })
      .in('id', orderIds)
      .select('id')

    if (error) {
      return NextResponse.json({ success: false, error: error.message }, { status: 500 })
    }

    return NextResponse.json({
      success: true,
      data: {
        updated: data?.length || 0,
        requested: orderIds.length,
      },
    })
  } catch (err) {
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 })
  }
}
