'use client'

import { useState } from 'react'

export default function AccountingReportPage() {
    const [year, setYear] = useState(new Date().getFullYear())
    const [loading, setLoading] = useState(false)

    // Function to handle export (placeholder for now)
    const handleExport = () => {
        alert('Export functionality coming soon!')
    }

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold text-slate-800">Accounting & Invoices</h1>
                    <p className="text-slate-500">Manage and export financial documents.</p>
                </div>
                <div className="flex gap-4">
                    {/* Year Selector */}
                    <select
                        value={year}
                        onChange={(e) => setYear(Number(e.target.value))}
                        className="border rounded-md px-3 py-2 text-sm bg-white"
                    >
                        <option value="2026">2026</option>
                        <option value="2025">2025</option>
                    </select>

                    <button
                        onClick={handleExport}
                        className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-700 flex items-center gap-2"
                    >
                        <span>⬇️</span> Export Invoices (CSV)
                    </button>
                </div>
            </div>

            {/* Summary Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
                    <div className="text-sm text-slate-500 mb-1">Total Revenue ({year})</div>
                    <div className="text-2xl font-bold text-slate-800">€0.00</div>
                </div>
                <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
                    <div className="text-sm text-slate-500 mb-1">Invoices Issued</div>
                    <div className="text-2xl font-bold text-slate-800">0</div>
                </div>
                <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
                    <div className="text-sm text-slate-500 mb-1">Outstanding Payments</div>
                    <div className="text-2xl font-bold text-amber-600">€0.00</div>
                </div>
            </div>

            {/* Placeholder for Invoice Table */}
            <div className="bg-white rounded-xl border border-slate-200 p-8 text-center">
                <p className="text-slate-500">Invoice list and accounting data will be displayed here.</p>
            </div>
        </div>
    )
}
