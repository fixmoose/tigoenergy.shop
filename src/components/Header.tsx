'use client'
import Link from 'next/link'
import { useState, useEffect } from 'react'
import { useCart } from '@/contexts/CartContext'
import { useCurrency } from '@/contexts/CurrencyContext'
import { useMarket } from '@/contexts/MarketContext'
import { SORTED_CURRENCIES } from '@/lib/constants/currencies'
import { LANGUAGES } from '@/lib/constants/languages'
import { createClient } from '@/lib/supabase/client'
import { User } from '@supabase/supabase-js'
import { useTranslations } from 'next-intl'

import { usePathname } from 'next/navigation'

export default function Header() {
  const { count, subtotal, items, openDrawer } = useCart()
  const { currentCurrency, setCurrency, formatPrice } = useCurrency()
  const { market, currentLanguage, setLanguage } = useMarket()
  const t = useTranslations('header')
  const tc = useTranslations('common')
  const tsub = useTranslations('subcategories')
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const [user, setUser] = useState<User | null>(null)
  const [isAdmin, setIsAdmin] = useState(false)
  const [hasActiveOrders, setHasActiveOrders] = useState(false)
  const [categories, setCategories] = useState<{ name: string; slug: string; subcategories: { name: string; image_url?: string }[] }[]>([])
  const pathname = usePathname()
  const isHome = pathname === '/'
  const [isScrolled, setIsScrolled] = useState(false)
  const [mounted, setMounted] = useState(false)

  // Search State
  const [searchQuery, setSearchQuery] = useState('')
  const [suggestions, setSuggestions] = useState<any[]>([])
  const [showSuggestions, setShowSuggestions] = useState(false)
  const [isSearching, setIsSearching] = useState(false)

  // Debounce search input to avoid API spam
  useEffect(() => {
    const timer = setTimeout(async () => {
      if (searchQuery.length >= 3) {
        setIsSearching(true)
        try {
          const res = await fetch(`/api/search/suggestions?q=${encodeURIComponent(searchQuery)}`)
          const data = await res.json()
          setSuggestions(data.suggestions || [])
          setShowSuggestions(true)
        } catch (e) {
          console.error("Search error", e)
        } finally {
          setIsSearching(false)
        }
      } else {
        setSuggestions([])
        setShowSuggestions(false)
      }
    }, 300)

    return () => clearTimeout(timer)
  }, [searchQuery])

  // Click outside to close (simplified)
  useEffect(() => {
    const handleClickOutside = () => setShowSuggestions(false)
    if (showSuggestions) {
      window.addEventListener('click', handleClickOutside)
    }
    return () => window.removeEventListener('click', handleClickOutside)
  }, [showSuggestions])

  // Handle scroll effect
  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 20)
    }
    window.addEventListener('scroll', handleScroll)
    return () => window.removeEventListener('scroll', handleScroll)
  }, [])

  // Check auth state (client-side)
  useEffect(() => {
    setMounted(true)
    const supabase = createClient()

    // 1. Fetch Categories
    const fetchCategories = async () => {
      const { data } = await supabase.from('categories').select('id, name, slug, parent_id, sort_order, image_url').order('sort_order', { ascending: true })
      if (data) {
        // Build hierarchy
        const roots = data.filter(c => !c.parent_id).sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0))
        const hierarchy = roots.map(root => {
          const subs = data
            .filter(c => c.parent_id === root.id)
            .sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0))
            .map(s => ({ name: s.name, image_url: s.image_url }))

          return {
            name: root.name,
            slug: root.slug,
            subcategories: subs
          }
        })
        setCategories(hierarchy)
      }
    }
    fetchCategories()

    // 2. Auth Check
    const checkActiveOrders = async (userId: string) => {
      const { count } = await supabase
        .from('orders')
        .select('*', { count: 'exact', head: true })
        .eq('customer_id', userId)
        .neq('status', 'cancelled')
      setHasActiveOrders(count ? count > 0 : false)
    }

    supabase.auth.getUser().then(({ data: { user } }) => {
      setUser(user)
      if (user) checkActiveOrders(user.id)
    })

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null)
      if (session?.user) checkActiveOrders(session.user.id)
      else setHasActiveOrders(false)
    })

    return () => subscription.unsubscribe()
  }, [])

  // Sync admin state
  useEffect(() => {
    setIsAdmin(user?.user_metadata?.role === 'admin')
  }, [user])

  // Image map for specific subcategories
  const MENU_IMAGES: Record<string, Record<string, string>> = {
    'TS4 FLEX MLPE': {
      'Optimization': 'https://cdn.prod.website-files.com/5fad551d7419c7a0e9e4aba4/68516440552d37e4f0c88f06_TS4-A-O%20outlined%20Hi%20Res.avif',
      'Safety': 'https://cdn.prod.website-files.com/5fad551d7419c7a0e9e4aba4/68516458f4462a52b4bca14e_TS4-A-S%20Outlined%20Hi%20Res.avif',
      'Fire Safety': 'https://cdn.prod.website-files.com/5fad551d7419c7a0e9e4aba4/6851646d552d37e4f0c8be7d_TS4-A-F%20Outlined%20Hi%20Res.avif',
    },
    'TS4-X MLPE': {
      'Optimization': 'https://cdn.prod.website-files.com/5fad551d7419c7a0e9e4aba4/672bc1acf24f693f6f85d428_MLPE_Device_TS4-X-O-102024_5%20(1).avif',
      'Safety': 'https://cdn.prod.website-files.com/5fad551d7419c7a0e9e4aba4/672bc18e46200615f0479262_MLPE_Device_102024_5.avif',
      'Fire Safety': 'https://cdn.prod.website-files.com/5fad551d7419c7a0e9e4aba4/672bc18e46200615f0479262_MLPE_Device_102024_5.avif', // Using same for safety/fire safety as explicit X-F image not found, or X-S covers it visually similar
    },
    'EI RESIDENTIAL SOLUTION': {
      'EI Inverter': 'https://cdn.prod.website-files.com/5fad551d7419c7a0e9e4aba4/6361884c045e7e5c11edb624_EI%20Inverter%20-%20front%20(1).avif',
      'EI Battery': '/images/custom/bms_update.png',
      'EI Link': 'https://cdn.prod.website-files.com/5fad551d7419c7a0e9e4aba4/63619c788bbec98158fd2518_EI%20Link%20-%20Front%20(1).avif',
      'GO EV Charger': '/images/custom/go_ev_charger_update.png',
      'GO Junction': 'https://cdn.prod.website-files.com/5fad551d7419c7a0e9e4aba4/66f5a6dc7384f63e0dc050cc_GO%20Junction%20-%20Right.avif',
    },
    'COMMUNICATIONS': {
      'Data Loggers': '/images/custom/cca_kit_update.png', // Assuming we have this or similar, otherwise fallback to known CCA image
      'Access Points': 'https://cdn.prod.website-files.com/5fad551d7419c7a0e9e4aba4/62d1a278e69c5c6d80059ee6_TAP%20Outlined%20LowRes%20(1).avif',
      'Rapid Shutdown': 'https://cdn.prod.website-files.com/5fad551d7419c7a0e9e4aba4/62d85e672c6211ef700c5043_RSS%20Transmitter%202%20Cores%20ISO%20(1).avif'
    }
  }

  const handleSignOut = async () => {
    const supabase = createClient()
    await supabase.auth.signOut()
    window.location.href = '/'
  }

  return (
    <>

      <header className={`flex flex-col w-full z-50 transition-all duration-300 ${isHome ? 'fixed top-0 left-0' : 'sticky top-0'}`}>

        {/* 1. Top Bar (Promo/Utility) */}
        <div className="bg-gray-100 text-gray-600 text-[10px] sm:text-xs border-b border-gray-200 transition-colors">
          <div className="max-w-[1440px] mx-auto px-4 sm:px-6 lg:px-8 py-1.5 flex justify-between items-center">
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2 sm:gap-4">
                <Link href="/auth/register?type=b2c" className="italic hover:text-green-700 transition">
                  {t('promoAccount')}
                </Link>
                <span className="hidden sm:inline text-gray-300">|</span>
                <Link href="/auth/register?type=b2b" className="hidden sm:inline italic hover:text-green-700 transition font-medium">
                  {t('promoB2B')}
                </Link>
              </div>
            </div>
            <div className="flex items-center gap-4 text-gray-500">
              {/* Language Selector — only for markets with language picker */}
              {market.hasLanguagePicker && (
                <div className="relative group/lang z-[60]">
                  <div className="flex items-center gap-1.5 cursor-pointer hover:text-green-700 transition py-1 px-2 rounded-md hover:bg-white/50">
                    <span className="text-base leading-none">{currentLanguage.flag}</span>
                    <span className="font-bold">{currentLanguage.code.toUpperCase()}</span>
                    <svg className="w-3 h-3 opacity-50" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" /></svg>
                  </div>
                  <div className="absolute top-full right-0 mt-1 w-56 bg-white rounded-xl shadow-2xl border border-gray-100 opacity-0 invisible group-hover/lang:opacity-100 group-hover/lang:visible transition-all duration-200 py-2">
                    <div className="px-4 py-1.5 text-[10px] font-bold text-gray-400 uppercase tracking-widest bg-gray-50/50 mb-1">
                      {t('selectLanguage')}
                    </div>
                    {market.availableLanguages.map((code) => {
                      const lang = LANGUAGES[code]
                      if (!lang) return null
                      return (
                        <button
                          key={code}
                          onClick={() => setLanguage(code)}
                          className={`w-full flex items-center gap-3 px-4 py-2 text-sm transition-colors text-left ${currentLanguage.code === code ? 'bg-green-50 text-green-700 font-bold' : 'text-gray-700 hover:bg-gray-50'}`}
                        >
                          <span className="text-lg leading-none w-6">{lang.flag}</span>
                          <span className="flex-1">{lang.nativeName}</span>
                          {currentLanguage.code === code && <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M5 13l4 4L19 7" /></svg>}
                        </button>
                      )
                    })}
                  </div>
                </div>
              )}

              {/* Currency Selector — dropdown for picker markets, static for locked */}
              {market.hasCurrencyPicker ? (
                <div className="relative group/curr z-[60]">
                  <div className="flex items-center gap-1.5 cursor-pointer hover:text-green-700 transition py-1 px-2 rounded-md hover:bg-white/50">
                    <span className="text-base leading-none">{currentCurrency.flag}</span>
                    <span className="font-bold">{currentCurrency.code}</span>
                    <svg className="w-3 h-3 opacity-50" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" /></svg>
                  </div>
                  <div className="absolute top-full right-0 mt-1 w-64 bg-white rounded-xl shadow-2xl border border-gray-100 opacity-0 invisible group-hover/curr:opacity-100 group-hover/curr:visible transition-all duration-200 py-2">
                    <div className="px-4 py-1.5 text-[10px] font-bold text-gray-400 uppercase tracking-widest bg-gray-50/50 mb-1">
                      {t('selectCurrency')}
                    </div>
                    <div className="max-h-[400px] overflow-y-auto custom-scrollbar">
                      {SORTED_CURRENCIES.map((curr) => (
                        <button
                          key={curr.code}
                          onClick={() => setCurrency(curr.code)}
                          className={`w-full flex items-center gap-3 px-4 py-2 text-sm transition-colors text-left ${currentCurrency.code === curr.code ? 'bg-green-50 text-green-700 font-bold' : 'text-gray-700 hover:bg-gray-50'}`}
                        >
                          <span className="text-lg leading-none w-6">{curr.flag}</span>
                          <span className="font-mono w-10">{curr.code}</span>
                          <span className="flex-1 truncate opacity-70">{curr.name}</span>
                          {currentCurrency.code === curr.code && <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M5 13l4 4L19 7" /></svg>}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              ) : (
                <div className="flex items-center gap-1.5 py-1 px-2">
                  <span className="text-base leading-none">{market.flag}</span>
                  <span className="font-bold">{currentCurrency.code}</span>
                </div>
              )}

              <span className="hidden md:inline">|</span>
              <a href="mailto:support@tigoenergy.shop" className="hover:text-green-700 transition">{t('help')}</a>
            </div>
          </div>
        </div>

        {/* 2. Main Header */}
        <div className={`text-white transition-all duration-300 ${isHome && !isScrolled ? 'bg-transparent shadow-none' : 'bg-green-600 shadow-md'} sticky top-0 z-50`}>
          <div className="max-w-[1440px] mx-auto px-4 sm:px-6 lg:px-8 h-[80px] flex items-center justify-between gap-8">

            {/* Logo */}
            <Link href="/" className="flex items-center gap-2 flex-shrink-0">
              <img
                src="/tigo-logo.png"
                alt="Tigo Energy"
                className="h-10"
                style={{ filter: 'brightness(0) invert(1)' }}
              />
              <div className="flex flex-col leading-tight">
                <span className="text-green-100 text-xs font-medium tracking-wider">TIGO AUTHORIZED</span>
                <span className="text-green-100 text-xs font-medium tracking-wider">DIRECT ONLINE SHOP</span>
                <span className="bg-orange-500 text-white text-[8px] font-black px-1.5 py-0.5 rounded-sm mt-1 w-fit uppercase tracking-tighter shadow-sm">BETA eStore</span>
              </div>
            </Link>

            {/* Search Bar - Wide & Pill-shaped */}
            <div className="hidden lg:block flex-1 max-w-3xl relative" onClick={(e) => e.stopPropagation()}>
              <div className="relative w-full">
                <input
                  type="text"
                  placeholder={t('searchPlaceholder')}
                  className="w-full h-[48px] pl-6 pr-12 rounded-full border-none text-gray-900 placeholder-gray-500 focus:ring-4 focus:ring-green-500/30 shadow-lg"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  onFocus={() => searchQuery.length >= 3 && setShowSuggestions(true)}
                />
                <div className="absolute right-2 top-1/2 -translate-y-1/2 w-10 h-10 bg-orange-500 hover:bg-orange-600 rounded-full text-white transition flex items-center justify-center shadow-sm cursor-pointer">
                  {isSearching ? (
                    <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                  ) : (
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                    </svg>
                  )}
                </div>
              </div>

              {/* Smart Suggestions Dropdown */}
              {showSuggestions && suggestions.length > 0 && (
                <div className="absolute top-full left-0 right-0 mt-2 bg-white rounded-xl shadow-2xl overflow-hidden border border-gray-100 z-[100] animate-in fade-in zoom-in-95 duration-200">
                  <div className="py-2">
                    <div className="px-4 py-2 text-xs font-bold text-gray-400 uppercase tracking-wider bg-gray-50 border-b mb-1">
                      {t('recommendedMatches')}
                    </div>
                    {suggestions.map((item) => (
                      <Link
                        key={item.slug}
                        href={`/products/${item.slug}`}
                        onClick={() => {
                          setShowSuggestions(false)
                          setSearchQuery('')
                        }}
                        className="flex items-center gap-4 px-4 py-3 hover:bg-green-50 transition-colors group/item"
                      >
                        <div className="w-10 h-10 bg-gray-100 rounded-md flex-shrink-0 p-1 border border-gray-200 group-hover/item:border-green-200 overflow-hidden">
                          {item.image &&
                            /* eslint-disable-next-line @next/next/no-img-element */
                            <img src={item.image} alt={item.name} className="w-full h-full object-contain mix-blend-multiply" />
                          }
                        </div>
                        <div className="flex-1 min-w-0">
                          <h4 className="text-sm font-semibold text-gray-800 truncate group-hover/item:text-green-700">{item.name}</h4>
                          <div className="flex items-center gap-2 text-xs">
                            <span className="text-gray-500 font-mono">{item.sku}</span>
                            {item.stock > 0 ? (
                              <span className="text-green-600 font-medium bg-green-50 px-1.5 rounded-full">
                                {item.stock} in stock
                              </span>
                            ) : (
                              <span className="text-orange-500 font-medium bg-orange-50 px-1.5 rounded-full">
                                Avail. to Order
                              </span>
                            )}
                          </div>
                        </div>
                      </Link>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Actions */}
            <div className="flex items-center gap-6 flex-shrink-0">
              {/* User Info Label */}
              {mounted && user && (
                <div className="hidden lg:flex flex-col text-right mr-2 leading-tight">
                  <span className="text-[10px] text-green-100 font-medium opacity-80">Logged in as &quot;{isAdmin ? 'Admin' : (user.user_metadata?.customer_type?.toUpperCase() || 'B2C')}&quot;</span>
                  <span className="text-xs font-bold truncate max-w-[180px]" title={user.email}>{user.email}</span>
                </div>
              )}

              {/* Account / Sign In */}
              {/* Account Dropdown */}
              <div className="flex flex-col items-center group relative cursor-pointer">
                {/* prominent BETA Badge */}
                <div className="absolute -top-3 -right-6 pointer-events-none z-10">
                  <span className="bg-orange-500 text-white text-[10px] font-black px-2 py-0.5 rounded-full shadow-lg border-2 border-green-600 transform rotate-12 scale-125 inline-block">
                    BETA
                  </span>
                </div>
                <Link href={mounted && user ? (isAdmin || user.email?.endsWith('@tigoenergy.com') ? "/admin/products" : "/dashboard") : "/auth/login"} className="flex flex-col items-center">
                  {mounted && user && !isAdmin ? (
                    <div className="w-8 h-8 rounded-full overflow-hidden border-2 border-green-50 group-hover:border-white transition shadow-sm">
                      <img src="/b2c-avatar.png" alt="Profile" className="w-full h-full object-cover" />
                    </div>
                  ) : (
                    <svg className="w-7 h-7 text-green-50 group-hover:text-white transition" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                    </svg>
                  )}
                  <span className="text-xs font-medium text-green-50 group-hover:text-white transition mt-1">
                    {mounted && user ? t('account') : t('signIn')}
                  </span>
                </Link>

                {/* Dropdown Menu - LOGGED IN */}
                {mounted && user && (
                  <div className="absolute top-full right-0 pt-6 opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 z-50">
                    <div className="w-56 bg-white rounded-lg shadow-xl border border-gray-100 overflow-hidden">
                      <div className="py-1">
                        <Link
                          href={isAdmin ? "/admin/products" : "/dashboard"}
                          className="block px-4 py-2 text-sm text-gray-700 hover:bg-green-50 hover:text-green-600"
                        >
                          {isAdmin ? t('adminDashboard') : t('myAccount')}
                        </Link>
                        {hasActiveOrders && (
                          <Link href="/dashboard#orders" className="block px-4 py-2 text-sm text-gray-700 hover:bg-green-50 hover:text-green-600">
                            {t('myOrders')}
                          </Link>
                        )}
                        <div className="border-t border-gray-100 my-1"></div>
                        <button
                          onClick={handleSignOut}
                          className="block w-full text-left px-4 py-2 text-sm text-red-600 hover:bg-red-50 hover:text-red-700"
                        >
                          {t('signOut')}
                        </button>
                      </div>
                    </div>
                  </div>
                )}

                {/* Dropdown Menu - NOT LOGGED IN */}
                {mounted && !user && (
                  <div className="absolute top-full right-0 pt-6 opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 z-50">
                    <div className="w-56 bg-white rounded-lg shadow-xl border border-gray-100 overflow-hidden">
                      <div className="py-1">
                        <Link href="/auth/login" className="block px-4 py-2 text-sm text-gray-700 hover:bg-green-50 hover:text-green-600">
                          {t('signIn')}
                        </Link>
                        <div className="border-t border-gray-100 my-1"></div>
                        <Link href="/auth/register?type=b2c" className="block px-4 py-2 text-sm text-gray-700 hover:bg-green-50 hover:text-green-600">
                          {t('createAccount')}
                        </Link>
                        <Link href="/auth/register?type=b2b" className="block px-4 py-2 text-sm text-gray-700 hover:bg-green-50 hover:text-green-600">
                          {t('createB2BAccount')}
                        </Link>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* Orders (Optional, mimicking iHerb) */}
              {hasActiveOrders && (
                <Link href="/dashboard#orders" className="hidden sm:flex flex-col items-center group cursor-pointer">
                  <svg className="w-7 h-7 text-green-50 group-hover:text-white transition" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                  </svg>
                  <span className="text-xs font-medium text-green-50 group-hover:text-white transition mt-1">{t('orders')}</span>
                </Link>
              )}

              {/* Cart Wrapper with Hover */}
              <div className="relative group z-50">
                <Link href="/cart" className="flex flex-col items-center cursor-pointer">
                  <div className="relative">
                    <svg className="w-7 h-7 text-green-50 group-hover:text-white transition" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z" />
                    </svg>
                    {count > 0 && (
                      <span className="absolute -top-2 -right-2 bg-orange-500 text-white text-[10px] font-bold rounded-full h-5 w-5 flex items-center justify-center border-2 border-green-600 shadow-sm">
                        {count}
                      </span>
                    )}
                  </div>
                  <span className="text-xs font-medium text-green-50 group-hover:text-white transition mt-1">{t('cart')}</span>
                </Link>

                {/* Cart Hover Dropdown */}
                <div className="absolute top-full right-0 pt-4 w-80 opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200" style={{ transformOrigin: 'top right' }}>
                  <div className="bg-white rounded-xl shadow-2xl border border-gray-100 overflow-hidden ring-1 ring-black ring-opacity-5">
                    {/* Header */}
                    <div className="p-3 border-b border-gray-100 bg-gray-50 flex justify-between items-center text-gray-400">
                      <span className="text-xs font-bold uppercase tracking-wider">{t('myCart')} ({count})</span>
                      <span className="text-xs font-mono">{formatPrice(subtotal)}</span>
                    </div>

                    {/* Items (Max 3-4 items) */}
                    <div className="max-h-64 overflow-y-auto">
                      {count === 0 ? (
                        <div className="p-6 text-center text-gray-400 text-sm">{t('cartEmpty')}</div>
                      ) : (
                        <>
                          <div className="divide-y divide-gray-100">
                            {items.slice(0, 3).map(item => (
                              <div key={item.product_id || item.sku} className="p-3 hover:bg-gray-50 flex gap-3 text-sm transition-colors cursor-pointer" onClick={() => window.location.href = '/cart'}>
                                <div className="w-10 h-10 bg-gray-100 rounded shrink-0 flex items-center justify-center text-[10px] text-gray-500 font-bold border border-gray-200">
                                  {item.quantity}x
                                </div>
                                <div className="flex-1 min-w-0">
                                  <div className="font-medium text-gray-800 truncate">{item.name}</div>
                                  <div className="text-gray-500 text-xs">{formatPrice(item.unit_price || 0)}</div>
                                </div>
                                <div className="font-bold text-gray-900 text-xs self-start">
                                  {formatPrice((item.total_price) || (item.unit_price || 0) * item.quantity)}
                                </div>
                              </div>
                            ))}
                          </div>
                          {items.length > 3 && (
                            <div className="p-2 text-center text-xs text-gray-500 bg-gray-50 border-t border-gray-100">
                              + {items.length - 3} more items
                            </div>
                          )}
                          <div className="p-3 bg-gray-50 border-t border-gray-100">
                            <Link href="/cart" className="block w-full bg-green-600 hover:bg-green-700 text-white text-center text-xs font-bold py-2 rounded transition uppercase tracking-wide">
                              {t('viewCartCheckout')}
                            </Link>
                          </div>
                        </>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              {/* Mobile Menu Toggle */}
              <button
                onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
                className="lg:hidden p-1 text-white hover:bg-green-700/50 rounded-lg transition"
              >
                <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 6h16M4 12h16M4 18h16" />
                </svg>
              </button>
            </div>
          </div>
        </div>

        {/* 3. Category Navigation Bar (White) */}
        <div className="bg-white border-b border-gray-200 hidden lg:block shadow-sm z-40">
          <div className="max-w-[1440px] mx-auto px-4 sm:px-6 lg:px-8 h-[50px] flex items-center gap-8">
            <Link href="/products" className="text-sm font-bold text-gray-900 hover:text-green-600 uppercase tracking-wide flex items-center gap-1">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 6h16M4 12h16M4 18h7" /></svg>
              {t('shopAll')}
            </Link>
            <div className="h-5 w-px bg-gray-200"></div>
            {categories.map((cat) => (
              <div key={cat.slug} className="group h-full flex items-center relative">
                <Link
                  href={`/products?category=${cat.slug}`}
                  className={`relative h-full flex items-center px-4 font-bold text-[15px] tracking-wide transition-colors ${pathname.includes(cat.slug) ? 'text-green-600' : 'text-gray-700 hover:text-green-600'}`}
                >
                  {cat.name.toUpperCase()}
                  <span className={`absolute bottom-0 left-0 w-full h-[3px] bg-green-600 transform transition-transform duration-200 ${pathname.includes(cat.slug) ? 'scale-x-100' : 'scale-x-0 group-hover:scale-x-100'}`}></span>
                </Link>

                {/* Dropdown Menu (Text Only) */}
                {cat.subcategories.length > 0 && (
                  <div className="absolute top-full left-0 min-w-[220px] bg-white shadow-xl rounded-xl border border-gray-100 opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 z-50 py-2 translate-y-2 group-hover:translate-y-0">
                    <div className="flex flex-col">
                      {cat.subcategories.map(sub => (
                        <Link
                          key={sub.name}
                          href={`/products?category=${cat.slug}&subcategory=${sub.name}`}
                          className="px-5 py-2.5 text-sm font-medium text-gray-600 hover:text-green-600 hover:bg-green-50/50 transition-colors text-left whitespace-nowrap flex items-center gap-3"
                        >
                          {sub.image_url && (
                            <img src={sub.image_url} alt="" className="w-5 h-5 object-contain opacity-70" />
                          )}
                          {tsub.has(sub.name) ? tsub(sub.name) : sub.name}
                        </Link>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            ))}
            <div className="flex-grow"></div>

            {/* Support Dropdown */}
            <div className="relative group">
              <button className="text-sm font-medium text-gray-700 hover:text-green-600 transition flex items-center gap-1">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M18.364 5.636l-3.536 3.536m0 5.656l3.536 3.536M9.172 9.172L5.636 5.636m3.536 9.192l-3.536 3.536M21 12a9 9 0 11-18 0 9 9 0 0118 0zm-5 0a4 4 0 11-8 0 4 4 0 018 0z" />
                </svg>
                {t('support')}
                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
                </svg>
              </button>

              {/* Dropdown Menu */}
              <div className="absolute right-0 mt-2 w-56 bg-white rounded-lg shadow-lg border border-gray-200 opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 z-50">
                <div className="py-2">
                  <Link
                    href="/support/product"
                    className="block px-4 py-2 text-sm text-gray-700 hover:bg-green-50 hover:text-green-600 transition"
                  >
                    <div className="font-medium">Tigo Product Support</div>
                    <div className="text-xs text-gray-500">Technical help with Tigo products</div>
                  </Link>
                  <div className="border-t border-gray-100 my-1"></div>
                  <Link
                    href="/support/shop"
                    className="block px-4 py-2 text-sm text-gray-700 hover:bg-green-50 hover:text-green-600 transition"
                  >
                    <div className="font-medium">Online Shop Support</div>
                    <div className="text-xs text-gray-500">Help with orders and shipping</div>
                  </Link>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Mobile Search (Below header on mobile) */}
        <div className="lg:hidden bg-green-700/5 p-4 border-b border-gray-200">
          <form action="/products" method="get" className="relative w-full">
            <input
              type="text"
              name="search"
              placeholder={t('searchProducts')}
              className="w-full h-12 pl-4 pr-12 rounded-xl border border-gray-200 bg-white text-gray-900 focus:ring-2 focus:ring-green-500 shadow-sm"
            />
            <button type="submit" className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 p-1">
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
            </button>
          </form>
        </div>

      </header >

      {/* Mobile Menu Overlay */}
      {
        mobileMenuOpen && (
          <div className="fixed inset-0 z-[60] lg:hidden">
            {/* Backdrop */}
            <div className="fixed inset-0 bg-black/50 backdrop-blur-sm" onClick={() => setMobileMenuOpen(false)} />

            {/* Drawer */}
            <div className="fixed inset-y-0 left-0 w-[300px] bg-white shadow-2xl flex flex-col transform transition-transform duration-300">
              <div className="p-5 bg-green-600 text-white flex justify-between items-center shadow-md border-b border-green-700">
                <div className="flex flex-col">
                  <span className="font-bold text-xl">{t('menu')}</span>
                  <span className="bg-orange-500 text-white text-[10px] font-black px-2 py-0.5 rounded mt-1 w-fit uppercase">BETA eStore</span>
                </div>
                <button onClick={() => setMobileMenuOpen(false)} className="p-1 hover:bg-green-700 rounded-full transition">
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" /></svg>
                </button>
              </div>
              <div className="flex-1 overflow-y-auto py-4">
                <Link href="/products" className="block px-6 py-4 text-gray-900 font-bold text-lg border-b border-gray-100 hover:bg-gray-50 bg-gray-50/50" onClick={() => setMobileMenuOpen(false)}>
                  {t('shopAllProducts')}
                </Link>
                {categories.map((cat) => (
                  <div key={cat.slug} className="border-b border-gray-50">
                    <Link
                      href={`/products?category=${cat.slug}`}
                      className="block px-6 py-4 text-gray-800 hover:bg-gray-50 font-semibold"
                      onClick={() => setMobileMenuOpen(false)}
                    >
                      {cat.name}
                    </Link>
                    {/* Subcategories mobile */}
                    {cat.subcategories.length > 0 && (
                      <div className="bg-gray-50/50 px-6 py-2 space-y-1">
                        {cat.subcategories.map(sub => (
                          <Link
                            key={sub.name}
                            href={`/products?category=${cat.slug}&subcategory=${sub.name}`}
                            className="flex items-center gap-3 text-sm text-gray-600 hover:text-green-600 py-2 pl-4 border-l-2 border-gray-200 hover:border-green-500 transition-colors"
                            onClick={() => setMobileMenuOpen(false)}
                          >
                            {sub.image_url && <img src={sub.image_url} alt="" className="w-4 h-4 object-contain opacity-70" />}
                            {tsub.has(sub.name) ? tsub(sub.name) : sub.name}
                          </Link>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
                <div className="border-t border-gray-100 mt-4 pt-6 px-6 space-y-6">
                  <Link href={user ? "/dashboard" : "/auth/login"} className="flex items-center gap-4 text-gray-700 font-medium hover:text-green-600 transition" onClick={() => setMobileMenuOpen(false)}>
                    {user && !isAdmin ? (
                      <div className="w-10 h-10 rounded-full overflow-hidden border-2 border-gray-200 shadow-sm">
                        <img src="/b2c-avatar.png" alt="Profile" className="w-full h-full object-cover" />
                      </div>
                    ) : (
                      <div className="w-10 h-10 bg-gray-100 rounded-full flex items-center justify-center text-green-600">
                        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" /></svg>
                      </div>
                    )}
                    {user ? t('myAccount') : t('signInRegister')}
                  </Link>
                  <Link href="/dashboard#orders" className="flex items-center gap-4 text-gray-700 font-medium hover:text-green-600 transition" onClick={() => setMobileMenuOpen(false)}>
                    <div className="w-10 h-10 bg-gray-100 rounded-full flex items-center justify-center text-green-600">
                      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" /></svg>
                    </div>
                    {t('myOrders')}
                  </Link>
                </div>
              </div>
            </div>
          </div>
        )
      }
    </>
  )
}
