import React from 'react'
import { Document, Page, Text, View, StyleSheet, Font } from '@react-pdf/renderer'

// Define styles
const styles = StyleSheet.create({
    page: {
        padding: 40,
        fontSize: 10,
        fontFamily: 'Helvetica',
        color: '#334155',
    },
    header: {
        marginBottom: 20,
        borderBottomWidth: 1,
        borderStyle: 'solid',
        borderBottomColor: '#e2e8f0',
        paddingBottom: 10,
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
    },
    title: {
        fontSize: 18,
        fontWeight: 'bold',
        color: '#1e293b',
    },
    subtitle: {
        fontSize: 10,
        color: '#64748b',
        marginTop: 4,
    },
    summarySection: {
        flexDirection: 'row',
        marginBottom: 20,
        gap: 15,
    },
    summaryCard: {
        flex: 1,
        padding: 10,
        backgroundColor: '#f8fafc',
        borderRadius: 4,
        borderWidth: 1,
        borderStyle: 'solid',
        borderColor: '#f1f5f9',
    },
    summaryLabel: {
        fontSize: 8,
        color: '#64748b',
        marginBottom: 4,
    },
    summaryValue: {
        fontSize: 12,
        fontWeight: 'bold',
        color: '#0f172a',
    },
    table: {
        display: 'flex',
        width: 'auto',
    },
    tableRow: {
        margin: 'auto',
        flexDirection: 'row',
        borderBottomColor: '#f1f5f9',
        borderBottomWidth: 1,
        borderStyle: 'solid',
        minHeight: 25,
        alignItems: 'center',
    },
    tableHeader: {
        backgroundColor: '#f8fafc',
        borderBottomColor: '#e2e8f0',
        borderBottomWidth: 1,
        borderStyle: 'solid',
    },
    tableCol: {
        padding: 5,
    },
    colOrder: { width: '15%' },
    colDate: { width: '12%' },
    colCustomer: { width: '35%' },
    colStatus: { width: '13%' },
    colAmount: { width: '15%', textAlign: 'right' },
    colInvoice: { width: '10%', textAlign: 'center' },

    headerText: {
        fontSize: 8,
        fontWeight: 'bold',
        color: '#475569',
    },
    footer: {
        position: 'absolute',
        bottom: 30,
        left: 40,
        right: 40,
        textAlign: 'center',
        fontSize: 8,
        color: '#94a3b8',
        borderTopWidth: 1,
        borderStyle: 'solid',
        borderTopColor: '#f1f5f9',
        paddingTop: 10,
    }
})

interface AccountingReportPDFProps {
    orders: any[]
    summary: {
        totalRevenue: number
        totalInvoices: number
        totalOutstanding: number
    }
    period: string
}

export const AccountingReportPDF = ({ orders, summary, period }: AccountingReportPDFProps) => {
    const formatCurrency = (amount: number) => {
        return new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR' }).format(amount)
    }

    return (
        <Document>
            <Page size="A4" style={styles.page}>
                {/* Header */}
                <View style={styles.header}>
                    <View>
                        <Text style={styles.title}>Accounting Report</Text>
                        <Text style={styles.subtitle}>Tigo Energy Shop — {period}</Text>
                    </View>
                    <View style={{ textAlign: 'right' }}>
                        <Text style={{ fontSize: 10, fontWeight: 'bold' }}>Tigo Energy SI</Text>
                        <Text style={{ fontSize: 8 }}>Internal Financial Document</Text>
                    </View>
                </View>

                {/* Summary Cards */}
                <View style={styles.summarySection}>
                    <View style={styles.summaryCard}>
                        <Text style={styles.summaryLabel}>Total Monthly Revenue</Text>
                        <Text style={styles.summaryValue}>{formatCurrency(summary.totalRevenue)}</Text>
                    </View>
                    <View style={styles.summaryCard}>
                        <Text style={styles.summaryLabel}>Invoices Generated</Text>
                        <Text style={styles.summaryValue}>{summary.totalInvoices}</Text>
                    </View>
                    <View style={styles.summaryCard}>
                        <Text style={styles.summaryLabel}>Outstanding Receivables</Text>
                        <Text style={styles.summaryValue}>{formatCurrency(summary.totalOutstanding)}</Text>
                    </View>
                </View>

                {/* Table */}
                <View style={styles.table}>
                    <View style={[styles.tableRow, styles.tableHeader]}>
                        <View style={[styles.tableCol, styles.colOrder]}><Text style={styles.headerText}>Order #</Text></View>
                        <View style={[styles.tableCol, styles.colDate]}><Text style={styles.headerText}>Date</Text></View>
                        <View style={[styles.tableCol, styles.colCustomer]}><Text style={styles.headerText}>Customer / Company</Text></View>
                        <View style={[styles.tableCol, styles.colStatus]}><Text style={styles.headerText}>Status</Text></View>
                        <View style={[styles.tableCol, styles.colAmount]}><Text style={styles.headerText}>Amount</Text></View>
                    </View>

                    {orders.map((order, i) => (
                        <View key={i} style={styles.tableRow}>
                            <View style={[styles.tableCol, styles.colOrder]}><Text>{order.order_number}</Text></View>
                            <View style={[styles.tableCol, styles.colDate]}><Text>{new Date(order.created_at).toLocaleDateString()}</Text></View>
                            <View style={[styles.tableCol, styles.colCustomer]}>
                                <Text style={{ fontWeight: 'bold' }}>{order.company_name || 'Individual'}</Text>
                                <Text style={{ fontSize: 7, color: '#64748b' }}>{order.customer_email}</Text>
                            </View>
                            <View style={[styles.tableCol, styles.colStatus]}>
                                <Text style={{ fontSize: 7 }}>{order.status.toUpperCase()}</Text>
                                <Text style={{ fontSize: 7, color: order.payment_status === 'paid' ? '#10b981' : '#f59e0b' }}>
                                    {order.payment_status.toUpperCase()}
                                </Text>
                            </View>
                            <View style={[styles.tableCol, styles.colAmount]}>
                                <Text>{formatCurrency(order.total)}</Text>
                                <Text style={{ fontSize: 6, color: '#94a3b8' }}>VAT: {order.vat_rate}%</Text>
                            </View>
                        </View>
                    ))}
                </View>

                <View style={styles.footer}>
                    <Text>Generated on {new Date().toLocaleString()} • Page 1 of 1</Text>
                    <Text style={{ marginTop: 2 }}>Tigo Energy Shop Administrative Portal</Text>
                </View>
            </Page>
        </Document>
    )
}
