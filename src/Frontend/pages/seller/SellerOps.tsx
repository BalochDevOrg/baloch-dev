import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  ArrowRight, Camera, Check, CheckCircle2, ChevronDown, FileDown, Image as ImageIcon,
  Loader2, Package, PackageCheck, Plus, Sparkles, Star, Trash2, Truck, Upload, X,
} from 'lucide-react'
import { Button, EmptyState, StarRating } from '@/components/ui'
import { OrderBadge, OrderHistoryList } from '@/components/shared/OrderBits'
import { downloadOrderVoucher } from '@/components/shared/OrderVoucher'
import {
  auth, categories as categoriesApi, notifications as notifApi,
  orders, products, reviews as reviewsApi, storage, stores, users,
} from '@/lib/db'
import { useAuth, useDb } from '@/lib/providers'
import { formatDate, formatMoney, normalizeOrderStatus, paymentMethodLabel, SELLER_NEXT, timeAgo } from '@/lib/util'
import type { Order, OrderItem } from '@/lib/types'
import { NoStore, useSellerStore } from './SellerCenter'
import { StoreBannerGallery } from '@/components/shared/StoreBannerGallery'

export function SellerOrders() {
  useDb()
  const store = useSellerStore()
  const [openId, setOpenId] = useState<string | null>(null)
  const [busy, setBusy] = useState<string | null>(null)
  useEffect(() => { void orders.reload() }, [])
  if (!store) return <NoStore />
  const list = orders.listByStore(store.id)
  if (list.length === 0) {
    return <EmptyState icon={<Package size={26} />} title="No orders yet" sub="Share your store link — the first order will appear here." />
  }

  const advance = async (orderId: string, to: Parameters<typeof orders.advance>[1]) => {
    setBusy(orderId)
    try { await orders.advance(orderId, to) }
    catch (e: any) { console.error(e); alert(e?.message ?? 'Could not update order status.') }
    finally { setBusy(null) }
  }

  return (
    <div className="space-y-4">
      {list.map((o) => {
        const mine = o.items.filter((i) => i.store_id === store.id)
        const gross = mine.reduce((s, i) => s + i.price * i.qty, 0)
        const itemStatus = normalizeOrderStatus(mine[0]?.status ?? o.status)
        const next = SELLER_NEXT[itemStatus]
        const open = openId === o.id
        const addr = o.address ?? {} as Order['address']
        const seller = users.byId(store.seller_id)
        return (
          <article key={o.id} className="card overflow-hidden">
            <div className="flex w-full flex-wrap items-center gap-3 p-5">
              <button onClick={() => setOpenId(open ? null : o.id)} className="flex min-w-0 flex-1 flex-wrap items-center gap-4 text-left transition" aria-expanded={open}>
                <span className="min-w-0 flex-1">
                  <span className="block font-semibold">New Order #{o.code.replace(/^ORD-/, '')}</span>
                  <span className="text-xs text-faint">Buyer: {o.buyer_name} · {formatDate(o.created_at, true)} · {mine.length} item(s)</span>
                </span>
                <span className="font-display text-lg font-semibold tnum">{formatMoney(gross)}</span>
                <OrderBadge status={itemStatus} />
                <ArrowRight size={16} className={`text-faint transition ${open ? 'rotate-90' : ''}`} />
              </button>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => downloadOrderVoucher({
                  order: o,
                  items: mine,
                  store,
                  seller,
                })}
              >
                <FileDown size={14} /> Download Voucher
              </Button>
            </div>
            {open && (
              <div className="space-y-4 border-t border-line p-5">
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="rounded-2xl bg-surface-2 p-4 text-sm">
                    <p className="text-xs font-semibold uppercase tracking-wide text-faint">Buyer</p>
                    <p className="mt-1 font-semibold">{addr.full_name || o.buyer_name}</p>
                    {addr.phone && <p className="text-muted">Phone: {addr.phone}</p>}
                    {addr.email && <p className="text-muted">Email: {addr.email}</p>}
                  </div>
                  <div className="rounded-2xl bg-surface-2 p-4 text-sm">
                    <p className="text-xs font-semibold uppercase tracking-wide text-faint">Shipping address</p>
                    <p className="mt-1 text-muted">{addr.line1}, {addr.city}, {addr.state} {addr.country ? `· ${addr.country}` : ''}</p>
                    <p className="mt-2 text-xs text-faint">Store: {store.name}{seller ? ` · ${seller.full_name}` : ''}</p>
                  </div>
                </div>
                <p className="text-xs text-muted">
                  Payment: {paymentMethodLabel(o.payment_method)} · {o.payment === 'paid' ? 'Paid' : o.payment === 'refunded' ? 'Refunded' : 'Pending'}
                  {o.shipping ? ` · Shipping ${formatMoney(o.shipping)}` : ''} · Total {formatMoney(o.total)}
                </p>
                {mine.map((i) => <SellerOrderItem key={i.id} item={i} />)}
                {next && (
                  <Button size="sm" variant="primary" disabled={busy === o.id} onClick={() => advance(o.id, next.to)}>
                    {next.to === 'sent_to_platform' ? <Truck size={14} /> : next.to === 'packed' ? <PackageCheck size={14} /> : <Package size={14} />}
                    {busy === o.id ? 'Updating…' : next.label}
                  </Button>
                )}
                <div>
                  <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-faint">Status history</p>
                  <OrderHistoryList history={orders.history(o.id)} />
                </div>
              </div>
            )}
          </article>
        )
      })}
    </div>
  )
}

function SellerOrderItem({ item }: { item: OrderItem }) {
  return (
    <div className="flex flex-wrap items-center gap-3 rounded-2xl border border-line p-3.5">
      <span className="h-14 w-14 shrink-0 overflow-hidden rounded-xl bg-surface-2">
        {item.image ? <img src={item.image} alt="" className="h-full w-full object-cover" /> : null}
      </span>
      <span className="min-w-0 flex-1">
        <Link to={`/product/${item.product_id}`} className="block truncate text-sm font-semibold hover:text-gold">{item.name}</Link>
        <span className="text-xs text-faint">Qty {item.qty} · {formatMoney(item.price)} each · {formatMoney(item.price * item.qty)}</span>
        {item.tracking_code && <span className="block text-[0.65rem] text-faint tnum">📦 {item.tracking_code}</span>}
      </span>
      <OrderBadge status={item.status} />
    </div>
  )
}

/* ── Reviews (seller view) ────────────────────────────────────── */
export function SellerReviews() {
  useDb()
  const store = useSellerStore()
  if (!store) return <NoStore />
  const mine = products.list({ storeId: store.id })
  const list = reviewsApi.listAll().filter((r) => mine.some((p) => p.id === r.product_id))

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-3">
        <Star size={18} className="text-gold" />
        <p className="text-sm text-muted">{list.length} review{list.length === 1 ? '' : 's'} across your products</p>
      </div>
      {list.length === 0 ? (
        <EmptyState icon={<Star size={26} />} title="No reviews yet" sub="Reviews arrive after your first deliveries." />
      ) : (
        <ul className="space-y-4">
          {list.map((r) => {
            const p = mine.find((x) => x.id === r.product_id)
            return (
              <li key={r.id} className="card p-5">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <span className="flex items-center gap-3">
                    {p && <Link to={`/product/${p.id}`} className="text-sm font-semibold hover:text-gold">{p.name}</Link>}
                  </span>
                  <StarRating rating={r.rating} size={14} />
                </div>
                <p className="mt-2.5 text-sm leading-relaxed text-muted">{r.comment}</p>
                <p className="mt-2 text-xs text-faint">{r.buyer_name} · {timeAgo(r.created_at)}{!r.is_approved && ' · hidden (moderation)'}</p>
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}

/* ── Notifications (full page) ────────────────────────────────── */
export function SellerNotifications() {
  const { user } = useAuth()
  useDb()
  if (!user) return null
  const list = notifApi.list(user.id)
  return (
    <div className="max-w-2xl space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm text-muted">{list.filter((n) => !n.read).length} unread</p>
        <Button size="sm" variant="ghost" onClick={() => notifApi.markAllRead(user.id)}>Mark all read</Button>
      </div>
      {list.length === 0 && <EmptyState icon={<Package size={24} />} title="No notifications" sub="Order and message updates land here." />}
      <ul className="space-y-3">
        {list.map((n) => (
          <li key={n.id}>
            <button onClick={() => {
              notifApi.markRead(n.id)
              if (n.href) window.location.assign(n.href)
            }} className={`card flex w-full gap-3.5 p-4 text-left transition hover:border-gold/40 ${!n.read ? 'border-brand/30 bg-brand/5' : ''}`}>
              <span className={`mt-1 h-2.5 w-2.5 shrink-0 rounded-full ${n.read ? 'bg-line' : 'bg-gold'}`} aria-hidden />
              <span className="min-w-0">
                <span className="block text-sm font-semibold">{n.title}</span>
                <span className="mt-0.5 block text-sm text-muted">{n.body}</span>
                <span className="mt-1 block text-[0.68rem] text-faint">{timeAgo(n.created_at)}</span>
              </span>
            </button>
          </li>
        ))}
      </ul>
    </div>
  )
}

/* ── Store profile ────────────────────────────────────────────── */
const COLORS = ['#0d7d76', '#b9821f', '#a4123f', '#5c4a7d', '#0f5d8a', '#3f7d3a']
const BANNERS = ['/images/doch-closeup.jpg', '/images/cat-painting.jpg', '/images/cat-food.jpg', '/images/cat-jewelry.jpg', '/images/cat-herbs.jpg', '/images/cat-calligraphy.jpg']

export function SellerStoreProfile() {
  const { user, refreshProfile } = useAuth()
  useDb()
  const store = useSellerStore()
  const [saved, setSaved] = useState(false)

  // Banner state
  const [bannerTab, setBannerTab] = useState<'upload' | 'gallery'>('upload')
  const [bannerUploading, setBannerUploading] = useState(false)
  const [bannerErr, setBannerErr] = useState('')
  const [bannerSuccess, setBannerSuccess] = useState(false)

  // Logo / profile image state
  const [logoUploading, setLogoUploading] = useState(false)
  const [logoErr, setLogoErr] = useState('')
  const [logoSuccess, setLogoSuccess] = useState(false)

  // Categories state
  const [customCategoryInput, setCustomCategoryInput] = useState('')
  const [showCustomInput, setShowCustomInput] = useState(false)

  const [f, setF] = useState(() => store ? {
    name: store.name,
    description: store.description,
    location: store.location,
    category_slugs: store.category_slugs || [],
    logo_color: store.logo_color,
    logo_url: store.logo_url ?? user?.avatar_url ?? '',
    banner: store.banner ?? '',
    whatsapp_number: store.whatsapp_number ?? '',
  } : null)

  useEffect(() => {
    if (!store) return
    setF({
      name: store.name,
      description: store.description,
      location: store.location,
      category_slugs: store.category_slugs || [],
      logo_color: store.logo_color,
      logo_url: store.logo_url ?? user?.avatar_url ?? '',
      banner: store.banner ?? '',
      whatsapp_number: store.whatsapp_number ?? '',
    })
  }, [store?.id])

  if (!store || !f) return <NoStore />
  const seller = users.byId(store.seller_id)

  // Standard predefined categories
  const PREDEFINED_CATEGORIES = [
    { slug: 'balochi-doch', label: 'Balochi Doch & Embroidery' },
    { slug: 'traditional-clothing', label: 'Traditional Clothing' },
    { slug: 'handicrafts', label: 'Handicrafts & Pottery' },
    { slug: 'decorative-items', label: 'Decorative Items & Artifacts' },
    { slug: 'handmade-products', label: 'Handmade Products' },
    { slug: 'jewelry', label: 'Jewelry & Gemstones' },
    { slug: 'cultural-products', label: 'Cultural Artifacts & Heritage' },
    { slug: 'calligraphy', label: 'Calligraphy & Fine Art' },
    { slug: 'painters', label: 'Painters & Canvas Art' },
    { slug: 'sketch-artists', label: 'Sketch Artists' },
    { slug: 'photographers', label: 'Photographers & Studios' },
    { slug: 'designers', label: 'Designers & Fashion' },
    { slug: 'writers', label: 'Writers & Literature' },
    { slug: 'books', label: 'Books & Publications' },
    { slug: 'traditional-food', label: 'Traditional Food & Feast' },
    { slug: 'balochi-herbs', label: 'Balochi Herbs & Remedies' },
    { slug: 'balochi-recipes', label: 'Balochi Recipes & Spices' },
  ]

  const dynamicCategories = categoriesApi.list().filter(
    (c) => !PREDEFINED_CATEGORIES.some((p) => p.slug === c.slug),
  )

  // Banner handlers
  const handleBannerFile = async (files: FileList | null) => {
    const file = files?.[0]
    if (!file) return
    setBannerErr('')
    setBannerUploading(true)
    try {
      const url = await storage.uploadStoreBanner(file, user?.id || store.seller_id)
      setF((prev) => (prev ? { ...prev, banner: url } : prev))
      await stores.update(store.id, { banner: url })
      setBannerSuccess(true)
      setTimeout(() => setBannerSuccess(false), 2500)
    } catch (err) {
      setBannerErr(err instanceof Error ? err.message : 'Could not upload banner image.')
    } finally {
      setBannerUploading(false)
    }
  }

  const handleRemoveBanner = async () => {
    setF((prev) => (prev ? { ...prev, banner: '' } : prev))
    await stores.update(store.id, { banner: '' })
  }

  // Profile image / Logo handlers
  const handleLogoFile = async (files: FileList | null) => {
    const file = files?.[0]
    if (!file) return
    setLogoErr('')
    setLogoUploading(true)
    try {
      const url = await storage.uploadStoreLogo(file, user?.id || store.seller_id)
      setF((prev) => (prev ? { ...prev, logo_url: url } : prev))
      await stores.update(store.id, { logo_url: url })
      if (user) {
        await auth.updateProfile(user.id, { avatar_url: url })
        await refreshProfile()
      }
      setLogoSuccess(true)
      setTimeout(() => setLogoSuccess(false), 2500)
    } catch (err) {
      setLogoErr(err instanceof Error ? err.message : 'Could not upload profile photo.')
    } finally {
      setLogoUploading(false)
    }
  }

  const handleRemoveLogo = async () => {
    setF((prev) => (prev ? { ...prev, logo_url: '' } : prev))
    await stores.update(store.id, { logo_url: '' })
    if (user) {
      await auth.updateProfile(user.id, { avatar_url: '' })
      await refreshProfile()
    }
  }

  // Categories handlers
  const handleCategoryDropdownChange = (val: string) => {
    if (!val) return
    if (val === '__other__') {
      setShowCustomInput(true)
      return
    }
    if (!f.category_slugs.includes(val)) {
      setF({ ...f, category_slugs: [...f.category_slugs, val] })
    }
  }

  const handleAddCustomCategory = () => {
    const text = customCategoryInput.trim()
    if (!text) return
    const slug = text.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '')
    if (slug && !f.category_slugs.includes(slug)) {
      setF({ ...f, category_slugs: [...f.category_slugs, slug] })
    }
    setCustomCategoryInput('')
    setShowCustomInput(false)
  }

  const removeCategory = (c: string) => {
    setF({ ...f, category_slugs: f.category_slugs.filter((x) => x !== c) })
  }

  // Form submit
  const save = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!user || store.seller_id !== user.id) {
      alert('You can only update your own store.')
      return
    }
    await stores.update(store.id, {
      ...f,
      logo_initials: f.name.trim().split(/\s+/).slice(0, 2).map((w) => w[0]).join(''),
    })
    if (f.logo_url && user) {
      await auth.updateProfile(user.id, { avatar_url: f.logo_url })
      await refreshProfile()
    }
    setSaved(true)
    setTimeout(() => setSaved(false), 2200)
  }

  return (
    <form onSubmit={save} className="max-w-3xl space-y-5">
      {/* ── Store Header Card with Banner & Profile Image ── */}
      <div className="card overflow-hidden shadow-xs">
        {/* Banner with Device Upload Overlay */}
        <div className="relative h-44 sm:h-52 w-full overflow-hidden bg-surface-2 group">
          {f.banner ? (
            <img src={f.banner} alt={f.name} className="h-full w-full object-cover" />
          ) : (
            <div className="h-full w-full bg-gradient-to-br from-brand/40 via-surface-2 to-gold/40 flex items-center justify-center text-xs text-muted">
              No store banner set yet
            </div>
          )}
          <div className="absolute inset-0 bg-gradient-to-t from-[var(--surface)] via-black/20 to-transparent" aria-hidden />

          {bannerUploading && (
            <div className="absolute inset-0 z-20 grid place-items-center bg-black/60 text-white">
              <div className="flex items-center gap-2 rounded-2xl bg-black/80 px-4 py-2 text-xs font-bold backdrop-blur">
                <Loader2 size={16} className="animate-spin text-gold" />
                <span>Uploading banner from device...</span>
              </div>
            </div>
          )}

          {/* Quick banner actions on image */}
          <div className="absolute top-3 right-3 z-10 flex items-center gap-2">
            <label className="inline-flex cursor-pointer items-center gap-1.5 rounded-full bg-black/60 hover:bg-black/85 backdrop-blur-md px-3.5 py-1.5 text-xs font-bold text-white transition border border-white/20 shadow-md">
              <Upload size={13} />
              <span>{f.banner ? 'Change banner' : 'Upload banner from device'}</span>
              <input
                type="file"
                accept="image/jpeg,image/png,image/webp,.jpg,.jpeg,.png,.webp"
                className="sr-only"
                onChange={(e) => handleBannerFile(e.target.files)}
                disabled={bannerUploading}
              />
            </label>
            {f.banner && (
              <button
                type="button"
                onClick={handleRemoveBanner}
                className="inline-flex items-center gap-1 rounded-full bg-black/60 hover:bg-rose-600/80 backdrop-blur-md p-1.5 text-white transition border border-white/20 shadow-md"
                title="Remove banner"
              >
                <Trash2 size={13} />
              </button>
            )}
          </div>

          {bannerSuccess && (
            <div className="absolute bottom-3 right-3 z-10">
              <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-600 px-3 py-1 text-xs font-bold text-white shadow-md">
                <CheckCircle2 size={13} /> Banner updated!
              </span>
            </div>
          )}
        </div>

        {/* Profile Details & Profile Image Upload */}
        <div className="p-6">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              {/* Profile Image / Store Logo with Upload Overlay */}
              <div className="relative shrink-0 group/avatar">
                {f.logo_url ? (
                  <img
                    src={f.logo_url}
                    alt={f.name}
                    className="h-16 w-16 sm:h-20 sm:w-20 rounded-2xl object-cover border-2 border-brand/30 shadow-md ring-2 ring-gold/20"
                  />
                ) : (
                  <span
                    className="grid h-16 w-16 sm:h-20 sm:w-20 place-items-center rounded-2xl font-display text-xl sm:text-2xl font-bold text-white shadow-md"
                    style={{ background: f.logo_color }}
                  >
                    {f.name.slice(0, 2).toUpperCase()}
                  </span>
                )}

                {logoUploading && (
                  <div className="absolute inset-0 grid place-items-center rounded-2xl bg-black/60 text-white">
                    <Loader2 size={20} className="animate-spin text-gold" />
                  </div>
                )}

                <label
                  className="absolute -bottom-1 -right-1 grid h-7 w-7 cursor-pointer place-items-center rounded-full bg-brand text-onbrand shadow-md hover:scale-105 transition"
                  title="Upload profile photo from device"
                >
                  <Camera size={13} />
                  <input
                    type="file"
                    accept="image/jpeg,image/png,image/webp,.jpg,.jpeg,.png,.webp"
                    className="sr-only"
                    onChange={(e) => handleLogoFile(e.target.files)}
                    disabled={logoUploading}
                  />
                </label>
              </div>

              <div>
                <p className="font-semibold text-lg">{store.name}</p>
                <p className="text-xs text-faint">/{store.slug} · seller: @{seller?.username}</p>

                {/* Profile image action links */}
                <div className="mt-1.5 flex flex-wrap items-center gap-2">
                  <label className="inline-flex cursor-pointer items-center gap-1 rounded-lg border border-line bg-surface-2 px-2.5 py-1 text-[0.72rem] font-semibold text-fg transition hover:border-brand hover:bg-surface shadow-2xs">
                    <Camera size={12} className="text-brand" />
                    <span>{f.logo_url ? 'Change profile photo' : 'Upload profile photo'}</span>
                    <input
                      type="file"
                      accept="image/jpeg,image/png,image/webp,.jpg,.jpeg,.png,.webp"
                      className="sr-only"
                      onChange={(e) => handleLogoFile(e.target.files)}
                      disabled={logoUploading}
                    />
                  </label>
                  {f.logo_url && (
                    <button
                      type="button"
                      onClick={handleRemoveLogo}
                      className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-[0.72rem] text-rose-500 hover:bg-rose-500/10 transition"
                    >
                      <Trash2 size={12} /> Remove
                    </button>
                  )}
                  {logoSuccess && (
                    <span className="inline-flex items-center gap-1 text-[0.72rem] font-bold text-emerald-600">
                      <CheckCircle2 size={12} /> Saved!
                    </span>
                  )}
                </div>
                {logoErr && <p className="mt-1 text-xs text-rose-500">{logoErr}</p>}
              </div>
            </div>

            <div className="flex gap-2.5 items-center">
              {store.is_approved && (
                <Button to={`/store/${store.slug}`} variant="ghost" size="sm">
                  View public store
                </Button>
              )}
              <BadgeStatus approved={store.is_approved} />
            </div>
          </div>
        </div>
      </div>

      {/* ── Main Store Form ── */}
      <div className="card space-y-6 p-6">
        <Field2
          label="Store name"
          id="store-name"
          name="name"
          required
          value={f.name}
          onChange={(v) => setF({ ...f, name: v })}
        />

        <Field2
          label="Description"
          id="store-description"
          name="description"
          required
          textarea
          rows={4}
          value={f.description}
          onChange={(v) => setF({ ...f, description: v })}
        />

        {/* ── Categories & Details Grid ── */}
        <div className="grid gap-6 sm:grid-cols-2">
          {/* Categories Selector with Dropdown + Other + Free-typing */}
          <div className="space-y-3">
            <div>
              <span className="block text-[0.8rem] font-semibold text-muted">
                Categories <span className="text-crimson">*</span>
              </span>
              <p className="text-[0.72rem] text-faint">
                Select from dropdown or type your own custom categories
              </p>
            </div>

            {/* Category Dropdown with "Other" */}
            <div className="relative">
              <select
                id="store-category-dropdown"
                value=""
                onChange={(e) => handleCategoryDropdownChange(e.target.value)}
                className="field text-sm cursor-pointer pr-8"
              >
                <option value="">-- Select a category to add --</option>
                <optgroup label="Crafts & Textiles">
                  <option value="balochi-doch">Balochi Doch & Embroidery</option>
                  <option value="traditional-clothing">Traditional Clothing</option>
                  <option value="handicrafts">Handicrafts & Pottery</option>
                  <option value="decorative-items">Decorative Items & Artifacts</option>
                  <option value="handmade-products">Handmade Products</option>
                </optgroup>
                <optgroup label="Jewelry & Heritage">
                  <option value="jewelry">Jewelry & Gemstones</option>
                  <option value="cultural-products">Cultural Artifacts & Heritage</option>
                </optgroup>
                <optgroup label="Art & Creative">
                  <option value="calligraphy">Calligraphy & Fine Art</option>
                  <option value="painters">Painters & Canvas Art</option>
                  <option value="sketch-artists">Sketch Artists</option>
                  <option value="photographers">Photographers & Studios</option>
                  <option value="designers">Designers & Fashion</option>
                  <option value="writers">Writers & Literature</option>
                  <option value="books">Books & Publications</option>
                </optgroup>
                <optgroup label="Food & Herbs">
                  <option value="traditional-food">Traditional Food & Feast</option>
                  <option value="balochi-herbs">Balochi Herbs & Remedies</option>
                  <option value="balochi-recipes">Balochi Recipes & Spices</option>
                </optgroup>
                {dynamicCategories.length > 0 && (
                  <optgroup label="Platform Categories">
                    {dynamicCategories.map((c) => (
                      <option key={c.slug} value={c.slug}>
                        {c.name}
                      </option>
                    ))}
                  </optgroup>
                )}
                <option value="__other__">➕ Other (Type your own category...)</option>
              </select>
            </div>

            {/* Custom Category Type-in Field */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <span className="text-[0.72rem] font-semibold text-muted">
                  Type your custom category:
                </span>
                {!showCustomInput && (
                  <button
                    type="button"
                    onClick={() => setShowCustomInput(true)}
                    className="text-[0.72rem] text-gold hover:underline font-semibold"
                  >
                    + Add Custom Category
                  </button>
                )}
              </div>

              {(showCustomInput || f.category_slugs.length === 0) && (
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={customCategoryInput}
                    onChange={(e) => setCustomCategoryInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault()
                        handleAddCustomCategory()
                      }
                    }}
                    placeholder="Type category (e.g. Leather Bags, Camel Rugs)..."
                    className="field text-xs flex-1"
                  />
                  <Button
                    type="button"
                    size="sm"
                    variant="gold"
                    onClick={handleAddCustomCategory}
                    disabled={!customCategoryInput.trim()}
                  >
                    <Plus size={14} className="mr-1" /> Add
                  </Button>
                </div>
              )}
            </div>

            {/* Active Selected Category Badges with Removable Cross */}
            <div className="space-y-1.5 pt-1">
              <span className="text-[0.72rem] font-semibold text-muted block">
                Selected categories ({f.category_slugs.length}):
              </span>
              {f.category_slugs.length === 0 ? (
                <p className="text-xs text-faint italic">
                  No categories chosen yet. Select one above.
                </p>
              ) : (
                <div className="flex flex-wrap gap-1.5">
                  {f.category_slugs.map((c) => (
                    <span
                      key={c}
                      className="inline-flex items-center gap-1.5 rounded-full border border-gold/50 bg-gold/15 px-3 py-1 text-xs font-semibold text-gold shadow-2xs"
                    >
                      <span className="capitalize">{c.replace(/-/g, ' ')}</span>
                      <button
                        type="button"
                        onClick={() => removeCategory(c)}
                        className="rounded-full p-0.5 text-muted hover:bg-gold/30 hover:text-fg transition"
                        aria-label={`Remove category ${c}`}
                      >
                        <X size={12} />
                      </button>
                    </span>
                  ))}
                </div>
              )}
            </div>

            {/* Popular quick-toggle pills */}
            <div className="pt-2 border-t border-line/60">
              <span className="text-[0.7rem] text-faint block mb-1.5">
                Popular categories (click to toggle):
              </span>
              <div className="flex flex-wrap gap-1.5 max-h-28 overflow-y-auto pr-1">
                {PREDEFINED_CATEGORIES.slice(0, 10).map((c) => {
                  const on = f.category_slugs.includes(c.slug)
                  return (
                    <button
                      key={c.slug}
                      type="button"
                      onClick={() =>
                        setF({
                          ...f,
                          category_slugs: on
                            ? f.category_slugs.filter((x) => x !== c.slug)
                            : [...f.category_slugs, c.slug],
                        })
                      }
                      className={`rounded-full border px-2.5 py-0.5 text-[0.7rem] font-medium transition ${
                        on
                          ? 'border-gold bg-gold/15 text-gold'
                          : 'border-line text-muted hover:border-gold/40'
                      }`}
                    >
                      {c.label.split('&')[0].trim()}
                    </button>
                  )
                })}
              </div>
            </div>
          </div>

          {/* Location, WhatsApp & Brand Colour */}
          <div className="space-y-5">
            <Field2
              label="Location"
              id="store-location"
              name="location"
              required
              value={f.location}
              onChange={(v) => setF({ ...f, location: v })}
            />

            <Field2
              label="WhatsApp (optional)"
              id="store-whatsapp"
              name="whatsapp"
              value={f.whatsapp_number}
              onChange={(v) => setF({ ...f, whatsapp_number: v })}
            />
            <p className="text-[0.7rem] text-faint">
              Order WhatsApp alerts are sent only after this number is verified by the platform and a WhatsApp Business integration is configured. Saving a number here does not verify it.
            </p>

            <fieldset>
              <legend className="mb-2 text-[0.8rem] font-semibold text-muted">
                Brand colour
              </legend>
              <div className="flex gap-2.5">
                {COLORS.map((c) => (
                  <button
                    key={c}
                    type="button"
                    onClick={() => setF({ ...f, logo_color: c })}
                    aria-label={`Colour ${c}`}
                    className={`h-9 w-9 rounded-full transition ${
                      f.logo_color === c
                        ? 'ring-2 ring-gold ring-offset-2 ring-offset-[var(--surface)]'
                        : ''
                    }`}
                    style={{ background: c }}
                  />
                ))}
              </div>
            </fieldset>
          </div>
        </div>

        {/* ── Store Banner Section: Device Upload + Curated Gallery ── */}
        <div className="space-y-3 border-t border-line pt-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <label className="block text-[0.8rem] font-semibold text-muted">
                Store Banner
              </label>
              <p className="text-[0.72rem] text-faint">
                Upload your bespoke store banner from your device or choose from our authentic Balochi curated gallery
              </p>
            </div>

            {/* Banner Mode Switcher */}
            <div className="inline-flex rounded-full border border-line bg-surface-2 p-1">
              <button
                type="button"
                onClick={() => setBannerTab('upload')}
                className={`inline-flex items-center gap-1.5 rounded-full px-3.5 py-1 text-xs font-semibold transition ${
                  bannerTab === 'upload'
                    ? 'bg-brand text-onbrand shadow-xs'
                    : 'text-muted hover:text-fg'
                }`}
              >
                <Upload size={13} /> Upload from Device
              </button>
              <button
                type="button"
                onClick={() => setBannerTab('gallery')}
                className={`inline-flex items-center gap-1.5 rounded-full px-3.5 py-1 text-xs font-semibold transition ${
                  bannerTab === 'gallery'
                    ? 'bg-brand text-onbrand shadow-xs'
                    : 'text-muted hover:text-fg'
                }`}
              >
                <Sparkles size={13} /> Curated Balochi Gallery
              </button>
            </div>
          </div>

          {bannerErr && <p className="text-xs text-rose-500">{bannerErr}</p>}

          {/* Tab 1: Upload from Device */}
          {bannerTab === 'upload' && (
            <div className="rounded-2xl border border-dashed border-line bg-surface-2/40 p-5 text-center transition hover:border-brand/50">
              {f.banner ? (
                <div className="space-y-4">
                  <div className="relative aspect-[21/7] sm:aspect-[16/5] w-full overflow-hidden rounded-xl border border-line shadow-inner">
                    <img
                      src={f.banner}
                      alt={f.name}
                      className="h-full w-full object-cover"
                    />
                    <div className="absolute top-2.5 left-2.5">
                      <span className="rounded-full bg-emerald-600/90 backdrop-blur px-2.5 py-1 text-[0.68rem] font-bold text-white shadow-xs">
                        ✓ Current Banner
                      </span>
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center justify-center gap-3">
                    <label className="inline-flex cursor-pointer items-center gap-1.5 rounded-xl border border-line bg-surface px-4 py-2 text-xs font-bold text-fg transition hover:border-brand hover:bg-surface-2 shadow-xs">
                      <Upload size={14} className="text-brand" />
                      <span>Upload different image from device</span>
                      <input
                        type="file"
                        accept="image/jpeg,image/png,image/webp,.jpg,.jpeg,.png,.webp"
                        className="sr-only"
                        onChange={(e) => handleBannerFile(e.target.files)}
                        disabled={bannerUploading}
                      />
                    </label>
                    <button
                      type="button"
                      onClick={handleRemoveBanner}
                      className="inline-flex items-center gap-1 rounded-xl px-3 py-2 text-xs font-semibold text-rose-500 hover:bg-rose-500/10 transition"
                    >
                      <Trash2 size={13} /> Remove banner
                    </button>
                  </div>
                </div>
              ) : (
                <div className="space-y-3 py-4">
                  <div className="mx-auto grid h-12 w-12 place-items-center rounded-2xl bg-brand/10 text-brand">
                    <Upload size={24} />
                  </div>
                  <div>
                    <p className="text-sm font-bold text-fg">
                      Upload your store banner from device
                    </p>
                    <p className="mt-1 text-xs text-muted">
                      Recommended: 1200×400 or 16:6 landscape ratio. JPG, PNG or WEBP up to 5 MB.
                    </p>
                  </div>
                  <label className="inline-flex cursor-pointer items-center gap-2 rounded-xl bg-brand hover:opacity-95 px-4 py-2 text-xs font-bold text-onbrand transition shadow-xs">
                    <Upload size={14} />
                    <span>Choose image from device</span>
                    <input
                      type="file"
                      accept="image/jpeg,image/png,image/webp,.jpg,.jpeg,.png,.webp"
                      className="sr-only"
                      onChange={(e) => handleBannerFile(e.target.files)}
                      disabled={bannerUploading}
                    />
                  </label>
                </div>
              )}
            </div>
          )}

          {/* Tab 2: Curated Balochi Gallery */}
          {bannerTab === 'gallery' && (
            <div className="rounded-2xl border border-line bg-surface-2/20 p-4">
              <StoreBannerGallery
                selectedBanner={f.banner}
                storeName={f.name}
                onSelect={(b) => setF({ ...f, banner: b })}
              />
            </div>
          )}
        </div>

        {/* ── Submit Strip ── */}
        <div className="flex items-center gap-4 border-t border-line pt-5">
          <Button type="submit" variant="primary">
            Save store profile
          </Button>
          {saved && (
            <span className="inline-flex items-center gap-1 text-sm font-semibold text-emerald-500">
              <CheckCircle2 size={15} /> Store profile saved successfully!
            </span>
          )}
        </div>
      </div>
    </form>
  )
}

function Field2({ label, id, name, value, onChange, required, textarea, rows }: {
  label: string; id?: string; name?: string; value: string; onChange: (v: string) => void; required?: boolean; textarea?: boolean; rows?: number
}) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-[0.8rem] font-semibold text-muted">{label} {required && <span className="text-crimson">*</span>}</span>
      {textarea
        ? <textarea id={id} name={name} className="field resize-none" rows={rows ?? 3} value={value} onChange={(e) => onChange(e.target.value)} required={required} />
        : <input id={id} name={name} className="field" value={value} onChange={(e) => onChange(e.target.value)} required={required} />}
    </label>
  )
}

function BadgeStatus({ approved }: { approved: boolean }) {
  return approved
    ? <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-3 py-1 text-xs font-bold text-emerald-500"><Check size={13} /> Approved</span>
    : <span className="inline-flex items-center gap-1.5 rounded-full border border-amber-500/30 bg-amber-500/10 px-3 py-1 text-xs font-bold text-amber-500">Under review</span>
}
