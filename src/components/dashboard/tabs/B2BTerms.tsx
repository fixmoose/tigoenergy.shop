'use client'
import { Customer } from '@/types/database'

interface Props {
    customer: Customer
}

export default function B2BTerms({ customer }: Props) {
    return (
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
            <div className="p-6 border-b border-gray-50 bg-gray-50/50 flex justify-between items-center">
                <div className="flex items-center gap-3">
                    <div className="w-8 h-8 bg-blue-100 text-blue-700 rounded-lg flex items-center justify-center">
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
                    </div>
                    <h3 className="font-bold text-lg text-gray-900">Commercial Terms & Conditions</h3>
                </div>
                <button
                    onClick={() => window.print()}
                    className="text-xs font-bold text-gray-400 hover:text-gray-600 flex items-center gap-1 transition-colors"
                >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" /></svg>
                    Print PDF
                </button>
            </div>

            <div className="p-8 max-h-[800px] overflow-y-auto custom-scrollbar prose prose-sm max-w-none text-gray-600">
                <div className="mb-8 p-4 bg-blue-50 border border-blue-100 rounded-xl text-blue-800 text-xs leading-relaxed">
                    <p className="font-bold mb-1">Agreement Notice:</p>
                    These terms and conditions apply to all commercial sales between <strong>Initra Energija d.o.o.</strong> ("Seller") and <strong>{customer.company_name || 'Client'}</strong> ("Buyer"). By placing an order, the Buyer acknowledges and agrees to these terms.
                </div>

                <h1 className="text-xl font-black text-gray-900 mb-6 uppercase tracking-tight border-b-2 border-gray-100 pb-2">Tigo Energy Commercial Terms and Conditions</h1>

                <section className="mb-8">
                    <h2 className="text-sm font-bold text-gray-900 uppercase tracking-widest mb-4 flex items-center gap-2">
                        <span className="w-6 h-6 bg-gray-900 text-white rounded text-[10px] flex items-center justify-center shrink-0">1</span>
                        Offer, Confirmation or Agreement
                    </h2>
                    <div className="pl-8 space-y-3">
                        <p>a) These terms and conditions (“Terms and Conditions”) of commercial sale for products of Tigo Energy, Inc. ("TIGO") apply to and form an integral part of all quotations and offers made by TIGO, all acceptances, acknowledgements, and confirmations by TIGO of any orders by a buyer (“Buyer”) and any agreements (each an “Agreement,” and collectively the “Agreements”) regarding the sale by TIGO and purchase by Buyer of TIGO’s products (“Products”), unless and to the extent TIGO explicitly agrees otherwise in writing.</p>
                        <p>b) Any terms and conditions set forth on any document or documents (including but not limited to purchase orders) issued by Buyer or TIGO either before or after issuance of these Terms and Conditions, or any document setting forth or referring to these Terms and Conditions, are hereby explicitly rejected and disregarded by TIGO, and any such terms shall be wholly inapplicable to any sale of the Products made by TIGO to Buyer and shall not be binding in any way on TIGO.</p>
                        <p>c) TIGO’s offers are open for acceptance for thirty (30) days from the date of the offer, unless stated otherwise, but any offer may be modified, withdrawn, or revoked by TIGO at any time prior to the actual receipt and confirmation by TIGO of Buyer’s acceptance thereof.</p>
                    </div>
                </section>

                <section className="mb-8">
                    <h2 className="text-sm font-bold text-gray-900 uppercase tracking-widest mb-4 flex items-center gap-2">
                        <span className="w-6 h-6 bg-gray-900 text-white rounded text-[10px] flex items-center justify-center shrink-0">2</span>
                        Pricing
                    </h2>
                    <div className="pl-8 space-y-3">
                        <p>a) Pricing for the goods sold hereunder shall be determined by TIGO in its sole discretion and except with respect to the prices of Products being sold under the terms of already accepted purchase orders, may be changed at any time by TIGO on notice to Buyer. Unless otherwise specified by TIGO, prices for such Products are for the quantity specified and do not include charges for transportation, insurance, special packaging, marking, applicable sale service taxes, value added taxes, export or import licenses, fees, taxes, duties and the like; Buyer shall bear the cost of such charges in addition to the prices invoiced.</p>
                    </div>
                </section>

                <section className="mb-8">
                    <h2 className="text-sm font-bold text-gray-900 uppercase tracking-widest mb-4 flex items-center gap-2">
                        <span className="w-6 h-6 bg-gray-900 text-white rounded text-[10px] flex items-center justify-center shrink-0">3</span>
                        Payment
                    </h2>
                    <div className="pl-8 space-y-3">
                        <p>a) Unless Buyer’s credit is preapproved by TIGO in writing, Buyer will prepay for all accepted orders for the Products invoiced by TIGO. Regardless of Buyer’s credit approval, Buyer shall prepay for all accepted orders of custom Products. If TIGO grants credit to Buyer for non-custom Products, net payment is due in accordance with the payment terms specified on the invoice provided to Buyer.</p>
                        <p>b) Upon TIGO’s notification to Buyer that Products pursuant to an accepted order are available for pick-up, Buyer shall promptly, and in no event more than fifteen (15) days from the date of such notification, retrieve such Products.</p>
                        <div className="bg-red-50 p-4 border-l-4 border-red-500 text-red-900 font-bold mb-4">
                            c) ALL ORDERS FOR CUSTOM PRODUCTS ARE NOT CANCELLABLE FROM THE TIME OF TIGO’S ACCEPTANCE OF SUCH ORDER.
                        </div>
                    </div>
                </section>

                <section className="mb-8">
                    <h2 className="text-sm font-bold text-gray-900 uppercase tracking-widest mb-4 flex items-center gap-2">
                        <span className="w-6 h-6 bg-gray-900 text-white rounded text-[10px] flex items-center justify-center shrink-0">4</span>
                        Delivery and Quantities
                    </h2>
                    <div className="pl-8 space-y-3">
                        <p>a) Products shall be delivered Ex Works (Incoterms 2020) TIGO’s manufacturing facility or other location designated by TIGO, unless otherwise agreed in writing.</p>
                        <p>d) Title to the Products shall pass to Buyer upon initial receipt of Products by Buyer or its agent.</p>
                    </div>
                </section>

                <section className="mb-8">
                    <h2 className="text-sm font-bold text-gray-900 uppercase tracking-widest mb-4 flex items-center gap-2">
                        <span className="w-6 h-6 bg-gray-900 text-white rounded text-[10px] flex items-center justify-center shrink-0">5</span>
                        Ownership Rights
                    </h2>
                    <div className="pl-8 space-y-3">
                        <p>a) TIGO’s design, development, manufacture, or sale of the Products for Buyer shall not be deemed to produce a work made for hire and shall not give a Buyer any intellectual property right interest in the Products or any portion thereof.</p>
                    </div>
                </section>

                <section className="mb-8">
                    <h2 className="text-sm font-bold text-gray-900 uppercase tracking-widest mb-4 flex items-center gap-2">
                        <span className="w-6 h-6 bg-gray-900 text-white rounded text-[10px] flex items-center justify-center shrink-0">7</span>
                        Limited Warranty and Disclaimer
                    </h2>
                    <div className="pl-8 space-y-3">
                        <p>a) TIGO warrants that under normal use in accordance with the intended use, the Products, at the time of delivery to Buyer and for a period specified by TIGO’s standard limited warranty, will be free from defects in material or workmanship.</p>
                        <p className="font-bold underline uppercase">TIGO MAKES NO WARRANTY THAT THE PRODUCTS WILL BE MERCHANTABLE OR FIT FOR ANY PARTICULAR PURPOSE.</p>
                    </div>
                </section>

                <section className="mb-8">
                    <h2 className="text-sm font-bold text-gray-900 uppercase tracking-widest mb-4 flex items-center gap-2">
                        <span className="w-6 h-6 bg-gray-900 text-white rounded text-[10px] flex items-center justify-center shrink-0">13</span>
                        Limitation of Liability
                    </h2>
                    <div className="pl-8 space-y-3">
                        <p>IN NO EVENT SHALL TIGO BE LIABLE FOR COSTS OF PROCUREMENT OF SUBSTITUTE GOODS OR SERVICES BY BUYER. EXCEPT AS OTHERWISE PROVIDED BY APPLICABLE LAW, NEITHER PARTY SHALL BE LIABLE TO THE OTHER FOR INCIDENTAL, INDIRECT, SPECIAL, CONSEQUENTIAL, EXEMPLARY OR RELIANCE DAMAGES.</p>
                    </div>
                </section>

                <div className="mt-12 pt-8 border-t border-gray-100 flex flex-col items-center">
                    <div className="w-full max-w-sm border-b-2 border-gray-200 mb-2"></div>
                    <p className="text-[10px] font-bold text-gray-400">Buyer Signature (Acknowledged Electronically via Dashboard Access)</p>
                    <p className="text-xs text-gray-500 mt-2">Authenticated on: {new Date().toLocaleDateString()}</p>
                </div>
            </div>
        </div>
    )
}
