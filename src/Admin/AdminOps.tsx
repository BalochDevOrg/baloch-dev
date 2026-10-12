import { Fragment, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Building2, CheckCircle, CreditCard, Download, Edit3, Eye, EyeOff, FileBarChart, Plus, Smartphone, Trash2, XCircle } from 'lucide-react'
import { Badge, Button, EmptyState, StarRating, Toggle } from '@/components/ui'
import { OrderBadge, OrderHistoryList } from '@/components/shared/OrderBits'
import { ensureAdminData, messaging, notifications as notifApi, orders, platformAccounts, reports, reviews as reviewsApi, settings, stats, stores, users } from '@/lib/db'
import { useDb } from '@/lib/providers'
import { ADMIN_NEXT, cn, formatDate, formatMoney, normalizeOrderStatus, ORDER_STATUS_LABEL, paymentMethodLabel, timeAgo } from '@/lib/util'
import type { BankAccount, CanonicalOrderStatus, PaymentAccountsConfig, WalletAccount, WalletProviderId } from '@/lib/types'

const ADMIN_FILTERS: Array<{ id: 'all' | CanonicalOrderStatus; label: string }> = [
  { id: 'all', label: 'All' },
  { id: 'submitted', label: 'Submitted' },
  { id: 'packaging', label: 'Packaging' },
  { id: 'packed', label: 'Packed' },
  { id: 'sent_to_platform', label: 'Sent to Platform' },
  { id: 'on_way', label: 'On Way' },
  { id: 'reached_to_buyer', label: 'Reached to Buyer' },
]

export function AdminOrders() {
  useDb()
  const [openId, setOpenId] = useState<string | null>(null)
  const [filter, setFilter] = useState<(typeof ADMIN_FILTERS)[number]['id']>('all')
  const [busy, setBusy] = useState<string | null>(null)
  useEffect(() => { void ensureAdminData() }, [])
  const list = orders.listAll().filter((o) => filter === 'all' || normalizeOrderStatus(o.status) === filter)

  const advance = async (orderId: string, to: CanonicalOrderStatus) => {
    setBusy(orderId)
    try { await orders.advance(orderId, to) }
    catch (e: any) { console.error(e); alert(e?.message ?? 'Could not update order status.') }
    finally { setBusy(null) }
  }

  const confirmPayment = async (orderId: string) => {
    setBusy(orderId)
    try { await orders.confirmPayment(orderId) }
    catch (e: any) { console.error(e); alert(e?.message ?? 'Could not verify payment.') }
    finally { setBusy(null) }
  }

  const rejectPayment = async (orderId: string) => {
    const reason = prompt('Reason for payment rejection (optional):') ?? undefined
    setBusy(orderId)
    try { await orders.rejectPayment(orderId, reason) }
    catch (e: any) { console.error(e); alert(e?.message ?? 'Could not reject payment.') }
    finally { setBusy(null) }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">
        {ADMIN_FILTERS.map((f) => (
          <button
            key={f.id}
            type="button"
            onClick={() => setFilter(f.id)}
            className={`rounded-full border px-3 py-1.5 text-xs font-semibold ${filter === f.id ? 'border-gold bg-gold/15 text-fg' : 'border-line text-muted hover:border-gold/40'}`}
          >
            {f.label}
          </button>
        ))}
      </div>
      <div className="card overflow-hidden">
        <div className="table-scroll">
          <table className="w-full min-w-[46rem] text-sm">
            <thead>
              <tr className="border-b border-line text-left text-xs uppercase tracking-wider text-faint">
                <th className="p-4 font-semibold">Order</th>
                <th className="p-4 font-semibold">Buyer</th>
                <th className="p-4 font-semibold">Seller / Store</th>
                <th className="p-4 font-semibold">Date</th>
                <th className="p-4 text-right font-semibold">Total</th>
                <th className="p-4 text-right font-semibold">Fee</th>
                <th className="p-4 text-right font-semibold">Status</th>
              </tr>
            </thead>
            <tbody>
              {list.map((o) => {
                const store = o.items[0] ? stores.byId(o.items[0].store_id) : undefined
                const seller = store ? users.byId(store.seller_id) : undefined
                const next = ADMIN_NEXT[normalizeOrderStatus(o.status)]
                const addr = o.address
                return (
                  <Fragment key={o.id}>
                    <tr className="cursor-pointer border-b border-line/60 transition hover:bg-surface-2" onClick={() => setOpenId(openId === o.id ? null : o.id)}>
                      <td className="p-4 font-semibold">{o.code}</td>
                      <td className="p-4 text-muted">{o.buyer_name}</td>
                      <td className="p-4 text-muted">{store?.name ?? '—'}{seller ? ` · ${seller.full_name}` : ''}</td>
                      <td className="p-4 text-muted">{formatDate(o.created_at)}</td>
                      <td className="p-4 text-right tnum">{formatMoney(o.total)}</td>
                      <td className="p-4 text-right text-gold tnum">{formatMoney(o.commission)}</td>
                      <td className="p-4 text-right"><OrderBadge status={o.status} /></td>
                    </tr>
                    {openId === o.id && (
                      <tr className="border-b border-line/60 bg-surface-2/60">
                        <td colSpan={7} className="p-5">
                          <p className="text-xs text-muted">Shipping: {addr?.full_name} · {addr?.line1}, {addr?.city}, {addr?.state} · {addr?.phone}{addr?.email ? ` · ${addr.email}` : ''}</p>
                          <p className="mt-1 text-xs text-muted">Payment: {paymentMethodLabel(o.payment_method)} · {o.payment} · Current: {ORDER_STATUS_LABEL[normalizeOrderStatus(o.status)]}</p>
                          <ul className="mt-3 space-y-1.5">
                            {o.items.map((i) => (
                              <li key={i.id} className="flex items-center gap-3 text-xs">
                                <span className="h-8 w-8 overflow-hidden rounded-lg bg-surface">
                                  {i.image ? <img src={i.image} alt="" className="h-full w-full object-cover" /> : null}
                                </span>
                                <Link to={`/product/${i.product_id}`} className="min-w-0 flex-1 truncate font-medium hover:text-gold">{i.name}</Link>
                                <span className="text-faint tnum">×{i.qty}</span>
                                <span className="tnum">{formatMoney(i.price * i.qty)}</span>
                                <OrderBadge status={i.status} />
                              </li>
                            ))}
                          </ul>
                          <div className="mt-4">
                            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-faint">Order history</p>
                            <OrderHistoryList history={orders.history(o.id)} />
                          </div>
                          <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-line/60 pt-3">
                            <div className="flex flex-wrap items-center gap-2">
                              <span className="text-xs font-semibold text-faint">Payment:</span>
                              {o.payment === 'paid' ? (
                                <span className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-500">
                                  <CheckCircle size={13} /> Paid &amp; Verified
                                </span>
                              ) : (
                                <div className="flex flex-wrap items-center gap-2">
                                  <Badge tone="gold" className="text-xs">Pending Verification</Badge>
                                  <Button size="sm" variant="gold" disabled={busy === o.id} onClick={(e) => { e.stopPropagation(); void confirmPayment(o.id) }}>
                                    <CheckCircle size={13} className="mr-1" />
                                    {busy === o.id ? 'Updating…' : 'Verify & Mark Paid'}
                                  </Button>
                                  <button
                                    disabled={busy === o.id}
                                    onClick={(e) => { e.stopPropagation(); void rejectPayment(o.id) }}
                                    className="inline-flex items-center gap-1 rounded-lg border border-line px-2.5 py-1 text-xs font-medium text-rose-500 hover:bg-rose-500/10"
                                  >
                                    Reject Payment
                                  </button>
                                </div>
                              )}
                            </div>
                            <div className="flex flex-wrap gap-2">
                              {next && (
                                <Button size="sm" variant="primary" disabled={busy === o.id} onClick={(e) => { e.stopPropagation(); void advance(o.id, next.to) }}>
                                  {busy === o.id ? 'Updating…' : next.label}
                                </Button>
                              )}
                              {!['reached_to_buyer', 'cancelled'].includes(normalizeOrderStatus(o.status)) && (
                                <button onClick={(e) => { e.stopPropagation(); if (confirm(`Cancel order ${o.code}?`)) orders.cancel(o.id) }}
                                  className="inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold text-rose-500 hover:bg-rose-500/10">
                                  <XCircle size={13} /> Force cancel & refund
                                </button>
                              )}
                            </div>
                          </div>
                        </td>
                      </tr>
                    )}
                  </Fragment>
                )
              })}
            </tbody>
          </table>
        </div>
        {list.length === 0 && <p className="p-8 text-center text-sm text-muted">No orders.</p>}
      </div>
    </div>
  )
}

/* ── Reviews moderation ───────────────────────────────────────── */
export function AdminReviews() {
  useDb()
  const list = reviewsApi.listAll()
  return (
    <div className="space-y-4">
      <p className="text-sm text-muted tnum">{list.length} review{list.length === 1 ? '' : 's'} · {list.filter((r) => !r.is_approved).length} hidden</p>
      <ul className="space-y-4">
        {list.map((r) => (
          <li key={r.id} className={`card p-5 ${!r.is_approved ? 'border-amber-500/40' : ''}`}>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <Link to={`/product/${r.product_id}`} className="text-sm font-semibold hover:text-gold">Product {r.product_id}</Link>
              <div className="flex items-center gap-3">
                <StarRating rating={r.rating} size={13} />
                <button
                  onClick={() => reviewsApi.setApproved(r.id, !r.is_approved)}
                  className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition ${r.is_approved ? 'text-amber-600 hover:bg-amber-500/10 dark:text-amber-400' : 'text-emerald-500 hover:bg-emerald-500/10'}`}
                >
                  {r.is_approved ? <><EyeOff size={13} /> Hide</> : <><Eye size={13} /> Approve</>}
                </button>
              </div>
            </div>
            <p className="mt-2.5 text-sm leading-relaxed text-muted">{r.comment}</p>
            <p className="mt-2 text-xs text-faint">
              {r.buyer_name} · {timeAgo(r.created_at)} ·{' '}
              {r.is_approved ? <Badge tone="green" className="ml-1">visible</Badge> : <Badge tone="gold" className="ml-1">hidden</Badge>}
            </p>
          </li>
        ))}
      </ul>
    </div>
  )
}

/* ── Messages monitor ─────────────────────────────────────────── */
export function AdminMessages() {
  useDb()
  const convs = messaging.listAll()
  return (
    <div className="space-y-4">
      <p className="text-sm text-muted">All buyer ↔ seller conversations — read-only moderation view.</p>
      {convs.length === 0 && <EmptyState title="No conversations yet" />}
      <ul className="space-y-3">
        {convs.map((c) => {
          const last = messaging.lastMessage(c.id)
          return (
            <li key={c.id} className="card p-4">
              <div className="flex flex-wrap items-center gap-3">
                <span className="text-sm font-semibold">{c.buyer_name}</span>
                <span className="text-faint">↔</span>
                <span className="text-sm font-semibold">{c.seller_name}</span>
                {c.product_id && <Link to={`/product/${c.product_id}`} className="rounded-md bg-surface-2 px-2 py-0.5 text-xs text-faint">product {c.product_id}</Link>}
                <span className="ml-auto text-xs text-faint">{timeAgo(c.last_at)}</span>
              </div>
              {last && <p className="mt-2 line-clamp-2 text-sm text-muted">“{last.body}” — {users.byId(last.sender_id)?.full_name ?? ''}</p>}
              <p className="mt-1.5 text-xs text-faint tnum">
                {messaging.messages(c.id).length} messages · unread: buyer {c.buyer_unread} / seller {c.seller_unread}
              </p>
            </li>
          )
        })}
      </ul>
    </div>
  )
}

/* ── Reports ──────────────────────────────────────────────────── */
export function AdminReports() {
  useDb()
  const list = reports.list()
  const s = stats.admin()

  const exportCsv = () => {
    const rows = [
      ['Metric', 'Value'],
      ['Total users', String(s.users)],
      ['Buyers', String(s.buyers)],
      ['Sellers', String(s.sellers)],
      ['Products', String(s.products)],
      ['Categories', String(s.categories)],
      ['Orders', String(s.orders)],
      ['GMV (PKR)', String(Math.round(s.revenue))],
      ['Commission (PKR)', String(Math.round(s.commission))],
      ['Reviews', String(s.reviews)],
      ['Average rating', String(s.avgRating)],
    ]
    const csv = rows.map((r) => r.map((x) => `"${x}"`).join(',')).join('\n')
    const blob = new Blob([csv], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `baloch-export-hub-report-${new Date().toISOString().slice(0, 10)}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div className="space-y-6">
      <div className="card flex flex-wrap items-center justify-between gap-4 p-5">
        <p className="text-sm text-muted">Generate live reports from current platform data, or export a CSV snapshot.</p>
        <div className="flex flex-wrap gap-2.5">
          <Button size="sm" variant="primary" onClick={() => reports.create('sales')}><FileBarChart size={14} /> Sales report</Button>
          <Button size="sm" variant="ghost" onClick={() => reports.create('users')}>Users report</Button>
          <Button size="sm" variant="ghost" onClick={() => reports.create('products')}>Products report</Button>
          <Button size="sm" variant="ghost" onClick={() => reports.create('reviews')}>Reviews report</Button>
          <Button size="sm" variant="gold" onClick={exportCsv}><Download size={14} /> Export CSV</Button>
        </div>
      </div>

      <ul className="space-y-4">
        {list.map((r) => (
          <li key={r.id} className="card p-5">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h3 className="font-display text-lg font-semibold">{r.title}</h3>
              <span className="text-xs text-faint">{r.range} · {formatDate(r.created_at, true)}</span>
            </div>
            <p className="mt-2 text-sm leading-relaxed text-muted">{r.summary}</p>
          </li>
        ))}
      </ul>
    </div>
  )
}

/* ── Platform notifications log ───────────────────────────────── */
export function AdminNotifications() {
  useDb()
  const recent = notifApi.listAll()
  return (
    <div className="max-w-3xl space-y-4">
      <p className="text-sm text-muted">Most recent platform notifications across all users.</p>
      <ul className="space-y-3">
        {recent.slice(0, 25).map((n) => (
          <li key={n.id} className="card flex items-start gap-3.5 p-4">
            <span className={`mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full ${n.read ? 'bg-line' : 'bg-gold'}`} aria-hidden />
            <div className="min-w-0">
              <p className="text-sm font-semibold">{n.title}</p>
              <p className="mt-0.5 text-sm text-muted">{n.body}</p>
              <p className="mt-1 text-[0.68rem] text-faint">→ {users.byId(n.user_id)?.full_name ?? n.user_id} · {timeAgo(n.created_at)}</p>
            </div>
          </li>
        ))}
      </ul>
    </div>
  )
}

/* ── Platform Payment Accounts Manager (Admin -> Sellers) ──────── */
export function AdminPlatformAccountsManager() {
  const [config, setConfig] = useState<PaymentAccountsConfig>(platformAccounts.get())
  const [modalType, setModalType] = useState<'add-wallet' | 'add-bank' | 'edit-wallet' | 'edit-bank' | null>(null)
  const [saved, setSaved] = useState(false)
  const [walletForm, setWalletForm] = useState<WalletAccount>({
    id: '', provider: 'easypaisa', provider_name: 'Easypaisa', account_title: 'Baloch Export Hub', account_number: '', instructions: 'Send platform fee and submit TID.', is_active: true,
  })
  const [bankForm, setBankForm] = useState<BankAccount>({
    id: '', bank_name: 'Meezan Bank', account_title: 'Baloch Export Hub', account_number: '', iban: '', branch: 'Quetta Main Branch', instructions: 'Transfer fee via Online Banking and submit TID.', is_active: true,
  })

  const saveConfig = async (next: PaymentAccountsConfig) => {
    setConfig(next)
    await platformAccounts.save(next)
    setSaved(true)
    setTimeout(() => setSaved(false), 3000)
  }

  const toggleWalletActive = async (id: string) => {
    const updated = {
      ...config,
      wallets: config.wallets.map((w) => w.id === id ? { ...w, is_active: !w.is_active } : w),
    }
    await saveConfig(updated)
  }

  const toggleBankActive = async (id: string) => {
    const updated = {
      ...config,
      banks: config.banks.map((b) => b.id === id ? { ...b, is_active: !b.is_active } : b),
    }
    await saveConfig(updated)
  }

  const deleteWallet = async (id: string) => {
    if (!confirm('Delete this platform wallet account?')) return
    const updated = { ...config, wallets: config.wallets.filter((w) => w.id !== id) }
    await saveConfig(updated)
  }

  const deleteBank = async (id: string) => {
    if (!confirm('Delete this platform bank account?')) return
    const updated = { ...config, banks: config.banks.filter((b) => b.id !== id) }
    await saveConfig(updated)
  }

  const openAddWallet = () => {
    setWalletForm({
      id: '',
      provider: 'easypaisa',
      provider_name: 'Easypaisa',
      account_title: 'Baloch Export Hub',
      account_number: '',
      instructions: 'Transfer registration / subscription fee and submit TID.',
      is_active: true,
    })
    setModalType('add-wallet')
  }

  const openAddBank = () => {
    setBankForm({
      id: '',
      bank_name: 'Meezan Bank',
      account_title: 'Baloch Export Hub',
      account_number: '',
      iban: '',
      branch: 'Quetta Main Branch',
      instructions: 'Transfer subscription renewal fee via Online Banking and submit TID.',
      is_active: true,
    })
    setModalType('add-bank')
  }

  const openEditWallet = (w: WalletAccount) => {
    setWalletForm(w)
    setModalType('edit-wallet')
  }

  const openEditBank = (b: BankAccount) => {
    setBankForm(b)
    setModalType('edit-bank')
  }

  const handleWalletSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    let nextWallets = [...config.wallets]
    if (modalType === 'edit-wallet') {
      nextWallets = nextWallets.map((w) => w.id === walletForm.id ? walletForm : w)
    } else {
      nextWallets.push({ ...walletForm, id: `pw-${Date.now()}` })
    }
    await saveConfig({ ...config, wallets: nextWallets })
    setModalType(null)
  }

  const handleBankSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    let nextBanks = [...config.banks]
    if (modalType === 'edit-bank') {
      nextBanks = nextBanks.map((b) => b.id === bankForm.id ? bankForm : b)
    } else {
      nextBanks.push({ ...bankForm, id: `pb-${Date.now()}` })
    }
    await saveConfig({ ...config, banks: nextBanks })
    setModalType(null)
  }

  return (
    <section className="card space-y-5 p-6" aria-labelledby="asp-platform-payments">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <h3 id="asp-platform-payments" className="font-display text-lg font-semibold flex items-center gap-2">
              <CreditCard size={18} className="text-terracotta" /> Platform Owner Payment Accounts
            </h3>
            {saved && (
              <span className="rounded-full bg-emerald-500/10 border border-emerald-500/20 px-2.5 py-0.5 text-xs font-bold text-emerald-600">
                Saved ✓
              </span>
            )}
          </div>
          <p className="text-xs text-muted mt-0.5">
            Accounts displayed on seller dashboards for paying registration fees and monthly subscriptions (PKR 1,200/mo).
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={openAddWallet}
            className="inline-flex items-center gap-1 rounded-full border border-line bg-surface hover:border-terracotta px-3 py-1 text-xs font-bold transition shadow-2xs"
          >
            <Plus size={13} className="text-terracotta" /> Add Wallet
          </button>
          <button
            type="button"
            onClick={openAddBank}
            className="inline-flex items-center gap-1 rounded-full bg-brand text-onbrand hover:opacity-95 px-3 py-1 text-xs font-bold transition shadow-2xs"
          >
            <Plus size={13} /> Add Bank
          </button>
        </div>
      </div>

      {/* Wallets */}
      <div className="space-y-3 pt-1">
        <div className="flex items-center justify-between border-b border-line pb-1.5">
          <span className="text-xs font-bold uppercase tracking-wider text-muted flex items-center gap-1.5">
            <Smartphone size={13} className="text-terracotta" /> Platform Wallets ({config.wallets.length})
          </span>
          <span className="text-[0.68rem] text-faint">Easypaisa, JazzCash, SadaPay, NayaPay</span>
        </div>

        {config.wallets.length === 0 ? (
          <p className="text-xs text-muted py-1">No platform wallets configured.</p>
        ) : (
          <div className="grid gap-2.5 sm:grid-cols-2">
            {config.wallets.map((w) => (
              <div key={w.id} className="rounded-2xl border border-line bg-surface-2/40 p-3.5 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="font-display font-bold text-sm text-brand dark:text-fg">{w.provider_name}</span>
                  <span className={cn(
                    'rounded-full px-2 py-0.5 text-[0.62rem] font-bold border',
                    w.is_active ? 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20' : 'bg-surface text-faint border-line'
                  )}>
                    {w.is_active ? 'Active' : 'Inactive'}
                  </span>
                </div>
                <div className="text-xs space-y-0.5 font-mono">
                  <p className="text-muted"><span className="text-faint font-sans">Title:</span> {w.account_title}</p>
                  <p className="text-terracotta font-bold"><span className="text-faint font-sans font-normal">Number:</span> {w.account_number}</p>
                </div>
                {w.instructions && <p className="text-[0.7rem] text-faint line-clamp-1">{w.instructions}</p>}
                <div className="flex items-center justify-between border-t border-line/60 pt-2 text-xs">
                  <div className="flex items-center gap-2">
                    <button type="button" onClick={() => openEditWallet(w)} className="text-brand dark:text-gold hover:underline font-bold inline-flex items-center gap-1">
                      <Edit3 size={11} /> Edit
                    </button>
                    <span className="text-line">•</span>
                    <button type="button" onClick={() => deleteWallet(w.id)} className="text-rose-500 hover:underline font-bold inline-flex items-center gap-1">
                      <Trash2 size={11} /> Delete
                    </button>
                  </div>
                  <button type="button" onClick={() => toggleWalletActive(w.id)} className="text-[0.7rem] text-muted hover:text-fg font-semibold">
                    {w.is_active ? 'Deactivate' : 'Activate'}
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Commercial Banks */}
      <div className="space-y-3 pt-2">
        <div className="flex items-center justify-between border-b border-line pb-1.5">
          <span className="text-xs font-bold uppercase tracking-wider text-muted flex items-center gap-1.5">
            <Building2 size={13} className="text-brand" /> Platform Commercial Banks ({config.banks.length})
          </span>
          <span className="text-[0.68rem] text-faint">Meezan, HBL, Allied, etc.</span>
        </div>

        {config.banks.length === 0 ? (
          <p className="text-xs text-muted py-1">No platform bank accounts configured.</p>
        ) : (
          <div className="grid gap-2.5 sm:grid-cols-2">
            {config.banks.map((b) => (
              <div key={b.id} className="rounded-2xl border border-line bg-surface-2/40 p-3.5 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="font-display font-bold text-sm text-brand dark:text-fg">{b.bank_name}</span>
                  <span className={cn(
                    'rounded-full px-2 py-0.5 text-[0.62rem] font-bold border',
                    b.is_active ? 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20' : 'bg-surface text-faint border-line'
                  )}>
                    {b.is_active ? 'Active' : 'Inactive'}
                  </span>
                </div>
                <div className="text-xs space-y-0.5 font-mono">
                  <p className="text-muted"><span className="text-faint font-sans">Title:</span> {b.account_title}</p>
                  <p className="text-brand dark:text-fg font-bold truncate"><span className="text-faint font-sans font-normal">IBAN/Acc:</span> {b.iban || b.account_number}</p>
                  {b.branch && <p className="text-[0.7rem] text-faint font-sans">Branch: {b.branch}</p>}
                </div>
                <div className="flex items-center justify-between border-t border-line/60 pt-2 text-xs">
                  <div className="flex items-center gap-2">
                    <button type="button" onClick={() => openEditBank(b)} className="text-brand dark:text-gold hover:underline font-bold inline-flex items-center gap-1">
                      <Edit3 size={11} /> Edit
                    </button>
                    <span className="text-line">•</span>
                    <button type="button" onClick={() => deleteBank(b.id)} className="text-rose-500 hover:underline font-bold inline-flex items-center gap-1">
                      <Trash2 size={11} /> Delete
                    </button>
                  </div>
                  <button type="button" onClick={() => toggleBankActive(b.id)} className="text-[0.7rem] text-muted hover:text-fg font-semibold">
                    {b.is_active ? 'Deactivate' : 'Activate'}
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Modal: Add/Edit Wallet */}
      {(modalType === 'add-wallet' || modalType === 'edit-wallet') && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4">
          <div className="card w-full max-w-md p-6 space-y-4 animate-fade-in shadow-xl">
            <div className="flex items-center justify-between border-b border-line pb-2.5">
              <h4 className="font-display text-base font-bold text-brand dark:text-fg">
                {modalType === 'add-wallet' ? 'Add Platform Wallet Account' : 'Edit Platform Wallet'}
              </h4>
              <button type="button" onClick={() => setModalType(null)} className="text-muted hover:text-fg">✕</button>
            </div>
            <form onSubmit={handleWalletSubmit} className="space-y-3 text-xs">
              <div>
                <label className="mb-1 block font-semibold text-fg">Wallet Provider</label>
                <select
                  className="field text-xs"
                  value={walletForm.provider}
                  onChange={(e) => {
                    const prov = e.target.value as WalletProviderId
                    const nameMap: Record<string, string> = {
                      easypaisa: 'Easypaisa',
                      jazzcash: 'JazzCash',
                      sadapay: 'SadaPay',
                      nayapay: 'NayaPay',
                      upaisa: 'UPaisa',
                      other: 'Mobile Wallet',
                    }
                    setWalletForm({
                      ...walletForm,
                      provider: prov,
                      provider_name: nameMap[prov] || 'Wallet',
                    })
                  }}
                >
                  <option value="easypaisa">Easypaisa</option>
                  <option value="jazzcash">JazzCash</option>
                  <option value="sadapay">SadaPay</option>
                  <option value="nayapay">NayaPay</option>
                  <option value="upaisa">UPaisa</option>
                  <option value="other">Other</option>
                </select>
              </div>

              <div>
                <label className="mb-1 block font-semibold text-fg">Provider Name</label>
                <input
                  className="field text-xs"
                  value={walletForm.provider_name}
                  onChange={(e) => setWalletForm({ ...walletForm, provider_name: e.target.value })}
                  placeholder="e.g. Easypaisa"
                  required
                />
              </div>

              <div>
                <label className="mb-1 block font-semibold text-fg">Account Title</label>
                <input
                  className="field text-xs"
                  value={walletForm.account_title}
                  onChange={(e) => setWalletForm({ ...walletForm, account_title: e.target.value })}
                  placeholder="Baloch Export Hub"
                  required
                />
              </div>

              <div>
                <label className="mb-1 block font-semibold text-fg">Mobile / Account Number</label>
                <input
                  className="field text-xs font-mono"
                  value={walletForm.account_number}
                  onChange={(e) => setWalletForm({ ...walletForm, account_number: e.target.value })}
                  placeholder="03332826358"
                  required
                />
              </div>

              <div>
                <label className="mb-1 block font-semibold text-fg">Instructions for Sellers</label>
                <input
                  className="field text-xs"
                  value={walletForm.instructions || ''}
                  onChange={(e) => setWalletForm({ ...walletForm, instructions: e.target.value })}
                  placeholder="Transfer PKR 1,200 and submit TID."
                />
              </div>

              <div className="flex items-center gap-2 pt-1">
                <input
                  type="checkbox"
                  id="p-wallet-chk"
                  checked={walletForm.is_active}
                  onChange={(e) => setWalletForm({ ...walletForm, is_active: e.target.checked })}
                />
                <label htmlFor="p-wallet-chk" className="font-semibold text-fg cursor-pointer">
                  Active (visible on seller dashboards)
                </label>
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-line">
                <Button size="sm" variant="ghost" type="button" onClick={() => setModalType(null)}>Cancel</Button>
                <button type="submit" className="rounded-full bg-brand text-onbrand px-4 py-1.5 font-bold hover:opacity-95">
                  Save Platform Wallet
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Add/Edit Bank */}
      {(modalType === 'add-bank' || modalType === 'edit-bank') && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4">
          <div className="card w-full max-w-md p-6 space-y-4 animate-fade-in shadow-xl">
            <div className="flex items-center justify-between border-b border-line pb-2.5">
              <h4 className="font-display text-base font-bold text-brand dark:text-fg">
                {modalType === 'add-bank' ? 'Add Platform Commercial Bank' : 'Edit Platform Bank'}
              </h4>
              <button type="button" onClick={() => setModalType(null)} className="text-muted hover:text-fg">✕</button>
            </div>
            <form onSubmit={handleBankSubmit} className="space-y-3 text-xs">
              <div>
                <label className="mb-1 block font-semibold text-fg">Bank Name</label>
                <input
                  className="field text-xs"
                  value={bankForm.bank_name}
                  onChange={(e) => setBankForm({ ...bankForm, bank_name: e.target.value })}
                  placeholder="Meezan Bank"
                  required
                />
              </div>

              <div>
                <label className="mb-1 block font-semibold text-fg">Account Title</label>
                <input
                  className="field text-xs"
                  value={bankForm.account_title}
                  onChange={(e) => setBankForm({ ...bankForm, account_title: e.target.value })}
                  placeholder="Baloch Export Hub"
                  required
                />
              </div>

              <div className="grid gap-2 sm:grid-cols-2">
                <div>
                  <label className="mb-1 block font-semibold text-fg">Account Number</label>
                  <input
                    className="field text-xs font-mono"
                    value={bankForm.account_number}
                    onChange={(e) => setBankForm({ ...bankForm, account_number: e.target.value })}
                    placeholder="0201010892341"
                    required
                  />
                </div>
                <div>
                  <label className="mb-1 block font-semibold text-fg">Branch (optional)</label>
                  <input
                    className="field text-xs"
                    value={bankForm.branch || ''}
                    onChange={(e) => setBankForm({ ...bankForm, branch: e.target.value })}
                    placeholder="Quetta Main Branch"
                  />
                </div>
              </div>

              <div>
                <label className="mb-1 block font-semibold text-fg">IBAN</label>
                <input
                  className="field text-xs font-mono"
                  value={bankForm.iban || ''}
                  onChange={(e) => setBankForm({ ...bankForm, iban: e.target.value })}
                  placeholder="PK42MEZN000201010892341"
                />
              </div>

              <div>
                <label className="mb-1 block font-semibold text-fg">Instructions for Sellers</label>
                <input
                  className="field text-xs"
                  value={bankForm.instructions || ''}
                  onChange={(e) => setBankForm({ ...bankForm, instructions: e.target.value })}
                  placeholder="Transfer fee via ATM / Online Banking and submit TID."
                />
              </div>

              <div className="flex items-center gap-2 pt-1">
                <input
                  type="checkbox"
                  id="p-bank-chk"
                  checked={bankForm.is_active}
                  onChange={(e) => setBankForm({ ...bankForm, is_active: e.target.checked })}
                />
                <label htmlFor="p-bank-chk" className="font-semibold text-fg cursor-pointer">
                  Active (visible on seller dashboards)
                </label>
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-line">
                <Button size="sm" variant="ghost" type="button" onClick={() => setModalType(null)}>Cancel</Button>
                <button type="submit" className="rounded-full bg-brand text-onbrand px-4 py-1.5 font-bold hover:opacity-95">
                  Save Platform Bank
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </section>
  )
}

/* ── Settings ─────────────────────────────────────────────────── */
export function AdminSettings() {
  useDb()
  const s = settings.get()
  return (
    <div className="max-w-3xl space-y-6">
      {/* Platform Owner Payment Accounts Section */}
      <AdminPlatformAccountsManager />

      <section className="card space-y-5 p-6" aria-labelledby="asp-commerce">
        <h3 id="asp-commerce" className="font-display text-lg font-semibold">Commerce</h3>
        <div className="grid gap-5 sm:grid-cols-2">
          <label className="block">
            <span className="mb-1.5 block text-[0.8rem] font-semibold text-muted">Platform commission (%)</span>
            <input
              id="setting-commission"
              name="commission_rate"
              type="number" min={0} max={30} className="field"
              value={s.commission_rate}
              onChange={(e) => settings.update({ commission_rate: Math.max(0, Math.min(30, Number(e.target.value))) })}
            />
            <span className="mt-1 block text-xs text-faint">Displayed transparently to sellers (default 8%).</span>
          </label>
          <label className="block">
            <span className="mb-1.5 block text-[0.8rem] font-semibold text-muted">Platform name</span>
            <input id="setting-platform-name" name="platform_name" className="field" value={s.platform_name} onChange={(e) => settings.update({ platform_name: e.target.value })} />
          </label>
        </div>
      </section>

      <section className="card space-y-5 p-6" aria-labelledby="asp-policy">
        <h3 id="asp-policy" className="font-display text-lg font-semibold">Policies</h3>
        {[
          { key: 'maintenance' as const, label: 'Maintenance mode', sub: 'Show a maintenance notice', value: s.maintenance },
          { key: 'allow_registrations' as const, label: 'Open registrations', sub: 'Allow new account signups', value: s.allow_registrations },
          { key: 'auto_approve_stores' as const, label: 'Auto-approve stores', sub: 'Skip manual store review', value: s.auto_approve_stores },
        ].map((row) => (
          <div key={row.key} className="flex items-center justify-between gap-4">
            <div>
              <p className="text-sm font-semibold">{row.label}</p>
              <p className="text-xs text-muted">{row.sub}</p>
            </div>
            <Toggle checked={row.value} onChange={(v) => settings.update({ [row.key]: v })} label={row.label} />
          </div>
        ))}
      </section>

      <section className="card p-6" aria-labelledby="asp-summary">
        <h3 id="asp-summary" className="font-display text-lg font-semibold">Platform snapshot</h3>
        <ul className="mt-3 space-y-2 text-sm">
          <li className="flex justify-between"><span className="text-muted">Users</span><strong className="tnum">{users.list().length} · {users.list().filter((u) => u.role === 'seller').length} sellers</strong></li>
          <li className="flex justify-between"><span className="text-muted">Commission rate</span><strong className="tnum">{s.commission_rate}%</strong></li>
          <li className="flex justify-between"><span className="text-muted">Currency</span><strong>{s.currency}</strong></li>
        </ul>
      </section>
    </div>
  )
}
