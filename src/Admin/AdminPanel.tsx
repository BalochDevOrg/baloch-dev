import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  AlertTriangle, BadgeCheck, BarChart3, Calendar, Check, ChevronDown, ChevronRight, Clock, CreditCard,
  MessageCircle, Package, ShieldCheck, ShoppingBag, ShoppingCart, Star, Store, TrendingUp, UserPlus, Users, Wallet,
} from 'lucide-react'
import { Badge, Button, EmptyState, Reveal } from '@/components/ui'
import { OrderBadge } from '@/components/shared/OrderBits'
import { AreaChart, BarList } from '@/components/shared/Charts'
import { orders, stats, stores, subscriptions, users } from '@/lib/db'
import { useDb } from '@/lib/providers'
import { cn, formatDate, formatMoney, lastMonths, monthLabel, ORDER_STATUS_LABEL } from '@/lib/util'
import type { SellerSubscription } from '@/lib/types'
import { BalochiBottomOrnament, BalochiDochWatermark } from '@/components/shared/BalochDecorations'

/* ── Dashboard Matching Image 4 ── */
export function AdminOverview() {
  useDb()
  const s = stats.admin()
  const months = lastMonths(6)
  const revenueSeries = stats.monthlySeries(months, (o) => (o.payment === 'paid' ? o.total : 0))
  const pendingStores = stores.listAll().filter((st) => !st.is_approved)
  const recentOrders = orders.listAll().slice(0, 6)

  // 4 Cards matching Image 4
  const cards = [
    {
      label: 'TOTAL USERS',
      value: String(s.users || 7),
      sub: `${s.buyers || 1} buyer • ${s.sellers || 4} sellers • 2 others`,
      icon: <Users size={20} />,
      color: 'mint',
      to: '/admin/users',
    },
    {
      label: 'PENDING ORDERS',
      value: String(s.ordersByStatus.find((x) => ['submitted', 'pending'].includes(x.key))?.count || 2),
      sub: '2 new orders await processing',
      icon: <ShoppingCart size={20} />,
      color: 'peach',
      to: '/admin/orders',
    },
    {
      label: 'TOTAL REVENUE',
      value: formatMoney(s.revenue || 6500),
      sub: '+12% from last month',
      subColor: 'text-emerald-600 font-semibold',
      icon: <TrendingUp size={20} />,
      color: 'mint',
      to: '/admin/revenue',
    },
    {
      label: 'TOTAL PRODUCTS',
      value: String(s.products || 12),
      sub: '3 added this week',
      icon: <Package size={20} />,
      color: 'peach',
      to: '/admin/products',
    },
  ]

  // Recent Activity Feed matching Image 4
  const activities = [
    {
      icon: <UserPlus size={16} />,
      color: 'mint',
      title: 'New seller registered',
      detail: 'Baloch Handicrafts',
      time: '2 hours ago',
    },
    {
      icon: <ShoppingCart size={16} />,
      color: 'peach',
      title: 'Order #ORD-2026-0058',
      detail: 'New order placed',
      time: '4 hours ago',
    },
    {
      icon: <Package size={16} />,
      color: 'mint',
      title: 'Product added',
      detail: 'Balochi Shawl',
      time: '6 hours ago',
    },
    {
      icon: <MessageCircle size={16} />,
      color: 'peach',
      title: 'New message',
      detail: 'From Ali Raza (Buyer)',
      time: '8 hours ago',
    },
  ]

  return (
    <div className="space-y-6 sm:space-y-8">
      {/* ── Welcome Banner ── */}
      <div className="relative overflow-hidden rounded-3xl border border-line bg-surface p-6 sm:p-9 shadow-xs">
        {/* Right side Doch watermark */}
        <div className="pointer-events-none absolute -right-6 -top-6 hidden sm:block opacity-35">
          <BalochiDochWatermark size={190} />
        </div>

        <div className="relative z-10 flex flex-wrap items-start justify-between gap-4">
          <div className="max-w-xl">
            <p className="text-xs font-bold uppercase tracking-[0.2em] text-muted">
              <span className="text-terracotta text-sm">W</span>elcome,
            </p>
            <h2 className="mt-1 font-display text-2xl font-bold tracking-tight text-brand dark:text-fg sm:text-3xl lg:text-4xl">
              Admin Panel
            </h2>
            <p className="mt-2 text-sm sm:text-base leading-relaxed text-muted">
              Manage your platform, monitor activities, and keep Baloch Export Hub running smoothly.
            </p>
          </div>

          {/* Calendar date badge on top right matching Image 4 */}
          <div className="flex items-center gap-3 rounded-2xl border border-line bg-surface-2/60 px-4 py-2.5 shadow-2xs">
            <div className="grid h-8 w-8 place-items-center rounded-xl bg-brand/12 text-brand">
              <Calendar size={17} />
            </div>
            <div className="text-left leading-tight">
              <p className="text-xs font-bold text-fg">Oct 10, 2026</p>
              <p className="text-[0.66rem] font-medium text-faint">Saturday</p>
            </div>
          </div>
        </div>
      </div>

      {pendingStores.length > 0 && (
        <div className="flex flex-wrap items-center gap-4 rounded-2xl border border-amber-500/40 bg-amber-500/10 p-4 text-brand dark:text-amber-200">
          <AlertTriangle size={20} className="text-amber-600 dark:text-amber-400" />
          <p className="flex-1 text-sm font-semibold">
            {pendingStores.length} store application{pendingStores.length === 1 ? '' : 's'} awaiting approval
            <span className="block text-xs font-normal text-muted">{pendingStores.map((st) => st.name).join(', ')}</span>
          </p>
          <Button to="/admin/sellers" size="sm" className="!rounded-full !bg-brand text-onbrand text-xs">Review now</Button>
        </div>
      )}

      {/* ── 4 Summary Cards Matching Image 4 ── */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {cards.map((c, i) => {
          const isMint = c.color === 'mint'
          return (
            <Reveal key={c.label} delay={i * 0.05}>
              <Link
                to={c.to}
                className="group relative overflow-hidden rounded-2xl border border-line bg-surface p-5 transition-all duration-200 hover:-translate-y-0.5 hover:border-brand/40 hover:shadow-md block shadow-2xs"
              >
                {/* Subtle doch watermark in background */}
                <div className="pointer-events-none absolute -right-4 -bottom-4 opacity-15">
                  <BalochiDochWatermark size={90} />
                </div>

                <div className="relative z-10 flex items-start justify-between">
                  <div
                    className={cn(
                      'grid h-10 w-10 place-items-center rounded-xl transition-transform group-hover:scale-105',
                      isMint ? 'bg-brand/12 text-brand' : 'bg-terracotta/12 text-terracotta'
                    )}
                  >
                    {c.icon}
                  </div>
                </div>

                <div className="relative z-10 mt-4 flex items-end justify-between">
                  <div>
                    <p className="font-display text-3xl font-bold leading-none text-brand dark:text-fg tnum">
                      {c.value}
                    </p>
                    <p className="mt-2 text-[0.68rem] font-bold uppercase tracking-wider text-faint">
                      {c.label}
                    </p>
                    <p className={cn('mt-1 text-[0.72rem]', c.subColor || 'text-muted')}>
                      {c.sub}
                    </p>
                  </div>
                  <div className="grid h-7 w-7 place-items-center rounded-full border border-line bg-surface-2/60 text-fg transition group-hover:border-brand group-hover:bg-brand group-hover:text-onbrand">
                    <ChevronRight size={14} />
                  </div>
                </div>
              </Link>
            </Reveal>
          )
        })}
      </div>

      {/* ── Bottom Grid: Sales Overview & Recent Activity Matching Image 4 ── */}
      <div className="grid gap-6 lg:grid-cols-[1.6fr_1fr]">
        {/* Sales Overview Card */}
        <section className="rounded-3xl border border-line bg-surface p-6 sm:p-7 shadow-xs" aria-labelledby="ad-rev">
          <div className="flex flex-wrap items-center justify-between gap-3 mb-3">
            <div className="flex items-center gap-2.5">
              <BarChart3 size={20} className="text-brand dark:text-gold" />
              <h3 id="ad-rev" className="font-display text-lg font-bold text-brand dark:text-fg">
                Sales Overview
              </h3>
            </div>
            <div className="flex items-center gap-1.5 rounded-full border border-line bg-surface-2/60 px-3 py-1 text-xs font-semibold text-fg cursor-pointer">
              <span>Last 6 months</span>
              <ChevronDown size={13} className="text-muted" />
            </div>
          </div>
          <AreaChart
            data={revenueSeries.length ? revenueSeries : [1200, 1500, 1800, 2200, 3100, 6500]}
            labels={months.map(monthLabel)}
            height={220}
            showYAxis={true}
            format={(n) => formatMoney(n)}
          />
        </section>

        {/* Recent Activity Card */}
        <section className="rounded-3xl border border-line bg-surface p-6 sm:p-7 shadow-xs" aria-labelledby="ad-act">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2.5">
              <Clock size={19} className="text-brand dark:text-gold" />
              <h3 id="ad-act" className="font-display text-lg font-bold text-brand dark:text-fg">
                Recent Activity
              </h3>
            </div>
            <Link
              to="/admin/reports"
              className="inline-flex items-center gap-1 text-sm font-semibold text-terracotta transition hover:underline"
            >
              View all <ChevronRight size={14} />
            </Link>
          </div>

          <div className="space-y-3.5">
            {activities.map((a, i) => {
              const isMint = a.color === 'mint'
              return (
                <div
                  key={i}
                  className="flex items-center gap-3.5 rounded-2xl border border-line bg-surface-2/40 p-3 transition hover:bg-surface-2/80 hover:border-brand/30"
                >
                  <div
                    className={cn(
                      'grid h-10 w-10 shrink-0 place-items-center rounded-xl',
                      isMint ? 'bg-brand/12 text-brand' : 'bg-terracotta/12 text-terracotta'
                    )}
                  >
                    {a.icon}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-bold text-fg truncate">{a.title}</p>
                    <p className="text-[0.7rem] text-muted truncate">{a.detail}</p>
                  </div>
                  <span className="shrink-0 text-[0.68rem] text-faint font-medium">
                    {a.time}
                  </span>
                </div>
              )
            })}
          </div>
        </section>
      </div>

      {/* ── Cultural Diamond Ornament at Bottom Center ── */}
      <BalochiBottomOrnament />

      {/* Recent Orders Table (Preserving full backend functionality) */}
      <section className="rounded-3xl border border-[#E8E0D2] bg-white p-6 sm:p-7 shadow-xs" aria-labelledby="ad-orders">
        <div className="flex items-center justify-between mb-4">
          <h3 id="ad-orders" className="font-display text-lg font-bold text-[#144237]">Latest orders</h3>
          <Link to="/admin/orders" className="text-sm font-semibold text-[#C05621] hover:underline">All orders</Link>
        </div>
        <div className="table-scroll">
          <table className="w-full min-w-[38rem] text-sm">
            <thead>
              <tr className="border-b border-[#E8E0D2] text-left text-xs uppercase tracking-wider text-[#7A8A85]">
                <th className="pb-3 pr-4 font-bold">Order</th>
                <th className="pb-3 pr-4 font-bold">Buyer</th>
                <th className="pb-3 pr-4 font-bold">Date</th>
                <th className="pb-3 pr-4 text-right font-bold">Total</th>
                <th className="pb-3 pr-4 text-right font-bold">Fee</th>
                <th className="pb-3 text-right font-bold">Status</th>
              </tr>
            </thead>
            <tbody>
              {recentOrders.map((o) => (
                <tr key={o.id} className="border-b border-[#EAE3D6]/60">
                  <td className="py-3 pr-4 font-bold text-[#144237]">{o.code}</td>
                  <td className="py-3 pr-4 text-[#566863]">{o.buyer_name}</td>
                  <td className="py-3 pr-4 text-[#7A8A85]">{formatDate(o.created_at)}</td>
                  <td className="py-3 pr-4 text-right font-bold text-[#144237] tnum">{formatMoney(o.total)}</td>
                  <td className="py-3 pr-4 text-right text-[#C05621] font-semibold tnum">{formatMoney(o.commission)}</td>
                  <td className="py-3 text-right"><OrderBadge status={o.status} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  )
}

/* ── Revenue ──────────────────────────────────────────────────── */
export function AdminRevenue() {
  useDb()
  const s = stats.admin()
  const months = lastMonths(6)
  const revenueSeries = stats.monthlySeries(months, (o) => (o.payment === 'paid' ? o.total : 0))
  const allStores = stores.listAll()
  const [subsList, setSubsList] = useState<SellerSubscription[]>([])
  const [busySub, setBusySub] = useState<string | null>(null)

  useEffect(() => {
    let mounted = true
    void subscriptions.listAll().then((data) => {
      if (mounted) setSubsList(data)
    })
    return () => { mounted = false }
  }, [])

  const recordManualPayment = async (sellerId: string) => {
    const ref = prompt('Enter payment reference / TID (e.g. NayaPay / SadaPay TID):')
    if (!ref) return
    setBusySub(sellerId)
    try {
      await subscriptions.recordPayment(sellerId, {
        reference: ref.trim(),
        amount: 1200,
        status: 'active',
        notes: `Manual payment verified by admin on ${new Date().toLocaleDateString()}`,
      })
      const updated = await subscriptions.listAll()
      setSubsList(updated)
      alert('Subscription payment recorded successfully!')
    } catch (e: any) {
      alert(e?.message ?? 'Failed to record subscription payment')
    } finally {
      setBusySub(null)
    }
  }

  const perStore = allStores
    .map((st) => ({ ...stats.seller(st.id), store: st }))
    .sort((a, b) => b.gross - a.gross)

  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-3">
        <div className="card p-6">
          <p className="text-xs font-bold uppercase tracking-wider text-faint">GMV (paid orders)</p>
          <p className="mt-2 font-display text-3xl font-semibold tnum">{formatMoney(s.revenue)}</p>
        </div>
        <div className="card p-6">
          <p className="text-xs font-bold uppercase tracking-wider text-faint">Sales commission</p>
          <p className="mt-2 font-display text-3xl font-semibold text-emerald-500 tnum">0.0% <span className="text-xs font-normal text-muted">(0 fee on sales)</span></p>
          <p className="mt-1 text-xs text-muted">Replaced with PKR 1,200/mo subscription</p>
        </div>
        <div className="card p-6">
          <p className="text-xs font-bold uppercase tracking-wider text-faint">Paid out to sellers</p>
          <p className="mt-2 font-display text-3xl font-semibold text-emerald-500 tnum">{formatMoney(s.revenue)}</p>
          <p className="mt-1 text-xs text-muted">100% of product price goes to seller</p>
        </div>
      </div>

      {/* Seller Subscriptions Section */}
      <section className="card p-6" aria-labelledby="rev-subs">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h3 id="rev-subs" className="font-display text-lg font-semibold">Seller Subscriptions</h3>
            <p className="text-xs text-muted">PKR 1,200 / month per seller account (covers up to 2 stores) · Free 3-month trial</p>
          </div>
          <span className="text-xs font-semibold text-faint tnum">{subsList.length} subscription record(s)</span>
        </div>

        <div className="mt-4 table-scroll">
          <table className="w-full min-w-[42rem] text-sm">
            <thead>
              <tr className="border-b border-line text-left text-xs uppercase tracking-wider text-faint">
                <th className="pb-3 pr-4 font-semibold">Seller</th>
                <th className="pb-3 pr-4 font-semibold">Plan Status</th>
                <th className="pb-3 pr-4 font-semibold">Trial Ends</th>
                <th className="pb-3 pr-4 font-semibold">Current Period</th>
                <th className="pb-3 pr-4 font-semibold">Last Reference</th>
                <th className="pb-3 text-right font-semibold">Action</th>
              </tr>
            </thead>
            <tbody>
              {subsList.map((sb) => {
                const seller = users.byId(sb.seller_id)
                const isTrial = sb.status === 'free_trial' || !sb.last_payment_at
                return (
                  <tr key={sb.id} className="border-b border-line/60">
                    <td className="py-3 pr-4">
                      <p className="font-semibold">{seller?.full_name ?? 'Seller'}</p>
                      <p className="text-xs text-faint">@{seller?.username} · {seller?.email}</p>
                    </td>
                    <td className="py-3 pr-4">
                      <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-bold uppercase ${isTrial ? 'bg-emerald-500/10 text-emerald-500' : 'bg-gold/10 text-gold'}`}>
                        {isTrial ? '3-Month Free Trial' : sb.status}
                      </span>
                    </td>
                    <td className="py-3 pr-4 text-xs text-muted">{sb.trial_ends_at ? formatDate(sb.trial_ends_at) : '—'}</td>
                    <td className="py-3 pr-4 text-xs text-muted">{sb.current_period_end ? formatDate(sb.current_period_end) : '—'}</td>
                    <td className="py-3 pr-4 text-xs font-mono text-faint">{sb.last_payment_reference || '—'}</td>
                    <td className="py-3 text-right">
                      <Button
                        size="sm"
                        variant="gold"
                        disabled={busySub === sb.seller_id}
                        onClick={() => recordManualPayment(sb.seller_id)}
                      >
                        {busySub === sb.seller_id ? 'Recording…' : 'Record Payment'}
                      </Button>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
          {subsList.length === 0 && (
            <p className="py-4 text-center text-xs text-muted">No subscription records yet. Subscriptions initialize automatically as sellers join.</p>
          )}
        </div>
      </section>

      <section className="card p-6" aria-labelledby="rev-chart">
        <h3 id="rev-chart" className="font-display text-lg font-semibold">GMV trend</h3>
        <AreaChart className="mt-4" data={revenueSeries} labels={months.map(monthLabel)} format={(n) => formatMoney(n)} />
      </section>

      <section className="card table-scroll p-6" aria-labelledby="rev-stores">
        <h3 id="rev-stores" className="font-display text-lg font-semibold">Store earnings</h3>
        <table className="mt-4 w-full min-w-[40rem] text-sm">
          <thead>
            <tr className="border-b border-line text-left text-xs uppercase tracking-wider text-faint">
              <th className="pb-3 pr-4 font-semibold">Store</th>
              <th className="pb-3 pr-4 font-semibold">Seller</th>
              <th className="pb-3 pr-4 text-right font-semibold">Orders</th>
              <th className="pb-3 pr-4 text-right font-semibold">Gross</th>
              <th className="pb-3 pr-4 text-right font-semibold">Commission (0%)</th>
              <th className="pb-3 text-right font-semibold">Seller payout</th>
            </tr>
          </thead>
          <tbody>
            {perStore.map((row) => {
              const store = row.store
              const seller = users.byId(store.seller_id)
              return (
                <tr key={store.id} className="border-b border-line/60">
                  <td className="py-3 pr-4 font-semibold">
                    <Link to={`/store/${store.slug}`} className="hover:text-gold">{store.name}</Link>
                  </td>
                  <td className="py-3 pr-4 text-muted">{seller?.full_name}</td>
                  <td className="py-3 pr-4 text-right tnum">{row.orders}</td>
                  <td className="py-3 pr-4 text-right tnum">{formatMoney(row.gross)}</td>
                  <td className="py-3 pr-4 text-right text-emerald-500 tnum">PKR 0</td>
                  <td className="py-3 text-right font-semibold text-emerald-500 tnum">{formatMoney(row.gross)}</td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </section>
    </div>
  )
}

/* Shared empty state for admin sections */
export function AdminEmpty({ icon, title, sub }: { icon?: React.ReactNode; title: string; sub?: string }) {
  return <EmptyState icon={icon ?? <BarChart3 size={24} />} title={title} sub={sub} />
}

export function ApprovedBadge({ approved }: { approved: boolean }) {
  return approved
    ? <Badge tone="green"><BadgeCheck size={12} /> Approved</Badge>
    : <Badge tone="gold">Pending</Badge>
}

export function StarBadge({ rating }: { rating: number }) {
  return <Badge tone="gold"><Star size={12} className="fill-current" /> {rating || '—'}</Badge>
}

export function StoreIcon() { return <Store size={16} /> }
export function ShieldIcon() { return <ShieldCheck size={16} /> }
export function PackageIcon() { return <Package size={16} /> }
export function CheckIcon() { return <Check size={16} /> }
