import type { NotificationDto } from "@/dtos/notification/notification.dto"

export function normalizeNotification(value: unknown): NotificationDto | null {
  if (!value || typeof value !== "object") return null
  const data = value as Record<string, unknown>
  const title = typeof data.title === "string" ? data.title : ""
  const message = typeof data.message === "string" ? data.message : ""
  if (!title && !message) return null
  return {
    title, message,
    type: typeof data.type === "string" ? data.type : "",
    entityId: typeof data.entityId === "string" ? data.entityId : "",
    createdAt: typeof data.createdAt === "string" ? data.createdAt : "",
  }
}

export function notificationKey(notification: NotificationDto): string {
  return JSON.stringify([notification.type, notification.entityId, notification.createdAt, notification.title, notification.message])
}

export function notificationDate(value: string): string {
  const date = new Date(value)
  return Number.isFinite(date.getTime()) ? new Intl.DateTimeFormat("ru-RU", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }).format(date) : ""
}
