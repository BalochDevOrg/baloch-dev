import React from 'react'
import { Link } from 'react-router-dom'
import { cn } from '@/lib/util'

/* ── 1. Baloch Export Hub Logo ────────────────────────────────── */
export function BalochLogo({
  compact = false,
  className,
  lightText = false,
}: {
  compact?: boolean
  className?: string
  lightText?: boolean
}) {
  return (
    <Link
      to="/"
      className={cn('group inline-flex min-w-0 items-center gap-2 sm:gap-2.5', className)}
      aria-label="Baloch Export Hub — Home"
    >
      {/* Mountain & Sun Icon — Scaled to balanced proportion */}
      <div className="relative shrink-0 w-7 h-7 sm:w-8 sm:h-8 transition-transform duration-300 group-hover:scale-105">
        <svg viewBox="0 0 72 64" fill="none" className="w-full h-full drop-shadow-2xs">
          {/* Amber Sun */}
          <circle cx="45" cy="22" r="14" fill="#D97706" />
          <circle cx="45" cy="22" r="14" fill="url(#sunGlow)" opacity="0.6" />

          {/* Background Mountain Peak */}
          <polygon
            points="46,12 66,48 26,48"
            fill="#1B4D40"
          />
          {/* Sunlit facet on background peak */}
          <polygon
            points="46,12 56,48 26,48"
            fill="#236050"
          />

          {/* Left / Foreground Mountain Peak */}
          <polygon
            points="24,20 48,52 2,52"
            fill="#124337"
          />
          {/* Highlight facet on left peak */}
          <polygon
            points="24,20 36,52 2,52"
            fill="#175042"
          />
          <polyline
            points="24,20 28,34 26,42 30,52"
            stroke="#FFFFFF"
            strokeWidth="1.2"
            strokeLinecap="round"
            opacity="0.75"
          />

          {/* Far Right Peak */}
          <polygon
            points="58,26 71,52 45,52"
            fill="#154438"
          />

          {/* Flowing Water / Coastal Waves at Base */}
          <path
            d="M 4 56 Q 22 51, 38 56 T 68 56"
            stroke="#124337"
            strokeWidth="3.2"
            strokeLinecap="round"
          />
          <path
            d="M 10 60 Q 26 57, 44 60 T 64 60"
            stroke="#2E7D68"
            strokeWidth="2"
            strokeLinecap="round"
            opacity="0.8"
          />

          <defs>
            <radialGradient id="sunGlow" cx="50%" cy="50%" r="50%">
              <stop offset="0%" stopColor="#F59E0B" stopOpacity="0.8" />
              <stop offset="100%" stopColor="#D97706" stopOpacity="0" />
            </radialGradient>
          </defs>
        </svg>
      </div>

      {/* Brand Text — Proportionate & Aligned */}
      {!compact && (
        <div className="flex flex-col justify-center leading-none">
          <span
            className={cn(
              "font-display text-[0.82rem] sm:text-[0.96rem] font-bold tracking-tight leading-tight whitespace-nowrap",
              lightText ? "text-white" : "text-fg"
            )}
          >
            Baloch <span className="hidden min-[440px]:inline text-terracotta">Export </span><span className="text-terracotta">Hub</span>
          </span>
          <span
            className={cn(
              "mt-0.5 text-[0.42rem] sm:text-[0.48rem] font-semibold uppercase tracking-[0.16em] whitespace-nowrap hidden sm:inline-block",
              lightText ? "text-amber-200/80" : "text-muted"
            )}
          >
            Craft • Culture • Trade
          </span>
        </div>
      )}
    </Link>
  )
}

/* ── 2. Mountain Panorama Banner (Disabled — mountain/sun graphics removed) ── */
export function MountainPanoramaBanner(_props?: {
  className?: string
  opacity?: number
}) {
  return null
}


/* ── 3. Traditional Balochi Geometric Embroidery Motif (Doch) ── */
export function BalochiDochWatermark({
  className,
  size = 180,
  opacity = 0.22,
}: {
  className?: string
  size?: number
  opacity?: number
}) {
  return (
    <div
      className={cn('pointer-events-none select-none overflow-hidden', className)}
      style={{ opacity, width: size, height: size }}
      aria-hidden
    >
      <svg viewBox="0 0 100 100" fill="none" className="w-full h-full">
        {/* Nested Doch Diamonds */}
        <rect
          x="50"
          y="10"
          width="40"
          height="40"
          transform="rotate(45 50 10)"
          stroke="#C05621"
          strokeWidth="1.5"
          fill="none"
        />
        <rect
          x="50"
          y="18"
          width="30"
          height="30"
          transform="rotate(45 50 18)"
          stroke="#144237"
          strokeWidth="1.2"
          fill="none"
        />
        <rect
          x="50"
          y="26"
          width="20"
          height="20"
          transform="rotate(45 50 26)"
          stroke="#D97706"
          strokeWidth="1"
          fill="none"
        />
        {/* Diamond Center Cross */}
        <line x1="50" y1="36" x2="50" y2="64" stroke="#C05621" strokeWidth="1" />
        <line x1="36" y1="50" x2="64" y2="50" stroke="#C05621" strokeWidth="1" />
        <circle cx="50" cy="50" r="3" fill="#C05621" />

        {/* Surrounding Geometric Petals / Triangles */}
        <polygon points="50,15 45,26 55,26" fill="#144237" opacity="0.6" />
        <polygon points="50,85 45,74 55,74" fill="#144237" opacity="0.6" />
        <polygon points="15,50 26,45 26,55" fill="#144237" opacity="0.6" />
        <polygon points="85,50 74,45 74,55" fill="#144237" opacity="0.6" />

        {/* Small corner diamond accents */}
        <rect x="25" y="25" width="8" height="8" transform="rotate(45 25 25)" fill="#D97706" opacity="0.5" />
        <rect x="75" y="25" width="8" height="8" transform="rotate(45 75 25)" fill="#D97706" opacity="0.5" />
        <rect x="25" y="75" width="8" height="8" transform="rotate(45 25 75)" fill="#D97706" opacity="0.5" />
        <rect x="75" y="75" width="8" height="8" transform="rotate(45 75 75)" fill="#D97706" opacity="0.5" />
      </svg>
    </div>
  )
}

/* ── 4. Vertical Doch Border Frame (for Landing Page Right Edge) ── */
export function BalochiDochBorderStrip({
  className,
}: {
  className?: string
}) {
  return (
    <div className={cn('pointer-events-none select-none overflow-hidden', className)} aria-hidden>
      <svg
        viewBox="0 0 160 600"
        fill="none"
        preserveAspectRatio="none"
        className="w-full h-full drop-shadow-md"
      >
        <defs>
          <pattern id="dochStep" width="80" height="80" patternUnits="userSpaceOnUse">
            {/* Step motif */}
            <path
              d="M 40 0 L 80 40 L 40 80 L 0 40 Z"
              fill="#982A1C"
              stroke="#E8B46B"
              strokeWidth="2"
            />
            <path
              d="M 40 12 L 68 40 L 40 68 L 12 40 Z"
              fill="#144237"
              stroke="#F4EDE1"
              strokeWidth="1.5"
            />
            <path
              d="M 40 24 L 56 40 L 40 56 L 24 40 Z"
              fill="#D97706"
              stroke="#982A1C"
              strokeWidth="1"
            />
            <circle cx="40" cy="40" r="3" fill="#FFFFFF" />
            {/* Corner dots */}
            <circle cx="0" cy="0" r="2" fill="#E8B46B" />
            <circle cx="80" cy="0" r="2" fill="#E8B46B" />
            <circle cx="0" cy="80" r="2" fill="#E8B46B" />
            <circle cx="80" cy="80" r="2" fill="#E8B46B" />
          </pattern>
        </defs>

        {/* Outer Border */}
        <rect x="20" y="0" width="140" height="600" fill="url(#dochStep)" />
        <line x1="20" y1="0" x2="20" y2="600" stroke="#E8B46B" strokeWidth="4" />
        <line x1="16" y1="0" x2="16" y2="600" stroke="#982A1C" strokeWidth="2" />
        <line x1="12" y1="0" x2="12" y2="600" stroke="#144237" strokeWidth="2" />
      </svg>
    </div>
  )
}

/* ── 5. Centered Bottom Doch Diamond Ornament (as seen in Dashboards) ── */
export function BalochiBottomOrnament({
  className,
}: {
  className?: string
}) {
  return (
    <div className={cn('flex items-center justify-center gap-3 py-6 select-none opacity-80', className)} aria-hidden>
      <div className="h-px w-16 bg-gradient-to-r from-transparent to-[#D6CAB6]" />
      <svg width="28" height="28" viewBox="0 0 32 32" fill="none">
        <rect
          x="16"
          y="4"
          width="17"
          height="17"
          transform="rotate(45 16 4)"
          stroke="#C05621"
          strokeWidth="1.5"
          fill="#FAF7F2"
        />
        <rect
          x="16"
          y="8"
          width="11"
          height="11"
          transform="rotate(45 16 8)"
          stroke="#144237"
          strokeWidth="1.2"
          fill="#FAF7F2"
        />
        <circle cx="16" cy="16" r="2.5" fill="#D97706" />
      </svg>
      <div className="h-px w-16 bg-gradient-to-l from-transparent to-[#D6CAB6]" />
    </div>
  )
}
