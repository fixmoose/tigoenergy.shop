'use client'
import { useState, useEffect, DragEvent } from 'react'
import { Customer } from '@/types/database'

interface Props {
    customer: Customer
}

type MethodId = 'wise' | 'iban'

interface PaymentDetails {
    connected: boolean
    details?: string
}

interface SepaUpload {
    id: string
    name: string
    type: 'verification' | 'card' | 'statement' | 'mandate'
    date: string
}

interface UploadedDoc {
    id: string
    name: string
    date: string
    status: 'pending' | 'reviewed' | 'rejected'
    customerId?: string
    adminNote?: string
    category?: string
}

export default function PaymentMethods({ customer }: Props) {
    const [enabledMethods, setEnabledMethods] = useState<Record<MethodId, boolean>>({
        wise: false,
        iban: false
    })

    const [preferredMethod, setPreferredMethod] = useState<MethodId | null>(null)

    const [methodDetails, setMethodDetails] = useState<Record<MethodId, PaymentDetails>>({
        wise: { connected: false },
        iban: { connected: false }
    })

    const [modal, setModal] = useState<{ isOpen: boolean, type: MethodId | null }>({ isOpen: false, type: null })
    const [tempInput, setTempInput] = useState('')

    // SEPA Direct Debit state
    const [sepaEnabled, setSepaEnabled] = useState(false)
    const [sepaUploads, setSepaUploads] = useState<SepaUpload[]>([])
    const [sepaForm, setSepaForm] = useState({
        accountHolder: '',
        iban: '',
        bic: ''
    })

    // Drag-and-drop state
    const [dragOver, setDragOver] = useState<SepaUpload['type'] | null>(null)

    useEffect(() => {
        const stored = localStorage.getItem('tigo_payment_prefs')
        if (stored) {
            const data = JSON.parse(stored)
            if (data.enabled) setEnabledMethods(data.enabled)
            if (data.preferred) setPreferredMethod(data.preferred)
            if (data.details) setMethodDetails(data.details)
            if (data.sepaEnabled) setSepaEnabled(data.sepaEnabled)
            if (data.sepaUploads) setSepaUploads(data.sepaUploads)
            if (data.sepaForm) setSepaForm(data.sepaForm)
        }
    }, [])

    const saveState = (enabled: any, preferred: any, details: any, sepa?: boolean, uploads?: SepaUpload[], form?: any) => {
        localStorage.setItem('tigo_payment_prefs', JSON.stringify({
            enabled,
            preferred,
            details,
            sepaEnabled: sepa ?? sepaEnabled,
            sepaUploads: uploads ?? sepaUploads,
            sepaForm: form ?? sepaForm
        }))
    }

    const toggleEnable = (id: MethodId) => {
        const newState = { ...enabledMethods, [id]: !enabledMethods[id] }
        setEnabledMethods(newState)

        let newPreferred = preferredMethod
        if (preferredMethod === id && !newState[id]) {
            newPreferred = null
        }
        setPreferredMethod(newPreferred)
        saveState(newState, newPreferred, methodDetails)

        if (newState[id] && !methodDetails[id].connected) {
            setModal({ isOpen: true, type: id })
            setTempInput('')
        }
    }

    const setPreferred = (id: MethodId) => {
        if (enabledMethods[id]) {
            setPreferredMethod(id)
            saveState(enabledMethods, id, methodDetails)
        }
    }

    const handleSaveDetails = () => {
        if (!modal.type) return

        let details = tempInput
        const connected = true

        if (modal.type === 'iban') {
            details = sepaEnabled ? `SEPA: ${sepaForm.iban.slice(0, 4)}...` : (tempInput ? tempInput.slice(0, 4) + ' •••• ' + tempInput.slice(-4) : 'Wire Transfer')
        }

        const newDetails = {
            ...methodDetails,
            [modal.type]: { connected, details }
        }
        setMethodDetails(newDetails)
        saveState(enabledMethods, preferredMethod, newDetails, sepaEnabled, sepaUploads, sepaForm)
        setModal({ isOpen: false, type: null })
    }

    // Sync upload to Documentation tab
    const syncToDocumentation = (file: File, type: SepaUpload['type']) => {
        const categoryMap: Record<SepaUpload['type'], string> = {
            mandate: 'SEPA Mandate',
            verification: 'SEPA Verification',
            card: 'SEPA Bank Card',
            statement: 'SEPA Statement'
        }

        const newDoc: UploadedDoc = {
            id: 'sepa_' + Math.random().toString(36).substr(2, 9),
            name: file.name,
            date: new Date().toLocaleDateString(),
            status: 'pending',
            customerId: customer.id,
            category: categoryMap[type]
        }

        // Get existing docs from Documentation storage
        const stored = localStorage.getItem('tigo_uploaded_docs')
        const existingDocs: UploadedDoc[] = stored ? JSON.parse(stored) : []
        const updatedDocs = [newDoc, ...existingDocs]
        localStorage.setItem('tigo_uploaded_docs', JSON.stringify(updatedDocs))
    }

    const processFile = (file: File, type: SepaUpload['type']) => {
        const newUpload: SepaUpload = {
            id: Math.random().toString(36).substr(2, 9),
            name: file.name,
            type,
            date: new Date().toLocaleDateString()
        }

        const updated = [...sepaUploads, newUpload]
        setSepaUploads(updated)
        saveState(enabledMethods, preferredMethod, methodDetails, sepaEnabled, updated, sepaForm)

        // Sync to Documentation tab
        syncToDocumentation(file, type)
    }

    const handleSepaUpload = (e: React.ChangeEvent<HTMLInputElement>, type: SepaUpload['type']) => {
        const file = e.target.files?.[0]
        if (!file) return
        processFile(file, type)
    }

    const handleDrop = (e: DragEvent<HTMLElement>, type: SepaUpload['type']) => {
        e.preventDefault()
        e.stopPropagation()
        setDragOver(null)

        const file = e.dataTransfer.files?.[0]
        if (!file) return

        // Validate file type
        const validTypes = ['application/pdf', 'image/jpeg', 'image/png']
        if (!validTypes.includes(file.type)) {
            alert('Please upload PDF, JPG, or PNG files only.')
            return
        }

        processFile(file, type)
    }

    const handleDragOver = (e: DragEvent<HTMLElement>, type: SepaUpload['type']) => {
        e.preventDefault()
        e.stopPropagation()
        setDragOver(type)
    }

    const handleDragLeave = (e: DragEvent<HTMLElement>) => {
        e.preventDefault()
        e.stopPropagation()
        setDragOver(null)
    }

    const removeSepaUpload = (id: string) => {
        const updated = sepaUploads.filter(u => u.id !== id)
        setSepaUploads(updated)
        saveState(enabledMethods, preferredMethod, methodDetails, sepaEnabled, updated, sepaForm)
    }

    const verificationDocs = sepaUploads.filter(u => u.type === 'verification')
    const cardDocs = sepaUploads.filter(u => u.type === 'card')
    const statementDocs = sepaUploads.filter(u => u.type === 'statement')
    const mandateDocs = sepaUploads.filter(u => u.type === 'mandate')

    const METHODS: { id: MethodId, name: string, icon: any, desc: string, note?: string }[] = [
        {
            id: 'wise',
            name: 'Quick Pay (Wise, ApplePay, Credit & Debit Cards)',
            icon: (
                <div className="flex -space-x-2">
                    <img src="/wise-logo.png" alt="Wise" className="w-10 h-10 object-contain bg-white rounded-full border border-gray-100 p-1 z-20" />
                    {/* Quick Pay Logo for checkout parity */}
                    <div className="flex -space-x-1.5 opacity-40">
                        <img src="/wise-logo.png" alt="Wise" className="w-6 h-6 object-contain grayscale" />
                    </div>
                </div>
            ),
            desc: 'Pay instantly using Wise balance, ApplePay, or any Credit/Debit card.'
        },
        {
            id: 'iban',
            name: 'IBAN Bank Transfer',
            icon: (
                <svg className="w-10 h-10 text-gray-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M8 14v3m4-3v3m4-3v3M3 21h18M3 10h18M3 7l9-4 9 4M4 10h16v11H4V10z" />
                </svg>
            ),
            desc: 'Prepayment via Wise BE account. Proforma Invoice will be issued after placing an order. Goods will ship after payment confirmed on our side.',
            note: 'Manual verification required'
        }
    ]

    return (
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-8">
            <div className="grid gap-4">
                {METHODS.map(method => (
                    <div
                        key={method.id}
                        className={`relative p-6 rounded-xl border-2 flex flex-col md:flex-row md:items-center gap-4 transition-all ${enabledMethods[method.id]
                            ? 'border-gray-300 bg-white'
                            : 'border-gray-100 bg-gray-50 opacity-75'
                            } ${preferredMethod === method.id ? 'ring-2 ring-green-500 border-green-500' : ''}`}
                    >
                        <div className="flex items-center gap-4 flex-1">
                            <input
                                type="checkbox"
                                checked={enabledMethods[method.id]}
                                onChange={() => toggleEnable(method.id)}
                                className="w-5 h-5 rounded border-gray-300 text-green-600 focus:ring-green-500"
                            />

                            <div className={`w-14 h-14 rounded-full flex items-center justify-center shrink-0 ${enabledMethods[method.id] ? 'bg-gray-50' : 'bg-gray-200'}`}>
                                {method.icon}
                            </div>

                            <div className="flex-1">
                                <h3 className="font-bold text-lg text-gray-900">{method.name}</h3>
                                <p className="text-sm text-gray-500">{method.desc}</p>
                                {method.note && (
                                    <p className="text-xs text-amber-600 font-medium mt-1 flex items-center gap-1">
                                        <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" /></svg>
                                        {method.note}
                                    </p>
                                )}
                                {methodDetails[method.id].connected && (
                                    <div className="mt-1 text-xs font-medium text-green-600 flex items-center gap-1">
                                        <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" /></svg>
                                        Connected: {methodDetails[method.id].details}
                                    </div>
                                )}
                            </div>
                        </div>

                        {enabledMethods[method.id] && (
                            <div className="flex items-center gap-4 pl-9 md:pl-0 border-t md:border-t-0 pt-4 md:pt-0">
                                {!methodDetails[method.id].connected ? (
                                    <button
                                        onClick={() => { setModal({ isOpen: true, type: method.id }); setTempInput(''); }}
                                        className="text-sm bg-gray-900 text-white px-4 py-2 rounded-lg hover:bg-black transition whitespace-nowrap"
                                    >
                                        {method.id === 'iban' ? 'View Details' : 'Connect'}
                                    </button>
                                ) : (
                                    <button
                                        onClick={() => { setModal({ isOpen: true, type: method.id }); setTempInput(methodDetails[method.id].details || ''); }}
                                        className="text-sm text-gray-500 hover:text-gray-900 underline whitespace-nowrap"
                                    >
                                        Manage
                                    </button>
                                )}

                                <label className="flex items-center gap-2 cursor-pointer whitespace-nowrap">
                                    <input
                                        type="radio"
                                        name="preferred_method"
                                        checked={preferredMethod === method.id}
                                        onChange={() => setPreferred(method.id)}
                                        className="w-4 h-4 text-green-600 focus:ring-green-500"
                                    />
                                    <span className={`text-sm font-medium ${preferredMethod === method.id ? 'text-green-700' : 'text-gray-500'}`}>
                                        Preferred
                                    </span>
                                </label>
                            </div>
                        )}
                    </div>
                ))}
            </div>

            {/* Connection Modal */}
            {modal.isOpen && (
                <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4 overflow-y-auto">
                    <div className="bg-white rounded-2xl w-full max-w-lg p-6 shadow-xl animate-in fade-in zoom-in-95 my-8">
                        <h3 className="text-xl font-bold mb-4">
                            {modal.type === 'iban' ? 'Bank Transfer & SEPA Settings' : `Connect ${METHODS.find(m => m.id === modal.type)?.name}`}
                        </h3>


                        {modal.type === 'wise' && (
                            <div className="text-center py-4 space-y-6">
                                <div className="bg-gray-50 rounded-2xl p-6 border border-gray-100">
                                    <p className="text-sm font-bold text-gray-900 mb-4">Scan to Pay with Wise</p>
                                    <div className="flex justify-center mb-4">
                                        <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-100">
                                            <img src="/wise-qr.png" alt="Wise QR Code" className="w-48 h-48 object-contain" />
                                        </div>
                                    </div>
                                    <p className="text-[10px] text-gray-400 leading-relaxed uppercase tracking-widest">
                                        Open your banking app or camera to scan. <br />
                                        Supports Wise, ApplePay, and all major Credit/Debit Cards.
                                    </p>
                                </div>

                                <div className="space-y-3">
                                    <a
                                        href="https://wise.com/pay/business/initraenergijadoo?utm_source=quick_pay"
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="bg-[#9fe870] text-gray-900 px-6 py-4 rounded-xl font-black flex items-center justify-center gap-3 w-full hover:bg-[#8ed85f] transition shadow-lg shadow-green-100 group"
                                    >
                                        <span>Pay Securely with Wise</span>
                                        <svg className="w-5 h-5 group-hover:translate-x-1 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M14 5l7 7m0 0l-7 7m7-7H3" />
                                        </svg>
                                    </a>
                                    <p className="text-[10px] text-gray-400 font-medium">
                                        Note: Please provide your order number or customer name as the payment reference on the Wise landing page.
                                    </p>
                                </div>
                            </div>
                        )}

                        {modal.type === 'iban' && (
                            <div className="space-y-5 max-h-[60vh] overflow-y-auto pr-2">
                                {/* Wire Transfer Section */}
                                <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
                                    <h4 className="font-bold text-blue-900 mb-2">Our Bank Details (Wire Transfer)</h4>
                                    <div className="space-y-2 text-sm">
                                        <div className="flex justify-between">
                                            <span className="text-gray-600">Bank:</span>
                                            <span className="font-medium">Wise</span>
                                        </div>
                                        <div className="flex justify-between">
                                            <span className="text-gray-600">IBAN:</span>
                                            <span className="font-mono font-medium text-xs">BE55 9052 7486 2944</span>
                                        </div>
                                        <div className="flex justify-between">
                                            <span className="text-gray-600">BIC/SWIFT:</span>
                                            <span className="font-mono font-medium">LJBASI2X</span>
                                        </div>
                                        <div className="flex justify-between">
                                            <span className="text-gray-600">Recipient:</span>
                                            <span className="font-medium text-right">Initra Energija d.o.o.</span>
                                        </div>
                                        <div className="mt-2 p-2 bg-amber-50 rounded text-[10px] text-amber-700 font-medium">
                                            Note: Payment to Wise is seen instantly on mobile.
                                        </div>
                                    </div>
                                </div>

                                {/* SEPA Direct Debit Toggle */}
                                <div className="border-t pt-4">
                                    <label className="flex items-center justify-between cursor-pointer">
                                        <div>
                                            <h4 className="font-bold text-gray-900">Enable SEPA Direct Debit</h4>
                                            <p className="text-sm text-gray-500">Allow us to automatically debit your account</p>
                                        </div>
                                        <input
                                            type="checkbox"
                                            checked={sepaEnabled}
                                            onChange={e => setSepaEnabled(e.target.checked)}
                                            className="w-5 h-5 rounded text-green-600 focus:ring-green-500"
                                        />
                                    </label>
                                </div>

                                {/* SEPA Form (shown when enabled) */}
                                {sepaEnabled && (
                                    <div className="space-y-4 border-t pt-4">
                                        <div className="bg-amber-50 border border-amber-200 rounded-lg p-3">
                                            <p className="text-sm text-amber-800">
                                                <strong>Required documents:</strong> SEPA mandate form, 2 verification documents, photo of bank card, and latest account statement.
                                            </p>
                                        </div>

                                        {/* SEPA Form Fields */}
                                        <div className="space-y-3">
                                            <div>
                                                <label className="block text-sm font-medium text-gray-700 mb-1">Account Holder Name</label>
                                                <input
                                                    className="w-full border p-2.5 rounded-lg text-sm"
                                                    placeholder="Full name as on bank account"
                                                    value={sepaForm.accountHolder}
                                                    onChange={e => setSepaForm(prev => ({ ...prev, accountHolder: e.target.value }))}
                                                />
                                            </div>
                                            <div>
                                                <label className="block text-sm font-medium text-gray-700 mb-1">Your IBAN</label>
                                                <input
                                                    className="w-full border p-2.5 rounded-lg text-sm font-mono"
                                                    placeholder="e.g. BE55 9052 7486 2944"
                                                    value={sepaForm.iban}
                                                    onChange={e => setSepaForm(prev => ({ ...prev, iban: e.target.value }))}
                                                />
                                            </div>
                                            <div>
                                                <label className="block text-sm font-medium text-gray-700 mb-1">BIC/SWIFT</label>
                                                <input
                                                    className="w-full border p-2.5 rounded-lg text-sm font-mono"
                                                    placeholder="e.g. COBADEFFXXX"
                                                    value={sepaForm.bic}
                                                    onChange={e => setSepaForm(prev => ({ ...prev, bic: e.target.value }))}
                                                />
                                            </div>
                                        </div>

                                        {/* Document Uploads */}
                                        <div className="space-y-3 pt-2">
                                            {/* SEPA Mandate */}
                                            <div className="border rounded-lg p-3">
                                                <div className="flex items-center justify-between mb-2">
                                                    <span className="text-sm font-medium">SEPA Mandate Form</span>
                                                    <button className="text-xs text-blue-600 hover:underline" onClick={() => alert('Downloading SEPA_Mandate.pdf...')}>
                                                        Download Template
                                                    </button>
                                                </div>
                                                {mandateDocs.length > 0 ? (
                                                    <div className="flex items-center justify-between bg-green-50 p-2 rounded text-sm">
                                                        <span className="text-green-700">{mandateDocs[0].name}</span>
                                                        <button onClick={() => removeSepaUpload(mandateDocs[0].id)} className="text-red-500 hover:text-red-700">Remove</button>
                                                    </div>
                                                ) : (
                                                    <label
                                                        className={`flex items-center justify-center border-2 border-dashed rounded-lg p-3 cursor-pointer transition-colors ${dragOver === 'mandate' ? 'border-green-500 bg-green-50' : 'hover:bg-gray-50'}`}
                                                        onDragOver={e => handleDragOver(e, 'mandate')}
                                                        onDragLeave={handleDragLeave}
                                                        onDrop={e => handleDrop(e, 'mandate')}
                                                    >
                                                        <span className="text-sm text-gray-500">{dragOver === 'mandate' ? 'Drop file here' : 'Drop or click to upload signed mandate'}</span>
                                                        <input type="file" className="hidden" accept=".pdf,.jpg,.png" onChange={e => handleSepaUpload(e, 'mandate')} />
                                                    </label>
                                                )}
                                            </div>

                                            {/* Verification Documents */}
                                            <div className="border rounded-lg p-3">
                                                <div className="flex items-center justify-between mb-2">
                                                    <span className="text-sm font-medium">Verification Documents <span className="text-gray-400">(min. 2)</span></span>
                                                    <span className={`text-xs ${verificationDocs.length >= 2 ? 'text-green-600' : 'text-amber-600'}`}>
                                                        {verificationDocs.length}/2
                                                    </span>
                                                </div>
                                                {verificationDocs.map(doc => (
                                                    <div key={doc.id} className="flex items-center justify-between bg-gray-50 p-2 rounded text-sm mb-2">
                                                        <span>{doc.name}</span>
                                                        <button onClick={() => removeSepaUpload(doc.id)} className="text-red-500 hover:text-red-700">Remove</button>
                                                    </div>
                                                ))}
                                                {verificationDocs.length < 2 && (
                                                    <label
                                                        className={`flex items-center justify-center border-2 border-dashed rounded-lg p-3 cursor-pointer transition-colors ${dragOver === 'verification' ? 'border-green-500 bg-green-50' : 'hover:bg-gray-50'}`}
                                                        onDragOver={e => handleDragOver(e, 'verification')}
                                                        onDragLeave={handleDragLeave}
                                                        onDrop={e => handleDrop(e, 'verification')}
                                                    >
                                                        <span className="text-sm text-gray-500">{dragOver === 'verification' ? 'Drop file here' : 'Drop or click to upload ID, passport, or utility bill'}</span>
                                                        <input type="file" className="hidden" accept=".pdf,.jpg,.png" onChange={e => handleSepaUpload(e, 'verification')} />
                                                    </label>
                                                )}
                                            </div>

                                            {/* Bank Card Photo */}
                                            <div className="border rounded-lg p-3">
                                                <span className="text-sm font-medium block mb-2">Bank Card Photo</span>
                                                {cardDocs.length > 0 ? (
                                                    <div className="flex items-center justify-between bg-green-50 p-2 rounded text-sm">
                                                        <span className="text-green-700">{cardDocs[0].name}</span>
                                                        <button onClick={() => removeSepaUpload(cardDocs[0].id)} className="text-red-500 hover:text-red-700">Remove</button>
                                                    </div>
                                                ) : (
                                                    <label
                                                        className={`flex items-center justify-center border-2 border-dashed rounded-lg p-3 cursor-pointer transition-colors ${dragOver === 'card' ? 'border-green-500 bg-green-50' : 'hover:bg-gray-50'}`}
                                                        onDragOver={e => handleDragOver(e, 'card')}
                                                        onDragLeave={handleDragLeave}
                                                        onDrop={e => handleDrop(e, 'card')}
                                                    >
                                                        <span className="text-sm text-gray-500">{dragOver === 'card' ? 'Drop file here' : 'Drop or click to upload card photo (hide CVV)'}</span>
                                                        <input type="file" className="hidden" accept=".jpg,.png" onChange={e => handleSepaUpload(e, 'card')} />
                                                    </label>
                                                )}
                                            </div>

                                            {/* Account Statement */}
                                            <div className="border rounded-lg p-3">
                                                <span className="text-sm font-medium block mb-2">Latest Account Statement</span>
                                                {statementDocs.length > 0 ? (
                                                    <div className="flex items-center justify-between bg-green-50 p-2 rounded text-sm">
                                                        <span className="text-green-700">{statementDocs[0].name}</span>
                                                        <button onClick={() => removeSepaUpload(statementDocs[0].id)} className="text-red-500 hover:text-red-700">Remove</button>
                                                    </div>
                                                ) : (
                                                    <label
                                                        className={`flex items-center justify-center border-2 border-dashed rounded-lg p-3 cursor-pointer transition-colors ${dragOver === 'statement' ? 'border-green-500 bg-green-50' : 'hover:bg-gray-50'}`}
                                                        onDragOver={e => handleDragOver(e, 'statement')}
                                                        onDragLeave={handleDragLeave}
                                                        onDrop={e => handleDrop(e, 'statement')}
                                                    >
                                                        <span className="text-sm text-gray-500">{dragOver === 'statement' ? 'Drop file here' : 'Drop or click to upload bank statement'}</span>
                                                        <input type="file" className="hidden" accept=".pdf,.jpg,.png" onChange={e => handleSepaUpload(e, 'statement')} />
                                                    </label>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                )}

                                {/* Your IBAN for refunds (when SEPA not enabled) */}
                                {!sepaEnabled && (
                                    <div className="pt-2">
                                        <label className="block text-sm font-medium text-gray-700 mb-1">Your IBAN (optional, for refunds)</label>
                                        <input
                                            className="w-full border p-3 rounded-lg"
                                            placeholder="e.g. BE55 0000 0000 0000"
                                            value={tempInput}
                                            onChange={e => setTempInput(e.target.value)}
                                        />
                                    </div>
                                )}
                            </div>
                        )}

                        <div className="mt-6 flex gap-3">
                            <button
                                onClick={() => setModal({ isOpen: false, type: null })}
                                className="flex-1 px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg transition"
                            >
                                Cancel
                            </button>
                            {modal.type !== 'wise' && (
                                <button
                                    onClick={handleSaveDetails}
                                    className="flex-1 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition"
                                >
                                    {modal.type === 'iban' ? 'Save' : 'Save & Connect'}
                                </button>
                            )}
                        </div>
                    </div>
                </div>
            )}
        </div>
    )
}
