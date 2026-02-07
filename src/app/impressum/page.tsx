import React from 'react'
import Link from 'next/link'

export default function ImpressumPage() {
    return (
        <div className="min-h-screen bg-gray-50 py-12">
            <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
                <div className="bg-white rounded-lg shadow-sm p-8">
                    <h1 className="text-3xl font-bold text-gray-900 mb-8">Impressum</h1>

                    {/* Company Information */}
                    <section className="mb-8">
                        <h2 className="text-2xl font-semibold text-gray-900 mb-4">Company Information</h2>
                        <div className="space-y-2 text-gray-700">
                            <p className="font-medium text-lg">Initra Energija d.o.o.</p>
                            <p>VAT Number: SI62518313</p>
                            <p>Registration Number: 9624007000</p>
                        </div>
                    </section>

                    {/* Contact Information */}
                    <section className="mb-8">
                        <h2 className="text-2xl font-semibold text-gray-900 mb-4">Contact Information</h2>
                        <div className="space-y-2 text-gray-700">
                            <p>Email: <a href="mailto:support@tigoenergy.shop" className="text-green-600 hover:text-green-700">support@tigoenergy.shop</a></p>
                            <p>Website: <a href="https://tigoenergy.shop" className="text-green-600 hover:text-green-700">tigoenergy.shop</a></p>
                        </div>
                    </section>

                    {/* Authorization */}
                    <section className="mb-8">
                        <h2 className="text-2xl font-semibold text-gray-900 mb-4">Authorized Tigo Energy Distributor</h2>
                        <div className="space-y-4 text-gray-700">
                            <p>
                                Initra Energija d.o.o. is an <strong>authorized distributor</strong> of Tigo Energy products in Europe.
                                We specialize exclusively in Tigo Energy solutions, ensuring expert knowledge and authentic products.
                            </p>
                            <p>
                                As a direct distributor, we offer:
                            </p>
                            <ul className="list-disc list-inside space-y-2 ml-4">
                                <li>100% genuine Tigo Energy products with full manufacturer warranty</li>
                                <li>Direct pricing without hidden costs or intermediary markups</li>
                                <li>Expert technical support and product guidance</li>
                                <li>Fast and reliable shipping across Europe</li>
                                <li>Secure online purchasing with buyer protection</li>
                            </ul>
                            <p className="mt-4">
                                When you purchase from us, you're buying directly from an authorized source, ensuring product authenticity,
                                warranty coverage, and access to the latest Tigo Energy innovations.
                            </p>
                        </div>
                    </section>

                    {/* Responsible for Content */}
                    <section className="mb-8">
                        <h2 className="text-2xl font-semibold text-gray-900 mb-4">Responsible for Content</h2>
                        <p className="text-gray-700">
                            Initra Energija d.o.o. is responsible for all content published on this website.
                        </p>
                    </section>

                    {/* Disclaimer */}
                    <section className="mb-8">
                        <h2 className="text-2xl font-semibold text-gray-900 mb-4">Disclaimer</h2>
                        <div className="space-y-4 text-gray-700">
                            <p>
                                Despite careful content control, we assume no liability for the content of external links.
                                The operators of the linked pages are solely responsible for their content.
                            </p>
                            <p>
                                All product names, logos, and brands are property of their respective owners. Tigo Energy®
                                is a registered trademark of Tigo Energy, Inc.
                            </p>
                        </div>
                    </section>

                    {/* Copyright */}
                    <section className="mb-8">
                        <h2 className="text-2xl font-semibold text-gray-900 mb-4">Copyright</h2>
                        <p className="text-gray-700">
                            The content and works created by the site operators on these pages are subject to copyright law.
                            Duplication, processing, distribution, or any form of commercialization beyond the scope of
                            copyright law requires prior written consent.
                        </p>
                    </section>

                    {/* Additional Legal Pages */}
                    <section className="pt-6 border-t border-gray-200">
                        <p className="text-sm text-gray-600 mb-3">For more information, please see:</p>
                        <div className="flex flex-wrap gap-4">
                            <Link href="/privacy" className="text-green-600 hover:text-green-700 text-sm">Privacy Policy</Link>
                            <Link href="/terms" className="text-green-600 hover:text-green-700 text-sm">Terms of Service</Link>
                            <Link href="/cookies" className="text-green-600 hover:text-green-700 text-sm">Cookie Policy</Link>
                        </div>
                    </section>
                </div>
            </div>
        </div>
    )
}
