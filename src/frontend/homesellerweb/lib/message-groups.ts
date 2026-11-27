import type { MessageResponse } from "@/dtos/messenger/messenger.dto"

export type MessagePresentation = { message: MessageResponse; startsGroup: boolean; dayLabel: string | null }

function dayKey(value: string): string | null {
  const date = new Date(value)
  return Number.isFinite(date.getTime()) ? `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}` : null
}
function dayLabel(value: string): string {
  const date = new Date(value)
  return Number.isFinite(date.getTime()) ? new Intl.DateTimeFormat("ru-RU", { day: "numeric", month: "long", year: "numeric" }).format(date) : "Дата не указана"
}
export function presentMessages(messages: MessageResponse[]): MessagePresentation[] {
  return messages.map((message, index) => {
    const previous = messages[index - 1]
    const day = dayKey(message.createAt)
    const sameDay = Boolean(previous && day && day === dayKey(previous.createAt))
    const interval = previous ? Date.parse(message.createAt) - Date.parse(previous.createAt) : NaN
    const sameAuthor = Boolean(previous?.userId && message.userId && previous.userId.toLowerCase() === message.userId.toLowerCase())
    const grouped = sameDay && sameAuthor && interval >= 0 && interval <= 5 * 60 * 1000
    return { message, startsGroup: !grouped, dayLabel: index === 0 || !sameDay ? dayLabel(message.createAt) : null }
  })
}
