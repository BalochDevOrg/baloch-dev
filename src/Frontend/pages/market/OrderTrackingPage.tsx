import { useEffect, useState } from 'react'
import { useParams, useSearchParams, Link } from 'react-router-dom'
import {
  Package,
  CheckCircle2,
  Clock,
  Truck,
  MapPin,
  Store as StoreIcon,
  Copy,
  Check,
  AlertCircle,
  ArrowRight,
  ShieldCheck,
  Calendar,
  ExternalLink,
} from 'lucide-react'
import { orders } from '@/lib/db'
import { formatDate, formatMoney } from '@/lib/util'
import type { PublicOrderTracking } from '@/lib/types'
import { EmptyState, Button, Reveal } from '@/components/ui'
import { BalochiDochWatermark } from '@/components/shared/BalochDecorations'
import { OrderBadge } from '@/components/shared/OrderBits'

const CANONICAL_STEPS = [
  { key: 'submitted', label: 'Order Submitted', desc: 'Order received & confirmed' },
  { key: 'packaging', label: 'In Packaging', desc: 'Artisan crafting & packing' },
  { key: 'packed', label: 'Order Packed', desc: 'Sealed with Doch authenticity' },
  { key: 'sent_to_platform', label: 'Sent to Hub', desc: 'Dispatched to hub logistics' },
  { key: 'on_way', label: 'On The Way', desc: 'In transit to buyer destination' },
  { key: 'reached_to_buyer', label: 'Delivered', desc: 'Parcel safely reached buyer' },
]

function getStepIndex(status: string): number {
  const norm = status.toLowerCase()
  if (norm === 'submitted' || norm === 'pending') return 0
  if (norm === 'packaging' || norm === 'processing') return 1
  if (norm === 'packed' || norm === 'confirmed') return 2
  if (norm === 'sent_to_platform') return 3
  if (norm === 'on_way' || norm === 'shipped' || norm === 'out_for_delivery') return 4
  if (norm === 'reached_to_buyer' || norm === 'delivered') return 5
  if (norm === 'cancelled') return -1
  return 0
}

export function OrderTrackingPage() {
  const { id = '', code = '' } = useParams<{ id?: string; code?: string }>()
  const [searchParams] = useSearchParams()
  const token = searchParams.get('token') || undefined
  const identifier = id || code

  const [loading, setLoading] = useState(true)
  const [order, setOrder] = useState<PublicOrderTracking | null>(null)
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    if (!identifier) {
      setLoading(false)
      return
    }

    let active = true
    setLoading(true)

    void orders
      .getTracking(identifier, token)
      .then((data) => {
        if (active) {
          setOrder(data)
          setLoading(false)
        }
      })
      .catch((err) => {
        console.error('[OrderTrackingPage] Failed to load tracking:', err)
        if (active) setLoading(false)
      })

    return () => {
      active = false
    }
  }, [identifier, token])

  const copyTracking = (text: string) => {
    if (!text) return
    navigator.clipboard?.writeText(text)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  if (loading) {
    return (
      <div className="mx-auto max-w-4xl px-4 sm:px-6 pb-24 pt-24 sm:pt-28">
        <div className="card p-8 sm:p-12 text-center">
          <div className="mx-auto mb-4 grid h-12 w-12 sm:h-14 sm:w-14 place-items-center rounded-2xl bg-brand/10 text-brand dark:text-gold animate-pulse">
            <Package size={24} />
          </div>
          <h2 className="font-display text-lg sm:text-xl font-bold text-fg">Loading parcel tracking…</h2>
          <p className="mt-1 text-xs sm:text-sm text-muted">Fetching verified status from Baloch Export Hub logistics.</p>
        </div>
      </div>
    )
  }

  if (!order || order.error) {
    return (
      <div className="mx-auto max-w-4xl px-4 sm:px-6 pb-24 pt-24 sm:pt-28">
        <EmptyState
          icon={<Package size={28} />}
          title="Parcel Not Found"
          sub="We couldn't locate this order tracking. Please verify your order number or tracking link."
          action={
            <Button to="/products" variant="gold" size="sm">
              Browse Marketplace
            </Button>
          }
        />
      </div>
    )
  }

  const stepIdx = getStepIndex(order.status)
  const isCancelled = order.status === 'cancelled'
  const primaryItem = order.items[0]
  const storeSlug = primaryItem?.store_slug || ''
  const storeName = primaryItem?.store_name || 'Artisan Studio'

  const trackingNumber =
    order.items.find((i) => Boolean(i.tracking_code))?.tracking_code || null
  const courierName =
    order.items.find((i) => Boolean(i.courier))?.courier || null

  return (
    <div className="mx-auto max-w-4xl px-3.5 sm:px-6 md:px-8 pb-28 pt-20 sm:pt-24">
      <Reveal>
        {/* ── Header Card ─────────────────────────────────────────── */}
        <div className="relative overflow-hidden rounded-3xl border border-line bg-surface p-5 sm:p-8 shadow-sm">
          <div className="pointer-events-none absolute -right-6 -top-6 opacity-20 sm:opacity-25">
            <BalochiDochWatermark size={160} />
          </div>

          <div className="relative z-10 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="space-y-1.5 min-w-0">
              <div className="flex flex-wrap items-center gap-1.5 sm:gap-2">
                <span className="inline-flex items-center gap-1.5 rounded-full bg-brand/10 px-2.5 sm:px-3 py-1 text-[0.65rem] sm:text-[0.7rem] font-bold uppercase tracking-wider text-brand dark:text-gold shrink-0">
                  <ShieldCheck size={12} /> Verified Hub Parcel
                </span>
                <span className="text-xs text-faint hidden xs:inline">·</span>
                <span className="flex items-center gap-1 text-[0.7rem] sm:text-xs text-muted">
                  <Calendar size={12} /> Placed {formatDate(order.created_at, true)}
                </span>
              </div>

              <h1 className="font-display text-xl sm:text-2xl md:text-3xl font-bold tracking-tight text-brand dark:text-fg truncate">
                Order #{order.code.replace(/^ORD-|^BEH-/, '')}
              </h1>

              <p className="text-xs text-muted truncate">
                Reference: <strong className="font-mono text-fg">{order.code}</strong>
              </p>
            </div>

            <div className="flex flex-row sm:flex-col items-center sm:items-end justify-between sm:justify-start gap-2 border-t sm:border-t-0 border-line/60 pt-3 sm:pt-0">
              <OrderBadge status={order.status} />
              <span className="font-display text-lg sm:text-xl font-bold text-fg tnum">
                {formatMoney(order.total)}
              </span>
            </div>
          </div>
        </div>

        {/* ── Tracking Number Alert / Banner ──────────────────────── */}
        <div className="mt-5 rounded-2xl border border-line bg-surface p-4 sm:p-5 shadow-2xs">
          <div className="flex flex-col gap-3.5 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-start gap-3 min-w-0">
              <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-gold/15 text-gold">
                <Truck size={20} />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-[0.65rem] sm:text-xs font-bold uppercase tracking-wider text-faint">
                  Tracking Number
                </p>
                {trackingNumber ? (
                  <div className="mt-1 flex flex-wrap items-center gap-2">
                    <span className="font-mono text-sm sm:text-base font-bold text-brand dark:text-gold tracking-wide truncate">
                      {trackingNumber}
                    </span>
                    {courierName && (
                      <span className="rounded-md bg-surface-2 px-2 py-0.5 text-[0.7rem] sm:text-xs text-muted shrink-0">
                        via {courierName}
                      </span>
                    )}
                  </div>
                ) : (
                  <p className="mt-0.5 text-xs sm:text-sm font-medium text-fg">
                    Your tracking number will be updated when the parcel is dispatched.
                  </p>
                )}
              </div>
            </div>

            {trackingNumber && (
              <button
                type="button"
                onClick={() => copyTracking(trackingNumber)}
                className="inline-flex items-center justify-center gap-1.5 rounded-xl border border-line bg-surface-2 px-3 py-1.5 text-xs font-semibold text-fg hover:bg-surface transition shrink-0 w-full sm:w-auto"
              >
                {copied ? <Check size={14} className="text-emerald-500" /> : <Copy size={14} />}
                <span>{copied ? 'Copied' : 'Copy Tracking'}</span>
              </button>
            )}
          </div>
        </div>

        {/* ── Visual Step Progression ─────────────────────────────── */}
        <div className="mt-5 rounded-3xl border border-line bg-surface p-4 sm:p-7 shadow-2xs">
          <h2 className="font-display text-base sm:text-lg font-bold text-fg">Parcel Journey</h2>
          <p className="text-xs text-muted">Live updates directly from the artisan workshop and carrier.</p>

          {isCancelled ? (
            <div className="mt-5 flex items-center gap-3 rounded-2xl bg-rose-500/10 p-4 text-rose-500">
              <AlertCircle size={20} className="shrink-0" />
              <div>
                <p className="font-bold text-sm">Order Cancelled</p>
                <p className="text-xs">This order has been cancelled and is no longer in transit.</p>
              </div>
            </div>
          ) : (
            <div className="mt-6">
              {/* Responsive Stepper: 2 cols on mobile, 3 on tablet, 6 on desktop */}
              <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 lg:grid-cols-6 sm:gap-3.5">
                {CANONICAL_STEPS.map((s, idx) => {
                  const isDone = idx <= stepIdx
                  const isCurrent = idx === stepIdx

                  return (
                    <div
                      key={s.key}
                      className={`relative flex flex-col items-center text-center p-3 rounded-2xl transition border ${
                        isCurrent
                          ? 'border-brand bg-brand/5 shadow-xs dark:border-gold dark:bg-gold/5'
                          : isDone
                          ? 'border-line bg-surface-2'
                          : 'border-line/40 bg-surface opacity-50'
                      }`}
                    >
                      <div
                        className={`mb-2 grid h-8 w-8 sm:h-9 sm:w-9 place-items-center rounded-full text-xs font-bold transition ${
                          isDone
                            ? 'bg-brand text-onbrand dark:bg-gold dark:text-black'
                            : 'bg-surface-2 text-faint'
                        }`}
                      >
                        {isDone ? <CheckCircle2 size={15} /> : idx + 1}
                      </div>

                      <p
                        className={`text-[0.72rem] sm:text-xs font-bold leading-tight ${
                          isCurrent
                            ? 'text-brand dark:text-gold'
                            : isDone
                            ? 'text-fg'
                            : 'text-muted'
                        }`}
                      >
                        {s.label}
                      </p>
                      <p className="mt-1 text-[0.62rem] sm:text-[0.65rem] text-faint leading-snug line-clamp-2">
                        {s.desc}
                      </p>
                    </div>
                  )
                })}
              </div>
            </div>
          )}
        </div>

        {/* ── Status History Log & Milestones ─────────────────────── */}
        <div className="mt-5 grid grid-cols-1 gap-5 lg:grid-cols-[1.4fr_1fr]">
          {/* Milestones Log */}
          <div className="card p-4 sm:p-6">
            <h3 className="flex items-center gap-2 font-display text-sm sm:text-base font-bold text-fg">
              <Clock size={16} className="text-brand dark:text-gold" /> Tracking Updates
            </h3>

            {order.history && order.history.length > 0 ? (
              <div className="mt-4 space-y-3.5 border-l-2 border-line pl-3.5">
                {order.history.map((h) => (
                  <div key={h.id} className="relative">
                    <span className="absolute -left-[19px] top-1 h-2.5 w-2.5 rounded-full bg-brand dark:bg-gold ring-4 ring-surface" />
                    <p className="text-xs font-bold text-fg">
                      {h.note || `Status updated to ${h.to_status}`}
                    </p>
                    <p className="mt-0.5 text-[0.68rem] text-faint">
                      {formatDate(h.created_at, true)}
                    </p>
                  </div>
                ))}
              </div>
            ) : (
              <p className="mt-3 text-xs text-muted">
                Initial order placement confirmed. Future dispatch milestones will appear here.
              </p>
            )}
          </div>

          {/* Delivery & Seller Summary */}
          <div className="space-y-5">
            {/* Delivery Destination */}
            <div className="card p-4 sm:p-6">
              <h3 className="flex items-center gap-2 font-display text-sm sm:text-base font-bold text-fg">
                <MapPin size={16} className="text-brand dark:text-gold" /> Destination
              </h3>
              <div className="mt-2.5 text-xs leading-relaxed text-muted">
                <p className="font-semibold text-fg">
                  Recipient: {order.recipient_name}
                </p>
                {order.address_summary?.line1 && (
                  <p>{order.address_summary.line1}</p>
                )}
                <p>
                  {order.destination.city}, {order.destination.state},{' '}
                  {order.destination.country}
                </p>
              </div>
            </div>

            {/* Seller Store Link Card */}
            {storeSlug && (
              <div className="card p-4 sm:p-6 bg-gradient-to-br from-surface to-surface-2">
                <h3 className="flex items-center gap-2 font-display text-sm sm:text-base font-bold text-fg">
                  <StoreIcon size={16} className="text-brand dark:text-gold" /> Artisan Store
                </h3>
                <p className="mt-1 text-xs text-muted">
                  Handcrafted and dispatched by <strong>{storeName}</strong>.
                </p>

                <div className="mt-3.5">
                  <Button
                    to={`/store/${storeSlug}`}
                    variant="primary"
                    size="sm"
                    className="w-full justify-center text-xs"
                  >
                    <span>Visit Seller Store</span>
                    <ArrowRight size={13} />
                  </Button>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* ── Items in this Parcel ─────────────────────────────────── */}
        <div className="mt-5 card p-4 sm:p-6">
          <h3 className="font-display text-sm sm:text-base font-bold text-fg">
            Items in This Parcel ({order.items.length})
          </h3>

          <ul className="mt-3 divide-y divide-line">
            {order.items.map((i) => (
              <li key={i.id} className="flex flex-col xs:flex-row xs:items-center justify-between gap-3 py-3">
                <div className="flex items-center gap-3 min-w-0 flex-1">
                  <span className="h-12 w-12 sm:h-14 sm:w-14 shrink-0 overflow-hidden rounded-xl bg-surface-2 border border-line">
                    {i.image ? (
                      <img src={i.image} alt="" className="h-full w-full object-cover" />
                    ) : (
                      <span className="grid h-full w-full place-items-center text-faint">
                        <Package size={16} />
                      </span>
                    )}
                  </span>

                  <div className="min-w-0 flex-1">
                    <Link
                      to={`/product/${i.product_id}`}
                      className="block truncate text-xs sm:text-sm font-semibold hover:text-gold transition"
                    >
                      {i.product_name}
                    </Link>
                    <p className="text-[0.7rem] sm:text-xs text-faint">
                      Qty {i.quantity} · {formatMoney(i.price * i.quantity)}
                    </p>
                    {i.store_name && i.store_slug && (
                      <Link
                        to={`/store/${i.store_slug}`}
                        className="mt-0.5 inline-flex items-center gap-1 text-[0.68rem] text-brand hover:underline dark:text-gold"
                      >
                        <StoreIcon size={11} /> {i.store_name}
                      </Link>
                    )}
                  </div>
                </div>

                <div className="flex flex-row xs:flex-col items-center xs:items-end justify-between xs:justify-start gap-1 text-right border-t xs:border-t-0 border-line/40 pt-2 xs:pt-0 shrink-0">
                  <OrderBadge status={i.status} />
                  {i.tracking_code && (
                    <span className="font-mono text-[0.65rem] text-muted">
                      📦 {i.tracking_code}
                    </span>
                  )}
                </div>
              </li>
            ))}
          </ul>
        </div>

        {/* ── Bottom Navigation Links ─────────────────────────────── */}
        <div className="mt-6 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3.5 border-t border-line pt-5">
          <Link
            to="/"
            className="text-xs font-semibold text-muted hover:text-brand dark:hover:text-gold flex items-center justify-center sm:justify-start gap-1.5"
          >
            ← Visit Baloch Export Hub Homepage
          </Link>

          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 sm:gap-3 w-full sm:w-auto">
            {storeSlug && (
              <Button to={`/store/${storeSlug}`} variant="ghost" size="sm" className="text-xs justify-center">
                Visit Store <ExternalLink size={13} />
              </Button>
            )}
            <Button to="/products" variant="gold" size="sm" className="text-xs justify-center">
              Explore More Crafts <ArrowRight size={13} />
            </Button>
          </div>
        </div>
      </Reveal>
    </div>
  )
}
