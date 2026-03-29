'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useTranslations } from 'next-intl'

export default function TopBanner() {
  const [visible, setVisible] = useState(false)
  const t = useTranslations('topBanner')

  useEffect(() => {
    // Hide on .si and .hr domains — those are our own branded stores
    const host = window.location.hostname.replace(/^www\./, '')
    if (host.endsWith('.si') || host.endsWith('.hr')) return

    const supabase = createClient()
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user) setVisible(true)
    })
  }, [])

  if (!visible) return null

  const handleDismiss = () => {
    setVisible(false)
  }

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="bg-[#1a1a2e] border border-gray-700 rounded-2xl shadow-2xl max-w-lg w-full p-6 sm:p-8">
        {/* Welcome */}
        <h2 className="text-center text-white text-lg font-bold mb-1">
          {t('welcome')}
        </h2>

        {/* Title */}
        <p className="text-center text-amber-400 text-xs font-semibold tracking-widest uppercase mb-3">
          {t('title')}
        </p>

        {/* Body */}
        <p className="text-center text-gray-300 text-sm leading-relaxed mb-5">
          {t.rich('body', {
            strong: (chunks) => <strong className="text-gray-100">{chunks}</strong>,
          })}
        </p>

        {/* Badges */}
        <div className="flex justify-center gap-2 flex-wrap mb-6">
          <span className="text-xs px-3 py-1 rounded-full font-medium border border-green-800 bg-green-950 text-green-300">
            {t('badgeReseller')}
          </span>
          <span className="text-xs px-3 py-1 rounded-full font-medium border border-blue-800 bg-blue-950 text-blue-300">
            {t('badgeEU')}
          </span>
        </div>

        {/* Button */}
        <button
          onClick={handleDismiss}
          className="w-full py-3 rounded-lg bg-amber-500 hover:bg-amber-600 text-[#1a1a2e] font-bold text-sm transition-colors cursor-pointer"
        >
          {t('understand')}
        </button>
      </div>
    </div>
  )
}
