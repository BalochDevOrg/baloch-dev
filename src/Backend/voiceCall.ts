/**
 * Real-time WebRTC Voice Calling Engine for Baloch Export Hub.
 *
 * Implements real peer-to-peer audio transmission over WebRTC,
 * authenticated signaling via Supabase Realtime broadcast channels,
 * and session state logging with PostgreSQL call_sessions.
 */
import { getSupabase } from './supabase'
import type { ActiveCall, CallParticipant, CallStatus } from './types'

/* ── WebRTC Configuration ───────────────────────────────────────── */

const STUN_SERVERS: RTCIceServer[] = [
  { urls: ['stun:stun.l.google.com:19302', 'stun:stun1.l.google.com:19302', 'stun:stun2.l.google.com:19302'] },
]

function getRtcConfiguration(): RTCConfiguration {
  const iceServers: RTCIceServer[] = [...STUN_SERVERS]

  // Configurable TURN server via environment variables
  const turnUrl = import.meta.env.VITE_TURN_SERVER_URL as string | undefined
  const turnUser = import.meta.env.VITE_TURN_USERNAME as string | undefined
  const turnCred = import.meta.env.VITE_TURN_CREDENTIAL as string | undefined

  if (turnUrl) {
    iceServers.push({
      urls: turnUrl.split(',').map((u) => u.trim()),
      username: turnUser,
      credential: turnCred,
    })
  }

  return {
    iceServers,
    iceCandidatePoolSize: 2,
  }
}

/* ── Web Audio Tone Synthesizer ─────────────────────────────────── */

class ToneSynthesizer {
  private ctx: AudioContext | null = null
  private timer: number | null = null

  private getContext(): AudioContext {
    if (!this.ctx || this.ctx.state === 'closed') {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext
      this.ctx = new AudioCtx()
    }
    if (this.ctx.state === 'suspended') {
      void this.ctx.resume()
    }
    return this.ctx
  }

  startRingback() {
    this.stop()
    try {
      const ctx = this.getContext()
      const playBeep = () => {
        if (!this.ctx || this.ctx.state === 'closed') return
        const now = ctx.currentTime
        const osc1 = ctx.createOscillator()
        const osc2 = ctx.createOscillator()
        const gain = ctx.createGain()

        osc1.frequency.value = 440
        osc2.frequency.value = 480
        gain.gain.setValueAtTime(0.08, now)
        gain.gain.exponentialRampToValueAtTime(0.001, now + 1.2)

        osc1.connect(gain)
        osc2.connect(gain)
        gain.connect(ctx.destination)

        osc1.start(now)
        osc2.start(now)
        osc1.stop(now + 1.2)
        osc2.stop(now + 1.2)
      }
      playBeep()
      this.timer = window.setInterval(playBeep, 3000)
    } catch { /* AudioContext might be blocked until user gesture */ }
  }

  startIncomingRingtone() {
    this.stop()
    try {
      const ctx = this.getContext()
      const playChime = () => {
        if (!this.ctx || this.ctx.state === 'closed') return
        const now = ctx.currentTime
        const notes = [523.25, 659.25, 783.99, 1046.5] // C5, E5, G5, C6
        notes.forEach((freq, idx) => {
          const osc = ctx.createOscillator()
          const gain = ctx.createGain()
          osc.type = 'sine'
          osc.frequency.value = freq

          const start = now + idx * 0.12
          gain.gain.setValueAtTime(0.07, start)
          gain.gain.exponentialRampToValueAtTime(0.001, start + 0.3)

          osc.connect(gain)
          gain.connect(ctx.destination)
          osc.start(start)
          osc.stop(start + 0.3)
        })
      }
      playChime()
      this.timer = window.setInterval(playChime, 2500)
    } catch { /* AudioContext fallback */ }
  }

  playConnectedChime() {
    this.stop()
    try {
      const ctx = this.getContext()
      const now = ctx.currentTime
      const osc = ctx.createOscillator()
      const gain = ctx.createGain()
      osc.frequency.setValueAtTime(523.25, now)
      osc.frequency.exponentialRampToValueAtTime(659.25, now + 0.15)
      gain.gain.setValueAtTime(0.08, now)
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.35)
      osc.connect(gain)
      gain.connect(ctx.destination)
      osc.start(now)
      osc.stop(now + 0.35)
    } catch { /* noop */ }
  }

  playEndedTone() {
    this.stop()
    try {
      const ctx = this.getContext()
      const now = ctx.currentTime
      const osc = ctx.createOscillator()
      const gain = ctx.createGain()
      osc.frequency.setValueAtTime(440, now)
      osc.frequency.exponentialRampToValueAtTime(330, now + 0.2)
      gain.gain.setValueAtTime(0.08, now)
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.35)
      osc.connect(gain)
      gain.connect(ctx.destination)
      osc.start(now)
      osc.stop(now + 0.35)
    } catch { /* noop */ }
  }

  stop() {
    if (this.timer !== null) {
      clearInterval(this.timer)
      this.timer = null
    }
  }
}

const toneSynth = new ToneSynthesizer()

/* ── Voice Calling Service Class ────────────────────────────────── */

type CallStateListener = (call: ActiveCall | null) => void

export class VoiceCallService {
  private activeCall: ActiveCall | null = null
  private pc: RTCPeerConnection | null = null
  private localStream: MediaStream | null = null
  private remoteAudio: HTMLAudioElement | null = null
  private ringTimeout: number | null = null
  private offlineTimeout: number | null = null
  private durationInterval: number | null = null
  private currentSessionDbId: string | null = null

  private listeners: Set<CallStateListener> = new Set()
  private userChannel: any = null
  private roomChannel: any = null
  private subscribedUserId: string | null = null

  constructor() {
    if (typeof window !== 'undefined') {
      this.remoteAudio = new Audio()
      this.remoteAudio.autoplay = true
    }
  }

  subscribe(listener: CallStateListener): () => void {
    this.listeners.add(listener)
    listener(this.activeCall)
    return () => this.listeners.delete(listener)
  }

  private notify() {
    for (const listener of this.listeners) {
      listener(this.activeCall ? { ...this.activeCall } : null)
    }
  }

  /**
   * Initializes real-time listener for incoming call signals on the user's private channel.
   * Called once when the user logs in.
   */
  initUserSignaling(currentUser: { id: string; name: string; avatar?: string | null; color?: string | null }) {
    if (this.subscribedUserId === currentUser.id && this.userChannel) return
    this.cleanupUserSignaling()

    try {
      const supabase = getSupabase()
      this.subscribedUserId = currentUser.id
      const channelName = `call_signal_${currentUser.id}`

      this.userChannel = supabase.channel(channelName, {
        config: { broadcast: { self: false } },
      })

      this.userChannel
        .on('broadcast', { event: 'incoming_call' }, (payload: any) => {
          this.handleIncomingCall(payload.payload, currentUser)
        })
        .on('broadcast', { event: 'ringing_ack' }, (payload: any) => {
          this.handleRingingAck(payload.payload)
        })
        .on('broadcast', { event: 'call_accepted' }, (payload: any) => {
          this.handleCallAccepted(payload.payload)
        })
        .on('broadcast', { event: 'call_rejected' }, (payload: any) => {
          this.handleCallRejected(payload.payload)
        })
        .subscribe()
    } catch (err) {
      console.error('[VoiceCall] initUserSignaling error:', err)
    }
  }

  cleanupUserSignaling() {
    if (this.userChannel) {
      try {
        const supabase = getSupabase()
        supabase.removeChannel(this.userChannel)
      } catch { /* noop */ }
      this.userChannel = null
    }
    this.subscribedUserId = null
  }

  /* ── Outgoing Call Initiation ─────────────────────────────────── */

  async startCall(opts: {
    conversationId: string
    caller: CallParticipant
    callee: CallParticipant
  }): Promise<void> {
    if (this.activeCall && this.activeCall.status !== 'ended') {
      console.warn('[VoiceCall] Already in a call')
      return
    }

    const callId = `call_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`

    this.activeCall = {
      callId,
      conversationId: opts.conversationId,
      role: 'caller',
      counterpart: opts.callee,
      status: 'calling',
      durationSeconds: 0,
      isMuted: false,
    }
    this.notify()
    toneSynth.startRingback()

    // 1. Acquire local microphone stream strictly upon starting call
    try {
      this.localStream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
        video: false,
      })
    } catch (err: any) {
      console.error('[VoiceCall] getUserMedia failed:', err)
      toneSynth.stop()
      const errorMsg =
        err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError'
          ? 'Microphone access denied. Please grant microphone permissions in browser settings.'
          : 'Unable to access microphone. Please check your audio device.'
      this.activeCall = { ...this.activeCall, status: 'error', error: errorMsg }
      this.notify()
      return
    }

    // 2. Persist call session row in Supabase
    try {
      const supabase = getSupabase()
      const { data: session } = await supabase
        .from('call_sessions')
        .insert({
          conversation_id: opts.conversationId,
          caller_id: opts.caller.id,
          callee_id: opts.callee.id,
          status: 'calling',
        })
        .select('id')
        .single()
      if (session) this.currentSessionDbId = session.id
    } catch (e) {
      console.warn('[VoiceCall] Failed to insert call_sessions row:', e)
    }

    // 3. Connect to shared room channel for WebRTC signaling
    this.setupRoomChannel(callId, true)

    // 4. Send incoming_call signal to Callee's personal channel
    try {
      const supabase = getSupabase()
      const calleeChannel = supabase.channel(`call_signal_${opts.callee.id}`)
      await calleeChannel.send({
        type: 'broadcast',
        event: 'incoming_call',
        payload: {
          callId,
          conversationId: opts.conversationId,
          caller: opts.caller,
          calleeId: opts.callee.id,
          timestamp: Date.now(),
        },
      })
    } catch (err) {
      console.error('[VoiceCall] Failed to send incoming_call signal:', err)
    }

    // 5. Offline detection: if no ringing_ack within 6 seconds, target is considered offline
    this.offlineTimeout = window.setTimeout(() => {
      if (this.activeCall && this.activeCall.status === 'calling') {
        toneSynth.stop()
        this.activeCall = {
          ...this.activeCall,
          status: 'offline',
          error: `${opts.callee.name} is currently offline. You can leave a message in chat.`,
        }
        this.notify()
        this.cleanupCallSession('missed', 0)
      }
    }, 6000)

    // 6. No answer / timeout after 30 seconds
    this.ringTimeout = window.setTimeout(() => {
      if (this.activeCall && (this.activeCall.status === 'calling' || this.activeCall.status === 'ringing')) {
        toneSynth.stop()
        this.activeCall = {
          ...this.activeCall,
          status: 'missed',
          error: 'No answer. Call was not answered.',
        }
        this.notify()
        this.cleanupCallSession('missed', 0)
      }
    }, 30000)
  }

  /* ── Incoming Call Handlers ───────────────────────────────────── */

  private handleIncomingCall(
    payload: {
      callId: string
      conversationId: string
      caller: CallParticipant
      calleeId: string
    },
    currentUser: { id: string }
  ) {
    if (payload.calleeId !== currentUser.id) return

    // If already in an active call, ignore or auto-reject
    if (this.activeCall && this.activeCall.status === 'connected') {
      try {
        const supabase = getSupabase()
        const callerChan = supabase.channel(`call_signal_${payload.caller.id}`)
        callerChan.send({
          type: 'broadcast',
          event: 'call_rejected',
          payload: { callId: payload.callId, reason: 'busy' },
        })
      } catch { /* noop */ }
      return
    }

    this.activeCall = {
      callId: payload.callId,
      conversationId: payload.conversationId,
      role: 'callee',
      counterpart: payload.caller,
      status: 'ringing',
      durationSeconds: 0,
      isMuted: false,
    }
    this.notify()
    toneSynth.startIncomingRingtone()

    // Send ringing acknowledgment back to caller
    try {
      const supabase = getSupabase()
      const callerChan = supabase.channel(`call_signal_${payload.caller.id}`)
      callerChan.send({
        type: 'broadcast',
        event: 'ringing_ack',
        payload: { callId: payload.callId },
      })
    } catch { /* noop */ }

    // Auto timeout after 30s
    this.ringTimeout = window.setTimeout(() => {
      if (this.activeCall && this.activeCall.status === 'ringing') {
        toneSynth.stop()
        this.activeCall = {
          ...this.activeCall,
          status: 'missed',
          error: 'Missed call.',
        }
        this.notify()
        this.cleanupMedia()
      }
    }, 30000)
  }

  private handleRingingAck(payload: { callId: string }) {
    if (this.activeCall && this.activeCall.callId === payload.callId && this.activeCall.status === 'calling') {
      if (this.offlineTimeout) {
        clearTimeout(this.offlineTimeout)
        this.offlineTimeout = null
      }
      this.activeCall = { ...this.activeCall, status: 'ringing' }
      this.notify()
    }
  }

  async acceptCall(): Promise<void> {
    if (!this.activeCall || this.activeCall.status !== 'ringing') return
    toneSynth.stop()
    this.clearTimeouts()

    // 1. Acquire microphone
    try {
      this.localStream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
        video: false,
      })
    } catch (err: any) {
      console.error('[VoiceCall] Microphone denied on accept:', err)
      const errorMsg =
        err.name === 'NotAllowedError'
          ? 'Microphone access denied. Please allow microphone permission in browser settings.'
          : 'Unable to access microphone device.'
      this.activeCall = { ...this.activeCall, status: 'error', error: errorMsg }
      this.notify()
      this.rejectCall('mic_denied')
      return
    }

    // 2. Connect to shared room
    this.setupRoomChannel(this.activeCall.callId, false)

    // 3. Notify caller that call was accepted
    try {
      const supabase = getSupabase()
      const callerChan = supabase.channel(`call_signal_${this.activeCall.counterpart.id}`)
      await callerChan.send({
        type: 'broadcast',
        event: 'call_accepted',
        payload: { callId: this.activeCall.callId },
      })
    } catch (e) {
      console.error('[VoiceCall] Error sending call_accepted:', e)
    }

    this.activeCall = { ...this.activeCall, status: 'connected' }
    this.notify()
    toneSynth.playConnectedChime()
    this.startDurationTimer()
  }

  rejectCall(reason: string = 'declined'): void {
    if (!this.activeCall) return
    toneSynth.stop()
    this.clearTimeouts()

    const { callId, counterpart } = this.activeCall

    try {
      const supabase = getSupabase()
      const callerChan = supabase.channel(`call_signal_${counterpart.id}`)
      callerChan.send({
        type: 'broadcast',
        event: 'call_rejected',
        payload: { callId, reason },
      })
    } catch { /* noop */ }

    this.activeCall = { ...this.activeCall, status: 'rejected' }
    this.notify()
    this.cleanupMedia()
  }

  private handleCallAccepted(payload: { callId: string }) {
    if (!this.activeCall || this.activeCall.callId !== payload.callId) return
    toneSynth.stop()
    this.clearTimeouts()

    this.activeCall = { ...this.activeCall, status: 'connected' }
    this.notify()
    toneSynth.playConnectedChime()
    this.startDurationTimer()

    // As the caller, initiate WebRTC offer
    void this.initiatePeerOffer()
  }

  private handleCallRejected(payload: { callId: string; reason?: string }) {
    if (!this.activeCall || this.activeCall.callId !== payload.callId) return
    toneSynth.stop()
    this.clearTimeouts()

    this.activeCall = {
      ...this.activeCall,
      status: 'rejected',
      error: payload.reason === 'busy' ? 'User is currently on another call.' : 'Call was declined.',
    }
    this.notify()
    this.cleanupCallSession('rejected', 0)
  }

  /* ── WebRTC Signaling & PeerConnection ────────────────────────── */

  private setupRoomChannel(callId: string, isInitiator: boolean) {
    const supabase = getSupabase()
    const channelName = `call_room_${callId}`

    this.roomChannel = supabase.channel(channelName, {
      config: { broadcast: { self: false } },
    })

    this.roomChannel
      .on('broadcast', { event: 'sdp_offer' }, async (payload: any) => {
        if (!isInitiator) await this.handlePeerOffer(payload.payload.sdp)
      })
      .on('broadcast', { event: 'sdp_answer' }, async (payload: any) => {
        if (isInitiator) await this.handlePeerAnswer(payload.payload.sdp)
      })
      .on('broadcast', { event: 'ice_candidate' }, async (payload: any) => {
        await this.handleRemoteIceCandidate(payload.payload.candidate)
      })
      .on('broadcast', { event: 'call_ended' }, () => {
        this.handlePeerHangup()
      })
      .on('broadcast', { event: 'mute_state' }, (_payload: any) => {
        // Can be used to show "Counterpart is muted" badge
      })
      .subscribe()

    this.createPeerConnection()
  }

  private createPeerConnection() {
    if (this.pc) {
      this.pc.close()
      this.pc = null
    }

    const config = getRtcConfiguration()
    this.pc = new RTCPeerConnection(config)

    // Add local microphone audio track
    if (this.localStream) {
      this.localStream.getAudioTracks().forEach((track) => {
        this.pc?.addTrack(track, this.localStream!)
      })
    }

    // Stream received from remote peer
    this.pc.ontrack = (event) => {
      if (this.remoteAudio && event.streams[0]) {
        this.remoteAudio.srcObject = event.streams[0]
        this.remoteAudio.play().catch((e) => console.warn('[VoiceCall] AutoPlay remote audio was blocked:', e))
      }
    }

    // ICE candidate generated locally -> send to peer
    this.pc.onicecandidate = (event) => {
      if (event.candidate && this.roomChannel) {
        this.roomChannel.send({
          type: 'broadcast',
          event: 'ice_candidate',
          payload: { candidate: event.candidate.toJSON() },
        })
      }
    }

    // Monitor connection states
    this.pc.onconnectionstatechange = () => {
      const state = this.pc?.connectionState
      if (state === 'failed') {
        console.warn('[VoiceCall] WebRTC connection failed')
        if (this.activeCall && this.activeCall.status === 'connected') {
          this.activeCall = { ...this.activeCall, status: 'error', error: 'Call disconnected due to network issues.' }
          this.notify()
          this.endCall()
        }
      }
    }
  }

  private async initiatePeerOffer() {
    if (!this.pc) return
    try {
      const offer = await this.pc.createOffer({
        offerToReceiveAudio: true,
        offerToReceiveVideo: false,
      })
      await this.pc.setLocalDescription(offer)

      if (this.roomChannel) {
        await this.roomChannel.send({
          type: 'broadcast',
          event: 'sdp_offer',
          payload: { sdp: offer },
        })
      }
    } catch (err) {
      console.error('[VoiceCall] createOffer error:', err)
    }
  }

  private async handlePeerOffer(sdp: RTCSessionDescriptionInit) {
    if (!this.pc) this.createPeerConnection()
    try {
      await this.pc!.setRemoteDescription(new RTCSessionDescription(sdp))
      const answer = await this.pc!.createAnswer()
      await this.pc!.setLocalDescription(answer)

      if (this.roomChannel) {
        await this.roomChannel.send({
          type: 'broadcast',
          event: 'sdp_answer',
          payload: { sdp: answer },
        })
      }
    } catch (err) {
      console.error('[VoiceCall] handlePeerOffer error:', err)
    }
  }

  private async handlePeerAnswer(sdp: RTCSessionDescriptionInit) {
    if (!this.pc) return
    try {
      await this.pc.setRemoteDescription(new RTCSessionDescription(sdp))
    } catch (err) {
      console.error('[VoiceCall] handlePeerAnswer error:', err)
    }
  }

  private async handleRemoteIceCandidate(candidateInit: RTCIceCandidateInit) {
    if (!this.pc) return
    try {
      await this.pc.addIceCandidate(new RTCIceCandidate(candidateInit))
    } catch (err) {
      console.warn('[VoiceCall] addIceCandidate failed:', err)
    }
  }

  /* ── In-Call Controls: Mute & End Call ────────────────────────── */

  toggleMute(): boolean {
    if (!this.localStream) return false
    const track = this.localStream.getAudioTracks()[0]
    if (!track) return false

    track.enabled = !track.enabled
    const isMuted = !track.enabled

    if (this.activeCall) {
      this.activeCall = { ...this.activeCall, isMuted }
      this.notify()
    }

    if (this.roomChannel) {
      this.roomChannel.send({
        type: 'broadcast',
        event: 'mute_state',
        payload: { isMuted },
      })
    }
    return isMuted
  }

  endCall(): void {
    if (!this.activeCall) return
    toneSynth.playEndedTone()
    this.clearTimeouts()

    const duration = this.activeCall.durationSeconds

    // Send call_ended signal to peer
    if (this.roomChannel) {
      try {
        this.roomChannel.send({
          type: 'broadcast',
          event: 'call_ended',
          payload: { duration },
        })
      } catch { /* noop */ }
    }

    this.activeCall = { ...this.activeCall, status: 'ended' }
    this.notify()

    this.cleanupCallSession('ended', duration)
    this.cleanupMedia()
  }

  private handlePeerHangup() {
    toneSynth.playEndedTone()
    this.clearTimeouts()

    if (this.activeCall) {
      const duration = this.activeCall.durationSeconds
      this.activeCall = {
        ...this.activeCall,
        status: 'ended',
        error: 'The other user ended the call.',
      }
      this.notify()
      this.cleanupCallSession('ended', duration)
    }
    this.cleanupMedia()
  }

  /* ── Timers & Database Cleanup ────────────────────────────────── */

  private startDurationTimer() {
    if (this.durationInterval) clearInterval(this.durationInterval)
    this.durationInterval = window.setInterval(() => {
      if (this.activeCall && this.activeCall.status === 'connected') {
        this.activeCall.durationSeconds += 1
        this.notify()
      }
    }, 1000)
  }

  private clearTimeouts() {
    if (this.ringTimeout) {
      clearTimeout(this.ringTimeout)
      this.ringTimeout = null
    }
    if (this.offlineTimeout) {
      clearTimeout(this.offlineTimeout)
      this.offlineTimeout = null
    }
    if (this.durationInterval) {
      clearInterval(this.durationInterval)
      this.durationInterval = null
    }
  }

  private cleanupMedia() {
    toneSynth.stop()

    // Stop microphone tracks
    if (this.localStream) {
      this.localStream.getTracks().forEach((t) => t.stop())
      this.localStream = null
    }

    // Stop remote audio
    if (this.remoteAudio) {
      this.remoteAudio.srcObject = null
    }

    // Close PeerConnection
    if (this.pc) {
      this.pc.close()
      this.pc = null
    }

    // Leave room channel
    if (this.roomChannel) {
      try {
        const supabase = getSupabase()
        supabase.removeChannel(this.roomChannel)
      } catch { /* noop */ }
      this.roomChannel = null
    }

    // Reset session after a short delay so the user sees "Call ended"
    setTimeout(() => {
      if (this.activeCall && (this.activeCall.status === 'ended' || this.activeCall.status === 'rejected' || this.activeCall.status === 'missed' || this.activeCall.status === 'offline')) {
        this.activeCall = null
        this.notify()
      }
    }, 2500)
  }

  private async cleanupCallSession(status: 'ended' | 'rejected' | 'missed', duration: number) {
    if (!this.currentSessionDbId) return
    try {
      const supabase = getSupabase()
      await supabase
        .from('call_sessions')
        .update({
          status,
          ended_at: new Date().toISOString(),
          duration_seconds: duration,
        })
        .eq('id', this.currentSessionDbId)
    } catch (e) {
      console.warn('[VoiceCall] Failed to update call_sessions:', e)
    } finally {
      this.currentSessionDbId = null
    }
  }
}

export const voiceCallService = new VoiceCallService()
