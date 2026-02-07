import SupportMessagingWindow from '@/components/support/SupportMessagingWindow'

export default function ShopSupportPage() {
    return (
        <div className="min-h-screen bg-gray-50 py-12">
            <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
                <div className="mb-8 text-center">
                    <h1 className="text-3xl font-bold text-gray-900 mb-2">Online Shop Support</h1>
                    <p className="text-gray-600">Get help with orders, shipping, and account issues via chat</p>
                </div>

                <SupportMessagingWindow type="general" />
            </div>
        </div>
    )
}
