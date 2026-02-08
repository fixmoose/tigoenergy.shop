export default function ContactPage() {
    return (
        <div className="max-w-4xl mx-auto py-16 px-4">
            <h1 className="text-3xl font-bold mb-8">Contact Us</h1>
            <div className="grid md:grid-cols-2 gap-12">
                <div>
                    <p className="text-gray-600 mb-6">Need help with your solar project? Our team is here to assist you.</p>
                    <div className="space-y-4">
                        <div>
                            <h3 className="font-semibold">Email</h3>
                            <a href="mailto:support@tigoenergy.shop" className="text-blue-600">support@tigoenergy.shop</a>
                        </div>
                        <div>
                            <h3 className="font-semibold">Phone</h3>
                            <p className="text-gray-600">+386 40 123 456</p>
                        </div>
                        <div>
                            <h3 className="font-semibold">Address</h3>
                            <p className="text-gray-600">Podsmreka 59A, 1356 Dobrova, Slovenia</p>
                        </div>
                    </div>
                </div>
                <div className="bg-gray-50 p-8 rounded-xl border">
                    <h2 className="text-xl font-bold mb-6">Send us a message</h2>
                    <form className="space-y-4">
                        <input type="text" placeholder="Name" className="w-full border p-2.5 rounded-lg" />
                        <input type="email" placeholder="Email" className="w-full border p-2.5 rounded-lg" />
                        <textarea placeholder="Message" className="w-full border p-2.5 rounded-lg h-32"></textarea>
                        <button type="submit" className="w-full bg-blue-600 text-white py-2.5 rounded-lg font-medium">Send Message</button>
                    </form>
                </div>
            </div>
        </div>
    )
}
