'use client'

import React, { useState, useRef } from 'react'
import { processBankStatementAction, confirmBankStatementMatchesAction } from '@/app/actions/admin'

type MatchedPayment = {
    transactionDate: string
    transactionAmount: number
    transactionRef: string
    transactionDesc: string
    orderId: string
    orderNumber: string
    orderTotal: number
    amountPaid: number
    remaining: number
    confidence: 'high' | 'medium' | 'low'
    selected: boolean
}

type UnmatchedTransaction = {
    date: string
    amount: number
    reference: string
    description: string
}

const CONFIDENCE_STYLES = {
    high: { bg: 'bg-amber-50 border-amber-200', badge: 'bg-amber-100 text-amber-700', label: 'High' },
    medium: { bg: 'bg-amber-50 border-amber-200', badge: 'bg-amber-100 text-amber-700', label: 'Medium' },
    low: { bg: 'bg-red-50 border-red-200', badge: 'bg-red-100 text-red-700', label: 'Low' },
}

export default function BankStatementUpload() {
    const [processing, setProcessing] = useState(false)
    const [confirming, setConfirming] = useState(false)
    const [matches, setMatches] = useState<MatchedPayment[]>([])
    const [unmatched, setUnmatched] = useState<UnmatchedTransaction[]>([])
    const [stats, setStats] = useState<any>(null)
    const [error, setError] = useState('')
    const [confirmResult, setConfirmResult] = useState<any>(null)
    const [fileName, setFileName] = useState('')
    const fileRef = useRef<HTMLInputElement>(null)

    async function handleUpload(e: React.ChangeEvent<HTMLInputElement>) {
        const file = e.target.files?.[0]
        if (!file) return

        setError('')
        setConfirmResult(null)
        setFileName(file.name)
        setProcessing(true)

        try {
            const content = await file.text()
            const result = await processBankStatementAction(content)

            if (!result.success) {
                setError(result.error || 'Failed to process statement')
                setMatches([])
                setUnmatched([])
                setStats(null)
            } else {
                setMatches((result.matched || []).map((m: any) => ({ ...m, selected: m.confidence === 'high' })))
                setUnmatched(result.unmatched || [])
                setStats(result.stats)
            }
        } catch (err: any) {
            setError(err.message || 'Unexpected error')
        } finally {
            setProcessing(false)
            if (fileRef.current) fileRef.current.value = ''
        }
    }

    function toggleMatch(index: number) {
        setMatches(prev => prev.map((m, i) => i === index ? { ...m, selected: !m.selected } : m))
    }

    function selectAll() {
        setMatches(prev => prev.map(m => ({ ...m, selected: true })))
    }

    function deselectAll() {
        setMatches(prev => prev.map(m => ({ ...m, selected: false })))
    }

    async function handleConfirm() {
        const selected = matches.filter(m => m.selected)
        if (selected.length === 0) return

        if (!confirm(`Record ${selected.length} payment(s) as bank transfers? This will update the order payment status.`)) return

        setConfirming(true)
        setConfirmResult(null)

        try {
            const result = await confirmBankStatementMatchesAction(
                selected.map(m => ({
                    orderId: m.orderId,
                    amount: m.transactionAmount,
                    date: m.transactionDate,
                    reference: m.transactionRef,
                }))
            )

            if (result.success) {
                const succeeded = result.results?.filter(r => r.success).length || 0
                const failed = result.results?.filter(r => !r.success).length || 0
                setConfirmResult({ succeeded, failed, results: result.results })

                // Remove confirmed matches from the list
                const confirmedIds = new Set(result.results?.filter(r => r.success).map(r => r.orderId))
                setMatches(prev => prev.filter(m => !confirmedIds.has(m.orderId)))
            } else {
                setError(result.error || 'Failed to confirm payments')
            }
        } catch (err: any) {
            setError(err.message || 'Unexpected error')
        } finally {
            setConfirming(false)
        }
    }

    const selectedCount = matches.filter(m => m.selected).length

    return (
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
            <div className="p-6 border-b border-gray-100 bg-gray-50/50">
                <h3 className="text-lg font-bold text-gray-800">Banking — Statement Import</h3>
                <p className="text-xs text-gray-500 mt-1">
                    Upload MT940 (.sta) or CAMT.053 (.xml) bank statements to automatically match incoming payments to orders.
                </p>
            </div>

            <div className="p-6 space-y-6">
                {/* Upload Area */}
                <div className="border-2 border-dashed border-gray-200 rounded-lg p-6 text-center hover:border-blue-300 transition-colors">
                    <input
                        ref={fileRef}
                        type="file"
                        accept=".sta,.mt940,.940,.xml,.txt"
                        onChange={handleUpload}
                        className="hidden"
                        id="bank-statement-upload"
                    />
                    <label
                        htmlFor="bank-statement-upload"
                        className="cursor-pointer block"
                    >
                        <div className="text-3xl mb-2">🏦</div>
                        <p className="text-sm font-medium text-gray-700">
                            {processing ? 'Processing...' : 'Click to upload bank statement'}
                        </p>
                        <p className="text-[10px] text-gray-400 mt-1">
                            Supported formats: MT940 (.sta), CAMT.053 (.xml)
                        </p>
                        {fileName && !processing && (
                            <p className="text-xs text-blue-600 mt-2">Last file: {fileName}</p>
                        )}
                    </label>
                    {processing && (
                        <div className="mt-3">
                            <div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto" />
                        </div>
                    )}
                </div>

                {/* Error */}
                {error && (
                    <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-sm text-red-700">
                        {error}
                    </div>
                )}

                {/* Confirm Result */}
                {confirmResult && (
                    <div className={`rounded-lg p-3 text-sm border ${confirmResult.failed > 0 ? 'bg-amber-50 border-amber-200 text-amber-800' : 'bg-amber-50 border-amber-200 text-amber-800'}`}>
                        {confirmResult.succeeded > 0 && <p>{confirmResult.succeeded} payment(s) recorded successfully.</p>}
                        {confirmResult.failed > 0 && <p>{confirmResult.failed} payment(s) failed to record.</p>}
                    </div>
                )}

                {/* Stats */}
                {stats && (
                    <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
                        <div className="bg-gray-50 rounded-lg p-3 text-center">
                            <div className="text-lg font-bold text-gray-800">{stats.total}</div>
                            <div className="text-[10px] text-gray-500 uppercase">Transactions</div>
                        </div>
                        <div className="bg-blue-50 rounded-lg p-3 text-center">
                            <div className="text-lg font-bold text-blue-700">{stats.credits}</div>
                            <div className="text-[10px] text-blue-500 uppercase">Credits</div>
                        </div>
                        <div className="bg-gray-50 rounded-lg p-3 text-center">
                            <div className="text-lg font-bold text-gray-600">{stats.debits}</div>
                            <div className="text-[10px] text-gray-500 uppercase">Debits</div>
                        </div>
                        <div className="bg-amber-50 rounded-lg p-3 text-center">
                            <div className="text-lg font-bold text-amber-700">{stats.matchedCount}</div>
                            <div className="text-[10px] text-amber-500 uppercase">Matched</div>
                        </div>
                        <div className="bg-amber-50 rounded-lg p-3 text-center">
                            <div className="text-lg font-bold text-amber-700">{stats.unmatchedCount}</div>
                            <div className="text-[10px] text-amber-500 uppercase">Unmatched</div>
                        </div>
                    </div>
                )}

                {/* Matched Transactions */}
                {matches.length > 0 && (
                    <div>
                        <div className="flex items-center justify-between mb-3">
                            <h4 className="font-semibold text-gray-800">Matched Payments</h4>
                            <div className="flex items-center gap-3">
                                <button onClick={selectAll} className="text-xs text-blue-600 hover:underline">Select all</button>
                                <button onClick={deselectAll} className="text-xs text-gray-500 hover:underline">Deselect all</button>
                            </div>
                        </div>

                        <div className="space-y-2 max-h-[400px] overflow-y-auto">
                            {matches.map((match, i) => {
                                const conf = CONFIDENCE_STYLES[match.confidence]
                                return (
                                    <div
                                        key={i}
                                        onClick={() => toggleMatch(i)}
                                        className={`border rounded-lg p-3 cursor-pointer transition-all ${conf.bg} ${match.selected ? 'ring-2 ring-blue-400' : 'opacity-70'}`}
                                    >
                                        <div className="flex items-start gap-3">
                                            <input
                                                type="checkbox"
                                                checked={match.selected}
                                                onChange={() => toggleMatch(i)}
                                                className="mt-1 rounded"
                                            />
                                            <div className="flex-1 min-w-0">
                                                <div className="flex items-center gap-2 flex-wrap mb-1">
                                                    <span className="font-bold text-sm text-gray-800">
                                                        EUR {match.transactionAmount.toFixed(2)}
                                                    </span>
                                                    <span className="text-[10px] text-gray-500">{match.transactionDate}</span>
                                                    <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${conf.badge}`}>
                                                        {conf.label} match
                                                    </span>
                                                </div>
                                                <div className="flex items-center gap-2 text-xs text-gray-600">
                                                    <span>→ Order <strong>{match.orderNumber}</strong></span>
                                                    <span className="text-gray-400">|</span>
                                                    <span>Total: EUR {match.orderTotal.toFixed(2)}</span>
                                                    <span className="text-gray-400">|</span>
                                                    <span>Remaining: EUR {match.remaining.toFixed(2)}</span>
                                                </div>
                                                <p className="text-[10px] text-gray-500 truncate mt-1" title={match.transactionDesc}>
                                                    {match.transactionRef || match.transactionDesc}
                                                </p>
                                            </div>
                                        </div>
                                    </div>
                                )
                            })}
                        </div>

                        <div className="mt-4 flex items-center justify-between">
                            <p className="text-xs text-gray-500">
                                {selectedCount} of {matches.length} selected
                            </p>
                            <button
                                onClick={handleConfirm}
                                disabled={selectedCount === 0 || confirming}
                                className="bg-amber-600 text-white px-5 py-2 rounded-lg text-sm font-bold hover:bg-amber-700 disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                {confirming ? 'Recording...' : `Confirm ${selectedCount} Payment${selectedCount !== 1 ? 's' : ''}`}
                            </button>
                        </div>
                    </div>
                )}

                {/* Unmatched Transactions */}
                {unmatched.length > 0 && (
                    <div>
                        <h4 className="font-semibold text-gray-800 mb-3">Unmatched Credits</h4>
                        <div className="space-y-1 max-h-[200px] overflow-y-auto">
                            {unmatched.map((t, i) => (
                                <div key={i} className="flex items-center gap-3 p-2 rounded border border-gray-100 bg-gray-50 text-xs">
                                    <span className="font-bold text-gray-700 whitespace-nowrap">EUR {t.amount.toFixed(2)}</span>
                                    <span className="text-gray-400">{t.date}</span>
                                    <span className="text-gray-600 truncate flex-1" title={t.description}>
                                        {t.reference || t.description}
                                    </span>
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                {/* Empty state after processing */}
                {stats && matches.length === 0 && unmatched.length === 0 && !confirmResult && (
                    <div className="text-center py-6 text-gray-400 text-sm">
                        No credit transactions found in this statement.
                    </div>
                )}
            </div>
        </div>
    )
}
