'use client'
import React, { useState, useEffect, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'
import TemplateEditor from './TemplateEditor'

const DOCUMENT_TYPES = [
    { value: 'order_confirmation', label: 'Order Confirmation' },
    { value: 'invoice', label: 'Official Invoice' },
    { value: 'proforma_invoice', label: 'Proforma Invoice' },
    { value: 'return_rma', label: 'Return (RMA)' },
    { value: 'storno_invoice', label: 'Storno Invoice' },
    { value: 'packing_slip', label: 'Packing Slip' },
    { value: 'delivery_note', label: 'Delivery Note' },
]

const LANGUAGES = [
    { value: 'en', label: 'English' },
    { value: 'sl', label: 'Slovenian' },
    { value: 'de', label: 'German' },
    { value: 'fr', label: 'French' },
    { value: 'it', label: 'Italian' },
    { value: 'es', label: 'Spanish' },
]

const PLACEHOLDERS = {
    common: [
        { key: '{company_name}', label: 'Our Company Name' },
        { key: '{company_address}', label: 'Our Address' },
        { key: '{company_vat}', label: 'Our VAT ID' },
        { key: '{company_bank}', label: 'Our Bank Info (IBAN/SWIFT)' },
        { key: '{order_number}', label: 'Order Number' },
        { key: '{order_date}', label: 'Order Date' },
        { key: '{customer_name}', label: 'Customer Full Name' },
        { key: '{customer_email}', label: 'Customer Email' },
        { key: '{customer_company}', label: 'Customer Company Name' },
        { key: '{customer_vat}', label: 'Customer VAT ID' },
        { key: '{billing_address}', label: 'Full Billing Address' },
        { key: '{shipping_address}', label: 'Full Shipping Address' },
        { key: '{items_table}', label: 'Products Table (Dynamic HTML)' },
        { key: '{subtotal_net}', label: 'Subtotal (Net)' },
        { key: '{vat_total}', label: 'VAT Total Amount' },
        { key: '{shipping_cost}', label: 'Shipping Charge' },
        { key: '{total_amount}', label: 'Grand Total (Gross)' },
        { key: '{payment_method}', label: 'Payment Method Type' },
    ],
    invoice: [
        { key: '{invoice_number}', label: 'Invoice Number' },
        { key: '{invoice_date}', label: 'Invoice Date' },
        { key: '{due_date}', label: 'Payment Due Date' },
        { key: '{tax_exemption_clause}', label: 'Tax Exemption Clause (if any)' },
        { key: '{reverse_charge_note}', label: 'Reverse Charge Message' },
    ],
    rma: [
        { key: '{rma_number}', label: 'RMA Reference' },
        { key: '{return_reason}', label: 'Reason for Return' },
    ],
    delivery: [
        { key: '{tracking_number}', label: 'Tracking Number' },
        { key: '{package_weight}', label: 'Total Weight (kg)' },
        { key: '{carrier_name}', label: 'Logistics Carrier' },
    ]
}

const IframePreview = ({ html }: { html: string }) => {
    const iframeRef = useRef<HTMLIFrameElement>(null)

    useEffect(() => {
        if (iframeRef.current) {
            const doc = iframeRef.current.contentDocument
            if (doc) {
                doc.open()
                doc.write(html)
                doc.close()
            }
        }
    }, [html])

    return (
        <iframe
            ref={iframeRef}
            className="w-full h-full border-0 bg-white"
            title="Template Preview"
        />
    )
}

export default function TemplateManager() {
    const [templates, setTemplates] = useState<any[]>([])
    const [selectedTemplate, setSelectedTemplate] = useState<any>(null)
    const [loading, setLoading] = useState(true)
    const [saving, setSaving] = useState(false)
    const [view, setView] = useState<'edit' | 'preview'>('edit')
    const [translating, setTranslating] = useState(false)
    const containerRef = useRef<HTMLDivElement>(null)

    const supabase = createClient()

    useEffect(() => {
        fetchTemplates()
    }, [])

    async function handleTranslate(targetLang: string) {
        if (!selectedTemplate?.id) return
        if (selectedTemplate.language !== 'en') {
            alert('Translations must be started from an English (EN) template.')
            return
        }

        setTranslating(true)
        try {
            const { translateTemplateAction } = await import('@/app/actions/admin')
            const result = await translateTemplateAction(selectedTemplate.id, targetLang)
            if (result.success) {
                alert(`Template successfully translated to ${targetLang.toUpperCase()}!`)
                await fetchTemplates()
                setSelectedTemplate(result.template)
            }
        } catch (error: any) {
            alert('Translation failed: ' + error.message)
        }
        setTranslating(false)
    }

    async function fetchTemplates() {
        setLoading(true)
        const { data, error } = await supabase
            .from('document_templates')
            .select('*')
            .order('type', { ascending: true })

        if (data) setTemplates(data)
        if (error) console.error('Error fetching templates:', error)
        setLoading(false)
    }

    async function handleSave() {
        if (!selectedTemplate) return
        setSaving(true)

        const { id, created_at, updated_at, ...payload } = selectedTemplate

        const { data, error } = id
            ? await supabase.from('document_templates').update(payload).eq('id', id).select().single()
            : await supabase.from('document_templates').insert([payload]).select().single()

        if (!error && data) {
            alert('Template saved successfully!')
            fetchTemplates()
            setSelectedTemplate(data)
        } else {
            alert('Save failed: ' + error?.message)
        }
        setSaving(false)
    }

    function createNew() {
        setSelectedTemplate({
            type: 'invoice',
            name: 'New Template',
            language: 'en',
            content_html: '<h1>Template Title</h1><p>Start editing...</p>',
            is_active: true,
            is_default: false
        })
    }

    const currentPlaceholders = [
        ...PLACEHOLDERS.common,
        ...(selectedTemplate?.type === 'invoice' || selectedTemplate?.type === 'proforma_invoice' || selectedTemplate?.type === 'storno_invoice' ? PLACEHOLDERS.invoice : []),
        ...(selectedTemplate?.type === 'return_rma' ? PLACEHOLDERS.rma : []),
        ...(selectedTemplate?.type === 'packing_slip' || selectedTemplate?.type === 'delivery_note' ? PLACEHOLDERS.delivery : [])
    ]

    return (
        <div ref={containerRef} className="bg-white rounded-xl shadow-md border border-gray-100 overflow-hidden min-h-[700px] flex flex-col">
            {/* Toolbar */}
            <div className="p-4 border-b bg-gray-50 flex justify-between items-center">
                <div className="flex items-center gap-4">
                    <h3 className="text-lg font-bold text-gray-800">Document Templates</h3>
                    <select
                        className="border rounded px-2 py-1 text-sm outline-none"
                        onChange={(e) => {
                            const t = templates.find(temp => temp.id === e.target.value)
                            if (t) setSelectedTemplate(t)
                        }}
                        value={selectedTemplate?.id || ''}
                    >
                        <option value="">Select a template...</option>
                        {templates.map(t => (
                            <option key={t.id} value={t.id}>{t.type.toUpperCase()} ({t.language.toUpperCase()}) - {t.name}</option>
                        ))}
                    </select>
                    <button
                        onClick={createNew}
                        className="text-sm bg-blue-50 text-blue-600 px-3 py-1 rounded border border-blue-200 hover:bg-blue-100 font-medium"
                    >
                        + Create New
                    </button>
                </div>

                {selectedTemplate && (
                    <div className="flex gap-2">
                        <button
                            onClick={() => setView(view === 'edit' ? 'preview' : 'edit')}
                            className="text-sm font-bold text-gray-600 hover:text-gray-900 px-3 py-1"
                        >
                            {view === 'edit' ? '👁️ Preview' : '✏️ Back to Editor'}
                        </button>
                        <button
                            onClick={handleSave}
                            disabled={saving}
                            className="bg-green-600 text-white px-4 py-1.5 rounded text-sm font-bold hover:bg-green-700 disabled:opacity-50"
                        >
                            {saving ? 'Saving...' : 'Save Template'}
                        </button>
                    </div>
                )}
            </div>

            {loading ? (
                <div className="flex-1 flex items-center justify-center text-gray-400 italic">
                    Loading templates...
                </div>
            ) : !selectedTemplate ? (
                <div className="flex-1 flex items-center justify-center text-gray-400 bg-gray-50/20">
                    <div className="text-center">
                        <div className="text-4xl mb-4">📄</div>
                        <p>Select an existing template or create a new one to begin.</p>
                    </div>
                </div>
            ) : (
                <div className="flex-1 flex overflow-hidden">
                    {/* Sidebar Configuration */}
                    <div className="w-72 border-r bg-gray-50/30 p-4 space-y-6 overflow-y-auto">
                        <section className="space-y-3">
                            <h4 className="text-xs font-bold text-gray-500 uppercase tracking-widest">Metadata</h4>
                            <div className="space-y-4">
                                <div>
                                    <label className="block text-[10px] font-bold text-gray-400 uppercase mb-1">Display Name</label>
                                    <input
                                        className="w-full border rounded px-2 py-1.5 text-sm"
                                        value={selectedTemplate.name}
                                        onChange={(e) => setSelectedTemplate({ ...selectedTemplate, name: e.target.value })}
                                    />
                                </div>
                                <div className="grid grid-cols-2 gap-2">
                                    <div>
                                        <label className="block text-[10px] font-bold text-gray-400 uppercase mb-1">Type</label>
                                        <select
                                            className="w-full border rounded px-1 py-1.5 text-xs"
                                            value={selectedTemplate.type}
                                            onChange={(e) => setSelectedTemplate({ ...selectedTemplate, type: e.target.value })}
                                        >
                                            {DOCUMENT_TYPES.map(d => <option key={d.value} value={d.value}>{d.label}</option>)}
                                        </select>
                                    </div>
                                    <div>
                                        <label className="block text-[10px] font-bold text-gray-400 uppercase mb-1">Lang</label>
                                        <select
                                            className="w-full border rounded px-1 py-1.5 text-xs"
                                            value={selectedTemplate.language}
                                            onChange={(e) => setSelectedTemplate({ ...selectedTemplate, language: e.target.value })}
                                        >
                                            {LANGUAGES.map(l => <option key={l.value} value={l.value}>{l.label}</option>)}
                                        </select>
                                    </div>
                                </div>
                                <div className="flex items-center gap-2">
                                    <input
                                        type="checkbox"
                                        id="is_default"
                                        checked={selectedTemplate.is_default}
                                        onChange={(e) => setSelectedTemplate({ ...selectedTemplate, is_default: e.target.checked })}
                                    />
                                    <label htmlFor="is_default" className="text-xs font-semibold text-gray-700">Set as System Default</label>
                                </div>
                                {selectedTemplate.language === 'en' && selectedTemplate.id && (
                                    <div className="pt-4 border-t border-gray-100">
                                        <label className="block text-[10px] font-bold text-gray-400 uppercase mb-2">Auto-Translate to</label>
                                        <div className="flex flex-wrap gap-1.5">
                                            {LANGUAGES.filter(l => l.value !== 'en').map(lang => (
                                                <button
                                                    key={lang.value}
                                                    onClick={() => handleTranslate(lang.value)}
                                                    disabled={translating}
                                                    className="px-2 py-1 bg-white border border-gray-200 rounded text-[10px] font-bold text-gray-600 hover:border-blue-400 hover:text-blue-600 transition-colors disabled:opacity-50"
                                                >
                                                    {translating ? '...' : lang.value.toUpperCase()}
                                                </button>
                                            ))}
                                        </div>
                                        <p className="mt-1 text-[8px] text-gray-400 italic">Always translates from current English source.</p>
                                    </div>
                                )}
                            </div>
                        </section>

                        <section className="space-y-3">
                            <h4 className="text-xs font-bold text-gray-500 uppercase tracking-widest">Available Placeholders</h4>
                            <p className="text-[10px] text-gray-400 italic">Click key to copy placeholder. Use them anywhere in the text.</p>
                            <div className="flex flex-col gap-1.5">
                                {currentPlaceholders.map(p => (
                                    <button
                                        key={p.key}
                                        draggable
                                        onDragStart={(e) => {
                                            e.dataTransfer.setData('text/plain', p.key)
                                            e.dataTransfer.effectAllowed = 'copy'
                                        }}
                                        onClick={() => {
                                            navigator.clipboard.writeText(p.key)
                                        }}
                                        className="text-left group cursor-grab active:cursor-grabbing hover:bg-blue-50/50 p-1 rounded transition-colors"
                                    >
                                        <div className="text-[11px] font-mono text-blue-600 font-bold group-hover:underline">{p.key}</div>
                                        <div className="text-[9px] text-gray-500 uppercase leading-none">{p.label}</div>
                                    </button>
                                ))}
                            </div>
                        </section>
                    </div>

                    {/* Main Content Area */}
                    <div className="flex-1 overflow-hidden p-6 bg-gray-100 flex flex-col">
                        {view === 'edit' ? (
                            <div className="flex-1 flex flex-col overflow-hidden">
                                <TemplateEditor
                                    content={selectedTemplate.content_html}
                                    onChange={(html) => setSelectedTemplate({ ...selectedTemplate, content_html: html })}
                                />
                                <div className="mt-2 text-[10px] text-gray-400 flex justify-between">
                                    <span>Tip: Use tables for layouts like headers or item lists.</span>
                                    <span>Auto-saves on "Save Template" button</span>
                                </div>
                            </div>
                        ) : (
                            <div className="flex-1 overflow-hidden bg-white shadow-inner border rounded">
                                <IframePreview
                                    html={selectedTemplate.content_html
                                        .replace(/\{company_logo\}/g, '/initra-logo.png')
                                        .replace(/\{company_name\}/g, 'Initra Energija d.o.o.')
                                        .replace(/\{company_address\}/g, 'Podsmreka 59A, 1356 Dobrova, SI')
                                        .replace(/\{company_vat\}/g, 'SI 62518313')
                                        .replace(/\{company_email\}/g, 'info@tigoenergy.si')
                                        .replace(/\{company_phone\}/g, '+386 1 542 41 80')
                                        .replace(/\{company_iban_be\}/g, 'BE55 9052 7486 2944')
                                        .replace(/\{company_iban_si\}/g, 'SI56 0000 0000 0000 000')
                                        .replace(/\{company_bic\}/g, 'LJBASI2X')
                                        .replace(/\{place_of_issue\}/g, 'Podsmreka')
                                        .replace(/\{order_number\}/g, 'ORD-2026-X123')
                                        .replace(/\{invoice_number\}/g, 'INV-2026-0001')
                                        .replace(/\{invoice_date\}/g, '2026-03-04')
                                        .replace(/\{due_date\}/g, '2026-03-18')
                                        .replace(/\{reference\}/g, 'SI00 2026-X123')
                                        .replace(/\{customer_name\}/g, 'John Smith Sample')
                                        .replace(/\{customer_company\}/g, 'Sample Solar Solutions')
                                        .replace(/\{customer_vat\}/g, 'SI 99999999')
                                        .replace(/\{billing_address\}/g, 'Dunajska cesta 156, 1000 Ljubljana, Slovenia')
                                        .replace(/\{shipping_address\}/g, 'Verovškova ulica 55, 1000 Ljubljana, Slovenia')
                                        .replace(/\{total_amount\}/g, '€ 1,234.56')
                                        .replace(/\{subtotal_net\}/g, '€ 1,000.00')
                                        .replace(/\{shipping_cost\}/g, '€ 11.93')
                                        .replace(/\{vat_total\}/g, '€ 222.63')
                                        .replace(/\{payment_method\}/g, 'Bank Transfer')
                                        .replace(/\{items_table\}/g, `
                                            <table style="width: 100%; border-collapse: separate; border-spacing: 0; margin-top: 25px; font-size: 10px;">
                                                <thead>
                                                    <tr>
                                                        <th style="background: #f8fafc; color: #64748b; font-weight: 700; text-align: left; padding: 12px; font-size: 8px; text-transform: uppercase; border-bottom: 2px solid #e2e8f0;">No.</th>
                                                        <th style="background: #f8fafc; color: #64748b; font-weight: 700; text-align: left; padding: 12px; font-size: 8px; text-transform: uppercase; border-bottom: 2px solid #e2e8f0;">Product Description</th>
                                                        <th style="background: #f8fafc; color: #64748b; font-weight: 700; text-align: left; padding: 12px; font-size: 8px; text-transform: uppercase; border-bottom: 2px solid #e2e8f0;">Article / Code</th>
                                                        <th style="background: #f8fafc; color: #64748b; font-weight: 700; text-align: center; padding: 12px; font-size: 8px; text-transform: uppercase; border-bottom: 2px solid #e2e8f0;">Qty</th>
                                                        <th style="background: #f8fafc; color: #64748b; font-weight: 700; text-align: right; padding: 12px; font-size: 8px; text-transform: uppercase; border-bottom: 2px solid #e2e8f0;">Net Price</th>
                                                        <th style="background: #f8fafc; color: #64748b; font-weight: 700; text-align: right; padding: 12px; font-size: 8px; text-transform: uppercase; border-bottom: 2px solid #e2e8f0;">Amount</th>
                                                    </tr>
                                                </thead>
                                                <tbody>
                                                    <tr style="background: #ffffff;">
                                                        <td style="padding: 12px; border-bottom: 1px solid #f1f5f9; color: #94a3b8; font-weight: 500;">1</td>
                                                        <td style="padding: 12px; border-bottom: 1px solid #f1f5f9;">
                                                            <div style="font-weight: 700; color: #0f172a; margin-bottom: 2px;">Tigo Optimizer TS4-A-O</div>
                                                            <div style="font-size: 8px; color: #64748b; font-style: italic;">Original Product Specification Applied</div>
                                                        </td>
                                                        <td style="padding: 12px; border-bottom: 1px solid #f1f5f9; font-size: 9px;">
                                                            <div style="color: #475569; font-weight: 500;">TS4-A-O</div>
                                                            <div style="font-size: 8px; color: #94a3b8;">CN Code: 85414300</div>
                                                        </td>
                                                        <td style="padding: 12px; border-bottom: 1px solid #f1f5f9; text-align: center; font-weight: 700; color: #0f172a;">20</td>
                                                        <td style="padding: 12px; border-bottom: 1px solid #f1f5f9; text-align: right; color: #475569; font-weight: 500;">€ 50.00</td>
                                                        <td style="padding: 12px; border-bottom: 1px solid #f1f5f9; text-align: right; font-weight: 800; color: #0f172a;">€ 1,000.00</td>
                                                    </tr>
                                                </tbody>
                                            </table>
                                        `)}
                                />
                            </div>
                        )}
                    </div>
                </div>
            )}

            {/* Document Mapping Summary Section */}
            {!loading && templates.length > 0 && (
                <div className="p-8 border-t bg-white">
                    <div className="flex justify-between items-end mb-6">
                        <div>
                            <h3 className="text-xl font-bold text-gray-800">Document Mapping</h3>
                            <p className="text-sm text-gray-500">Overview of which templates are "pinned" as System Defaults for each document type.</p>
                        </div>
                        <div className="text-[10px] font-bold text-blue-600 bg-blue-50 px-2 py-1 rounded">
                            ACTIVE MAPPINGS: {templates.filter(t => t.is_default).length}
                        </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                        {DOCUMENT_TYPES.map(docType => {
                            return (
                                <div key={docType.value} className="border rounded-xl p-4 bg-gray-50/50 hover:bg-gray-50 transition-colors">
                                    <h4 className="text-xs font-black text-gray-400 uppercase tracking-tighter mb-3 border-b pb-2">{docType.label}</h4>
                                    <div className="space-y-2">
                                        {['en', 'sl'].map(langCode => {
                                            const pinned = templates.find(t => t.type === docType.value && t.language === langCode && t.is_default)
                                            return (
                                                <div key={langCode} className="flex items-center justify-between group">
                                                    <span className="text-[10px] font-bold text-gray-500 uppercase">{langCode}</span>
                                                    {pinned ? (
                                                        <button
                                                            onClick={() => {
                                                                setSelectedTemplate(pinned)
                                                                containerRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
                                                            }}
                                                            className="text-xs text-blue-600 hover:text-blue-800 font-semibold flex items-center gap-1 max-w-[150px] truncate"
                                                            title={pinned.name}
                                                        >
                                                            <span className="w-1.5 h-1.5 bg-green-500 rounded-full shrink-0" />
                                                            <span className="truncate">{pinned.name}</span>
                                                        </button>
                                                    ) : (
                                                        <span className="text-[10px] text-gray-300 italic">No default pinned</span>
                                                    )}
                                                </div>
                                            )
                                        })}
                                    </div>
                                </div>
                            )
                        })}
                    </div>
                </div>
            )}

            {/* Template Repository */}
            {!loading && templates.length > 0 && (
                <div className="p-6 border-t bg-gray-50/50">
                    <h4 className="text-xs font-bold text-gray-500 uppercase tracking-widest mb-4">Existing Templates Repository</h4>
                    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-3">
                        {templates.map(t => (
                            <button
                                key={t.id}
                                onClick={() => {
                                    setSelectedTemplate(t)
                                    containerRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
                                }}
                                className={`text-left p-3 rounded-lg border transition-all hover:shadow-md ${selectedTemplate?.id === t.id ? 'bg-blue-50 border-blue-200 ring-2 ring-blue-100' : 'bg-white border-gray-200 hover:border-blue-300'}`}
                            >
                                <div className="flex justify-between items-start mb-1">
                                    <span className="text-[9px] font-bold text-gray-400 uppercase leading-none">{t.type.replace('_', ' ')}</span>
                                    <span className="text-[9px] px-1 bg-gray-100 rounded text-gray-500 font-mono leading-none tracking-tighter">{t.language.toUpperCase()}</span>
                                </div>
                                <div className="text-xs font-bold text-gray-800 line-clamp-1 truncate">{t.name}</div>
                                {t.is_default && (
                                    <div className="mt-1 text-[8px] text-green-600 font-bold uppercase tracking-widest flex items-center gap-1">
                                        <span className="w-1 h-1 bg-green-500 rounded-full" /> System Default
                                    </div>
                                )}
                            </button>
                        ))}
                    </div>
                </div>
            )}
        </div>
    )
}
