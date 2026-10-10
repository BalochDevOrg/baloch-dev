import React, { useState } from 'react'
import { Check, Image as ImageIcon, Sparkles, Eye, X } from 'lucide-react'
import { Button } from '@/components/ui'
import { cn } from '@/lib/util'

export interface BannerItem {
  id: string
  category: 'food' | 'doch' | 'handicrafts' | 'photography' | 'jewelry' | 'art'
  categoryLabel: string
  title: string
  description: string
  image: string
  tags: string[]
}

export const CURATED_BANNERS: BannerItem[] = [
  {
    id: 'banner-food',
    category: 'food',
    categoryLabel: 'Food & Restaurants',
    title: 'Traditional Balochi Cuisine & Feast',
    description: 'Authentic Balochi Sajji skewers, Kaak tandoor bread, dates & warm dining hospitality',
    image: '/images/banners/balochi-food-dining.jpg',
    tags: ['Sajji', 'Kaak', 'Restaurant', 'Traditional Food'],
  },
  {
    id: 'banner-doch',
    category: 'doch',
    categoryLabel: 'Doch & Textiles',
    title: 'Balochi Doch & Heritage Embroidery',
    description: 'Master hand-needlework, traditional Doch motifs, royal silk dresses & Balochi textiles',
    image: '/images/banners/balochi-doch-textiles.jpg',
    tags: ['Doch', 'Embroidery', 'Dresses', 'Textiles'],
  },
  {
    id: 'banner-handicrafts',
    category: 'handicrafts',
    categoryLabel: 'Handicrafts & Culture',
    title: 'Handicrafts, Pottery & Cultural Artifacts',
    description: 'Hand-carved clay pottery, palm-leaf woven craft, antique copperware & cultural rugs',
    image: '/images/banners/handicrafts-culture.jpg',
    tags: ['Handicrafts', 'Pottery', 'Cultural Products', 'Woven'],
  },
  {
    id: 'banner-photography',
    category: 'photography',
    categoryLabel: 'Photography & Studios',
    title: 'Photography & Creative Visual Studio',
    description: 'Studio optics, coastal Makran golden-hour landscape, prints & visual storytelling',
    image: '/images/banners/photography-studio.jpg',
    tags: ['Photography', 'Creative Studio', 'Makran Coast', 'Artistic'],
  },
  {
    id: 'banner-jewelry',
    category: 'jewelry',
    categoryLabel: 'Jewelry & Retail',
    title: 'Balochi Silver Jewelry & Gemstones',
    description: 'Intricately handcrafted Balochi silver ornaments, lapis lazuli, turquoise rings & bangles',
    image: '/images/banners/jewelry-crafts.jpg',
    tags: ['Silver Jewelry', 'Gemstones', 'Turquoise', 'Handmade'],
  },
  {
    id: 'banner-art',
    category: 'art',
    categoryLabel: 'Fine Arts & Calligraphy',
    title: 'Balochi Calligraphy & Heritage Artwork',
    description: 'Classical ink calligraphy, cultural canvas paintings & artisanal studio crafts',
    image: '/images/cat-calligraphy.jpg',
    tags: ['Calligraphy', 'Fine Art', 'Cultural Painting'],
  },
]

interface StoreBannerGalleryProps {
  selectedBanner?: string
  storeName?: string
  onSelect: (bannerUrl: string) => void
  onSave?: (bannerUrl: string) => Promise<void> | void
  isSaving?: boolean
  className?: string
}

export function StoreBannerGallery({
  selectedBanner,
  storeName = 'My Store',
  onSelect,
  onSave,
  isSaving = false,
  className,
}: StoreBannerGalleryProps) {
  const [activeCategory, setActiveCategory] = useState<string>('all')
  const [previewingBanner, setPreviewingBanner] = useState<BannerItem | null>(null)

  const categories = [
    { key: 'all', label: 'All Curated Banners' },
    { key: 'food', label: 'Food & Dining' },
    { key: 'doch', label: 'Doch & Textiles' },
    { key: 'handicrafts', label: 'Handicrafts' },
    { key: 'photography', label: 'Photography' },
    { key: 'jewelry', label: 'Jewelry & Retail' },
    { key: 'art', label: 'Calligraphy & Art' },
  ]

  const filteredBanners = activeCategory === 'all'
    ? CURATED_BANNERS
    : CURATED_BANNERS.filter((b) => b.category === activeCategory)

  return (
    <div className={cn('space-y-5', className)}>
      {/* Category selector pills */}
      <div className="flex flex-wrap items-center gap-2">
        {categories.map((c) => {
          const isActive = activeCategory === c.key
          return (
            <button
              key={c.key}
              type="button"
              onClick={() => setActiveCategory(c.key)}
              className={cn(
                'rounded-full px-3.5 py-1.5 text-xs font-semibold transition-all duration-150',
                isActive
                  ? 'bg-brand text-onbrand shadow-xs ring-1 ring-brand/30'
                  : 'bg-surface border border-line text-muted hover:border-brand/40 hover:text-fg'
              )}
            >
              {c.label}
            </button>
          )
        })}
      </div>

      {/* Grid of wide banner cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {filteredBanners.map((banner) => {
          const isSelected = selectedBanner === banner.image
          return (
            <div
              key={banner.id}
              className={cn(
                'group relative flex flex-col overflow-hidden rounded-2xl border transition-all duration-200 bg-surface shadow-xs hover:shadow-md',
                isSelected
                  ? 'border-brand ring-2 ring-brand/30'
                  : 'border-line hover:border-brand/50'
              )}
            >
              {/* Wide banner preview */}
              <div className="relative aspect-[16/8] w-full overflow-hidden bg-surface-2">
                <img
                  src={banner.image}
                  alt={banner.title}
                  className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
                  loading="lazy"
                />

                {/* Subtle dark gradient overlay to ensure text legibility */}
                <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent pointer-events-none" />

                {/* Category label badge */}
                <div className="absolute top-2.5 left-2.5">
                  <span className="rounded-full bg-black/60 backdrop-blur-md px-2.5 py-1 text-[0.68rem] font-bold uppercase tracking-wider text-white">
                    {banner.categoryLabel}
                  </span>
                </div>

                {/* Selected checkmark indicator */}
                {isSelected && (
                  <div className="absolute top-2.5 right-2.5">
                    <span className="inline-flex items-center gap-1 rounded-full bg-brand px-2.5 py-1 text-[0.68rem] font-bold text-onbrand shadow-sm">
                      <Check size={12} /> Active Banner
                    </span>
                  </div>
                )}

                {/* Bottom title on image */}
                <div className="absolute bottom-2.5 left-2.5 right-2.5">
                  <p className="text-xs font-bold text-white drop-shadow-sm truncate">
                    {banner.title}
                  </p>
                </div>
              </div>

              {/* Card info & action buttons */}
              <div className="flex flex-1 flex-col justify-between p-3.5 space-y-3">
                <p className="text-[0.75rem] text-muted line-clamp-2 leading-relaxed">
                  {banner.description}
                </p>

                <div className="flex items-center justify-between gap-2 pt-1 border-t border-line">
                  <button
                    type="button"
                    onClick={() => setPreviewingBanner(banner)}
                    className="inline-flex items-center gap-1 text-[0.72rem] font-medium text-muted hover:text-fg transition"
                  >
                    <Eye size={13} /> Full Preview
                  </button>

                  <button
                    type="button"
                    disabled={isSaving}
                    onClick={() => {
                      onSelect(banner.image)
                      if (onSave) void onSave(banner.image)
                    }}
                    className={cn(
                      'rounded-full px-3.5 py-1.5 text-xs font-bold transition shadow-xs',
                      isSelected
                        ? 'bg-emerald-600/15 text-emerald-700 dark:text-emerald-300 border border-emerald-500/30'
                        : 'bg-brand hover:opacity-95 text-onbrand'
                    )}
                  >
                    {isSelected ? '✓ Selected' : 'Choose This'}
                  </button>
                </div>
              </div>
            </div>
          )
        })}
      </div>

      {/* Full Preview Modal with Store Overlay */}
      {previewingBanner && (
        <div className="fixed inset-0 z-[120] flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-fade-in">
          <div className="relative w-full max-w-3xl overflow-hidden rounded-3xl border border-line bg-surface shadow-2xl">
            {/* Modal Header */}
            <div className="flex items-center justify-between border-b border-line px-5 py-4">
              <div className="flex items-center gap-2">
                <span className="grid h-7 w-7 place-items-center rounded-lg bg-brand/12 text-brand">
                  <ImageIcon size={16} />
                </span>
                <div>
                  <h3 className="font-display text-base font-bold text-brand dark:text-fg">
                    {previewingBanner.title}
                  </h3>
                  <p className="text-[0.7rem] text-muted uppercase tracking-wider font-semibold">
                    {previewingBanner.categoryLabel}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setPreviewingBanner(null)}
                className="rounded-full p-1.5 text-muted hover:bg-surface-2 hover:text-fg"
                aria-label="Close preview"
              >
                <X size={18} />
              </button>
            </div>

            {/* Live Store Page Preview Simulation */}
            <div className="p-5 space-y-4">
              <p className="text-xs text-muted">
                How this banner appears on your store page with high legibility overlay:
              </p>

              <div className="relative aspect-[21/9] sm:aspect-[16/6] w-full overflow-hidden rounded-2xl border border-line shadow-inner">
                <img
                  src={previewingBanner.image}
                  alt={previewingBanner.title}
                  className="h-full w-full object-cover"
                />
                {/* Legibility gradient overlay */}
                <div className="absolute inset-0 bg-gradient-to-t from-[var(--surface)] via-black/30 to-black/20" />

                {/* Simulated Store Title & Badge */}
                <div className="absolute bottom-4 left-5 right-5 flex items-end justify-between">
                  <div>
                    <span className="inline-block rounded-full bg-brand/80 px-2.5 py-0.5 text-[0.65rem] font-bold uppercase tracking-wider text-white backdrop-blur mb-1">
                      Verified Balochi Store
                    </span>
                    <h4 className="font-display text-xl sm:text-2xl font-bold text-white drop-shadow-md">
                      {storeName}
                    </h4>
                  </div>
                </div>
              </div>

              <div className="rounded-xl border border-line bg-surface-2/40 p-3.5 text-xs text-muted">
                <p className="font-semibold text-fg">Category Details:</p>
                <p className="mt-1">{previewingBanner.description}</p>
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {previewingBanner.tags.map((t) => (
                    <span key={t} className="rounded-md bg-surface px-2 py-0.5 text-[0.68rem] text-muted border border-line">
                      #{t}
                    </span>
                  ))}
                </div>
              </div>
            </div>

            {/* Modal Actions */}
            <div className="flex items-center justify-end gap-2.5 border-t border-line px-5 py-3.5 bg-surface-2/30">
              <Button
                variant="ghost"
                size="sm"
                type="button"
                onClick={() => setPreviewingBanner(null)}
              >
                Close
              </Button>
              <Button
                size="sm"
                type="button"
                disabled={isSaving}
                onClick={() => {
                  onSelect(previewingBanner.image)
                  if (onSave) void onSave(previewingBanner.image)
                  setPreviewingBanner(null)
                }}
              >
                <Check size={14} className="mr-1" /> Use for My Store
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
