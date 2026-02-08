import SupportMessagingWindow from '@/components/support/SupportMessagingWindow'

export default function ContactPage() {
    return (
        <div className="max-w-6xl mx-auto py-12 px-4 sm:px-6 lg:py-20 lg:px-8">
            <div className="grid lg:grid-cols-2 gap-12 lg:gap-16 items-start">
                {/* Left Side: Contact Info */}
                <div className="space-y-8">
                    <div>
                        <h1 className="text-4xl font-extrabold text-gray-900 tracking-tight sm:text-5xl">
                            Contact Sales
                        </h1>
                        <p className="mt-4 text-lg text-gray-500 max-w-3xl">
                            Looking for volume pricing or have questions about your solar installation? Our sales and technical team are ready to help.
                        </p>
                    </div>

                    <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-1">
                        <div className="flex gap-4 p-6 bg-blue-50 rounded-2xl border border-blue-100 transition hover:shadow-md">
                            <div className="flex-shrink-0 w-12 h-12 bg-blue-600 rounded-xl flex items-center justify-center text-white text-2xl shadow-lg shadow-blue-200">
                                ✉️
                            </div>
                            <div>
                                <h3 className="font-bold text-gray-900">Email us</h3>
                                <p className="text-sm text-gray-500 mb-2">Direct response within 2-4h</p>
                                <a href="mailto:support@tigoenergy.shop" className="text-blue-600 font-semibold hover:underline">support@tigoenergy.shop</a>
                            </div>
                        </div>

                        <div className="flex gap-4 p-6 bg-green-50 rounded-2xl border border-green-100 transition hover:shadow-md">
                            <div className="flex-shrink-0 w-12 h-12 bg-green-600 rounded-xl flex items-center justify-center text-white text-2xl shadow-lg shadow-green-200">
                                📞
                            </div>
                            <div>
                                <h3 className="font-bold text-gray-900">Call us</h3>
                                <p className="text-sm text-gray-500 mb-2">Mon-Fri, 9am - 5pm CET</p>
                                <a href="tel:+38640123456" className="text-green-700 font-semibold hover:underline">+386 40 123 456</a>
                            </div>
                        </div>

                        <div className="flex gap-4 p-6 bg-gray-50 rounded-2xl border border-gray-100 transition hover:shadow-md">
                            <div className="flex-shrink-0 w-12 h-12 bg-gray-800 rounded-xl flex items-center justify-center text-white text-2xl shadow-lg shadow-gray-200">
                                📍
                            </div>
                            <div>
                                <h3 className="font-bold text-gray-900">Our Hub</h3>
                                <p className="text-sm text-gray-500 mb-2">Distribution center</p>
                                <p className="text-gray-600 leading-relaxed">
                                    Podsmreka 59A<br />
                                    1356 Dobrova, Slovenia
                                </p>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Right Side: Rebranded Messenger Window */}
                <div className="relative">
                    <div className="absolute -inset-4 bg-gradient-to-tr from-blue-500 to-green-500 rounded-[2rem] opacity-10 blur-2xl -z-10"></div>
                    <SupportMessagingWindow
                        type="sales"
                        title="Contact Tigo Sales"
                    />
                </div>
            </div>
        </div>
    )
}
