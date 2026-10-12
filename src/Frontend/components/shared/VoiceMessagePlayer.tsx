import { useEffect, useMemo, useRef, useState } from 'react'
import { Play, Pause, Loader2, Volume2, FastForward } from 'lucide-react'
import { cn } from '@/lib/util'

// Global reference to pause other playing audios
let activeAudioElement: HTMLAudioElement | null = null

interface VoiceMessagePlayerProps {
  url: string
  duration?: number | null
  isMine?: boolean
  messageId?: string
}

export function VoiceMessagePlayer({ url, duration = 0, isMine = false, messageId }: VoiceMessagePlayerProps) {
  const audioRef = useRef<HTMLAudioElement | null>(null)
  const [isPlaying, setIsPlaying] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [currentTime, setCurrentTime] = useState(0)
  const [audioDuration, setAudioDuration] = useState<number>(duration || 0)
  const [playbackRate, setPlaybackRate] = useState<number>(1)
  const [loadError, setLoadError] = useState(false)

  // Generate deterministic realistic audio waveform bars (24 bars for high responsiveness)
  const waveformBars = useMemo(() => {
    const seed = (messageId || url).split('').reduce((acc, char) => acc + char.charCodeAt(0), 0)
    const bars: number[] = []
    for (let i = 0; i < 24; i++) {
      const pseudoRandom = Math.abs(Math.sin((seed + i * 7) * 0.45))
      const envelope = Math.sin((i / 23) * Math.PI) * 0.4 + 0.6
      const heightPercent = Math.max(18, Math.min(100, Math.round((pseudoRandom * 0.7 + 0.3) * envelope * 100)))
      bars.push(heightPercent)
    }
    return bars
  }, [url, messageId])

  useEffect(() => {
    const audio = new Audio()
    audio.preload = 'metadata'
    audio.src = url
    audioRef.current = audio

    const onLoadedMetadata = () => {
      if (audio.duration && !isNaN(audio.duration) && isFinite(audio.duration)) {
        setAudioDuration(audio.duration)
      }
      setIsLoading(false)
    }

    const onTimeUpdate = () => {
      setCurrentTime(audio.currentTime)
    }

    const onEnded = () => {
      setIsPlaying(false)
      setCurrentTime(0)
    }

    const onPause = () => {
      setIsPlaying(false)
    }

    const onError = () => {
      setIsLoading(false)
      setLoadError(true)
    }

    audio.addEventListener('loadedmetadata', onLoadedMetadata)
    audio.addEventListener('timeupdate', onTimeUpdate)
    audio.addEventListener('ended', onEnded)
    audio.addEventListener('pause', onPause)
    audio.addEventListener('error', onError)

    return () => {
      audio.removeEventListener('loadedmetadata', onLoadedMetadata)
      audio.removeEventListener('timeupdate', onTimeUpdate)
      audio.removeEventListener('ended', onEnded)
      audio.removeEventListener('pause', onPause)
      audio.removeEventListener('error', onError)
      audio.pause()
      if (activeAudioElement === audio) {
        activeAudioElement = null
      }
    }
  }, [url])

  const togglePlay = async () => {
    if (!audioRef.current) return

    if (isPlaying) {
      audioRef.current.pause()
      setIsPlaying(false)
    } else {
      if (activeAudioElement && activeAudioElement !== audioRef.current) {
        try {
          activeAudioElement.pause()
        } catch {}
      }
      activeAudioElement = audioRef.current

      try {
        setIsLoading(true)
        await audioRef.current.play()
        setIsLoading(false)
        setIsPlaying(true)
      } catch (err) {
        console.warn('[VoicePlayer] playback error:', err)
        setIsLoading(false)
        setIsPlaying(false)
      }
    }
  }

  const handleSeek = (index: number) => {
    if (!audioRef.current) return
    const targetFraction = (index + 0.5) / waveformBars.length
    const effectiveDuration = audioDuration || duration || 10
    const targetTime = targetFraction * effectiveDuration
    audioRef.current.currentTime = targetTime
    setCurrentTime(targetTime)
  }

  const cyclePlaybackRate = (e: React.MouseEvent) => {
    e.stopPropagation()
    if (!audioRef.current) return
    const nextRate = playbackRate === 1 ? 1.5 : playbackRate === 1.5 ? 2 : 1
    audioRef.current.playbackRate = nextRate
    setPlaybackRate(nextRate)
  }

  const formatSec = (secs: number) => {
    const s = Math.max(0, Math.floor(secs))
    const mins = Math.floor(s / 60)
    const remainder = s % 60
    return `${mins}:${remainder.toString().padStart(2, '0')}`
  }

  const effectiveDuration = audioDuration || duration || 0
  const progressRatio = effectiveDuration > 0 ? Math.min(1, currentTime / effectiveDuration) : 0

  if (loadError) {
    return (
      <div className="flex items-center gap-2 py-1 text-xs opacity-80 flex-wrap">
        <Volume2 size={15} className="shrink-0" />
        <span className="truncate">Audio note unavailable</span>
        <a href={url} target="_blank" rel="noopener noreferrer" className="underline font-semibold text-xs shrink-0">
          Open raw
        </a>
      </div>
    )
  }

  return (
    <div
      className={cn(
        'group select-none flex flex-col gap-1 w-full min-w-0 max-w-full py-0.5',
        isMine ? 'text-onbrand' : 'text-fg',
      )}
    >
      <div className="flex items-center gap-2 sm:gap-3 min-w-0">
        {/* Play/Pause round button - mobile-friendly touch target */}
        <button
          type="button"
          onClick={togglePlay}
          disabled={isLoading}
          aria-label={isPlaying ? 'Pause voice message' : 'Play voice message'}
          className={cn(
            'grid h-8.5 w-8.5 sm:h-9.5 sm:w-9.5 shrink-0 place-items-center rounded-full transition transform active:scale-95 shadow-sm',
            isMine
              ? 'bg-white text-brand hover:bg-white/90 dark:bg-gold dark:text-zinc-950'
              : 'bg-brand text-white hover:bg-brand/90 dark:bg-gold dark:text-zinc-950',
          )}
        >
          {isLoading ? (
            <Loader2 size={15} className="animate-spin" />
          ) : isPlaying ? (
            <Pause size={15} className="fill-current" />
          ) : (
            <Play size={15} className="fill-current translate-x-0.5" />
          )}
        </button>

        {/* Waveform Scrubber Bars */}
        <div className="flex-1 flex flex-col justify-center gap-1 min-w-0 overflow-hidden">
          <div
            className="flex items-center gap-[1.5px] sm:gap-[2.5px] h-6 sm:h-7 cursor-pointer w-full overflow-hidden"
            title="Click along waveform to jump"
          >
            {waveformBars.map((heightPercent, idx) => {
              const barFraction = idx / waveformBars.length
              const isPlayed = barFraction <= progressRatio

              return (
                <button
                  key={idx}
                  type="button"
                  onClick={() => handleSeek(idx)}
                  className="group/bar relative flex-1 h-full flex items-center justify-center p-0 bg-transparent border-0 focus:outline-none min-w-[2px]"
                  aria-label={`Jump to ${Math.round(barFraction * 100)}%`}
                >
                  <span
                    style={{ height: `${heightPercent}%` }}
                    className={cn(
                      'w-full max-w-[3px] sm:max-w-[3.5px] rounded-full transition-all duration-100',
                      isMine
                        ? isPlayed
                          ? 'bg-white dark:bg-gold'
                          : 'bg-white/35 dark:bg-gold/30 group-hover/bar:bg-white/60'
                        : isPlayed
                        ? 'bg-brand dark:bg-gold'
                        : 'bg-line group-hover/bar:bg-muted/50',
                    )}
                  />
                </button>
              )
            })}
          </div>

          {/* Time & speed controls */}
          <div
            className={cn(
              'flex items-center justify-between text-[0.62rem] sm:text-[0.68rem] font-medium leading-none px-0.5',
              isMine ? 'text-onbrand/80' : 'text-muted',
            )}
          >
            <span className="tnum truncate">
              {isPlaying || currentTime > 0
                ? `${formatSec(currentTime)} / ${formatSec(effectiveDuration)}`
                : formatSec(effectiveDuration)}
            </span>

            <button
              type="button"
              onClick={cyclePlaybackRate}
              title="Change audio playback speed"
              className={cn(
                'inline-flex items-center gap-0.5 rounded px-1.5 py-0.5 text-[0.6rem] sm:text-[0.62rem] font-bold tracking-tight transition shrink-0',
                isMine
                  ? 'bg-white/15 hover:bg-white/25 text-white'
                  : 'bg-surface-2 hover:bg-surface-3 text-fg border border-line/60',
              )}
            >
              <FastForward size={9} />
              <span>{playbackRate}x</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
