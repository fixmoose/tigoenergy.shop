'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import type { ThresholdCheck } from '@/types/compliance'

export default function ReportingDashboard() {
  const [thresholds, setThresholds] = useState<ThresholdCheck[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function fetchThresholds() {
      try {
        const res = await fetch('/api/admin/reporting/thresholds')
        const data = await res.json()
        if (data.success) {
          setThresholds(data.data)
        }
      } catch {
        console.error('Failed to fetch thresholds')
      } finally {
        setLoading(false)
      }
    }
    fetchThresholds()
  }, [])

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR' }).format(amount)
  }

  const formatValue = (check: ThresholdCheck) => {
    if (check.metric.includes('kg')) {
      return new Intl.NumberFormat('de-DE', { maximumFractionDigits: 0 }).format(check.current_value) + ' kg'
    }
    return formatCurrency(check.current_value)
  }

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'EXCEEDED':
      case 'REGISTERED':
        return <span className="bg-red-100 text-red-800 text-xs px-2 py-1 rounded font-medium">Action Required</span>
      case 'WARNING':
        return <span className="bg-amber-100 text-amber-800 text-xs px-2 py-1 rounded font-medium">Warning</span>
      default:
        return <span className="bg-green-100 text-green-800 text-xs px-2 py-1 rounded font-medium">OK</span>
    }
  }

  const hasWarnings = thresholds.some((t) => t.status === 'WARNING' || t.status === 'EXCEEDED' || t.status === 'REGISTERED')

  return (
    <div>
      <h1 className="text-2xl font-bold mb-6 text-slate-800">Compliance & Reporting</h1>

      {/* Threshold Alerts */}
      {!loading && hasWarnings && (
        <div className="mb-6 bg-amber-50 border border-amber-200 rounded-xl p-4">
          <h3 className="font-semibold text-amber-800 mb-3 flex items-center gap-2">
            <span>⚠️</span> Threshold Alerts
          </h3>
          <div className="space-y-2">
            {thresholds
              .filter((t) => t.status !== 'OK')
              .map((threshold, idx) => (
                <div key={idx} className="flex items-center justify-between bg-white rounded-lg px-4 py-2 border border-amber-100">
                  <div>
                    <span className="font-medium text-slate-800">{threshold.report_type}</span>
                    <span className="text-slate-500 ml-2">-</span>
                    <span className="text-slate-600 ml-2">{threshold.metric}</span>
                  </div>
                  <div className="flex items-center gap-4">
                    <span className="text-slate-800 font-medium">{formatValue(threshold)}</span>
                    <span className="text-slate-400">/ {formatValue({ ...threshold, current_value: threshold.threshold_value })}</span>
                    <span className="text-slate-500">({threshold.percentage_of_threshold.toFixed(0)}%)</span>
                    {getStatusBadge(threshold.status)}
                  </div>
                </div>
              ))}
          </div>
        </div>
      )}

      {/* Report Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">

        {/* OSS - Fixed */}
        <div className="p-6 bg-white rounded-xl shadow-sm border border-slate-200 hover:shadow-md transition-shadow flex flex-col">
          <Link href="/admin/reporting/oss" className="flex-1">
            <div className="flex items-center justify-between mb-4">
              <span className="text-2xl">💶</span>
              <span className="bg-blue-100 text-blue-800 text-xs px-2 py-1 rounded font-medium">Quarterly</span>
            </div>
            <h3 className="text-lg font-bold text-slate-800 mb-2">OSS (EU VAT)</h3>
            <p className="text-sm text-slate-500">Distance sales reporting for cross-border B2C transactions within the EU.</p>
            {!loading && (
              <div className="mt-4 pt-4 border-t border-slate-100">
                {thresholds.find((t) => t.report_type === 'OSS VAT') ? (
                  <div className="flex justify-between text-sm">
                    <span className="text-slate-500">YTD EU Sales</span>
                    <span className="font-medium text-slate-800">
                      {formatCurrency(thresholds.find((t) => t.report_type === 'OSS VAT')?.current_value || 0)}
                    </span>
                  </div>
                ) : (
                  <div className="text-sm text-slate-400">No data</div>
                )}
              </div>
            )}
          </Link>
          <div className="mt-3 pt-2 text-xs text-right border-t border-slate-50">
            <span className="text-slate-400 mr-2">Submit to:</span>
            <a href="https://edavki.durs.si" target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">eDavki Portal ↗</a>
          </div>
        </div>

        {/* INTRASTAT - Fixed */}
        <div className="p-6 bg-white rounded-xl shadow-sm border border-slate-200 hover:shadow-md transition-shadow flex flex-col">
          <Link href="/admin/reporting/intrastat" className="flex-1">
            <div className="flex items-center justify-between mb-4">
              <span className="text-2xl">📈</span>
              <span className="bg-amber-100 text-amber-800 text-xs px-2 py-1 rounded font-medium">Monthly</span>
            </div>
            <h3 className="text-lg font-bold text-slate-800 mb-2">Intrastat</h3>
            <p className="text-sm text-slate-500">Detailed trade statistics for goods dispatched to other EU member states.</p>
            {!loading && (
              <div className="mt-4 pt-4 border-t border-slate-100">
                {thresholds.find((t) => t.report_type === 'Intrastat') ? (
                  <>
                    <div className="flex justify-between text-sm">
                      <span className="text-slate-500">YTD Dispatches</span>
                      <span className="font-medium text-slate-800">
                        {formatCurrency(thresholds.find((t) => t.report_type === 'Intrastat')?.current_value || 0)}
                      </span>
                    </div>
                    <div className="mt-1 w-full bg-slate-100 rounded-full h-2">
                      <div
                        className={`h-2 rounded-full ${(thresholds.find((t) => t.report_type === 'Intrastat')?.percentage_of_threshold || 0) >= 80
                          ? 'bg-amber-500'
                          : 'bg-green-500'
                          }`}
                        style={{
                          width: `${Math.min(100, thresholds.find((t) => t.report_type === 'Intrastat')?.percentage_of_threshold || 0)}%`,
                        }}
                      />
                    </div>
                    <div className="text-xs text-slate-400 mt-1">
                      Threshold: {formatCurrency(thresholds.find((t) => t.report_type === 'Intrastat')?.threshold_value || 270000)}
                    </div>
                  </>
                ) : (
                  <div className="text-sm text-slate-400">No data</div>
                )}
              </div>
            )}
          </Link>
          <div className="mt-3 pt-2 text-xs text-right border-t border-slate-50">
            <span className="text-slate-400 mr-2">Submit to:</span>
            <a href="https://www.stat.si/statweb" target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">SURS Portal ↗</a>
          </div>
        </div>

        {/* ENVIRONMENTAL - Fixed */}
        <div className="p-6 bg-white rounded-xl shadow-sm border border-slate-200 hover:shadow-md transition-shadow flex flex-col">
          <Link href="/admin/reporting/environmental" className="flex-1">
            <div className="flex items-center justify-between mb-4">
              <span className="text-2xl">♻️</span>
              <span className="bg-green-100 text-green-800 text-xs px-2 py-1 rounded font-medium">Quarterly/Annual</span>
            </div>
            <h3 className="text-lg font-bold text-slate-800 mb-2">Environmental (SI)</h3>
            <p className="text-sm text-slate-500">eTROD (WEEE & Packaging) waste reporting for Slovenian authorities.</p>
            {!loading && (
              <div className="mt-4 pt-4 border-t border-slate-100">
                {thresholds.find((t) => t.report_type === 'Packaging Waste') ? (
                  <>
                    <div className="flex justify-between text-sm">
                      <span className="text-slate-500">YTD Packaging</span>
                      <span className="font-medium text-slate-800">
                        {new Intl.NumberFormat('de-DE', { maximumFractionDigits: 0 }).format(
                          thresholds.find((t) => t.report_type === 'Packaging Waste')?.current_value || 0
                        )} kg
                      </span>
                    </div>
                    <div className="mt-1 w-full bg-slate-100 rounded-full h-2">
                      <div
                        className={`h-2 rounded-full ${(thresholds.find((t) => t.report_type === 'Packaging Waste')?.percentage_of_threshold || 0) >= 80
                          ? 'bg-amber-500'
                          : 'bg-green-500'
                          }`}
                        style={{
                          width: `${Math.min(100, thresholds.find((t) => t.report_type === 'Packaging Waste')?.percentage_of_threshold || 0)}%`,
                        }}
                      />
                    </div>
                    <div className="text-xs text-slate-400 mt-1">
                      Threshold: {new Intl.NumberFormat('de-DE').format(
                        thresholds.find((t) => t.report_type === 'Packaging Waste')?.threshold_value || 15000
                      )} kg
                    </div>
                  </>
                ) : (
                  <div className="text-sm text-slate-400">No data</div>
                )}
              </div>
            )}
          </Link>
          <div className="mt-3 pt-2 text-xs text-right border-t border-slate-50">
            <span className="text-slate-400 mr-2">Submit to:</span>
            <a href="https://www.arso.gov.si" target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">ARSO Portal ↗</a>
          </div>
        </div>

        {/* ACCOUNTING - Fixed */}
        <div className="p-6 bg-white rounded-xl shadow-sm border border-slate-200 hover:shadow-md transition-shadow flex flex-col">
          <Link href="/admin/reporting/accounting" className="flex-1">
            <div className="flex items-center justify-between mb-4">
              <span className="text-2xl">🧾</span>
              <span className="bg-purple-100 text-purple-800 text-xs px-2 py-1 rounded font-medium">Financial</span>
            </div>
            <h3 className="text-lg font-bold text-slate-800 mb-2">Accounting</h3>
            <p className="text-sm text-slate-500">Invoices, revenue reports, and financial exports.</p>
            {!loading && (
              <div className="mt-4 pt-4 border-t border-slate-100">
                <div className="flex justify-between text-sm">
                  <span className="text-slate-500">Pending Actions</span>
                  <span className="font-medium text-slate-800">0</span>
                </div>
              </div>
            )}
          </Link>
          <div className="mt-3 pt-2 text-xs text-right border-t border-slate-50">
            {/* No external link for now, maybe add placeholder or nothing */}
            <span className="text-slate-400">Internal Reports</span>
          </div>
        </div>

      </div>
    </div>
  )
}
