'use client'
import React, { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { useRecaptcha } from '@/hooks/useRecaptcha'
import { useAddressAutocomplete } from '@/hooks/useAddressAutocomplete'

// Steps: 
// 1. Email (Send Code) -> Verify Code
// 2. Phone (Send Code) -> Verify Code
// 3. Personal Info (Name, DOB, Occupation)
// 4. Address (Google Maps)
// 5. Account (Username, Password)
// 6. Review & Agreements

export default function B2CRegistrationForm() {
    const router = useRouter()
    const supabase = createClient()
    const [step, setStep] = useState(1)
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState('')
    const { recaptchaRef, resetRecaptcha, execute: executeRecaptcha } = useRecaptcha()
    const { inputRef: addressInputRef } = useAddressAutocomplete((parsed) => {
        setFormData(prev => ({
            ...prev,
            address: parsed.street,
            city: parsed.city,
            postalCode: parsed.postal_code,
            country: parsed.country
        }))
    })

    // Data State
    const [formData, setFormData] = useState({
        email: '',
        emailCode: '',
        phone: '',
        phoneCode: '',
        firstName: '',
        lastName: '',
        dob: '',
        occupation: '',
        address: '',
        city: '',
        postalCode: '',
        country: 'SI', // Default
        username: '',
        password: '',
        confirmPassword: '',
        terms: false,
        privacy: false,
        cookies: false,
        newsletter: false,
        marketing: false
    })

    // Verification States
    const [emailVerified, setEmailVerified] = useState(false)
    const [phoneVerified, setPhoneVerified] = useState(false)
    const [emailCodeSent, setEmailCodeSent] = useState(false)
    const [phoneCodeSent, setPhoneCodeSent] = useState(false)

    // Auto-generate username when names change
    const generateUsername = () => {
        if (!formData.firstName || !formData.lastName) return
        const random = Math.floor(Math.random() * 999).toString().padStart(3, '0')
        const base = `${formData.firstName.toLowerCase()}.${formData.lastName.toLowerCase()}`.replace(/[^a-z0-9.]/g, '')
        const suggested = `${base}.${random}`
        setFormData(prev => ({ ...prev, username: suggested }))
    }

    // Effect to trigger generation if username is empty and we have names
    React.useEffect(() => {
        if (!formData.username && formData.firstName && formData.lastName && step === 3) {
            generateUsername()
        }
    }, [formData.firstName, formData.lastName, step])

    // STEP 1: Email Handlers
    const handleSendEmailCode = async () => {
        setLoading(true)
        setError('')

        try {
            const token = await executeRecaptcha('REGISTRATION')
            const res = await fetch('/api/validate/email', {
                method: 'POST', body: JSON.stringify({ email: formData.email, recaptchaToken: token })
            })
            const data = await res.json()
            setLoading(false)
            if (data.success) {
                setEmailCodeSent(true)
            } else {
                setError(data.error)
                resetRecaptcha()
            }
        } catch (err: any) {
            setLoading(false)
            setError('reCAPTCHA verification failed. Please try again.')
            resetRecaptcha()
        }
    }

    const handleVerifyEmail = async () => {
        setLoading(true)
        setError('')
        try {
            const res = await fetch('/api/validate/email/verify', {
                method: 'POST',
                body: JSON.stringify({ email: formData.email, code: formData.emailCode })
            })
            const data = await res.json()
            if (data.success) {
                setEmailVerified(true)
                setStep(2)
            } else {
                setError(data.error || 'Invalid code')
            }
        } catch (err) {
            setError('Verification failed. Please try again.')
        } finally {
            setLoading(false)
        }
    }

    // STEP 2: Phone Handlers
    const handleSendPhoneCode = async () => {
        setLoading(true)
        setError('')
        try {
            const res = await fetch('/api/validate/phone', {
                method: 'POST', body: JSON.stringify({ phone: formData.phone })
            })
            const data = await res.json()
            if (data.success) {
                setPhoneCodeSent(true)
            } else {
                setError(data.error || 'Failed to send SMS')
            }
        } catch (err) {
            setError('Error sending SMS')
        } finally {
            setLoading(false)
        }
    }

    const handleVerifyPhone = async () => {
        setLoading(true)
        setError('')
        try {
            const res = await fetch('/api/validate/phone/verify', {
                method: 'POST',
                body: JSON.stringify({ phone: formData.phone, code: formData.phoneCode })
            })
            const data = await res.json()
            if (data.success) {
                setPhoneVerified(true)
                setStep(3)
            } else {
                setError(data.error || 'Invalid code')
            }
        } catch (err) {
            setError('Verification failed. Please try again.')
        } finally {
            setLoading(false)
        }
    }

    const validateAddress = () => {
        if (!formData.address || !formData.city || !formData.postalCode || !formData.country) {
            setError('Please fill in all address fields')
            return
        }
        setStep(5)
    }

    const [registrationSuccess, setRegistrationSuccess] = useState(false)

    React.useEffect(() => {
        if (registrationSuccess) {
            window.scrollTo({ top: 0, behavior: 'smooth' })
        }
    }, [registrationSuccess])

    // FINAL SUBMIT (Custom UniOne Action)
    const handleSubmit = async () => {
        setLoading(true)
        setError('')

        // 0. Recaptcha check
        const token = await executeRecaptcha('B2C_SIGNUP')

        try {
            const { registerUserAction } = await import('@/app/actions/auth')
            const result = await registerUserAction({ ...formData, recaptchaToken: token })

            if (result.error) {
                setError(result.error)
            } else if (result.success) {
                // Since they are auto-confirmed in registerUserAction, we can auto-login
                const { error: signInError } = await supabase.auth.signInWithPassword({
                    email: formData.email,
                    password: formData.password
                })

                if (signInError) {
                    // If auto-login fails for some reason, show success screen and tell them to sign in
                    setRegistrationSuccess(true)
                } else {
                    router.push('/auth/welcome')
                    router.refresh()
                }
            }
        } catch (err: any) {
            setError(err.message || 'An unexpected error occurred')
        } finally {
            setLoading(false)
        }
    }

    if (registrationSuccess) {
        return (
            <div className="max-w-xl mx-auto py-12 px-4 text-center">
                <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-6">
                    <svg className="w-10 h-10 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 19v-8.93a2 2 0 01.89-1.664l7-4.666a2 2 0 012.22 0l7 4.666A2 2 0 0121 10.07V19M3 19a2 2 0 002 2h14a2 2 0 002-2M3 19l6.75-4.5M21 19l-6.75-4.5M3 10l6.75 4.5M21 10l-6.75 4.5m0 0l-1.14.76a2 2 0 01-2.22 0l-1.14-.76" /></svg>
                </div>
                <h2 className="text-3xl font-bold text-gray-900 mb-4">Registration Successful!</h2>
                <p className="text-lg text-gray-600 mb-8">
                    Your account has been created. A welcome email has been sent to <span className="font-semibold text-gray-900">{formData.email}</span>.
                </p>
                <Link href="/auth/login" className="inline-block bg-green-600 text-white px-8 py-3 rounded-xl font-bold hover:bg-green-700 transition shadow-lg">
                    Go to Sign In
                </Link>
            </div>
        )
    }

    return (
        <div className="max-w-2xl mx-auto py-8 px-4">
            <div className="text-center mb-10">
                <h2 className="text-4xl font-extrabold text-gray-900 tracking-tight">Create B2C Account</h2>
                <p className="mt-2 text-gray-500 font-medium">Step-by-step registration for a seamless experience</p>
            </div>

            {error && <div className="bg-red-50 text-red-600 p-3 rounded mb-6 text-sm flex items-center gap-2">⚠️ {error}</div>}

            <StepCard number={1} title="Email Verification" isActive={step === 1} isCompleted={step > 1} setStep={setStep}>
                <div className="space-y-4">
                    <label htmlFor="reg-email" className="block text-sm font-medium">Email Address</label>
                    <div className="flex gap-2">
                        <input
                            id="reg-email"
                            name="email"
                            type="email"
                            autoComplete="email"
                            value={formData.email}
                            onChange={e => setFormData({ ...formData, email: e.target.value })}
                            className="flex-1 border p-2.5 rounded-lg focus:ring-2 focus:ring-green-500 outline-none"
                            placeholder="you@example.com"
                        />
                        <button
                            type="button"
                            onClick={handleSendEmailCode}
                            disabled={loading || !formData.email}
                            className="bg-gray-900 text-white px-4 rounded-lg hover:bg-black disabled:opacity-50 transition-colors"
                        >
                            {loading ? 'Sending...' : emailCodeSent ? 'Resend' : 'Send Code'}
                        </button>
                    </div>

                    <div className="py-2">
                        <div ref={recaptchaRef}></div>
                    </div>

                    {emailCodeSent && !emailVerified && (
                        <div className="bg-green-50 p-4 rounded-lg border border-green-100 animate-in fade-in slide-in-from-top-2">
                            <p className="text-xs text-green-600 mb-2 font-semibold italic text-center">Check your inbox for the 6-digit code</p>
                            <div className="flex gap-2 items-center">
                                <input
                                    id="reg-email-code"
                                    name="emailCode"
                                    type="text"
                                    inputMode="numeric"
                                    maxLength={6}
                                    value={formData.emailCode}
                                    onChange={e => setFormData({ ...formData, emailCode: e.target.value })}
                                    className="w-40 border p-2 rounded-lg text-center tracking-widest font-mono"
                                    placeholder="000000"
                                />
                                <button type="button" onClick={handleVerifyEmail} className="bg-green-600 text-white px-6 py-2 rounded-lg hover:bg-green-700 font-medium">Verify Email</button>
                            </div>
                        </div>
                    )}
                    {emailVerified && <div className="text-green-600 text-sm font-medium">✓ Email verified successfully</div>}
                </div>
            </StepCard>

            <StepCard number={2} title="Mobile Verification" isActive={step === 2} isCompleted={step > 2} setStep={setStep}>
                <div className="space-y-4">
                    <label htmlFor="reg-phone" className="block text-sm font-medium">Mobile Number</label>
                    <div className="flex gap-2">
                        <input
                            id="reg-phone"
                            name="phone"
                            type="tel"
                            autoComplete="tel"
                            value={formData.phone}
                            onChange={e => setFormData({ ...formData, phone: e.target.value })}
                            className="flex-1 border p-2.5 rounded-lg focus:ring-2 focus:ring-green-500 outline-none"
                            placeholder="+386 00 000 000"
                        />
                        <button
                            type="button"
                            onClick={handleSendPhoneCode}
                            disabled={loading || !formData.phone}
                            className="bg-gray-900 text-white px-4 rounded-lg hover:bg-black disabled:opacity-50 transition-colors"
                        >
                            {phoneCodeSent ? 'Resend SMS' : 'Send SMS'}
                        </button>
                    </div>
                    {phoneCodeSent && !phoneVerified && (
                        <div className="bg-green-50 p-4 rounded-lg border border-green-100 animate-in fade-in slide-in-from-top-2">
                            <p className="text-xs text-green-600 mb-2 font-semibold italic text-center">Check your phone for the 6-digit code</p>
                            <div className="flex gap-2 items-center">
                                <input
                                    id="reg-phone-code"
                                    name="phoneCode"
                                    type="text"
                                    inputMode="numeric"
                                    maxLength={6}
                                    value={formData.phoneCode}
                                    onChange={e => setFormData({ ...formData, phoneCode: e.target.value })}
                                    className="w-40 border p-2 rounded-lg text-center tracking-widest font-mono"
                                    placeholder="000000"
                                />
                                <button type="button" onClick={handleVerifyPhone} className="bg-green-600 text-white px-6 py-2 rounded-lg hover:bg-green-700 font-medium">Verify Phone</button>
                            </div>
                        </div>
                    )}
                    {phoneVerified && <div className="text-green-600 text-sm font-medium">✓ Phone verified successfully</div>}
                </div>
            </StepCard>

            <StepCard number={3} title="Personal Details" isActive={step === 3} isCompleted={step > 3} setStep={setStep}>
                <div className="grid md:grid-cols-2 gap-4">
                    <div className="space-y-1">
                        <label htmlFor="reg-fname" className="text-xs font-medium text-gray-500">First Name</label>
                        <input id="reg-fname" name="firstName" autoComplete="given-name" className="w-full border p-2.5 rounded-lg focus:ring-2 focus:ring-green-500 outline-none" value={formData.firstName} onChange={e => setFormData(prev => ({ ...prev, firstName: e.target.value }))} />
                    </div>
                    <div className="space-y-1">
                        <label htmlFor="reg-lname" className="text-xs font-medium text-gray-500">Last Name</label>
                        <input id="reg-lname" name="lastName" autoComplete="family-name" className="w-full border p-2.5 rounded-lg focus:ring-2 focus:ring-green-500 outline-none" value={formData.lastName} onChange={e => setFormData(prev => ({ ...prev, lastName: e.target.value }))} />
                    </div>
                    <div className="space-y-1">
                        <label htmlFor="reg-dob" className="text-xs font-medium text-gray-500">Date of Birth <span className="text-red-500">*</span></label>
                        <input id="reg-dob" name="dob" type="date" autoComplete="bday" className="w-full border p-2.5 rounded-lg focus:ring-2 focus:ring-green-500 outline-none" value={formData.dob} onChange={e => setFormData(prev => ({ ...prev, dob: e.target.value }))} />
                        <p className="text-[11px] text-gray-500 py-1">
                            Your date of birth is required to confirm you meet the minimum age requirement (18+) for this service.
                        </p>
                    </div>
                    <div className="space-y-1">
                        <label htmlFor="reg-occ" className="text-xs font-medium text-gray-500">Occupation (Optional)</label>
                        <input id="reg-occ" name="occupation" className="w-full border p-2.5 rounded-lg focus:ring-2 focus:ring-green-500 outline-none" value={formData.occupation} onChange={e => setFormData(prev => ({ ...prev, occupation: e.target.value }))} />
                    </div>
                    <div className="md:col-span-2 pt-2">
                        <button type="button" onClick={() => { generateUsername(); setStep(4); }} className="w-full bg-blue-600 text-white py-2.5 rounded-lg font-medium hover:bg-blue-700 transition-colors">Continue</button>
                    </div>
                </div>
            </StepCard>

            <StepCard number={4} title="Address" isActive={step === 4} isCompleted={step > 4} setStep={setStep}>
                <div className="space-y-4">
                    <label htmlFor="reg-address" className="sr-only">Street Address</label>
                    <input
                        id="reg-address"
                        name="address"
                        ref={addressInputRef}
                        placeholder="Street Address"
                        autoComplete="street-address"
                        className="w-full border p-2.5 rounded-lg focus:ring-2 focus:ring-green-500 outline-none"
                        value={formData.address}
                        onChange={e => setFormData(prev => ({ ...prev, address: e.target.value }))}
                    />
                    <div className="flex gap-4">
                        <label htmlFor="reg-city" className="sr-only">City</label>
                        <input id="reg-city" name="city" autoComplete="address-level2" placeholder="City" className="flex-1 border p-2.5 rounded-lg" value={formData.city} onChange={e => setFormData(prev => ({ ...prev, city: e.target.value }))} />
                        <label htmlFor="reg-zip" className="sr-only">ZIP</label>
                        <input id="reg-zip" name="postalCode" autoComplete="postal-code" placeholder="ZIP" className="w-24 border p-2.5 rounded-lg" value={formData.postalCode} onChange={e => setFormData(prev => ({ ...prev, postalCode: e.target.value }))} />
                    </div>
                    <label htmlFor="reg-country" className="sr-only">Country</label>
                    <select id="reg-country" name="country" autoComplete="country" className="w-full border p-2.5 rounded-lg bg-white" value={formData.country} onChange={e => setFormData(prev => ({ ...prev, country: e.target.value }))}>
                        <option value="SI">Slovenia</option>
                        <option value="DE">Germany</option>
                        <option value="HR">Croatia</option>
                        <option value="AT">Austria</option>
                        <option value="IT">Italy</option>
                    </select>
                    <button type="button" onClick={validateAddress} className="w-full bg-blue-600 text-white py-2.5 rounded-lg font-medium hover:bg-blue-700 transition-colors">Validate Address</button>
                </div>
            </StepCard>

            <StepCard number={5} title="Account Security" isActive={step === 5} isCompleted={step > 5} setStep={setStep}>
                <div className="space-y-4">
                    <div>
                        <label htmlFor="reg-username" className="block text-xs font-medium text-gray-500 mb-1">Username (Auto-suggested)</label>
                        <div className="flex gap-2">
                            <input id="reg-username" name="username" autoComplete="username" className="flex-1 border p-2.5 rounded-lg bg-gray-50" value={formData.username} onChange={e => setFormData(prev => ({ ...prev, username: e.target.value }))} />
                            <button type="button" onClick={generateUsername} className="text-xs text-blue-600 underline">Regenerate</button>
                        </div>
                    </div>
                    <div className="grid md:grid-cols-2 gap-4">
                        <div>
                            <label htmlFor="reg-pwd" className="sr-only">Password</label>
                            <input id="reg-pwd" name="password" type="password" autoComplete="new-password" placeholder="Password" className="w-full border p-2.5 rounded-lg" value={formData.password} onChange={e => setFormData(prev => ({ ...prev, password: e.target.value }))} />
                        </div>
                        <div>
                            <label htmlFor="reg-pwd-confirm" className="sr-only">Confirm Password</label>
                            <input id="reg-pwd-confirm" name="confirmPassword" type="password" autoComplete="new-password" placeholder="Confirm Password" className="w-full border p-2.5 rounded-lg" value={formData.confirmPassword} onChange={e => setFormData(prev => ({ ...prev, confirmPassword: e.target.value }))} />
                        </div>
                    </div>
                    <button type="button" onClick={() => setStep(6)} className="w-full bg-blue-600 text-white py-2.5 rounded-lg font-medium hover:bg-blue-700 transition-colors">Proceed to Review</button>
                </div>
            </StepCard>

            <StepCard number={6} title="Review & Policies" isActive={step === 6} isCompleted={false} setStep={setStep}>
                <div className="space-y-6">
                    {/* REVIEW SECTION */}
                    <div className="bg-gray-50 rounded-xl p-4 border text-sm space-y-3">
                        <h4 className="font-bold text-gray-700 border-b pb-2">Review Your Information</h4>
                        <div className="grid grid-cols-2 gap-x-4 gap-y-2">
                            <div>
                                <span className="block text-xs text-gray-500">Name</span>
                                <span className="font-medium">{formData.firstName} {formData.lastName}</span>
                            </div>
                            <div>
                                <span className="block text-xs text-gray-500">Contact</span>
                                <span className="font-medium">{formData.email}<br />{formData.phone}</span>
                            </div>
                            <div>
                                <span className="block text-xs text-gray-500">Username</span>
                                <span className="font-medium">{formData.username}</span>
                            </div>
                            <div>
                                <span className="block text-xs text-gray-500">Address</span>
                                <span className="font-medium">{formData.address}, {formData.city}</span>
                            </div>
                        </div>
                        <button onClick={() => setStep(3)} className="text-xs text-blue-600 hover:underline mt-2">Edit Details</button>
                    </div>

                    <div className="p-4 rounded-lg text-sm text-gray-600 space-y-3">
                        <label className="flex items-start gap-3 cursor-pointer">
                            <input id="check-terms" name="terms" type="checkbox" className="mt-1 w-4 h-4 text-green-600 rounded" checked={formData.terms} onChange={e => setFormData(prev => ({ ...prev, terms: e.target.checked }))} />
                            <span>I agree to the <a href="#" className="text-blue-600 hover:underline">Terms & Conditions</a> and <a href="#" className="text-blue-600 hover:underline">Acceptable Use Policy</a>.</span>
                        </label>
                        <label className="flex items-start gap-3 cursor-pointer">
                            <input id="check-privacy" name="privacy" type="checkbox" className="mt-1 w-4 h-4 text-green-600 rounded" checked={formData.privacy} onChange={e => setFormData(prev => ({ ...prev, privacy: e.target.checked }))} />
                            <span>I acknowledge the <a href="#" className="text-blue-600 hover:underline">Privacy Policy</a> and understand how my data is processed.</span>
                        </label>
                        <div className="border-t pt-2 mt-2">
                            <label className="flex items-start gap-3 cursor-pointer">
                                <input id="check-newsletter" name="newsletter" type="checkbox" className="mt-1 w-4 h-4 text-green-600 rounded" checked={formData.newsletter} onChange={e => setFormData(prev => ({ ...prev, newsletter: e.target.checked }))} />
                                <span>Subscribe to our **Newsletter** for latest news and updates.</span>
                            </label>
                            <label className="flex items-start gap-3 cursor-pointer mt-2">
                                <input id="check-marketing" name="marketing" type="checkbox" className="mt-1 w-4 h-4 text-green-600 rounded" checked={formData.marketing} onChange={e => setFormData(prev => ({ ...prev, marketing: e.target.checked }))} />
                                <span>I agree to receive **Promotional Pricing** and special offers.</span>
                            </label>
                        </div>
                    </div>
                    <button
                        type="button"
                        onClick={handleSubmit}
                        disabled={!formData.terms || !formData.privacy || loading}
                        className="w-full bg-green-600 text-white py-3.5 rounded-xl font-bold text-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed shadow-md hover:shadow-lg transition-all"
                    >
                        {loading ? 'Creating Account...' : 'Confirm & Create Account'}
                    </button>
                </div>
            </StepCard>
        </div>
    )
}

// DEFINED OUTSIDE TO PREVENT RE-RENDERS LOSING FOCUS
const StepCard = ({ number, title, isActive, isCompleted, children, setStep }: any) => (
    <div className={`border rounded-xl mb-4 transition-all duration-300 ${isActive ? 'ring-2 ring-green-500 shadow-lg bg-white' : 'bg-gray-50 opacity-70'}`}>
        <div className="p-4 flex items-center justify-between cursor-pointer" onClick={() => isCompleted && setStep(number)}>
            <div className="flex items-center gap-3">
                <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold ${isCompleted ? 'bg-green-600 text-white' : isActive ? 'bg-green-100 text-green-700' : 'bg-gray-200 text-gray-500'}`}>
                    {isCompleted ? '✓' : number}
                </div>
                <h3 className={`font-semibold ${isActive ? 'text-gray-900' : 'text-gray-500'}`}>{title}</h3>
            </div>
        </div>
        {isActive && <div className="p-4 pt-0">{children}</div>}
    </div>
)
