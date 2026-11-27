"use client"

import { useEffect, useRef, useState } from "react"
import { useRouter } from "next/navigation"
import { useMessenger } from "@/providers/MessengerProvider"
import type { NotificationDto } from "@/dtos/notification/notification.dto"
import { resolveNotificationTarget, notificationHref } from "@/lib/notification-target"
import { announceChatNavigation } from "@/lib/chat-navigation"
import { Bell, X } from "lucide-react"
import { useNotifications } from "@/providers/NotificationProvider"
import { notificationDate, notificationKey } from "@/lib/notifications"
import { Button } from "@/components/ui/button"

export function NotificationBell() {
  const { notifications, unreadCount, connectionStatus, connectNotifications, markAllRead, clearNotifications, targets = {}, setNotificationTarget, markNotificationRead } = useNotifications()
  const router = useRouter()
  const messenger = useMessenger()
  const requestVersion = useRef(0)
  const [openingKey, setOpeningKey] = useState<string | null>(null)
  const [openError, setOpenError] = useState("")
  const dialog = useRef<HTMLDialogElement>(null)
  const [open, setOpen] = useState(false)
  useEffect(() => () => { requestVersion.current += 1 }, [])
  const connecting = connectionStatus === "connecting" || connectionStatus === "reconnecting"

  function show() {
    dialog.current?.showModal()
    setOpen(true)
    markAllRead()
    setOpenError("")
  }

  async function openNotification(notification: NotificationDto) {
    if (openingKey !== null) return
    const key = notificationKey(notification)
    const version = ++requestVersion.current
    setOpeningKey(key)
    setOpenError("")
    try {
      const known = targets[key]
      const target = known && known.kind !== "unknown" ? known : await resolveNotificationTarget(notification, messenger.chats, messenger.messages)
      if (version !== requestVersion.current) return
      setNotificationTarget(key, target)
      const href = notificationHref(target)
      if (!href) { setOpenError("Не удалось определить страницу этого уведомления. Попробуйте ещё раз после восстановления соединения."); return }
      markNotificationRead(key)
      dialog.current?.close()
      router.push(href)
      if (target.kind === "message") announceChatNavigation(target.chatId)
    } catch {
      if (version === requestVersion.current) setOpenError("Не удалось открыть уведомление. Попробуйте ещё раз.")
    } finally {
      if (version === requestVersion.current) setOpeningKey(null)
    }
  }

  return (
    <>
      <Button type="button" variant="ghost" size="icon" aria-label={unreadCount ? `Уведомления, непрочитанных: ${unreadCount}` : "Уведомления"} aria-haspopup="dialog" aria-expanded={open} onClick={show}>
        <Bell aria-hidden="true" />
        {unreadCount > 0 && <span aria-hidden="true" className="absolute right-0 top-0 grid min-h-4 min-w-4 place-items-center rounded-full bg-primary px-1 text-[10px]/4 font-semibold text-primary-foreground">{unreadCount > 99 ? "99+" : unreadCount}</span>}
      </Button>
      <dialog ref={dialog} aria-label="Уведомления" onClose={() => { requestVersion.current += 1; setOpeningKey(null); setOpen(false) }} className="fixed inset-0 m-auto w-[calc(100%_-_32px)] max-w-md max-h-[calc(100dvh_-_32px)] overflow-y-auto rounded-[12px] border border-border bg-card p-4 text-foreground backdrop:bg-foreground/40">
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-lg/6 font-semibold">Уведомления</h2>
          <Button type="button" variant="ghost" size="icon" aria-label="Закрыть уведомления" onClick={() => dialog.current?.close()}><X aria-hidden="true" /></Button>
        </div>
        {connectionStatus !== "connected" && <div role="status" className="mb-3 flex flex-wrap items-center gap-2 text-xs/5 text-muted-foreground">
          <span>{connecting ? "Подключаем уведомления…" : "Нет соединения с уведомлениями."}</span>
          {!connecting && <Button type="button" variant="text" size="sm" onClick={() => { void connectNotifications() }}>Подключиться</Button>}
        </div>}
        {openError && <p role="alert" className="mb-3 text-sm/5 text-destructive">{openError}</p>}
        {!notifications.length ? <p className="py-8 text-center text-sm/5 text-muted-foreground">Уведомлений пока нет.</p> : (
          <ul className="divide-y divide-border">
            {notifications.map((notification) => {
              const date = notificationDate(notification.createdAt)
              return <li key={notificationKey(notification)} className="py-1 [overflow-wrap:anywhere]">
                <button type="button" className="w-full rounded-[10px] p-3 text-left hover:bg-muted disabled:cursor-wait focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring" disabled={openingKey !== null} aria-busy={openingKey === notificationKey(notification)} onClick={() => { void openNotification(notification) }}>
                <span className="block text-sm/5 font-semibold">{notification.title || "Уведомление"}</span>
                {notification.message && <span className="mt-1 block whitespace-pre-wrap text-sm/5 text-muted-foreground">{notification.message}</span>}
                {date && <time dateTime={notification.createdAt} className="mt-2 block text-xs/4 text-muted-foreground">{date}</time>}
                <span className="mt-2 block text-xs font-medium text-primary">{openingKey === notificationKey(notification) ? "Открываем…" : targets[notificationKey(notification)]?.kind === "message" ? "Перейти в чат" : "Открыть"}</span>
                </button>
              </li>
            })}
          </ul>
        )}
        {notifications.length > 0 && <div className="mt-3 flex flex-wrap gap-2 border-t border-border pt-3">
          {unreadCount > 0 && <Button type="button" variant="secondary" size="sm" onClick={markAllRead}>Прочитать все</Button>}
          <Button type="button" variant="text" size="sm" onClick={clearNotifications}>Очистить список</Button>
        </div>}
      </dialog>
    </>
  )
}
