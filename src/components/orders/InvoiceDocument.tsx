import { Document, Page, Text, View, StyleSheet, Image } from '@react-pdf/renderer'
import type { Order, OrderItem } from '@/types/database'

const styles = StyleSheet.create({
    page: { flexDirection: 'column', backgroundColor: '#FFFFFF', padding: 40, fontSize: 10, fontFamily: 'Helvetica' },
    header: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 30, borderBottomWidth: 1, borderStyle: 'solid', borderBottomColor: '#EEEEEE', paddingBottom: 20 },
    logoContainer: { width: 150 },
    addressContainer: { textAlign: 'right', color: '#666666', lineHeight: 1.4 },
    companyTitle: { fontSize: 16, fontWeight: 'bold', color: '#111111', marginBottom: 5 },

    detailsContainer: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 30 },
    sectionTitle: { fontSize: 8, fontWeight: 'bold', color: '#999999', letterSpacing: 1, marginBottom: 5 },
    infoText: { fontSize: 10, color: '#333333', lineHeight: 1.4 },

    table: { marginTop: 10 },
    tableHeader: { flexDirection: 'row', borderBottomWidth: 1, borderStyle: 'solid', borderBottomColor: '#EEEEEE', backgroundColor: '#F9FAFB', padding: 6, fontWeight: 'bold' },
    tableRow: { flexDirection: 'row', borderBottomWidth: 1, borderStyle: 'solid', borderBottomColor: '#F3F4F6', padding: 6, minHeight: 30, alignItems: 'center' },
    colSku: { width: '15%' },
    colDesc: { width: '45%' },
    colQty: { width: '10%', textAlign: 'center' },
    colPrice: { width: '15%', textAlign: 'right' },
    colTotal: { width: '15%', textAlign: 'right' },

    summaryContainer: { marginTop: 20, flexDirection: 'row', justifyContent: 'flex-end' },
    summaryTable: { width: 200 },
    summaryRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 4 },
    summaryText: { color: '#666666' },
    totalRow: { marginTop: 10, borderTopWidth: 1, borderStyle: 'solid', borderTopColor: '#EEEEEE', paddingTop: 10 },
    totalText: { fontSize: 14, fontWeight: 'bold', color: '#458400' },

    legalContainer: { marginTop: 40, borderTopWidth: 1, borderStyle: 'solid', borderTopColor: '#EEEEEE', paddingTop: 20 },
    legalTitle: { fontSize: 9, fontWeight: 'bold', color: '#333333', marginBottom: 5 },
    legalText: { fontSize: 8, color: '#666666', lineHeight: 1.5, marginBottom: 10 },
    complianceBox: { backgroundColor: '#F9FAFB', padding: 10, borderRadius: 4, marginTop: 10 },
    complianceText: { fontSize: 8, color: '#444444', fontWeight: 'bold' },
    bankDetailsBox: { marginTop: 20, padding: 12, backgroundColor: '#F0FDF4', borderLeftWidth: 3, borderStyle: 'solid', borderLeftColor: '#458400' },
    bankDetailsTitle: { fontSize: 9, fontWeight: 'bold', color: '#166534', marginBottom: 4 },
    bankDetailsText: { fontSize: 8, color: '#166534', lineHeight: 1.4 }
})

// ---------------------------------------------------------------------------
// Inline invoice labels per language (react-pdf can't use useTranslations)
// ---------------------------------------------------------------------------
const INVOICE_LABELS: Record<string, Record<string, string>> = {
    en: {
        officialShopInvoice: 'Official Shop Invoice',
        billedTo: 'Billed To',
        invoiceDetails: 'Invoice Details',
        invoiceNumber: 'Invoice #',
        date: 'Date',
        orderNumber: 'Order #',
        payment: 'Payment',
        sku: 'SKU',
        description: 'Description',
        qty: 'Qty',
        price: 'Price',
        total: 'Total',
        subtotalNet: 'Subtotal (Net)',
        vat: 'VAT',
        shipping: 'Shipping',
        policiesWarranty: 'Policies & Warranty',
        returnPolicy: 'Return Policy: We offer a 14-day return policy for all unused items in their original packaging. Please contact support@tigoenergy.com for return authorizations.',
        warranty: 'Warranty: All products listed on this invoice are covered by a 1-year standard limited warranty starting from the date of delivery.',
        legalAgreement: 'Legal Agreement: Customer electronically agreed to the Terms & Conditions on:',
        thankYou: 'Thank you for choosing Tigo Energy. Sustainability is our mission.',
    },
    de: {
        officialShopInvoice: 'Offizielle Shop-Rechnung',
        billedTo: 'Rechnungsempfänger',
        invoiceDetails: 'Rechnungsdetails',
        invoiceNumber: 'Rechnungs-Nr.',
        date: 'Datum',
        orderNumber: 'Bestell-Nr.',
        payment: 'Zahlung',
        sku: 'Art.-Nr.',
        description: 'Beschreibung',
        qty: 'Menge',
        price: 'Preis',
        total: 'Gesamt',
        subtotalNet: 'Zwischensumme (Netto)',
        vat: 'MwSt.',
        shipping: 'Versand',
        policiesWarranty: 'Richtlinien & Garantie',
        returnPolicy: 'Rückgaberecht: Wir bieten ein 14-tägiges Rückgaberecht für alle unbenutzten Artikel in der Originalverpackung. Bitte kontaktieren Sie support@tigoenergy.com für Rücksendegenehmigungen.',
        warranty: 'Garantie: Alle auf dieser Rechnung aufgeführten Produkte sind durch eine 1-jährige Standard-Garantie ab Lieferdatum abgedeckt.',
        legalAgreement: 'Rechtsvereinbarung: Der Kunde hat den Allgemeinen Geschäftsbedingungen elektronisch zugestimmt am:',
        thankYou: 'Vielen Dank, dass Sie sich für Tigo Energy entschieden haben. Nachhaltigkeit ist unsere Mission.',
    },
    fr: {
        officialShopInvoice: 'Facture officielle de la boutique',
        billedTo: 'Facturé à',
        invoiceDetails: 'Détails de la facture',
        invoiceNumber: 'Facture n°',
        date: 'Date',
        orderNumber: 'Commande n°',
        payment: 'Paiement',
        sku: 'Réf.',
        description: 'Description',
        qty: 'Qté',
        price: 'Prix',
        total: 'Total',
        subtotalNet: 'Sous-total (HT)',
        vat: 'TVA',
        shipping: 'Livraison',
        policiesWarranty: 'Politiques & Garantie',
        returnPolicy: "Politique de retour : Nous offrons un retour sous 14 jours pour tous les articles non utilisés dans leur emballage d'origine. Veuillez contacter support@tigoenergy.com pour les autorisations de retour.",
        warranty: "Garantie : Tous les produits figurant sur cette facture sont couverts par une garantie limitée standard d'un an à compter de la date de livraison.",
        legalAgreement: 'Accord juridique : Le client a accepté électroniquement les conditions générales le :',
        thankYou: "Merci d'avoir choisi Tigo Energy. La durabilité est notre mission.",
    },
    it: {
        officialShopInvoice: 'Fattura ufficiale del negozio',
        billedTo: 'Fatturato a',
        invoiceDetails: 'Dettagli fattura',
        invoiceNumber: 'Fattura n.',
        date: 'Data',
        orderNumber: 'Ordine n.',
        payment: 'Pagamento',
        sku: 'Cod.',
        description: 'Descrizione',
        qty: 'Qtà',
        price: 'Prezzo',
        total: 'Totale',
        subtotalNet: 'Subtotale (Netto)',
        vat: 'IVA',
        shipping: 'Spedizione',
        policiesWarranty: 'Politiche e Garanzia',
        returnPolicy: "Politica di reso: Offriamo un reso entro 14 giorni per tutti gli articoli non utilizzati nella confezione originale. Contattare support@tigoenergy.com per le autorizzazioni al reso.",
        warranty: "Garanzia: Tutti i prodotti elencati in questa fattura sono coperti da una garanzia limitata standard di 1 anno dalla data di consegna.",
        legalAgreement: 'Accordo legale: Il cliente ha accettato elettronicamente i Termini e Condizioni il:',
        thankYou: 'Grazie per aver scelto Tigo Energy. La sostenibilità è la nostra missione.',
    },
    sl: {
        officialShopInvoice: 'Uradni račun spletne trgovine',
        billedTo: 'Zaračunano',
        invoiceDetails: 'Podrobnosti računa',
        invoiceNumber: 'Račun št.',
        date: 'Datum',
        orderNumber: 'Naročilo št.',
        payment: 'Plačilo',
        sku: 'Šifra',
        description: 'Opis',
        qty: 'Kol.',
        price: 'Cena',
        total: 'Skupaj',
        subtotalNet: 'Vmesna vsota (Neto)',
        vat: 'DDV',
        shipping: 'Dostava',
        policiesWarranty: 'Politike in garancija',
        returnPolicy: 'Politika vračil: Ponujamo 14-dnevno politiko vračil za vse neuporabljene izdelke v originalni embalaži. Za odobritve vračil kontaktirajte support@tigoenergy.com.',
        warranty: 'Garancija: Vsi izdelki na tem računu so zajeti z 1-letno standardno omejeno garancijo od datuma dostave.',
        legalAgreement: 'Pravni dogovor: Stranka je elektronsko sprejela Splošne pogoje dne:',
        thankYou: 'Hvala, ker ste izbrali Tigo Energy. Trajnost je naše poslanstvo.',
    },
    es: {
        officialShopInvoice: 'Factura oficial de la tienda',
        billedTo: 'Facturado a',
        invoiceDetails: 'Detalles de factura',
        invoiceNumber: 'Factura n.º',
        date: 'Fecha',
        orderNumber: 'Pedido n.º',
        payment: 'Pago',
        sku: 'Ref.',
        description: 'Descripción',
        qty: 'Cant.',
        price: 'Precio',
        total: 'Total',
        subtotalNet: 'Subtotal (Neto)',
        vat: 'IVA',
        shipping: 'Envío',
        policiesWarranty: 'Políticas y Garantía',
        returnPolicy: 'Política de devolución: Ofrecemos una política de devolución de 14 días para todos los artículos sin usar en su embalaje original. Contacte support@tigoenergy.com para autorizaciones de devolución.',
        warranty: 'Garantía: Todos los productos en esta factura están cubiertos por una garantía limitada estándar de 1 año desde la fecha de entrega.',
        legalAgreement: 'Acuerdo legal: El cliente aceptó electrónicamente los Términos y Condiciones el:',
        thankYou: 'Gracias por elegir Tigo Energy. La sostenibilidad es nuestra misión.',
    },
}

function getLabels(lang: string) {
    return INVOICE_LABELS[lang] || INVOICE_LABELS.en
}

interface InvoiceProps {
    order: Order
    items: OrderItem[]
    termsAgreedAt?: string | null
    language?: string
}

export const InvoiceDocument = ({ order, items, termsAgreedAt, language }: InvoiceProps) => {
    const l = getLabels(language || (order as any).language || 'en')
    const billingAddress = order.billing_address || {}
    const currency = order.currency || 'EUR'

    const formatCurrency = (val: number) => `${currency} ${val.toFixed(2)}`

    return (
        <Document title={`Invoice #${order.order_number}`}>
            <Page size="A4" style={styles.page}>
                {/* Header */}
                <View style={styles.header}>
                    <View style={styles.logoContainer}>
                        <Text style={[styles.companyTitle, { color: '#458400' }]}>TIGO ENERGY</Text>
                        <Text style={{ fontSize: 9, color: '#666' }}>{l.officialShopInvoice}</Text>
                    </View>
                    <View style={styles.addressContainer}>
                        <Text>Initra Energija d.o.o.</Text>
                        <Text>Podsmreka 59A</Text>
                        <Text>1356 Dobrova, Slovenia</Text>
                        <Text>VAT ID: SI12345678</Text>
                    </View>
                </View>

                {/* Info Section */}
                <View style={styles.detailsContainer}>
                    <View>
                        <Text style={styles.sectionTitle}>{l.billedTo}</Text>
                        <Text style={styles.infoText}>{billingAddress.first_name} {billingAddress.last_name}</Text>
                        {billingAddress.company && <Text style={styles.infoText}>{billingAddress.company}</Text>}
                        <Text style={styles.infoText}>{billingAddress.street}</Text>
                        <Text style={styles.infoText}>{billingAddress.postal_code} {billingAddress.city}</Text>
                        <Text style={styles.infoText}>{billingAddress.country}</Text>
                    </View>
                    <View style={{ textAlign: 'right' }}>
                        <Text style={styles.sectionTitle}>{l.invoiceDetails}</Text>
                        <Text style={styles.infoText}>{l.invoiceNumber}: {order.invoice_number || order.order_number}</Text>
                        <Text style={styles.infoText}>{l.date}: {new Date(order.created_at || '').toLocaleDateString()}</Text>
                        <Text style={styles.infoText}>{l.orderNumber}: {order.order_number}</Text>
                        <Text style={styles.infoText}>{l.payment}: {order.payment_method?.replace(/_/g, ' ').toUpperCase()}</Text>
                    </View>
                </View>

                {/* Table Header */}
                <View style={styles.table}>
                    <View style={styles.tableHeader}>
                        <Text style={styles.colSku}>{l.sku}</Text>
                        <Text style={styles.colDesc}>{l.description}</Text>
                        <Text style={styles.colQty}>{l.qty}</Text>
                        <Text style={styles.colPrice}>{l.price}</Text>
                        <Text style={styles.colTotal}>{l.total}</Text>
                    </View>

                    {/* Table Rows */}
                    {items.map((item) => (
                        <View key={item.id} style={styles.tableRow}>
                            <Text style={styles.colSku}>{item.sku}</Text>
                            <Text style={styles.colDesc}>{item.product_name}</Text>
                            <Text style={styles.colQty}>{item.quantity}</Text>
                            <View style={styles.colPrice}>
                                {item.b2c_unit_price && item.b2c_unit_price > item.unit_price && (
                                    <Text style={{ fontSize: 7, textDecoration: 'line-through', color: '#999', marginBottom: 2 }}>
                                        {formatCurrency(item.b2c_unit_price)}
                                    </Text>
                                )}
                                <Text>{formatCurrency(item.unit_price)}</Text>
                            </View>
                            <Text style={styles.colTotal}>{formatCurrency(item.total_price)}</Text>
                        </View>
                    ))}
                </View>

                {/* Summary */}
                <View style={styles.summaryContainer}>
                    <View style={styles.summaryTable}>
                        <View style={styles.summaryRow}>
                            <Text style={styles.summaryText}>{l.subtotalNet}</Text>
                            <Text>{formatCurrency(order.subtotal)}</Text>
                        </View>
                        <View style={styles.summaryRow}>
                            <Text style={styles.summaryText}>{l.vat} ({((order.vat_rate || 0.19) * 100).toFixed(0)}%)</Text>
                            <Text>{formatCurrency(order.vat_amount)}</Text>
                        </View>
                        <View style={styles.summaryRow}>
                            <Text style={styles.summaryText}>{l.shipping}</Text>
                            <Text>{formatCurrency(order.shipping_cost)}</Text>
                        </View>
                        <View style={[styles.summaryRow, styles.totalRow]}>
                            <Text style={{ fontWeight: 'bold' }}>TOTAL</Text>
                            <Text style={styles.totalText}>{formatCurrency(order.total)}</Text>
                        </View>
                    </View>
                </View>

                {/* Bank Transfer Instructions */}
                {(order.payment_method === 'invoice' || order.payment_method === 'bank_transfer' || order.payment_method === 'wise' || order.payment_method === 'iban') && (
                    <View style={{ marginTop: 15, padding: 10, backgroundColor: '#f9fafb', borderRadius: 8, borderWidth: 1, borderStyle: 'solid', borderColor: '#e5e7eb' }}>
                        <Text style={{ fontSize: 10, fontWeight: 'bold', marginBottom: 5, color: '#111827' }}>Payment Instructions (Account: Initra Energija d.o.o.)</Text>

                        <View style={{ flexDirection: 'row', gap: 15 }}>
                            {/* QR Code Section */}
                            <View style={{ width: 80, height: 80, backgroundColor: '#ffffff', padding: 5, borderRadius: 4 }}>
                                <Image src="/wise-qr.png" style={{ width: 70, height: 70 }} />
                            </View>

                            {/* Details Section */}
                            <View style={{ flex: 1 }}>
                                <Text style={{ fontSize: 8, color: '#4b5563', marginBottom: 2 }}>Option 1: Scan QR above with your mobile Banking App or Camera.</Text>
                                <View style={{ borderTopWidth: 0.5, borderTopStyle: 'solid', borderTopColor: '#e5e7eb', marginTop: 4, paddingTop: 4 }}>
                                    <Text style={{ fontSize: 8, color: '#4b5563', marginBottom: 2 }}>Option 2: Use Wise Quick Pay URL (ApplePay, Cards supported):</Text>
                                    <Text style={{ fontSize: 8, color: '#3b82f6', fontWeight: 'bold' }}>
                                        {`https://wise.com/pay/business/initraenergijadoo?reference=${order.order_number}`}
                                    </Text>
                                </View>
                                <View style={{ borderTopWidth: 0.5, borderTopStyle: 'solid', borderTopColor: '#e5e7eb', marginTop: 4, paddingTop: 4 }}>
                                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 1 }}>
                                        <Text style={{ fontSize: 8, color: '#4b5563' }}>Bank:</Text>
                                        <Text style={{ fontSize: 8, fontWeight: 'bold' }}>Wise</Text>
                                    </View>
                                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 1 }}>
                                        <Text style={{ fontSize: 8, color: '#4b5563' }}>IBAN:</Text>
                                        <Text style={{ fontSize: 8, fontWeight: 'bold' }}>BE55 9052 7486 2944</Text>
                                    </View>
                                    <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                                        <Text style={{ fontSize: 8, color: '#4b5563' }}>Reference:</Text>
                                        <Text style={{ fontSize: 8, fontWeight: 'bold' }}>{order.order_number}</Text>
                                    </View>
                                </View>
                            </View>
                        </View>

                        <Text style={{ fontSize: 7, color: '#6b7280', marginTop: 6, fontStyle: 'italic' }}>
                            * Payments via Wise are typically confirmed within minutes. Wire transfers may take 1-2 business days.
                        </Text>
                    </View>
                )}

                {/* Legal & Policies */}
                <View style={styles.legalContainer}>
                    <Text style={styles.legalTitle}>{l.policiesWarranty}</Text>
                    <Text style={styles.legalText}>{l.returnPolicy}</Text>
                    <Text style={styles.legalText}>{l.warranty}</Text>

                    <View style={styles.complianceBox}>
                        <Text style={styles.complianceText}>
                            {l.legalAgreement} {order.terms_agreed_at ? new Date(order.terms_agreed_at).toLocaleString() : (termsAgreedAt ? new Date(termsAgreedAt).toLocaleString() : 'N/A')}.
                        </Text>
                    </View>

                    <View style={{ marginTop: 20 }}>
                        <Text style={{ fontSize: 7, color: '#999', textAlign: 'center' }}>
                            {l.thankYou}
                        </Text>
                    </View>
                </View>
            </Page>
        </Document>
    )
}
