/**
 * Data access layer — backed by Supabase with a synchronous cache.
 *
 * Every exported function name and signature is preserved so no
 * page/component breaks. Data is cached in module-level state and
 * kept in sync via Supabase Realtime. Mutations write to both
 * the cache and Supabase.
 */
import type {
  Address, CanonicalOrderStatus, Category, Conversation, DBState, Message, Notification, Order,
  OrderStatus, OrderStatusHistory, Product, Profile, Report, Review, Role, SellerBankDetails, SellerSubscription, Store,
} from './types'
import { getSupabase, isSupabaseConfigured, clearStoredAuthTokens } from './supabase'
import { isUuid, normalizeOrderStatus, slugify } from './util'

const nowIso = () => new Date().toISOString()
const ACTIVE_STORE_KEY = 'beh-active-store'

function aliveStore(s: Store) {
  return !s.deleted_at
}

async function dispatchOutbox() {
  try {
    const supabase = getSupabase()
    await supabase.functions.invoke('dispatch-notifications', { body: {} })
  } catch { /* provider may be unconfigured; outbox stays queued/skipped */ }
}

/* ════════════════════════════════════════════════════════════════
   CACHE — module-level reactive store
   ════════════════════════════════════════════════════════════════ */

interface CacheState {
  profiles: Profile[]
  categories: Category[]
  stores: Store[]
  products: Product[]
  orders: Order[]
  payments: any[]
  reviews: Review[]
  conversations: Conversation[]
  messages: Message[]
  notifications: Notification[]
  addresses: Address[]
  cart: Array<{ id: string; user_id: string; product_id: string; qty: number; added_at: string }>
  wishlist: Array<{ id: string; user_id: string; product_id: string; added_at: string }>
  settings: { commission_rate: number; currency: string; platform_name: string; maintenance: boolean; allow_registrations: boolean; auto_approve_stores: boolean }
  reports: Report[]
  orderHistory: OrderStatusHistory[]
}

const cache: CacheState = {
  profiles: [],
  categories: [],
  stores: [],
  products: [],
  orders: [],
  payments: [],
  reviews: [],
  conversations: [],
  messages: [],
  notifications: [],
  addresses: [],
  cart: [],
  wishlist: [],
  settings: { commission_rate: 8, currency: 'PKR', platform_name: 'Baloch Export Hub', maintenance: false, allow_registrations: true, auto_approve_stores: false },
  reports: [],
  orderHistory: [],
}

let version = 0
const listeners = new Set<() => void>()
let realtimeChannel: any = null

export function getVersion(): number { return version }
export function subscribe(listener: () => void) {
  listeners.add(listener)
  return () => { listeners.delete(listener) }
}
function emitChange() {
  version += 1
  listeners.forEach((l) => l())
}

export function parseLocation(raw?: string): { city: string; country: string } {
  if (!raw || !raw.trim()) return { city: 'Balochistan', country: 'Pakistan' }
  const parts = raw.split(',').map((s) => s.trim()).filter(Boolean)
  if (parts.length >= 2) {
    return { city: parts[0], country: parts.slice(1).join(', ') }
  }
  return { city: parts[0], country: 'Pakistan' }
}

export function normalizeProfile(p: any): Profile {
  if (!p) return p
  const loc = p.location || [p.city, p.country].filter(Boolean).join(', ') || 'Balochistan, Pakistan'
  return { ...p, location: loc }
}

export function normalizeProduct(p: any): Product {
  if (!p) return p
  const catSlug = p.category_slug || (p.category_id && cache.categories.find((c) => c.id === p.category_id)?.slug) || ''
  const firstImage = p.image || (Array.isArray(p.images) && p.images.length > 0 ? p.images[0] : '') || '/images/doch-closeup.jpg'
  const stockVal = typeof p.stock === 'number' ? p.stock : (typeof p.quantity === 'number' ? p.quantity : 10)
  const statusVal = p.status === 'approved' ? 'active' : (p.status || 'active')
  const storeId = (p.store_id && isUuid(p.store_id)) ? p.store_id : (p.store_id || '')
  return {
    id: p.id,
    store_id: storeId,
    seller_id: p.seller_id,
    name: p.name || 'Untitled Product',
    description: p.description || '',
    price: Number(p.price) || 0,
    currency: p.currency || 'PKR',
    image: firstImage,
    category_slug: catSlug,
    stock: stockVal,
    condition: p.condition || 'new',
    location: p.location || 'Balochistan, Pakistan',
    shipping_fee: Number(p.shipping_fee) || 250,
    shipping_days: p.shipping_days || '3-5 days',
    tags: Array.isArray(p.tags) ? p.tags : [],
    rating: Number(p.rating) || 5.0,
    review_count: Number(p.review_count) || 0,
    status: statusVal,
    sold: Number(p.sold) || 0,
    created_at: p.created_at || new Date().toISOString(),
  }
}

/** Cached profile for synchronous auth.session(). Set by providers. */
let _cachedProfile: Profile | null = null
export function _setCachedProfile(raw: Profile | null) {
  const p = normalizeProfile(raw)
  _cachedProfile = p
}

/* ════════════════════════════════════════════════════════════════
   INIT — populate cache from Supabase
   ════════════════════════════════════════════════════════════════ */

let _dbInitialized = false

export async function initDb() {
  if (_dbInitialized) return
  if (!isSupabaseConfigured) return
  _dbInitialized = true
  try {
    const supabase = getSupabase()
    const [catRes, storeRes, prodRes, settingsRes, reportRes, msgRes, convRes, profileRes] = await Promise.all([
      supabase.from('categories').select('*').order('name'),
      supabase.from('seller_stores').select('*'),
      supabase.from('products').select('*'),
      supabase.from('platform_settings').select('*').eq('id', 1).single(),
      supabase.from('reports').select('*').order('created_at', { ascending: false }),
      supabase.from('messages').select('*').order('created_at'),
      supabase.from('conversations').select('*'),
      supabase.from('public_profiles').select('*'),
    ])
    cache.categories = (catRes.data ?? []) as Category[]
    cache.products = (prodRes.data ?? []).map(normalizeProduct)
    if (settingsRes.data) cache.settings = settingsRes.data as any
    cache.reports = (reportRes.data ?? []) as Report[]
    cache.messages = (msgRes.data ?? []) as Message[]
    cache.conversations = (convRes.data ?? []) as Conversation[]

    let profilesData = (profileRes.data ?? []) as Profile[]
    if (profilesData.length === 0) {
      const { data: pData } = await supabase.from('profiles').select('*')
      profilesData = (pData ?? []) as Profile[]
    }
    cache.profiles = profilesData.map(normalizeProfile)
    cache.stores = ((storeRes.data ?? []) as Store[]).filter((s) => isUuid(s.id))

    subscribeRealtime()
    emitChange()
  } catch {
    _dbInitialized = false
  }
}

export async function initUserCache(userId: string) {
  if (!isSupabaseConfigured) return
  try {
    const supabase = getSupabase()
    const [cartRes, wishRes, addrRes, notifRes, convRes, revRes, profileRes, storeRes] = await Promise.all([
      supabase.from('cart_items').select('*').eq('user_id', userId),
      supabase.from('wishlist').select('*').eq('user_id', userId),
      supabase.from('addresses').select('*').eq('user_id', userId),
      supabase.from('notifications').select('*').eq('user_id', userId).order('created_at', { ascending: false }),
      supabase.from('conversations').select('*').or(`buyer_id.eq.${userId},seller_id.eq.${userId}`),
      supabase.from('reviews').select('*'),
      supabase.from('public_profiles').select('*'),
      supabase.from('seller_stores').select('*'),
    ])

    cache.cart = (cartRes.data ?? []) as any
    cache.wishlist = (wishRes.data ?? []) as any
    cache.addresses = (addrRes.data ?? []) as Address[]
    cache.notifications = (notifRes.data ?? []) as Notification[]
    cache.conversations = (convRes.data ?? []) as Conversation[]
    cache.reviews = (revRes.data ?? []) as Review[]
    let userProfilesData = (profileRes.data ?? []) as Profile[]
    if (userProfilesData.length === 0) {
      const { data: pData } = await supabase.from('profiles').select('*')
      userProfilesData = (pData ?? []) as Profile[]
    }
    cache.profiles = userProfilesData.map(normalizeProfile)
    if (storeRes.data && storeRes.data.length > 0) {
      cache.stores = (storeRes.data as Store[]).filter((s) => isUuid(s.id))
    }

    const convIds = cache.conversations.map((c) => c.id)
    if (convIds.length > 0) {
      const { data: msgs } = await supabase.from('messages').select('*').in('conversation_id', convIds).order('created_at')
      cache.messages = (msgs ?? []) as Message[]
    }

    await refreshOrders()
    emitChange()
  } catch (e) {
    console.error('[db] initUserCache failed', e)
  }
}

/* ── Realtime subscription ────────────────────────────────────── */
function subscribeRealtime() {
  if (realtimeChannel) return
  if (!isSupabaseConfigured) return
  try {
    const supabase = getSupabase()

    realtimeChannel = supabase
      .channel('db-changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'products' }, async () => {
        const { data } = await supabase.from('products').select('*')
        cache.products = (data ?? []) as Product[]
        emitChange()
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'orders' }, async () => {
        if (_cachedProfile?.id) await refreshOrders()
        emitChange()
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'order_items' }, async () => {
        if (_cachedProfile?.id) await refreshOrders()
        emitChange()
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'order_status_history' }, async () => {
        if (_cachedProfile?.id) await refreshOrders()
        emitChange()
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'cart_items' }, async () => {
        const uid = _cachedProfile?.id
        if (uid) {
          const { data } = await supabase.from('cart_items').select('*').eq('user_id', uid)
          cache.cart = (data ?? []) as any
        }
        emitChange()
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'wishlist' }, async () => {
        const uid = _cachedProfile?.id
        if (uid) {
          const { data } = await supabase.from('wishlist').select('*').eq('user_id', uid)
          cache.wishlist = (data ?? []) as any
        }
        emitChange()
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'notifications' }, async () => {
        const uid = _cachedProfile?.id
        if (uid) {
          const { data } = await supabase.from('notifications').select('*').eq('user_id', uid).order('created_at', { ascending: false })
          cache.notifications = (data ?? []) as Notification[]
        }
        emitChange()
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'messages' }, async () => {
        const uid = _cachedProfile?.id
        if (uid) {
          const { data: convs } = await supabase.from('conversations').select('*').or(`buyer_id.eq.${uid},seller_id.eq.${uid}`)
          cache.conversations = (convs ?? []) as Conversation[]
        }
        emitChange()
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'conversations' }, async () => {
        const uid = _cachedProfile?.id
        if (uid) {
          const { data } = await supabase.from('conversations').select('*').or(`buyer_id.eq.${uid},seller_id.eq.${uid}`)
          cache.conversations = (data ?? []) as Conversation[]
        }
        emitChange()
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'reviews' }, async () => {
        const { data } = await supabase.from('reviews').select('*')
        cache.reviews = (data ?? []) as Review[]
        // Also refresh products to get updated ratings
        const { data: prods } = await supabase.from('products').select('*')
        cache.products = (prods ?? []) as Product[]
        emitChange()
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'categories' }, async () => {
        const { data } = await supabase.from('categories').select('*').order('name')
        cache.categories = (data ?? []) as Category[]
        emitChange()
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'seller_stores' }, async () => {
        const { data } = await supabase.from('seller_stores').select('*')
        cache.stores = (data ?? []) as Store[]
        emitChange()
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'platform_settings' }, async () => {
        const { data } = await supabase.from('platform_settings').select('*').eq('id', 1).single()
        if (data) cache.settings = data as any
        emitChange()
      })
      .subscribe()
  } catch { /* Supabase not configured */ }
}

function hydrateFetchedOrders(raw: unknown): { orders: Order[]; history: OrderStatusHistory[] } {
  let parsed: unknown = raw
  if (typeof raw === 'string') {
    try { parsed = JSON.parse(raw) } catch { parsed = [] }
  }
  const rows = Array.isArray(parsed) ? parsed : []
  const orders: Order[] = []
  const history: OrderStatusHistory[] = []
  for (const row of rows as any[]) {
    const hist = Array.isArray(row.history) ? row.history as OrderStatusHistory[] : []
    history.push(...hist)
    const items = Array.isArray(row.items) ? row.items : []
    orders.push({
      ...row,
      status: normalizeOrderStatus(row.status),
      items: items.map((i: any) => ({ ...i, status: normalizeOrderStatus(i.status) })),
    } as Order)
  }
  return { orders, history }
}

async function refreshOrders() {
  if (!isSupabaseConfigured) return
  try {
    const supabase = getSupabase()
    const { data, error } = await supabase.rpc('fetch_my_orders')
    if (error) {
      console.error('[orders] fetch_my_orders failed', error)
      return
    }
    const hydrated = hydrateFetchedOrders(data)
    cache.orders = hydrated.orders
    cache.orderHistory = hydrated.history
  } catch (e) {
    console.error('[orders] refreshOrders failed', e)
  }
}

/** Force a full re-fetch of all cached data. Called after RPC mutations. */
export async function refreshAll() {
  if (!isSupabaseConfigured) return
  try {
    const supabase = getSupabase()
    const [prodRes, storeRes, catRes, settingsRes] = await Promise.all([
      supabase.from('products').select('*'),
      supabase.from('seller_stores').select('*'),
      supabase.from('categories').select('*').order('name'),
      supabase.from('platform_settings').select('*').eq('id', 1).single(),
    ])
    cache.products = (prodRes.data ?? []).map(normalizeProduct)
    cache.stores = (storeRes.data ?? []) as Store[]
    cache.categories = (catRes.data ?? []) as Category[]
    if (settingsRes.data) cache.settings = settingsRes.data as any
    await refreshOrders()
    if (_cachedProfile) {
      const uid = _cachedProfile.id
      const [cartRes, notifRes] = await Promise.all([
        supabase.from('cart_items').select('*').eq('user_id', uid),
        supabase.from('notifications').select('*').eq('user_id', uid).order('created_at', { ascending: false }),
      ])
      cache.cart = (cartRes.data ?? []) as any
      cache.notifications = (notifRes.data ?? []) as Notification[]
    }
    emitChange()
  } catch (e) {
    console.error('[db] refreshAll failed', e)
  }
}

/* ════════════════════════════════════════════════════════════════
   AUTH
   ════════════════════════════════════════════════════════════════ */

export const auth = {
  session(): Profile | null {
    return _cachedProfile
  },

  async signIn(email: string, password: string): Promise<{ ok: boolean; error?: string; user?: Profile }> {
    let supabase
    try { supabase = getSupabase() } catch (e: any) { return { ok: false, error: e?.message ?? 'Supabase is not configured. Please check your environment variables.' } }

    // ── Clear any lingering session before signing in ────────────
    // If a previous session is still cached client-side, signInWithPassword
    // can hang indefinitely (Supabase tries to refresh the old token first).
    // We first wipe stored tokens from localStorage so that Supabase's
    // autoRefreshToken mechanism cannot interfere, then call signOut()
    // to clear any in-memory auth state.
    clearStoredAuthTokens()
    try { await supabase.auth.signOut() } catch { /* best-effort */ }

    // ── Auth call with timeout ───────────────────────────────────
    // Use a rejecting timer so we never fabricate a fake Supabase response.
    // If Supabase succeeds first, clearTimeout prevents the timer from firing.
    // If the timer fires first, the Supabase promise is abandoned (no cancel
    // token is available on Supabase auth methods) and we return a clear error.
    const AUTH_TIMEOUT_MS = 30_000
    let _authTimer: ReturnType<typeof setTimeout> | undefined
    let authResult: Awaited<ReturnType<typeof supabase.auth.signInWithPassword>>
    try {
      authResult = await Promise.race([
        supabase.auth.signInWithPassword({ email: email.trim(), password }),
        new Promise<never>((_resolve, reject) => {
          _authTimer = setTimeout(() => reject(new Error('AUTH_TIMEOUT')), AUTH_TIMEOUT_MS)
        }),
      ])
    } catch (e: any) {
      // Always clean up the timer regardless of which branch fired
      if (_authTimer) { clearTimeout(_authTimer); _authTimer = undefined }

      // Timeout — Supabase did not respond within AUTH_TIMEOUT_MS
      if (e?.message === 'AUTH_TIMEOUT') {
        console.warn('[auth.signIn] Supabase did not respond within', AUTH_TIMEOUT_MS, 'ms')
        return { ok: false, error: 'Connection timed out. Please check your internet connection and try again.' }
      }
      // Real error from Supabase (network failure, DNS, etc.) — surface it as-is
      console.error('[auth.signIn] Unexpected error:', e)
      return { ok: false, error: `Sign-in failed: ${e?.message ?? 'Unknown error'}` }
    }
    // Timer is still alive if Supabase won the race — cancel it
    if (_authTimer) { clearTimeout(_authTimer); _authTimer = undefined }

    const { data, error } = authResult!

    // Real Supabase error (wrong password, unconfirmed email, etc.) — never mask it
    if (error) {
      console.error('[auth.signIn] Supabase error:', error.message, error)
      if (error.message.includes('Invalid login')) return { ok: false, error: 'Invalid email or password.' }
      if (error.message.includes('Email not confirmed')) return { ok: false, error: 'Email not confirmed. Please check your inbox or contact support.' }
      return { ok: false, error: `Sign-in failed: ${error.message}` }
    }

    if (!data?.user) {
      console.error('[auth.signIn] No user in response:', data)
      return { ok: false, error: 'Sign-in succeeded but no user was returned. Please try again.' }
    }

    // ── Profile loading (separate from auth timeout) ──────────────
    const { data: profile, error: pErr } = await supabase.from('profiles').select('*').eq('id', data.user.id).single()
    if (pErr || !profile) {
      console.error('[auth.signIn] Profile query failed:', pErr)
      return { ok: false, error: 'Profile not found. Please contact support.' }
    }
    if (profile.is_blocked) { await supabase.auth.signOut(); return { ok: false, error: 'This account has been blocked. Contact support.' } }
    _cachedProfile = profile as Profile
    // Fire-and-forget: onAuthStateChange in providers.tsx also calls initUserCache,
    // so we must not block the login response on this heavy cache population.
    void initUserCache(profile.id)
    return { ok: true, user: profile as Profile }
  },

  async signUp(data: { full_name: string; username: string; email: string; password: string }): Promise<{ ok: boolean; error?: string; user?: Profile }> {
    let supabase
    try { supabase = getSupabase() } catch (e: any) { return { ok: false, error: e?.message ?? 'Supabase is not configured. Please check your environment variables.' } }
    const { data: settings } = await supabase.from('platform_settings').select('allow_registrations').eq('id', 1).single()
    if (settings && !settings.allow_registrations) return { ok: false, error: 'Registrations are temporarily closed.' }
    // Check email/username availability via RPC (bypasses RLS for pre-signup validation)
    const { data: existingEmail } = await supabase.rpc('check_email_exists', { p_email: data.email.trim() })
    if (existingEmail) return { ok: false, error: 'An account with this email already exists.' }
    const { data: existingUser } = await supabase.rpc('check_username_exists', { p_username: data.username.trim() })
    if (existingUser) return { ok: false, error: 'This username is taken.' }

    // ── Clear any lingering session before signing up ──────────
    clearStoredAuthTokens()
    try { await supabase.auth.signOut() } catch { /* best-effort */ }

    // ── Auth call with timeout ───────────────────────────────────
    const AUTH_TIMEOUT_MS = 30_000
    let _authTimer: ReturnType<typeof setTimeout> | undefined
    let authResult: Awaited<ReturnType<typeof supabase.auth.signUp>>
    try {
      authResult = await Promise.race([
        supabase.auth.signUp({
          email: data.email.trim(), password: data.password,
          options: { data: { full_name: data.full_name.trim(), username: slugify(data.username) } },
        }),
        new Promise<never>((_resolve, reject) => {
          _authTimer = setTimeout(() => reject(new Error('AUTH_TIMEOUT')), AUTH_TIMEOUT_MS)
        }),
      ])
    } catch (e: any) {
      if (_authTimer) { clearTimeout(_authTimer); _authTimer = undefined }
      if (e?.message === 'AUTH_TIMEOUT') {
        console.warn('[auth.signUp] Supabase did not respond within', AUTH_TIMEOUT_MS, 'ms')
        return { ok: false, error: 'Connection timed out. Please check your internet connection and try again.' }
      }
      console.error('[auth.signUp] Unexpected error:', e)
      return { ok: false, error: `Registration failed: ${e?.message ?? 'Unknown error'}` }
    }
    if (_authTimer) { clearTimeout(_authTimer); _authTimer = undefined }

    const { data: authData, error } = authResult!

    if (error) {
      console.error('[auth.signUp] Supabase error:', error.message, error)
      if (error.message.includes('already registered')) return { ok: false, error: 'An account with this email already exists.' }
      return { ok: false, error: `Registration failed: ${error.message}` }
    }
    if (authData.user) {
      if (!authData.session) return { ok: true } // email confirmation pending
      await new Promise((r) => setTimeout(r, 500))
      const { data: profile } = await supabase.from('profiles').select('*').eq('id', authData.user.id).single()
      if (profile) { _cachedProfile = profile as Profile; void initUserCache(profile.id); return { ok: true, user: profile as Profile } }
    }
    return { ok: true }
  },

  async signOut() {
    const supabase = getSupabase()
    clearStoredAuthTokens()
    try { await supabase.auth.signOut() } catch { /* best-effort */ }
    _cachedProfile = null
    cache.orders = []; cache.cart = []; cache.wishlist = []; cache.addresses = []; cache.notifications = []; cache.conversations = []; cache.messages = []; cache.reviews = []
    emitChange()
    window.location.assign('/')
  },

  async updateProfile(userId: string, patch: Partial<Profile>) {
    const supabase = getSupabase()
    const { location, ...dbPatch } = patch
    if (location !== undefined) {
      const { city, country } = parseLocation(location)
      ;(dbPatch as any).city = city
      ;(dbPatch as any).country = country
    }
    await supabase.from('profiles').update(dbPatch).eq('id', userId)
    const normalized = normalizeProfile({ ...(_cachedProfile?.id === userId ? _cachedProfile : {}), ...patch })
    if (_cachedProfile?.id === userId) _cachedProfile = normalized
    const idx = cache.profiles.findIndex((p) => p.id === userId)
    if (idx >= 0) cache.profiles[idx] = { ...cache.profiles[idx], ...normalized }
    emitChange()
  },

  async changePassword(_userId: string, _current: string, next: string): Promise<string | null> {
    const supabase = getSupabase()
    const { error } = await supabase.auth.updateUser({ password: next })
    return error ? error.message : null
  },

  async becomeSeller(userId: string, data: { name: string; description: string; category: string; location: string; logo_color?: string; banner?: string }): Promise<{ ok: boolean; error?: string; store?: Store }> {
    const supabase = getSupabase()

    // 1. Verify user authentication & identity
    const { data: authData, error: authErr } = await supabase.auth.getUser()
    if (authErr || !authData?.user || authData.user.id !== userId) {
      return { ok: false, error: 'Authentication required. Please sign in to submit your store.' }
    }

    // 2. Validate required fields
    const trimmedName = (data.name || '').trim()
    const trimmedDesc = (data.description || '').trim()
    const trimmedCat = (data.category || '').trim() || 'handmade-products'
    const trimmedLoc = (data.location || '').trim() || 'Balochistan, Pakistan'

    if (!trimmedName || !trimmedDesc) {
      return { ok: false, error: 'Please provide both a store name and description.' }
    }

    // 3. Check store limit (maximum 2 stores per user) locally in cache
    const liveLocalStores = cache.stores.filter((s) => s.seller_id === userId && aliveStore(s))
    if (liveLocalStores.length >= 2) {
      return { ok: false, error: 'Store limit reached: each seller can create a maximum of 2 active stores.' }
    }

    // 4. Probe remote seller_stores table if it exists
    let hasSellerStoresTable = true
    let existingRemoteStores: any[] | null = null
    try {
      const { data: rows, error: checkErr } = await supabase
        .from('seller_stores')
        .select('id, deleted_at')
        .eq('seller_id', userId)

      if (checkErr) {
        if (checkErr.code === 'PGRST205' || checkErr.message?.includes('not find')) {
          hasSellerStoresTable = false
        }
      } else {
        existingRemoteStores = rows
      }
    } catch {
      hasSellerStoresTable = false
    }

    if (hasSellerStoresTable && existingRemoteStores) {
      const activeCount = existingRemoteStores.filter((s) => !s.deleted_at).length
      if (activeCount >= 2) {
        return { ok: false, error: 'Store limit reached: each seller can create a maximum of 2 active stores.' }
      }
    }

    let createdStore: Store | null = null

    // 5. Try inserting into seller_stores if table is present
    if (hasSellerStoresTable) {
      let autoApprove = false
      try {
        const { data: settings } = await supabase.from('platform_settings').select('auto_approve_stores').eq('id', 1).maybeSingle()
        if (settings?.auto_approve_stores) autoApprove = true
      } catch { /* platform_settings might be missing */ }

      let slug = slugify(trimmedName)
      try {
        const { data: slugExists } = await supabase.from('seller_stores').select('id').eq('slug', slug).maybeSingle()
        if (slugExists) slug = `${slug}-${Math.floor(Math.random() * 900 + 100)}`
      } catch { /* ignore */ }

      const storeData = {
        seller_id: userId,
        name: trimmedName,
        slug,
        description: trimmedDesc,
        category_slugs: [trimmedCat],
        logo_color: data.logo_color ?? '#0d7d76',
        logo_initials: trimmedName.split(/\s+/).slice(0, 2).map((w) => w[0]).join('').toUpperCase(),
        banner: data.banner,
        location: trimmedLoc,
        is_approved: autoApprove,
      }

      const { data: store, error: insertErr } = await supabase.from('seller_stores').insert(storeData).select('*').single()

      if (insertErr) {
        if (insertErr.code === 'PGRST205' || insertErr.message?.includes('not find')) {
          hasSellerStoresTable = false
        } else {
          const msg = insertErr.message?.toLowerCase().includes('limit') || insertErr.message?.toLowerCase().includes('maximum')
            ? 'Store limit reached: each seller can create a maximum of 2 active stores.'
            : insertErr.message || 'Failed to create store record.'
          return { ok: false, error: msg }
        }
      } else if (store) {
        createdStore = store as Store
      }
    }

    if (!createdStore) {
      return { ok: false, error: 'Failed to create store record in database.' }
    }

    // 7. Update profiles role & cached profile (never demote admins)
    try {
      const { data: curProf } = await supabase.from('profiles').select('role').eq('id', userId).maybeSingle()
      if (curProf?.role !== 'admin') {
        await supabase.from('profiles').update({ role: 'seller' }).eq('id', userId)
        if (_cachedProfile && _cachedProfile.id === userId) {
          _cachedProfile.role = 'seller'
        }
        const profIdx = cache.profiles.findIndex((p) => p.id === userId)
        if (profIdx >= 0) {
          cache.profiles[profIdx].role = 'seller'
        }
      }
    } catch { /* non-fatal */ }

    if (_cachedProfile && _cachedProfile.id === userId) {
      ;(_cachedProfile as any).store_name = trimmedName
      ;(_cachedProfile as any).store_description = trimmedDesc
    }
    const profIdx = cache.profiles.findIndex((p) => p.id === userId)
    if (profIdx >= 0) {
      ;(cache.profiles[profIdx] as any).store_name = trimmedName
      ;(cache.profiles[profIdx] as any).store_description = trimmedDesc
    }

    // 8. Send notification safely (non-fatal if schema varies)
    try {
      const notifTitle = createdStore.is_approved ? 'Your store is live! 🎉' : 'Store submitted for approval'
      const notifMsg = createdStore.is_approved ? `${createdStore.name} is now live.` : `${createdStore.name} is under review.`
      await supabase.from('notifications').insert({
        user_id: userId,
        type: 'store',
        title: notifTitle,
        message: notifMsg,
        body: notifMsg,
        href: '/seller',
        link: '/seller',
        read: false,
        is_read: false,
      })

      const { data: admins } = await supabase.from('profiles').select('id').eq('role', 'admin')
      if (admins && admins.length > 0) {
        for (const admin of admins) {
          await supabase.from('notifications').insert({
            user_id: admin.id,
            type: 'store',
            title: 'New store awaiting approval',
            message: `${_cachedProfile?.full_name ?? 'A user'} submitted "${createdStore.name}".`,
            body: `${_cachedProfile?.full_name ?? 'A user'} submitted "${createdStore.name}".`,
            href: '/admin/sellers',
            link: '/admin/sellers',
            read: false,
            is_read: false,
          })
        }
      }
    } catch { /* Non-fatal */ }

    // 9. Update stores cache and set active store
    const existingIdx = cache.stores.findIndex((s) => s.id === createdStore!.id)
    if (existingIdx >= 0) {
      cache.stores[existingIdx] = createdStore
    } else {
      cache.stores.push(createdStore)
    }

    try { localStorage.setItem(ACTIVE_STORE_KEY, createdStore.id) } catch { /* noop */ }
    emitChange()

    return { ok: true, store: createdStore }
  },
}

/* ════════════════════════════════════════════════════════════════
   CATEGORIES
   ════════════════════════════════════════════════════════════════ */

export const categories = {
  list: () => cache.categories,
  bySlug: (slug: string) => cache.categories.find((c) => c.slug === slug),
  counts(): Record<string, number> {
    const out: Record<string, number> = {}
    for (const p of cache.products) if (p.status === 'active') out[p.category_slug] = (out[p.category_slug] ?? 0) + 1
    return out
  },
  async save(cat: Category) {
    const supabase = getSupabase()
    if (cat.id) await supabase.from('categories').upsert({ ...cat, id: cat.id })
    else await supabase.from('categories').insert({ ...cat })
    const { data } = await supabase.from('categories').select('*').order('name')
    cache.categories = (data ?? []) as Category[]
    emitChange()
  },
  async remove(id: string) {
    const supabase = getSupabase()
    await supabase.from('categories').delete().eq('id', id)
    cache.categories = cache.categories.filter((c) => c.id !== id)
    emitChange()
  },
}

/* ════════════════════════════════════════════════════════════════
   STORES
   ════════════════════════════════════════════════════════════════ */

export const stores = {
  listApproved: () => cache.stores.filter((s) => s.is_approved && aliveStore(s) && !s.blocked && isUuid(s.id)),
  listAll: () => cache.stores.filter((s) => isUuid(s.id)),
  listBySeller: (sellerId: string) => cache.stores.filter((s) => s.seller_id === sellerId && aliveStore(s) && isUuid(s.id)),
  bySlug: (slug: string) => cache.stores.find((s) => s.slug === slug && aliveStore(s) && isUuid(s.id)),
  byId: (id: string) => cache.stores.find((s) => s.id === id && isUuid(s.id)),
  bySeller: (sellerId: string) => cache.stores.find((s) => s.seller_id === sellerId && aliveStore(s) && isUuid(s.id)),
  activeId(): string | null {
    try {
      const val = localStorage.getItem(ACTIVE_STORE_KEY)
      return val && isUuid(val) ? val : null
    } catch { return null }
  },
  setActive(id: string) {
    if (!isUuid(id)) return
    try { localStorage.setItem(ACTIVE_STORE_KEY, id) } catch { /* noop */ }
    emitChange()
  },
  activeFor(sellerId: string): Store | undefined {
    const owned = stores.listBySeller(sellerId)
    const saved = stores.activeId()
    const active = (saved ? owned.find((s) => s.id === saved) : undefined) ?? owned[0]
    if (active && saved !== active.id) {
      try { localStorage.setItem(ACTIVE_STORE_KEY, active.id) } catch { /* noop */ }
    }
    return active
  },
  async update(id: string, patch: Partial<Store>) {
    const supabase = getSupabase()
    const { error } = await supabase.from('seller_stores').update(patch).eq('id', id)
    if (error && (error.code === 'PGRST205' || id.startsWith('store-'))) {
      const sellerId = id.startsWith('store-') ? id.replace('store-', '') : undefined
      if (sellerId) {
        const profPatch: any = {}
        if (patch.name) profPatch.store_name = patch.name
        if (patch.description) profPatch.store_description = patch.description
        if (patch.banner) profPatch.store_logo = patch.banner
        if (patch.location) {
          const { city, country } = parseLocation(patch.location)
          profPatch.city = city
          profPatch.country = country
        }
        await supabase.from('profiles').update(profPatch).eq('id', sellerId)
      }
    }
    const idx = cache.stores.findIndex((x) => x.id === id)
    if (idx >= 0) cache.stores[idx] = { ...cache.stores[idx], ...patch }
    emitChange()
  },
  async setApproved(id: string, approved: boolean, actor?: Profile) {
    if (approved) {
      await stores.approve(id)
    } else {
      await stores.reject(id, 'Store suspended by administrator')
    }
    void actor
  },
  async approve(id: string) {
    const supabase = getSupabase()
    const { error } = await supabase.rpc('approve_seller_store', { p_store_id: id })
    if (error) {
      // Fallback direct update
      await supabase.from('seller_stores').update({ is_approved: true, status: 'approved' }).eq('id', id)
      const st = cache.stores.find((s) => s.id === id)
      if (st?.seller_id) {
        await supabase.from('profiles').update({ seller_status: 'approved', seller_approved_at: new Date().toISOString() }).eq('id', st.seller_id)
      }
    }
    await refreshAll()
    emitChange()
  },
  async reject(id: string, reason = 'Store application declined') {
    const supabase = getSupabase()
    const { error } = await supabase.rpc('reject_seller_store', { p_store_id: id, p_reason: reason })
    if (error) {
      // Fallback direct update
      await supabase.from('seller_stores').update({ is_approved: false, status: 'rejected', rejection_reason: reason }).eq('id', id)
    }
    await refreshAll()
    emitChange()
  },
  async setBlocked(id: string, blocked: boolean) {
    const supabase = getSupabase()
    await supabase.from('seller_stores').update({ blocked }).eq('id', id)
    const sellerId = id.startsWith('store-') ? id.replace('store-', '') : cache.stores.find((s) => s.id === id)?.seller_id
    if (sellerId) {
      await supabase.from('profiles').update({ is_blocked: blocked }).eq('id', sellerId)
      const u = cache.profiles.find((p) => p.id === sellerId); if (u) u.is_blocked = blocked
    }
    const idx = cache.stores.findIndex((x) => x.id === id)
    if (idx >= 0) cache.stores[idx] = { ...cache.stores[idx], blocked }
    emitChange()
  },
  async archive(id: string) {
    const supabase = getSupabase()
    const { error } = await supabase.rpc('archive_store', { p_store_id: id })
    if (error) throw new Error(error.message)
    const { data: allStores } = await supabase.from('seller_stores').select('*')
    cache.stores = (allStores ?? []) as Store[]
    const { data: allProds } = await supabase.from('products').select('*')
    cache.products = (allProds ?? []) as Product[]
    emitChange()
  },
}

/* ════════════════════════════════════════════════════════════════
   PRODUCTS
   ════════════════════════════════════════════════════════════════ */

export interface ProductFilter {
  q?: string; category?: string; storeId?: string
  sort?: 'featured' | 'new' | 'price-asc' | 'price-desc' | 'rating'
  minRating?: number; maxPrice?: number; inStock?: boolean; includeHidden?: boolean
}

export const products = {
  byId: (id: string) => cache.products.find((p) => p.id === id),

  list(filter: ProductFilter = {}): Product[] {
    let out = cache.products.filter((p) => {
      if (filter.storeId) return p.store_id === filter.storeId
      if (filter.includeHidden) return true
      if (p.status !== 'active') return false
      // Only display products from approved, active stores in the public marketplace
      const store = cache.stores.find((st) => st.id === p.store_id || (p.seller_id && st.seller_id === p.seller_id))
      return !!store && store.is_approved && !store.deleted_at && !store.blocked
    })
    if (filter.q) {
      const q = filter.q.toLowerCase()
      out = out.filter((p) => {
        const store = cache.stores.find((st) => st.id === p.store_id)
        const cat = cache.categories.find((c) => c.slug === p.category_slug)
        return p.name.toLowerCase().includes(q) || p.description.toLowerCase().includes(q) || p.tags.some((t) => t.toLowerCase().includes(q)) || (cat?.name.toLowerCase().includes(q) ?? false) || (store?.name.toLowerCase().includes(q) ?? false)
      })
    }
    if (filter.category) out = out.filter((p) => p.category_slug === filter.category)
    if (filter.minRating) out = out.filter((p) => p.rating >= filter.minRating!)
    if (filter.maxPrice) out = out.filter((p) => p.price <= filter.maxPrice!)
    if (filter.inStock) out = out.filter((p) => p.stock > 0)
    switch (filter.sort) {
      case 'new': out = [...out].sort((a, b) => +new Date(b.created_at) - +new Date(a.created_at)); break
      case 'price-asc': out = [...out].sort((a, b) => a.price - b.price); break
      case 'price-desc': out = [...out].sort((a, b) => b.price - a.price); break
      case 'rating': out = [...out].sort((a, b) => b.rating - a.rating); break
      default: out = [...out].sort((a, b) => b.sold * (b.rating + 1) - a.sold * (a.rating + 1))
    }
    return out
  },

  async create(data: Omit<Product, 'id' | 'created_at' | 'rating' | 'review_count' | 'sold' | 'status'> & { status?: Product['status']; images?: string[] }): Promise<Product> {
    const supabase = getSupabase()

    // 1. Resolve a guaranteed valid UUID store_id
    let realStoreId: string | null = null
    if (data.store_id && isUuid(data.store_id)) {
      realStoreId = data.store_id
    } else if (data.seller_id) {
      const activeSt = stores.activeFor(data.seller_id)
      if (activeSt && isUuid(activeSt.id)) {
        realStoreId = activeSt.id
      } else {
        const { data: dbStores } = await supabase.from('seller_stores').select('id, is_approved').eq('seller_id', data.seller_id).limit(1)
        if (dbStores && dbStores[0] && isUuid(dbStores[0].id)) {
          realStoreId = dbStores[0].id
        }
      }
    }

    if (!realStoreId) {
      throw new Error('Please create and select a store before adding products.')
    }

    const store = cache.stores.find((st) => st.id === realStoreId)
    const rawStock = Math.max(0, Number(data.stock ?? 1))
    const imagesArr = Array.isArray(data.images) && data.images.length > 0
      ? data.images
      : (data.image ? [data.image] : ['/images/doch-closeup.jpg'])
    const firstImage = imagesArr[0] || data.image || '/images/doch-closeup.jpg'
    const statusVal = (store && store.is_approved) ? (data.status ?? 'active') : 'pending'

    // 2. Resolve category_id from category_slug
    let catId: string | null = null
    if (data.category_slug) {
      const cat = cache.categories.find((c) => c.slug === data.category_slug)
      if (cat && isUuid(cat.id)) catId = cat.id
    }

    const payload: any = {
      ...data,
      store_id: realStoreId,
      category_id: catId,
      stock: rawStock,
      quantity: rawStock,
      image: firstImage,
      images: imagesArr,
      rating: 0,
      review_count: 0,
      sold: 0,
      status: statusVal,
    }
    const { data: product, error } = await supabase.from('products').insert(payload).select('*').single()
    if (error || !product) throw new Error(error?.message || 'Could not create the product.')
    const normalized = normalizeProduct(product)
    cache.products.push(normalized)
    emitChange()
    if (normalized.status === 'active') void dispatchOutbox()
    return normalized
  },

  async reload() {
    const supabase = getSupabase()
    const { data } = await supabase.from('products').select('*')
    if (data) {
      cache.products = data.map(normalizeProduct)
      emitChange()
    }
  },

  async update(id: string, patch: Partial<Product> & { images?: string[] }) {
    const supabase = getSupabase()
    const payload: any = { ...patch }
    if (patch.stock !== undefined) {
      payload.stock = Math.max(0, Number(patch.stock))
      payload.quantity = payload.stock
    }
    if (patch.images !== undefined || patch.image !== undefined) {
      const imagesArr = Array.isArray(patch.images) && patch.images.length > 0
        ? patch.images
        : (patch.image ? [patch.image] : undefined)
      if (imagesArr) {
        payload.images = imagesArr
        payload.image = imagesArr[0]
      }
    }
    await supabase.from('products').update(payload).eq('id', id)
    const idx = cache.products.findIndex((x) => x.id === id)
    if (idx >= 0) cache.products[idx] = { ...cache.products[idx], ...payload }
    emitChange()
    if (payload.status === 'active') void dispatchOutbox()
  },

  async remove(id: string) {
    const supabase = getSupabase()
    await supabase.from('products').delete().eq('id', id)
    await supabase.from('cart_items').delete().eq('product_id', id)
    await supabase.from('wishlist').delete().eq('product_id', id)
    cache.products = cache.products.filter((p) => p.id !== id)
    cache.cart = cache.cart.filter((c) => c.product_id !== id)
    cache.wishlist = cache.wishlist.filter((w) => w.product_id !== id)
    emitChange()
  },

  async setStatus(id: string, status: Product['status']) {
    const supabase = getSupabase()
    await supabase.from('products').update({ status }).eq('id', id)
    const idx = cache.products.findIndex((x) => x.id === id)
    if (idx >= 0) cache.products[idx] = { ...cache.products[idx], status }
    emitChange()
  },
}

/* ════════════════════════════════════════════════════════════════
   CART & WISHLIST
   ════════════════════════════════════════════════════════════════ */

export const cart = {
  list(userId: string) {
    return cache.cart
      .filter((c) => c.user_id === userId)
      .map((c) => ({ ...c, product: cache.products.find((p) => p.id === c.product_id)! }))
      .filter((c) => c.product)
  },
  count(userId: string) { return cache.cart.filter((c) => c.user_id === userId).length },
  async add(userId: string, productId: string, qty = 1) {
    const supabase = getSupabase()
    const existing = cache.cart.find((c) => c.user_id === userId && c.product_id === productId)
    if (existing) {
      await supabase.from('cart_items').update({ qty: existing.qty + qty, quantity: existing.qty + qty }).eq('id', existing.id)
      existing.qty += qty
    } else {
      const { data } = await supabase.from('cart_items').insert({ user_id: userId, product_id: productId, qty, quantity: qty }).select('*').single()
      if (data) cache.cart.push(data as any)
    }
    emitChange()
  },
  async setQty(userId: string, productId: string, qty: number) {
    const supabase = getSupabase()
    const c = cache.cart.find((x) => x.user_id === userId && x.product_id === productId)
    if (c) {
      c.qty = Math.max(1, qty)
      await supabase.from('cart_items').update({ qty: c.qty, quantity: c.qty }).eq('id', c.id)
      emitChange()
    }
  },
  async remove(userId: string, productId: string) {
    const supabase = getSupabase()
    await supabase.from('cart_items').delete().eq('user_id', userId).eq('product_id', productId)
    cache.cart = cache.cart.filter((c) => !(c.user_id === userId && c.product_id === productId))
    emitChange()
  },
  async clear(userId: string) {
    const supabase = getSupabase()
    await supabase.from('cart_items').delete().eq('user_id', userId)
    cache.cart = cache.cart.filter((c) => c.user_id !== userId)
    emitChange()
  },
}

export const wishlist = {
  list(userId: string) {
    return cache.wishlist
      .filter((w) => w.user_id === userId)
      .map((w) => ({ ...w, product: cache.products.find((p) => p.id === w.product_id)! }))
      .filter((w) => w.product)
  },
  has(userId: string, productId: string) {
    return cache.wishlist.some((w) => w.user_id === userId && w.product_id === productId)
  },
  async toggle(userId: string, productId: string) {
    const supabase = getSupabase()
    const i = cache.wishlist.findIndex((w) => w.user_id === userId && w.product_id === productId)
    if (i >= 0) { await supabase.from('wishlist').delete().eq('user_id', userId).eq('product_id', productId); cache.wishlist.splice(i, 1) }
    else { const { data } = await supabase.from('wishlist').insert({ user_id: userId, product_id: productId }).select('*').single(); if (data) cache.wishlist.push(data as any) }
    emitChange()
  },
}

/* ════════════════════════════════════════════════════════════════
   ADDRESSES
   ════════════════════════════════════════════════════════════════ */

export const addresses = {
  list: (userId: string) => cache.addresses.filter((a) => a.user_id === userId),
  async save(userId: string, addr: Omit<Address, 'id' | 'user_id'> & { id?: string }) {
    const supabase = getSupabase()
    if (addr.id) {
      await supabase.from('addresses').upsert({ ...addr, user_id: userId, id: addr.id })
    } else {
      if (addr.is_default) await supabase.from('addresses').update({ is_default: false }).eq('user_id', userId)
      await supabase.from('addresses').insert({ ...addr, user_id: userId })
    }
    // Refresh addresses
    const { data } = await supabase.from('addresses').select('*').eq('user_id', userId)
    cache.addresses = cache.addresses.filter((a) => a.user_id !== userId).concat((data ?? []) as Address[])
    emitChange()
  },
  async remove(id: string) {
    const supabase = getSupabase()
    await supabase.from('addresses').delete().eq('id', id)
    cache.addresses = cache.addresses.filter((a) => a.id !== id)
    emitChange()
  },
  async setDefault(userId: string, id: string) {
    const supabase = getSupabase()
    await supabase.from('addresses').update({ is_default: false }).eq('user_id', userId)
    await supabase.from('addresses').update({ is_default: true }).eq('id', id)
    cache.addresses.forEach((a) => { if (a.user_id === userId) a.is_default = a.id === id })
    emitChange()
  },
}

/* ════════════════════════════════════════════════════════════════
   ORDERS
   ════════════════════════════════════════════════════════════════ */

export const orders = {
  byId: (id: string) => cache.orders.find((o) => o.id === id || o.code === id),
  listByBuyer: (userId: string) => cache.orders.filter((o) => o.buyer_id === userId).sort((a, b) => +new Date(b.created_at) - +new Date(a.created_at)),
  listByStore: (storeId: string) => cache.orders.filter((o) => o.items.some((i) => i.store_id === storeId)).sort((a, b) => +new Date(b.created_at) - +new Date(a.created_at)),
  listAll: () => [...cache.orders].sort((a, b) => +new Date(b.created_at) - +new Date(a.created_at)),

  async reload() {
    await refreshOrders()
    emitChange()
  },

  async place(input: { buyer: Profile; address: Address; items: Array<{ product: Product; qty: number }>; payment_method: string }): Promise<Order> {
    const supabase = getSupabase()
    const { data, error } = await supabase.rpc('place_order', {
      p_address: { ...input.address, email: input.buyer.email } as any,
      p_payment_method: input.payment_method,
    })
    if (error || !data) {
      console.error('[orders] place_order failed', error)
      throw new Error(error?.message || "We couldn't place your order. Please try again.")
    }
    cache.cart = cache.cart.filter((c) => c.user_id !== input.buyer.id)
    await refreshOrders()
    const { data: prods } = await supabase.from('products').select('*')
    if (prods) cache.products = prods as Product[]
    const { data: notifs } = await supabase.from('notifications').select('*').eq('user_id', input.buyer.id).order('created_at', { ascending: false })
    if (notifs) cache.notifications = notifs as Notification[]
    emitChange()
    void dispatchOutbox()
    void supabase.functions.invoke('payment-providers', { body: { provider: input.payment_method, order_id: (data as Order).id } }).catch((e) => {
      console.error('[orders] payment-providers', e)
    })
    const placed = cache.orders.find((o) => o.id === (data as any).id || o.code === (data as any).code)
    if (!placed) {
      const fallback: Order = {
        ...(data as Order),
        status: normalizeOrderStatus((data as any).status ?? 'submitted'),
        items: input.items.map((i, idx) => ({
          id: `tmp-${idx}`,
          product_id: i.product.id,
          store_id: i.product.store_id,
          name: i.product.name,
          image: i.product.image,
          qty: i.qty,
          price: i.product.price,
          status: 'submitted',
        })),
      }
      cache.orders.unshift(fallback)
      emitChange()
      return fallback
    }
    return placed
  },

  async setItemStatus(orderId: string, itemId: string, status: OrderStatus) {
    const supabase = getSupabase()
    const { error } = await supabase.rpc('set_order_item_status', { p_order_item: itemId, p_status: normalizeOrderStatus(status) })
    if (error) {
      console.error('[orders] set_order_item_status failed', error)
      throw new Error(error.message)
    }
    await refreshOrders()
    emitChange()
  },

  async advance(orderId: string, status: CanonicalOrderStatus) {
    const supabase = getSupabase()
    const { error } = await supabase.rpc('advance_order', { p_order_id: orderId, p_to: status })
    if (error) {
      console.error('[orders] advance_order failed', error)
      throw new Error(error.message)
    }
    await refreshOrders()
    const uid = _cachedProfile?.id
    if (uid) {
      const { data: notifs } = await supabase.from('notifications').select('*').eq('user_id', uid).order('created_at', { ascending: false })
      if (notifs) cache.notifications = notifs as Notification[]
    }
    emitChange()
  },

  history(orderId: string) {
    return cache.orderHistory.filter((h) => h.order_id === orderId).sort((a, b) => +new Date(a.created_at) - +new Date(b.created_at))
  },

  async cancel(orderId: string) {
    const supabase = getSupabase()
    const { error } = await supabase.rpc('cancel_order', { p_order_id: orderId })
    if (error) {
      console.error('[orders] cancel_order failed', error)
      throw new Error(error.message)
    }
    await refreshOrders()
    emitChange()
  },

  async confirmPayment(orderId: string) {
    const supabase = getSupabase()
    const { error } = await supabase.rpc('admin_confirm_payment', { p_order_id: orderId, p_status: 'paid' })
    if (error) {
      const { error: updErr } = await supabase.from('orders').update({ payment: 'paid' }).eq('id', orderId)
      if (updErr) {
        console.error('[orders] confirmPayment fallback failed', updErr)
        throw new Error(updErr.message)
      }
      await supabase.from('payments').update({ status: 'paid' }).eq('order_id', orderId)
      await supabase.from('payment_transactions').update({ status: 'verified', updated_at: new Date().toISOString() }).eq('order_id', orderId)
    }
    await refreshOrders()
    emitChange()
  },

  async rejectPayment(orderId: string, reason = 'Payment verification rejected by admin') {
    const supabase = getSupabase()
    const { error } = await supabase.rpc('admin_confirm_payment', { p_order_id: orderId, p_status: 'failed', p_note: reason })
    if (error) {
      const { error: updErr } = await supabase.from('orders').update({ payment: 'pending' }).eq('id', orderId)
      if (updErr) {
        console.error('[orders] rejectPayment fallback failed', updErr)
        throw new Error(updErr.message)
      }
      await supabase.from('payments').update({ status: 'failed' }).eq('order_id', orderId)
      await supabase.from('payment_transactions').update({ status: 'rejected', updated_at: new Date().toISOString() }).eq('order_id', orderId)
    }
    await refreshOrders()
    emitChange()
  },
}

/* ════════════════════════════════════════════════════════════════
   REVIEWS
   ════════════════════════════════════════════════════════════════ */

export const reviews = {
  byProduct: (productId: string) => cache.reviews.filter((r) => r.product_id === productId && r.is_approved).sort((a, b) => +new Date(b.created_at) - +new Date(a.created_at)),
  byBuyer: (buyerId: string) => cache.reviews.filter((r) => r.buyer_id === buyerId),
  listAll: () => [...cache.reviews].sort((a, b) => +new Date(b.created_at) - +new Date(a.created_at)),
  canReview(buyerId: string, productId: string) {
    return cache.orders.some((o) =>
      o.buyer_id === buyerId && o.items.some((i) => i.product_id === productId && ['reached_to_buyer', 'delivered'].includes(i.status)),
    ) && !cache.reviews.some((r) => r.buyer_id === buyerId && r.product_id === productId)
  },
  async create(input: { productId: string; buyer: Profile; rating: number; comment: string }) {
    const supabase = getSupabase()
    const { data: orderItems } = await supabase
      .from('order_items').select('order_id, orders!inner(buyer_id)')
      .in('status', ['reached_to_buyer', 'delivered'])
    const matchingOrder = (orderItems ?? []).find((oi: any) => oi.orders?.buyer_id === input.buyer.id)
    const { data: review } = await supabase.from('reviews').insert({
      product_id: input.productId, order_id: matchingOrder?.order_id,
      buyer_id: input.buyer.id, buyer_name: input.buyer.full_name,
      rating: input.rating, comment: input.comment.trim(), is_approved: true,
    }).select('*').single()
    cache.reviews.push(review as Review)
    // Refresh products for updated ratings
    const { data: prods } = await supabase.from('products').select('*')
    cache.products = (prods ?? []) as Product[]
    // Notify seller
    const product = cache.products.find((p) => p.id === input.productId)
    if (product) {
      await supabase.from('notifications').insert({ user_id: product.seller_id, type: 'review', title: `New ${input.rating}★ review`, body: `${input.buyer.full_name} reviewed one of your products.` })
    }
    emitChange()
  },
  async setApproved(id: string, approved: boolean) {
    const supabase = getSupabase()
    await supabase.from('reviews').update({ is_approved: approved }).eq('id', id)
    const idx = cache.reviews.findIndex((x) => x.id === id)
    if (idx >= 0) cache.reviews[idx] = { ...cache.reviews[idx], is_approved: approved }
    emitChange()
  },
}

/* ════════════════════════════════════════════════════════════════
   MESSAGING
   ════════════════════════════════════════════════════════════════ */

export const messaging = {
  conversationsFor(userId: string, opts?: { storeId?: string }): Array<Conversation & { counterpart: Profile | undefined }> {
    return cache.conversations
      .filter((c) => {
        if (!(c.buyer_id === userId || c.seller_id === userId)) return false
        if (opts?.storeId && c.store_id && c.store_id !== opts.storeId) return false
        return true
      })
      .map((c) => {
        const counterpartId = c.buyer_id === userId ? c.seller_id : c.buyer_id
        // Look up counterpart from all known profiles (including previously fetched ones)
        const counterpart = cache.profiles.find((p) => p.id === counterpartId) ?? undefined
        return { ...c, counterpart }
      })
      .sort((a, b) => +new Date(b.last_at) - +new Date(a.last_at))
  },
  byId: (id: string) => cache.conversations.find((c) => c.id === id),
  messages: (conversationId: string) =>
    cache.messages.filter((m) => m.conversation_id === conversationId).sort((a, b) => +new Date(a.created_at) - +new Date(b.created_at)),
  lastMessage: (conversationId: string) => {
    const list = cache.messages.filter((m) => m.conversation_id === conversationId)
    return list[list.length - 1]
  },

  async start(input: { buyerId: string; sellerId: string; productId?: string; storeId?: string; orderCode?: string; body: string }): Promise<Conversation> {
    const supabase = getSupabase()
    const validStoreId = input.storeId && isUuid(input.storeId) ? input.storeId : null
    const validProdId = input.productId && isUuid(input.productId) ? input.productId : null
    const existing = cache.conversations.find((c) =>
      c.buyer_id === input.buyerId && c.seller_id === input.sellerId && (validStoreId ? c.store_id === validStoreId : true),
    )
    let convId = existing?.id
    if (!convId) {
      const { data: dbExisting } = await supabase.from('conversations')
        .select('*')
        .eq('buyer_id', input.buyerId)
        .eq('seller_id', input.sellerId)
        .maybeSingle()
      if (dbExisting) {
        convId = dbExisting.id
        if (!cache.conversations.some((c) => c.id === convId)) cache.conversations.push(dbExisting as Conversation)
      } else {
        const { data: conv, error: convErr } = await supabase.from('conversations').insert({
          buyer_id: input.buyerId,
          seller_id: input.sellerId,
          product_id: validProdId,
          store_id: validStoreId,
          order_code: input.orderCode || null,
        }).select('*').single()
        if (convErr || !conv) throw new Error(convErr?.message || 'Could not start conversation.')
        convId = conv.id
        cache.conversations.push(conv as Conversation)
      }
    }
    await messaging.send(convId!, input.buyerId, input.body)
    return messaging.byId(convId!) || cache.conversations.find((c) => c.id === convId)!
  },

  async send(conversationId: string, senderId: string, body: string): Promise<Message> {
    const trimmed = body.trim()
    if (!trimmed) throw new Error('Message cannot be empty.')
    const supabase = getSupabase()

    let conv = cache.conversations.find((x) => x.id === conversationId)
    if (!conv) {
      const { data: dbConv } = await supabase.from('conversations').select('*').eq('id', conversationId).maybeSingle()
      if (dbConv) {
        conv = dbConv as Conversation
        cache.conversations.push(conv)
      }
    }
    const receiverId = conv ? (conv.buyer_id === senderId ? conv.seller_id : conv.buyer_id) : undefined

    const { data: msg, error } = await supabase.from('messages').insert({
      conversation_id: conversationId,
      sender_id: senderId,
      receiver_id: receiverId,
      body: trimmed,
      content: trimmed,
    }).select('*').single()

    if (error || !msg) {
      console.error('[messaging.send] error:', error)
      throw new Error(error?.message || 'Could not send message.')
    }
    cache.messages.push(msg as Message)
    if (conv) {
      conv.last_at = msg.created_at
      if (senderId === conv.buyer_id) { conv.seller_unread += 1; conv.buyer_unread = 0 }
      else { conv.buyer_unread += 1; conv.seller_unread = 0 }
    }
    emitChange()
    return msg as Message
  },

  async reload(userId: string) {
    const supabase = getSupabase()
    const { data: convs } = await supabase.from('conversations')
      .select('*')
      .or(`buyer_id.eq.${userId},seller_id.eq.${userId}`)
      .order('last_at', { ascending: false })
    if (convs) {
      cache.conversations = convs as Conversation[]
      const convIds = convs.map((c) => c.id)
      if (convIds.length > 0) {
        const { data: msgs } = await supabase.from('messages')
          .select('*')
          .in('conversation_id', convIds)
          .order('created_at', { ascending: true })
        if (msgs) {
          cache.messages = msgs as Message[]
        }
      }
      emitChange()
    }
  },

  async markRead(conversationId: string, userId: string) {
    const supabase = getSupabase()
    const c = cache.conversations.find((x) => x.id === conversationId)
    if (!c) return
    const update: Record<string, number> = {}
    if (c.buyer_id === userId) { c.buyer_unread = 0; update.buyer_unread = 0 }
    if (c.seller_id === userId) { c.seller_unread = 0; update.seller_unread = 0 }
    if (Object.keys(update).length) await supabase.from('conversations').update(update).eq('id', conversationId)
    emitChange()
  },

  listAll() {
    return cache.conversations
      .map((c) => ({
        ...c,
        buyer_name: cache.profiles.find((p) => p.id === c.buyer_id)?.full_name ?? c.buyer_id,
        seller_name: cache.profiles.find((p) => p.id === c.seller_id)?.full_name ?? c.seller_id,
      }))
      .sort((a, b) => +new Date(b.last_at) - +new Date(a.last_at))
  },
}

/* ════════════════════════════════════════════════════════════════
   NOTIFICATIONS
   ════════════════════════════════════════════════════════════════ */

export const notifications = {
  list: (userId: string) => cache.notifications.filter((n) => n.user_id === userId).sort((a, b) => +new Date(b.created_at) - +new Date(a.created_at)),
  unreadCount: (userId: string) => cache.notifications.filter((n) => n.user_id === userId && !n.read).length,
  async markRead(id: string) {
    const supabase = getSupabase()
    await supabase.from('notifications').update({ read: true, is_read: true }).eq('id', id)
    const n = cache.notifications.find((x) => x.id === id); if (n) n.read = true
    emitChange()
  },
  async markAllRead(userId: string) {
    const supabase = getSupabase()
    await supabase.from('notifications').update({ read: true, is_read: true }).eq('user_id', userId)
    cache.notifications.forEach((n) => { if (n.user_id === userId) n.read = true })
    emitChange()
  },
  async push(input: { user_id: string; type: Notification['type']; title: string; body: string; href?: string }) {
    const supabase = getSupabase()
    const { data } = await supabase.from('notifications').insert({
      user_id: input.user_id,
      type: input.type,
      title: input.title,
      body: input.body,
      message: input.body,
      href: input.href,
      link: input.href,
      read: false,
      is_read: false,
    }).select('*').single()
    if (data) cache.notifications.unshift(data as Notification)
    emitChange()
  },
  listAll: () => [...cache.notifications].sort((a, b) => +new Date(b.created_at) - +new Date(a.created_at)),
}

export const emailSubscribers = {
  async subscribe(email: string) {
    const supabase = getSupabase()
    const { data, error } = await supabase.rpc('subscribe_email', { p_email: email })
    if (error) throw new Error(error.message)
    return data as { ok: boolean; email: string; is_subscribed: boolean }
  },
  async unsubscribe(token: string) {
    const supabase = getSupabase()
    const { data, error } = await supabase.rpc('unsubscribe_email', { p_token: token })
    if (error) throw new Error(error.message)
    return data as { ok: boolean }
  },
}

/* ════════════════════════════════════════════════════════════════
   USERS (admin)
   ════════════════════════════════════════════════════════════════ */

export const users = {
  list: (role?: Role) => cache.profiles.filter((p) => !role || p.role === role),
  byId: (id: string) => cache.profiles.find((p) => p.id === id),
  async setBlocked(id: string, blocked: boolean) {
    const supabase = getSupabase()
    await supabase.from('profiles').update({ is_blocked: blocked }).eq('id', id)
    const u = cache.profiles.find((p) => p.id === id); if (u) u.is_blocked = blocked
    emitChange()
  },
  async setRole(id: string, role: Role) {
    const supabase = getSupabase()
    await supabase.from('profiles').update({ role }).eq('id', id)
    const u = cache.profiles.find((p) => p.id === id); if (u) u.role = role
    emitChange()
  },
}

/** Ensure admin profiles are loaded (called when admin pages mount). */
export async function ensureAdminData() {
  if (!isSupabaseConfigured) return
  try {
    const supabase = getSupabase()
    const [{ data: profiles }, { data: settingsData }, storesRes, reviewsRes] = await Promise.all([
      supabase.from('public_profiles').select('*'),
      supabase.from('platform_settings').select('*').eq('id', 1).single(),
      supabase.from('seller_stores').select('*'),
      supabase.from('reviews').select('*'),
    ])
    let profilesData = (profiles ?? []) as Profile[]
    if (profilesData.length === 0) {
      const { data: pData } = await supabase.from('profiles').select('*')
      profilesData = (pData ?? []) as Profile[]
    }
    if (profilesData.length > 0) {
      cache.profiles = profilesData.map(normalizeProfile)
    }
    if (settingsData) cache.settings = settingsData as any
    if (storesRes.data && storesRes.data.length > 0) {
      cache.stores = (storesRes.data as Store[]).filter((s) => isUuid(s.id))
    }
    if (reviewsRes.data) cache.reviews = reviewsRes.data as Review[]
    await refreshOrders()
    emitChange()
  } catch (e) {
    console.warn('[ensureAdminData] Failed to load admin extras:', e)
  }
}

/* ════════════════════════════════════════════════════════════════
   SETTINGS & REPORTS
   ════════════════════════════════════════════════════════════════ */

export const settings = {
  get: () => cache.settings,
  async update(patch: Partial<DBState['settings']>) {
    const supabase = getSupabase()
    await supabase.from('platform_settings').update(patch).eq('id', 1)
    Object.assign(cache.settings, patch)
    emitChange()
  },
}

export const reports = {
  list: () => [...cache.reports].sort((a, b) => +new Date(b.created_at) - +new Date(a.created_at)),
  async create(kind: Report['kind']): Promise<Report> {
    const supabase = getSupabase()
    const s = await stats.admin()
    const label = { sales: 'Sales & revenue', users: 'Users & sellers', products: 'Products & categories', reviews: 'Reviews' }[kind]
    const summary = {
      sales: `${s.orders} orders · Rs ${Math.round(s.revenue).toLocaleString()} revenue · 0% sales commission (Monthly seller subscription model).`,
      users: `${s.users} users — ${s.buyers} buyers and ${s.sellers} sellers. ${s.pendingStores} store application(s) awaiting approval.`,
      products: `${s.products} products across ${s.categories} categories.`,
      reviews: `${s.reviews} reviews · average rating ${s.avgRating}★.`,
    }[kind]
    const { data: inserted, error: repErr } = await supabase.from('reports').insert({ title: `${label} report`, kind, range: 'Live snapshot', summary }).select('*').single()
    if (repErr || !inserted) throw new Error(repErr?.message ?? 'Failed to create report')
    const rep = inserted as Report
    cache.reports.unshift(rep)
    emitChange()
    return rep
  },
}

/* ════════════════════════════════════════════════════════════════
   STATS (mostly sync reads from cache)
   ════════════════════════════════════════════════════════════════ */

export const stats = {
  landing() {
    const cities = new Set<string>()
    for (const o of cache.orders) if (o.address?.city) cities.add(o.address.city)
    for (const p of cache.profiles) if (p.location) cities.add(p.location)
    return {
      categories: cache.categories.length,
      creators: cache.stores.filter((st) => st.is_approved && !st.deleted_at).length,
      products: cache.products.filter((p) => p.status === 'active').length,
      orders: cache.orders.length,
      cities: cities.size || 6,
    }
  },

  admin() {
    const paid = cache.orders.filter((o) => o.payment === 'paid')
    const revenue = paid.reduce((sum, o) => sum + o.total, 0)
    const commission = 0 // 0% commission model (PKR 1,200/mo seller subscription replaces sales commission)
    const ratings = cache.reviews.filter((r) => r.is_approved)
    return {
      users: cache.profiles.length, buyers: cache.profiles.filter((p) => p.role === 'buyer').length,
      sellers: cache.profiles.filter((p) => p.role === 'seller').length, admins: cache.profiles.filter((p) => p.role === 'admin').length,
      pendingStores: cache.stores.filter((st) => !st.is_approved).length,
      products: cache.products.length, activeProducts: cache.products.filter((p) => p.status === 'active').length,
      pendingProducts: cache.products.filter((p) => p.status === 'pending').length, categories: cache.categories.length,
      orders: cache.orders.length, revenue, commission,
      reviews: cache.reviews.length, pendingReviews: cache.reviews.filter((r) => !r.is_approved).length,
      avgRating: ratings.length ? Math.round((ratings.reduce((a, r) => a + r.rating, 0) / ratings.length) * 10) / 10 : 0,
      ordersByStatus: (['submitted', 'packaging', 'packed', 'sent_to_platform', 'on_way', 'reached_to_buyer', 'cancelled'] as OrderStatus[])
        .map((k) => ({ key: k, count: cache.orders.filter((o) => o.status === k).length })),
    }
  },

  seller(storeId: string) {
    const store = cache.stores.find((x) => x.id === storeId)
    const mine = cache.orders.filter((o) => !['cancelled'].includes(o.status) && o.items.some((i) => i.store_id === storeId))
    let gross = 0
    for (const o of mine) for (const i of o.items) if (i.store_id === storeId && i.status !== 'cancelled') gross += i.price * i.qty
    const commission = 0 // 0% sales commission (sellers keep 100% of product price)
    const prods = cache.products.filter((p) => p.store_id === storeId)
    const reviewsForStore = cache.reviews.filter((r) => prods.some((p) => p.id === r.product_id))
    return {
      store, orders: mine.length, gross, commission, earnings: gross,
      products: prods.length, active: prods.filter((p) => p.status === 'active').length,
      outOfStock: prods.filter((p) => p.stock === 0).length,
      reviews: reviewsForStore.length,
      avgRating: reviewsForStore.length ? Math.round((reviewsForStore.reduce((a, r) => a + r.rating, 0) / reviewsForStore.length) * 10) / 10 : 0,
      customers: new Set(mine.map((o) => o.buyer_id)).size,
    }
  },

  monthlySeries(months: string[], pick: (o: Order) => number) {
    const map = new Map(months.map((m) => [m, 0]))
    for (const o of cache.orders) {
      const d = new Date(o.created_at)
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
      if (map.has(key)) map.set(key, (map.get(key) ?? 0) + pick(o))
    }
    return months.map((m) => map.get(m) ?? 0)
  },
}

/* ════════════════════════════════════════════════════════════════
   STORAGE — product image uploads (Supabase Storage)
   ════════════════════════════════════════════════════════════════ */

const PRODUCT_IMAGE_TYPES = new Set(['image/jpeg', 'image/jpg', 'image/png', 'image/webp'])
const PRODUCT_IMAGE_MAX_BYTES = 5 * 1024 * 1024

export const storage = {
  allowedTypes: PRODUCT_IMAGE_TYPES,
  maxBytes: PRODUCT_IMAGE_MAX_BYTES,

  async uploadProductImage(file: File, sellerId: string): Promise<string> {
    if (!PRODUCT_IMAGE_TYPES.has(file.type)) {
      throw new Error('Please use a JPG, PNG or WEBP image.')
    }
    if (file.size > PRODUCT_IMAGE_MAX_BYTES) {
      throw new Error('Image must be 5 MB or smaller.')
    }
    const supabase = getSupabase()
    const ext = (file.name.split('.').pop() || 'jpg').toLowerCase().replace('jpeg', 'jpg')
    const path = `${sellerId}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`
    const { error } = await supabase.storage.from('product-images').upload(path, file, {
      contentType: file.type,
      upsert: false,
    })
    if (error) throw new Error(error.message || 'Could not upload the image. Please try again.')
    const { data } = supabase.storage.from('product-images').getPublicUrl(path)
    return data.publicUrl
  },

  async uploadPaymentProof(file: File, userId: string, orderId: string): Promise<string> {
    const supabase = getSupabase()
    const ext = (file.name.split('.').pop() || 'jpg').toLowerCase()
    const path = `${userId}/${orderId}/${Date.now()}.${ext}`
    const { error } = await supabase.storage.from('payment-proofs').upload(path, file, { contentType: file.type, upsert: false })
    if (error) throw new Error(error.message || 'Could not upload payment proof.')
    const { data: tx } = await supabase.from('payment_transactions').select('id').eq('order_id', orderId).eq('buyer_id', userId).maybeSingle()
    if (tx) {
      await supabase.from('payment_transactions').update({ proof_url: path, status: 'awaiting_proof', updated_at: new Date().toISOString() }).eq('id', tx.id)
    }
    return path
  },
}

/* ════════════════════════════════════════════════════════════════
   SELLER SUBSCRIPTION & BANK DETAILS
   ════════════════════════════════════════════════════════════════ */

export const subscriptions = {
  async get(sellerId: string): Promise<SellerSubscription> {
    const supabase = getSupabase()
    try {
      const { data, error } = await supabase
        .from('seller_subscriptions')
        .select('*')
        .eq('seller_id', sellerId)
        .maybeSingle()
      if (data && !error) return data as SellerSubscription
    } catch { /* fallback */ }

    // Fallback: 3 months free trial from now
    const now = new Date()
    const trialEnd = new Date(now.getTime() + 90 * 24 * 60 * 60 * 1000)
    return {
      id: `sub-${sellerId}`,
      seller_id: sellerId,
      plan: 'standard_seller',
      monthly_fee: 1200,
      currency: 'PKR',
      status: 'free_trial',
      trial_started_at: now.toISOString(),
      trial_ends_at: trialEnd.toISOString(),
      current_period_start: now.toISOString(),
      current_period_end: trialEnd.toISOString(),
      last_payment_at: null,
      last_payment_reference: null,
      notes: 'Initial 3 months free trial (Free registration)',
      created_at: now.toISOString(),
    }
  },

  async recordPayment(sellerId: string, input: { amount?: number; reference?: string; notes?: string; status?: SellerSubscription['status'] }) {
    const supabase = getSupabase()
    const now = new Date()
    const nextMonth = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000)
    const payload = {
      seller_id: sellerId,
      plan: 'standard_seller',
      monthly_fee: input.amount ?? 1200,
      currency: 'PKR',
      status: input.status ?? 'active',
      current_period_start: now.toISOString(),
      current_period_end: nextMonth.toISOString(),
      last_payment_at: now.toISOString(),
      last_payment_reference: input.reference ?? null,
      notes: input.notes ?? 'Manual subscription payment verified by admin',
      updated_at: now.toISOString(),
    }
    const { data, error } = await supabase
      .from('seller_subscriptions')
      .upsert(payload, { onConflict: 'seller_id' })
      .select('*')
      .single()
    if (error) throw new Error(error.message)
    emitChange()
    return data as SellerSubscription
  },

  async listAll(): Promise<SellerSubscription[]> {
    const supabase = getSupabase()
    try {
      const { data, error } = await supabase.from('seller_subscriptions').select('*').order('created_at', { ascending: false })
      if (error) return []
      return (data ?? []) as SellerSubscription[]
    } catch {
      return []
    }
  },
}

export const bankDetails = {
  async get(sellerId: string): Promise<SellerBankDetails | null> {
    const supabase = getSupabase()
    try {
      const { data, error } = await supabase
        .from('seller_bank_details')
        .select('*')
        .eq('seller_id', sellerId)
        .maybeSingle()
      if (error || !data) return null
      return data as SellerBankDetails
    } catch {
      return null
    }
  },

  async save(sellerId: string, details: { bank_name: string; account_title: string; account_number: string; iban?: string; payment_instructions?: string }): Promise<SellerBankDetails> {
    const supabase = getSupabase()
    const payload = {
      seller_id: sellerId,
      bank_name: details.bank_name.trim(),
      account_title: details.account_title.trim(),
      account_number: details.account_number.trim(),
      iban: details.iban?.trim() || null,
      payment_instructions: details.payment_instructions?.trim() || null,
      updated_at: new Date().toISOString(),
    }
    const { data, error } = await supabase
      .from('seller_bank_details')
      .upsert(payload, { onConflict: 'seller_id' })
      .select('*')
      .single()
    if (error) throw new Error(error.message)
    emitChange()
    return data as SellerBankDetails
  },
}
