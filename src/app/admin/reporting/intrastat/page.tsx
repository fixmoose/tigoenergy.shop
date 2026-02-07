'use client'

import { useState, useEffect } from 'react'
import type { IntrastatReportData } from '@/types/compliance'

const months = [
  { value: 1, label: 'January' },
  { value: 2, label: 'February' },
  { value: 3, label: 'March' },
  { value: 4, label: 'April' },
  { value: 5, label: 'May' },
  { value: 6, label: 'June' },
  { value: 7, label: 'July' },
  { value: 8, label: 'August' },
  { value: 9, label: 'September' },
  { value: 10, label: 'October' },
  { value: 11, label: 'November' },
  { value: 12, label: 'December' },
]

export default function IntrastatPage() {
  const currentYear = new Date().getFullYear()
  const currentMonth = new Date().getMonth() + 1

  const [year, setYear] = useState(currentYear)
  const [month, setMonth] = useState(currentMonth > 1 ? currentMonth - 1 : 12)
  const [report, setReport] = useState<IntrastatReportData | null>(null)
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [saveMessage, setSaveMessage] = useState<string | null>(null)

  const fetchReport = async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(`/api/admin/reporting/intrastat?year=${year}&month=${month}`)
      const data = await res.json()
      if (data.success) {
        setReport(data.data)
      } else {
        setError(data.error || 'Failed to load report')
      }
    } catch {
      setError('Failed to fetch report')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchReport()
  }, [year, month])

  const downloadCSV = () => {
    window.open(`/api/admin/reporting/intrastat?year=${year}&month=${month}&format=csv`, '_blank')
  }

  const saveReport = async () => {
    setSaving(true)
    setSaveMessage(null)
    try {
      const res = await fetch('/api/admin/reporting/intrastat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ year, month }),
      })
      const data = await res.json()
      if (data.success) {
        setSaveMessage(data.message)
      } else {
        setError(data.error || 'Failed to save report')
      }
    } catch {
      setError('Failed to save report')
    } finally {
      setSaving(false)
    }
  }

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR' }).format(amount)
  }

  const formatWeight = (kg: number) => {
    return new Intl.NumberFormat('de-DE', { maximumFractionDigits: 2 }).format(kg) + ' kg'
  }

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('en-GB', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    })
  }

  const getThresholdColor = (percentage: number, exceeded: boolean) => {
    if (exceeded) return 'text-red-600'
    if (percentage >= 80) return 'text-amber-600'
    return 'text-green-600'
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Intrastat Reporting</h1>
          <p className="text-slate-500 mt-1">Monthly trade statistics for EU dispatches - submit to SURS</p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={saveReport}
            disabled={saving || !report || report.rows.length === 0}
            className="px-4 py-2 bg-slate-100 text-slate-700 rounded-lg hover:bg-slate-200 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {saving ? 'Saving...' : 'Save to History'}
          </button>
          <button
            onClick={downloadCSV}
            disabled={!report || report.rows.length === 0}
            className="px-4 py-2 bg-amber-600 text-white rounded-lg hover:bg-amber-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Download CSV
          </button>
        </div>
      </div>

      {/* Period Selector */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-4 mb-6">
        <div className="flex items-center gap-4">
          <div>
            <label className="block text-sm font-medium text-slate-600 mb-1">Year</label>
            <select
              value={year}
              onChange={(e) => setYear(parseInt(e.target.value))}
              className="px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-amber-500"
            >
              {[currentYear - 1, currentYear, currentYear + 1].map((y) => (
                <option key={y} value={y}>{y}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-600 mb-1">Month</label>
            <select
              value={month}
              onChange={(e) => setMonth(parseInt(e.target.value))}
              className="px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-amber-500"
            >
              {months.map((m) => (
                <option key={m.value} value={m.value}>{m.label}</option>
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

      {saveMessage && (
        <div className="bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded-lg mb-6">
          {saveMessage}
        </div>
      )}

      {report && (
        <>
          {/* Summary Cards */}
          <div className="grid grid-cols-4 gap-4 mb-6">
            <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-4">
              <p className="text-sm text-slate-500">Monthly Value</p>
              <p className="text-2xl font-bold text-slate-800">{formatCurrency(report.summary.monthly_value_eur)}</p>
            </div>
            <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-4">
              <p className="text-sm text-slate-500">Monthly Weight</p>
              <p className="text-2xl font-bold text-slate-800">{formatWeight(report.summary.monthly_weight_kg)}</p>
            </div>
            <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-4">
              <p className="text-sm text-slate-500">YTD Dispatches</p>
              <p className={`text-2xl font-bold ${getThresholdColor(
                (report.summary.ytd_dispatches_eur / report.summary.threshold_eur) * 100,
                report.summary.threshold_exceeded
              )}`}>
                {formatCurrency(report.summary.ytd_dispatches_eur)}
              </p>
              <p className="text-xs text-slate-400 mt-1">
                Threshold: {formatCurrency(report.summary.threshold_eur)}
              </p>
            </div>
            <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-4">
              <p className="text-sm text-slate-500">Deadline</p>
              <p className="text-2xl font-bold text-slate-800">
                {report.summary.submission_deadline ? formatDate(report.summary.submission_deadline) : '-'}
              </p>
            </div>
          </div>

          {/* Threshold Warning */}
          {report.summary.threshold_exceeded && (
            <div className="bg-red-50 border border-red-200 rounded-xl p-4 mb-6">
              <div className="flex items-center gap-2">
                <span className="text-xl">⚠️</span>
                <div>
                  <h4 className="font-semibold text-red-800">Intrastat Threshold Exceeded</h4>
                  <p className="text-sm text-red-700">
                    YTD dispatches ({formatCurrency(report.summary.ytd_dispatches_eur)}) exceed the threshold ({formatCurrency(report.summary.threshold_eur)}).
                    Monthly reporting is mandatory.
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Report Table */}
          <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
            <div className="px-4 py-3 border-b border-slate-200 bg-slate-50">
              <h3 className="font-semibold text-slate-800">Dispatches by CN Code & Country</h3>
              <p className="text-sm text-slate-500">{report.summary.monthly_shipments} shipments in {months[month - 1].label} {year}</p>
            </div>
            {report.rows.length === 0 ? (
              <div className="p-8 text-center text-slate-400">
                No EU dispatches recorded for this period
              </div>
            ) : (
              <table className="w-full">
                <thead className="bg-slate-50 border-b border-slate-200">
                  <tr>
                    <th className="text-left px-4 py-3 text-sm font-medium text-slate-600">CN Code</th>
                    <th className="text-left px-4 py-3 text-sm font-medium text-slate-600">Destination</th>
                    <th className="text-right px-4 py-3 text-sm font-medium text-slate-600">Value (EUR)</th>
                    <th className="text-right px-4 py-3 text-sm font-medium text-slate-600">Mass (kg)</th>
                    <th className="text-right px-4 py-3 text-sm font-medium text-slate-600">Units</th>
                    <th className="text-center px-4 py-3 text-sm font-medium text-slate-600">Transaction</th>
                    <th className="text-center px-4 py-3 text-sm font-medium text-slate-600">Transport</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {report.rows.map((row, idx) => (
                    <tr key={`${row.cn_code}-${row.destination_country}-${idx}`} className="hover:bg-slate-50">
                      <td className="px-4 py-3 font-mono text-sm text-slate-800">{row.cn_code}</td>
                      <td className="px-4 py-3">
                        <span className="font-medium text-slate-800">{row.destination_country}</span>
                        <span className="text-slate-500 ml-2">{row.country_name}</span>
                      </td>
                      <td className="text-right px-4 py-3 text-slate-800">{formatCurrency(row.statistical_value_eur)}</td>
                      <td className="text-right px-4 py-3 text-slate-600">{formatWeight(row.net_mass_kg)}</td>
                      <td className="text-right px-4 py-3 text-slate-600">{row.supplementary_units}</td>
                      <td className="text-center px-4 py-3 text-slate-500">{row.nature_of_transaction}</td>
                      <td className="text-center px-4 py-3 text-slate-500">{row.mode_of_transport}</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot className="bg-slate-50 border-t border-slate-200">
                  <tr className="font-semibold">
                    <td className="px-4 py-3 text-slate-800" colSpan={2}>Total</td>
                    <td className="text-right px-4 py-3 text-slate-800">{formatCurrency(report.summary.monthly_value_eur)}</td>
                    <td className="text-right px-4 py-3 text-slate-800">{formatWeight(report.summary.monthly_weight_kg)}</td>
                    <td className="text-right px-4 py-3 text-slate-800">{report.summary.monthly_shipments}</td>
                    <td colSpan={2}></td>
                  </tr>
                </tfoot>
              </table>
            )}
          </div>

          {/* Instructions */}
          <div className="mt-6 bg-amber-50 border border-amber-200 rounded-xl p-4">
            <h4 className="font-semibold text-amber-800 mb-2">Intrastat Codes Reference</h4>
            <div className="grid grid-cols-2 gap-4 text-sm text-amber-700">
              <div>
                <p className="font-medium">Nature of Transaction:</p>
                <ul className="list-disc list-inside mt-1">
                  <li>11 = Outright purchase/sale</li>
                  <li>12 = Return of goods</li>
                  <li>21 = Transfer of ownership</li>
                </ul>
              </div>
              <div>
                <p className="font-medium">Mode of Transport:</p>
                <ul className="list-disc list-inside mt-1">
                  <li>1 = Sea transport</li>
                  <li>3 = Road transport</li>
                  <li>4 = Air transport</li>
                  <li>5 = Post</li>
                </ul>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  )
}
