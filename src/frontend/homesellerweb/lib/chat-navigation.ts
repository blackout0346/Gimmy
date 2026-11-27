import { routes } from "@/lib/routes"

export const OPEN_CHAT_EVENT = "gimmy:open-chat"
export function chatHref(chatId: string) { return `${routes.messages}?chatId=${encodeURIComponent(chatId)}` }
export function announceChatNavigation(chatId: string) {
  window.dispatchEvent(new CustomEvent(OPEN_CHAT_EVENT, { detail: chatId }))
}
