import type { NotificationDto } from "@/dtos/notification/notification.dto"
import type { ChatResponse, MessageResponse } from "@/dtos/messenger/messenger.dto"
import { messengerService } from "@/services/messenger.service"
import { productService } from "@/services/product.service"
import { profileService } from "@/services/profile.service"
import { tokenStorage } from "@/lib/http"
import { chatHref } from "@/lib/chat-navigation"
import { routes } from "@/lib/routes"

export type NotificationTarget =
  | { kind: "message"; chatId: string; message?: MessageResponse }
  | { kind: "product"; productId: string }
  | { kind: "profile" }
  | { kind: "unknown" }
const cache = new Map<string, Promise<NotificationTarget>>()

export function notificationHref(target: NotificationTarget): string | null {
  return target.kind === "message" ? chatHref(target.chatId) : target.kind === "product" ? routes.product(target.productId) : target.kind === "profile" ? routes.profile : null
}

export async function resolveNotificationTarget(notification: NotificationDto, knownChats: ChatResponse[], knownMessages: Record<string, MessageResponse[]>): Promise<NotificationTarget> {
  const id = notification.entityId?.trim()
  if (!id) return { kind: "unknown" }
  const matches = (value: string) => value.toLowerCase() === id.toLowerCase()
  const chat = knownChats.find((item) => matches(item.id))
  if (chat) return { kind: "message", chatId: chat.id }
  for (const messages of Object.values(knownMessages)) {
    const message = messages.find((item) => matches(item.id))
    if (message) return { kind: "message", chatId: message.chatId, message }
  }
  let token: string | null = null
  try { token = tokenStorage.get() } catch { return { kind: "unknown" } }
  if (!token) return { kind: "unknown" }
  const key = `${token}:${id}`
  const existing = cache.get(key)
  if (existing) return existing
  const request = (async (): Promise<NotificationTarget> => {
    const encoded = encodeURIComponent(id)
    try {
      const message = await messengerService.getMessageById(encoded)
      if (message?.id && matches(message.id) && message.chatId) return { kind: "message", chatId: message.chatId, message }
    } catch { /* Entity may be a chat or product ID. */ }
    try {
      const chats = await messengerService.getUserChats()
      const match = chats.find((item) => matches(item.id))
      if (match) return { kind: "message", chatId: match.id }
    } catch { /* Keep other verified destinations available. */ }
    try {
      const product = await productService.getProductById(encoded)
      if (product?.id && matches(product.id)) return { kind: "product", productId: product.id }
    } catch { /* Entity may belong to the profile service. */ }
    try {
      const profile = await profileService.getMyProfile()
      if (profile && (matches(profile.id) || matches(profile.userId))) return { kind: "profile" }
    } catch { /* Unknown targets stay explicit in the interface. */ }
    return { kind: "unknown" }
  })()
  cache.set(key, request)
  const result = await request
  if (result.kind === "unknown") cache.delete(key)
  const oldest = cache.keys().next().value
  if (cache.size > 200 && oldest) cache.delete(oldest)
  return result
}
