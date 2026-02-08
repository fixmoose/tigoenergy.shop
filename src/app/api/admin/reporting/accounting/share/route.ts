import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { sendEmail } from '@/lib/email'

export async function POST(req: NextRequest) {
    try {
        const supabase = await createClient()

        // Auth Check
        const { data: { user } } = await supabase.auth.getUser()
        if (!user || user.user_metadata?.role !== 'admin') {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
        }

        const { year, month, email } = await req.json()

        if (!year || !month || !email) {
            return NextResponse.json({ error: 'Year, month, and email are required' }, { status: 400 })
        }

        // Generate 32-char token
        const token = Array.from(globalThis.crypto.getRandomValues(new Uint8Array(16)))
            .map(b => b.toString(16).padStart(2, '0'))
            .join('')

        const expiresAt = new Date()
        expiresAt.setHours(expiresAt.getHours() + 24)

        const { data, error } = await supabase
            .from('accounting_share_links')
            .insert({
                token,
                year: parseInt(year),
                month: parseInt(month),
                allowed_email: email.toLowerCase().trim(),
                expires_at: expiresAt.toISOString()
            })
            .select()
            .single()

        if (error) throw error

        // Send Email
        const shareUrl = `${process.env.NEXT_PUBLIC_APP_URL || 'https://tigoenergy.shop'}/share/accounting/${token}`

        const monthNames = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
        const periodName = `${monthNames[month - 1]} ${year}`

        await sendEmail({
            to: email,
            subject: `Accounting Documents - Tigo Energy Shop - ${periodName}`,
            html: `
                <div style="font-family: sans-serif; color: #334155;">
                    <h2 style="color: #1e293b;">Accounting Data Request</h2>
                    <p>Hello,</p>
                    <p>The Tigo Energy Shop administration has shared accounting documents with you for the following period:</p>
                    <p><strong>Period:</strong> ${periodName}</p>
                    <p>You can access and download all invoices in a single PDF document through the link below:</p>
                    <div style="margin: 25px 0;">
                        <a href="${shareUrl}" style="background-color: #2563eb; color: white; padding: 12px 24px; text-decoration: none; border-radius: 8px; font-weight: bold; display: inline-block;">
                            Access Accounting Documents
                        </a>
                    </div>
                    <p style="color: #64748b; font-size: 14px;">
                        <em>Note: This link is secure and will expire in 24 hours. You will be asked to verify your email address before downloading.</em>
                    </p>
                    <hr style="border: none; border-top: 1px solid #e2e8f0; margin: 30px 0;">
                    <p style="font-size: 12px; color: #94a3b8;">
                        Tigo Energy Shop • Automated Accounting Notification
                    </p>
                </div>
            `
        })

        return NextResponse.json({ success: true, token, shareUrl })
    } catch (error: any) {
        console.error('Share Link API Error:', error)
        return NextResponse.json(
            { success: false, error: error.message || 'Failed to generate share link' },
            { status: 500 }
        )
    }
}
