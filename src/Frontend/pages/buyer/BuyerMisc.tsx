import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Camera, Check, CheckCircle2, Loader2, MapPin, Star, Store, Trash2, Upload, X } from 'lucide-react'
import { Badge, Button, EmptyState, Field, Reveal, Toggle } from '@/components/ui'
import { addresses as addrApi, auth, emailSubscribers, storage, stores } from '@/lib/db'
import { useAuth, useDb, THEME_OPTIONS, useTheme } from '@/lib/providers'
import { StoreBannerGallery } from '@/components/shared/StoreBannerGallery'

/* ── Profile ──────────────────────────────────────────────────── */
const COLORS = ['#0d7d76', '#b9821f', '#a4123f', '#5c4a7d', '#0f5d8a', '#3f7d3a']

export function BuyerProfile() {
  const { user, refreshProfile } = useAuth()
  useDb()
  const [saved, setSaved] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [uploadErr, setUploadErr] = useState('')
  const [f, setF] = useState(() => ({
    full_name: user?.full_name ?? '', username: user?.username ?? '',
    bio: user?.bio ?? '', location: user?.location ?? '', phone: user?.phone ?? '',
    avatar_color: user?.avatar_color ?? '#0d7d76',
    avatar_url: user?.avatar_url ?? '',
  }))
  if (!user) return null

  const handleAvatarFile = async (files: FileList | null) => {
    const file = files?.[0]
    if (!file) return
    setUploadErr('')
    setUploading(true)
    try {
      const url = await storage.uploadUserAvatar(file, user.id)
      setF((prev) => ({ ...prev, avatar_url: url }))
      await auth.updateProfile(user.id, { avatar_url: url })
      await refreshProfile()
    } catch (err) {
      setUploadErr(err instanceof Error ? err.message : 'Could not upload profile image.')
    } finally {
      setUploading(false)
    }
  }

  const handleRemoveAvatar = async () => {
    setF((prev) => ({ ...prev, avatar_url: '' }))
    await auth.updateProfile(user.id, { avatar_url: '' })
    await refreshProfile()
  }

  const save = async (e: React.FormEvent) => {
    e.preventDefault()
    await auth.updateProfile(user.id, f)
    await refreshProfile()
    setSaved(true)
    setTimeout(() => setSaved(false), 2200)
  }

  return (
    <form onSubmit={save} className="card max-w-2xl space-y-6 p-4 sm:p-7">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:gap-6 pb-2 border-b border-line">
        <div className="relative shrink-0">
          {f.avatar_url ? (
            <img
              src={f.avatar_url}
              alt={f.full_name}
              className="h-20 w-20 rounded-2xl object-cover border-2 border-brand/30 shadow-md"
            />
          ) : (
            <span
              className="grid h-20 w-20 place-items-center rounded-2xl font-display text-2xl font-bold text-white shadow-md"
              style={{ background: `linear-gradient(135deg, ${f.avatar_color}, ${f.avatar_color}bb)` }}
            >
              {f.full_name.split(' ').slice(0, 2).map((w) => w[0]).join('')}
            </span>
          )}
          {uploading && (
            <div className="absolute inset-0 grid place-items-center rounded-2xl bg-black/50 text-white">
              <Loader2 size={24} className="animate-spin" />
            </div>
          )}
        </div>

        <div className="min-w-0 flex-1 space-y-2">
          <div className="flex flex-wrap items-center gap-2.5">
            <label className="inline-flex cursor-pointer items-center gap-1.5 rounded-xl border border-line bg-surface-2 px-3 py-1.5 text-xs font-semibold text-fg transition hover:border-brand hover:bg-surface shadow-2xs">
              <Camera size={14} className="text-brand" />
              <span>{f.avatar_url ? 'Change profile photo' : 'Upload profile photo'}</span>
              <input
                type="file"
                accept="image/jpeg,image/png,image/webp,.jpg,.jpeg,.png,.webp"
                className="sr-only"
                onChange={(e) => handleAvatarFile(e.target.files)}
                disabled={uploading}
              />
            </label>
            {f.avatar_url && (
              <button
                type="button"
                onClick={handleRemoveAvatar}
                className="inline-flex items-center gap-1 rounded-xl px-2.5 py-1.5 text-xs text-rose-500 hover:bg-rose-500/10 transition"
              >
                <X size={13} /> Remove
              </button>
            )}
          </div>
          <p className="text-[0.72rem] text-faint">JPG, PNG or WEBP · up to 5 MB from your device</p>
          {uploadErr && <p className="text-xs text-rose-500">{uploadErr}</p>}
          <div className="flex flex-wrap gap-2 pt-1">
            <Badge tone="brand">{user.role}</Badge>
            <Badge>Member since {new Date(user.created_at).toLocaleDateString('en-GB', { month: 'short', year: 'numeric' })}</Badge>
          </div>
        </div>
      </div>

      <div className="grid gap-5 sm:grid-cols-2">
        <Field label="Full name" required><input id="profile-full-name" name="full_name" className="field" value={f.full_name} onChange={(e) => setF({ ...f, full_name: e.target.value })} required /></Field>
        <Field label="Username" required><input id="profile-username" name="username" className="field" value={f.username} onChange={(e) => setF({ ...f, username: e.target.value })} required /></Field>
        <Field label="Location"><input id="profile-location" name="location" className="field" value={f.location} onChange={(e) => setF({ ...f, location: e.target.value })} placeholder="Quetta, Pakistan" /></Field>
        <Field label="Phone"><input id="profile-phone" name="phone" className="field" value={f.phone} onChange={(e) => setF({ ...f, phone: e.target.value })} placeholder="+92 …" /></Field>
      </div>
      <Field label="Bio"><textarea id="profile-bio" name="bio" className="field resize-none" rows={3} value={f.bio} onChange={(e) => setF({ ...f, bio: e.target.value })} placeholder="A line about you…" /></Field>
      <fieldset>
        <legend className="mb-2 text-[0.8rem] font-semibold text-muted">Avatar colour</legend>
        <div className="flex gap-2.5">
          {COLORS.map((c) => (
            <button key={c} type="button" onClick={() => setF({ ...f, avatar_color: c })} aria-label={`Colour ${c}`}
              className={`grid h-9 w-9 place-items-center rounded-full transition ${f.avatar_color === c ? 'ring-2 ring-gold ring-offset-2 ring-offset-[var(--surface)]' : ''}`}
              style={{ background: c }}>
              {f.avatar_color === c && <Check size={15} className="text-white" />}
            </button>
          ))}
        </div>
      </fieldset>

      <div className="flex items-center gap-4">
        <Button type="submit" variant="primary">Save changes</Button>
        {saved && <span className="inline-flex items-center gap-1.5 text-sm text-emerald-500"><CheckCircle2 size={15} /> Saved!</span>}
      </div>
    </form>
  )
}

/* ── Settings ─────────────────────────────────────────────────── */
export function BuyerSettings() {
  const { user } = useAuth()
  const { theme, setTheme } = useTheme()
  const [pw, setPw] = useState({ current: '', next: '', confirm: '' })
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null)
  const [prefs, setPrefs] = useState(() => {
    try { return JSON.parse(localStorage.getItem('beh-prefs') ?? '{}') } catch { return {} }
  })
  if (!user) return null

  const savePrefs = (p: typeof prefs) => {
    setPrefs(p)
    try { localStorage.setItem('beh-prefs', JSON.stringify(p)) } catch { /* noop */ }
  }

  const changePw = async (e: React.FormEvent) => {
    e.preventDefault()
    if (pw.next !== pw.confirm) return setMsg({ ok: false, text: 'New passwords do not match.' })
    const err = await auth.changePassword(user.id, pw.current, pw.next)
    setMsg(err ? { ok: false, text: err } : { ok: true, text: 'Password updated.' })
    if (!err) setPw({ current: '', next: '', confirm: '' })
  }

  return (
    <div className="max-w-2xl space-y-6">
      <section className="card space-y-5 p-7" aria-labelledby="set-appearance">
        <h3 id="set-appearance" className="font-display text-lg font-semibold">Appearance</h3>
        <p className="text-xs text-muted">Choose a theme. Your selection is saved on this device.</p>
        <div className="grid gap-3 sm:grid-cols-3">
          {THEME_OPTIONS.map((opt) => (
            <button
              key={opt.id}
              type="button"
              onClick={() => setTheme(opt.id)}
              className={`rounded-2xl border p-4 text-left transition ${theme === opt.id ? 'border-gold bg-gold/10' : 'border-line hover:border-gold/40'}`}
            >
              <span className="block text-sm font-semibold">{opt.label}</span>
              <span className="mt-1 block text-xs text-muted">{opt.hint}</span>
            </button>
          ))}
        </div>
      </section>

      <section className="card space-y-5 p-7" aria-labelledby="set-notif">
        <h3 id="set-notif" className="font-display text-lg font-semibold">Notifications</h3>
        {[
          { key: 'orders', label: 'Order updates', sub: 'Status changes, shipping, delivery' },
          { key: 'messages', label: 'New messages', sub: 'When a buyer or seller writes to you' },
          { key: 'reviews', label: 'Reviews & ratings', sub: 'When someone reviews your items' },
          { key: 'marketing', label: 'New product emails', sub: 'Only sent if you subscribe below' },
        ].map((n) => (
          <div key={n.key} className="flex items-center justify-between gap-4">
            <div>
              <p className="text-sm font-semibold">{n.label}</p>
              <p className="text-xs text-muted">{n.sub}</p>
            </div>
            <Toggle checked={prefs[n.key] !== false} onChange={(v) => savePrefs({ ...prefs, [n.key]: v })} label={n.label} />
          </div>
        ))}
        <EmailSubscribeRow defaultEmail={user.email} />
      </section>

      <section className="card space-y-5 p-7" aria-labelledby="set-pw">
        <h3 id="set-pw" className="font-display text-lg font-semibold">Change password</h3>
        <form onSubmit={changePw} className="grid gap-4 sm:grid-cols-3">
          <Field label="Current" required><input id="settings-pw-current" name="current_password" type="password" className="field" value={pw.current} onChange={(e) => setPw({ ...pw, current: e.target.value })} required /></Field>
          <Field label="New" required><input id="settings-pw-new" name="new_password" type="password" className="field" value={pw.next} onChange={(e) => setPw({ ...pw, next: e.target.value })} required minLength={8} /></Field>
          <Field label="Confirm new" required><input id="settings-pw-confirm" name="confirm_password" type="password" className="field" value={pw.confirm} onChange={(e) => setPw({ ...pw, confirm: e.target.value })} required /></Field>
          {msg && <p className={`text-sm sm:col-span-3 ${msg.ok ? 'text-emerald-500' : 'text-rose-500'}`}>{msg.text}</p>}
          <div className="sm:col-span-3"><Button type="submit" variant="primary" size="sm">Update password</Button></div>
        </form>
      </section>


    </div>
  )
}

function EmailSubscribeRow({ defaultEmail }: { defaultEmail: string }) {
  const [email, setEmail] = useState(defaultEmail)
  const [status, setStatus] = useState('')
  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    try {
      await emailSubscribers.subscribe(email)
      setStatus('Subscribed — you will receive new-product emails.')
    } catch (err: any) {
      setStatus(err?.message ?? 'Could not subscribe.')
    }
  }
  return (
    <form onSubmit={submit} className="space-y-2 border-t border-line pt-4">
      <Field label="Product announcement email">
        <input className="field" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
      </Field>
      <Button type="submit" size="sm" variant="gold">Subscribe</Button>
      {status && <p className="text-xs text-muted">{status}</p>}
    </form>
  )
}

/* ── Addresses ────────────────────────────────────────────────── */
export function BuyerAddresses() {
  const { user } = useAuth()
  useDb()
  const [editing, setEditing] = useState<string | 'new' | null>(null)
  if (!user) return null
  const list = addrApi.list(user.id)
  const blank = { label: '', full_name: user.full_name, phone: user.phone ?? '', line1: '', city: '', state: '', country: 'Pakistan', is_default: list.length === 0 }

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted">{list.length} saved address{list.length === 1 ? '' : 'es'}</p>
        <Button size="sm" variant="gold" onClick={() => setEditing('new')}>+ Add address</Button>
      </div>

      {list.length === 0 && editing !== 'new' && (
        <EmptyState icon={<MapPin size={24} />} title="No addresses yet" sub="Save a delivery address for one-tap checkout." />
      )}

      <div className="grid gap-4 sm:grid-cols-2">
        {list.map((a) => (
          <div key={a.id} className={`card p-5 ${a.is_default ? 'border-gold/50' : ''}`}>
            <div className="flex items-center justify-between gap-2">
              <p className="font-semibold">{a.label}{a.is_default && <Badge tone="gold" className="ml-2">Default</Badge>}</p>
              <div className="flex gap-1">
                <button onClick={() => setEditing(a.id)} className="rounded-lg px-2.5 py-1 text-xs font-semibold text-brand hover:bg-surface-2 dark:text-gold">Edit</button>
                <button onClick={() => addrApi.remove(a.id)} className="rounded-lg px-2 py-1 text-rose-500 hover:bg-rose-500/10" aria-label={`Delete ${a.label}`}><Trash2 size={14} /></button>
              </div>
            </div>
            <p className="mt-2 text-sm text-muted">{a.full_name} · {a.phone}</p>
            <p className="text-sm text-muted">{a.line1}, {a.city}, {a.state}, {a.country}</p>
            {!a.is_default && (
              <button onClick={() => addrApi.setDefault(user.id, a.id)} className="mt-3 text-xs font-semibold text-gold hover:underline">Set as default</button>
            )}
          </div>
        ))}
      </div>

      {editing && (
        <AddressForm
          initial={editing === 'new' ? blank : { ...list.find((a) => a.id === editing)! }}
          onCancel={() => setEditing(null)}
          onSave={(addr) => {
            addrApi.save(user.id, editing === 'new' ? addr : { ...addr, id: editing })
            setEditing(null)
          }}
        />
      )}
    </div>
  )
}

function AddressForm({ initial, onSave, onCancel }: {
  initial: { label: string; full_name: string; phone: string; line1: string; city: string; state: string; country: string; is_default: boolean }
  onSave: (a: typeof initial) => void
  onCancel: () => void
}) {
  const [f, setF] = useState(initial)
  return (
    <form onSubmit={(e) => { e.preventDefault(); onSave(f) }} className="card grid gap-4 p-6 sm:grid-cols-2">
      <Field label="Label" required><input id="addr-label" name="label" className="field" value={f.label} onChange={(e) => setF({ ...f, label: e.target.value })} placeholder="Home / Office" required /></Field>
      <Field label="Full name" required><input className="field" value={f.full_name} onChange={(e) => setF({ ...f, full_name: e.target.value })} required /></Field>
      <Field label="Phone" required><input id="addr-phone" name="phone" className="field" value={f.phone} onChange={(e) => setF({ ...f, phone: e.target.value })} required /></Field>
      <Field label="City" required><input id="addr-city" name="city" className="field" value={f.city} onChange={(e) => setF({ ...f, city: e.target.value })} required /></Field>
      <Field label="Address line" required><input id="addr-line1" name="line1" className="field sm:col-span-2" value={f.line1} onChange={(e) => setF({ ...f, line1: e.target.value })} required /></Field>
      <Field label="Province / State" required><input id="addr-state" name="state" className="field" value={f.state} onChange={(e) => setF({ ...f, state: e.target.value })} required /></Field>
      <Field label="Country" required><input id="addr-country" name="country" className="field" value={f.country} onChange={(e) => setF({ ...f, country: e.target.value })} required /></Field>
      <label className="flex items-center gap-3 text-sm sm:col-span-2">
        <input id="addr-is-default" name="is_default" type="checkbox" checked={f.is_default} onChange={(e) => setF({ ...f, is_default: e.target.checked })} className="h-4 w-4 accent-[var(--brand)]" />
        Use as default delivery address
      </label>
      <div className="flex gap-3 sm:col-span-2">
        <Button type="submit" variant="primary" size="sm">Save address</Button>
        <Button variant="ghost" size="sm" onClick={onCancel}>Cancel</Button>
      </div>
    </form>
  )
}

/* ── Become a Seller ──────────────────────────────────────────── */
const BANNERS = ['/images/doch-closeup.jpg', '/images/cat-painting.jpg', '/images/cat-food.jpg', '/images/cat-jewelry.jpg', '/images/cat-herbs.jpg', '/images/cat-calligraphy.jpg']

export function BecomeSeller() {
  const { user, refreshProfile } = useAuth()
  useDb()
  const [step, setStep] = useState(0)
  const [done, setDone] = useState(false)
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [f, setF] = useState({
    name: '', description: '', category: 'balochi-doch', location: user?.location ?? 'Quetta, Pakistan',
    logo_color: '#0d7d76', banner: '/images/banners/balochi-doch-textiles.jpg',
  })
  const [creatingAnother, setCreatingAnother] = useState(false)
  if (!user) return null
  const owned = stores.listBySeller(user.id)
  const existing = owned[0]
  const atLimit = owned.length >= 2

  if (done) {
    return (
      <Reveal>
        <div className="card mx-auto max-w-xl overflow-hidden p-0 text-center">
          <div className="bg-gradient-to-br from-gold to-[#8a5a0f] p-10 text-white">
            <span className="mx-auto mb-4 grid h-16 w-16 place-items-center rounded-full bg-white/20"><Star size={28} /></span>
            <h3 className="font-display text-2xl font-semibold">Store submitted! 🎉</h3>
          </div>
          <div className="p-8">
            <p className="text-sm leading-relaxed text-muted">
              <strong className="text-fg">{f.name}</strong> is being reviewed by the platform team — usually within
              48 hours. Meanwhile, you can set up products in Seller Studio; they go live the moment your store is approved.
            </p>
            <div className="mt-6 flex justify-center gap-3">
              <Button to="/seller" variant="gold">Open Seller Studio</Button>
              <Button to="/" variant="ghost">Back to home</Button>
            </div>
          </div>
        </div>
      </Reveal>
    )
  }

  if (atLimit && !creatingAnother) {
    return (
      <div className="card mx-auto max-w-xl p-8 text-center">
        <span className="mx-auto mb-4 grid h-16 w-16 place-items-center rounded-full bg-gold/15 text-gold"><Store size={28} /></span>
        <h3 className="font-display text-2xl font-semibold">Store limit reached</h3>
        <p className="mt-2 text-sm text-muted">You can create a maximum of 2 stores per account.</p>
        <ul className="mt-4 space-y-2 text-sm">
          {owned.map((s) => (
            <li key={s.id}><strong>{s.name}</strong> — {s.is_approved ? 'live' : 'under review'}</li>
          ))}
        </ul>
        <div className="mt-6 flex justify-center gap-3">
          <Button to="/seller" variant="gold" size="sm">Open Seller Studio</Button>
        </div>
      </div>
    )
  }

  if (existing && !creatingAnother) {
    return (
      <div className="card mx-auto max-w-xl p-8 text-center">
        <span className="mx-auto mb-4 grid h-16 w-16 place-items-center rounded-full bg-gold/15 text-gold"><Store size={28} /></span>
        <h3 className="font-display text-2xl font-semibold">{existing.name}</h3>
        <p className="mt-2 text-sm text-muted">
          {existing.is_approved ? 'Your store is live and selling.' : 'Your store is under review — usually approved within 48 hours.'}
        </p>
        <p className="mt-2 text-xs text-faint">You can create one more store on this account ({owned.length}/2).</p>
        <div className="mt-6 flex justify-center gap-3">
          {existing.is_approved && <Button to={`/store/${existing.slug}`} variant="ghost" size="sm">View public store</Button>}
          <Button to="/seller" variant="gold" size="sm">Open Seller Studio</Button>
          <Button variant="ghost" size="sm" onClick={() => setCreatingAnother(true)}>Create second store</Button>
        </div>
      </div>
    )
  }

  const steps = ['The basics', 'Your store', 'Review & submit']
  const submit = async () => {
    if (submitting) return
    if (!f.name.trim() || !f.description.trim()) {
      setError('Please give your store a name and description.')
      setStep(1)
      return
    }
    setSubmitting(true)
    setError('')
    try {
      const res = await auth.becomeSeller(user.id, f)
      if (!res.ok) {
        setError(res.error ?? 'Something went wrong. Please check your details and try again.')
        setSubmitting(false)
        return
      }
      await refreshProfile()
      setDone(true)
    } catch (err: any) {
      console.error('[BecomeSeller] submission error:', err)
      setError(err?.message ?? 'Could not submit store. Please try again.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="mx-auto max-w-2xl">
      {/* stepper */}
      <ol className="mb-8 flex items-center gap-2" aria-label="Progress">
        {steps.map((s, i) => (
          <li key={s} className="flex flex-1 items-center gap-2">
            <span className={`grid h-8 w-8 shrink-0 place-items-center rounded-full border-2 text-xs font-bold transition ${i <= step ? 'border-gold bg-gold/15 text-gold' : 'border-line text-faint'}`}>{i + 1}</span>
            <span className={`hidden text-xs font-semibold sm:block ${i === step ? 'text-fg' : 'text-faint'}`}>{s}</span>
            {i < steps.length - 1 && <span className={`h-0.5 flex-1 rounded-full ${i < step ? 'bg-gold' : 'bg-line'}`} />}
          </li>
        ))}
      </ol>

      {step === 0 && (
        <div className="card space-y-5 p-7">
          <h3 className="font-display text-xl font-semibold">Sell your craft on Baloch Export Hub</h3>
          <ul className="space-y-3 text-sm text-muted">
            {[
              'Free store with your own storefront link (e.g. /store/your-name)',
              'Products, orders, messaging and earnings in one Seller Studio',
              '8% commission only when you sell — you keep 92%',
              'Stores are reviewed by the team to keep the marketplace trusted',
            ].map((t) => (
              <li key={t} className="flex items-start gap-2.5"><CheckCircle2 size={16} className="mt-0.5 shrink-0 text-gold" /> {t}</li>
            ))}
          </ul>
          <Button variant="gold" onClick={() => setStep(1)}>Start creating my store</Button>
        </div>
      )}

      {step === 1 && (
        <div className="card space-y-5 p-7">
          <Field label="Store name" required hint="This becomes your public store link.">
            <input id="seller-store-name" name="name" className="field" value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} placeholder="e.g. Doch e Gul" required />
          </Field>
          <Field label="Store description" required hint="Tell buyers who you are and what you make.">
            <textarea id="seller-store-description" name="description" className="field resize-none" rows={4} value={f.description} onChange={(e) => setF({ ...f, description: e.target.value })} required />
          </Field>
          <div className="grid gap-5 sm:grid-cols-2">
            <Field label="Main category" required>
              <select id="seller-store-category" name="category" className="field" value={f.category} onChange={(e) => setF({ ...f, category: e.target.value })}>
                {['balochi-doch', 'traditional-clothing', 'handicrafts', 'jewelry', 'painters', 'calligraphy', 'traditional-food', 'balochi-herbs', 'writers', 'photographers', 'designers', 'handmade-products', 'cultural-products'].map((c) => (
                  <option key={c} value={c}>{c.replace(/-/g, ' ')}</option>
                ))}
              </select>
            </Field>
            <Field label="Location" required><input id="seller-store-location" name="location" className="field" value={f.location} onChange={(e) => setF({ ...f, location: e.target.value })} required /></Field>
          </div>
          <fieldset>
            <legend className="mb-2 text-[0.8rem] font-semibold text-muted">Store colour</legend>
            <div className="flex gap-2.5">
              {COLORS.map((c) => (
                <button key={c} type="button" onClick={() => setF({ ...f, logo_color: c })} aria-label={`Colour ${c}`}
                  className={`h-9 w-9 rounded-full transition ${f.logo_color === c ? 'ring-2 ring-gold ring-offset-2 ring-offset-[var(--surface)]' : ''}`}
                  style={{ background: c }} />
              ))}
            </div>
          </fieldset>
          <div className="space-y-2">
            <label className="block text-[0.8rem] font-semibold text-muted">Store banner image</label>
            <StoreBannerGallery
              selectedBanner={f.banner}
              storeName={f.name || 'My Store'}
              onSelect={(b) => setF({ ...f, banner: b })}
            />
          </div>
          {error && <p className="text-sm text-rose-500">{error}</p>}
          <div className="flex justify-between">
            <Button variant="ghost" onClick={() => setStep(0)}>Back</Button>
            <Button variant="primary" onClick={() => { if (!f.name.trim() || !f.description.trim()) { setError('Please give your store a name and description.') } else { setError(''); setStep(2) } }}>Continue</Button>
          </div>
        </div>
      )}

      {step === 2 && (
        <div className="card space-y-5 p-7">
          <h3 className="font-display text-xl font-semibold">Ready to submit</h3>
          <div className="rounded-2xl border border-line bg-surface-2 p-5 text-sm">
            <p><span className="text-muted">Store:</span> <strong>{f.name}</strong></p>
            <p className="mt-1"><span className="text-muted">Link:</span> <span className="text-brand dark:text-gold">/store/{f.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')}</span></p>
            <p className="mt-1"><span className="text-muted">Category:</span> {f.category.replace(/-/g, ' ')}</p>
            <p className="mt-1"><span className="text-muted">Location:</span> {f.location}</p>
            <p className="mt-3 text-muted">{f.description}</p>
          </div>
          <p className="text-xs text-muted">By submitting you confirm your products are made or sourced by you and comply with our <Link to="/terms" className="underline text-brand dark:text-gold">Terms</Link>.</p>
          {error && <div className="rounded-xl border border-rose-500/20 bg-rose-500/10 p-3 text-sm text-rose-500">{error}</div>}
          <div className="flex justify-between">
            <Button variant="ghost" disabled={submitting} onClick={() => { setError(''); setStep(1) }}>Back</Button>
            <Button variant="gold" disabled={submitting} onClick={submit}>
              {submitting ? 'Submitting your store…' : 'Submit my store'}
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}
