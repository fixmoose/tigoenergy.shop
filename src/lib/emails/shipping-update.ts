/**
 * Shipping update email — plain HTML generator.
 * Sent when order is marked as 'shipped' with tracking info.
 */

interface ShippingEmailData {
    orderNumber: string
    customerName: string
    carrier: string
    trackingNumber: string
    trackingUrl: string
    language: string
}

const SH_LABELS: Record<string, Record<string, string>> = {
    en: {
        subject: 'Your order #{orderNumber} has shipped!',
        greeting: 'Hi {name},',
        body: 'Great news! Your order has been processed and is now on its way to you.',
        carrier: 'Carrier',
        tracking: 'Tracking Number',
        trackButton: 'Track Your Package',
        footer: 'If you have any questions, contact us at support@tigoenergy.shop',
        thankYou: 'Thank you for choosing Tigo Energy!',
    },
    de: {
        subject: 'Ihre Bestellung #{orderNumber} wurde versandt!',
        greeting: 'Hallo {name},',
        body: 'Gute Neuigkeiten! Ihre Bestellung wurde bearbeitet und ist nun auf dem Weg zu Ihnen.',
        carrier: 'Versanddienstleister',
        tracking: 'Sendungsnummer',
        trackButton: 'Paket verfolgen',
        footer: 'Bei Fragen kontaktieren Sie uns unter support@tigoenergy.shop',
        thankYou: 'Vielen Dank, dass Sie sich für Tigo Energy entschieden haben!',
    },
    sl: {
        subject: 'Vaše naročilo #{orderNumber} je bilo odposlano!',
        greeting: 'Pozdravljeni {name},',
        body: 'Odlične novice! Vaše naročilo je bilo obdelano in je že na poti k vam.',
        carrier: 'Dostavljalec',
        tracking: 'Številka za sledenje',
        trackButton: 'Sledi paketu',
        footer: 'Za vprašanja nas kontaktirajte na support@tigoenergy.shop',
        thankYou: 'Hvala, ker ste izbrali Tigo Energy!',
    }
}

function getLabels(lang: string) {
    return SH_LABELS[lang] || SH_LABELS.en
}

export function buildShippingUpdateEmail(data: ShippingEmailData) {
    const l = getLabels(data.language)

    const subject = l.subject.replace('{orderNumber}', data.orderNumber)
    const greeting = l.greeting.replace('{name}', data.customerName)

    const html = `
<!DOCTYPE html>
<html lang="${data.language}">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f4f4f5;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif">
<div style="max-width:640px;margin:0 auto;padding:24px">

    <!-- Header -->
    <div style="background:#16a34a;padding:5px 0;text-align:center;border-radius:12px 12px 0 0;">
        <img src="https://tigoenergy.shop/tigo-logo-white.png" alt="Tigo Energy" style="height:20px; width:auto; display:block; margin:0 auto;">
    </div>
    <div style="background:#f9fafb; padding:8px; text-align:center; border-bottom:1px solid #e5e7eb; border-left:1px solid #e5e7eb; border-right:1px solid #e5e7eb;">
        <p style="color:#666;margin:0;font-size:11px;font-weight:bold;text-transform:uppercase;letter-spacing:1px">Shipping Confirmation: ${data.orderNumber}</p>
    </div>

    <!-- Body -->
    <div style="background:#fff;padding:32px;border-radius:0 0 12px 12px;border:1px solid #e5e7eb;border-top:none">
        <p style="font-size:16px;color:#111;margin:0 0 8px">${greeting}</p>
        <p style="font-size:14px;color:#555;margin:0 0 24px">${l.body}</p>

        <!-- Tracking Info Box -->
        <div style="background:#f9fafb;border-radius:8px;padding:20px;border:1px solid #e5e7eb;margin-bottom:24px">
            <div style="margin-bottom:12px">
                <span style="font-size:11px;text-transform:uppercase;color:#888;display:block;margin-bottom:2px">${l.carrier}</span>
                <span style="font-size:14px;font-weight:600;color:#111">${data.carrier}</span>
            </div>
            <div>
                <span style="font-size:11px;text-transform:uppercase;color:#888;display:block;margin-bottom:2px">${l.tracking}</span>
                <span style="font-size:14px;font-weight:600;color:#111;font-family:monospace">${data.trackingNumber}</span>
            </div>
        </div>

        <!-- Action Button -->
        <div style="text-align:center;margin-bottom:24px">
            <a href="${data.trackingUrl}" style="background:#16a34a;color:#fff;padding:12px 32px;border-radius:8px;text-decoration:none;font-weight:700;display:inline-block;font-size:16px">${l.trackButton}</a>
        </div>

        <hr style="border:none;border-top:1px solid #e5e7eb;margin:24px 0">
        <p style="font-size:13px;color:#888;text-align:center;margin:0 0 4px">${l.footer}</p>
        <p style="font-size:13px;color:#458400;text-align:center;font-weight:600;margin:0">${l.thankYou}</p>
    </div>
</div>
</body>
</html>`

    return { subject, html }
}
