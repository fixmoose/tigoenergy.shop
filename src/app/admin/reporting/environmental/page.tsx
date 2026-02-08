'use client'

import { useState, useEffect } from 'react'
import type { ETRODReportData, PackagingReportData } from '@/types/compliance'

const quarters = [
  { value: 1, label: 'Q1 (Jan-Mar)' },
  { value: 2, label: 'Q2 (Apr-Jun)' },
  { value: 3, label: 'Q3 (Jul-Sep)' },
  { value: 4, label: 'Q4 (Oct-Dec)' },
]

type TabType = 'etrod' | 'packaging'

export default function EnvironmentalPage() {
  const currentYear = new Date().getFullYear()
  const currentQuarter = Math.ceil((new Date().getMonth() + 1) / 3)

  const [activeTab, setActiveTab] = useState<TabType>('etrod')
  const [year, setYear] = useState(currentYear)
  const [quarter, setQuarter] = useState<number | null>(currentQuarter)
  const [month, setMonth] = useState<number | null>(null)
  const [periodType, setPeriodType] = useState<'quarter' | 'half_year'>('quarter')
  const [country, setCountry] = useState('SI')

  const [etrodReport, setEtrodReport] = useState<ETRODReportData | null>(null)
  const [packagingReport, setPackagingReport] = useState<PackagingReportData | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const fetchETRODReport = async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(`/api/admin/reporting/trod?year=${year}&quarter=${quarter}&period_type=${periodType}`)
      const data = await res.json()
      if (data.success) {
        setEtrodReport(data.data)
      } else {
        setError(data.error || 'Failed to load eTROD report')
      }
    } catch {
      setError('Failed to fetch eTROD report')
    } finally {
      setLoading(false)
    }
  }

  const fetchPackagingReport = async () => {
    setLoading(true)
    setError(null)
    try {
      const url = new URL('/api/admin/reporting/packaging', window.location.origin)
      url.searchParams.append('year', year.toString())
      if (month) url.searchParams.append('month', month.toString())
      if (quarter && !month) url.searchParams.append('quarter', quarter.toString())
      url.searchParams.append('country', country)
      const res = await fetch(url.toString())
      const data = await res.json()
      if (data.success) {
        setPackagingReport(data.data)
      } else {
        setError(data.error || 'Failed to load Packaging report')
      }
    } catch {
      setError('Failed to fetch Packaging report')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (activeTab === 'etrod') {
      fetchETRODReport()
    } else {
      fetchPackagingReport()
    }
  }, [activeTab, year, quarter, month, periodType, country])

  const downloadCSV = () => {
    if (activeTab === 'etrod') {
      window.open(`/api/admin/reporting/trod?year=${year}&quarter=${quarter}&period_type=${periodType}&format=csv`, '_blank')
    } else {
      const url = new URL('/api/admin/reporting/packaging', window.location.origin)
      url.searchParams.append('year', year.toString())
      if (month) url.searchParams.append('month', month.toString())
      if (quarter && !month) url.searchParams.append('quarter', quarter.toString())
      url.searchParams.append('country', country)
      url.searchParams.append('format', 'csv')
      window.open(url.toString(), '_blank')
    }
  }

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR' }).format(amount)
  }

  const formatWeight = (kg: number) => {
    return new Intl.NumberFormat('de-DE', { maximumFractionDigits: 2 }).format(kg) + ' kg'
  }

  const formatNumber = (n: number) => {
    return new Intl.NumberFormat('de-DE').format(n)
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Environmental Reporting</h1>
          <p className="text-slate-500 mt-1">Standalone reporting for WEEE (eTROD) and Packaging Waste (OE)</p>
        </div>
        <div className="flex gap-3 items-center">
          <a
            href="https://ecarina.fu.gov.si/wps/portal/e-carina/"
            target="_blank"
            rel="noopener noreferrer"
            className="px-4 py-2 border border-slate-300 text-slate-700 rounded-lg hover:bg-slate-50 transition-colors flex items-center gap-2"
          >
            Submit to e-Carina ↗
          </a>
          <button
            onClick={downloadCSV}
            disabled={
              (activeTab === 'etrod' && (!etrodReport || etrodReport.rows.length === 0)) ||
              (activeTab === 'packaging' && (!packagingReport || packagingReport.rows.length === 0))
            }
            className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Download CSV
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 mb-6 bg-slate-100 p-1 rounded-lg w-fit">
        <button
          onClick={() => setActiveTab('etrod')}
          className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${activeTab === 'etrod'
            ? 'bg-white text-slate-800 shadow-sm'
            : 'text-slate-600 hover:text-slate-800'
            }`}
        >
          eTROD (WEEE)
        </button>
        <button
          onClick={() => setActiveTab('packaging')}
          className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${activeTab === 'packaging'
            ? 'bg-white text-slate-800 shadow-sm'
            : 'text-slate-600 hover:text-slate-800'
            }`}
        >
          Packaging Waste
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
              className="px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500"
            >
              {[currentYear - 1, currentYear, currentYear + 1].map((y) => (
                <option key={y} value={y}>{y}</option>
              ))}
            </select>
          </div>
          {activeTab === 'etrod' ? (
            <div className="flex items-center gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-600 mb-1">Period Type</label>
                <select
                  value={periodType}
                  onChange={(e) => setPeriodType(e.target.value as any)}
                  className="px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500"
                >
                  <option value="quarter">Quarterly</option>
                  <option value="half_year">Bi-Annually (WEEE)</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-600 mb-1">
                  {periodType === 'quarter' ? 'Quarter' : 'Half'}
                </label>
                <select
                  value={quarter ?? ''}
                  onChange={(e) => setQuarter(parseInt(e.target.value))}
                  className="px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500"
                >
                  {periodType === 'quarter' ? (
                    quarters.map((q) => <option key={q.value} value={q.value}>{q.label}</option>)
                  ) : (
                    <>
                      <option value={1}>H1 (Jan-Jun)</option>
                      <option value={2}>H2 (Jul-Dec)</option>
                    </>
                  )}
                </select>
              </div>
            </div>
          ) : (
            <div className="flex items-center gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-600 mb-1">Country</label>
                <select
                  value={country}
                  onChange={(e) => setCountry(e.target.value)}
                  className="px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500"
                >
                  <option value="SI">Slovenia (SI)</option>
                  <option value="DE">Germany (DE)</option>
                  <option value="AT">Austria (AT)</option>
                  <option value="HR">Croatia (HR)</option>
                  <option value="IT">Italy (IT)</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-600 mb-1">Period</label>
                <select
                  value={month ? `m${month}` : quarter ? `q${quarter}` : 'annual'}
                  onChange={(e) => {
                    const val = e.target.value
                    if (val.startsWith('m')) {
                      setMonth(parseInt(val.substring(1)))
                      setQuarter(null)
                    } else if (val.startsWith('q')) {
                      setQuarter(parseInt(val.substring(1)))
                      setMonth(null)
                    } else {
                      setMonth(null)
                      setQuarter(null)
                    }
                  }}
                  className="px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500"
                >
                  <option value="annual">Annual</option>
                  <optgroup label="Quarterly (SI)">
                    <option value="q1">Q1</option>
                    <option value="q2">Q2</option>
                    <option value="q3">Q3</option>
                    <option value="q4">Q4</option>
                  </optgroup>
                  <optgroup label="Monthly">
                    {[...Array(12)].map((_, i) => (
                      <option key={i + 1} value={`m${i + 1}`}>
                        {new Date(2024, i).toLocaleString('default', { month: 'long' })}
                      </option>
                    ))}
                  </optgroup>
                </select>
              </div>
            </div>
          )}
          <button
            onClick={activeTab === 'etrod' ? fetchETRODReport : fetchPackagingReport}
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

      {/* eTROD Tab Content */}
      {activeTab === 'etrod' && etrodReport && (
        <>
          {/* Summary Cards */}
          <div className="grid grid-cols-4 gap-4 mb-6">
            <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-4">
              <p className="text-sm text-slate-500">Total Units</p>
              <p className="text-2xl font-bold text-slate-800">{formatNumber(etrodReport.summary.total_units)}</p>
            </div>
            <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-4">
              <p className="text-sm text-slate-500">Total Weight</p>
              <p className="text-2xl font-bold text-slate-800">{formatWeight(etrodReport.summary.total_weight_kg)}</p>
            </div>
            <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-4">
              <p className="text-sm text-slate-500">eTROD Fee Due</p>
              <p className="text-2xl font-bold text-green-600">{formatCurrency(etrodReport.summary.total_fee_eur)}</p>
            </div>
            <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-4">
              <p className="text-sm text-slate-500">Authority</p>
              <p className="text-2xl font-bold text-slate-800">{etrodReport.summary.reporting_authority}</p>
            </div>
          </div>

          {/* eTROD Table */}
          <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
            <div className="px-4 py-3 border-b border-slate-200 bg-slate-50">
              <h3 className="font-semibold text-slate-800">WEEE & Packaging by Category</h3>
              <p className="text-sm text-slate-500">Q{quarter} {year} - {etrodReport.summary.categories_count} categories with sales</p>
            </div>
            {etrodReport.rows.length === 0 ? (
              <div className="p-8 text-center text-slate-400">
                No electrical equipment sold in this period
              </div>
            ) : (
              <table className="w-full">
                <thead className="bg-slate-50 border-b border-slate-200">
                  <tr>
                    <th className="text-left px-4 py-3 text-sm font-medium text-slate-600">Category</th>
                    <th className="text-left px-4 py-3 text-sm font-medium text-slate-600">Description</th>
                    <th className="text-right px-4 py-3 text-sm font-medium text-slate-600">Units</th>
                    <th className="text-right px-4 py-3 text-sm font-medium text-slate-600">Weight (kg)</th>
                    <th className="text-right px-4 py-3 text-sm font-medium text-slate-600">Rate (EUR/kg)</th>
                    <th className="text-right px-4 py-3 text-sm font-medium text-slate-600">Fee (EUR)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {etrodReport.rows.map((row) => (
                    <tr key={row.etrod_category} className="hover:bg-slate-50">
                      <td className="px-4 py-3 font-mono text-slate-800">{row.etrod_category}</td>
                      <td className="px-4 py-3 text-slate-600">{row.category_description}</td>
                      <td className="text-right px-4 py-3 text-slate-800">{formatNumber(row.units_sold)}</td>
                      <td className="text-right px-4 py-3 text-slate-600">{formatWeight(row.total_weight_kg)}</td>
                      <td className="text-right px-4 py-3 text-slate-500">{formatCurrency(row.fee_rate_per_kg)}</td>
                      <td className="text-right px-4 py-3 text-green-600 font-medium">{formatCurrency(row.total_fee_eur)}</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot className="bg-slate-50 border-t border-slate-200">
                  <tr className="font-semibold">
                    <td className="px-4 py-3 text-slate-800" colSpan={2}>Total</td>
                    <td className="text-right px-4 py-3 text-slate-800">{formatNumber(etrodReport.summary.total_units)}</td>
                    <td className="text-right px-4 py-3 text-slate-800">{formatWeight(etrodReport.summary.total_weight_kg)}</td>
                    <td className="px-4 py-3"></td>
                    <td className="text-right px-4 py-3 text-green-600">{formatCurrency(etrodReport.summary.total_fee_eur)}</td>
                  </tr>
                </tfoot>
              </table>
            )}
          </div>

          {/* eTROD Categories Reference */}
          <div className="mt-6 bg-green-50 border border-green-200 rounded-xl p-4">
            <h4 className="font-semibold text-green-800 mb-2">eTROD WEEE Categories</h4>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm text-green-700">
              <div className="flex gap-2"><strong>1</strong> <span>Oprema za toplotno izmenjavo</span></div>
              <div className="flex gap-2"><strong>2</strong> <span>Zasloni, monitorji in oprema z zasloni (&gt;100 cm²)</span></div>
              <div className="flex gap-2"><strong>3</strong> <span>Sijalke (Lamps)</span></div>
              <div className="flex gap-2"><strong>4</strong> <span>Velika oprema (&gt;50 cm)</span></div>
              <div className="flex gap-2"><strong>5</strong> <span>Majhna oprema (≤50 cm)</span></div>
              <div className="flex gap-2"><strong>6</strong> <span>Majhna oprema za IT in telekomunikacije</span></div>
              <div className="flex gap-2 font-bold bg-green-100/50 px-2 py-1 rounded"><strong>7-PBA</strong> <span>Prenosne baterije in akumulatorji</span></div>
            </div>
          </div>
        </>
      )}

      {/* Packaging Tab Content */}
      {activeTab === 'packaging' && packagingReport && (
        <>
          {/* Summary Cards */}
          <div className="grid grid-cols-4 gap-4 mb-6">
            <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-4">
              <p className="text-sm text-slate-500">Total Weight</p>
              <p className="text-2xl font-bold text-slate-800">{formatWeight(packagingReport.summary.total_weight_kg)}</p>
            </div>
            <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-4">
              <p className="text-sm text-slate-500">Packaging Fee Due</p>
              <p className="text-2xl font-bold text-green-600">{formatCurrency(packagingReport.summary.total_fee_eur)}</p>
            </div>
            <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-4">
              <p className="text-sm text-slate-500">Threshold</p>
              <p className={`text-2xl font-bold ${packagingReport.summary.threshold_exceeded ? 'text-red-600' : 'text-green-600'}`}>
                {formatWeight(packagingReport.summary.threshold_kg)}
              </p>
              <p className="text-xs text-slate-400 mt-1">
                {packagingReport.summary.threshold_exceeded ? 'Reporting required' : 'Below threshold'}
              </p>
            </div>
            <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-4">
              <p className="text-sm text-slate-500">Material Types</p>
              <p className="text-2xl font-bold text-slate-800">{packagingReport.summary.material_types_count}</p>
            </div>
          </div>

          {/* Threshold Warning */}
          {packagingReport.summary.threshold_exceeded && (
            <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 mb-6">
              <div className="flex items-center gap-2">
                <span className="text-xl">⚠️</span>
                <div>
                  <h4 className="font-semibold text-amber-800">Packaging Threshold Exceeded</h4>
                  <p className="text-sm text-amber-700">
                    Annual packaging waste ({formatWeight(packagingReport.summary.total_weight_kg)}) exceeds the {formatWeight(packagingReport.summary.threshold_kg)} threshold.
                    Detailed reporting to environmental authorities is required.
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Packaging Table */}
          <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
            <div className="px-4 py-3 border-b border-slate-200 bg-slate-50">
              <h3 className="font-semibold text-slate-800">Packaging by Material Type</h3>
              <p className="text-sm text-slate-500">Annual totals for {year}</p>
            </div>
            {packagingReport.rows.length === 0 ? (
              <div className="p-8 text-center text-slate-400">
                No packaging data recorded for this year
              </div>
            ) : (
              <table className="w-full">
                <thead className="bg-slate-50 border-b border-slate-200">
                  <tr>
                    <th className="text-left px-4 py-3 text-sm font-medium text-slate-600">Material</th>
                    <th className="text-right px-4 py-3 text-sm font-medium text-slate-600">Weight (kg)</th>
                    <th className="text-right px-4 py-3 text-sm font-medium text-slate-600">% of Total</th>
                    <th className="text-right px-4 py-3 text-sm font-medium text-slate-600">Rate (EUR/kg)</th>
                    <th className="text-right px-4 py-3 text-sm font-medium text-slate-600">Fee (EUR)</th>
                    <th className="text-right px-4 py-3 text-sm font-medium text-slate-600">Orders</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {packagingReport.rows.map((row) => (
                    <tr key={row.material_type} className="hover:bg-slate-50">
                      <td className="px-4 py-3">
                        <span className="capitalize font-medium text-slate-800">{row.material_type}</span>
                      </td>
                      <td className="text-right px-4 py-3 text-slate-800">{formatWeight(row.total_weight_kg)}</td>
                      <td className="text-right px-4 py-3 text-slate-500">{row.percentage_of_total.toFixed(1)}%</td>
                      <td className="text-right px-4 py-3 text-slate-500">{formatCurrency(row.fee_rate_per_kg)}</td>
                      <td className="text-right px-4 py-3 text-green-600 font-medium">{formatCurrency(row.total_fee_eur)}</td>
                      <td className="text-right px-4 py-3 text-slate-600">{formatNumber(row.order_count)}</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot className="bg-slate-50 border-t border-slate-200">
                  <tr className="font-semibold">
                    <td className="px-4 py-3 text-slate-800">Total</td>
                    <td className="text-right px-4 py-3 text-slate-800">{formatWeight(packagingReport.summary.total_weight_kg)}</td>
                    <td className="text-right px-4 py-3 text-slate-800">100%</td>
                    <td className="px-4 py-3"></td>
                    <td className="text-right px-4 py-3 text-green-600">{formatCurrency(packagingReport.summary.total_fee_eur)}</td>
                    <td className="px-4 py-3"></td>
                  </tr>
                </tfoot>
              </table>
            )}
          </div>

          {/* Packaging Info */}
          <div className="mt-6 bg-green-50 border border-green-200 rounded-xl p-4">
            <h4 className="font-semibold text-green-800 mb-2">Packaging Waste Reporting (Slovenia)</h4>
            <ul className="text-sm text-green-700 space-y-1 list-disc list-inside">
              <li>Reporting threshold: {formatWeight(packagingReport.summary.threshold_kg)} per year</li>
              <li>Above threshold: Register with ARSO and submit annual report</li>
              <li>Fees calculated based on material type and weight</li>
              <li>Report deadline: March 31 of the following year</li>
            </ul>
          </div>
        </>
      )}
    </div>
  )
}
