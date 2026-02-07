'use client'

import React, { useState } from 'react'
import { useRecaptcha } from '@/hooks/useRecaptcha'
import { testVerifyToken } from '@/app/actions/test-recaptcha'

export default function TestRecaptchaPage() {
    const [result, setResult] = useState<any>(null)
    const [loading, setLoading] = useState(false)
    const [actionName, setActionName] = useState('TEST_EVENT')
    const { recaptchaRef, resetRecaptcha, execute } = useRecaptcha()

    const handleTest = async () => {
        setLoading(true)
        setResult(null)
        try {
            console.log(`Triggering reCAPTCHA with action: ${actionName}...`)
            const token = await execute(actionName)
            console.log('Token received:', token.substring(0, 20) + '...')

            const verifyResult = await testVerifyToken(token, actionName)
            setResult(verifyResult)
        } catch (err: any) {
            setResult({ success: false, error: err.message })
            resetRecaptcha()
        } finally {
            setLoading(false)
        }
    }

    return (
        <div className="p-8 max-w-2xl mx-auto mt-10 bg-white rounded-3xl shadow-2xl border border-gray-100">
            <h1 className="text-3xl font-bold text-gray-900 mb-6">🛡️ reCAPTCHA v3 Tester</h1>

            <div className="space-y-6">
                <div className="bg-blue-50 p-4 rounded-2xl border border-blue-100">
                    <p className="text-sm text-blue-800">
                        This page allows you to trigger a real reCAPTCHA v3 event.
                        Clicking the button will generate a token and send it to your backend for verification.
                    </p>
                </div>

                <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">Test Action Name</label>
                    <input
                        type="text"
                        value={actionName}
                        onChange={(e) => setActionName(e.target.value.toUpperCase())}
                        className="w-full p-3 rounded-xl border border-gray-200 focus:ring-2 focus:ring-blue-500 outline-none font-mono"
                    />
                </div>

                <div className="py-2">
                    <div ref={recaptchaRef}></div>
                    <p className="text-xs text-gray-400 mt-2">
                        Note: The reCAPTCHA badge should appear in the bottom right.
                    </p>
                </div>

                <button
                    onClick={handleTest}
                    disabled={loading}
                    className="w-full bg-blue-600 text-white font-bold py-4 rounded-2xl hover:bg-blue-700 transition shadow-lg shadow-blue-100 disabled:opacity-50"
                >
                    {loading ? 'Verifying...' : '🚀 Trigger Test Event'}
                </button>

                {result && (
                    <div className={`p-6 rounded-2xl border ${result.success ? 'bg-green-50 border-green-100' : 'bg-red-50 border-red-100'}`}>
                        <h3 className={`font-bold mb-2 ${result.success ? 'text-green-800' : 'text-red-800'}`}>
                            {result.success ? '✅ Success!' : '❌ Verification Failed'}
                        </h3>
                        <pre className="text-xs overflow-auto bg-white/50 p-3 rounded-xl border border-black/5 max-h-64">
                            {JSON.stringify(result, null, 2)}
                        </pre>
                        {result.success && (
                            <p className="text-sm text-green-700 mt-3 italic">
                                reCAPTCHA verification passed successfully.
                            </p>
                        )}
                    </div>
                )}
            </div>
        </div>
    )
}
