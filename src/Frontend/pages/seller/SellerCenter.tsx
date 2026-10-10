import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  AlertTriangle, BadgeCheck, Building2, CheckCircle2, Clock, CreditCard,
  Package, PackagePlus, ShieldCheck, Star, Store, TrendingUp, Users, Wallet,
  Calendar, ChevronRight, Percent, Receipt, Copy, Eye, EyeOff, Lock, Image as ImageIcon, X,
} from 'lucide-react'
import { Button, EmptyState, Field, Reveal, StarRating } from '@/components/ui'
import { OrderBadge } from '@/components/shared/OrderBits'
import { AreaChart } from '@/components/shared/Charts'
import { cn, formatDate, formatMoney, lastMonths, monthLabel } from '@/lib/util'
import { bankDetails, orders, products, stats, stores, subscriptions } from '@/lib/db'
import { useAuth, useDb } from '@/lib/providers'
import type { SellerBankDetails, SellerSubscription } from '@/lib/types'
import { BalochiBottomOrnament, BalochiDochWatermark } from '@/components/shared/BalochDecorations'
import { StoreBannerGallery } from '@/components/shared/StoreBannerGallery'

export function useSellerStore() {
  const { user } = useAuth()
  useDb()
  if (!user) return null
  return stores.activeFor(user.id) ?? null
}

export function StoreSwitcher() {
  const { user } = useAuth()
  useDb()
  if (!user) return null
  const owned = stores.listBySeller(user.id)
  const active = stores.activeFor(user.id)
  if (owned.length === 0) return null

  return (
    <div className="px-4 pb-3">
      <div className="mb-2 flex items-center justify-between text-[0.66rem] font-bold uppercase tracking-[0.18em] text-faint">
        <span>My Stores</span>
        <span className="text-terracotta font-semibold">{owned.length}/2</span>
      </div>
      <div className="space-y-1.5">
        {owned.map((s) => {
          const on = active?.id === s.id
          return (
            <button
              key={s.id}
              type="button"
              onClick={() => stores.setActive(s.id)}
              className={cn(
                'flex w-full items-center gap-2.5 rounded-xl border px-3 py-2 text-left text-xs transition duration-150',
                on
                  ? 'border-terracotta/50 bg-terracotta/12 font-bold text-fg shadow-2xs'
                  : 'border-line bg-surface/60 text-muted hover:border-brand/40 hover:bg-surface hover:text-fg',
              )}
            >
              <Store size={15} className={on ? 'text-terracotta' : 'text-muted'} />
              <span className="min-w-0 flex-1 truncate uppercase tracking-wider">{s.name}</span>
              {on ? (
                <span className="h-2 w-2 rounded-full bg-terracotta" />
              ) : (
                <ChevronRight size={13} className="text-faint" />
              )}
            </button>
          )
        })}
        {owned.length < 2 && (
          <Link
            to="/dashboard/become-seller"
            className="flex w-full items-center justify-center gap-1.5 rounded-xl border border-dashed border-line bg-surface/40 px-3 py-1.5 text-center text-xs font-semibold text-fg transition hover:border-brand hover:bg-surface"
          >
            + Create 2nd Store
          </Link>
        )}
      </div>
    </div>
  )
}

/* ── Seller Subscription Card Matching Image 3 ── */
export function SellerSubscriptionCard({ sellerId }: { sellerId: string }) {
  const [sub, setSub] = useState<SellerSubscription | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let mounted = true
    void subscriptions.get(sellerId).then((res) => {
      if (mounted) {
        setSub(res)
        setLoading(false)
      }
    })
    return () => { mounted = false }
  }, [sellerId])

  if (loading) return null

  const isTrial = sub?.status === 'free_trial' || !sub?.last_payment_at
  const trialEndFormatted = sub?.trial_ends_at ? formatDate(sub.trial_ends_at) : '7 Jan 2027'

  return (
    <div className="relative overflow-hidden rounded-3xl border border-line bg-surface p-6 sm:p-7 shadow-xs">
      <div className="relative z-10 space-y-5">
        {/* Header row */}
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3.5">
            <div className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-brand/12 text-brand">
              <Receipt size={22} />
            </div>
            <div>
              <h3 className="font-display text-lg font-bold text-brand dark:text-fg">Seller Subscription</h3>
              <p className="text-xs text-muted">Fixed monthly model · 0% commission on product sales</p>
            </div>
          </div>
          <span className="inline-flex items-center gap-1.5 rounded-full bg-brand px-3.5 py-1 text-xs font-bold uppercase tracking-wider text-onbrand shadow-xs">
            <CheckCircle2 size={13} className="text-emerald-300" /> {isTrial ? 'FREE 3-MONTH TRIAL ACTIVE' : sub?.status?.toUpperCase()}
          </span>
        </div>

        {/* 3 Sub-Metrics Cards */}
        <div className="grid gap-3.5 sm:grid-cols-3">
          {/* Card 1: Monthly Subscription */}
          <div className="rounded-2xl border border-line bg-surface-2/40 p-4 transition hover:bg-surface hover:border-brand/30">
            <div className="grid h-8 w-8 place-items-center rounded-lg bg-brand/12 text-brand mb-2.5">
              <Calendar size={16} />
            </div>
            <p className="text-[0.7rem] font-bold uppercase tracking-wider text-faint">Monthly Subscription</p>
            <p className="mt-1 font-display text-lg font-bold text-brand dark:text-fg">
              PKR 1,200 <span className="text-xs font-normal text-muted">/ month</span>
            </p>
            <p className="mt-0.5 text-xs font-semibold text-brand dark:text-emerald-400">First 3 months 100% Free</p>
          </div>

          {/* Card 2: Sales Commission */}
          <div className="rounded-2xl border border-line bg-surface-2/40 p-4 transition hover:bg-surface hover:border-terracotta/30">
            <div className="grid h-8 w-8 place-items-center rounded-lg bg-terracotta/12 text-terracotta mb-2.5">
              <Percent size={16} />
            </div>
            <p className="text-[0.7rem] font-bold uppercase tracking-wider text-faint">Product Sales Commission</p>
            <p className="mt-1 font-display text-lg font-bold text-brand dark:text-fg">0.0% Commission</p>
            <p className="mt-0.5 text-xs font-medium text-muted">You keep 100% of product prices</p>
          </div>

          {/* Card 3: Store Allowance */}
          <div className="rounded-2xl border border-line bg-surface-2/40 p-4 transition hover:bg-surface hover:border-brand/30">
            <div className="grid h-8 w-8 place-items-center rounded-lg bg-brand/12 text-brand mb-2.5">
              <Store size={16} />
            </div>
            <p className="text-[0.7rem] font-bold uppercase tracking-wider text-faint">Store Allowance</p>
            <p className="mt-1 font-display text-lg font-bold text-brand dark:text-fg">Up to 2 Stores</p>
            <p className="mt-0.5 text-xs font-medium text-muted">1 subscription covers both stores</p>
          </div>
        </div>

        {/* Official Platform Payment Accounts — Clearly separated from Seller's Own Accounts */}
        <div className="rounded-2xl border border-line bg-surface-2/60 p-4 sm:p-5 text-xs text-muted">
          <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
            <div className="flex items-center gap-2">
              <div className="grid h-6 w-6 place-items-center rounded-md bg-terracotta/12 text-terracotta">
                <CreditCard size={14} />
              </div>
              <p className="font-bold text-sm text-brand dark:text-fg">Official Platform Subscription Accounts:</p>
            </div>
            <span className="rounded-full bg-surface border border-line px-2.5 py-0.5 text-[0.68rem] font-bold text-terracotta uppercase tracking-wider">
              Platform Fee Accounts • Not Seller Payout
            </span>
          </div>
          <p className="leading-relaxed">
            When subscription renewal is due, transfer <strong>PKR 1,200</strong> to the official platform verification accounts below and share the TID/screenshot with administration:
          </p>
          <div className="mt-3 grid gap-2.5 sm:grid-cols-3 font-mono text-xs">
            <div className="rounded-xl border border-line bg-surface p-2.5 shadow-2xs">
              <span className="font-sans font-bold text-brand dark:text-fg">NayaPay:</span> <span className="text-terracotta font-semibold ml-1">03332826358</span>
            </div>
            <div className="rounded-xl border border-line bg-surface p-2.5 shadow-2xs">
              <span className="font-sans font-bold text-brand dark:text-fg">SadaPay:</span> <span className="text-terracotta font-semibold ml-1">03332826358</span>
            </div>
            <div className="rounded-xl border border-line bg-surface p-2.5 shadow-2xs">
              <span className="font-sans font-bold text-brand dark:text-fg">Easypaisa:</span> <span className="text-terracotta font-semibold ml-1">03332826358</span>
            </div>
          </div>
          <p className="mt-3 text-[0.7rem] text-faint">
            Current period trial ends: <strong className="text-brand dark:text-fg">{trialEndFormatted}</strong>.
          </p>
        </div>
      </div>
    </div>
  )
}

/* ── Seller Bank Details (Privacy-by-default compact rows & secure reveal) ── */
export function SellerBankDetailsCard({ sellerId }: { sellerId: string }) {
  const [bank, setBank] = useState<SellerBankDetails | null>(null)
  const [editing, setEditing] = useState(false)
  const [saved, setSaved] = useState(false)
  const [busy, setBusy] = useState(false)
  const [activeChannel, setActiveChannel] = useState<string | null>(null)
  const [revealed, setRevealed] = useState(false)
  const [copied, setCopied] = useState(false)

  const [f, setF] = useState({
    bank_name: 'Easypaisa',
    account_title: 'Balach Baluch',
    account_number: '0312343452',
    iban: '0312343452',
    payment_instructions: 'None specified',
  })

  useEffect(() => {
    let mounted = true
    void bankDetails.get(sellerId).then((res) => {
      if (mounted && res) {
        setBank(res)
        setF({
          bank_name: res.bank_name || 'Easypaisa',
          account_title: res.account_title || 'Balach Baluch',
          account_number: res.account_number || '0312343452',
          iban: res.iban || res.account_number || '0312343452',
          payment_instructions: res.payment_instructions || 'None specified',
        })
      }
    })
    return () => { mounted = false }
  }, [sellerId])

  const save = async (e: React.FormEvent) => {
    e.preventDefault()
    setBusy(true)
    try {
      const updated = await bankDetails.save(sellerId, f)
      setBank(updated)
      setEditing(false)
      setSaved(true)
      setTimeout(() => setSaved(false), 3000)
    } catch (err: any) {
      alert(err?.message ?? 'Failed to save bank details')
    } finally {
      setBusy(false)
    }
  }

  const maskNumber = (val?: string) => {
    if (!val) return '•••• •••• ••••'
    const clean = val.trim().replace(/\s+/g, '')
    if (clean.length <= 4) return `•••• •••• ${clean}`
    return `•••• •••• ${clean.slice(-4)}`
  }

  const copyToClipboard = (text: string) => {
    if (!text) return
    navigator.clipboard?.writeText(text)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const channels = [
    {
      id: 'easypaisa',
      name: 'Easypaisa',
      badge: 'Mobile Wallet',
      desc: 'Instant mobile payout via mobile number / CNIC wallet',
    },
    {
      id: 'sadapay',
      name: 'SadaPay',
      badge: 'Digital Bank',
      desc: 'Instant free transfer via SadaPay number or IBAN',
    },
    {
      id: 'bank-transfer',
      name: 'Bank Transfer',
      badge: 'Commercial Bank IBAN',
      desc: 'Direct IBAN wire transfer (Meezan, HBL, Allied, etc.)',
    },
  ]

  const activeRawNumber = bank?.account_number || bank?.iban || '0312343452'
  const activeAccountTitle = bank?.account_title || 'Balach Baluch'
  const activeBankName = bank?.bank_name || 'Easypaisa'
  const activeInstructions = bank?.payment_instructions || 'None specified'

  return (
    <div className="rounded-3xl border border-line bg-surface p-6 sm:p-7 shadow-xs space-y-4">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3.5">
          <div className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-brand/12 text-brand">
            <Building2 size={22} />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="font-display text-lg font-bold text-brand dark:text-fg">Seller Payout Bank Accounts</h3>
              <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 px-2 py-0.5 text-[0.62rem] font-bold text-emerald-700 dark:text-emerald-300">
                <Lock size={10} /> Secure & Private
              </span>
            </div>
            <p className="text-xs text-muted">Account numbers hidden by default for your privacy and security</p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {saved && (
            <span className="inline-flex items-center gap-1 text-xs text-emerald-600 font-bold">
              <CheckCircle2 size={13} /> Saved
            </span>
          )}
          <button
            type="button"
            onClick={() => {
              setEditing(!editing)
              setActiveChannel(null)
            }}
            className="rounded-full bg-terracotta hover:opacity-95 text-white px-4 py-1.5 text-xs font-bold transition shadow-xs"
          >
            {editing ? 'Cancel' : 'Update Details'}
          </button>
        </div>
      </div>

      {/* Compact Privacy Rows as Requested */}
      {!editing ? (
        <div className="space-y-2.5 pt-1">
          {channels.map((ch) => {
            const isOpened = activeChannel === ch.id
            const isConfigured = activeBankName.toLowerCase().includes(ch.name.toLowerCase().split(' ')[0])

            return (
              <div
                key={ch.id}
                className={cn(
                  'rounded-2xl border transition-all duration-200 overflow-hidden',
                  isOpened
                    ? 'border-brand bg-surface shadow-xs ring-1 ring-brand/20'
                    : 'border-line bg-surface-2/40 hover:bg-surface hover:border-brand/30'
                )}
              >
                {/* Compact Row Header */}
                <div className="flex flex-wrap items-center justify-between gap-3 p-4">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-brand/10 text-brand">
                      <CreditCard size={18} />
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-display text-sm font-bold text-brand dark:text-fg">
                          {ch.name}
                        </span>
                        {isConfigured && (
                          <span className="rounded-full bg-brand/10 border border-brand/20 px-2 py-0.5 text-[0.62rem] font-bold text-brand dark:text-emerald-300">
                            Primary Configured
                          </span>
                        )}
                      </div>
                      <p className="text-[0.72rem] text-muted truncate">
                        {ch.desc}
                      </p>
                    </div>
                  </div>

                  <div>
                    {isOpened ? (
                      <button
                        type="button"
                        onClick={() => {
                          setActiveChannel(null)
                          setRevealed(false)
                        }}
                        className="inline-flex items-center gap-1 rounded-full border border-line bg-surface px-3.5 py-1.5 text-xs font-semibold text-muted hover:text-fg transition shadow-2xs"
                      >
                        Hide Details ↑
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={() => {
                          setActiveChannel(ch.id)
                          setRevealed(false)
                        }}
                        className="inline-flex items-center gap-1 rounded-full bg-brand/10 hover:bg-brand text-brand hover:text-onbrand px-3.5 py-1.5 text-xs font-bold transition shadow-2xs"
                      >
                        View Details →
                      </button>
                    )}
                  </div>
                </div>

                {/* Expandable Secure Details View */}
                {isOpened && (
                  <div className="border-t border-line bg-surface p-4 sm:p-5 space-y-4 animate-fade-in">
                    <div className="flex items-center justify-between border-b border-line pb-2.5">
                      <div className="flex items-center gap-2">
                        <Lock size={14} className="text-emerald-600 dark:text-emerald-400" />
                        <span className="text-xs font-bold uppercase tracking-wider text-muted">
                          Encrypted Account Information · {ch.name}
                        </span>
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          setActiveChannel(null)
                          setRevealed(false)
                        }}
                        className="text-xs font-semibold text-muted hover:text-fg transition"
                      >
                        Hide Details
                      </button>
                    </div>

                    <div className="grid gap-3 sm:grid-cols-2 text-xs">
                      {/* Provider Name */}
                      <div className="rounded-xl border border-line bg-surface-2/60 p-3.5">
                        <span className="text-faint block text-[0.7rem] uppercase tracking-wider font-semibold">Payment Provider:</span>
                        <strong className="text-brand dark:text-fg text-sm mt-0.5 block">{activeBankName || ch.name}</strong>
                      </div>

                      {/* Account Title */}
                      <div className="rounded-xl border border-line bg-surface-2/60 p-3.5">
                        <span className="text-faint block text-[0.7rem] uppercase tracking-wider font-semibold">Account Title:</span>
                        <strong className="text-brand dark:text-fg text-sm mt-0.5 block">{activeAccountTitle}</strong>
                      </div>

                      {/* Account Number / IBAN with Mask/Reveal toggle */}
                      <div className="rounded-xl border border-line bg-surface-2/60 p-3.5 sm:col-span-2">
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-faint text-[0.7rem] uppercase tracking-wider font-semibold">Account Number / IBAN:</span>
                          <div className="flex items-center gap-2">
                            <button
                              type="button"
                              onClick={() => setRevealed(!revealed)}
                              className="inline-flex items-center gap-1 text-[0.7rem] font-bold text-terracotta hover:underline"
                            >
                              {revealed ? <EyeOff size={12} /> : <Eye size={12} />}
                              {revealed ? 'Mask Number' : 'Reveal Number'}
                            </button>
                            <button
                              type="button"
                              onClick={() => copyToClipboard(activeRawNumber)}
                              className="inline-flex items-center gap-1 text-[0.7rem] font-bold text-brand dark:text-emerald-300 hover:underline"
                            >
                              <Copy size={12} /> {copied ? 'Copied!' : 'Copy'}
                            </button>
                          </div>
                        </div>
                        <p className="font-mono text-sm font-bold text-brand dark:text-fg tracking-wider">
                          {revealed ? activeRawNumber : maskNumber(activeRawNumber)}
                        </p>
                      </div>

                      {/* Transfer Instructions */}
                      <div className="rounded-xl border border-line bg-surface-2/60 p-3.5 sm:col-span-2">
                        <span className="text-faint block text-[0.7rem] uppercase tracking-wider font-semibold">Transfer Instructions:</span>
                        <p className="text-muted mt-1 leading-relaxed">{activeInstructions}</p>
                      </div>
                    </div>

                    <div className="flex items-center justify-between pt-1">
                      <button
                        type="button"
                        onClick={() => {
                          setEditing(true)
                          setActiveChannel(null)
                        }}
                        className="text-xs font-bold text-brand dark:text-emerald-300 hover:underline"
                      >
                        Edit this account →
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setActiveChannel(null)
                          setRevealed(false)
                        }}
                        className="rounded-full border border-line bg-surface-2/80 px-4 py-1.5 text-xs font-semibold text-fg hover:bg-surface-2 transition"
                      >
                        Close / Hide Details
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      ) : (
        /* Edit Form */
        <form onSubmit={save} className="grid gap-4 sm:grid-cols-2 pt-2 animate-fade-in">
          <Field label="Bank / Provider Name" required>
            <input
              className="field text-xs"
              value={f.bank_name}
              onChange={(e) => setF({ ...f, bank_name: e.target.value })}
              placeholder="e.g. Easypaisa / SadaPay / Meezan Bank / HBL"
              required
            />
          </Field>
          <Field label="Account Title" required>
            <input
              className="field text-xs"
              value={f.account_title}
              onChange={(e) => setF({ ...f, account_title: e.target.value })}
              placeholder="e.g. Balach Baluch"
              required
            />
          </Field>
          <Field label="Account Number / IBAN" required>
            <input
              className="field text-xs font-mono"
              value={f.iban}
              onChange={(e) => setF({ ...f, iban: e.target.value, account_number: e.target.value })}
              placeholder="e.g. 0312343452 or PK36MEZN..."
              required
            />
          </Field>
          <Field label="Transfer Instructions">
            <input
              className="field text-xs"
              value={f.payment_instructions}
              onChange={(e) => setF({ ...f, payment_instructions: e.target.value })}
              placeholder="e.g. Please share transfer screenshot on WhatsApp or chat"
            />
          </Field>
          <div className="sm:col-span-2 flex justify-end gap-2 pt-2">
            <Button size="sm" variant="ghost" type="button" onClick={() => setEditing(false)}>Cancel</Button>
            <button type="submit" disabled={busy} className="rounded-full bg-brand hover:opacity-95 text-onbrand px-5 py-2 text-xs font-bold">
              {busy ? 'Saving…' : 'Save Details'}
            </button>
          </div>
        </form>
      )}
    </div>
  )
}

/* ── Overview Matching Consistent Welcome Banner & Gallery ── */
export function SellerOverview() {
  const { user } = useAuth()
  useDb()
  const store = useSellerStore()
  const [bannerModalOpen, setBannerModalOpen] = useState(false)
  const [bannerSaving, setBannerSaving] = useState(false)
  const [bannerSuccess, setBannerSuccess] = useState(false)

  if (!user || !store) return <NoStore />
  const s = stats.seller(store.id)
  const months = lastMonths(6)
  const revenueSeries = stats.monthlySeries(months, (o) =>
    o.items.filter((i) => i.store_id === store.id && i.status !== 'cancelled').reduce((sum, i) => sum + i.price * i.qty, 0))
  const myOrders = orders.listByStore(store.id)
  const lowStock = products.list({ storeId: store.id }).filter((p) => p.stock <= 3)

  const handleUpdateBanner = async (newBannerUrl: string) => {
    if (!user || store.seller_id !== user.id) {
      alert('You can only update banners for your own store.')
      return
    }
    setBannerSaving(true)
    try {
      await stores.update(store.id, { banner: newBannerUrl })
      setBannerSuccess(true)
      setTimeout(() => setBannerSuccess(false), 3000)
    } catch (err: any) {
      alert(err?.message || 'Failed to update store banner')
    } finally {
      setBannerSaving(false)
      setBannerModalOpen(false)
    }
  }

  const cards = [
    {
      label: 'Total Revenue',
      value: formatMoney(s.gross),
      sub: `${s.orders} completed orders`,
      icon: <Wallet size={18} />,
    },
    {
      label: 'Store Orders',
      value: s.orders,
      sub: `${myOrders.length} total orders`,
      icon: <Package size={18} />,
    },
    {
      label: 'Store Rating',
      value: s.avgRating ? `${s.avgRating.toFixed(1)} ★` : 'New',
      sub: `${s.reviews} total reviews`,
      icon: <Star size={18} />,
    },
    {
      label: 'Active Products',
      value: s.active,
      sub: `${lowStock.length} low in stock`,
      icon: <Store size={18} />,
    },
  ]

  return (
    <div className="space-y-6 sm:space-y-8">
      {/* ── Welcome Banner Consistent with Buyer Dashboard (Image 1) ── */}
      <div className="relative overflow-hidden rounded-3xl border border-line bg-surface p-6 sm:p-9 shadow-xs">
        {/* Right corner Doch embroidery watermark (preserved Balochi cultural motif, zero mountain/sun) */}
        <div className="pointer-events-none absolute -right-6 -top-6 hidden sm:block opacity-35">
          <BalochiDochWatermark size={190} />
        </div>

        <div className="relative z-10 max-w-2xl">
          <div className="flex flex-wrap items-center gap-2.5">
            <p className="flex items-center gap-2 text-xs font-bold uppercase tracking-[0.2em] text-terracotta">
              <span>Welcome</span>
              <span className="h-0.5 w-6 bg-terracotta inline-block rounded-full" />
            </p>
            {store && (
              <span className="inline-flex items-center gap-1.5 rounded-full border border-brand/30 bg-brand/10 px-3 py-0.5 text-xs font-bold text-brand dark:text-emerald-300">
                <Store size={12} className="shrink-0" />
                <span>Store: <strong>{store.name}</strong></span>
              </span>
            )}
          </div>

          <h2 className="mt-2.5 font-display text-2xl font-bold tracking-tight text-brand dark:text-fg sm:text-3xl lg:text-4xl">
            {user.full_name || 'Store Creator'}
          </h2>

          <p className="mt-2.5 text-sm sm:text-base leading-relaxed text-muted">
            Manage your store, showcase your products, track orders, and grow your business with Baloch Export Hub.
          </p>
        </div>
      </div>

      {!store.is_approved && (
        <div className="flex items-start gap-4 rounded-2xl border border-amber-500/40 bg-amber-500/10 p-4 text-brand dark:text-amber-200">
          <AlertTriangle size={20} className="mt-0.5 shrink-0 text-amber-600 dark:text-amber-400" />
          <div>
            <p className="text-sm font-bold">Store under review</p>
            <p className="mt-0.5 text-xs text-muted">
              Your store and products become public once the platform team approves them (usually within 48 hours). You can keep setting up in the meantime.
            </p>
          </div>
        </div>
      )}

      {/* ── Store Banner Showcase & Gallery ── */}
      <div className="rounded-3xl border border-line bg-surface p-6 sm:p-7 shadow-xs space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-brand/12 text-brand">
              <ImageIcon size={20} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-display text-lg font-bold text-brand dark:text-fg">Store Banner Gallery</h3>
                {bannerSuccess && (
                  <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/10 text-emerald-600 text-xs font-bold px-2.5 py-0.5">
                    <CheckCircle2 size={12} /> Updated!
                  </span>
                )}
              </div>
              <p className="text-xs text-muted">Choose wide, authentic banners for your public store across cultural categories</p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setBannerModalOpen(true)}
            className="rounded-full bg-brand/10 hover:bg-brand text-brand hover:text-onbrand px-4 py-1.5 text-xs font-bold transition shadow-2xs"
          >
            Change Banner Gallery →
          </button>
        </div>

        {/* Current Active Banner Preview */}
        <div className="relative aspect-[21/8] sm:aspect-[16/5] w-full overflow-hidden rounded-2xl border border-line bg-surface-2 shadow-inner">
          {store.banner ? (
            <img src={store.banner} alt={store.name} className="h-full w-full object-cover" />
          ) : (
            <div className="h-full w-full bg-gradient-to-br from-brand/40 to-gold/40 flex items-center justify-center text-muted text-xs">
              No banner selected yet
            </div>
          )}
          <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-transparent pointer-events-none" />
          <div className="absolute bottom-3 left-4 right-4 flex items-center justify-between">
            <div>
              <span className="text-[0.68rem] uppercase font-bold text-amber-200 tracking-wider block">Active Store Banner</span>
              <span className="text-sm font-bold text-white drop-shadow-sm truncate block">{store.name}</span>
            </div>
            <button
              type="button"
              onClick={() => setBannerModalOpen(true)}
              className="rounded-full bg-black/60 hover:bg-black/80 backdrop-blur-md px-3.5 py-1.5 text-xs font-bold text-white transition border border-white/20"
            >
              Browse Gallery
            </button>
          </div>
        </div>
      </div>

      {/* Banner Gallery Modal */}
      {bannerModalOpen && (
        <div className="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-fade-in">
          <div className="relative w-full max-w-4xl max-h-[90vh] overflow-y-auto rounded-3xl border border-line bg-surface p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-line pb-3">
              <div>
                <h3 className="font-display text-xl font-bold text-brand dark:text-fg">
                  Store Banner Gallery
                </h3>
                <p className="text-xs text-muted">
                  Choose a high-resolution wide banner for <strong>{store.name}</strong>. Persists immediately.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setBannerModalOpen(false)}
                className="rounded-full p-2 text-muted hover:bg-surface-2 hover:text-fg"
                aria-label="Close"
              >
                <X size={18} />
              </button>
            </div>

            <StoreBannerGallery
              selectedBanner={store.banner}
              storeName={store.name}
              onSelect={handleUpdateBanner}
              isSaving={bannerSaving}
            />
          </div>
        </div>
      )}

      {/* Subscription Card */}
      <SellerSubscriptionCard sellerId={user.id} />

      {/* Registered Bank Details Card with Privacy Default */}
      <SellerBankDetailsCard sellerId={user.id} />

      {/* Cultural Diamond Ornament */}
      <BalochiBottomOrnament />

      {/* Performance Summary Strip */}
      <div className="pt-2">
        <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
          <h3 className="font-display text-lg font-bold text-brand dark:text-fg">Store Performance</h3>
          <Button to="/products" variant="ghost" size="sm" className="!rounded-full border border-line text-brand dark:text-fg text-xs">
            Connect with Marketplace
          </Button>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {cards.map((c, i) => (
            <Reveal key={c.label} delay={i * 0.05}>
              <div className="rounded-2xl border border-line bg-surface p-5 shadow-2xs">
                <span className="mb-3 grid h-10 w-10 place-items-center rounded-xl bg-brand/12 text-brand">{c.icon}</span>
                <p className="font-display text-2xl font-bold text-brand dark:text-fg leading-none tnum">{c.value}</p>
                <p className="mt-1.5 text-[0.68rem] font-bold uppercase tracking-wider text-faint">{c.label}</p>
                <p className="mt-1 text-[0.7rem] text-muted">{c.sub}</p>
              </div>
            </Reveal>
          ))}
        </div>
      </div>

      {/* Sales Trend & Stock Alerts */}
      <div className="grid gap-6 xl:grid-cols-[1.6fr_1fr]">
        <section className="rounded-3xl border border-line bg-surface p-6 shadow-xs" aria-labelledby="sv-rev">
          <div className="flex items-center justify-between">
            <h3 id="sv-rev" className="font-display text-lg font-bold text-brand dark:text-fg">Sales — last 6 months</h3>
            <span className="text-xs font-semibold text-brand dark:text-emerald-400 bg-brand/12 px-2.5 py-0.5 rounded-full">0% sales commission</span>
          </div>
          <AreaChart className="mt-4" data={revenueSeries} labels={months.map(monthLabel)} format={(n) => formatMoney(n)} />
        </section>

        <section className="rounded-3xl border border-line bg-surface p-6 shadow-xs" aria-labelledby="sv-low">
          <h3 id="sv-low" className="font-display text-lg font-bold text-brand dark:text-fg">Stock alerts</h3>
          {lowStock.length === 0 ? (
            <p className="mt-4 text-sm text-muted">All products comfortably in stock. 👍</p>
          ) : (
            <ul className="mt-4 space-y-3">
              {lowStock.slice(0, 5).map((p) => (
                <li key={p.id} className="flex items-center gap-3 rounded-xl border border-line bg-surface-2/60 p-3">
                  <span className="h-10 w-10 shrink-0 overflow-hidden rounded-lg bg-surface border border-line">
                    {p.image ? <img src={p.image} alt="" className="h-full w-full object-cover" /> : null}
                  </span>
                  <span className="min-w-0 flex-1 truncate text-sm font-semibold text-fg">{p.name}</span>
                  <span className={`text-xs font-bold tnum ${p.stock === 0 ? 'text-rose-600' : 'text-amber-600'}`}>
                    {p.stock === 0 ? 'Out' : `${p.stock} left`}
                  </span>
                </li>
              ))}
            </ul>
          )}
          <Button to="/seller/products" variant="ghost" size="sm" className="mt-4 w-full !rounded-full">Manage products</Button>
        </section>
      </div>

      {/* Recent Orders */}
      <section className="rounded-3xl border border-line bg-surface p-6 shadow-xs" aria-labelledby="sv-orders">
        <div className="flex items-center justify-between">
          <h3 id="sv-orders" className="font-display text-lg font-bold text-brand dark:text-fg">Recent orders</h3>
          <Link to="/seller/orders" className="text-sm font-semibold text-terracotta hover:underline">View all</Link>
        </div>
        {myOrders.length === 0 ? (
          <p className="mt-4 text-sm text-muted">No orders yet — share your store link to get the first one.</p>
        ) : (
          <ul className="mt-4 space-y-3">
            {myOrders.slice(0, 5).map((o) => (
              <li key={o.id} className="flex flex-wrap items-center gap-3 rounded-2xl border border-line bg-surface-2/60 p-3.5">
                <span className="min-w-0 flex-1">
                  <span className="block text-sm font-bold text-fg">{o.code} · {o.buyer_name}</span>
                  <span className="text-xs text-muted">{formatDate(o.created_at)} · {o.items.filter((i) => i.store_id === store.id).length} item(s)</span>
                </span>
                <span className="font-bold text-fg tnum">
                  {formatMoney(o.items.filter((i) => i.store_id === store.id).reduce((sum, i) => sum + i.price * i.qty, 0))}
                </span>
                <OrderBadge status={o.status} />
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  )
}

/* ── Earnings ─────────────────────────────────────────────────── */
export function SellerEarnings() {
  const { user } = useAuth()
  useDb()
  const store = useSellerStore()
  if (!user || !store) return <NoStore />
  const s = stats.seller(store.id)
  const months = lastMonths(6)
  const series = stats.monthlySeries(months, (o) =>
    o.items.filter((i) => i.store_id === store.id && i.status !== 'cancelled').reduce((sum, i) => sum + i.price * i.qty, 0))
  const myOrders = orders.listByStore(store.id).filter((o) => o.payment === 'paid')

  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-3">
        <div className="card p-6">
          <p className="text-xs font-bold uppercase tracking-wider text-faint">Gross product sales</p>
          <p className="mt-2 font-display text-3xl font-semibold tnum">{formatMoney(s.gross)}</p>
        </div>
        <div className="card p-6">
          <p className="text-xs font-bold uppercase tracking-wider text-faint">Sales commission (0%)</p>
          <p className="mt-2 font-display text-3xl font-semibold text-emerald-500 tnum">PKR 0 <span className="text-xs font-normal text-muted">(0% fee)</span></p>
        </div>
        <div className="card border-emerald-500/30 bg-emerald-500/5 p-6">
          <p className="text-xs font-bold uppercase tracking-wider text-faint">Net seller payout</p>
          <p className="mt-2 font-display text-3xl font-semibold text-emerald-500 tnum">{formatMoney(s.gross)}</p>
        </div>
      </div>

      <SellerSubscriptionCard sellerId={user.id} />

      <section className="card p-6" aria-labelledby="earn-chart">
        <h3 id="earn-chart" className="font-display text-lg font-semibold">Monthly gross sales</h3>
        <AreaChart className="mt-4" data={series} labels={months.map(monthLabel)} format={(n) => formatMoney(n)} />
      </section>

      <section className="card table-scroll p-6" aria-labelledby="earn-table">
        <h3 id="earn-table" className="font-display text-lg font-semibold">Per-order breakdown</h3>
        <table className="mt-4 w-full min-w-[36rem] text-sm">
          <thead>
            <tr className="border-b border-line text-left text-xs uppercase tracking-wider text-faint">
              <th className="pb-3 pr-4 font-semibold">Order</th>
              <th className="pb-3 pr-4 font-semibold">Date</th>
              <th className="pb-3 pr-4 font-semibold">Your items</th>
              <th className="pb-3 pr-4 text-right font-semibold">Gross</th>
              <th className="pb-3 pr-4 text-right font-semibold">Commission (0%)</th>
              <th className="pb-3 text-right font-semibold">Payout</th>
            </tr>
          </thead>
          <tbody>
            {myOrders.map((o) => {
              const gross = o.items.filter((i) => i.store_id === store.id && i.status !== 'cancelled').reduce((sum, i) => sum + i.price * i.qty, 0)
              if (!gross) return null
              return (
                <tr key={o.id} className="border-b border-line/60">
                  <td className="py-3 pr-4 font-semibold">{o.code}</td>
                  <td className="py-3 pr-4 text-muted">{formatDate(o.created_at)}</td>
                  <td className="py-3 pr-4 text-muted tnum">{o.items.filter((i) => i.store_id === store.id).length}</td>
                  <td className="py-3 pr-4 text-right tnum">{formatMoney(gross)}</td>
                  <td className="py-3 pr-4 text-right text-emerald-500 tnum">PKR 0</td>
                  <td className="py-3 text-right font-semibold text-emerald-500 tnum">{formatMoney(gross)}</td>
                </tr>
              )
            })}
          </tbody>
        </table>
        {myOrders.length === 0 && <p className="mt-4 text-sm text-muted">No paid orders yet.</p>}
      </section>
    </div>
  )
}

/* ── Customers ────────────────────────────────────────────────── */
export function SellerCustomers() {
  useDb()
  const store = useSellerStore()
  if (!store) return <NoStore />
  const myOrders = orders.listByStore(store.id)
  const map = new Map<string, { name: string; orders: number; spent: number; last: string }>()
  for (const o of myOrders) {
    const gross = o.items.filter((i) => i.store_id === store.id && i.status !== 'cancelled').reduce((s, i) => s + i.price * i.qty, 0)
    const prev = map.get(o.buyer_id)
    map.set(o.buyer_id, {
      name: o.buyer_name,
      orders: (prev?.orders ?? 0) + 1,
      spent: (prev?.spent ?? 0) + gross,
      last: prev && prev.last > o.created_at ? prev.last : o.created_at,
    })
  }
  const list = [...map.entries()].sort((a, b) => b[1].spent - a[1].spent)

  return (
    <div>
      {list.length === 0 ? (
        <EmptyState icon={<Users size={26} />} title="No customers yet" sub="Your first order will introduce them." />
      ) : (
        <div className="card table-scroll p-6">
          <table className="w-full min-w-[34rem] text-sm">
            <thead>
              <tr className="border-b border-line text-left text-xs uppercase tracking-wider text-faint">
                <th className="pb-3 pr-4 font-semibold">Customer</th>
                <th className="pb-3 pr-4 text-right font-semibold">Orders</th>
                <th className="pb-3 pr-4 text-right font-semibold">Total spent</th>
                <th className="pb-3 text-right font-semibold">Last order</th>
              </tr>
            </thead>
            <tbody>
              {list.map(([id, c]) => (
                <tr key={id} className="border-b border-line/60">
                  <td className="py-3 pr-4 font-semibold">{c.name}</td>
                  <td className="py-3 pr-4 text-right tnum">{c.orders}</td>
                  <td className="py-3 pr-4 text-right tnum">{formatMoney(c.spent)}</td>
                  <td className="py-3 text-right text-muted">{formatDate(c.last)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

export function NoStore() {
  return (
    <EmptyState
      icon={<Store size={26} />}
      title="You don't have a store yet"
      sub="Open your free store to start listing products."
      action={<Button to="/dashboard/become-seller" variant="gold" size="sm"><PackagePlus size={14} /> Create your store</Button>}
    />
  )
}

export function SellerRating({ rating, count }: { rating: number; count?: number }) {
  return <StarRating rating={rating} count={count} size={14} />
}

export function VerifiedBadge() {
  return <BadgeCheck size={16} className="text-emerald-500" />
}
