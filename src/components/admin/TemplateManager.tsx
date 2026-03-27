'use client'
import React, { useState, useEffect, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'
import TemplateEditor from './TemplateEditor'
import { applyTemplateTranslation } from '@/lib/template-translations'
import { DOCUMENT_TEMPLATES } from '@/lib/document-templates'

const DOCUMENT_TYPES = [
    { value: 'invoice', label: 'Invoice' },
    { value: 'proforma_invoice', label: 'Proforma' },
    { value: 'storno_invoice', label: 'Storno' },
    { value: 'order_confirmation', label: 'Order Confirm.' },
    { value: 'packing_slip', label: 'Packing Slip' },
    { value: 'delivery_note', label: 'Delivery Note' },
    { value: 'return_rma', label: 'Return (RMA)' },
]

const LANGUAGES = [
    { value: 'en', label: 'English' },
    { value: 'sl', label: 'Slovenian' },
    { value: 'de', label: 'German' },
    { value: 'fr', label: 'French' },
    { value: 'it', label: 'Italian' },
    { value: 'es', label: 'Spanish' },
]

const PLACEHOLDERS = [
    { key: '{company_logo}', label: 'Logo (img src)' },
    { key: '{company_name}', label: 'Company Name' },
    { key: '{company_address}', label: 'Company Address' },
    { key: '{company_vat}', label: 'Company VAT' },
    { key: '{company_email}', label: 'Company Email' },
    { key: '{company_phone}', label: 'Company Phone' },
    { key: '{company_iban_si}', label: 'IBAN — Delavska Hranilnica d.d. Slovenia' },
    { key: '{company_iban_be}', label: 'IBAN — Wise Belgium' },
    { key: '{company_bic_si}', label: 'BIC — Delavska Hranilnica d.d.' },
    { key: '{company_bic_be}', label: 'BIC — Wise' },
    { key: '{place_of_issue}', label: 'Place of Issue' },
    { key: '{invoice_number}', label: 'Invoice / Doc Number' },
    { key: '{storno_number}', label: 'Storno / Credit Number' },
    { key: '{invoice_date}', label: 'Invoice Date' },
    { key: '{due_date}', label: 'Due Date' },
    { key: '{reference}', label: 'Payment Reference' },
    { key: '{dispatch_date}', label: 'Dispatch Date' },
    { key: '{order_number}', label: 'Order Number' },
    { key: '{order_date}', label: 'Order Date' },
    { key: '{customer_name}', label: 'Customer Name' },
    { key: '{customer_email}', label: 'Customer Email' },
    { key: '{customer_company}', label: 'Customer Company' },
    { key: '{customer_vat}', label: 'Customer VAT' },
    { key: '{customer_phone}', label: 'Customer Phone' },
    { key: '{billing_address}', label: 'Billing Address' },
    { key: '{shipping_address}', label: 'Shipping Address' },
    { key: '{items_table}', label: 'Products Table (HTML)' },
    { key: '{subtotal_net}', label: 'Subtotal Net' },
    { key: '{vat_total}', label: 'VAT Total' },
    { key: '{shipping_cost}', label: 'Shipping Cost' },
    { key: '{total_amount}', label: 'Grand Total' },
    { key: '{payment_method}', label: 'Payment Method' },
    { key: '{tracking_number}', label: 'Tracking Number' },
    { key: '{carrier_name}', label: 'Carrier Name' },
    { key: '{rma_number}', label: 'RMA Number' },
    { key: '{return_reason}', label: 'Return Reason' },
]

// ─── Preview sample data ────────────────────────────────────────────────────
const PREVIEW: Record<string, string> = {
    '{company_logo}': '/initra-logo.png',
    '{company_name}': 'Initra Energija d.o.o.',
    '{company_address}': 'Podsmreka 59A, 1356 Dobrova, SI',
    '{company_vat}': 'SI 62518313',
    '{company_email}': 'support@tigoenergy.shop',
    '{company_phone}': '+386 1 542 41 80',
    '{company_iban_si}': 'SI56 6100 0002 8944 371',
    '{company_iban_be}': 'BE55 9052 7486 2944',
    '{company_bic_si}': 'HDELSI22',
    '{company_bic_be}': 'TRWIBEB1XXX',
    '{place_of_issue}': 'Podsmreka',
    '{invoice_number}': 'ETRG-INV-2026-0001',
    '{storno_number}': 'ETRG-STORNO-ETRG-INV-2026-0001',
    '{invoice_date}': '6 Mar 2026',
    '{due_date}': '13 Mar 2026',
    '{reference}': 'SI00 800000',
    '{dispatch_date}': 'Upon payment',
    '{order_number}': 'ETRG-ORD-1741258800000',
    '{order_date}': '6 Mar 2026',
    '{customer_name}': 'Johan Müller',
    '{customer_company}': 'Solar Solutions GmbH',
    '{customer_vat}': 'DE 299 123 456',
    '{customer_email}': 'j.muller@solarsolutions.de',
    '{customer_phone}': '+49 89 12345678',
    '{billing_address}': 'Hauptstraße 12, 80331 München, Germany',
    '{shipping_address}': 'Hauptstraße 12, 80331 München, Germany',
    '{payment_method}': 'Bank Transfer',
    '{subtotal_net}': '€ 1,000.00',
    '{vat_total}': '€ 0.00',
    '{shipping_cost}': '€ 11.93',
    '{total_amount}': '€ 1,011.93',
    '{tracking_number}': 'LT123456789DE',
    '{carrier_name}': 'DHL Express',
    '{rma_number}': 'RMA-2026-001',
    '{return_reason}': 'Defective product — not functioning as described',
    '{items_table}': `<table style="width:100%;border-collapse:collapse;font-size:11px;"><thead><tr style="border-bottom:2px solid #1a2b3c;"><th style="text-align:left;padding:0 0 10px;font-size:9px;font-weight:700;text-transform:uppercase;letter-spacing:2px;color:#9ca3af;width:4%;">No.</th><th style="text-align:left;padding:0 12px 10px;font-size:9px;font-weight:700;text-transform:uppercase;letter-spacing:2px;color:#9ca3af;width:42%;">Description</th><th style="text-align:left;padding:0 12px 10px;font-size:9px;font-weight:700;text-transform:uppercase;letter-spacing:2px;color:#9ca3af;width:18%;">Article / SKU</th><th style="text-align:center;padding:0 0 10px;font-size:9px;font-weight:700;text-transform:uppercase;letter-spacing:2px;color:#9ca3af;width:8%;">Qty</th><th style="text-align:right;padding:0 0 10px;font-size:9px;font-weight:700;text-transform:uppercase;letter-spacing:2px;color:#9ca3af;width:14%;">Unit Price</th><th style="text-align:right;padding:0 0 10px;font-size:9px;font-weight:700;text-transform:uppercase;letter-spacing:2px;color:#9ca3af;width:14%;">Amount</th></tr></thead><tbody><tr style="border-bottom:1px solid #f3f4f6;"><td style="padding:16px 0;color:#d1d5db;font-size:10px;vertical-align:top;">1</td><td style="padding:16px 12px;vertical-align:top;"><div style="font-size:12px;font-weight:600;color:#1a2b3c;">Tigo Optimizer TS4-A-O 700W</div><div style="font-size:9px;color:#9ca3af;margin-top:2px;">CN Code: 85414300</div></td><td style="padding:16px 12px;vertical-align:top;font-size:11px;color:#6b7280;">TS4-A-O-700</td><td style="padding:16px 0;text-align:center;font-size:12px;font-weight:600;color:#1a2b3c;vertical-align:top;">20</td><td style="padding:16px 0;text-align:right;font-size:11px;color:#6b7280;vertical-align:top;">€ 50.00</td><td style="padding:16px 0;text-align:right;font-size:12px;font-weight:700;color:#1a2b3c;vertical-align:top;">€ 1,000.00</td></tr></tbody></table>`,
}

function applyPreview(html: string) {
    let r = html
    for (const [k, v] of Object.entries(PREVIEW)) r = r.split(k).join(v)
    return r
}

// ─── Professional HTML templates (defined in @/lib/document-templates) ──────
const T = DOCUMENT_TEMPLATES


// ─── Iframe preview ──────────────────────────────────────────────────────────
const IframePreview = ({ html }: { html: string }) => {
    const ref = useRef<HTMLIFrameElement>(null)
    useEffect(() => {
        const doc = ref.current?.contentDocument
        if (!doc) return
        doc.open()
        doc.write(applyPreview(html))
        doc.close()
        // Resize iframe to match rendered document height
        const resize = () => {
            if (ref.current && doc.documentElement) {
                const h = doc.documentElement.scrollHeight || doc.body?.scrollHeight || 900
                ref.current.style.height = Math.max(h, 900) + 'px'
            }
        }
        setTimeout(resize, 80)
    }, [html])
    return <iframe ref={ref} className="w-full border-0 bg-white block" style={{ minHeight: 900 }} title="Preview" />
}

// ─── Main Component ──────────────────────────────────────────────────────────
export default function TemplateManager() {
    const [templates, setTemplates] = useState<any[]>([])
    const [selectedType, setSelectedType] = useState('invoice')
    const [language, setLanguage] = useState('en')
    const [editing, setEditing] = useState<any>(null)
    const [loading, setLoading] = useState(true)
    const [saving, setSaving] = useState(false)
    const [view, setView] = useState<'edit' | 'preview'>('edit')
    const [translating, setTranslating] = useState(false)
    const [syncing, setSyncing] = useState(false)
    const supabase = createClient()

    useEffect(() => { fetchTemplates() }, [])

    useEffect(() => {
        if (!loading) loadTemplate(selectedType, language)
    }, [selectedType, language, loading])

    async function fetchTemplates() {
        setLoading(true)
        const { data } = await supabase.from('document_templates').select('*').order('type')
        if (data) setTemplates(data)
        setLoading(false)
    }

    function loadTemplate(type: string, lang: string) {
        const match = templates.find(t => t.type === type && t.language === lang && t.is_default)
            || templates.find(t => t.type === type && t.language === lang)
        if (match) {
            setEditing({ ...match })
        } else {
            // Auto-translate the default English template for non-English languages
            const baseHtml = T[type] || ''
            const content_html = lang !== 'en' ? applyTemplateTranslation(baseHtml, lang) : baseHtml
            setEditing({
                type,
                language: lang,
                name: `${DOCUMENT_TYPES.find(d => d.value === type)?.label} (${lang.toUpperCase()})`,
                content_html,
                is_active: true,
                is_default: true,
            })
        }
    }

    async function handleSave() {
        if (!editing) return
        setSaving(true)
        const { id, created_at, updated_at, ...payload } = editing
        // Unset other defaults for same type+language
        if (payload.is_default) {
            const others = templates.filter(t => t.type === payload.type && t.language === payload.language && t.is_default && t.id !== id)
            for (const t of others) await supabase.from('document_templates').update({ is_default: false }).eq('id', t.id)
        }
        const { data, error } = id
            ? await supabase.from('document_templates').update(payload).eq('id', id).select().single()
            : await supabase.from('document_templates').insert([{ ...payload, is_default: true }]).select().single()
        if (!error && data) {
            await fetchTemplates()
            setEditing(data)
        } else {
            alert('Save failed: ' + error?.message)
        }
        setSaving(false)
    }

    async function handleTranslate(targetLang: string) {
        if (!editing?.id || editing.language !== 'en') {
            alert('Translation must be started from an English template.')
            return
        }
        setTranslating(true)
        try {
            const { translateTemplateAction } = await import('@/app/actions/admin')
            const result = await translateTemplateAction(editing.id, targetLang)
            if (result.success) {
                await fetchTemplates()
                setLanguage(targetLang)
            } else {
                alert('Translation failed')
            }
        } catch (e: any) { alert('Translation failed: ' + e.message) }
        setTranslating(false)
    }

    async function handleSyncToAll() {
        if (!editing?.id || editing.language !== 'en') {
            alert('Sync must be initiated from an English (master) template.')
            return
        }
        if (!confirm('This will overwrite all saved language variants with the current English structure (re-translated). Continue?')) return
        setSyncing(true)
        try {
            const { syncTemplateToAllLanguagesAction } = await import('@/app/actions/admin')
            const result = await syncTemplateToAllLanguagesAction(editing.id)
            await fetchTemplates()
            alert(`Synced to ${result.synced.length} language(s): ${result.synced.join(', ')}`)
        } catch (e: any) { alert('Sync failed: ' + e.message) }
        setSyncing(false)
    }

    const templateExists = !!(templates.find(t => t.type === selectedType && t.language === language))

    return (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden flex flex-col min-h-[700px]">
            {/* Top bar */}
            <div className="flex items-center justify-between px-5 py-3 bg-gray-50 border-b gap-4 flex-wrap">
                <h3 className="text-sm font-bold text-gray-700 uppercase tracking-widest">Document Templates</h3>
                <div className="flex items-center gap-3 flex-wrap">
                    <div className="flex items-center gap-2">
                        <span className="text-xs text-gray-500 font-medium">Language:</span>
                        <select
                            className="border rounded px-2 py-1 text-xs font-medium bg-white"
                            value={language}
                            onChange={e => setLanguage(e.target.value)}
                        >
                            {LANGUAGES.map(l => <option key={l.value} value={l.value}>{l.label}</option>)}
                        </select>
                    </div>
                    {editing && (
                        <>
                            <button
                                onClick={() => setView(v => v === 'edit' ? 'preview' : 'edit')}
                                className="text-xs px-3 py-1.5 border rounded font-medium text-gray-600 hover:bg-gray-100"
                            >
                                {view === 'edit' ? '👁 Preview' : '✏️ Edit'}
                            </button>
                            <button
                                onClick={() => {
                                    if (confirm('Replace current content with the professional default template?')) {
                                        const baseHtml = T[selectedType] || ''
                                        const content_html = language !== 'en' ? applyTemplateTranslation(baseHtml, language) : baseHtml
                                        setEditing({ ...editing, content_html })
                                    }
                                }}
                                className="text-xs px-3 py-1.5 border border-blue-200 rounded font-medium text-blue-600 bg-blue-50 hover:bg-blue-100"
                            >
                                Apply Professional Default
                            </button>
                            {language === 'en' && editing.id && (
                                <>
                                    <div className="relative group">
                                        <button
                                            disabled={translating}
                                            className="text-xs px-3 py-1.5 border border-purple-200 rounded font-medium text-purple-600 bg-purple-50 hover:bg-purple-100 disabled:opacity-50"
                                        >
                                            {translating ? 'Translating…' : 'Create Variant ▾'}
                                        </button>
                                        {!translating && (
                                            <div className="absolute right-0 top-full mt-1 bg-white border rounded shadow-lg z-50 hidden group-hover:block min-w-[160px]">
                                                <div className="px-3 py-1.5 text-[9px] font-bold text-gray-400 uppercase tracking-widest border-b">Translate & save as</div>
                                                {LANGUAGES.filter(l => l.value !== 'en').map(l => (
                                                    <button
                                                        key={l.value}
                                                        onClick={() => handleTranslate(l.value)}
                                                        className="block w-full text-left px-4 py-2 text-xs hover:bg-gray-50"
                                                    >
                                                        {l.label}
                                                    </button>
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                    <button
                                        onClick={handleSyncToAll}
                                        disabled={syncing}
                                        className="text-xs px-3 py-1.5 border border-amber-200 rounded font-medium text-amber-700 bg-amber-50 hover:bg-amber-100 disabled:opacity-50"
                                        title="Re-translate this master template to all saved language variants"
                                    >
                                        {syncing ? 'Syncing…' : 'Sync to All Languages'}
                                    </button>
                                </>
                            )}
                            <button
                                onClick={handleSave}
                                disabled={saving}
                                className="text-xs px-4 py-1.5 bg-slate-900 text-white rounded font-bold hover:bg-slate-700 disabled:opacity-50"
                            >
                                {saving ? 'Saving…' : 'Save Template'}
                            </button>
                        </>
                    )}
                </div>
            </div>

            {/* Document type tabs */}
            <div className="flex border-b bg-white overflow-x-auto">
                {DOCUMENT_TYPES.map(dt => {
                    const exists = templates.find(t => t.type === dt.value && t.language === language && t.is_default)
                        || templates.find(t => t.type === dt.value && t.language === language)
                    const isSelected = selectedType === dt.value
                    return (
                        <button
                            key={dt.value}
                            onClick={() => setSelectedType(dt.value)}
                            className={`flex items-center gap-1.5 px-4 py-2.5 text-xs font-semibold whitespace-nowrap border-b-2 transition-colors ${isSelected
                                ? 'border-slate-900 text-slate-900 bg-white'
                                : 'border-transparent text-gray-500 hover:text-gray-700 hover:bg-gray-50'
                                }`}
                        >
                            <span className={`w-1.5 h-1.5 rounded-full ${exists ? 'bg-amber-500' : 'bg-gray-300'}`} />
                            {dt.label}
                        </button>
                    )
                })}
            </div>

            {loading ? (
                <div className="flex-1 flex items-center justify-center text-gray-400 text-sm">Loading templates…</div>
            ) : !editing ? null : (
                <div className="flex-1 flex overflow-hidden" style={{ minHeight: 600 }}>
                    {/* Sidebar */}
                    <div className="w-56 border-r bg-gray-50/40 flex flex-col overflow-y-auto shrink-0">
                        {/* Template name + default toggle */}
                        <div className="p-4 border-b space-y-3">
                            <div>
                                <label className="block text-[10px] font-bold text-gray-400 uppercase mb-1">Template Name</label>
                                <input
                                    className="w-full border rounded px-2 py-1 text-xs"
                                    value={editing.name}
                                    onChange={e => setEditing({ ...editing, name: e.target.value })}
                                />
                            </div>
                            <label className="flex items-center gap-2 cursor-pointer">
                                <input
                                    type="checkbox"
                                    checked={editing.is_default}
                                    onChange={e => setEditing({ ...editing, is_default: e.target.checked })}
                                />
                                <span className="text-xs font-semibold text-gray-700">Set as Default</span>
                            </label>
                            {!templateExists && (
                                <div className="text-[10px] text-amber-600 bg-amber-50 border border-amber-200 rounded px-2 py-1">
                                    No saved template for {language.toUpperCase()} — save to create one.
                                </div>
                            )}
                        </div>

                        {/* Placeholders */}
                        <div className="p-3 flex-1">
                            <div className="text-[10px] font-bold text-gray-400 uppercase mb-2 tracking-widest">Placeholders</div>
                            <p className="text-[9px] text-gray-400 mb-2">Click to copy · Drag into editor</p>
                            <div className="space-y-0.5">
                                {PLACEHOLDERS.map(p => (
                                    <button
                                        key={p.key}
                                        draggable
                                        onDragStart={e => { e.dataTransfer.setData('text/plain', p.key); e.dataTransfer.effectAllowed = 'copy' }}
                                        onClick={() => navigator.clipboard.writeText(p.key)}
                                        className="w-full text-left group hover:bg-blue-50/50 px-1 py-0.5 rounded transition-colors"
                                        title={p.key}
                                    >
                                        <div className="text-[10px] font-mono text-blue-600 font-bold truncate group-hover:underline">{p.key}</div>
                                        <div className="text-[8px] text-gray-400 uppercase leading-none">{p.label}</div>
                                    </button>
                                ))}
                            </div>
                        </div>
                    </div>

                    {/* Editor / Preview */}
                    <div className="flex-1 overflow-hidden flex flex-col bg-gray-100 p-4">
                        {view === 'edit' ? (
                            <TemplateEditor
                                content={editing.content_html}
                                onChange={html => setEditing({ ...editing, content_html: html })}
                            />
                        ) : (
                            <div className="flex-1 bg-white border rounded shadow-inner overflow-y-auto">
                                <IframePreview html={editing.content_html} />
                            </div>
                        )}
                    </div>
                </div>
            )}
        </div>
    )
}
