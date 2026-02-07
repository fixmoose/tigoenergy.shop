'use client'
import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Customer } from '@/types/database'

interface Props {
    customer: Customer
}

export default function MarketingPreferences({ customer }: Props) {
    const supabase = createClient()
    const [loading, setLoading] = useState(false)
    const [success, setSuccess] = useState('')
    const [formData, setFormData] = useState({
        newsletter: customer.newsletter_subscribed || false,
        marketing: customer.marketing_consent || false
    })

    const handleSave = async () => {
        setLoading(true)
        setSuccess('')

        const { error } = await supabase
            .from('customers')
            .update({
                newsletter_subscribed: formData.newsletter,
                marketing_consent: formData.marketing,
                updated_at: new Date().toISOString()
            })
            .eq('id', customer.id)

        setLoading(false)

        if (error) {
            console.error(error)
            alert('Failed to update preferences.')
        } else {
            setSuccess('Preferences updated successfully!')
            setTimeout(() => setSuccess(''), 3000)
        }
    }

    return (
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-8 max-w-2xl">
            <h2 className="text-xl font-bold text-gray-900 mb-6 flex items-center gap-2">
                <svg className="w-6 h-6 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M11 5.882V19.24a1.76 1.76 0 01-3.417.592l-2.147-6.15M18 13a3 3 0 100-6M5.436 13.683A4.001 4.001 0 017 6h1.832c4.1 0 7.625-1.234 9.168-3v14c-1.543-1.766-5.067-3-9.168-3H7a3.988 3.988 0 01-1.564-.317z" /></svg>
                Communication Preferences
            </h2>

            <div className="space-y-6">

                {/* Newsletter */}
                <div className="flex items-start gap-4 p-4 border rounded-xl hover:bg-gray-50 transition-colors">
                    <div className="pt-1">
                        <input
                            type="checkbox"
                            className="w-5 h-5 text-green-600 rounded focus:ring-green-500 cursor-pointer"
                            checked={formData.newsletter}
                            onChange={(e) => setFormData({ ...formData, newsletter: e.target.checked })}
                        />
                    </div>
                    <div>
                        <h3 className="font-semibold text-gray-900">Weekly Newsletter</h3>
                        <p className="text-sm text-gray-500 mt-1">Receive updates about new Tigo products, industry news, and solar installation tips.</p>
                    </div>
                </div>

                {/* Marketing */}
                <div className="flex items-start gap-4 p-4 border rounded-xl hover:bg-gray-50 transition-colors">
                    <div className="pt-1">
                        <input
                            type="checkbox"
                            className="w-5 h-5 text-green-600 rounded focus:ring-green-500 cursor-pointer"
                            checked={formData.marketing}
                            onChange={(e) => setFormData({ ...formData, marketing: e.target.checked })}
                        />
                    </div>
                    <div>
                        <h3 className="font-semibold text-gray-900">Promotions & Offers</h3>
                        <p className="text-sm text-gray-500 mt-1">Be the first to know about special discounts, seasonal sales, and exclusive B2C offers.</p>
                    </div>
                </div>

                <div className="pt-4 flex items-center gap-4">
                    <button
                        onClick={handleSave}
                        disabled={loading}
                        className="bg-gray-900 text-white px-6 py-2.5 rounded-lg font-medium hover:bg-black transition disabled:opacity-50"
                    >
                        {loading ? 'Saving...' : 'Save Preferences'}
                    </button>
                    {success && <span className="text-green-600 font-medium text-sm animate-in fade-in">{success}</span>}
                </div>
            </div>
        </div>
    )
}
