import { useEffect, useRef, useState } from 'react'
import { Link, NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom'
import { AnimatePresence, motion } from 'framer-motion'
import {
  ArrowLeft, ChevronDown, ChevronRight, LogOut, Menu, Search, X,
  ShoppingBag, Store, ShieldCheck, Heart, Package, Settings,
} from 'lucide-react'
import { cn, initials } from '@/lib/util'
import { auth } from '@/lib/db'
import { useAuth } from '@/lib/providers'
import { Logo } from '@/components/ui'
import { NotificationsBell } from '@/components/shared/NotificationsBell'
import { ThemeSwitcher } from '@/components/layout/ThemeSwitcher'
import { AnchoredOverlay } from '@/components/shared/AnchoredOverlay'

export interface DashNavItem {
  to: string
  label: string
  icon: React.ReactNode
  badge?: number
  end?: boolean
}

export function DashboardLayout({
  title,
  accent,
  items,
  homeTo,
  sidebarSlot,
}: {
  title: string
  accent: string
  items: DashNavItem[]
  homeTo: string
  sidebarSlot?: React.ReactNode
}) {
  const [open, setOpen] = useState(false)
  const [userMenuOpen, setUserMenuOpen] = useState(false)
  const userMenuBtnRef = useRef<HTMLButtonElement>(null)
  const { user } = useAuth()
  const location = useLocation()
  const navigate = useNavigate()

  useEffect(() => { setOpen(false); setUserMenuOpen(false) }, [location.pathname])
  useEffect(() => { window.scrollTo(0, 0) }, [location.pathname])
  useEffect(() => {
    if (!open) return
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => { document.body.style.overflow = prev }
  }, [open])

  if (!user) return null
  const current = items.find((i) => (i.end ? location.pathname === i.to : location.pathname.startsWith(i.to)))
  const isSeller = title.toLowerCase().includes('seller')
  const userInitials = initials(user.full_name)

  return (
    <div className="min-h-screen bg-bg text-fg">
      {/* Mobile drawer backdrop */}
      <AnimatePresence>
        {open && (
          <motion.button
            className="fixed inset-0 z-[90] bg-black/45 backdrop-blur-xs lg:hidden"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setOpen(false)}
            aria-label="Close menu"
          />
        )}
      </AnimatePresence>

      {/* ── Left Sidebar Matching Images 2, 3, 4 ── */}
      <aside
        className={cn(
          'fixed inset-y-0 left-0 z-[95] flex w-[268px] max-w-[86vw] flex-col overflow-y-auto border-r border-line bg-bg transition-transform duration-300 lg:w-[268px] lg:translate-x-0 shadow-xs',
          open ? 'translate-x-0' : '-translate-x-full',
        )}
      >
        {/* Top logo area */}
        <div className="flex h-16 shrink-0 items-center justify-between border-b border-line px-4 sm:px-5">
          <Logo />
          <button
            className="rounded-lg p-1.5 text-muted hover:bg-surface-2 lg:hidden"
            onClick={() => setOpen(false)}
            aria-label="Close sidebar"
          >
            <X size={18} />
          </button>
        </div>

        {/* User Identity Card at top of sidebar */}
        <div className="px-4 pt-4 pb-3">
          <Link
            to={homeTo}
            className="group flex items-center gap-3 rounded-2xl border border-line bg-surface/80 p-3 transition hover:border-brand/40 hover:bg-surface shadow-xs"
          >
            {/* Deep green avatar circle with white bold initials */}
            <div className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-brand text-onbrand font-bold text-xs tracking-wider">
              {userInitials}
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-bold text-fg">{user.full_name}</p>
              <p className="text-[0.66rem] font-semibold uppercase tracking-wider text-faint">
                {title}
              </p>
            </div>
            <ChevronRight size={14} className="text-muted transition group-hover:translate-x-0.5 group-hover:text-brand" />
          </Link>
        </div>

        {/* Optional Slot (e.g. Store Switcher in Seller Studio) */}
        {sidebarSlot}

        {/* Navigation list */}
        <nav className="flex-1 space-y-1 overflow-y-auto px-3 py-2" aria-label={`${title} navigation`}>
          {items.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              className={({ isActive }) =>
                cn(
                  'group flex items-center gap-3 rounded-xl px-3.5 py-2.5 text-[0.87rem] font-medium transition-all duration-200',
                  isActive
                    ? isSeller
                      ? 'bg-brand/12 text-brand font-semibold shadow-2xs'
                      : 'bg-brand text-onbrand font-semibold shadow-sm'
                    : 'text-muted hover:bg-surface-2 hover:text-fg',
                )
              }
            >
              {({ isActive }) => (
                <>
                  <span className={cn(
                    'shrink-0 transition-colors',
                    isActive ? (isSeller ? 'text-brand' : 'text-onbrand') : 'text-muted group-hover:text-fg'
                  )}>
                    {item.icon}
                  </span>
                  <span className="truncate flex-1">{item.label}</span>
                  {!!item.badge && item.badge > 0 && (
                    <span className="ml-auto grid h-5 min-w-5 place-items-center rounded-full bg-crimson px-1.5 text-[0.65rem] font-bold text-white tnum">
                      {item.badge}
                    </span>
                  )}
                  {isActive && !isSeller && (
                    <ChevronRight size={14} className="ml-1 text-onbrand/80 shrink-0" />
                  )}
                </>
              )}
            </NavLink>
          ))}
        </nav>

        {/* Bottom links */}
        <div className="relative shrink-0 border-t border-line p-4 bg-bg">

          <div className="relative z-10 space-y-1">
            <Link
              to="/"
              className="flex items-center gap-2.5 rounded-xl px-3 py-2 text-xs font-semibold text-muted transition hover:bg-surface-2 hover:text-fg"
            >
              <ArrowLeft size={15} /> Back to site
            </Link>
            <button
              onClick={() => { auth.signOut(); window.location.assign('/') }}
              className="flex w-full items-center gap-2.5 rounded-xl px-3 py-2 text-xs font-semibold text-rose-500 transition hover:bg-rose-500/10"
            >
              <LogOut size={15} /> Sign out
            </button>
          </div>
        </div>
      </aside>

      {/* ── Main Content Column ── */}
      <div className="lg:pl-[268px]">
        {/* Top Header */}
        <header className="sticky top-0 z-[80] flex h-16 items-center gap-2 border-b border-line bg-bg/95 px-4 backdrop-blur-md sm:gap-3 sm:px-8">

          {/* Left mobile menu toggle */}
          <button
            className="relative z-10 shrink-0 rounded-lg p-2 text-muted hover:bg-surface-2 lg:hidden"
            onClick={() => setOpen(true)}
            aria-label="Open menu"
          >
            <Menu size={19} />
          </button>

          {/* Optional page title for small screens */}
          <div className="relative z-10 min-w-0 flex-1">
            <h1 className="truncate font-display text-base font-bold text-fg sm:text-lg">
              {current?.label ?? title}
            </h1>
          </div>

          {/* Right Controls: Search, Theme Dropdown, Bell, User Profile Badge */}
          <div className="relative z-10 ml-auto flex shrink-0 items-center gap-1.5 sm:gap-2.5">
            {/* Search circular button */}
            <Link
              to="/search"
              className="grid h-9 w-9 place-items-center rounded-full border border-line bg-surface/85 text-fg transition hover:bg-surface hover:border-brand"
              aria-label="Search"
            >
              <Search size={15} />
            </Link>

            {/* Compact, clearly labeled Theme Dropdown */}
            <ThemeSwitcher />

            {/* Notification Bell */}
            <NotificationsBell />

            {/* User Avatar Badge with Name & Role pill */}
            <button
              ref={userMenuBtnRef}
              type="button"
              onClick={() => setUserMenuOpen((m) => !m)}
              className="flex items-center gap-2 rounded-full border border-line bg-surface/85 p-1 pr-3 transition hover:bg-surface hover:border-brand shadow-2xs"
              aria-label="User account menu"
              aria-expanded={userMenuOpen}
            >
              <div className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-brand text-onbrand font-bold text-[0.68rem] tracking-wider">
                {userInitials}
              </div>
              <div className="hidden sm:flex flex-col text-left leading-none">
                <span className="truncate text-xs font-bold text-fg max-w-[120px]">
                  {user.full_name}
                </span>
                <span className="text-[0.58rem] font-semibold uppercase tracking-wider text-faint">
                  {title}
                </span>
              </div>
              <ChevronDown size={13} className={cn('text-muted transition-transform', userMenuOpen && 'rotate-180')} />
            </button>

            {/* Account dropdown overlay */}
            <AnchoredOverlay
              open={userMenuOpen}
              onClose={() => setUserMenuOpen(false)}
              anchorRef={userMenuBtnRef}
              role="menu"
              ariaLabel="Account menu"
              width={240}
              className="p-2"
            >
              <div className="border-b border-line px-3 py-2.5">
                <p className="truncate text-sm font-bold text-fg">{user.full_name}</p>
                <p className="truncate text-xs text-muted">@{user.username} · {user.role}</p>
              </div>
              <MenuDropdownLink to="/dashboard" icon={<ShoppingBag size={15} />} label="Buyer Dashboard" />
              {user.role !== 'buyer' && <MenuDropdownLink to="/seller" icon={<Store size={15} />} label="Seller Studio" />}
              {user.role === 'admin' && <MenuDropdownLink to="/admin" icon={<ShieldCheck size={15} />} label="Admin Panel" />}
              <MenuDropdownLink to="/dashboard/orders" icon={<Package size={15} />} label="Orders" />
              <MenuDropdownLink to="/dashboard/wishlist" icon={<Heart size={15} />} label="Wishlist" />
              <MenuDropdownLink to="/dashboard/settings" icon={<Settings size={15} />} label="Settings" />
              <button
                type="button"
                onClick={() => { auth.signOut(); window.location.assign('/') }}
                className="mt-1 flex w-full items-center gap-2.5 rounded-xl px-3 py-2 text-sm text-rose-600 transition hover:bg-rose-50 font-medium"
              >
                <LogOut size={15} /> Sign out
              </button>
            </AnchoredOverlay>
          </div>
        </header>

        {/* Page Content */}
        <main className="px-4 py-6 sm:px-8 sm:py-8 lg:px-10">
          <Outlet />
        </main>
      </div>
    </div>
  )
}

function MenuDropdownLink({ to, icon, label }: { to: string; icon: React.ReactNode; label: string }) {
  return (
    <NavLink
      to={to}
      role="menuitem"
      className="flex items-center gap-2.5 rounded-xl px-3 py-2 text-sm text-fg transition hover:bg-surface-2 font-medium"
    >
      <span className="text-muted">{icon}</span> {label}
    </NavLink>
  )
}
