'use client'

import React, { useEffect, useState, useRef, useCallback } from 'react'

interface Notification {
  id: string
  type: string
  title: string
  message: string | null
  source: string
  source_name: string | null
  metadata: Record<string, any>
  read: boolean
  created_at: string
}

const SOURCE_ICON: Record<string, string> = {
  accountant: '📄',
  warehouse: '🏭',
  system: '⚙️',
}

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return 'just now'
  if (mins < 60) return `${mins}m ago`
  const hours = Math.floor(mins / 60)
  if (hours < 24) return `${hours}h ago`
  const days = Math.floor(hours / 24)
  return `${days}d ago`
}

export default function NotificationBell() {
  const [notifications, setNotifications] = useState<Notification[]>([])
  const [unreadCount, setUnreadCount] = useState(0)
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const dropdownRef = useRef<HTMLDivElement>(null)

  const fetchNotifications = useCallback(async () => {
    try {
      const res = await fetch('/api/admin/notifications?limit=20')
      const data = await res.json()
      if (data.success) {
        setNotifications(data.data || [])
        setUnreadCount(data.unread_count || 0)
      }
    } catch { /* ignore */ }
  }, [])

  // Poll every 30 seconds for new notifications
  useEffect(() => {
    fetchNotifications()
    const interval = setInterval(fetchNotifications, 30000)
    return () => clearInterval(interval)
  }, [fetchNotifications])

  // Close dropdown on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  async function markRead(id: string) {
    await fetch('/api/admin/notifications', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id }),
    })
    fetchNotifications()
  }

  async function markAllRead() {
    setLoading(true)
    await fetch('/api/admin/notifications', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ mark_all_read: true }),
    })
    await fetchNotifications()
    setLoading(false)
  }

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        type="button"
        onClick={() => setOpen(v => !v)}
        className="relative p-2 rounded-lg text-gray-500 hover:text-gray-800 hover:bg-gray-100 transition"
        title="Notifications"
      >
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
        </svg>
        {unreadCount > 0 && (
          <span className="absolute -top-0.5 -right-0.5 bg-red-600 text-white text-[10px] font-bold rounded-full min-w-[18px] h-[18px] flex items-center justify-center px-1">
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 mt-2 w-96 bg-white rounded-xl shadow-xl border border-gray-200 z-50 overflow-hidden">
          <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between bg-gray-50">
            <h3 className="text-sm font-bold text-gray-800">Notifications</h3>
            <div className="flex items-center gap-2">
              {unreadCount > 0 && (
                <button
                  onClick={markAllRead}
                  disabled={loading}
                  className="text-[11px] text-blue-600 hover:underline font-medium"
                >
                  Mark all read
                </button>
              )}
              <a
                href="/admin/settings/messages"
                className="text-[11px] text-gray-500 hover:text-gray-800 font-medium"
              >
                View all
              </a>
            </div>
          </div>
          <div className="max-h-80 overflow-y-auto divide-y divide-gray-50">
            {notifications.length === 0 ? (
              <div className="p-8 text-center text-gray-400 text-sm">No notifications</div>
            ) : (
              notifications.slice(0, 10).map(n => (
                <div
                  key={n.id}
                  className={`px-4 py-3 hover:bg-gray-50 transition cursor-pointer flex items-start gap-3 ${!n.read ? 'bg-blue-50/40' : ''}`}
                  onClick={() => { if (!n.read) markRead(n.id) }}
                >
                  <span className="text-lg mt-0.5">{SOURCE_ICON[n.source] || '📌'}</span>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className={`text-sm font-semibold ${!n.read ? 'text-gray-900' : 'text-gray-600'}`}>
                        {n.title}
                      </span>
                      {!n.read && <span className="w-2 h-2 rounded-full bg-blue-600 flex-shrink-0" />}
                    </div>
                    {n.message && (
                      <p className="text-xs text-gray-500 mt-0.5 line-clamp-2">{n.message}</p>
                    )}
                    <p className="text-[10px] text-gray-400 mt-1">
                      {n.source_name && <span className="font-medium">{n.source_name} · </span>}
                      {timeAgo(n.created_at)}
                    </p>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  )
}
