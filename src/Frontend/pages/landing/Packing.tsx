import React from 'react'
import { Package, PackageCheck, PackageSearch, HandHeart } from 'lucide-react'
import { SectionHeading, Reveal } from '@/components/ui'

const STEPS = [
  { icon: <HandHeart size={16} />, label: 'Made by hand' },
  { icon: <Package size={16} />, label: 'Packed with care' },
  { icon: <PackageSearch size={16} />, label: 'Tracked to you' },
  { icon: <PackageCheck size={16} />, label: 'Delivered safely' },
]

export function Packing() {
  return (
    <section id="packing" className="relative overflow-hidden py-24 sm:py-32" aria-label="How orders are packed">
      <div className="mx-auto max-w-7xl px-5 sm:px-8">
        <SectionHeading
          center
          eyebrow="The journey of an order"
          title={<>From artisan hands <span className="text-gradient">to your doorstep</span></>}
          sub="Every order is prepared by the maker, packed with care and tracked until it reaches you — a small ritual repeated for each parcel."
        />

        <Reveal delay={0.15} className="relative mx-auto mt-14 max-w-4xl">
          <div className="card relative h-[380px] overflow-hidden sm:h-[460px] lg:h-[520px]">
            <video
              src="/videos/parcel-animation.mp4"
              autoPlay
              loop
              muted
              playsInline
              preload="auto"
              className="h-full w-full object-cover object-center"
              aria-label="Baloch Export Hub parcel animation"
            />
            {/* Subtle atmospheric ambient overlay for theme harmony */}
            <div
              className="pointer-events-none absolute inset-0 bg-[radial-gradient(700px_360px_at_50%_0%,color-mix(in_oklab,var(--gold)_10%,transparent),transparent),radial-gradient(560px_320px_at_50%_100%,color-mix(in_oklab,var(--brand)_12%,transparent),transparent)]"
              aria-hidden
            />
          </div>

          {/* overlay caption chips */}
          <div className="pointer-events-none absolute inset-x-0 bottom-4 flex flex-wrap items-center justify-center gap-2 px-4">
            {STEPS.map((s, i) => (
              <Reveal key={s.label} delay={0.25 + i * 0.12}>
                <span className="glass inline-flex items-center gap-2 rounded-full px-3.5 py-1.5 text-[0.72rem] font-semibold text-fg">
                  <span className="text-gold">{s.icon}</span> {s.label}
                </span>
              </Reveal>
            ))}
          </div>
        </Reveal>

        <Reveal delay={0.2}>
          <p className="mx-auto mt-8 max-w-xl text-center text-sm text-faint">
            One parcel, four handcrafted pieces, sealed with a golden band.
          </p>
        </Reveal>
      </div>
    </section>
  )
}
