import React from 'react'
import { Document, Page, Text, View, StyleSheet } from '@react-pdf/renderer'
import type { Order, OrderItem } from '@/types/database'

const styles = StyleSheet.create({
    page: { flexDirection: 'column', backgroundColor: '#FFFFFF', padding: 40, fontSize: 10, fontFamily: 'Helvetica' },
    header: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 30, borderBottomWidth: 1, borderBottomColor: '#EEEEEE', paddingBottom: 20 },
    logoContainer: { width: 150 },
    addressContainer: { textAlign: 'right', color: '#666666', lineHeight: 1.4 },
    companyTitle: { fontSize: 16, fontWeight: 'bold', color: '#111111', marginBottom: 5 },

    detailsContainer: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 30 },
    sectionTitle: { fontSize: 8, fontWeight: 'bold', color: '#999999', letterSpacing: 1, marginBottom: 5 },
    infoText: { fontSize: 10, color: '#333333', lineHeight: 1.4 },

    table: { marginTop: 10 },
    tableHeader: { flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: '#EEEEEE', backgroundColor: '#F9FAFB', padding: 6, fontWeight: 'bold' },
    tableRow: { flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: '#F3F4F6', padding: 6, minHeight: 40, alignItems: 'center' },
    colSku: { width: '20%' },
    colDesc: { width: '65%' },
    colQty: { width: '15%', textAlign: 'center' },

    footer: { marginTop: 50, borderTopWidth: 1, borderTopColor: '#EEEEEE', paddingTop: 20, textAlign: 'center', color: '#888888', fontSize: 8 },
    packingLabel: {
        position: 'absolute',
        top: 20,
        right: 40,
        fontSize: 20,
        fontWeight: 'bold',
        color: '#EEEEEE',
        transform: 'rotate(-5deg)',
    }
})

const PACKING_LABELS: Record<string, Record<string, string>> = {
    en: {
        title: 'Packing Slip',
        shipTo: 'Ship To',
        orderInfo: 'Order Information',
        orderNumber: 'Order #',
        date: 'Order Date',
        sku: 'SKU',
        description: 'Product Description',
        qty: 'Quantity',
        thankYou: 'Thank you for your order! Please check all items upon arrival.',
        contact: 'For support, contact support@tigoenergy.com'
    },
    de: {
        title: 'Lieferschein',
        shipTo: 'Lieferadresse',
        orderInfo: 'Bestellinformationen',
        orderNumber: 'Bestell-Nr.',
        date: 'Bestelldatum',
        sku: 'Art.-Nr.',
        description: 'Produktbeschreibung',
        qty: 'Menge',
        thankYou: 'Vielen Dank für Ihre Bestellung! Bitte prüfen Sie alle Artikel bei Erhalt.',
        contact: 'Bei Fragen kontaktieren Sie uns unter support@tigoenergy.com'
    },
    sl: {
        title: 'Dobavnica',
        shipTo: 'Naslov za dostavo',
        orderInfo: 'Informacije o naročilu',
        orderNumber: 'Naročilo št.',
        date: 'Datum naročila',
        sku: 'Šifra',
        description: 'Opis izdelka',
        qty: 'Količina',
        thankYou: 'Hvala za vaše naročilo! Prosimo, da ob prevzemu preverite vse izdelke.',
        contact: 'Za podporo nas kontaktirajte na support@tigoenergy.com'
    }
}

function getLabels(lang: string) {
    return PACKING_LABELS[lang] || PACKING_LABELS.en
}

interface PackingSlipProps {
    order: Order
    items: OrderItem[]
    language?: string
}

export const PackingSlipDocument = ({ order, items, language }: PackingSlipProps) => {
    const l = getLabels(language || (order as any).language || 'en')
    const shipAddr = order.shipping_address || {}

    return (
        <Document title={`Packing Slip #${order.order_number}`}>
            <Page size="A4" style={styles.page}>
                <Text style={styles.packingLabel}>PACKING SLIP</Text>

                {/* Header */}
                <View style={styles.header}>
                    <View style={styles.logoContainer}>
                        <Text style={[styles.companyTitle, { color: '#458400' }]}>TIGO ENERGY</Text>
                        <Text style={{ fontSize: 9, color: '#666' }}>{l.title}</Text>
                    </View>
                    <View style={styles.addressContainer}>
                        <Text>Initra Energija d.o.o.</Text>
                        <Text>Podsmreka 59A</Text>
                        <Text>1356 Dobrova, Slovenia</Text>
                    </View>
                </View>

                {/* Info Section */}
                <View style={styles.detailsContainer}>
                    <View>
                        <Text style={styles.sectionTitle}>{l.shipTo}</Text>
                        <Text style={styles.infoText}>{shipAddr.first_name} {shipAddr.last_name}</Text>
                        {shipAddr.company && <Text style={styles.infoText}>{shipAddr.company}</Text>}
                        <Text style={styles.infoText}>{shipAddr.street}</Text>
                        <Text style={styles.infoText}>{shipAddr.postal_code} {shipAddr.city}</Text>
                        <Text style={styles.infoText}>{shipAddr.country}</Text>
                    </View>
                    <View style={{ textAlign: 'right' }}>
                        <Text style={styles.sectionTitle}>{l.orderInfo}</Text>
                        <Text style={styles.infoText}>{l.orderNumber}: {order.order_number}</Text>
                        <Text style={styles.infoText}>{l.date}: {new Date(order.created_at || '').toLocaleDateString()}</Text>
                        <Text style={styles.infoText}>Carrier: {order.shipping_carrier || 'Standard'}</Text>
                    </View>
                </View>

                {/* Items Table */}
                <View style={styles.table}>
                    <View style={styles.tableHeader}>
                        <Text style={styles.colSku}>{l.sku}</Text>
                        <Text style={styles.colDesc}>{l.description}</Text>
                        <Text style={styles.colQty}>{l.qty}</Text>
                    </View>

                    {items.map((item) => (
                        <View key={item.id} style={styles.tableRow}>
                            <Text style={styles.colSku}>{item.sku}</Text>
                            <Text style={styles.colDesc}>{item.product_name}</Text>
                            <Text style={styles.colQty}>{item.quantity}</Text>
                        </View>
                    ))}
                </View>

                {/* Notes Section if needed */}
                <View style={{ marginTop: 40, padding: 10, borderStyle: 'dashed', borderWidth: 1, borderColor: '#EEEEEE' }}>
                    <Text style={[styles.sectionTitle, { marginBottom: 10 }]}>Shipping Notes</Text>
                    <Text style={styles.infoText}>{order.customer_notes || 'No special instructions.'}</Text>
                </View>

                {/* Footer */}
                <View style={styles.footer}>
                    <Text style={{ marginBottom: 4 }}>{l.thankYou}</Text>
                    <Text>{l.contact}</Text>
                </View>
            </Page>
        </Document>
    )
}
