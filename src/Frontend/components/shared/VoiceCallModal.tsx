import React from 'react'
import {
  Phone,
  PhoneOff,
  PhoneCall,
  Mic,
  MicOff,
  Minimize2,
  Maximize2,
  AlertCircle,
  Wifi,
  WifiOff,
} from 'lucide-react'
import { useVoiceCall } from './VoiceCallContext'
import { Avatar } from '@/components/ui'
import { BalochiDochWatermark } from '@/components/shared/BalochDecorations'

function formatSeconds(secs: number): string {
  const m = Math.floor(secs / 60)
  const s = secs % 60
  return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`
}

export function VoiceCallModal() {
  const { call, isMinimized, setIsMinimized, acceptCall, rejectCall, endCall, toggleMute } = useVoiceCall()

  if (!call) return null

  const isIncoming = call.status === 'ringing' && call.role === 'callee'

  /* ── Minimized Floating Bar (Mobile & Desktop Responsive) ────────── */
  if (isMinimized && call.status === 'connected') {
    return (
      <div className="fixed bottom-20 md:bottom-6 right-2.5 sm:right-6 z-50 flex max-w-[calc(100vw-1.25rem)] items-center gap-2 sm:gap-3 rounded-full border border-line bg-surface/95 px-3 sm:px-4 py-2 sm:py-2.5 shadow-xl backdrop-blur-md transition-all animate-in fade-in slide-in-from-bottom-4">
        <div className="relative shrink-0">
          <Avatar
            name={call.counterpart.name}
            color={call.counterpart.color ?? undefined}
            size={32}
          />
          <span className="absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full border-2 border-surface bg-emerald-500 animate-pulse" />
        </div>

        <div className="min-w-0 pr-0.5 flex-1">
          <p className="max-w-[85px] sm:max-w-[140px] truncate text-xs font-bold text-fg">
            {call.counterpart.name}
          </p>
          <p className="font-mono text-[0.68rem] font-semibold text-brand dark:text-gold tnum">
            {formatSeconds(call.durationSeconds)}
          </p>
        </div>

        <div className="flex items-center gap-1 sm:gap-1.5 border-l border-line pl-1.5 sm:pl-2 shrink-0">
          <button
            type="button"
            onClick={toggleMute}
            aria-label={call.isMuted ? 'Unmute microphone' : 'Mute microphone'}
            className={`grid h-7.5 w-7.5 sm:h-8 sm:w-8 place-items-center rounded-full transition ${
              call.isMuted
                ? 'bg-amber-500/20 text-amber-600 dark:text-amber-400'
                : 'hover:bg-surface-2 text-muted'
            }`}
          >
            {call.isMuted ? <MicOff size={14} /> : <Mic size={14} />}
          </button>

          <button
            type="button"
            onClick={endCall}
            aria-label="End voice call"
            className="grid h-7.5 w-7.5 sm:h-8 sm:w-8 place-items-center rounded-full bg-crimson text-white hover:opacity-90 transition shadow-xs"
          >
            <PhoneOff size={14} />
          </button>

          <button
            type="button"
            onClick={() => setIsMinimized(false)}
            aria-label="Maximize call screen"
            className="grid h-7.5 w-7.5 sm:h-8 sm:w-8 place-items-center rounded-full hover:bg-surface-2 text-muted transition"
          >
            <Maximize2 size={14} />
          </button>
        </div>
      </div>
    )
  }

  /* ── Incoming Call Modal (Full Responsive Overlay) ─────────────── */
  if (isIncoming) {
    return (
      <div className="fixed inset-0 z-50 grid place-items-center bg-black/65 p-3 sm:p-4 backdrop-blur-md animate-in fade-in overflow-y-auto">
        <div className="relative w-full max-w-xs sm:max-w-sm overflow-hidden rounded-3xl border border-line bg-surface p-5 sm:p-7 text-center shadow-2xl my-auto">
          {/* Subtle Doch watermark decoration */}
          <div className="pointer-events-none absolute -right-8 -top-8 opacity-20">
            <BalochiDochWatermark size={140} />
          </div>

          <div className="relative z-10 flex flex-col items-center">
            {/* Pulsing Avatar */}
            <div className="relative mb-4 sm:mb-5">
              <span className="absolute -inset-3 rounded-full bg-brand/20 animate-ping opacity-75" />
              <span className="absolute -inset-6 rounded-full bg-gold/15 animate-pulse" />
              <div className="relative">
                <Avatar
                  name={call.counterpart.name}
                  color={call.counterpart.color ?? undefined}
                  size={74}
                />
              </div>
            </div>

            <span className="inline-flex items-center gap-1.5 rounded-full bg-brand/10 px-3 py-1 text-[0.68rem] font-bold uppercase tracking-wider text-brand dark:text-gold">
              <PhoneCall size={12} className="animate-bounce" /> Incoming Call
            </span>

            <h3 className="mt-2.5 font-display text-xl sm:text-2xl font-bold tracking-tight text-fg truncate max-w-full">
              {call.counterpart.name}
            </h3>
            <p className="mt-0.5 text-xs text-muted">
              Baloch Export Hub Verified Contact
            </p>

            <div className="mt-6 sm:mt-8 flex w-full items-center justify-center gap-6 sm:gap-8">
              {/* Reject Button */}
              <div className="flex flex-col items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => rejectCall()}
                  aria-label="Decline incoming call"
                  className="grid h-14 w-14 sm:h-16 sm:w-16 place-items-center rounded-full bg-crimson text-white transition hover:scale-105 active:scale-95 shadow-md"
                >
                  <PhoneOff size={22} />
                </button>
                <span className="text-xs font-semibold text-muted">Decline</span>
              </div>

              {/* Accept Button */}
              <div className="flex flex-col items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => void acceptCall()}
                  aria-label="Accept incoming call"
                  className="grid h-14 w-14 sm:h-16 sm:w-16 place-items-center rounded-full bg-emerald-600 text-white transition hover:scale-105 active:scale-95 shadow-md animate-bounce"
                >
                  <Phone size={22} />
                </button>
                <span className="text-xs font-bold text-emerald-600 dark:text-emerald-400">Accept</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    )
  }

  /* ── Active / Outgoing / Completed Call Modal ─────────────────── */
  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/65 p-3 sm:p-4 backdrop-blur-md animate-in fade-in overflow-y-auto">
      <div className="relative w-full max-w-xs sm:max-w-sm overflow-hidden rounded-3xl border border-line bg-surface p-5 sm:p-7 text-center shadow-2xl my-auto">
        {/* Subtle Doch watermark decoration */}
        <div className="pointer-events-none absolute -right-8 -top-8 opacity-20">
          <BalochiDochWatermark size={140} />
        </div>

        {/* Minimize Button in Top-Right if call is connected */}
        {call.status === 'connected' && (
          <button
            type="button"
            onClick={() => setIsMinimized(true)}
            aria-label="Minimize voice call"
            className="absolute right-3.5 top-3.5 grid h-8 w-8 place-items-center rounded-full text-muted hover:bg-surface-2 transition z-20"
            title="Minimize call to floating bar"
          >
            <Minimize2 size={15} />
          </button>
        )}

        <div className="relative z-10 flex flex-col items-center">
          {/* Avatar with status indicator ring */}
          <div className="relative mb-4 sm:mb-5">
            {call.status === 'calling' && (
              <span className="absolute -inset-3 rounded-full bg-brand/20 animate-ping opacity-60" />
            )}
            {call.status === 'connected' && (
              <span className="absolute -inset-2 rounded-full border-2 border-emerald-500/50 animate-pulse" />
            )}
            <div className="relative">
              <Avatar
                name={call.counterpart.name}
                color={call.counterpart.color ?? undefined}
                size={74}
              />
            </div>
          </div>

          <h3 className="font-display text-xl sm:text-2xl font-bold tracking-tight text-fg truncate max-w-full">
            {call.counterpart.name}
          </h3>

          {/* Status Label */}
          <div className="mt-2">
            {call.status === 'calling' && (
              <div className="flex items-center gap-1.5 text-xs font-semibold text-brand dark:text-gold animate-pulse">
                <Wifi size={13} /> Dialing & connecting…
              </div>
            )}

            {call.status === 'ringing' && (
              <div className="flex items-center gap-1.5 text-xs font-semibold text-brand dark:text-gold animate-pulse">
                <PhoneCall size={13} /> Ringing…
              </div>
            )}

            {call.status === 'connected' && (
              <div className="space-y-1">
                <div className="flex items-center justify-center gap-2 text-xs font-bold uppercase tracking-wider text-emerald-600 dark:text-emerald-400">
                  <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" /> Connected
                </div>
                <p className="font-mono text-2xl font-bold tracking-wide text-fg tnum">
                  {formatSeconds(call.durationSeconds)}
                </p>
              </div>
            )}

            {call.status === 'offline' && (
              <div className="flex flex-col items-center gap-1 text-xs font-semibold text-amber-600 dark:text-amber-400">
                <div className="flex items-center gap-1">
                  <WifiOff size={14} /> User is currently offline
                </div>
                <span className="text-[0.7rem] text-muted">You can leave a voice message in chat.</span>
              </div>
            )}

            {call.status === 'missed' && (
              <div className="flex items-center gap-1 text-xs font-semibold text-amber-600 dark:text-amber-400">
                <AlertCircle size={14} /> No answer · Missed call
              </div>
            )}

            {call.status === 'rejected' && (
              <div className="flex items-center gap-1 text-xs font-semibold text-rose-500">
                <PhoneOff size={14} /> {call.error || 'Call declined'}
              </div>
            )}

            {call.status === 'ended' && (
              <div className="flex items-center gap-1 text-xs font-semibold text-muted">
                <PhoneOff size={14} /> Call ended ({formatSeconds(call.durationSeconds)})
              </div>
            )}

            {call.status === 'error' && (
              <div className="rounded-xl bg-rose-500/10 p-3 text-xs text-rose-500">
                <p className="font-semibold flex items-center justify-center gap-1 mb-1">
                  <AlertCircle size={14} /> Call Failed
                </p>
                <p className="text-[0.75rem] leading-snug">{call.error || 'Connection error occurred.'}</p>
              </div>
            )}
          </div>

          {/* Action Controls */}
          <div className="mt-6 sm:mt-8 flex w-full items-center justify-center gap-5 sm:gap-6">
            {(call.status === 'connected' || call.status === 'calling' || call.status === 'ringing') && (
              <>
                {/* Mute Button */}
                <div className="flex flex-col items-center gap-1.5">
                  <button
                    type="button"
                    onClick={toggleMute}
                    aria-label={call.isMuted ? 'Unmute microphone' : 'Mute microphone'}
                    className={`grid h-12 w-12 sm:h-13 sm:w-13 place-items-center rounded-full transition shadow-xs ${
                      call.isMuted
                        ? 'bg-amber-500 text-white hover:bg-amber-600 ring-2 ring-amber-500/30'
                        : 'border border-line bg-surface-2 text-fg hover:bg-surface'
                    }`}
                  >
                    {call.isMuted ? <MicOff size={18} /> : <Mic size={18} />}
                  </button>
                  <span className="text-[0.68rem] font-medium text-muted">
                    {call.isMuted ? 'Unmute' : 'Mute'}
                  </span>
                </div>

                {/* End Call Button */}
                <div className="flex flex-col items-center gap-1.5">
                  <button
                    type="button"
                    onClick={endCall}
                    aria-label="End call"
                    className="grid h-13 w-13 sm:h-15 sm:w-15 place-items-center rounded-full bg-crimson text-white transition hover:scale-105 active:scale-95 shadow-md hover:bg-crimson/90"
                  >
                    <PhoneOff size={20} />
                  </button>
                  <span className="text-[0.68rem] font-bold text-crimson">End</span>
                </div>
              </>
            )}

            {(call.status === 'ended' ||
              call.status === 'rejected' ||
              call.status === 'missed' ||
              call.status === 'offline' ||
              call.status === 'error') && (
              <button
                type="button"
                onClick={endCall}
                className="btn btn-secondary !rounded-2xl px-6 py-2.5 text-xs font-bold"
              >
                Close
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
