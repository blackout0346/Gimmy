"use client"

import { useEffect, useRef } from "react"
import { useNotifications } from "@/providers/NotificationProvider"
import { useMessenger } from "@/providers/MessengerProvider"
import { notificationKey } from "@/lib/notifications"
import { resolveNotificationTarget } from "@/lib/notification-target"

export function MessageNotificationBridge() {
  const { notifications, setNotificationTarget } = useNotifications()
  const { chats, messages, ingestMessage, markChatUnread } = useMessenger()
  const source = useRef({ chats, messages })
  source.current = { chats, messages }
  const seen = useRef(new Set<string>())
  const queue = useRef<Promise<void>>(Promise.resolve())
  const lifecycle = useRef(0)
  const mounted = useRef(false)
  useEffect(() => {
    mounted.current = true
    lifecycle.current += 1
    return () => { mounted.current = false; lifecycle.current += 1 }
  }, [])
  useEffect(() => {
    const fresh = notifications.filter((notification) => !seen.current.has(notificationKey(notification)))
    if (!fresh.length) return
    fresh.forEach((notification) => seen.current.add(notificationKey(notification)))
    const observedAt = Date.now()
    const epoch = lifecycle.current
    queue.current = queue.current.catch(() => {}).then(async () => {
      for (let offset = 0; offset < fresh.length; offset += 4) {
        if (!mounted.current || epoch !== lifecycle.current) return
        await Promise.all(fresh.slice(offset, offset + 4).map(async (notification) => {
          try {
            const target = await resolveNotificationTarget(notification, source.current.chats, source.current.messages)
            if (!mounted.current || epoch !== lifecycle.current) return
            setNotificationTarget(notificationKey(notification), target)
            if (target.kind === "message") {
              if (target.message) ingestMessage(target.message, observedAt)
              else markChatUnread(target.chatId, observedAt)
            }
          } catch { seen.current.delete(notificationKey(notification)) }
        }))
      }
    })
  }, [notifications, setNotificationTarget, ingestMessage, markChatUnread])
  return null
}
