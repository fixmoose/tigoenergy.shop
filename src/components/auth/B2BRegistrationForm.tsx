
'use client'

import React, { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { useRecaptcha } from '@/hooks/useRecaptcha'
import { useAddressAutocomplete } from '@/hooks/useAddressAutocomplete'

export default function B2BRegistrationForm() {
    const supabase = createClient()
    const router = useRouter()

    const [step, setStep] = useState(1)
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState('')
    const { recaptchaRef, token: recaptchaToken, resetRecaptcha } = useRecaptcha()
    const { inputRef: addressInputRef } = useAddressAutocomplete((parsed) => {
        setFormData(prev => ({
            ...prev,
            companyAddress: `${parsed.street}, ${parsed.postal_code} ${parsed.city}`,
            country: parsed.country
        }))
    })

    // Form State
    const [formData, setFormData] = useState({
        // Company
        vatNumber: '',
        companyName: '',
        companyAddress: '',
        country: '',
        website: '',
        businessType: '', // 'installer', 'distributor', 'reseller'
        employees: '',

        // Shipping
        commercialAccess: false,
        preferredCarrier: '',

        // Contact Person
        firstName: '',
        lastName: '',
        jobTitle: '',
        email: '',
        phone: '',

        // Verification
        emailCode: '',
        phoneCode: '',

        // Security
        password: '',
        confirmPassword: '',

        // Agreements
        terms: false,
        privacy: false,
        legitimateBusiness: false
    })

    // Verification States
    const [vatVerified, setVatVerified] = useState(false)
    const [emailVerified, setEmailVerified] = useState(false)
    const [phoneVerified, setPhoneVerified] = useState(false)
    const [generatedEmailCode, setGeneratedEmailCode] = useState('')
    const [generatedPhoneCode, setGeneratedPhoneCode] = useState('')

    // --- HANDLERS ---

    // STEP 1: VAT Validation
    const handleValidateVat = async () => {
        setLoading(true)
        setError('')
        try {
            const res = await fetch('/api/validate/vat', {
                method: 'POST', body: JSON.stringify({ vatNumber: formData.vatNumber })
            })
            const data = await res.json()
            setLoading(false)

            if (data.valid) {
                setVatVerified(true)
                setFormData(prev => ({
                    ...prev,
                    companyName: data.name,
                    companyAddress: data.address,
                    country: data.countryCode
                }))
                // Auto-advance
                setStep(2)
            } else {
                setError(data.error || 'VAT validation failed')
            }
        } catch (e) {
            setLoading(false)
            setError('Connection error')
        }
    }

    // STEP 4: Email/Phone (Reused logic from B2C)
    const handleSendEmailCode = async () => {
        if (!recaptchaToken) {
            setError('Please complete the reCAPTCHA')
            return
        }
        setLoading(true); setError('')
        const res = await fetch('/api/validate/email', { method: 'POST', body: JSON.stringify({ email: formData.email, recaptchaToken }) })
        const data = await res.json()
        setLoading(false)
        if (data.success) setGeneratedEmailCode(data.debug_code)
        else {
            setError(data.error)
            resetRecaptcha()
        }
    }

    const handleVerifyEmail = () => {
        if (formData.emailCode === generatedEmailCode && generatedEmailCode) setEmailVerified(true)
        else setError('Invalid code')
    }

    const handleSendPhoneCode = async () => {
        setLoading(true); setError('')
        const res = await fetch('/api/validate/phone', { method: 'POST', body: JSON.stringify({ phone: formData.phone }) })
        const data = await res.json()
        setLoading(false)
        if (data.success) setGeneratedPhoneCode(data.debug_code)
        else setError(data.error)
    }

    const handleVerifyPhone = () => {
        if (formData.phoneCode === generatedPhoneCode && generatedPhoneCode) setPhoneVerified(true)
        else setError('Invalid code')
    }

    // FINAL SUBMIT (Real Auth)
    const handleSubmit = async () => {
        setLoading(true)
        setError('')

        try {
            const { data, error: authError } = await supabase.auth.signUp({
                email: formData.email,
                password: formData.password,
                options: {
                    data: {
                        first_name: formData.firstName,
                        last_name: formData.lastName,
                        company_name: formData.companyName,
                        vat_id: formData.vatNumber,
                        customer_type: 'b2b',
                        phone: formData.phone,
                        commercial_access: formData.commercialAccess,
                        business_type: formData.businessType,
                        website: formData.website
                    }
                }
            })

            if (authError) throw authError

            // If we have a user, also create the profile entry if trigger doesn't exist?
            // User requested mock to real signUp, usually profile is auto-created.

            setLoading(false)
            alert('Registration request submitted! Please check your email to verify your account.')
            router.push('/checkout') // Redirect to checkout or dashboard
        } catch (err: any) {
            setLoading(false)
            setError(err.message || 'Registration failed')
        }
    }

    return (
        <div className="max-w-2xl mx-auto py-6">
            <h2 className="text-2xl font-bold mb-2 text-center text-blue-900">Business Registration</h2>
            <p className="text-center text-gray-500 mb-8">For Installers, Resellers & Distributors</p>

            {error && <div className="bg-red-50 text-red-600 p-3 rounded mb-6 text-sm flex items-center gap-2">⚠️ {error}</div>}

            {/* STEP 1: VAT */}
            <StepCard number={1} title="VAT Verification" isActive={step === 1} isCompleted={step > 1} setStep={setStep}>
                <div className="space-y-4">
                    <p className="text-sm text-gray-600">Enter your valid EU VAT number to verify your business status via VIES.</p>
                    <div className="flex gap-2">
                        <div className="relative flex-1">
                            <span className="absolute left-3 top-2.5 text-gray-400 font-bold">EU</span>
                            <input
                                className="w-full border p-2.5 pl-10 rounded-lg uppercase tracking-wider font-mono focus:ring-2 focus:ring-blue-500 outline-none"
                                placeholder="SI12345678"
                                value={formData.vatNumber}
                                onChange={e => setFormData(prev => ({ ...prev, vatNumber: e.target.value }))}
                                autoFocus
                            />
                        </div>
                        <button
                            onClick={handleValidateVat}
                            disabled={loading || !formData.vatNumber}
                            className="bg-blue-800 text-white px-6 rounded-lg hover:bg-blue-900 font-medium disabled:opacity-50"
                        >
                            {loading ? 'Verifying...' : 'Verify VAT'}
                        </button>
                    </div>
                    <div className="text-xs text-gray-400">
                        * Verification happens in real-time. If VIES is offline, we will fallback to manual verification.
                    </div>
                </div>
            </StepCard>

            {/* STEP 2: Company Details */}
            <StepCard number={2} title="Company Details" isActive={step === 2} isCompleted={step > 2} setStep={setStep}>
                <div className="space-y-4">
                    <div className="bg-blue-50 p-3 rounded border border-blue-100 text-sm text-blue-800 mb-2">
                        <strong>✓ VAT Verified.</strong> Please confirm your company details below.
                    </div>
                    <div>
                        <label className="text-xs font-medium text-gray-500">Company Name</label>
                        <input className="w-full border p-2.5 rounded-lg bg-gray-50" value={formData.companyName} readOnly />
                    </div>
                    <div>
                        <label className="text-xs font-medium text-gray-500">Registered Address</label>
                        <input
                            ref={addressInputRef}
                            className="w-full border p-2.5 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                            value={formData.companyAddress}
                            onChange={e => setFormData(prev => ({ ...prev, companyAddress: e.target.value }))}
                            placeholder="Type company address..."
                        />
                    </div>
                    <div className="grid md:grid-cols-2 gap-4">
                        <div>
                            <label className="text-xs font-medium text-gray-500">Website (Optional)</label>
                            <input className="w-full border p-2.5 rounded-lg" placeholder="https://..." value={formData.website} onChange={e => setFormData(prev => ({ ...prev, website: e.target.value }))} />
                        </div>
                        <div>
                            <label className="text-xs font-medium text-gray-500">Employees</label>
                            <select className="w-full border p-2.5 rounded-lg bg-white" value={formData.employees} onChange={e => setFormData(prev => ({ ...prev, employees: e.target.value }))}>
                                <option value="">Select...</option>
                                <option value="1-5">1-5</option>
                                <option value="6-20">6-20</option>
                                <option value="21-50">21-50</option>
                                <option value="50+">50+</option>
                            </select>
                        </div>
                    </div>
                    <button onClick={() => setStep(3)} className="w-full bg-blue-600 text-white py-2.5 rounded-lg font-medium hover:bg-blue-700">Confirm & Continue</button>
                </div>
            </StepCard>

            {/* STEP 3: Business Type & Logistics */}
            <StepCard number={3} title="Business Type" isActive={step === 3} isCompleted={step > 3} setStep={setStep}>
                <div className="space-y-6">
                    <div>
                        <label className="block text-sm font-medium mb-2">Type of Business</label>
                        <div className="grid grid-cols-2 gap-3">
                            {['Installer', 'Reseller', 'Distributor', 'Other'].map(type => (
                                <label key={type} className={`border rounded-lg p-3 cursor-pointer flex items-center gap-2 hover:bg-gray-50 ${formData.businessType === type ? 'ring-2 ring-blue-500 bg-blue-50' : ''}`}>
                                    <input type="radio" name="businessType" className="w-4 h-4" checked={formData.businessType === type} onChange={() => setFormData(prev => ({ ...prev, businessType: type }))} />
                                    <span className="text-sm font-medium">{type}</span>
                                </label>
                            ))}
                        </div>
                    </div>

                    <div>
                        <label className="block text-sm font-medium mb-2">My Delivery Location has Commercial Access?</label>
                        <p className="text-xs text-gray-500 mb-2">Can a large truck/van access your warehouse/office for pallet delivery?</p>
                        <div className="flex gap-4">
                            <label className="flex items-center gap-2 cursor-pointer">
                                <input type="radio" name="commercialAccess" checked={formData.commercialAccess === true} onChange={() => setFormData(prev => ({ ...prev, commercialAccess: true }))} />
                                <span className="text-sm">Yes, Standard Truck Access</span>
                            </label>
                            <label className="flex items-center gap-2 cursor-pointer">
                                <input type="radio" name="commercialAccess" checked={formData.commercialAccess === false} onChange={() => setFormData(prev => ({ ...prev, commercialAccess: false }))} />
                                <span className="text-sm">No, Limited Access</span>
                            </label>
                        </div>
                    </div>

                    <button onClick={() => setStep(4)} className="w-full bg-blue-600 text-white py-2.5 rounded-lg font-medium hover:bg-blue-700">Next Step</button>
                </div>
            </StepCard>

            {/* STEP 4: Contact Verification (Simplified for brevity as logic is same as B2C) */}
            <StepCard number={4} title="Contact Person" isActive={step === 4} isCompleted={step > 4} setStep={setStep}>
                <div className="space-y-4">
                    <div className="grid md:grid-cols-2 gap-4">
                        <input placeholder="First Name" className="w-full border p-2.5 rounded-lg" value={formData.firstName} onChange={e => setFormData(prev => ({ ...prev, firstName: e.target.value }))} />
                        <input placeholder="Last Name" className="w-full border p-2.5 rounded-lg" value={formData.lastName} onChange={e => setFormData(prev => ({ ...prev, lastName: e.target.value }))} />
                    </div>

                    {/* Email */}
                    <div className="flex gap-2">
                        <input type="email" placeholder="Business Email" className="flex-1 border p-2.5 rounded-lg" value={formData.email} onChange={e => setFormData(prev => ({ ...prev, email: e.target.value }))} />
                        <button onClick={handleSendEmailCode} disabled={loading || !recaptchaToken} className="bg-gray-900 text-white px-4 rounded-lg text-sm">Send Code</button>
                    </div>

                    <div className="py-2">
                        <div ref={recaptchaRef}></div>
                    </div>
                    {generatedEmailCode && !emailVerified && (
                        <div className="bg-blue-50 p-2 rounded flex gap-2 items-center">
                            <span className="text-xs font-mono text-blue-800">CODE: {generatedEmailCode}</span>
                            <input placeholder="Code" className="w-20 border p-1" value={formData.emailCode} onChange={e => setFormData(prev => ({ ...prev, emailCode: e.target.value }))} />
                            <button onClick={handleVerifyEmail} className="text-xs bg-blue-600 text-white px-2 py-1 rounded">Verify</button>
                        </div>
                    )}
                    {emailVerified && <div className="text-green-600 text-sm">✓ Email Verified</div>}

                    {/* Phone */}
                    <div className="flex gap-2">
                        <input type="tel" placeholder="Mobile Phone" className="flex-1 border p-2.5 rounded-lg" value={formData.phone} onChange={e => setFormData(prev => ({ ...prev, phone: e.target.value }))} />
                        <button onClick={handleSendPhoneCode} disabled={loading} className="bg-gray-900 text-white px-4 rounded-lg text-sm">Send SMS</button>
                    </div>
                    {generatedPhoneCode && !phoneVerified && (
                        <div className="bg-blue-50 p-2 rounded flex gap-2 items-center">
                            <span className="text-xs font-mono text-blue-800">SMS: {generatedPhoneCode}</span>
                            <input placeholder="Code" className="w-20 border p-1" value={formData.phoneCode} onChange={e => setFormData(prev => ({ ...prev, phoneCode: e.target.value }))} />
                            <button onClick={handleVerifyPhone} className="text-xs bg-blue-600 text-white px-2 py-1 rounded">Verify</button>
                        </div>
                    )}
                    {phoneVerified && <div className="text-green-600 text-sm">✓ Phone Verified</div>}

                    <button onClick={() => setStep(5)} disabled={!emailVerified || !phoneVerified} className="w-full bg-blue-600 text-white py-2.5 rounded-lg disabled:opacity-50">Continue</button>
                </div>
            </StepCard>

            {/* STEP 5: Security & Submit */}
            <StepCard number={5} title="Finish Application" isActive={step === 5} isCompleted={false} setStep={setStep}>
                <div className="space-y-4">
                    <div className="grid md:grid-cols-2 gap-4">
                        <input type="password" placeholder="Password" className="w-full border p-2.5 rounded-lg" value={formData.password} onChange={e => setFormData(prev => ({ ...prev, password: e.target.value }))} />
                        <input type="password" placeholder="Confirm Password" className="w-full border p-2.5 rounded-lg" value={formData.confirmPassword} onChange={e => setFormData(prev => ({ ...prev, confirmPassword: e.target.value }))} />
                    </div>

                    <div className="p-4 bg-gray-50 rounded-lg text-sm text-gray-600 space-y-3">
                        <label className="flex items-start gap-3 cursor-pointer">
                            <input type="checkbox" className="mt-1 w-4 h-4 text-blue-600 rounded" checked={formData.legitimateBusiness} onChange={e => setFormData(prev => ({ ...prev, legitimateBusiness: e.target.checked }))} />
                            <span className="font-bold text-gray-800">I confirm that I am authorized by the company to register on their behalf.</span>
                        </label>
                        <label className="flex items-start gap-3 cursor-pointer">
                            <input type="checkbox" className="mt-1 w-4 h-4 text-blue-600 rounded" checked={formData.terms} onChange={e => setFormData(prev => ({ ...prev, terms: e.target.checked }))} />
                            <span>I agree to the <a href="#" className="text-blue-600 hover:underline">Terms of Service</a>.</span>
                        </label>
                        <label className="flex items-start gap-3 cursor-pointer">
                            <input type="checkbox" className="mt-1 w-4 h-4 text-blue-600 rounded" checked={formData.privacy} onChange={e => setFormData(prev => ({ ...prev, privacy: e.target.checked }))} />
                            <span>I agree to the <a href="#" className="text-blue-600 hover:underline">Privacy Policy</a>.</span>
                        </label>
                        <div className="border-t pt-2 mt-2">
                            <label className="flex items-start gap-3 cursor-pointer">
                                <input type="checkbox" className="mt-1 w-4 h-4 text-blue-600 rounded" checked={(formData as any).newsletter} onChange={e => setFormData(prev => ({ ...prev, newsletter: e.target.checked }))} />
                                <span>Subscribe to our **Newsletter** (Industry Insights).</span>
                            </label>
                            <label className="flex items-start gap-3 cursor-pointer mt-2">
                                <input type="checkbox" className="mt-1 w-4 h-4 text-blue-600 rounded" checked={(formData as any).marketing} onChange={e => setFormData(prev => ({ ...prev, marketing: e.target.checked }))} />
                                <span>Receive **B2B Promotional Pricing** and clearance updates.</span>
                            </label>
                        </div>
                    </div>

                    <button
                        onClick={handleSubmit}
                        disabled={!formData.terms || !formData.privacy || !formData.legitimateBusiness || loading}
                        className="w-full bg-blue-800 text-white py-3.5 rounded-xl font-bold text-lg hover:bg-blue-900 shadow-md transition-all disabled:opacity-50"
                    >
                        {loading ? 'Creating Account...' : 'Create Business Account'}
                    </button>
                </div>
            </StepCard>

        </div>
    )
}

// DEFINED OUTSIDE TO PREVENT RE-RENDERS LOSING FOCUS
const StepCard = ({ number, title, isActive, isCompleted, children, setStep }: any) => (
    <div className={`border rounded-xl mb-4 transition-all duration-300 ${isActive ? 'ring-2 ring-blue-600 shadow-lg bg-white' : 'bg-gray-50 opacity-70'}`}>
        <div className="p-4 flex items-center justify-between cursor-pointer" onClick={() => isCompleted && setStep(number)}>
            <div className="flex items-center gap-3">
                <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold ${isCompleted ? 'bg-blue-800 text-white' : isActive ? 'bg-blue-100 text-blue-800' : 'bg-gray-200 text-gray-500'}`}>
                    {isCompleted ? '✓' : number}
                </div>
                <h3 className={`font-semibold ${isActive ? 'text-gray-900' : 'text-gray-500'}`}>{title}</h3>
            </div>
        </div>
        {isActive && <div className="p-4 pt-0">{children}</div>}
    </div>
)
