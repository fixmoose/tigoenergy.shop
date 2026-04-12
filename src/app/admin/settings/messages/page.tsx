'use client'

import React, { useState, useEffect, useCallback } from 'react'

interface Notification {
  id: string
  type: string
  title: string
  message: string | null
  source: string
  source_name: string | null
  metadata: Record<string, any>
  read: boolean
  read_at: string | null
  created_at: string
}

const SOURCE_BADGE: Record<string, { label: string; class: string; icon: string }> = {
  accountant: { label: 'Računovodstvo', class: 'bg-purple-100 text-purple-700', icon: '📄' },
  warehouse: { label: 'Skladišče', class: 'bg-amber-100 text-amber-700', icon: '🏭' },
  system: { label: 'System', class: 'bg-slate-100 text-slate-600', icon: '⚙️' },
}

function formatDate(d: string) {
  return new Date(d).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })
}

export default function MessagesPage() {
  const [notifications, setNotifications] = useState<Notification[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState<string>('')

  const fetchAll = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/admin/notifications?limit=200')
      const data = await res.json()
      if (data.success) setNotifications(data.data || [])
    } catch { /* ignore */ }
    setLoading(false)
  }, [])

  useEffect(() => { fetchAll() }, [fetchAll])

  async function markRead(id: string) {
    await fetch('/api/admin/notifications', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id }),
    })
    fetchAll()
  }

  async function markAllRead() {
    await fetch('/api/admin/notifications', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ mark_all_read: true }),
    })
    fetchAll()
  }

  const filtered = filter
    ? notifications.filter(n => n.source === filter)
    : notifications
  const unreadCount = notifications.filter(n => !n.read).length

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Messages & Notifications</h1>
          <p className="text-slate-500 mt-1">
            All notifications from warehouse, accountant, and system.
            {unreadCount > 0 && <span className="text-red-600 font-medium ml-2">{unreadCount} unread</span>}
          </p>
        </div>
        <div className="flex gap-2">
          {unreadCount > 0 && (
            <button
              onClick={markAllRead}
              className="px-4 py-2 bg-slate-100 text-slate-700 rounded-lg hover:bg-slate-200 text-sm font-medium"
            >
              Mark all read
            </button>
          )}
        </div>
      </div>

      {/* Filters */}
      <div className="flex gap-2 mb-6">
        {[
          { value: '', label: 'All' },
          { value: 'warehouse', label: 'Warehouse' },
          { value: 'accountant', label: 'Accountant' },
          { value: 'system', label: 'System' },
        ].map(f => (
          <button
            key={f.value}
            onClick={() => setFilter(f.value)}
            className={`px-3 py-1.5 rounded-lg text-sm font-medium transition ${
              filter === f.value
                ? 'bg-slate-800 text-white'
                : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      {/* Notifications list */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
        {loading ? (
          <div className="p-12 text-center text-slate-400">Loading…</div>
        ) : filtered.length === 0 ? (
          <div className="p-12 text-center text-slate-400">No notifications</div>
        ) : (
          <div className="divide-y divide-slate-100">
            {filtered.map(n => {
              const badge = SOURCE_BADGE[n.source] || SOURCE_BADGE.system
              return (
                <div
                  key={n.id}
                  className={`px-6 py-4 flex items-start gap-4 transition ${!n.read ? 'bg-blue-50/30' : 'hover:bg-slate-50/50'}`}
                >
                  <span className="text-2xl mt-1">{badge.icon}</span>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className={`text-sm font-bold ${!n.read ? 'text-slate-900' : 'text-slate-700'}`}>
                        {n.title}
                      </span>
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${badge.class}`}>
                        {badge.label}
                      </span>
                      {!n.read && <span className="w-2 h-2 rounded-full bg-blue-600 flex-shrink-0" />}
                    </div>
                    {n.message && (
                      <p className="text-sm text-slate-600 mt-1 whitespace-pre-wrap">{n.message}</p>
                    )}
                    {n.metadata?.file_url && (
                      <a
                        href={n.metadata.file_url}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-1 text-xs text-blue-600 hover:underline mt-1 font-medium"
                      >
                        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
                        {n.metadata.file_name || 'Download'}
                      </a>
                    )}
                    {n.metadata?.order_number && (
                      <a
                        href={`/admin/orders/${n.metadata.order_id}`}
                        className="inline-flex items-center gap-1 text-xs text-blue-600 hover:underline mt-1 font-medium"
                      >
                        Order #{n.metadata.order_number}
                      </a>
                    )}
                    <div className="flex items-center gap-3 mt-2">
                      <span className="text-[11px] text-slate-400">
                        {n.source_name && <span className="font-medium">{n.source_name} · </span>}
                        {formatDate(n.created_at)}
                      </span>
                      {!n.read && (
                        <button
                          onClick={() => markRead(n.id)}
                          className="text-[11px] text-blue-600 hover:underline font-medium"
                        >
                          Mark read
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
