'use client'

import React, { createContext, useContext, useEffect, useState } from 'react'
import type { CartItem as DBCartItem, Cart as DBCart } from '@/types/database'
import { createClient } from '@/lib/supabase/client'

type CartItem = DBCartItem

interface CartState {
  items: CartItem[]
  cartId?: string | null
}

interface CartContextValue {
  items: CartItem[]
  cartId?: string | null
  count: number
  subtotal: number
  addItem: (item: CartItem) => Promise<void>
  updateQuantity: (productIdOrSku: string, qty: number) => Promise<void>
  removeItem: (productIdOrSku: string) => Promise<void>
  clearCart: () => Promise<void>
  refresh: () => Promise<void>
  open: boolean
  openDrawer: () => void
  closeDrawer: () => void
}

const CartContext = createContext<CartContextValue | undefined>(undefined)

export function useCart() {
  const ctx = useContext(CartContext)
  if (!ctx) throw new Error('useCart must be used within CartProvider')
  return ctx
}

const LOCAL_KEY = 'cart_local_v1'

export function CartProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<CartState>({ items: [], cartId: null })
  const [open, setOpen] = useState(false)

  const [showRestorePrompt, setShowRestorePrompt] = useState(false)

  async function savePersistent(items: CartItem[]) {
    try {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (user) {
        localStorage.setItem(LOCAL_KEY, JSON.stringify(items))
      } else {
        localStorage.removeItem(LOCAL_KEY) // Ensure guest items don't leak into storage
      }
    } catch (e) {
      // ignore
    }
  }

  function loadLocal(): CartItem[] {
    try {
      const raw = localStorage.getItem(LOCAL_KEY)
      return raw ? JSON.parse(raw) : []
    } catch (e) {
      return []
    }
  }

  const compute = (items: CartItem[]) => {
    const count = items.reduce((s, i) => s + (i.quantity || 0), 0)
    const subtotal = items.reduce((s, i) => s + ((i.total_price ?? i.unit_price * (i.quantity || 0)) || 0), 0)
    return { count, subtotal }
  }

  async function fetchServerCart() {
    try {
      const res = await fetch('/api/cart')
      if (!res.ok) return null
      const json = await res.json()
      return json?.cart ?? null
    } catch (e) {
      return null
    }
  }

  useEffect(() => {
    // On mount, try server cart; fallback to local ONLY if authenticated
    let mounted = true
      ; (async () => {
        const serverCart: DBCart | null = await fetchServerCart()
        if (!mounted) return
        if (serverCart) {
          setState({ items: serverCart.items ?? [], cartId: serverCart.id })
        } else {
          // If no server cart, check if we have local storage (but only if user is logged in)
          const supabase = createClient()
          const { data: { user } } = await supabase.auth.getUser()
          if (user) {
            const local = loadLocal()
            setState({ items: local, cartId: null })
          } else {
            setState({ items: [], cartId: null })
          }
        }
      })()

    return () => {
      mounted = false
    }
  }, [])

  useEffect(() => {
    const supabase = createClient()
    const { data } = supabase.auth.onAuthStateChange(async (event: string, session) => {
      if (event === 'SIGNED_IN') {
        const serverCart = await fetchServerCart()
        if (serverCart && (serverCart.items?.length || 0) > 0) {
          // Items exist in server cart from last time
          setState({ items: serverCart.items ?? [], cartId: serverCart.id })
          setShowRestorePrompt(true)
        } else {
          // Fresh login or empty server cart
          await refresh()
        }

        // Handle guest merge if applicable
        let guestCartId: string | undefined
        if (typeof document !== 'undefined') {
          const m = document.cookie.match(new RegExp('(^| )cartId=([^;]+)'))
          guestCartId = m ? decodeURIComponent(m[2]) : undefined
        }

        if (guestCartId) {
          try {
            await fetch('/api/cart', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ action: 'merge', guestCartId }),
            })
            if (typeof document !== 'undefined') {
              document.cookie = 'cartId=; Path=/; Max-Age=0; SameSite=Lax'
            }
            await refresh()
          } catch (e) {
            // ignore
          }
        }
      } else if (event === 'SIGNED_OUT') {
        // Clear all state and local storage on logout
        setState({ items: [], cartId: null })
        localStorage.removeItem(LOCAL_KEY)
      }
    })

    return () => {
      data?.subscription?.unsubscribe?.()
    }
  }, [])

  async function addItem(item: CartItem) {
    // Call API add
    try {
      const res = await fetch('/api/cart/add', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ item }) })
      const payload = await res.json()
      if (res.ok && payload?.cart) {
        setState({ items: payload.cart.items ?? [], cartId: payload.cart.id })
        savePersistent(payload.cart.items ?? [])
        return
      }
    } catch (e) {
      // ignore
    }

    // fallback to local only (state)
    const next = [...state.items]
    const idx = next.findIndex((i) => i.product_id === item.product_id || i.sku === item.sku)
    if (idx === -1) next.push(item)
    else next[idx] = { ...next[idx], quantity: (next[idx].quantity || 0) + item.quantity, total_price: (next[idx].unit_price || item.unit_price) * ((next[idx].quantity || 0) + item.quantity) }
    setState({ ...state, items: next })
    savePersistent(next)
  }

  async function updateQuantity(productIdOrSku: string, qty: number) {
    try {
      const res = await fetch('/api/cart', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'update', productIdOrSku, updates: { quantity: qty } }) })
      const payload = await res.json()
      if (res.ok && payload?.cart) {
        setState({ items: payload.cart.items ?? [], cartId: payload.cart.id })
        savePersistent(payload.cart.items ?? [])
        return
      }
    } catch (e) {
      // ignore
    }

    // fallback local update
    const next = state.items.map((i) => (i.product_id === productIdOrSku || i.sku === productIdOrSku ? { ...i, quantity: qty, total_price: (i.unit_price || 0) * qty } : i))
    setState({ ...state, items: next })
    savePersistent(next)
  }

  async function removeItem(productIdOrSku: string) {
    try {
      const res = await fetch('/api/cart', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'remove', productIdOrSku }) })
      const payload = await res.json()
      if (res.ok && payload?.cart) {
        setState({ items: payload.cart.items ?? [], cartId: payload.cart.id })
        savePersistent(payload.cart.items ?? [])
        return
      }
    } catch (e) {
      // ignore
    }

    const next = state.items.filter((i) => !(i.product_id === productIdOrSku || i.sku === productIdOrSku))
    setState({ ...state, items: next })
    savePersistent(next)
  }

  async function clearCart() {
    try {
      await fetch('/api/cart', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'clear' }),
      })
      setState({ items: [], cartId: state.cartId })
      savePersistent([])
    } catch (e) {
      setState({ items: [], cartId: state.cartId })
      savePersistent([])
    }
  }

  async function refresh() {
    const serverCart = await fetchServerCart()
    if (serverCart) setState({ items: serverCart.items ?? [], cartId: serverCart.id })
  }

  const { count, subtotal } = compute(state.items)

  const value: CartContextValue = {
    items: state.items,
    cartId: state.cartId,
    count,
    subtotal,
    addItem,
    updateQuantity,
    removeItem,
    clearCart,
    refresh,
    open,
    openDrawer: () => setOpen(true),
    closeDrawer: () => setOpen(false),
  }

  return (
    <CartContext.Provider value={value}>
      {children}

      {/* Restoration Prompt Modal */}
      {showRestorePrompt && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden animate-in fade-in zoom-in-95 duration-300">
            <div className="p-8 text-center">
              <div className="w-16 h-16 bg-blue-50 text-blue-600 rounded-full flex items-center justify-center mx-auto mb-6">
                <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z" />
                </svg>
              </div>
              <h3 className="text-xl font-bold text-gray-900 mb-3">Welcome Back!</h3>
              <p className="text-gray-500 mb-8 leading-relaxed">
                You have items in your cart from last time you were here. Want to keep them or start fresh?
              </p>
              <div className="flex flex-col gap-3">
                <button
                  onClick={() => setShowRestorePrompt(false)}
                  className="w-full bg-blue-600 text-white font-bold py-3.5 rounded-xl hover:bg-blue-700 transition shadow-lg shadow-blue-200"
                >
                  Restore my items
                </button>
                <button
                  onClick={async () => {
                    await clearCart()
                    setShowRestorePrompt(false)
                  }}
                  className="w-full bg-gray-100 text-gray-600 font-bold py-3.5 rounded-xl hover:bg-gray-200 transition"
                >
                  Start Fresh
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </CartContext.Provider>
  )
}
