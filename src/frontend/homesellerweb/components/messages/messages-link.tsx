"use client"

import Link from "next/link"
import { MessageCircle } from "lucide-react"
import { useMessenger } from "@/providers/MessengerProvider"
import { routes } from "@/lib/routes"
import { buttonVariants } from "@/components/ui/button"

export function MessageUnreadBadge({ announce = true }: { announce?: boolean }) {
  const { unreadCount } = useMessenger()
  if (!unreadCount) return null
  return <>
    <span aria-hidden="true" className="absolute -right-1 -top-1 grid min-h-4 min-w-4 place-items-center rounded-full bg-primary px-1 text-[10px]/4 font-semibold text-primary-foreground">{unreadCount > 99 ? "99+" : unreadCount}</span>
    {announce && <span className="sr-only">Чатов с новыми сообщениями: {unreadCount}</span>}
  </>
}
export function MessagesLink() {
  const { unreadCount } = useMessenger()
  return <Link href={routes.messages} prefetch={false} aria-label={unreadCount ? `Сообщения, чатов с новыми сообщениями: ${unreadCount}` : "Сообщения"} className={buttonVariants({ variant: "ghost", size: "icon" })}>
    <MessageCircle aria-hidden="true" /><MessageUnreadBadge announce={false} />
  </Link>
}
