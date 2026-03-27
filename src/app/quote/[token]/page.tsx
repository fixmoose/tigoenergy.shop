'use client'

import React, { useState, useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'

interface QuoteData {
    id: string
    quote_number: string
    token: string
    customer_email: string
    company_name: string | null
    shipping_address: any
    subtotal: number
    shipping_cost: number
    vat_rate: number
    vat_amount: number
    total: number
    language: string
    status: string
    expires_at: string
    items: {
        id: string
        product_name: string
        sku: string
        quantity: number
        unit_price: number
        total_price: number
    }[]
}

const LABELS: Record<string, Record<string, string>> = {
    en: {
        title: 'Quote',
        greeting: 'Hello',
        description: 'You have received a quote from Initra Energija. Please review the details and choose how you would like to receive your order.',
        quoteNumber: 'Quote Number',
        date: 'Date',
        validUntil: 'Valid Until',
        product: 'Product',
        qty: 'Qty',
        unitPrice: 'Unit Price',
        total: 'Total',
        subtotal: 'Subtotal',
        shipping: 'Shipping',
        vat: 'VAT',
        grandTotal: 'Total',
        convertTitle: 'Convert Quote to Order?',
        convertDesc: 'Choose your preferred delivery method:',
        optionShipping: 'Delivery to my address',
        optionPickup: 'Pickup in person (Podsmreka, 1356)',
        addressTitle: 'Delivery Address',
        street: 'Street',
        city: 'City',
        postalCode: 'Postal Code',
        country: 'Country',
        acceptBtn: 'Accept Quote & Create Order',
        processing: 'Processing...',
        expired: 'This quote has expired',
        expiredDesc: 'Please contact us for a new quote.',
        alreadyAccepted: 'This quote has already been accepted',
        alreadyAcceptedDesc: 'An order has been created from this quote. Check your email for details.',
        invalid: 'Invalid or expired quote',
        successTitle: 'Order Created!',
        successDesc: 'Your order has been created successfully. You will receive an email with payment details shortly.',
        orderNumber: 'Order Number',
        backToShop: 'Back to Shop',
        contact: 'Questions? Contact us at',
    },
    sl: {
        title: 'Ponudba',
        greeting: 'Pozdravljeni',
        description: 'Prejeli ste ponudbo od Initra Energija. Preglejte podrobnosti in izberite, kako želite prejeti naročilo.',
        quoteNumber: 'Številka ponudbe',
        date: 'Datum',
        validUntil: 'Veljavno do',
        product: 'Izdelek',
        qty: 'Kol.',
        unitPrice: 'Cena/kos',
        total: 'Skupaj',
        subtotal: 'Vmesni znesek',
        shipping: 'Dostava',
        vat: 'DDV',
        grandTotal: 'Skupaj',
        convertTitle: 'Pretvori ponudbo v naročilo?',
        convertDesc: 'Izberite način dostave:',
        optionShipping: 'Dostava na moj naslov',
        optionPickup: 'Lastni prevzem (Podsmreka, 1356)',
        addressTitle: 'Naslov za dostavo',
        street: 'Ulica',
        city: 'Mesto',
        postalCode: 'Poštna številka',
        country: 'Država',
        acceptBtn: 'Sprejmi ponudbo in ustvari naročilo',
        processing: 'Obdelava...',
        expired: 'Ponudba je potekla',
        expiredDesc: 'Kontaktirajte nas za novo ponudbo.',
        alreadyAccepted: 'Ponudba je bila že sprejeta',
        alreadyAcceptedDesc: 'Naročilo je bilo ustvarjeno iz te ponudbe. Preverite e-pošto za podrobnosti.',
        invalid: 'Neveljavna ali potekla ponudba',
        successTitle: 'Naročilo ustvarjeno!',
        successDesc: 'Vaše naročilo je bilo uspešno ustvarjeno. Kmalu boste prejeli e-pošto s podatki za plačilo.',
        orderNumber: 'Številka naročila',
        backToShop: 'Nazaj v trgovino',
        contact: 'Vprašanja? Kontaktirajte nas na',
    },
    hr: {
        title: 'Ponuda',
        greeting: 'Poštovani',
        description: 'Primili ste ponudu od Initra Energija. Pregledajte detalje i odaberite način dostave.',
        quoteNumber: 'Broj ponude',
        date: 'Datum',
        validUntil: 'Vrijedi do',
        product: 'Proizvod',
        qty: 'Kol.',
        unitPrice: 'Cijena/kom',
        total: 'Ukupno',
        subtotal: 'Međuzbroj',
        shipping: 'Dostava',
        vat: 'PDV',
        grandTotal: 'Ukupno',
        convertTitle: 'Pretvori ponudu u narudžbu?',
        convertDesc: 'Odaberite način dostave:',
        optionShipping: 'Dostava na moju adresu',
        optionPickup: 'Osobni preuzimanje (Podsmreka, 1356)',
        addressTitle: 'Adresa za dostavu',
        street: 'Ulica',
        city: 'Grad',
        postalCode: 'Poštanski broj',
        country: 'Država',
        acceptBtn: 'Prihvati ponudu i kreiraj narudžbu',
        processing: 'Obrada...',
        expired: 'Ponuda je istekla',
        expiredDesc: 'Kontaktirajte nas za novu ponudu.',
        alreadyAccepted: 'Ponuda je već prihvaćena',
        alreadyAcceptedDesc: 'Narudžba je kreirana iz ove ponude. Provjerite email za detalje.',
        invalid: 'Nevažeća ili istekla ponuda',
        successTitle: 'Narudžba kreirana!',
        successDesc: 'Vaša narudžba je uspješno kreirana. Uskoro ćete primiti email s detaljima plaćanja.',
        orderNumber: 'Broj narudžbe',
        backToShop: 'Nazad u trgovinu',
        contact: 'Pitanja? Kontaktirajte nas na',
    },
    de: {
        title: 'Angebot',
        greeting: 'Hallo',
        description: 'Sie haben ein Angebot von Initra Energija erhalten. Bitte überprüfen Sie die Details und wählen Sie, wie Sie Ihre Bestellung erhalten möchten.',
        quoteNumber: 'Angebotsnummer',
        date: 'Datum',
        validUntil: 'Gültig bis',
        product: 'Produkt',
        qty: 'Menge',
        unitPrice: 'Stückpreis',
        total: 'Gesamt',
        subtotal: 'Zwischensumme',
        shipping: 'Versand',
        vat: 'MwSt.',
        grandTotal: 'Gesamtbetrag',
        convertTitle: 'Angebot in Bestellung umwandeln?',
        convertDesc: 'Wählen Sie Ihre bevorzugte Liefermethode:',
        optionShipping: 'Lieferung an meine Adresse',
        optionPickup: 'Selbstabholung (Podsmreka, 1356)',
        addressTitle: 'Lieferadresse',
        street: 'Straße',
        city: 'Stadt',
        postalCode: 'PLZ',
        country: 'Land',
        acceptBtn: 'Angebot annehmen & Bestellung erstellen',
        processing: 'Verarbeitung...',
        expired: 'Dieses Angebot ist abgelaufen',
        expiredDesc: 'Bitte kontaktieren Sie uns für ein neues Angebot.',
        alreadyAccepted: 'Dieses Angebot wurde bereits angenommen',
        alreadyAcceptedDesc: 'Eine Bestellung wurde aus diesem Angebot erstellt. Überprüfen Sie Ihre E-Mail für Details.',
        invalid: 'Ungültiges oder abgelaufenes Angebot',
        successTitle: 'Bestellung erstellt!',
        successDesc: 'Ihre Bestellung wurde erfolgreich erstellt. Sie erhalten in Kürze eine E-Mail mit Zahlungsdetails.',
        orderNumber: 'Bestellnummer',
        backToShop: 'Zurück zum Shop',
        contact: 'Fragen? Kontaktieren Sie uns unter',
    },
}

function formatCurrency(amount: number) {
    return new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR' }).format(amount)
}

export default function QuoteAcceptPage() {
    const params = useParams()
    const token = params.token as string

    const [quote, setQuote] = useState<QuoteData | null>(null)
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState('')
    const [delivery, setDelivery] = useState<'shipping' | 'pickup'>('shipping')
    const [address, setAddress] = useState({ street: '', city: '', postal_code: '', country: 'SI' })
    const [submitting, setSubmitting] = useState(false)
    const [success, setSuccess] = useState<{ orderNumber: string } | null>(null)

    useEffect(() => {
        async function loadQuote() {
            try {
                const res = await fetch(`/api/quote/${token}/view`)
                const data = await res.json()
                if (data.success) {
                    setQuote(data.data)
                    // Pre-fill address from quote if available
                    if (data.data.shipping_address) {
                        setAddress({
                            street: data.data.shipping_address.street || '',
                            city: data.data.shipping_address.city || '',
                            postal_code: data.data.shipping_address.postal_code || '',
                            country: data.data.shipping_address.country || 'SI',
                        })
                    }
                } else {
                    setError(data.error || 'Quote not found')
                }
            } catch {
                setError('Failed to load quote')
            }
            setLoading(false)
        }
        loadQuote()
    }, [token])

    const handleAccept = async () => {
        if (delivery === 'shipping' && (!address.street || !address.city || !address.postal_code)) {
            alert(l.addressTitle + ' is required')
            return
        }

        setSubmitting(true)
        try {
            const res = await fetch(`/api/quote/${token}/accept`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    type: delivery,
                    address: delivery === 'shipping' ? address : undefined,
                }),
            })
            const data = await res.json()
            if (data.success) {
                setSuccess({ orderNumber: data.orderNumber })
            } else {
                alert(data.error || 'Failed to accept quote')
            }
        } catch {
            alert('An error occurred. Please try again.')
        }
        setSubmitting(false)
    }

    const lang = quote?.language || 'en'
    const l = LABELS[lang] || LABELS.en

    if (loading) {
        return (
            <div className="min-h-screen bg-gray-50 flex items-center justify-center">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-amber-600" />
            </div>
        )
    }

    if (error) {
        return (
            <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
                <div className="bg-white rounded-2xl shadow-lg p-8 max-w-md text-center">
                    <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
                        <svg className="w-8 h-8 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" /></svg>
                    </div>
                    <h1 className="text-xl font-bold text-gray-900 mb-2">{l.invalid}</h1>
                    <p className="text-gray-500">{error}</p>
                    <p className="mt-4 text-sm text-gray-400">{l.contact} <a href="mailto:support@tigoenergy.shop" className="text-amber-600">support@tigoenergy.shop</a></p>
                </div>
            </div>
        )
    }

    if (success) {
        return (
            <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
                <div className="bg-white rounded-2xl shadow-lg p-8 max-w-md text-center">
                    <div className="w-16 h-16 bg-amber-100 rounded-full flex items-center justify-center mx-auto mb-4">
                        <svg className="w-8 h-8 text-amber-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" /></svg>
                    </div>
                    <h1 className="text-2xl font-bold text-gray-900 mb-2">{l.successTitle}</h1>
                    <p className="text-gray-500 mb-4">{l.successDesc}</p>
                    <div className="bg-amber-50 rounded-lg p-4 mb-6">
                        <div className="text-sm text-amber-700">{l.orderNumber}</div>
                        <div className="text-xl font-bold text-amber-800">{success.orderNumber}</div>
                    </div>
                    <a href="https://tigoenergy.shop" className="inline-block px-6 py-3 bg-amber-600 text-white rounded-lg font-medium hover:bg-amber-700">
                        {l.backToShop}
                    </a>
                </div>
            </div>
        )
    }

    if (!quote) return null

    // Check states
    if (quote.status === 'accepted') {
        return (
            <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
                <div className="bg-white rounded-2xl shadow-lg p-8 max-w-md text-center">
                    <div className="w-16 h-16 bg-amber-100 rounded-full flex items-center justify-center mx-auto mb-4">
                        <svg className="w-8 h-8 text-amber-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" /></svg>
                    </div>
                    <h1 className="text-xl font-bold text-gray-900 mb-2">{l.alreadyAccepted}</h1>
                    <p className="text-gray-500">{l.alreadyAcceptedDesc}</p>
                </div>
            </div>
        )
    }

    const isExpired = new Date(quote.expires_at) < new Date()
    if (isExpired || quote.status === 'expired' || quote.status === 'declined') {
        return (
            <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
                <div className="bg-white rounded-2xl shadow-lg p-8 max-w-md text-center">
                    <div className="w-16 h-16 bg-amber-100 rounded-full flex items-center justify-center mx-auto mb-4">
                        <svg className="w-8 h-8 text-amber-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                    </div>
                    <h1 className="text-xl font-bold text-gray-900 mb-2">{l.expired}</h1>
                    <p className="text-gray-500">{l.expiredDesc}</p>
                    <p className="mt-4 text-sm text-gray-400">{l.contact} <a href="mailto:support@tigoenergy.shop" className="text-amber-600">support@tigoenergy.shop</a></p>
                </div>
            </div>
        )
    }

    const localeStr = lang === 'sl' ? 'sl-SI' : lang === 'hr' ? 'hr-HR' : lang === 'de' ? 'de-DE' : 'en-GB'

    // Recalculate totals based on delivery method (vat_rate stored as percentage e.g. 22)
    const effectiveShipping = delivery === 'pickup' ? 0 : quote.shipping_cost
    const effectiveVat = (quote.subtotal + effectiveShipping) * (quote.vat_rate / 100)
    const effectiveTotal = quote.subtotal + effectiveShipping + effectiveVat

    return (
        <div className="min-h-screen bg-gray-50 py-8 px-4">
            <div className="max-w-3xl mx-auto">
                {/* Header */}
                <div className="text-center mb-8">
                    <img src="https://tigoenergy.shop/tigo-logo-white.png" alt="Initra Energija" className="h-8 mx-auto mb-4 bg-amber-600 px-4 py-2 rounded-lg" />
                    <h1 className="text-3xl font-bold text-gray-900">{l.title} {quote.quote_number}</h1>
                    <p className="text-gray-500 mt-2 max-w-lg mx-auto">{l.description}</p>
                </div>

                {/* Quote Details Card */}
                <div className="bg-white rounded-2xl shadow-sm border overflow-hidden mb-6">
                    {/* Meta */}
                    <div className="bg-gray-50 px-6 py-4 border-b grid grid-cols-3 gap-4 text-sm">
                        <div>
                            <div className="text-gray-400 text-xs uppercase">{l.quoteNumber}</div>
                            <div className="font-bold text-gray-800">{quote.quote_number}</div>
                        </div>
                        <div>
                            <div className="text-gray-400 text-xs uppercase">{l.date}</div>
                            <div className="font-medium text-gray-800">{new Date().toLocaleDateString(localeStr)}</div>
                        </div>
                        <div>
                            <div className="text-gray-400 text-xs uppercase">{l.validUntil}</div>
                            <div className="font-medium text-gray-800">{new Date(quote.expires_at).toLocaleDateString(localeStr)}</div>
                        </div>
                    </div>

                    {/* Items */}
                    <div className="p-6">
                        <table className="w-full text-sm">
                            <thead>
                                <tr className="border-b-2 border-gray-100">
                                    <th className="text-left py-3 text-gray-400 text-xs uppercase">{l.product}</th>
                                    <th className="text-center py-3 text-gray-400 text-xs uppercase w-16">{l.qty}</th>
                                    <th className="text-right py-3 text-gray-400 text-xs uppercase w-24">{l.unitPrice}</th>
                                    <th className="text-right py-3 text-gray-400 text-xs uppercase w-24">{l.total}</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-50">
                                {quote.items.map(item => (
                                    <tr key={item.id}>
                                        <td className="py-3">
                                            <div className="font-medium text-gray-900">{item.product_name}</div>
                                            <div className="text-xs text-gray-400">{item.sku}</div>
                                        </td>
                                        <td className="py-3 text-center text-gray-700">{item.quantity}</td>
                                        <td className="py-3 text-right text-gray-700">{formatCurrency(item.unit_price)}</td>
                                        <td className="py-3 text-right font-medium text-gray-900">{formatCurrency(item.total_price)}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>

                        {/* Totals */}
                        <div className="border-t-2 border-gray-100 mt-4 pt-4 space-y-2">
                            <div className="flex justify-between text-sm">
                                <span className="text-gray-500">{l.subtotal}</span>
                                <span className="font-medium">{formatCurrency(quote.subtotal)}</span>
                            </div>
                            <div className="flex justify-between text-sm">
                                <span className="text-gray-500">{l.shipping}</span>
                                {delivery === 'pickup' ? (
                                    <span className="font-medium text-amber-600 line-through decoration-gray-400">
                                        {quote.shipping_cost > 0 ? formatCurrency(quote.shipping_cost) : formatCurrency(0)}
                                        <span className="no-underline ml-2 font-bold">{formatCurrency(0)}</span>
                                    </span>
                                ) : (
                                    <span className="font-medium">{formatCurrency(quote.shipping_cost)}</span>
                                )}
                            </div>
                            <div className="flex justify-between text-sm">
                                <span className="text-gray-500">{l.vat} ({quote.vat_rate}%)</span>
                                <span className="font-medium">{formatCurrency(effectiveVat)}</span>
                            </div>
                            <div className="flex justify-between text-lg pt-2 border-t">
                                <span className="font-bold text-gray-900">{l.grandTotal}</span>
                                <span className="font-bold text-amber-600">{formatCurrency(effectiveTotal)}</span>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Accept Section */}
                <div className="bg-white rounded-2xl shadow-sm border p-6">
                    <h2 className="text-xl font-bold text-gray-900 mb-2">{l.convertTitle}</h2>
                    <p className="text-gray-500 text-sm mb-6">{l.convertDesc}</p>

                    {/* Delivery Options */}
                    <div className="space-y-3 mb-6">
                        <label className={`flex items-center gap-3 p-4 rounded-xl border-2 cursor-pointer transition-colors ${delivery === 'shipping' ? 'border-amber-500 bg-amber-50' : 'border-gray-200 hover:border-gray-300'}`}>
                            <input type="radio" name="delivery" value="shipping" checked={delivery === 'shipping'} onChange={() => setDelivery('shipping')} className="text-amber-600" />
                            <div>
                                <div className="font-medium text-gray-900">{l.optionShipping}</div>
                            </div>
                        </label>

                        <label className={`flex items-center gap-3 p-4 rounded-xl border-2 cursor-pointer transition-colors ${delivery === 'pickup' ? 'border-amber-500 bg-amber-50' : 'border-gray-200 hover:border-gray-300'}`}>
                            <input type="radio" name="delivery" value="pickup" checked={delivery === 'pickup'} onChange={() => setDelivery('pickup')} className="text-amber-600" />
                            <div>
                                <div className="font-medium text-gray-900">{l.optionPickup}</div>
                            </div>
                        </label>
                    </div>

                    {/* Address Form (only for shipping) */}
                    {delivery === 'shipping' && (
                        <div className="bg-gray-50 rounded-xl p-4 mb-6 space-y-3">
                            <h3 className="font-medium text-gray-800 text-sm">{l.addressTitle}</h3>
                            <input placeholder={l.street} value={address.street} onChange={e => setAddress({ ...address, street: e.target.value })}
                                className="w-full px-3 py-2.5 border rounded-lg text-sm focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 outline-none" />
                            <div className="grid grid-cols-2 gap-3">
                                <input placeholder={l.city} value={address.city} onChange={e => setAddress({ ...address, city: e.target.value })}
                                    className="px-3 py-2.5 border rounded-lg text-sm focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 outline-none" />
                                <input placeholder={l.postalCode} value={address.postal_code} onChange={e => setAddress({ ...address, postal_code: e.target.value })}
                                    className="px-3 py-2.5 border rounded-lg text-sm focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 outline-none" />
                            </div>
                            <input placeholder={l.country} value={address.country} onChange={e => setAddress({ ...address, country: e.target.value.toUpperCase() })}
                                className="w-full px-3 py-2.5 border rounded-lg text-sm focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 outline-none" />
                        </div>
                    )}

                    {/* Accept Button */}
                    <button
                        onClick={handleAccept}
                        disabled={submitting}
                        className="w-full py-4 bg-amber-600 text-white rounded-xl font-bold text-lg hover:bg-amber-700 disabled:opacity-50 transition-colors"
                    >
                        {submitting ? l.processing : l.acceptBtn}
                    </button>

                    <p className="text-center text-xs text-gray-400 mt-4">
                        {l.contact} <a href="mailto:support@tigoenergy.shop" className="text-amber-600">support@tigoenergy.shop</a>
                    </p>
                </div>
            </div>
        </div>
    )
}
