import { useEffect, useMemo, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  MessageCircle,
  Package,
  Search,
  Send,
  Loader2,
  AlertCircle,
  Phone,
  Mic,
  Square,
  Trash2,
} from 'lucide-react'
import { messaging, products, stores, storage } from '@/lib/db'
import { useAuth, useDb } from '@/lib/providers'
import { cn, formatDate, timeAgo } from '@/lib/util'
import { Avatar, EmptyState } from '@/components/ui'
import { useVoiceCall } from './VoiceCallContext'
import { VoiceMessagePlayer } from './VoiceMessagePlayer'

/**
 * Shared conversations UI for buyer & seller dashboards.
 * 100% responsive across mobile phones (320px+), tablets, and desktops.
 */
export function MessagesView({ perspective }: { perspective: 'buyer' | 'seller' }) {
  const { user } = useAuth()
  const dbVersion = useDb()
  const { startCall } = useVoiceCall()
  const [activeId, setActiveId] = useState<string | null>(null)
  const [draft, setDraft] = useState('')
  const [sending, setSending] = useState(false)
  const [sendError, setSendError] = useState<string | null>(null)
  const [q, setQ] = useState('')
  const bottomRef = useRef<HTMLDivElement>(null)

  // Voice Chat / Recording state
  const [isRecording, setIsRecording] = useState(false)
  const [recordingSeconds, setRecordingSeconds] = useState(0)
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null)
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const [isUploadingVoice, setIsUploadingVoice] = useState(false)
  const [micVolume, setMicVolume] = useState<number[]>([20, 35, 60, 30, 45])
  const [micError, setMicError] = useState<string | null>(null)

  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const mediaStreamRef = useRef<MediaStream | null>(null)
  const audioChunksRef = useRef<Blob[]>([])
  const recordingTimerRef = useRef<any>(null)
  const analyserRef = useRef<AnalyserNode | null>(null)
  const animFrameRef = useRef<number | null>(null)

  useEffect(() => {
    if (user?.id) void messaging.reload(user.id)
  }, [user?.id])

  const conversations = useMemo(() => {
    if (!user) return []
    const store = perspective === 'seller' ? stores.activeFor(user.id) : undefined
    return messaging.conversationsFor(user.id, store ? { storeId: store.id } : undefined).filter((c) =>
      q ? (c.counterpart?.full_name ?? '').toLowerCase().includes(q.toLowerCase()) : true,
    )
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, q, dbVersion, activeId, perspective])

  useEffect(() => {
    if (!activeId && conversations.length) setActiveId(conversations[0].id)
  }, [conversations.length])

  const active = conversations.find((c) => c.id === activeId) ?? null
  const thread = active ? messaging.messages(active.id) : []

  useEffect(() => {
    if (active && user?.id) messaging.markRead(active.id, user.id)
  }, [activeId, thread.length, user?.id])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' })
  }, [thread.length])

  // Cleanup media recording when switching conversations or unmounting
  useEffect(() => {
    return () => {
      cancelRecording()
    }
  }, [activeId])

  if (!user) return null

  const send = async () => {
    const text = draft.trim()
    if (!active || !text || sending) return
    setSending(true)
    setSendError(null)
    try {
      await messaging.send(active.id, user.id, text)
      setDraft('')
    } catch (err: any) {
      console.error('[Messages] send error:', err)
      setSendError(err?.message || 'Failed to send message. Please try again.')
    } finally {
      setSending(false)
    }
  }

  /* ── Recording Controls ────────────────────────────────────────── */

  const cleanupStream = () => {
    if (animFrameRef.current) {
      cancelAnimationFrame(animFrameRef.current)
      animFrameRef.current = null
    }
    if (recordingTimerRef.current) {
      clearInterval(recordingTimerRef.current)
      recordingTimerRef.current = null
    }
    if (mediaStreamRef.current) {
      mediaStreamRef.current.getTracks().forEach((track) => track.stop())
      mediaStreamRef.current = null
    }
    analyserRef.current = null
  }

  const cancelRecording = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      try {
        mediaRecorderRef.current.stop()
      } catch {}
    }
    cleanupStream()
    setIsRecording(false)
    setRecordingSeconds(0)
    setAudioBlob(null)
    if (previewUrl) {
      URL.revokeObjectURL(previewUrl)
      setPreviewUrl(null)
    }
    setMicError(null)
  }

  const startRecording = async () => {
    cancelRecording()
    setMicError(null)
    setSendError(null)

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      mediaStreamRef.current = stream

      try {
        const AudioCtx = window.AudioContext || (window as any).webkitAudioContext
        if (AudioCtx) {
          const audioCtx = new AudioCtx()
          const source = audioCtx.createMediaStreamSource(stream)
          const analyser = audioCtx.createAnalyser()
          analyser.fftSize = 32
          source.connect(analyser)
          analyserRef.current = analyser

          const bufferLength = analyser.frequencyBinCount
          const dataArray = new Uint8Array(bufferLength)

          const updateVolume = () => {
            if (!analyserRef.current) return
            analyserRef.current.getByteFrequencyData(dataArray)
            const b1 = Math.max(18, (dataArray[1] / 255) * 100)
            const b2 = Math.max(25, (dataArray[3] / 255) * 100)
            const b3 = Math.max(20, (dataArray[5] / 255) * 100)
            const b4 = Math.max(30, (dataArray[7] / 255) * 100)
            const b5 = Math.max(18, (dataArray[9] / 255) * 100)
            setMicVolume([b1, b2, b3, b4, b5])
            animFrameRef.current = requestAnimationFrame(updateVolume)
          }
          updateVolume()
        }
      } catch (e) {
        console.warn('Analyser visualizer setup error:', e)
      }

      const mimeCandidates = ['audio/webm;codecs=opus', 'audio/webm', 'audio/ogg;codecs=opus', 'audio/mp4', '']
      const chosenMime = mimeCandidates.find((m) => !m || MediaRecorder.isTypeSupported(m)) || ''

      const recorder = chosenMime ? new MediaRecorder(stream, { mimeType: chosenMime }) : new MediaRecorder(stream)
      mediaRecorderRef.current = recorder
      audioChunksRef.current = []

      recorder.ondataavailable = (event) => {
        if (event.data && event.data.size > 0) {
          audioChunksRef.current.push(event.data)
        }
      }

      recorder.start(100)
      setIsRecording(true)
      setRecordingSeconds(0)

      recordingTimerRef.current = setInterval(() => {
        setRecordingSeconds((prev) => {
          if (prev >= 300) {
            stopRecordingAndPreview()
            return prev
          }
          return prev + 1
        })
      }, 1000)
    } catch (err: any) {
      console.error('[startRecording] error:', err)
      cleanupStream()
      setIsRecording(false)
      if (err?.name === 'NotAllowedError' || err?.name === 'PermissionDeniedError') {
        setMicError('Microphone permission denied. Please allow microphone access in your browser to record voice notes.')
      } else {
        setMicError('Could not access microphone on this device.')
      }
    }
  }

  const stopRecordingAndPreview = () => {
    if (!mediaRecorderRef.current || mediaRecorderRef.current.state === 'inactive') return
    const recorder = mediaRecorderRef.current

    recorder.onstop = () => {
      cleanupStream()
      const blob = new Blob(audioChunksRef.current, { type: recorder.mimeType || 'audio/webm' })
      setAudioBlob(blob)
      const url = URL.createObjectURL(blob)
      setPreviewUrl(url)
      setIsRecording(false)
    }

    recorder.stop()
  }

  const sendVoiceMessage = async (immediateBlob?: Blob, durationSec?: number) => {
    if (!active || !user) return
    setIsUploadingVoice(true)
    setSendError(null)

    try {
      let blobToSend = immediateBlob || audioBlob
      const finalDuration = durationSec ?? Math.max(1, recordingSeconds)

      if (!blobToSend && mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
        blobToSend = await new Promise<Blob>((resolve) => {
          const rec = mediaRecorderRef.current!
          rec.onstop = () => {
            const b = new Blob(audioChunksRef.current, { type: rec.mimeType || 'audio/webm' })
            resolve(b)
          }
          rec.stop()
        })
        cleanupStream()
      }

      if (!blobToSend || blobToSend.size === 0) {
        throw new Error('Voice note was too short or empty.')
      }

      const voiceUrl = await storage.uploadVoiceNote(blobToSend, user.id)

      await messaging.send(active.id, user.id, '', {
        voiceUrl,
        voiceDuration: finalDuration,
      })

      cancelRecording()
    } catch (err: any) {
      console.error('[sendVoiceMessage] error:', err)
      setSendError(err?.message || 'Failed to send voice note. Please try again.')
    } finally {
      setIsUploadingVoice(false)
      setIsRecording(false)
    }
  }

  return (
    <div className="card grid h-[calc(100dvh-10rem)] min-h-[19rem] min-w-0 grid-cols-1 overflow-hidden sm:min-h-[30rem] md:grid-cols-[min(20rem,40vw)_1fr]">
      {/* conversation list */}
      <div className={`flex flex-col border-line md:border-r ${active ? 'hidden md:flex' : 'flex'}`}>
        <div className="border-b border-line p-2.5 sm:p-3.5">
          <div className="relative">
            {!q && <Search size={14} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-faint" />}
            <input
              id="msg-search"
              name="q"
              className="field field-icon-pl text-xs sm:text-sm py-2"
              placeholder="Search conversations…"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              aria-label="Search conversations"
            />
          </div>
        </div>
        <ul className="flex-1 overflow-y-auto">
          {conversations.length === 0 && (
            <li className="px-4 py-8 text-center text-xs sm:text-sm text-muted">
              No conversations yet. Open a product page and use “Message the seller”.
            </li>
          )}
          {conversations.map((c) => {
            const unread = perspective === 'buyer' ? c.buyer_unread : c.seller_unread
            const last = messaging.lastMessage(c.id)
            const product = c.product_id ? products.byId(c.product_id) : null
            const isVoice = Boolean(last?.voice_url || last?.body?.startsWith('🎤'))

            return (
              <li key={c.id}>
                <button
                  onClick={() => setActiveId(c.id)}
                  className={cn(
                    'flex w-full items-start gap-2.5 sm:gap-3 border-b border-line/60 px-3.5 py-3 text-left transition hover:bg-surface-2',
                    activeId === c.id && 'bg-brand/5',
                  )}
                >
                  <Avatar name={c.counterpart?.full_name ?? '?'} color={c.counterpart?.avatar_color} size={36} />
                  <span className="min-w-0 flex-1">
                    <span className="flex items-baseline justify-between gap-1.5">
                      <span className={cn('truncate text-[0.82rem] sm:text-[0.85rem]', unread ? 'font-bold' : 'font-semibold')}>
                        {c.counterpart?.full_name}
                      </span>
                      <span className="shrink-0 text-[0.62rem] text-faint">{timeAgo(c.last_at)}</span>
                    </span>
                    <span className={cn('mt-0.5 block truncate text-[0.72rem] sm:text-xs', unread ? 'font-medium text-fg' : 'text-muted')}>
                      {last ? (
                        <>
                          {last.sender_id === user.id ? 'You: ' : ''}
                          {isVoice ? (
                            <span className="inline-flex items-center gap-1 font-medium text-brand dark:text-gold">
                              <span>🎤</span>
                              <span>
                                Voice message{' '}
                                {last.voice_duration
                                  ? `(${Math.floor(last.voice_duration / 60)}:${(last.voice_duration % 60).toString().padStart(2, '0')})`
                                  : ''}
                              </span>
                            </span>
                          ) : (
                            last.body
                          )}
                        </>
                      ) : (
                        'Say salaam 👋'
                      )}
                    </span>
                    {product && (
                      <span className="mt-1 inline-block max-w-full truncate rounded-md bg-surface-2 px-1.5 py-0.5 text-[0.6rem] text-faint">
                        ✦ {product.name}
                      </span>
                    )}
                  </span>
                  {unread > 0 && (
                    <span className="mt-1.5 grid h-4.5 min-w-4.5 place-items-center rounded-full bg-crimson px-1 text-[0.62rem] font-bold text-white tnum">
                      {unread}
                    </span>
                  )}
                </button>
              </li>
            )
          })}
        </ul>
      </div>

      {/* thread */}
      <div className={`flex min-h-0 flex-col ${active ? 'flex' : 'hidden md:flex'}`}>
        {active ? (
          <>
            {/* Thread Header (Responsive for all mobile screens) */}
            <div className="flex items-center gap-2 sm:gap-3 border-b border-line px-3 sm:px-5 py-2.5 sm:py-3">
              <button
                className="mr-0.5 rounded-lg px-2 py-1 text-sm font-bold text-muted hover:bg-surface-2 md:hidden"
                onClick={() => setActiveId(null)}
                aria-label="Back to conversations"
              >
                ←
              </button>
              <Avatar name={active.counterpart?.full_name ?? '?'} color={active.counterpart?.avatar_color} size={34} />
              <div className="min-w-0 flex-1">
                <p className="truncate text-xs sm:text-sm font-semibold text-fg">{active.counterpart?.full_name}</p>
                {perspective === 'buyer' ? (
                  active.store_id && stores.byId(active.store_id) ? (
                    <Link to={`/store/${stores.byId(active.store_id)!.slug}`} className="block truncate text-[0.68rem] sm:text-xs text-brand hover:underline dark:text-gold">
                      View store →
                    </Link>
                  ) : active.seller_id && stores.bySeller(active.seller_id) ? (
                    <Link to={`/store/${stores.bySeller(active.seller_id)!.slug}`} className="block truncate text-[0.68rem] sm:text-xs text-brand hover:underline dark:text-gold">
                      View store →
                    </Link>
                  ) : null
                ) : (
                  <p className="text-[0.68rem] sm:text-xs text-faint">Buyer</p>
                )}
              </div>

              {/* Product link (shown on tablet and desktop) */}
              {active.product_id && products.byId(active.product_id) && (
                <Link
                  to={`/product/${active.product_id}`}
                  className="hidden md:flex max-w-[9rem] items-center gap-1.5 rounded-xl border border-line bg-surface-2 px-2.5 py-1 text-xs transition hover:border-gold/50 shrink-0"
                >
                  <Package size={12} className="text-gold shrink-0" />
                  <span className="truncate">{products.byId(active.product_id)!.name}</span>
                </Link>
              )}

              {/* Voice Call Button */}
              {active.counterpart && (
                <button
                  type="button"
                  onClick={() => {
                    void startCall({
                      conversationId: active.id,
                      calleeId: active.counterpart!.id,
                      calleeName: active.counterpart!.full_name,
                      calleeAvatar: active.counterpart!.avatar_url,
                      calleeColor: active.counterpart!.avatar_color,
                    })
                  }}
                  title={`Start voice call with ${active.counterpart.full_name}`}
                  aria-label={`Start voice call with ${active.counterpart.full_name}`}
                  className="inline-flex items-center gap-1.5 rounded-full border border-line bg-surface-2 px-2.5 sm:px-3.5 py-1.5 text-xs font-bold text-fg transition hover:border-brand hover:bg-brand/10 hover:text-brand dark:hover:text-gold shadow-2xs shrink-0"
                >
                  <Phone size={13} className="text-brand dark:text-gold" />
                  <span className="hidden sm:inline">Call</span>
                </button>
              )}
            </div>

            {/* Messages Thread (Scrollable, Responsive Bubbles) */}
            <div className="flex-1 space-y-3 overflow-y-auto bg-bg-soft/50 px-3 sm:px-5 py-3.5 sm:py-5">
              {thread.map((m) => {
                const mine = m.sender_id === user.id
                const isCallLog = m.body.startsWith('📞')

                if (isCallLog) {
                  return (
                    <div key={m.id} className="flex justify-center my-1.5">
                      <div className="inline-flex items-center gap-1.5 rounded-full border border-line bg-surface-2 px-3 py-1 text-[0.7rem] sm:text-xs text-muted shadow-2xs">
                        <span>{m.body}</span>
                        <span className="text-[0.6rem] text-faint">· {formatDate(m.created_at, true)}</span>
                      </div>
                    </div>
                  )
                }

                const voiceUrl = m.voice_url
                const hasVoice = Boolean(voiceUrl)

                return (
                  <div key={m.id} className={cn('flex', mine ? 'justify-end' : 'justify-start')}>
                    <div
                      className={cn(
                        'max-w-[92%] sm:max-w-[78%] rounded-2xl px-3.5 sm:px-4 py-2 sm:py-2.5 text-[0.82rem] sm:text-[0.86rem] leading-relaxed shadow-sm transition-all',
                        mine
                          ? 'rounded-br-md bg-brand text-onbrand'
                          : 'rounded-bl-md border border-line bg-surface',
                      )}
                    >
                      {hasVoice ? (
                        <div className="space-y-1 w-full min-w-0">
                          <VoiceMessagePlayer
                            url={voiceUrl!}
                            duration={m.voice_duration}
                            isMine={mine}
                            messageId={m.id}
                          />
                          {m.body && !m.body.startsWith('🎤 Voice message') && (
                            <p className="pt-1 text-[0.75rem] leading-normal opacity-90">{m.body}</p>
                          )}
                        </div>
                      ) : (
                        <p className="break-words">{m.body}</p>
                      )}
                      <p className={cn('mt-1 text-right text-[0.6rem]', mine ? 'text-onbrand/60' : 'text-faint')}>
                        {formatDate(m.created_at, true)}
                      </p>
                    </div>
                  </div>
                )
              })}
              <div ref={bottomRef} />
            </div>

            {/* Input Bar & Voice Recording Bar */}
            <div className="border-t border-line p-2.5 sm:p-3.5 space-y-2 bg-surface">
              {micError && (
                <div className="flex items-center gap-2 rounded-xl bg-amber-500/10 border border-amber-500/20 px-3 py-2 text-xs text-amber-600 dark:text-amber-400">
                  <AlertCircle size={14} className="shrink-0" />
                  <span className="flex-1 text-[0.72rem] sm:text-xs">{micError}</span>
                  <button type="button" onClick={() => setMicError(null)} className="font-semibold underline shrink-0">
                    Dismiss
                  </button>
                </div>
              )}

              {sendError && (
                <div className="flex items-center gap-2 rounded-xl bg-rose-500/10 border border-rose-500/20 px-3 py-2 text-xs text-rose-500">
                  <AlertCircle size={14} className="shrink-0" />
                  <span className="flex-1 text-[0.72rem] sm:text-xs">{sendError}</span>
                  <button type="button" onClick={() => setSendError(null)} className="font-semibold underline shrink-0">
                    Dismiss
                  </button>
                </div>
              )}

              {/* ACTIVE RECORDING HUD */}
              {isRecording ? (
                <div className="flex items-center gap-2 sm:gap-3 rounded-2xl border border-crimson/30 bg-crimson/5 px-2.5 sm:px-4 py-2 sm:py-2.5 shadow-sm animate-in fade-in duration-150">
                  {/* Pulsing REC Indicator */}
                  <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
                    <span className="relative flex h-2.5 w-2.5 sm:h-3 sm:w-3">
                      <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-crimson opacity-75"></span>
                      <span className="relative inline-flex h-2.5 w-2.5 sm:h-3 sm:w-3 rounded-full bg-crimson"></span>
                    </span>
                    <span className="text-[0.65rem] sm:text-xs font-bold text-crimson tracking-wider uppercase">REC</span>
                    <span className="text-xs sm:text-sm font-mono font-bold text-fg tnum">
                      {Math.floor(recordingSeconds / 60)}:{(recordingSeconds % 60).toString().padStart(2, '0')}
                    </span>
                  </div>

                  {/* Real-time speech visualizer wave bars */}
                  <div className="flex-1 flex items-center justify-center gap-1 sm:gap-1.5 h-6 sm:h-7 px-1 min-w-0 overflow-hidden">
                    {micVolume.map((vol, i) => (
                      <span
                        key={i}
                        style={{ height: `${Math.max(20, Math.min(100, vol))}%` }}
                        className="w-1 sm:w-1.5 rounded-full bg-crimson/80 transition-all duration-75 shrink-0"
                      />
                    ))}
                  </div>

                  {/* Discard */}
                  <button
                    type="button"
                    onClick={cancelRecording}
                    title="Discard recording"
                    aria-label="Discard recording"
                    className="grid h-8 w-8 sm:h-9 sm:w-9 shrink-0 place-items-center rounded-xl text-muted hover:bg-surface-2 hover:text-crimson transition"
                  >
                    <Trash2 size={16} />
                  </button>

                  {/* Stop & preview */}
                  <button
                    type="button"
                    onClick={stopRecordingAndPreview}
                    title="Stop & preview before sending"
                    aria-label="Stop and preview before sending"
                    className="grid h-8 w-8 sm:h-9 sm:w-9 shrink-0 place-items-center rounded-xl border border-line bg-surface text-fg hover:bg-surface-2 transition"
                  >
                    <Square size={13} className="fill-current text-muted" />
                  </button>

                  {/* Send */}
                  <button
                    type="button"
                    onClick={() => void sendVoiceMessage()}
                    disabled={isUploadingVoice}
                    title="Send voice note"
                    aria-label="Send voice note"
                    className="btn btn-primary h-8 w-8 sm:h-9 sm:w-9 shrink-0 !rounded-xl !p-0 shadow-sm"
                  >
                    {isUploadingVoice ? <Loader2 size={15} className="animate-spin" /> : <Send size={15} />}
                  </button>
                </div>
              ) : previewUrl ? (
                /* RECORDING PREVIEW HUD */
                <div className="flex items-center gap-2 sm:gap-3 rounded-2xl border border-brand/30 bg-brand/5 px-2.5 sm:px-3 py-2 shadow-sm animate-in fade-in duration-150">
                  <div className="flex-1 min-w-0">
                    <VoiceMessagePlayer url={previewUrl} duration={recordingSeconds} isMine={false} />
                  </div>

                  <button
                    type="button"
                    onClick={cancelRecording}
                    title="Discard recording"
                    aria-label="Discard recording"
                    className="grid h-8 w-8 sm:h-9 sm:w-9 shrink-0 place-items-center rounded-xl text-muted hover:bg-surface-2 hover:text-crimson transition"
                  >
                    <Trash2 size={16} />
                  </button>

                  <button
                    type="button"
                    onClick={() => void sendVoiceMessage()}
                    disabled={isUploadingVoice}
                    title="Send voice note"
                    aria-label="Send voice note"
                    className="btn btn-primary h-8 w-8 sm:h-9 sm:w-9 shrink-0 !rounded-xl !p-0 shadow-sm"
                  >
                    {isUploadingVoice ? <Loader2 size={15} className="animate-spin" /> : <Send size={15} />}
                  </button>
                </div>
              ) : (
                /* REGULAR TEXT & MIC INPUT ROW */
                <div className="flex items-end gap-1.5 sm:gap-2">
                  <textarea
                    id="msg-draft"
                    name="message"
                    className="field min-h-[2.6rem] sm:min-h-[2.9rem] resize-none py-2 text-xs sm:text-sm flex-1"
                    rows={1}
                    disabled={sending || isUploadingVoice}
                    placeholder="Write a message… or record audio 🎤"
                    value={draft}
                    onChange={(e) => {
                      setDraft(e.target.value)
                      if (sendError) setSendError(null)
                    }}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && !e.shiftKey) {
                        e.preventDefault()
                        void send()
                      }
                    }}
                    aria-label="Message text"
                  />

                  {/* Mic Button */}
                  <button
                    type="button"
                    onClick={() => void startRecording()}
                    disabled={sending || isUploadingVoice}
                    title="Record voice note"
                    aria-label="Record voice note"
                    className="btn btn-ghost h-[2.6rem] w-[2.6rem] sm:h-[2.9rem] sm:w-[2.9rem] !rounded-xl sm:!rounded-2xl !p-0 border border-line bg-surface text-fg hover:border-brand hover:text-brand dark:hover:text-gold hover:bg-brand/5 transition shrink-0"
                  >
                    <Mic size={17} />
                  </button>

                  {/* Send Button */}
                  <button
                    type="button"
                    onClick={() => void send()}
                    disabled={!draft.trim() || sending}
                    className="btn btn-primary h-[2.6rem] w-[2.6rem] sm:h-[2.9rem] sm:w-[2.9rem] !rounded-xl sm:!rounded-2xl !p-0 disabled:opacity-40 shrink-0"
                    aria-label="Send message"
                  >
                    {sending ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
                  </button>
                </div>
              )}
            </div>
          </>
        ) : (
          <div className="grid flex-1 place-items-center p-6 sm:p-8">
            <EmptyState
              icon={<MessageCircle size={26} />}
              title="Select a conversation"
              sub="Choose a conversation on the left, or start one from any product page."
            />
          </div>
        )}
      </div>
    </div>
  )
}
