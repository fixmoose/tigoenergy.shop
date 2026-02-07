'use client'

import { useEffect, useState } from 'react'
import { useCart } from '@/contexts/CartContext'
import { useCurrency } from '@/contexts/CurrencyContext'
import CartItem from './CartItem'
import SavedCartsList from './SavedCartsList'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { saveCurrentCart } from '@/app/actions/cart_actions'
import { useTranslations } from 'next-intl'

export default function CartPageClient() {
  const { items, subtotal, count, refresh, clearCart } = useCart()
  const { formatPriceNet, formatPriceGross, isB2B, vatRate } = useCurrency()
  const t = useTranslations('cart')
  const tc = useTranslations('common')
  const [user, setUser] = useState<any>(null)
  const [isSaveModalOpen, setIsSaveModalOpen] = useState(false)
  const [saveName, setSaveName] = useState('')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    refresh()
    const supabase = createClient()
    supabase.auth.getUser().then(({ data }) => setUser(data.user))
  }, [])

  const handleSaveCart = async () => {
    if (!user) {
      // Prompt to login/register
      if (confirm("You must be logged in to save a cart. Resetting to login page?")) {
        window.location.href = '/auth/login?redirect=/cart'
      }
      return
    }
    setIsSaveModalOpen(true)
  }

  const performSave = async () => {
    if (!saveName.trim()) return
    setSaving(true)
    try {
      await saveCurrentCart(user.id, saveName, items)
      setIsSaveModalOpen(false)
      setSaveName('')
      // Reload to show in SavedCartsList
      window.location.reload()
    } catch (e) {
      alert("Failed to save cart")
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-12">
        {/* Left: Items */}
        <div className="lg:col-span-2">
          {items.length === 0 ? (
            <div className="bg-gray-50 rounded-lg p-12 text-center border border-gray-100">
              <div className="text-6xl mb-4">🛒</div>
              <div className="text-xl font-medium text-gray-900 mb-2">{t('cartEmpty')}</div>
              <p className="text-gray-500 mb-6">{t('cartEmptyDesc')}</p>
              <Link href="/products" className="inline-block bg-green-600 text-white px-6 py-3 rounded-lg font-bold hover:bg-green-700 transition-colors">{tc('startShopping')}</Link>
            </div>
          ) : (
            <div className="space-y-6">
              <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
                {items.map((it) => (
                  <div key={it.product_id ?? it.sku} className="border-b border-gray-100 last:border-0">
                    <CartItem item={it} />
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Saved Carts Section (Only if logged in) */}
          {user && <SavedCartsList />}
        </div>

        {/* Right: Summary */}
        <aside className="lg:col-span-1">
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6 sticky top-24">
            <h2 className="text-lg font-bold text-gray-900 mb-4">{t('orderSummary')}</h2>

            <div className="space-y-3 mb-6">
              {isB2B ? (
                <>
                  {/* B2B Pricing - Show Net Prices */}
                  <div className="flex justify-between text-gray-600">
                    <span>{t('subtotalNet')}</span>
                    <span>{formatPriceNet(subtotal)}</span>
                  </div>
                  <div className="flex justify-between text-gray-600">
                    <span>{t('vat', { rate: (vatRate * 100).toFixed(0) })}</span>
                    <span className="text-sm text-gray-400">{t('vatAddedAtCheckout')}</span>
                  </div>
                  <div className="flex justify-between text-gray-600">
                    <span>{t('shipping')}</span>
                    <span className="text-sm">{t('shippingCalc')}</span>
                  </div>
                  <div className="border-t border-gray-100 pt-3 flex justify-between font-bold text-xl text-gray-900">
                    <span>{t('totalNet')}</span>
                    <span>{formatPriceNet(subtotal)}</span>
                  </div>
                  <div className="bg-blue-50 border border-blue-100 rounded-lg p-3 mt-2">
                    <p className="text-xs text-blue-700">
                      <strong>{t('b2bPricing')}</strong> {t('b2bPricingDesc')}
                    </p>
                  </div>
                </>
              ) : (
                <>
                  {/* B2C Pricing - Show Gross Prices (VAT included) */}
                  <div className="flex justify-between text-gray-600">
                    <span>{t('items', { count })}</span>
                    <span>{formatPriceGross(subtotal)}</span>
                  </div>
                  <div className="flex justify-between text-gray-600 text-sm">
                    <span>{t('includesVat', { rate: (vatRate * 100).toFixed(0) })}</span>
                    <span>{formatPriceNet(subtotal * vatRate)}</span>
                  </div>
                  <div className="flex justify-between text-gray-600">
                    <span>{t('shipping')}</span>
                    <span className="text-sm">{t('shippingCalc')}</span>
                  </div>
                  <div className="border-t border-gray-100 pt-3 flex justify-between font-bold text-xl text-gray-900">
                    <span>{t('total')}</span>
                    <span>{formatPriceGross(subtotal)}</span>
                  </div>
                  <div className="bg-green-50 border border-green-100 rounded-lg p-3 mt-2">
                    <p className="text-xs text-green-700">
                      <strong>{t('priceIncludesVat')}</strong> {t('priceIncludesVatDesc', { rate: (vatRate * 100).toFixed(0) })}
                    </p>
                  </div>
                </>
              )}
            </div>

            <div className="space-y-3">
              <Link href="/checkout" className="block w-full text-center bg-green-600 text-white text-lg font-bold py-3.5 rounded-lg hover:bg-green-700 transition-all shadow-lg shadow-green-200">
                {t('secureCheckout')}
              </Link>

              <button
                onClick={handleSaveCart}
                disabled={items.length === 0}
                className="w-full bg-white text-gray-700 font-medium py-2.5 rounded-lg border border-gray-200 hover:bg-gray-50 transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
              >
                <span>💾</span> {t('saveCartForLater')}
              </button>

              {items.length > 0 && (
                <button
                  onClick={() => { if (confirm("Clear cart?")) clearCart() }}
                  className="w-full text-red-500 text-sm font-medium hover:underline mt-2"
                >
                  {t('clearCart')}
                </button>
              )}
            </div>
          </div>
        </aside>
      </div>

      {/* Save Cart Modal */}
      {isSaveModalOpen && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-md w-full p-6">
            <h3 className="text-xl font-bold mb-4">{t('saveCart')}</h3>
            <p className="text-sm text-gray-500 mb-4">{t('saveCartDesc')}</p>

            <input
              type="text"
              value={saveName}
              onChange={e => setSaveName(e.target.value)}
              placeholder={t('enterCartName')}
              className="w-full border border-gray-300 rounded-lg px-4 py-2 mb-6 focus:ring-2 focus:ring-green-500 outline-none"
              autoFocus
            />

            <div className="flex justify-end gap-3">
              <button
                onClick={() => setIsSaveModalOpen(false)}
                className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg font-medium"
              >
                {t('cancel')}
              </button>
              <button
                onClick={performSave}
                disabled={!saveName.trim() || saving}
                className="px-2 py-2 bg-green-600 text-white rounded-lg font-bold hover:bg-green-700 disabled:opacity-50 min-w-[100px]"
              >
                {saving ? t('saving') : t('saveCart')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
