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
    return 'text-amber-600'
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
          <button
            onClick={() => window.open(`/api/admin/reporting/intrastat?year=${year}&month=${month}&format=xml`, '_blank')}
            disabled={!report || report.rows.length === 0}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Download INSTAT XML
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
        <div className="bg-amber-50 border border-amber-200 text-amber-700 px-4 py-3 rounded-lg mb-6">
          {saveMessage}
        </div>
      )}

      {report && (
        <>
          {/* Summary Cards — dispatch + arrival split out */}
          <div className="grid grid-cols-4 gap-4 mb-6">
            <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-4">
              <p className="text-sm text-slate-500">Odprema (dispatch)</p>
              <p className="text-2xl font-bold text-blue-700">{formatCurrency(report.summary.dispatch_value_eur)}</p>
              <p className="text-xs text-slate-400 mt-1">{formatWeight(report.summary.dispatch_weight_kg)} · {report.summary.dispatch_count} lines</p>
            </div>
            <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-4">
              <p className="text-sm text-slate-500">Prejem (arrival)</p>
              <p className="text-2xl font-bold text-emerald-700">{formatCurrency(report.summary.arrival_value_eur)}</p>
              <p className="text-xs text-slate-400 mt-1">{formatWeight(report.summary.arrival_weight_kg)} · {report.summary.arrival_count} lines</p>
            </div>
            <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-4">
              <p className="text-sm text-slate-500">YTD Totals</p>
              <p className={`text-lg font-bold ${getThresholdColor(
                (report.summary.ytd_dispatches_eur / report.summary.threshold_eur) * 100,
                report.summary.threshold_exceeded
              )}`}>
                ↑ {formatCurrency(report.summary.ytd_dispatches_eur)}
              </p>
              <p className="text-lg font-bold text-emerald-700">
                ↓ {formatCurrency(report.summary.ytd_arrivals_eur)}
              </p>
              <p className="text-xs text-slate-400 mt-1">
                Thresholds: 270k dispatch · 240k arrival
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

          {/* Report Table — dispatches + arrivals, grouped by flow */}
          <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
            <div className="px-4 py-3 border-b border-slate-200 bg-slate-50">
              <h3 className="font-semibold text-slate-800">Declarations by CN Code & Country</h3>
              <p className="text-sm text-slate-500">
                {report.rows.length} row{report.rows.length !== 1 ? 's' : ''} in {months[month - 1].label} {year}
                {' · '}
                {report.summary.dispatch_count} odprema, {report.summary.arrival_count} prejem
              </p>
            </div>
            {report.rows.length === 0 ? (
              <div className="p-8 text-center text-slate-400">
                No Intrastat activity recorded for this period
              </div>
            ) : (
              <table className="w-full">
                <thead className="bg-slate-50 border-b border-slate-200">
                  <tr>
                    <th className="text-left px-4 py-3 text-sm font-medium text-slate-600">Flow</th>
                    <th className="text-left px-4 py-3 text-sm font-medium text-slate-600">CN Code</th>
                    <th className="text-left px-4 py-3 text-sm font-medium text-slate-600">Partner country</th>
                    <th className="text-right px-4 py-3 text-sm font-medium text-slate-600">Value (EUR)</th>
                    <th className="text-right px-4 py-3 text-sm font-medium text-slate-600">Mass (kg)</th>
                    <th className="text-right px-4 py-3 text-sm font-medium text-slate-600">Units</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {report.rows.map((row, idx) => (
                    <tr key={`${row.flow_type}-${row.cn_code}-${row.destination_country}-${idx}`} className="hover:bg-slate-50">
                      <td className="px-4 py-3">
                        <span
                          className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                            row.flow_type === 'dispatch'
                              ? 'bg-blue-100 text-blue-700'
                              : 'bg-emerald-100 text-emerald-700'
                          }`}
                        >
                          {row.flow_type === 'dispatch' ? 'Odprema' : 'Prejem'}
                        </span>
                      </td>
                      <td className="px-4 py-3 font-mono text-sm text-slate-800">{row.cn_code}</td>
                      <td className="px-4 py-3">
                        <span className="font-medium text-slate-800">{row.destination_country}</span>
                        <span className="text-slate-500 ml-2">{row.country_name}</span>
                      </td>
                      <td className="text-right px-4 py-3 text-slate-800">{formatCurrency(row.statistical_value_eur)}</td>
                      <td className="text-right px-4 py-3 text-slate-600">{formatWeight(row.net_mass_kg)}</td>
                      <td className="text-right px-4 py-3 text-slate-600">{row.supplementary_units}</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot className="bg-slate-50 border-t border-slate-200">
                  <tr className="font-semibold">
                    <td className="px-4 py-3" colSpan={3}>
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-blue-100 text-blue-700">
                        Odprema
                      </span>
                    </td>
                    <td className="text-right px-4 py-3 text-blue-700">{formatCurrency(report.summary.dispatch_value_eur)}</td>
                    <td className="text-right px-4 py-3 text-blue-700">{formatWeight(report.summary.dispatch_weight_kg)}</td>
                    <td className="text-right px-4 py-3 text-blue-700">{report.summary.dispatch_count}</td>
                  </tr>
                  <tr className="font-semibold">
                    <td className="px-4 py-3" colSpan={3}>
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-emerald-100 text-emerald-700">
                        Prejem
                      </span>
                    </td>
                    <td className="text-right px-4 py-3 text-emerald-700">{formatCurrency(report.summary.arrival_value_eur)}</td>
                    <td className="text-right px-4 py-3 text-emerald-700">{formatWeight(report.summary.arrival_weight_kg)}</td>
                    <td className="text-right px-4 py-3 text-emerald-700">{report.summary.arrival_count}</td>
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
