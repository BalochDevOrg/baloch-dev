import { useCallback, useEffect, useRef, useState } from 'react'
import { Link, NavLink, useLocation } from 'react-router-dom'
import { AnimatePresence, motion } from 'framer-motion'
import {
  ArrowRight, ChevronDown, Heart, LayoutDashboard, Loader2, LogOut, Menu, MessageCircle,
  Package, Search, Settings, ShieldCheck, ShoppingBag, Sparkles, Store, User, UserPlus, X,
} from 'lucide-react'
import { cn } from '@/lib/util'
import { useAuth, useDb } from '@/lib/providers'
import { auth, cart, categories, messaging, notifications } from '@/lib/db'
import type { Category } from '@/lib/types'
import { Avatar, Button, CategoryIcon, Logo } from '@/components/ui'
import { ThemeSwitcher } from '@/components/layout/ThemeSwitcher'
import { AnchoredOverlay } from '@/components/shared/AnchoredOverlay'

const SLUG_TO_ICON: Record<string, string> = {
  artists: 'Palette',
  photographers: 'Camera',
  writers: 'Feather',
  'balochi-doch': 'Doch',
  painters: 'Brush',
  'sketch-artists': 'PencilRuler',
  designers: 'PenTool',
  handicrafts: 'Shapes',
  'decorative-items': 'Lamp',
  calligraphy: 'Scroll',
  'balochi-herbs': 'Leaf',
  'balochi-recipes': 'ChefHat',
  'traditional-food': 'UtensilsCrossed',
  books: 'BookOpen',
  'traditional-clothing': 'Shirt',
  jewelry: 'Gem',
  'handmade-products': 'Hand',
  'cultural-products': 'Landmark',
}

export default function Navbar() {
  const [scrolled, setScrolled] = useState(false)
  const [open, setOpen] = useState(false)
  const [menu, setMenu] = useState(false)
  const [sellersOpen, setSellersOpen] = useState(false)
  const [mobileSellersOpen, setMobileSellersOpen] = useState(false)
  const [catList, setCatList] = useState<Category[]>(() => categories.list())
  const [catLoading, setCatLoading] = useState(false)
  const [catError, setCatError] = useState<string | null>(null)

  const { user } = useAuth()
  const dbVer = useDb() // live cart / message badges / categories
  const location = useLocation()
  const menuBtnRef = useRef<HTMLButtonElement>(null)
  const sellersBtnRef = useRef<HTMLButtonElement>(null)

  const loadCategories = useCallback(async () => {
    const cached = categories.list()
    if (cached.length > 0) {
      setCatList(cached)
      return
    }
    setCatLoading(true)
    setCatError(null)
    try {
      const data = await categories.fetch()
      setCatList(data)
    } catch (e: any) {
      setCatError(e?.message || 'Failed to load categories')
    } finally {
      setCatLoading(false)
    }
  }, [])

  useEffect(() => {
    loadCategories()
  }, [loadCategories])

  useEffect(() => {
    const latest = categories.list()
    if (latest.length > 0) {
      setCatList(latest)
    }
  }, [dbVer])

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 10)
    onScroll()
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  useEffect(() => {
    setOpen(false)
    setMenu(false)
    setSellersOpen(false)
  }, [location.pathname])

  useEffect(() => {
    if (!open) return
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => { document.body.style.overflow = prev }
  }, [open])

  const unreadNotifs = user ? notifications.unreadCount(user.id) : 0
  const unreadMsgs = user
    ? messaging.conversationsFor(user.id).reduce((sum, c) => sum + (user.id === c.buyer_id ? c.buyer_unread : c.seller_unread), 0)
    : 0
  const cartCount = user ? cart.count(user.id) : 0

  const dashboardTo = user?.role === 'admin' ? '/admin' : user?.role === 'seller' ? '/seller' : '/dashboard'
  const isSellersActive = location.pathname === '/sellers' || location.pathname.startsWith('/store/') || location.pathname.startsWith('/seller/')

  const onLinkClick = (e: React.MouseEvent<HTMLAnchorElement>, to: string) => {
    if (location.pathname === '/') {
      if (to === '/') {
        e.preventDefault()
        window.scrollTo({ top: 0, behavior: 'smooth' })
        return
      }
      const anchorId = to.replace('/', '')
      const target = document.getElementById(anchorId)
      if (target) {
        e.preventDefault()
        target.scrollIntoView({ behavior: 'smooth' })
        window.history.pushState(null, '', `#${anchorId}`)
        return
      }
    }
  }

  return (
    <header
      className={cn(
        'fixed inset-x-0 top-0 z-[100] transition-all duration-300',
        'border-b border-line bg-surface/95 backdrop-blur-md',
        scrolled ? 'shadow-sm' : 'shadow-2xs',
      )}
    >
      <nav className="mx-auto flex h-[64px] sm:h-[70px] w-full max-w-7xl items-center justify-between px-2.5 sm:px-6 lg:px-8" aria-label="Main navigation">
        {/* Logo — shrink-0 to prevent any squishing or overlap */}
        <div className="flex shrink-0 items-center">
          <Logo />
        </div>

        {/* Desktop Navbar Links in requested order: 1. Home, 2. About, 3. Contact, 4. Become a Seller, 5. Sellers (dropdown) */}
        <ul className="hidden lg:flex shrink-0 items-center gap-1.5 xl:gap-2.5 2xl:gap-3.5">
          {/* 1. Home */}
          <li>
            <NavLink
              to="/"
              end
              onClick={(e) => onLinkClick(e, '/')}
              className={({ isActive }) =>
                cn(
                  'relative inline-flex items-center justify-center whitespace-nowrap rounded-full px-3 xl:px-3.5 py-1.5 text-[0.84rem] xl:text-[0.88rem] font-semibold transition-colors',
                  isActive ? 'text-terracotta font-bold' : 'text-muted hover:text-fg hover:bg-surface-2/60',
                )
              }
            >
              {({ isActive }) => (
                <>
                  <span>Home</span>
                  {isActive && (
                    <motion.span
                      layoutId="nav-dot"
                      className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-5 sm:w-6 h-[2.5px] rounded-full bg-terracotta"
                    />
                  )}
                </>
              )}
            </NavLink>
          </li>

          {/* 2. About */}
          <li>
            <NavLink
              to="/about"
              onClick={(e) => onLinkClick(e, '/about')}
              className={({ isActive }) =>
                cn(
                  'relative inline-flex items-center justify-center whitespace-nowrap rounded-full px-3 xl:px-3.5 py-1.5 text-[0.84rem] xl:text-[0.88rem] font-semibold transition-colors',
                  isActive ? 'text-terracotta font-bold' : 'text-muted hover:text-fg hover:bg-surface-2/60',
                )
              }
            >
              {({ isActive }) => (
                <>
                  <span>About</span>
                  {isActive && (
                    <motion.span
                      layoutId="nav-dot"
                      className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-5 sm:w-6 h-[2.5px] rounded-full bg-terracotta"
                    />
                  )}
                </>
              )}
            </NavLink>
          </li>

          {/* 3. Contact */}
          <li>
            <NavLink
              to="/contact"
              onClick={(e) => onLinkClick(e, '/contact')}
              className={({ isActive }) =>
                cn(
                  'relative inline-flex items-center justify-center whitespace-nowrap rounded-full px-3 xl:px-3.5 py-1.5 text-[0.84rem] xl:text-[0.88rem] font-semibold transition-colors',
                  isActive ? 'text-terracotta font-bold' : 'text-muted hover:text-fg hover:bg-surface-2/60',
                )
              }
            >
              {({ isActive }) => (
                <>
                  <span>Contact</span>
                  {isActive && (
                    <motion.span
                      layoutId="nav-dot"
                      className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-5 sm:w-6 h-[2.5px] rounded-full bg-terracotta"
                    />
                  )}
                </>
              )}
            </NavLink>
          </li>

          {/* 4. Become a Seller */}
          <li>
            <NavLink
              to="/become-seller"
              onClick={(e) => onLinkClick(e, '/become-seller')}
              className={({ isActive }) =>
                cn(
                  'relative inline-flex items-center justify-center whitespace-nowrap rounded-full px-3 xl:px-3.5 py-1.5 text-[0.84rem] xl:text-[0.88rem] font-semibold transition-colors',
                  isActive ? 'text-terracotta font-bold' : 'text-muted hover:text-fg hover:bg-surface-2/60',
                )
              }
            >
              {({ isActive }) => (
                <>
                  <span>Become a Seller</span>
                  {isActive && (
                    <motion.span
                      layoutId="nav-dot"
                      className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-5 sm:w-6 h-[2.5px] rounded-full bg-terracotta"
                    />
                  )}
                </>
              )}
            </NavLink>
          </li>

          {/* 5. Sellers (Functional Dropdown) */}
          <li className="relative">
            <button
              ref={sellersBtnRef}
              type="button"
              onClick={() => {
                if (!sellersOpen && catList.length === 0) loadCategories()
                setSellersOpen((o) => !o)
              }}
              onKeyDown={(e) => {
                if (e.key === 'ArrowDown' || e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault()
                  if (catList.length === 0) loadCategories()
                  setSellersOpen(true)
                }
              }}
              className={cn(
                'relative inline-flex items-center justify-center gap-1 whitespace-nowrap rounded-full px-3 xl:px-3.5 py-1.5 text-[0.84rem] xl:text-[0.88rem] font-semibold transition-colors',
                isSellersActive || sellersOpen ? 'text-terracotta font-bold' : 'text-muted hover:text-fg hover:bg-surface-2/60',
              )}
              aria-expanded={sellersOpen}
              aria-haspopup="menu"
              aria-label="Sellers and categories menu"
            >
              <span>Sellers</span>
              <ChevronDown
                size={13}
                className={cn('text-muted transition-transform duration-200', sellersOpen && 'rotate-180 text-terracotta')}
              />
              {isSellersActive && (
                <motion.span
                  layoutId="nav-dot"
                  className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-5 sm:w-6 h-[2.5px] rounded-full bg-terracotta"
                />
              )}
            </button>

            {/* Sellers Dropdown Panel */}
            <AnchoredOverlay
              open={sellersOpen}
              onClose={() => setSellersOpen(false)}
              anchorRef={sellersBtnRef}
              align="end"
              width={420}
              role="menu"
              ariaLabel="Sellers categories"
              className="p-3"
            >
              {/* Quick Actions: All Stores & All Categories */}
              <div className="grid grid-cols-2 gap-2 border-b border-line/70 pb-3">
                <Link
                  to="/sellers"
                  onClick={() => setSellersOpen(false)}
                  className="group flex flex-col gap-1 rounded-xl border border-line bg-surface p-2.5 transition hover:border-brand hover:bg-surface-2 dark:hover:border-gold shadow-2xs"
                >
                  <div className="flex items-center justify-between">
                    <span className="grid h-7 w-7 place-items-center rounded-lg bg-brand/10 text-brand dark:text-gold">
                      <Store size={15} />
                    </span>
                    <ArrowRight size={13} className="text-muted opacity-0 transition group-hover:opacity-100 group-hover:translate-x-0.5" />
                  </div>
                  <span className="text-xs font-bold text-fg group-hover:text-brand dark:group-hover:text-gold transition-colors">
                    All Stores
                  </span>
                  <span className="text-[0.68rem] text-faint line-clamp-1">
                    Browse all verified stores
                  </span>
                </Link>

                <Link
                  to="/sellers?category=all"
                  onClick={() => setSellersOpen(false)}
                  className="group flex flex-col gap-1 rounded-xl border border-line bg-surface p-2.5 transition hover:border-gold hover:bg-surface-2 shadow-2xs"
                >
                  <div className="flex items-center justify-between">
                    <span className="grid h-7 w-7 place-items-center rounded-lg bg-gold/15 text-gold">
                      <Sparkles size={15} />
                    </span>
                    <ArrowRight size={13} className="text-muted opacity-0 transition group-hover:opacity-100 group-hover:translate-x-0.5" />
                  </div>
                  <span className="text-xs font-bold text-fg group-hover:text-gold transition-colors">
                    All Categories
                  </span>
                  <span className="text-[0.68rem] text-faint line-clamp-1">
                    Complete store catalogue
                  </span>
                </Link>
              </div>

              {/* Dynamic Categories list */}
              <div className="pt-2.5">
                <div className="mb-2 flex items-center justify-between px-1">
                  <span className="text-[0.68rem] font-bold uppercase tracking-wider text-faint">
                    Product Categories
                  </span>
                  {catList.length > 0 && !catLoading && (
                    <span className="text-[0.68rem] text-faint tnum">
                      {catList.length} categories
                    </span>
                  )}
                </div>

                {catLoading && (
                  <div className="space-y-2 p-2">
                    <div className="flex items-center gap-2 text-xs text-muted">
                      <Loader2 size={14} className="animate-spin text-terracotta" />
                      <span>Loading categories...</span>
                    </div>
                    <div className="grid grid-cols-2 gap-1.5 pt-1">
                      {[...Array(6)].map((_, i) => (
                        <div key={i} className="flex items-center gap-2 rounded-xl p-2 bg-surface-2/60 animate-pulse">
                          <div className="h-6 w-6 rounded-lg bg-line/60" />
                          <div className="h-3 w-16 rounded bg-line/60" />
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {catError && (
                  <div className="rounded-xl border border-rose-500/20 bg-rose-500/10 p-3 text-center">
                    <p className="text-xs text-rose-500 mb-1.5">{catError}</p>
                    <button
                      type="button"
                      onClick={loadCategories}
                      className="text-xs font-semibold text-terracotta hover:underline"
                    >
                      Try again
                    </button>
                  </div>
                )}

                {!catLoading && !catError && catList.length === 0 && (
                  <div className="p-4 text-center text-xs text-muted">
                    No categories found.
                  </div>
                )}

                {!catLoading && !catError && catList.length > 0 && (
                  <div className="grid grid-cols-2 gap-1 max-h-[290px] overflow-y-auto pr-1">
                    {catList.map((c) => (
                      <Link
                        key={c.id || c.slug}
                        to={`/sellers?category=${encodeURIComponent(c.slug)}`}
                        onClick={() => setSellersOpen(false)}
                        className="group flex items-center gap-2 rounded-xl p-2 text-xs font-medium text-fg hover:bg-surface-2 transition"
                      >
                        <span className="grid h-7 w-7 shrink-0 place-items-center rounded-lg bg-surface-2 text-brand group-hover:text-terracotta dark:text-gold transition-colors">
                          <CategoryIcon name={c.icon || SLUG_TO_ICON[c.slug] || 'Shapes'} size={14} />
                        </span>
                        <span className="truncate group-hover:text-terracotta transition-colors">
                          {c.name}
                        </span>
                      </Link>
                    ))}
                  </div>
                )}
              </div>
            </AnchoredOverlay>
          </li>
        </ul>

        {/* Right side actions with compact spacing on mobile and generous spacing on desktop */}
        <div className="flex shrink-0 items-center gap-1 xs:gap-1.5 sm:gap-2.5 md:gap-3.5 lg:gap-4 xl:gap-5">
          {/* Search button */}
          <Link
            to="/search"
            className="grid h-8 w-8 sm:h-9 sm:w-9 shrink-0 place-items-center rounded-full border border-line bg-surface text-fg transition hover:bg-surface-2 hover:border-brand shadow-2xs"
            aria-label="Search marketplace"
          >
            <Search size={14} />
          </Link>

          {/* Theme Switcher Dropdown (desktop/tablet; on mobile phones accessible in hamburger drawer) */}
          <div className="hidden sm:flex shrink-0 items-center">
            <ThemeSwitcher responsive />
          </div>

          {user && (
            <>
              {/* Messages button (tablet/desktop) */}
              <Link
                to={dashboardTo + '/messages'}
                className="relative hidden h-8.5 w-8.5 sm:h-9 sm:w-9 place-items-center rounded-full text-muted transition hover:bg-surface-2 hover:text-fg md:grid shrink-0"
                aria-label="Messages"
              >
                <MessageCircle size={17} />
                {unreadMsgs > 0 && <span className="absolute right-0.5 top-0.5 h-2 w-2 rounded-full bg-crimson" />}
              </Link>

              {/* Shopping cart button */}
              <Link
                to="/cart"
                className="relative grid h-8 w-8 sm:h-9 sm:w-9 shrink-0 place-items-center rounded-full text-muted transition hover:bg-surface-2 hover:text-fg"
                aria-label="Shopping cart"
              >
                <ShoppingBag size={16} />
                {cartCount > 0 && (
                  <span className="absolute -right-0.5 -top-0.5 grid h-4 min-w-4 place-items-center rounded-full bg-gold px-1 text-[0.62rem] font-bold text-[#241a04] tnum">
                    {cartCount}
                  </span>
                )}
              </Link>
            </>
          )}

          {/* User profile / Login & Register */}
          {user ? (
            <>
              <button
                ref={menuBtnRef}
                type="button"
                onClick={() => setMenu((m) => !m)}
                className="flex items-center gap-1.5 rounded-full border border-line bg-surface/85 p-0.5 sm:p-1 sm:pr-3 transition hover:bg-surface hover:border-brand shadow-2xs shrink-0"
                aria-label="Account menu" aria-expanded={menu} aria-haspopup="menu"
              >
                <Avatar name={user.full_name} color={user.avatar_color} src={user.avatar_url} size={28} />
                <span className="hidden sm:inline-block max-w-[100px] truncate text-xs font-bold text-fg">
                  {user.full_name.split(' ')[0]}
                </span>
                <ChevronDown size={12} className={cn('hidden sm:inline-block text-muted transition-transform duration-200', menu && 'rotate-180')} />
              </button>
              <AnchoredOverlay
                open={menu}
                onClose={() => setMenu(false)}
                anchorRef={menuBtnRef}
                role="menu"
                ariaLabel="Account menu"
                width={240}
                className="p-2"
              >
                <div className="border-b border-line px-3 py-2.5">
                  <p className="truncate text-sm font-semibold">{user.full_name}</p>
                  <p className="truncate text-xs text-faint">@{user.username} · {user.role}</p>
                </div>
                <MenuLink to={dashboardTo} icon={<LayoutDashboard size={15} />} label="Dashboard" badge={unreadNotifs ? String(unreadNotifs) : undefined} />
                {user.role === 'seller' && <MenuLink to="/dashboard" icon={<ShoppingBag size={15} />} label="Buyer Dashboard" />}
                {user.role !== 'buyer' && <MenuLink to="/seller" icon={<Store size={15} />} label="Seller Studio" />}
                {user.role === 'admin' && <MenuLink to="/admin" icon={<ShieldCheck size={15} />} label="Admin Panel" />}
                {user.role === 'admin' && <MenuLink to="/dashboard" icon={<ShoppingBag size={15} />} label="Buyer Dashboard" />}
                <MenuLink to="/dashboard/wishlist" icon={<Heart size={15} />} label="Wishlist" />
                <MenuLink to="/dashboard/orders" icon={<Package size={15} />} label="My Orders" />
                <MenuLink to="/dashboard/settings" icon={<Settings size={15} />} label="Settings" />
                <button
                  type="button"
                  onClick={() => { auth.signOut(); window.location.assign('/') }}
                  className="mt-1 flex w-full items-center gap-2.5 rounded-xl px-3 py-2 text-sm text-rose-500 transition hover:bg-rose-500/10"
                >
                  <LogOut size={15} /> Sign out
                </button>
              </AnchoredOverlay>
            </>
          ) : (
            <div className="hidden items-center gap-2 sm:gap-2.5 sm:flex shrink-0">
              <Button
                to="/login"
                variant="ghost"
                size="sm"
                className="!rounded-full border border-line bg-surface px-3.5 sm:px-4 py-2 text-xs font-bold text-fg hover:border-brand hover:bg-surface-2 shadow-2xs whitespace-nowrap shrink-0"
              >
                <User size={14} /> Login
              </Button>
              <Button
                to="/register"
                size="sm"
                className="!rounded-full !bg-brand hover:opacity-95 px-4 sm:px-5 py-2 text-xs font-bold text-onbrand shadow-2xs whitespace-nowrap shrink-0"
              >
                <UserPlus size={14} /> Register
              </Button>
            </div>
          )}

          {/* Mobile hamburger menu button */}
          <button
            className="grid h-8 w-8 sm:h-9 sm:w-9 shrink-0 place-items-center rounded-full text-muted transition hover:bg-surface-2 hover:text-fg lg:hidden"
            onClick={() => setOpen((o) => !o)}
            aria-label={open ? 'Close menu' : 'Open menu'} aria-expanded={open}
          >
            {open ? <X size={18} /> : <Menu size={18} />}
          </button>
        </div>
      </nav>

      {/* Mobile menu */}
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.32, ease: [0.22, 1, 0.36, 1] }}
            className="glass max-h-[min(80vh,calc(100dvh-4rem))] overflow-y-auto overflow-x-hidden border-t border-line/60 lg:hidden"
          >
            <ul className="mx-auto max-w-7xl px-4 py-4 sm:px-6">
              {/* 1. Home */}
              <motion.li initial={{ opacity: 0, x: -14 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0 }}>
                <NavLink
                  to="/" end
                  onClick={(e) => { setOpen(false); onLinkClick(e, '/') }}
                  className={({ isActive }) => cn(
                    'flex items-center justify-between rounded-xl px-4 py-3 text-[0.95rem] font-medium',
                    isActive ? 'bg-gold/10 text-gold' : 'text-fg hover:bg-surface-2',
                  )}
                >
                  Home
                </NavLink>
              </motion.li>

              {/* 2. About */}
              <motion.li initial={{ opacity: 0, x: -14 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.03 }}>
                <NavLink
                  to="/about"
                  onClick={(e) => { setOpen(false); onLinkClick(e, '/about') }}
                  className={({ isActive }) => cn(
                    'flex items-center justify-between rounded-xl px-4 py-3 text-[0.95rem] font-medium',
                    isActive ? 'bg-gold/10 text-gold' : 'text-fg hover:bg-surface-2',
                  )}
                >
                  About
                </NavLink>
              </motion.li>

              {/* 3. Contact */}
              <motion.li initial={{ opacity: 0, x: -14 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.06 }}>
                <NavLink
                  to="/contact"
                  onClick={(e) => { setOpen(false); onLinkClick(e, '/contact') }}
                  className={({ isActive }) => cn(
                    'flex items-center justify-between rounded-xl px-4 py-3 text-[0.95rem] font-medium',
                    isActive ? 'bg-gold/10 text-gold' : 'text-fg hover:bg-surface-2',
                  )}
                >
                  Contact
                </NavLink>
              </motion.li>

              {/* 4. Become a Seller */}
              <motion.li initial={{ opacity: 0, x: -14 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.09 }}>
                <NavLink
                  to="/become-seller"
                  onClick={(e) => { setOpen(false); onLinkClick(e, '/become-seller') }}
                  className={({ isActive }) => cn(
                    'flex items-center justify-between rounded-xl px-4 py-3 text-[0.95rem] font-medium',
                    isActive ? 'bg-gold/10 text-gold' : 'text-fg hover:bg-surface-2',
                  )}
                >
                  Become a Seller
                  <span className="rounded-full bg-gold/15 px-2 py-0.5 text-[0.62rem] font-bold uppercase tracking-wider text-gold">Free</span>
                </NavLink>
              </motion.li>

              {/* 5. Sellers Accordion */}
              <motion.li initial={{ opacity: 0, x: -14 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.12 }}>
                <div>
                  <button
                    type="button"
                    onClick={() => {
                      if (!mobileSellersOpen && catList.length === 0) loadCategories()
                      setMobileSellersOpen((o) => !o)
                    }}
                    className={cn(
                      'flex w-full items-center justify-between rounded-xl px-4 py-3 text-[0.95rem] font-medium transition',
                      isSellersActive ? 'bg-gold/10 text-gold' : 'text-fg hover:bg-surface-2',
                    )}
                  >
                    <span>Sellers</span>
                    <ChevronDown size={16} className={cn('text-muted transition-transform duration-200', mobileSellersOpen && 'rotate-180 text-gold')} />
                  </button>

                  <AnimatePresence>
                    {mobileSellersOpen && (
                      <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.2 }}
                        className="overflow-hidden pl-3 pr-1 pt-1 pb-2 space-y-1"
                      >
                        <div className="grid grid-cols-2 gap-1.5 pb-2">
                          <Link
                            to="/sellers"
                            onClick={() => { setOpen(false); setMobileSellersOpen(false) }}
                            className="flex items-center gap-2 rounded-lg border border-line bg-surface p-2 text-xs font-semibold text-fg hover:bg-surface-2 shadow-2xs"
                          >
                            <Store size={14} className="text-brand dark:text-gold" />
                            <span>All Stores</span>
                          </Link>
                          <Link
                            to="/sellers?category=all"
                            onClick={() => { setOpen(false); setMobileSellersOpen(false) }}
                            className="flex items-center gap-2 rounded-lg border border-line bg-surface p-2 text-xs font-semibold text-fg hover:bg-surface-2 shadow-2xs"
                          >
                            <Sparkles size={14} className="text-gold" />
                            <span>All Categories</span>
                          </Link>
                        </div>

                        {catLoading && (
                          <div className="p-2 text-xs text-muted flex items-center gap-2">
                            <Loader2 size={13} className="animate-spin text-terracotta" />
                            <span>Loading categories...</span>
                          </div>
                        )}

                        {catList.length > 0 && (
                          <div className="grid grid-cols-2 gap-1 max-h-[220px] overflow-y-auto pr-1">
                            {catList.map((c) => (
                              <Link
                                key={c.id || c.slug}
                                to={`/sellers?category=${encodeURIComponent(c.slug)}`}
                                onClick={() => { setOpen(false); setMobileSellersOpen(false) }}
                                className="flex items-center gap-2 rounded-lg px-2.5 py-1.5 text-xs text-muted hover:text-fg hover:bg-surface-2 transition"
                              >
                                <span className="grid h-5 w-5 place-items-center rounded bg-surface-2 text-brand dark:text-gold">
                                  <CategoryIcon name={c.icon || SLUG_TO_ICON[c.slug] || 'Shapes'} size={12} />
                                </span>
                                <span className="truncate">{c.name}</span>
                              </Link>
                            ))}
                          </div>
                        )}
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              </motion.li>

              {/* Marketplace */}
              <motion.li initial={{ opacity: 0, x: -14 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.15 }}>
                <NavLink
                  to="/products"
                  onClick={() => setOpen(false)}
                  className={({ isActive }) => cn(
                    'flex items-center rounded-xl px-4 py-3 text-[0.95rem] font-medium',
                    isActive ? 'bg-gold/10 text-gold' : 'text-fg hover:bg-surface-2',
                  )}
                >
                  Marketplace
                </NavLink>
              </motion.li>

              {user && (
                <li className="mt-2 space-y-0.5 border-t border-line/60 pt-2">
                  <NavLink to={dashboardTo} className="flex items-center gap-2.5 rounded-xl px-4 py-3 text-[0.95rem] font-medium text-fg hover:bg-surface-2">
                    <LayoutDashboard size={16} className="text-muted" /> Dashboard
                  </NavLink>
                  <NavLink to={`${dashboardTo}/messages`} className="flex items-center gap-2.5 rounded-xl px-4 py-3 text-[0.95rem] font-medium text-fg hover:bg-surface-2">
                    <MessageCircle size={16} className="text-muted" /> Messages
                    {unreadMsgs > 0 && <span className="ml-auto grid h-5 min-w-5 place-items-center rounded-full bg-crimson px-1.5 text-[0.65rem] font-bold text-white">{unreadMsgs}</span>}
                  </NavLink>
                  <NavLink to="/dashboard/orders" className="flex items-center gap-2.5 rounded-xl px-4 py-3 text-[0.95rem] font-medium text-fg hover:bg-surface-2">
                    <Package size={16} className="text-muted" /> My Orders
                  </NavLink>
                  <NavLink to="/dashboard/settings" className="flex items-center gap-2.5 rounded-xl px-4 py-3 text-[0.95rem] font-medium text-fg hover:bg-surface-2">
                    <Settings size={16} className="text-muted" /> Profile & settings
                  </NavLink>
                  <div className="flex items-center justify-between rounded-xl px-4 py-2 sm:hidden border-t border-line/40 mt-1">
                    <span className="text-[0.95rem] font-medium">Theme Palette</span>
                    <ThemeSwitcher />
                  </div>
                  <button
                    onClick={() => { auth.signOut(); window.location.assign('/') }}
                    className="flex w-full items-center gap-2.5 rounded-xl px-4 py-3 text-[0.95rem] font-medium text-rose-500 hover:bg-rose-500/10"
                  >
                    <LogOut size={16} /> Sign out
                  </button>
                </li>
              )}
              {!user && (
                <>
                  <li className="mt-2 border-t border-line/40 pt-2 sm:hidden">
                    <div className="flex items-center justify-between rounded-xl px-4 py-2">
                      <span className="text-[0.95rem] font-medium">Theme Palette</span>
                      <ThemeSwitcher />
                    </div>
                  </li>
                  <li className="mt-3 grid grid-cols-2 gap-2">
                    <Button to="/login" variant="ghost">Login</Button>
                    <Button to="/register" variant="gold">Register</Button>
                  </li>
                </>
              )}
            </ul>
          </motion.div>
        )}
      </AnimatePresence>
    </header>
  )
}

function MenuLink({ to, icon, label, badge }: { to: string; icon: React.ReactNode; label: string; badge?: string }) {
  return (
    <NavLink to={to} role="menuitem" className="flex items-center gap-2.5 rounded-xl px-3 py-2 text-sm text-fg transition hover:bg-surface-2">
      <span className="text-muted">{icon}</span> {label}
      {badge && <span className="ml-auto grid h-4 min-w-4 place-items-center rounded-full bg-crimson px-1 text-[0.6rem] font-bold text-white">{badge}</span>}
    </NavLink>
  )
}
