"use client"

import { useEffect, useState, type ReactNode } from "react"
import { AUTH_CHANGE_EVENT, tokenStorage } from "@/lib/http"
import { MessengerProvider } from "@/providers/MessengerProvider"
import { MessageNotificationBridge } from "@/components/notifications/message-notification-bridge"
import { NotificationProvider } from "@/providers/NotificationProvider"

export function AppProviders({ children }: { children: ReactNode }) {
  const [token, setToken] = useState<string | null>(null)

  useEffect(() => {
    function syncSession() {
      try {
        setToken(tokenStorage.get())
      } catch {
        setToken(null)
      }
    }

    syncSession()
    window.addEventListener(AUTH_CHANGE_EVENT, syncSession)
    window.addEventListener("storage", syncSession)
    window.addEventListener("focus", syncSession)
    return () => {
      window.removeEventListener(AUTH_CHANGE_EVENT, syncSession)
      window.removeEventListener("storage", syncSession)
      window.removeEventListener("focus", syncSession)
    }
  }, [])

  return (
    <NotificationProvider key={token ?? "guest"}>
      <MessengerProvider isAuthenticated={Boolean(token)}>
        <MessageNotificationBridge />
        {children}
      </MessengerProvider>
    </NotificationProvider>
  )
}
