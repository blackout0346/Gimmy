import type { Session } from "@/lib/session"

export type PublicationValues = {
  nameProduct: string
  description: string
  price: string
  position: string
  tagId: string
  conditionId: string
}
export type PublicationDraft = { values: PublicationValues; createdId: string | null; photoCount: number; checkPublication: string | null }
export const emptyPublicationValues: PublicationValues = { nameProduct: "", description: "", price: "", position: "", tagId: "", conditionId: "" }

export function draftOwner(session: Session): string | null {
  if (!session.token) return null
  if (session.userId) return `user:${session.userId.toLowerCase()}`
  return session.login ? `login:${session.login}` : null
}

function key(owner: string, name: string) { return `gimmy:draft:v1:${encodeURIComponent(owner)}:${name}` }
function read(owner: string, name: string): { value: unknown; available: boolean } {
  try {
    const raw = window.localStorage.getItem(key(owner, name))
    return { value: raw ? JSON.parse(raw) : null, available: true }
  } catch { return { value: null, available: false } }
}
function write(owner: string, name: string, value: unknown): boolean {
  try {
    if (value === null) window.localStorage.removeItem(key(owner, name))
    else window.localStorage.setItem(key(owner, name), JSON.stringify(value))
    return true
  } catch { return false }
}

export function hasPublicationValues(values: PublicationValues) {
  return Object.values(values).some((value) => value.trim().length > 0)
}

export function readPublicationDraft(owner: string): { draft: PublicationDraft | null; available: boolean } {
  const result = read(owner, "publication")
  const data = result.value as Partial<PublicationDraft> | null
  if (!data || !data.values || !Object.keys(emptyPublicationValues).every((name) => typeof data.values?.[name as keyof PublicationValues] === "string")) return { draft: null, available: result.available }
  const values = Object.fromEntries(Object.keys(emptyPublicationValues).map((name) => [name, data.values?.[name as keyof PublicationValues]])) as PublicationValues
  return { draft: {
    values,
    createdId: typeof data.createdId === "string" && data.createdId ? data.createdId : null,
    photoCount: typeof data.photoCount === "number" && Number.isSafeInteger(data.photoCount) && data.photoCount > 0 ? data.photoCount : 0,
    checkPublication: typeof data.checkPublication === "string" ? data.checkPublication : null,
  }, available: result.available }
}
export function savePublicationDraft(owner: string, draft: PublicationDraft): boolean {
  return write(owner, "publication", draft.createdId || draft.photoCount > 0 || hasPublicationValues(draft.values) ? draft : null)
}
export function removePublicationDraft(owner: string): boolean { return write(owner, "publication", null) }

export function readMessageDraft(owner: string, chatId: string): { text: string; available: boolean } {
  const result = read(owner, `chat:${encodeURIComponent(chatId)}`)
  return { text: typeof result.value === "string" ? result.value : "", available: result.available }
}
export function saveMessageDraft(owner: string, chatId: string, text: string): boolean {
  return write(owner, `chat:${encodeURIComponent(chatId)}`, text ? text : null)
}
export function clearSentMessageDraft(owner: string, chatId: string, sentText: string): boolean {
  const current = readMessageDraft(owner, chatId)
  // Keep any newer text written in another tab while the send was in progress.
  if (!current.available || current.text !== sentText) return current.available
  return saveMessageDraft(owner, chatId, "")
}
