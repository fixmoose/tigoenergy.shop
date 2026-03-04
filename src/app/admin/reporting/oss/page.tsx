'use client'

import React, { useState, useEffect, Fragment } from 'react'
import type { OSSReportData } from '@/types/compliance'

const quarters = [
  { value: 1, label: 'Q1 (Jan-Mar)' },
  { value: 2, label: 'Q2 (Apr-Jun)' },
  { value: 3, label: 'Q3 (Jul-Sep)' },
  { value: 4, label: 'Q4 (Oct-Dec)' },
]

export default function OSSPage() {
  const currentYear = new Date().getFullYear()
  const currentQuarter = Math.ceil((new Date().getMonth() + 1) / 3)

  const [year, setYear] = useState(currentYear)
  const [quarter, setQuarter] = useState(currentQuarter)
  const [report, setReport] = useState<OSSReportData | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [expandedRow, setExpandedRow] = useState<string | null>(null)

  const fetchReport = async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(`/api/admin/reporting/oss?year=${year}&quarter=${quarter}`)
      const data = await res.json()
      if (data.success) {
        setReport(data.data)
      } else {
        setError(data.error || 'Failed to load report')
      }
    } catch (err) {
      setError('Failed to fetch report')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchReport()
  }, [year, quarter])

  const downloadXML = () => {
    window.open(`/api/admin/reporting/oss?year=${year}&quarter=${quarter}&format=xml`, '_blank')
  }

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR' }).format(amount)
  }

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('en-GB', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    })
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">OSS (One Stop Shop) VAT Reporting</h1>
          <p className="text-slate-500 mt-1">Quarterly VAT returns for EU distance sales - submit to FURS</p>
        </div>
        <button
          onClick={downloadXML}
          disabled={!report || report.rows.length === 0}
          className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
        >
          <span>Download XML</span>
        </button>
      </div>

      {/* Period Selector */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-4 mb-6">
        <div className="flex items-center gap-4">
          <div>
            <label className="block text-sm font-medium text-slate-600 mb-1">Year</label>
            <select
              value={year}
              onChange={(e) => setYear(parseInt(e.target.value))}
              className="px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            >
              {[currentYear - 1, currentYear, currentYear + 1].map((y) => (
                <option key={y} value={y}>{y}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-600 mb-1">Quarter</label>
            <select
              value={quarter}
              onChange={(e) => setQuarter(parseInt(e.target.value))}
              className="px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            >
              {quarters.map((q) => (
                <option key={q.value} value={q.value}>{q.label}</option>
              ))}
            </select>
          </div>
          <button
            onClick={fetchReport}
            disabled={loading}
            className="mt-6 px-4 py-2 bg-slate-100 text-slate-700 rounded-lg hover:bg-slate-200 disabled:opacity-50"
          >
            {loading ? 'Loading...' : 'Refresh'}
          </button>
        </div>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg mb-6">
          {error}
        </div>
      )}

      {report && (
        <>
          {/* Summary Cards */}
          <div className="grid grid-cols-4 gap-4 mb-6">
            <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-4">
              <p className="text-sm text-slate-500">Taxable Amount</p>
              <p className="text-2xl font-bold text-slate-800">{formatCurrency(report.summary.total_taxable_amount)}</p>
            </div>
            <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-4">
              <p className="text-sm text-slate-500">VAT Due</p>
              <p className="text-2xl font-bold text-blue-600">{formatCurrency(report.summary.total_vat_amount)}</p>
            </div>
            <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-4">
              <p className="text-sm text-slate-500">Orders</p>
              <p className="text-2xl font-bold text-slate-800">{report.summary.total_orders}</p>
            </div>
            <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-4">
              <p className="text-sm text-slate-500">Deadline</p>
              <p className="text-2xl font-bold text-slate-800">
                {report.summary.submission_deadline ? formatDate(report.summary.submission_deadline) : '-'}
              </p>
            </div>
          </div>

          {/* Report Table */}
          <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
            <div className="px-4 py-3 border-b border-slate-200 bg-slate-50">
              <h3 className="font-semibold text-slate-800">Sales by Member State</h3>
              <p className="text-sm text-slate-500">{report.summary.countries_sold_to} countries with sales in Q{quarter} {year}</p>
            </div>
            {report.rows.length === 0 ? (
              <div className="p-8 text-center text-slate-400">
                No EU distance sales recorded for this period
              </div>
            ) : (
              <table className="w-full">
                <thead className="bg-slate-50 border-b border-slate-200">
                  <tr>
                    <th className="text-left px-4 py-3 text-sm font-medium text-slate-600">Country</th>
                    <th className="text-right px-4 py-3 text-sm font-medium text-slate-600">VAT Rate</th>
                    <th className="text-right px-4 py-3 text-sm font-medium text-slate-600">Taxable Amount</th>
                    <th className="text-right px-4 py-3 text-sm font-medium text-slate-600">VAT Amount</th>
                    <th className="text-right px-4 py-3 text-sm font-medium text-slate-600">Orders</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {report.rows.map((row) => (
                    <Fragment key={row.member_state}>
                      <tr className="hover:bg-slate-50 transition-colors">
                        <td className="px-4 py-3">
                          <span className="font-medium text-slate-800">{row.member_state}</span>
                          <span className="text-slate-500 ml-2">{row.member_state_name}</span>
                        </td>
                        <td className="text-right px-4 py-3 text-slate-600">{row.vat_rate}%</td>
                        <td className="text-right px-4 py-3 text-slate-800">{formatCurrency(row.taxable_amount)}</td>
                        <td className="text-right px-4 py-3 text-blue-600 font-medium">{formatCurrency(row.vat_amount)}</td>
                        <td className="text-right px-4 py-3">
                          <button
                            onClick={() => setExpandedRow(expandedRow === row.member_state ? null : row.member_state)}
                            className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-slate-100 text-slate-700 hover:bg-slate-200 transition-all font-medium text-xs group"
                          >
                            <span>{row.order_count} {row.order_count === 1 ? 'Order' : 'Orders'}</span>
                            <svg
                              className={`w-3.5 h-3.5 transition-transform duration-200 ${expandedRow === row.member_state ? 'rotate-180' : ''}`}
                              fill="none" viewBox="0 0 24 24" stroke="currentColor"
                            >
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M19 9l-7 7-7-7" />
                            </svg>
                          </button>
                        </td>
                      </tr>
                      {expandedRow === row.member_state && row.orders && (
                        <tr className="bg-slate-50/50">
                          <td colSpan={5} className="px-6 py-4">
                            <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden animate-in slide-in-from-top-2 duration-200">
                              <table className="w-full text-xs">
                                <thead className="bg-slate-50 border-b border-slate-100">
                                  <tr>
                                    <th className="text-left px-4 py-2.5 font-bold text-slate-500">Order #</th>
                                    <th className="text-left px-4 py-2.5 font-bold text-slate-500">Customer</th>
                                    <th className="text-left px-4 py-2.5 font-bold text-slate-500">Date</th>
                                    <th className="text-right px-4 py-2.5 font-bold text-slate-500">Total</th>
                                    <th className="text-right px-4 py-2.5 font-bold text-slate-500">Action</th>
                                  </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-50">
                                  {row.orders.map((order: any) => (
                                    <tr key={order.id} className="hover:bg-blue-50/30">
                                      <td className="px-4 py-2.5 font-bold text-blue-600">{order.order_number}</td>
                                      <td className="px-4 py-2.5 text-slate-700">{order.customer_name}</td>
                                      <td className="px-4 py-2.5 text-slate-500">{formatDate(order.placed_at)}</td>
                                      <td className="text-right px-4 py-2.5 font-bold text-slate-900">{formatCurrency(order.total)}</td>
                                      <td className="text-right px-4 py-2.5">
                                        <a
                                          href={`/admin/orders/${order.id}`}
                                          className="text-blue-500 hover:underline font-medium"
                                          target="_blank"
                                        >
                                          View Info
                                        </a>
                                      </td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            </div>
                          </td>
                        </tr>
                      )}
                    </Fragment>
                  ))}
                </tbody>
                <tfoot className="bg-slate-50 border-t border-slate-200">
                  <tr className="font-semibold">
                    <td className="px-4 py-3 text-slate-800">Total</td>
                    <td className="px-4 py-3"></td>
                    <td className="text-right px-4 py-3 text-slate-800">{formatCurrency(report.summary.total_taxable_amount)}</td>
                    <td className="text-right px-4 py-3 text-blue-600">{formatCurrency(report.summary.total_vat_amount)}</td>
                    <td className="text-right px-4 py-3 text-slate-800">{report.summary.total_orders}</td>
                  </tr>
                </tfoot>
              </table>
            )}
          </div>

          {/* Instructions */}
          <div className="mt-6 bg-blue-50 border border-blue-200 rounded-xl p-4">
            <h4 className="font-semibold text-blue-800 mb-2">Submission Instructions</h4>
            <ol className="text-sm text-blue-700 space-y-1 list-decimal list-inside">
              <li>Download the XML file using the button above</li>
              <li>Log in to eDavki portal at <a href="https://edavki.durs.si" target="_blank" rel="noopener noreferrer" className="underline">edavki.durs.si</a></li>
              <li>Navigate to OSS-VPSS (VAT One Stop Shop)</li>
              <li>Upload the XML file and verify the data</li>
              <li>Submit before the deadline: {report.summary.submission_deadline ? formatDate(report.summary.submission_deadline) : 'N/A'}</li>
            </ol>
          </div>
        </>
      )}
    </div>
  )
}
