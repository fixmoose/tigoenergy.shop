import { NextRequest, NextResponse } from 'next/server'
import { createClient, createAdminClient } from '../../../../../lib/supabase/server'
import { cookies } from 'next/headers'
import { getPinnedTemplate, replacePlaceholders, generatePackingItemsTableHtml, DocumentData } from '../../../../../lib/document-service'
import { generatePdfFromHtml } from '../../../../../lib/pdf-generator'
import { getLegalClauses } from '../../../../../lib/legal-clauses'
import { calculateTigoParcels } from '../../../../../lib/shipping/dpd'
import { DOCUMENT_TEMPLATES } from '../../../../../lib/document-templates'

export async function GET(
    req: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    const { id } = await params

    const cookieStore = await cookies()
    let isAdmin = cookieStore.get('tigo-admin')?.value === '1'

    // Allow warehouse members by email param (packing slips don't contain prices)
    if (!isAdmin) {
        const warehouseEmail = req.nextUrl.searchParams.get('warehouse_email')
        if (warehouseEmail) {
            const adminSb = await createAdminClient()
            const { data: driver } = await adminSb.from('drivers').select('id').eq('email', warehouseEmail).eq('is_warehouse', true).single()
            if (driver) isAdmin = true
        }
    }

    const supabase = isAdmin ? await createAdminClient() : await createClient()

    // 1. Fetch Order with Items
    const { data: order, error: orderError } = await supabase
        .from('orders')
        .select('*, order_items(*)')
        .eq('id', id)
        .single()

    if (orderError || !order) {
        return NextResponse.json({ error: 'Order not found' }, { status: 404 })
    }

    // 2. Security Check (Only owner, admin, or warehouse)
    if (!isAdmin) {
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
        }
        if (order.customer_email !== user.email) {
            const isAdminUser = user.email?.endsWith('@tigoenergy.com') || user.user_metadata?.role === 'admin'
            if (!isAdminUser) {
                return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
            }
        }
    }

    try {
        const lang = order.language || 'en'
        const isPickup = order.shipping_carrier === 'Personal Pick-up'

        // 3. Get Pinned Template — fall back to hardcoded if DB template is broken/missing items placeholder
        let templateHtml: string
        const dbTemplate = await getPinnedTemplate('packing_slip', lang)
        if (dbTemplate?.content_html?.includes('{packing_items_table}')) {
            templateHtml = dbTemplate.content_html
        } else {
            templateHtml = DOCUMENT_TEMPLATES.packing_slip
        }

        // Localize hardcoded template labels
        const packingLabels: Record<string, Record<string, string>> = {
            sl: {
                title: 'Dobavnica', orderDate: 'Datum naročila', shipFrom: 'Pošiljatelj', shipTo: 'Prejemnik',
                itemsToPack: 'Artikli za pakiranje', totalParcels: 'Število paketov / škatel:',
                totalWeight: 'Skupna teža:', verifyNote: 'Pred zapiranjem preverite vse artikle. Neskladja sporočite na',
            },
            hr: {
                title: 'Otpremnica', orderDate: 'Datum narudžbe', shipFrom: 'Pošiljatelj', shipTo: 'Primatelj',
                itemsToPack: 'Artikli za pakiranje', totalParcels: 'Ukupno paketa / kutija:',
                totalWeight: 'Ukupna težina:', verifyNote: 'Provjerite sve artikle prije zatvaranja. Neslaganja prijavite na',
            },
            de: {
                title: 'Lieferschein', orderDate: 'Bestelldatum', shipFrom: 'Absender', shipTo: 'Empfänger',
                itemsToPack: 'Artikel zum Verpacken', totalParcels: 'Pakete / Kartons gesamt:',
                totalWeight: 'Gesamtgewicht:', verifyNote: 'Alle Artikel vor dem Verschließen prüfen. Abweichungen melden an',
            },
            it: {
                title: 'Bolla di consegna', orderDate: 'Data ordine', shipFrom: 'Mittente', shipTo: 'Destinatario',
                itemsToPack: 'Articoli da imballare', totalParcels: 'Totale colli / scatole:',
                totalWeight: 'Peso totale:', verifyNote: 'Verificare tutti gli articoli prima della chiusura. Segnalare discrepanze a',
            },
            cs: {
                title: 'Dodací list', orderDate: 'Datum objednávky', shipFrom: 'Odesílatel', shipTo: 'Příjemce',
                itemsToPack: 'Položky k zabalení', totalParcels: 'Celkem balíků / krabic:',
                totalWeight: 'Celková hmotnost:', verifyNote: 'Před uzavřením zkontrolujte všechny položky. Nesrovnalosti nahlaste na',
            },
            sk: {
                title: 'Dodací list', orderDate: 'Dátum objednávky', shipFrom: 'Odosielateľ', shipTo: 'Príjemca',
                itemsToPack: 'Položky na zabalenie', totalParcels: 'Celkom balíkov / krabíc:',
                totalWeight: 'Celková hmotnosť:', verifyNote: 'Pred uzavretím skontrolujte všetky položky. Nezrovnalosti nahláste na',
            },
            sv: {
                title: 'Följesedel', orderDate: 'Orderdatum', shipFrom: 'Avsändare', shipTo: 'Mottagare',
                itemsToPack: 'Artiklar att packa', totalParcels: 'Totalt kolli / kartonger:',
                totalWeight: 'Totalvikt:', verifyNote: 'Kontrollera alla artiklar innan försegling. Rapportera avvikelser till',
            },
        }
        if (lang !== 'en' && !dbTemplate?.content_html && packingLabels[lang]) {
            const pl = packingLabels[lang]
            templateHtml = templateHtml
                .replace('>Packing Slip<', `>${pl.title}<`)
                .replace('>Order Date<', `>${pl.orderDate}<`)
                .replace('>Ship From<', `>${pl.shipFrom}<`)
                .replace('>Ship To<', `>${pl.shipTo}<`)
                .replace('>Items to Pack<', `>${pl.itemsToPack}<`)
                .replace('>Total Parcels / Boxes:<', `>${pl.totalParcels}<`)
                .replace('>Total Weight:<', `>${pl.totalWeight}<`)
                .replace('Verify all items before sealing. Report discrepancies to', pl.verifyNote)
        }

        // 4. Prepare Data for Placeholders
        const formatAddress = (addr: any) => {
            if (!addr) return 'N/A'
            return `${addr.street || addr.line1 || ''}, ${addr.postal_code || ''} ${addr.city || ''}, ${addr.country || ''}`
        }

        // Calculate parcels/boxes using DPD packing logic
        const orderItems = order.order_items || []
        const parcels = calculateTigoParcels(orderItems.map((item: any) => ({
            name: item.product_name || item.sku || '',
            sku: item.sku || '',
            quantity: item.quantity,
            weight_kg: item.weight_kg || 0,
        })))
        const totalWeight = orderItems.reduce((sum: number, item: any) => sum + (parseFloat(item.weight_kg || 0) * item.quantity), 0)

        const documentData: DocumentData = {
            order_number: order.order_number,
            order_date: new Date(order.created_at).toLocaleDateString(),
            customer_name: `${order.billing_address?.first_name || ''} ${order.billing_address?.last_name || ''}`.trim() || order.customer_email,
            customer_email: order.customer_email,
            customer_company: order.company_name,
            customer_phone: order.shipping_address?.phone || order.customer_phone || '',
            billing_address: formatAddress(order.billing_address),
            shipping_address: formatAddress(order.shipping_address),
            subtotal_net: `${order.currency || '€'} ${parseFloat(order.subtotal || 0).toFixed(2)}`,
            vat_total: `${order.currency || '€'} ${parseFloat(order.vat_amount || 0).toFixed(2)}`,
            shipping_cost: `${order.currency || '€'} ${parseFloat(order.shipping_cost || 0).toFixed(2)}`,
            total_amount: `${order.currency || '€'} ${parseFloat(order.total || 0).toFixed(2)}`,
            payment_method: order.payment_method || 'N/A',
            items_table: '',
            packing_items_table: generatePackingItemsTableHtml(orderItems),
            total_boxes: String(parcels.length),
            total_weight: `${totalWeight.toFixed(2)} kg`,
            tracking_number: order.tracking_number || 'N/A',
            carrier_name: order.shipping_carrier || 'Standard',
            payment_proof_warning: order.pickup_payment_proof_required
                ? '<div style="margin:0 36px 8px;padding:12px;background:#fef2f2;border:3px solid #ef4444;border-radius:6px;text-align:center;"><span style="font-size:15px;font-weight:900;color:#dc2626;">OBVEZNO PREVERITI DOKAZ O PLAČILU</span><br><span style="font-size:10px;color:#991b1b;">VERIFY PROOF OF PAYMENT BEFORE RELEASING ITEMS</span></div>'
                : ''
        }

        // 5. Replace Placeholders
        let htmlContent = replacePlaceholders(templateHtml, documentData)

        // 6. Inject pickup signature block (for personal pick-up orders)
        if (isPickup) {
            const sigLabels: Record<string, { title: string; name: string; date: string; sign: string; note: string }> = {
                sl: { title: 'Podpis ob prevzemu', name: 'Ime in priimek', date: 'Datum', sign: 'Podpis', note: 'S podpisom potrjujem, da sem prevzel/a zgoraj navedeno blago v brezhibnem stanju.' },
                hr: { title: 'Potpis pri preuzimanju', name: 'Ime i prezime', date: 'Datum', sign: 'Potpis', note: 'Potpisom potvrđujem da sam preuzeo/la gore navedenu robu u ispravnom stanju.' },
                de: { title: 'Unterschrift bei Abholung', name: 'Vollständiger Name', date: 'Datum', sign: 'Unterschrift', note: 'Mit meiner Unterschrift bestätige ich, dass ich die oben genannten Waren in einwandfreiem Zustand erhalten habe.' },
                it: { title: 'Firma al ritiro', name: 'Nome completo', date: 'Data', sign: 'Firma', note: 'Con la firma confermo di aver ricevuto la merce sopra indicata in buone condizioni.' },
                cs: { title: 'Podpis při převzetí', name: 'Celé jméno', date: 'Datum', sign: 'Podpis', note: 'Podpisem potvrzuji, že jsem převzal/a výše uvedené zboží v bezvadném stavu.' },
                sk: { title: 'Podpis pri prevzatí', name: 'Celé meno', date: 'Dátum', sign: 'Podpis', note: 'Podpisom potvrdzujem, že som prevzal/a vyššie uvedený tovar v bezchybnom stave.' },
                sv: { title: 'Signatur vid upphämtning', name: 'Fullständigt namn', date: 'Datum', sign: 'Signatur', note: 'Genom min signatur bekräftar jag att jag har mottagit ovanstående varor i gott skick.' },
            }
            const sig = sigLabels[lang] || { title: 'Pickup Signature', name: 'Full Name', date: 'Date', sign: 'Signature', note: 'By signing, I confirm that I have received the above goods in good condition.' }
            const sigTitle = sig.title
            const sigName = sig.name
            const sigDate = sig.date
            const sigSign = sig.sign
            const sigNote = sig.note
            const signatureBlock = `
<div style="margin:24px 36px 0;padding:16px;border:2px solid #1a2b3c;border-radius:8px;background:#ffffff;">
  <div style="font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:2px;color:#1a2b3c;margin-bottom:12px;">${sigTitle}</div>
  <div style="font-size:9px;color:#6b7280;margin-bottom:16px;">${sigNote}</div>
  <table style="width:100%;border-collapse:collapse;">
    <tr>
      <td style="width:50%;padding-right:16px;">
        <div style="font-size:9px;font-weight:700;text-transform:uppercase;letter-spacing:1px;color:#9ca3af;margin-bottom:4px;">${sigName}</div>
        <div style="border-bottom:1px solid #1a2b3c;height:28px;"></div>
      </td>
      <td style="width:25%;padding-right:16px;">
        <div style="font-size:9px;font-weight:700;text-transform:uppercase;letter-spacing:1px;color:#9ca3af;margin-bottom:4px;">${sigDate}</div>
        <div style="border-bottom:1px solid #1a2b3c;height:28px;"></div>
      </td>
      <td style="width:25%;">
        <div style="font-size:9px;font-weight:700;text-transform:uppercase;letter-spacing:1px;color:#9ca3af;margin-bottom:4px;">${sigSign}</div>
        <div style="border-bottom:1px solid #1a2b3c;height:28px;"></div>
      </td>
    </tr>
  </table>
</div>`
            htmlContent = htmlContent.replace('</body>', signatureBlock + '</body>')
        }

        // 7. Inject legal clauses
        const isB2BOrder = !!(order.company_name || order.vat_id)
        const clauses = getLegalClauses(lang)
        const enClauses = getLegalClauses('en')
        const isEnglish = lang === 'en'
        const emailLink = '<a href="mailto:support@tigoenergy.shop" style="color:#16a34a;">support@tigoenergy.shop</a>'
        const legalClause = `
<div style="margin-top:32px;padding:14px 16px;border:1px solid #e5e7eb;border-radius:6px;background:#f9fafb;font-size:10px;color:#374151;line-height:1.6;">
  <strong style="display:block;margin-bottom:4px;font-size:10.5px;">${clauses.packingTitle}${!isEnglish ? ` / ${enClauses.packingTitle}` : ''}</strong>
  ${clauses.packingBody.replace('support@tigoenergy.shop', emailLink)}
  ${!isEnglish ? `<br><br><em style="color:#6b7280;">${enClauses.packingBody.replace('support@tigoenergy.shop', emailLink)}</em>` : ''}
  ${isB2BOrder ? `<br><br><strong>${clauses.packingB2BAddition}</strong>${!isEnglish ? `<br><em style="color:#6b7280;">${enClauses.packingB2BAddition}</em>` : ''}` : ''}
</div>`
        htmlContent = htmlContent.replace('</body>', legalClause + '</body>')

        // 7. Generate PDF
        const pdfBuffer = await generatePdfFromHtml(htmlContent)

        // 7. Return PDF response
        return new NextResponse(Buffer.from(pdfBuffer), {
            headers: {
                'Content-Type': 'application/pdf',
                'Content-Disposition': `attachment; filename=${({ sl: 'Dobavnica', hr: 'Otpremnica', de: 'Lieferschein', it: 'BollaConsegna', cs: 'DodaciList', sk: 'DodaciList', sv: 'Foljesedel' } as Record<string, string>)[lang] || 'PackingSlip'}_${order.order_number}.pdf`,
                'Cache-Control': 'no-cache'
            },
        })
    } catch (err) {
        console.error('Packing Slip Generation Error:', err)
        return NextResponse.json({ error: 'Failed to generate PDF' }, { status: 500 })
    }
}
