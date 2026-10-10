import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  ArrowRight, ChevronRight, Heart, MessageCircle, Package, ShoppingBag, Star, Store, Truck, XCircle,
} from 'lucide-react'
import { Badge, Button, EmptyState, Field, Modal, Reveal, StarRating } from '@/components/ui'
import { OrderBadge, OrderTimeline } from '@/components/shared/OrderBits'
import { ProductCard, SellerCard } from '@/components/shared/Market'
import { cart, orders, products, reviews as reviewsApi, wishlist, stores } from '@/lib/db'
import { useAuth, useDb } from '@/lib/providers'
import { cn, formatDate, formatMoney, isCancellableOrder, paymentMethodLabel, timeAgo } from '@/lib/util'
import type { Order } from '@/lib/types'

import { BalochiBottomOrnament, BalochiDochWatermark } from '@/components/shared/BalochDecorations'

/* ── Overview ─────────────────────────────────────────────────── */
export function BuyerOverview() {
  const { user } = useAuth()
  useDb()
  if (!user) return null
  const myOrders = orders.listByBuyer(user.id)
  const active = myOrders.filter((o) => !['reached_to_buyer', 'delivered', 'cancelled'].includes(o.status))
  const wished = wishlist.list(user.id)
  const cartCount = cart.count(user.id)

  const stats = [
    {
      label: 'ACTIVE ORDERS',
      value: active.length,
      icon: <Package size={20} />,
      color: 'mint',
      to: '/dashboard/orders',
    },
    {
      label: 'WISHLIST',
      value: wished.length,
      icon: <Heart size={20} />,
      color: 'peach',
      to: '/dashboard/wishlist',
    },
    {
      label: 'TOTAL ORDERS',
      value: myOrders.length,
      icon: <ShoppingBag size={20} />,
      color: 'mint',
      to: '/dashboard/orders',
    },
    {
      label: 'CART',
      value: cartCount,
      icon: <ShoppingBag size={20} />,
      color: 'peach',
      to: '/cart',
    },
  ]

  return (
    <div className="space-y-6 sm:space-y-8">
      {/* ── Welcome Banner ── */}
      <div className="relative overflow-hidden rounded-3xl border border-line bg-surface p-6 sm:p-9 shadow-xs">
        {/* Right corner Doch embroidery watermark */}
        <div className="pointer-events-none absolute -right-6 -top-6 hidden sm:block opacity-35">
          <BalochiDochWatermark size={190} />
        </div>

        <div className="relative z-10 max-w-xl">
          <p className="flex items-center gap-2 text-xs font-bold uppercase tracking-[0.2em] text-terracotta">
            <span>Welcome</span>
            <span className="h-0.5 w-6 bg-terracotta inline-block rounded-full" />
          </p>
          <h2 className="mt-2 font-display text-2xl font-bold tracking-tight text-brand dark:text-fg sm:text-3xl lg:text-4xl">
            {user.full_name}
          </h2>
          <p className="mt-2.5 text-sm sm:text-base leading-relaxed text-muted">
            Explore your orders, manage your wishlist and enjoy a seamless shopping experience at Baloch Export Hub.
          </p>
        </div>
      </div>

      {/* ── 4 Summary Cards Matching Image 2 ── */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {stats.map((s, i) => {
          const isMint = s.color === 'mint'
          return (
            <Reveal key={s.label} delay={i * 0.05}>
              <Link
                to={s.to}
                className="group relative overflow-hidden rounded-2xl border border-line bg-surface p-5 transition-all duration-200 hover:-translate-y-0.5 hover:border-brand/40 hover:shadow-md block shadow-2xs"
              >
                {/* Subtle watermark in background */}
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
                    {s.icon}
                  </div>
                </div>

                <div className="relative z-10 mt-4 flex items-end justify-between">
                  <div>
                    <p className="font-display text-3xl font-bold leading-none text-brand dark:text-fg tnum">
                      {s.value}
                    </p>
                    <p className="mt-2 text-[0.68rem] font-bold uppercase tracking-wider text-faint">
                      {s.label}
                    </p>
                  </div>
                  <div className="grid h-7 w-7 place-items-center rounded-full border border-line bg-surface-2/60 text-fg transition group-hover:border-brand group-hover:bg-brand group-hover:text-onbrand">
                    <ArrowRight size={13} />
                  </div>
                </div>
              </Link>
            </Reveal>
          )
        })}
      </div>

      {/* ── Bottom Grid: Recent Orders & Quick Actions Matching Image 2 ── */}
      <div className="grid gap-6 lg:grid-cols-[1.6fr_1fr]">
        {/* Recent orders card */}
        <section className="rounded-3xl border border-line bg-surface p-6 sm:p-7 shadow-xs" aria-labelledby="ov-orders">
          <div className="flex items-center justify-between">
            <h3 id="ov-orders" className="font-display text-lg font-bold text-brand dark:text-fg">
              Recent orders
            </h3>
            <Link
              to="/dashboard/orders"
              className="inline-flex items-center gap-1 text-sm font-semibold text-terracotta transition hover:underline"
            >
              View all <ArrowRight size={14} />
            </Link>
          </div>

          {myOrders.length === 0 ? (
            <div className="mt-8 py-8 text-center">
              <p className="text-sm text-muted">No orders yet — your first parcel is waiting in the marketplace.</p>
              <Button to="/products" className="mt-4 !rounded-full !bg-brand text-onbrand px-5 py-2 text-xs font-semibold">
                Explore Marketplace
              </Button>
            </div>
          ) : (
            <ul className="mt-5 space-y-3">
              {myOrders.slice(0, 4).map((o) => {
                const firstImg = o.items[0]?.image || '/images/doch-closeup.jpg'
                return (
                  <li key={o.id}>
                    <Link
                      to={`/order/${o.code}`}
                      className="group flex flex-wrap items-center gap-3.5 rounded-2xl border border-line bg-surface-2/40 p-3.5 transition hover:border-brand/40 hover:bg-surface"
                    >
                      {/* Product square thumbnail */}
                      <div className="h-12 w-12 shrink-0 overflow-hidden rounded-xl border border-line bg-surface">
                        <img src={firstImg} alt="" className="h-full w-full object-cover transition group-hover:scale-105" />
                      </div>

                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-bold text-fg group-hover:text-terracotta transition-colors">
                          {o.code}
                        </p>
                        <p className="mt-0.5 text-xs text-muted">
                          {formatDate(o.created_at)} • {o.items.length} item(s) • {formatMoney(o.total)}
                        </p>
                      </div>

                      {/* Status pill matching Image 2 */}
                      <span className="shrink-0 rounded-full bg-brand/12 px-3 py-1 text-[0.66rem] font-bold uppercase tracking-wider text-brand">
                        {o.status.replace(/_/g, ' ')}
                      </span>

                      <ChevronRight size={16} className="text-muted transition group-hover:translate-x-0.5 group-hover:text-brand" />
                    </Link>
                  </li>
                )
              })}
            </ul>
          )}
        </section>

        {/* Quick actions card */}
        <section className="rounded-3xl border border-line bg-surface p-6 sm:p-7 shadow-xs" aria-labelledby="ov-quick">
          <h3 id="ov-quick" className="font-display text-lg font-bold text-brand dark:text-fg">
            Quick actions
          </h3>
          <div className="mt-5 space-y-3">
            {/* 1. Become a seller */}
            <Link
              to="/dashboard/become-seller"
              className="group flex items-center gap-3.5 rounded-2xl border border-line bg-surface-2/40 p-4 transition hover:border-terracotta/40 hover:bg-surface"
            >
              <div className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-terracotta/12 text-terracotta">
                <Star size={19} />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-bold text-fg">Become a seller</p>
                <p className="text-xs text-muted">Open your free store in minutes</p>
              </div>
              <ChevronRight size={16} className="text-muted transition group-hover:translate-x-0.5 group-hover:text-terracotta" />
            </Link>

            {/* 2. Discover sellers */}
            <Link
              to="/dashboard/sellers"
              className="group flex items-center gap-3.5 rounded-2xl border border-line bg-surface-2/40 p-4 transition hover:border-brand/40 hover:bg-surface"
            >
              <div className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-brand/12 text-brand">
                <Store size={19} />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-bold text-fg">Discover sellers</p>
                <p className="text-xs text-muted">Browse verified store profiles</p>
              </div>
              <ChevronRight size={16} className="text-muted transition group-hover:translate-x-0.5 group-hover:text-brand" />
            </Link>

            {/* 3. Messages */}
            <Link
              to="/dashboard/messages"
              className="group flex items-center gap-3.5 rounded-2xl border border-line bg-surface-2/40 p-4 transition hover:border-terracotta/40 hover:bg-surface"
            >
              <div className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-terracotta/12 text-terracotta">
                <MessageCircle size={19} />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-bold text-fg">Messages</p>
                <p className="text-xs text-muted">Talk to sellers safely</p>
              </div>
              <ChevronRight size={16} className="text-muted transition group-hover:translate-x-0.5 group-hover:text-terracotta" />
            </Link>
          </div>
        </section>
      </div>

      {/* ── Centered Cultural Bottom Ornament Matching Image 2 ── */}
      <BalochiBottomOrnament />
    </div>
  )
}

/* ── Seller discovery ─────────────────────────────────────────── */
export function BuyerSellers() {
  useDb()
  const list = stores.listApproved()
  return (
    <div className="space-y-5">
      <p className="text-sm text-muted">{list.length} verified store{list.length === 1 ? '' : 's'} — view profiles, products, reviews and message the maker.</p>
      {list.length === 0 ? (
        <EmptyState icon={<Store size={26} />} title="No stores yet" sub="Approved sellers will appear here." />
      ) : (
        <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
          {list.map((s) => <SellerCard key={s.id} store={s} />)}
        </div>
      )}
    </div>
  )
}

/* ── Orders ───────────────────────────────────────────────────── */
export function BuyerOrders() {
  const { user } = useAuth()
  useDb()
  const [openId, setOpenId] = useState<string | null>(null)
  useEffect(() => { void orders.reload() }, [])
  if (!user) return null
  const list = orders.listByBuyer(user.id)

  if (list.length === 0) {
    return <EmptyState icon={<Package size={26} />} title="No orders yet"
      sub="When you order, every step lands here." action={<Button to="/products" variant="gold" size="sm">Start shopping</Button>} />
  }

  return (
    <div className="space-y-4">
      {list.map((o) => (
        <OrderCard key={o.id} order={o} open={openId === o.id} onToggle={() => setOpenId(openId === o.id ? null : o.id)} />
      ))}
    </div>
  )
}

function OrderCard({ order, open, onToggle }: { order: Order; open: boolean; onToggle: () => void }) {
  const cancellable = isCancellableOrder(order.status)
  const firstStore = order.items[0] ? stores.byId(order.items[0].store_id) : undefined
  return (
    <article className="card overflow-hidden">
      <button onClick={onToggle} className="flex w-full flex-wrap items-center gap-4 p-5 text-left transition hover:bg-surface-2" aria-expanded={open}>
        <span className="flex -space-x-2">
          {order.items.slice(0, 3).map((i) => (
            <span key={i.id} className="h-11 w-11 overflow-hidden rounded-full border-2 border-[var(--surface)] bg-surface-2">
              {i.image ? <img src={i.image} alt="" className="h-full w-full object-cover" /> : null}
            </span>
          ))}
        </span>
        <span className="min-w-0 flex-1">
          <span className="block font-semibold">Order #{order.code.replace(/^ORD-/, '')}</span>
          <span className="text-xs text-faint">
            {order.items[0]?.name ?? 'Order'} · {firstStore ? `Seller: ${firstStore.name}` : null} · Qty {order.items.reduce((s, i) => s + i.qty, 0)}
          </span>
          <span className="block text-xs text-faint">Placed {formatDate(order.created_at, true)}</span>
        </span>
        <span className="font-display text-lg font-semibold tnum">{formatMoney(order.total)}</span>
        <OrderBadge status={order.status} />
        <ArrowRight size={16} className={`text-faint transition ${open ? 'rotate-90' : ''}`} />
      </button>

      {open && (
        <div className="border-t border-line p-5">
          <h4 className="mb-3 text-sm font-semibold">Track Order</h4>
          <OrderTimeline status={order.status} history={orders.history(order.id)} />
          <ul className="mt-6 space-y-3">
            {order.items.map((i) => {
              const store = stores.byId(i.store_id)
              return (
                <li key={i.id} className="flex flex-wrap items-center gap-3 rounded-2xl border border-line p-3.5">
                  <span className="h-14 w-14 shrink-0 overflow-hidden rounded-xl bg-surface-2">
                    {i.image ? <img src={i.image} alt="" className="h-full w-full object-cover" /> : null}
                  </span>
                  <span className="min-w-0 flex-1">
                    <Link to={`/product/${i.product_id}`} className="block truncate text-sm font-semibold hover:text-gold">{i.name}</Link>
                    <span className="text-xs text-faint">Qty {i.qty} · {formatMoney(i.price * i.qty)}</span>
                    {store && <Link to={`/store/${store.slug}`} className="block text-xs text-brand hover:underline dark:text-gold">{store.name}</Link>}
                  </span>
                  <span className="flex flex-col items-end gap-1.5">
                    <OrderBadge status={i.status} />
                    {i.tracking_code && <span className="text-[0.65rem] text-faint tnum">📦 {i.tracking_code}</span>}
                    {i.courier && <span className="text-[0.65rem] text-faint">{i.courier}</span>}
                  </span>
                </li>
              )
            })}
          </ul>
          <div className="mt-5 flex flex-wrap items-center justify-between gap-4">
            <p className="text-xs text-muted">{paymentMethodLabel(order.payment_method)} · {order.payment === 'paid' ? 'Paid' : order.payment === 'refunded' ? 'Refunded' : 'Payment pending'}</p>
            <div className="flex gap-2.5">
              {cancellable && (
                <Button size="sm" onClick={() => orders.cancel(order.id)}>
                  <XCircle size={14} /> Cancel order
                </Button>
              )}
              <Button to={`/order/${order.code}`} size="sm" variant="ghost">Receipt</Button>
            </div>
          </div>
        </div>
      )}
    </article>
  )
}

/* ── Reviews ──────────────────────────────────────────────────── */
export function BuyerReviews() {
  const { user } = useAuth()
  useDb()
  const [modal, setModal] = useState<{ productId: string; name: string } | null>(null)
  const [rating, setRating] = useState(5)
  const [text, setText] = useState('')
  if (!user) return null

  const mine = reviewsApi.byBuyer(user.id)
  const opportunities = (() => {
    const out: Array<{ productId: string; name: string; image: string }> = []
    for (const o of orders.listByBuyer(user.id)) {
      for (const i of o.items) {
        if (['reached_to_buyer', 'delivered'].includes(i.status) && !reviewsApi.byProduct(i.product_id).some((r) => r.buyer_id === user.id) && !mine.some((r) => r.product_id === i.product_id)) {
          if (!out.some((x) => x.productId === i.product_id)) out.push({ productId: i.product_id, name: i.name, image: i.image })
        }
      }
    }
    return out
  })()

  const submit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!modal || !text.trim()) return
    reviewsApi.create({ productId: modal.productId, buyer: user, rating, comment: text })
    setModal(null); setText(''); setRating(5)
  }

  return (
    <div className="space-y-8">
      <section aria-labelledby="rev-pending">
        <h3 id="rev-pending" className="font-display text-lg font-semibold">Awaiting your review</h3>
        {opportunities.length === 0 ? (
          <p className="mt-3 text-sm text-muted">Nothing to review right now — delivered items will appear here.</p>
        ) : (
          <div className="mt-4 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {opportunities.map((o) => (
              <div key={o.productId} className="card flex items-center gap-3 p-4">
                <span className="h-14 w-14 shrink-0 overflow-hidden rounded-xl bg-surface-2">
                  {o.image ? <img src={o.image} alt="" className="h-full w-full object-cover" /> : null}
                </span>
                <span className="min-w-0 flex-1"><span className="block truncate text-sm font-semibold">{o.name}</span></span>
                <Button size="sm" variant="gold" onClick={() => setModal({ productId: o.productId, name: o.name })}>Review</Button>
              </div>
            ))}
          </div>
        )}
      </section>

      <section aria-labelledby="rev-mine">
        <h3 id="rev-mine" className="font-display text-lg font-semibold">Your reviews ({mine.length})</h3>
        {mine.length === 0 ? (
          <p className="mt-3 text-sm text-muted">Your published reviews will live here.</p>
        ) : (
          <ul className="mt-4 space-y-4">
            {mine.map((r) => (
              <li key={r.id} className="card p-5">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <Link to={`/product/${r.product_id}`} className="text-sm font-semibold hover:text-gold">Product {r.product_id}</Link>
                  <StarRating rating={r.rating} size={14} />
                </div>
                <p className="mt-2.5 text-sm leading-relaxed text-muted">{r.comment}</p>
                <p className="mt-2 text-xs text-faint">{formatDate(r.created_at)} · {timeAgo(r.created_at)}</p>
              </li>
            ))}
          </ul>
        )}
      </section>

      <Modal open={!!modal} onClose={() => setModal(null)} title={`Review “${modal?.name ?? ''}”`}>
        <form onSubmit={submit} className="space-y-4">
          <Field label="Your rating">
            <StarRating rating={rating} interactive size={26} onChange={setRating} />
          </Field>
          <Field label="Your review" required>
            <textarea id="review-text" name="review" className="field" rows={4} value={text} onChange={(e) => setText(e.target.value)} placeholder="Tell other buyers about the craft, packing and delivery…" required />
          </Field>
          <div className="flex justify-end gap-3">
            <Button variant="ghost" onClick={() => setModal(null)}>Cancel</Button>
            <Button type="submit" variant="gold">Publish</Button>
          </div>
        </form>
      </Modal>
    </div>
  )
}
