import SupportMessagingWindow from '@/components/support/SupportMessagingWindow'

export default function ContactPage() {
    return (
        <div className="min-h-[80vh] bg-gray-50 flex flex-col items-center justify-center py-12 px-4 sm:px-6 lg:px-8">
            <div className="max-w-xl w-full space-y-8 text-center mb-8">
                <h1 className="text-4xl font-extrabold text-gray-900 tracking-tight sm:text-5xl">
                    Contact Sales
                </h1>
                <p className="text-lg text-gray-500">
                    Looking for volume pricing or have questions about your solar installation?
                    Verify your email below to start a conversation with our sales team.
                </p>
            </div>

            <div className="w-full max-w-md relative">
                <div className="absolute -inset-4 bg-gradient-to-tr from-blue-500 to-green-500 rounded-[2rem] opacity-10 blur-2xl -z-10"></div>
                <SupportMessagingWindow
                    type="sales"
                    title="Contact Tigo Sales"
                />
            </div>
        </div>
    )
}
