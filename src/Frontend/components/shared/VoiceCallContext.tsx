import React, { createContext, useContext, useEffect, useState, useCallback } from 'react'
import { voiceCallService } from '@/lib/voiceCall'
import { useAuth } from '@/lib/providers'
import type { ActiveCall, CallParticipant } from '@/lib/types'

interface VoiceCallContextType {
  call: ActiveCall | null
  isMinimized: boolean
  setIsMinimized: (v: boolean) => void
  startCall: (opts: {
    conversationId: string
    calleeId: string
    calleeName: string
    calleeAvatar?: string | null
    calleeColor?: string | null
  }) => Promise<void>
  acceptCall: () => Promise<void>
  rejectCall: () => void
  endCall: () => void
  toggleMute: () => void
}

const VoiceCallCtx = createContext<VoiceCallContextType | null>(null)

export function VoiceCallProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth()
  const [call, setCall] = useState<ActiveCall | null>(null)
  const [isMinimized, setIsMinimized] = useState(false)

  // Subscribe to service state changes
  useEffect(() => {
    return voiceCallService.subscribe((current) => {
      setCall(current)
      if (!current) setIsMinimized(false)
    })
  }, [])

  // Initialize personal signaling listener for incoming calls
  useEffect(() => {
    if (user?.id) {
      voiceCallService.initUserSignaling({
        id: user.id,
        name: user.full_name,
        avatar: user.avatar_url,
        color: user.avatar_color,
      })
    } else {
      voiceCallService.cleanupUserSignaling()
    }
  }, [user?.id, user?.full_name, user?.avatar_url, user?.avatar_color])

  const startCall = useCallback(
    async (opts: {
      conversationId: string
      calleeId: string
      calleeName: string
      calleeAvatar?: string | null
      calleeColor?: string | null
    }) => {
      if (!user) throw new Error('You must be signed in to make a call.')
      if (user.id === opts.calleeId) throw new Error('Cannot call yourself.')

      const caller: CallParticipant = {
        id: user.id,
        name: user.full_name,
        avatar: user.avatar_url,
        color: user.avatar_color,
      }

      const callee: CallParticipant = {
        id: opts.calleeId,
        name: opts.calleeName,
        avatar: opts.calleeAvatar,
        color: opts.calleeColor,
      }

      setIsMinimized(false)
      await voiceCallService.startCall({
        conversationId: opts.conversationId,
        caller,
        callee,
      })
    },
    [user]
  )

  const acceptCall = useCallback(async () => {
    await voiceCallService.acceptCall()
  }, [])

  const rejectCall = useCallback(() => {
    voiceCallService.rejectCall()
  }, [])

  const endCall = useCallback(() => {
    voiceCallService.endCall()
  }, [])

  const toggleMute = useCallback(() => {
    voiceCallService.toggleMute()
  }, [])

  return (
    <VoiceCallCtx.Provider
      value={{
        call,
        isMinimized,
        setIsMinimized,
        startCall,
        acceptCall,
        rejectCall,
        endCall,
        toggleMute,
      }}
    >
      {children}
    </VoiceCallCtx.Provider>
  )
}

export function useVoiceCall() {
  const ctx = useContext(VoiceCallCtx)
  if (!ctx) throw new Error('useVoiceCall must be used within a VoiceCallProvider')
  return ctx
}
