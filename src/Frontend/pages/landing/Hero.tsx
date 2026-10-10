import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion, useReducedMotion } from 'framer-motion'
import { ArrowRight, Search, Store, Compass } from 'lucide-react'
import { Button } from '@/components/ui'

const POPULAR = ['Balochi Doch', 'Sajji kit', 'Silver jewelry', 'Calligraphy', 'Juniper tea']

export function Hero() {
  const [q, setQ] = useState('')
  const navigate = useNavigate()
  const reduce = useReducedMotion()

  const submit = (e: React.FormEvent) => {
    e.preventDefault()
    navigate(q.trim() ? `/search?q=${encodeURIComponent(q.trim())}` : '/products')
  }

  return (
    <section className="relative flex min-h-[100svh] items-center justify-center overflow-hidden pt-28 pb-16" aria-label="Welcome">
      {/* ── Balochistan Coastal Landscape Background Behind Hero Content ── */}
      <div className="absolute inset-0 z-0 pointer-events-none overflow-hidden" aria-hidden>
        {/* Background Image: Cover, Center, responsive across desktop, tablet, and mobile */}
        <div
          className="absolute inset-0 bg-cover bg-center bg-no-repeat"
          style={{
            backgroundImage: "url('/images/baloch-hero-bg.jpg')",
            backgroundSize: 'cover',
            backgroundPosition: 'center',
          }}
        />

        {/* Subtle theme-adaptive overlay (cream in Original/Light, dark charcoal/ink in Dark/Alternative) */}
        <div className="absolute inset-0 bg-bg/75 backdrop-blur-[0.5px]" />

        {/* Soft vertical gradient to blend smoothly with top navbar and bottom section */}
        <div className="absolute inset-0 bg-gradient-to-b from-bg/90 via-transparent to-bg" />

        {/* Subtle center radial focus for heading and description readability */}
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,var(--bg)_20%,transparent_75%)] opacity-60" />
      </div>

      <div className="relative z-20 mx-auto w-full max-w-4xl px-5 py-12 text-center sm:px-8">
        {/* Cultural Badge with Doch diamond symbols */}
        <motion.div
          initial={reduce ? false : { opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
          className="mb-6 inline-flex max-w-full items-center gap-2.5 rounded-full border border-terracotta/40 bg-surface/90 px-5 py-2 text-[0.68rem] font-bold uppercase tracking-[0.22em] text-brand dark:text-fg shadow-xs backdrop-blur"
        >
          <span className="text-terracotta text-xs font-serif font-black">✦</span>
          <span>THE BALOCHI CREATORS’ MARKETPLACE</span>
          <span className="text-terracotta text-xs font-serif font-black">✦</span>
        </motion.div>

        {/* Hero Title Matching Image 1 */}
        <h1 className="font-display text-[2.2rem] font-bold leading-[1.14] tracking-tight text-brand dark:text-fg sm:text-[3rem] md:text-[3.6rem] lg:text-[4.2rem]">
          <span className="block">Connecting Balochi</span>
          <span className="block">Creativity With the World</span>
          <span className="block mt-1 text-terracotta">
            — One Store at a Time.
          </span>
        </h1>

        <motion.p
          initial={reduce ? false : { opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.2 }}
          className="mx-auto mt-6 max-w-2xl text-[0.98rem] leading-relaxed text-muted sm:text-lg font-medium"
        >
          Baloch Export Hub gives Balochi creators, artisans and traditional businesses a place to build a free
          online store, showcase their craft and reach buyers everywhere — while keeping purchases, messages and
          payments safe inside the platform.
        </motion.p>

        {/* Two Call to Action Buttons Matching Image 1 */}
        <motion.div
          initial={reduce ? false : { opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.35 }}
          className="mt-8 flex flex-col items-center justify-center gap-3.5 sm:flex-row"
        >
          <Button
            to="/register"
            size="lg"
            className="w-full sm:w-auto !rounded-full !bg-brand hover:opacity-95 px-7 py-3.5 text-[0.95rem] font-bold text-onbrand shadow-md flex items-center justify-center gap-2"
          >
            <Store size={18} /> Create Your Free Store <ArrowRight size={17} />
          </Button>
          <Button
            to="/how-it-works"
            variant="ghost"
            size="lg"
            className="w-full sm:w-auto !rounded-full border border-brand/70 bg-surface/80 hover:bg-surface text-brand dark:text-fg px-7 py-3.5 text-[0.95rem] font-bold backdrop-blur flex items-center justify-center gap-2"
          >
            Discover How It Works <ArrowRight size={17} />
          </Button>
        </motion.div>

        {/* Quick Search for convenience */}
        <motion.form
          onSubmit={submit}
          initial={reduce ? false : { opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.5 }}
          className="mx-auto mt-10 max-w-xl rounded-full border border-line bg-surface/90 p-1.5 shadow-sm transition-all focus-within:border-brand focus-within:shadow-md"
          role="search"
        >
          <div className="flex min-w-0 items-center gap-2 px-2">
            <Search size={18} className="shrink-0 text-terracotta" aria-hidden />
            <label htmlFor="hero-search" className="sr-only">Search the platform</label>
            <input
              id="hero-search"
              name="q"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search products, categories or creators…"
              className="min-w-0 w-full bg-transparent py-2 text-sm text-fg placeholder:text-faint focus:outline-none"
            />
            <button
              type="submit"
              className="shrink-0 rounded-full bg-brand hover:opacity-95 px-4 py-2 text-xs font-bold text-onbrand transition"
            >
              Search
            </button>
          </div>
        </motion.form>
      </div>

      <motion.a
        href="#packing"
        className="absolute bottom-6 left-1/2 -translate-x-1/2 text-faint transition hover:text-gold"
        animate={reduce ? undefined : { y: [0, 8, 0] }}
        transition={{ duration: 1.8, repeat: Infinity, ease: 'easeInOut' }}
        aria-label="Scroll to explore"
      >
        <Compass size={20} className="mx-auto" />
        <span className="mt-1 block text-[0.62rem] uppercase tracking-[0.25em]">Explore</span>
      </motion.a>
    </section>
  )
}
