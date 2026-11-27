"use client"

import Link from "next/link"
import { useEffect, useRef, useState, type CSSProperties, type FormEvent } from "react"
import { useRouter } from "next/navigation"
import { ArrowDown, ArrowLeft, ExternalLink, MessageCircle, Send } from "lucide-react"
import { cn } from "cn"
import type { ChatResponse } from "@/dtos/messenger/messenger.dto"
import { messengerService } from "@/services/messenger.service"
import { useMessenger } from "@/providers/MessengerProvider"
import { readSession, type Session } from "@/lib/session"
import { ApiError } from "@/lib/http"
import { draftOwner, readMessageDraft, saveMessageDraft, clearSentMessageDraft } from "@/lib/drafts"
import { routes } from "@/lib/routes"
import { OPEN_CHAT_EVENT } from "@/lib/chat-navigation"
import { MessageUnreadBadge } from "./messages-link"
import { presentMessages } from "@/lib/message-groups"
import { ProfileAvatar } from "@/components/profile/profile-avatar"
import { Button, buttonVariants } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { EmptyState } from "@/components/ui/empty-state"
import { SiteHeader } from "@/components/layout/site-header"
import { SiteFooter } from "@/components/layout/site-footer"
import { MobileNavigation } from "@/components/layout/mobile-navigation"

function attachmentHref(value: string) {
  try {
    const base = process.env.NEXT_PUBLIC_MESSENGER_API_URL || "http://localhost:5214"
    const url = new URL(value, base.replace(/\/$/, "") + "/")
    return ["http:", "https:"].includes(url.protocol) ? url.href : undefined
  } catch {
    return undefined
  }
}

export function MessagesPage() {
  const router = useRouter()
  const messenger = useMessenger()
  const [session, setSession] = useState<Session>({ token: null, userId: null, login: "" })
  const [ready, setReady] = useState(false)
  const [initialChats, setInitialChats] = useState<ChatResponse[]>([])
  const [loadingChats, setLoadingChats] = useState(true)
  const [chatsError, setChatsError] = useState(false)
  const [unauthorized, setUnauthorized] = useState(false)
  const [retry, setRetry] = useState(0)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [historyAttempted, setHistoryAttempted] = useState<string | null>(null)
  const [historyRetry, setHistoryRetry] = useState(0)
  const [historyError, setHistoryError] = useState("")
  const [draft, setDraft] = useState("")
  const [sendingChatId, setSendingChatId] = useState<string | null>(null)
  const [draftStorageError, setDraftStorageError] = useState(false)
  const [viewportHeight, setViewportHeight] = useState<number | null>(null)
  const draftRef = useRef("")
  const [sendError, setSendError] = useState("")
  const [moreAvailable, setMoreAvailable] = useState(true)
  const activateChat = useRef(messenger.setActiveChat)
  const selectedRef = useRef(selectedId)
  const sendLock = useRef(false)
  const mounted = useRef(false)
  const bottom = useRef<HTMLDivElement>(null)
  const historyViewport = useRef<HTMLDivElement>(null)
  const followTail = useRef(true)
  const scrollVersion = useRef(0)
  const previousThread = useRef<{ id: string | null; lastId?: string }>({ id: null })
  const olderLock = useRef(false)
  const [newBelow, setNewBelow] = useState(false)

  useEffect(() => { activateChat.current = messenger.setActiveChat }, [messenger.setActiveChat])
  useEffect(() => { selectedRef.current = selectedId }, [selectedId])

  useEffect(() => {
    mounted.current = true
    setSession(readSession())
    setReady(true)
    function readLocation() {
      const id = new URLSearchParams(window.location.search).get("chatId")
      followTail.current = true
      setNewBelow(false)
      if (id === selectedRef.current) scrollToLatest()
      selectedRef.current = id
      setSelectedId(id)
    }
    function openChat(event: Event) {
      const id = (event as CustomEvent<unknown>).detail
      if (typeof id !== "string" || !id) return
      followTail.current = true
      setNewBelow(false)
      if (id === selectedRef.current) scrollToLatest()
      selectedRef.current = id
      setSelectedId(id)
    }
    readLocation()
    window.addEventListener("popstate", readLocation)
    window.addEventListener(OPEN_CHAT_EVENT, openChat)
    return () => {
      mounted.current = false
      window.removeEventListener("popstate", readLocation)
      window.removeEventListener(OPEN_CHAT_EVENT, openChat)
    }
  }, [])

  useEffect(() => {
    if (!ready || !session.token) return
    let cancelled = false
    setLoadingChats(true)
    setChatsError(false)
    setUnauthorized(false)
    messengerService.getUserChats()
      .then((result) => { if (!cancelled) setInitialChats(result) })
      .catch((error) => {
        if (!cancelled) {
          setChatsError(true)
          setUnauthorized(error instanceof ApiError && error.status === 401)
        }
      })
      .finally(() => { if (!cancelled) setLoadingChats(false) })
    return () => { cancelled = true }
  }, [ready, session.token, retry])

  useEffect(() => {
    if (!ready || !session.token) return
    if (!selectedId) { void activateChat.current(null); return }
    let cancelled = false
    setHistoryAttempted(null)
    setHistoryError("")
    async function activate() {
      try {
        await activateChat.current(selectedId)
      } catch {
        if (!cancelled) setHistoryError("Не удалось открыть переписку.")
      } finally {
        if (!cancelled) setHistoryAttempted(selectedId)
      }
    }
    void activate()
    return () => { cancelled = true; void activateChat.current(null) }
  }, [ready, session.token, selectedId, historyRetry])

  const owner = draftOwner(session)
  const sending = sendingChatId === selectedId && sendingChatId !== null
  useEffect(() => {
    const saved = owner && selectedId ? readMessageDraft(owner, selectedId) : { text: "", available: true }
    draftRef.current = saved.text
    setDraft(saved.text)
    setDraftStorageError(!saved.available)
    setSendError("")
    setMoreAvailable(true)
  }, [selectedId, owner])

  useEffect(() => {
    const viewport = window.visualViewport
    if (!viewport) return
    function resize() { setViewportHeight(viewport?.height ?? null) }
    resize()
    viewport.addEventListener("resize", resize)
    return () => viewport.removeEventListener("resize", resize)
  }, [])

  useEffect(() => {
    function protect(event: BeforeUnloadEvent) {
      if (!selectedRef.current || !draftRef.current) return
      if (!owner || !saveMessageDraft(owner, selectedRef.current, draftRef.current)) {
        event.preventDefault()
        event.returnValue = ""
      }
    }
    window.addEventListener("beforeunload", protect)
    return () => window.removeEventListener("beforeunload", protect)
  }, [owner])

  function changeDraft(value: string) {
    draftRef.current = value
    setDraft(value)
    setDraftStorageError(Boolean(value) && (!owner || !selectedId || !saveMessageDraft(owner, selectedId, value)))
  }

  const latestMessages = new Map(Object.entries(messenger.messages).map(([id, history]) => [
    id, [...history].sort((a, b) => Date.parse(a.createAt) - Date.parse(b.createAt)).at(-1),
  ] as const))
  const chats = [...new Map([...initialChats, ...messenger.chats].map((chat) => [chat.id, chat] as const)).values()]
    .sort((a, b) => (Date.parse(latestMessages.get(b.id)?.createAt || b.createAt) || 0) - (Date.parse(latestMessages.get(a.id)?.createAt || a.createAt) || 0))
  const selected = chats.find((chat) => chat.id === selectedId)
  const messages = selectedId ? messenger.messages[selectedId] : undefined
  const orderedMessages = [...(messages ?? [])].sort((a, b) => Date.parse(a.createAt) - Date.parse(b.createAt))
  const displayedMessages = presentMessages(orderedMessages)
  const lastId = orderedMessages.at(-1)?.id
  const connected = messenger.connectionState === "Connected"

  const historyReady = Boolean(selectedId && messages && historyAttempted === selectedId)
  useEffect(() => {
    if (!connected || !selectedId || !historyReady) return
    let cancelled = false
    // повторно присоединяемся после восстановления соединения, используя уже загруженную историю
    void activateChat.current(selectedId).catch(() => {
      if (!cancelled) setHistoryError("Не удалось подключиться к переписке.")
    })
    return () => { cancelled = true }
  }, [connected, selectedId, historyReady])

  function scrollToLatest() {
    followTail.current = true
    setNewBelow(false)
    if (historyViewport.current) historyViewport.current.scrollTop = historyViewport.current.scrollHeight
    else bottom.current?.scrollIntoView({ block: "nearest" })
  }

  useEffect(() => {
    const previous = previousThread.current
    const changedChat = previous.id !== selectedId
    if (changedChat || followTail.current) scrollToLatest()
    else if (lastId && lastId !== previous.lastId) setNewBelow(true)
    previousThread.current = { id: selectedId, lastId }
  }, [selectedId, lastId])

  function interlocutor(chat: ChatResponse) {
    return chat.userId1.toLowerCase() === session.userId?.toLowerCase()
      ? chat.userName2 || "Собеседник"
      : chat.userName1 || "Собеседник"
  }

  function interlocutorId(chat: ChatResponse) {
    return chat.userId1.toLowerCase() === session.userId?.toLowerCase() ? chat.userId2 : chat.userId1
  }
  function messageTime(value: string) {
    const date = new Date(value)
    return Number.isFinite(date.getTime()) ? new Intl.DateTimeFormat("ru-RU", { hour: "2-digit", minute: "2-digit" }).format(date) : ""
  }

  function chooseChat(chatId: string | null) {
    const params = new URLSearchParams(window.location.search)
    if (chatId) params.set("chatId", chatId)
    else params.delete("chatId")
    const suffix = params.toString()
    window.history.pushState(null, "", `${routes.messages}${suffix ? `?${suffix}` : ""}`)
    followTail.current = true
    setNewBelow(false)
    if (chatId === selectedRef.current) scrollToLatest()
    selectedRef.current = chatId
    setSelectedId(chatId)
  }

  async function submitMessage(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const text = draft.trim()
    if (!selectedId || !messages || !text || !connected || sendLock.current) return
    const chatId = selectedId
    sendLock.current = true
    followTail.current = true
    setSendingChatId(chatId)
    setSendError("")
    try {
      await messenger.sendMessage({ chatId, senderName: session.login || "Покупатель", text })
      if (owner) clearSentMessageDraft(owner, chatId, draft)
      if (mounted.current && selectedRef.current === chatId && draftRef.current === draft) {
        draftRef.current = ""
        setDraft("")
      }
    } catch {
      if (mounted.current && selectedRef.current === chatId) setSendError("Не удалось отправить сообщение. Текст сохранён, попробуйте ещё раз.")
    } finally {
      sendLock.current = false
      if (mounted.current) setSendingChatId(null)
    }
  }

  async function loadOlder() {
    if (!selectedId || messenger.isLoadingHistory || olderLock.current) return
    olderLock.current = true
    const chatId = selectedId
    const viewport = historyViewport.current
    const height = viewport?.scrollHeight ?? 0
    const top = viewport?.scrollTop ?? 0
    const version = scrollVersion.current
    try {
      const page = Math.floor((messages?.length ?? 0) / 50) + 1
      const hasMore = await messenger.loadMoreMessages(chatId, page)
      if (mounted.current && selectedRef.current === chatId) {
        setMoreAvailable(hasMore)
        window.requestAnimationFrame(() => {
          if (mounted.current && selectedRef.current === chatId && viewport && scrollVersion.current === version) viewport.scrollTop = top + viewport.scrollHeight - height
        })
      }
    } catch {
      if (mounted.current && selectedRef.current === chatId) setHistoryError("Не удалось загрузить предыдущие сообщения.")
    } finally { olderLock.current = false }
  }

  const mobileThread = Boolean(ready && session.token && !unauthorized && selectedId)

  return (
    <div style={viewportHeight ? { "--messenger-viewport": `${viewportHeight}px` } as CSSProperties : undefined} className={cn("flex min-h-[var(--messenger-viewport,100dvh)] flex-col bg-background text-foreground md:min-h-dvh md:pb-0", mobileThread ? "pb-0" : "pb-[calc(64px_+_env(safe-area-inset-bottom))]")}>
      <div className={mobileThread ? "hidden md:block" : undefined}><SiteHeader authenticated={Boolean(session.token)} /></div>
      <main className="mx-auto flex min-h-0 w-full max-w-[1328px] flex-1 flex-col px-4 py-3 md:px-6 md:py-8">
        <h1 className={cn("mb-6 text-2xl/8 font-bold", mobileThread && "sr-only md:not-sr-only md:mb-6")}>Сообщения</h1>
        {!ready ? <p role="status">Загрузка…</p> : !session.token || unauthorized ? (
          <EmptyState icon={<MessageCircle />} title="Войдите, чтобы открыть сообщения">
            <Link href={`${routes.login}?next=${encodeURIComponent(routes.messages + (selectedId ? `?chatId=${encodeURIComponent(selectedId)}` : ""))}`} className={buttonVariants()}>Войти</Link>
          </EmptyState>
        ) : (
          <div className="grid min-h-0 gap-4 md:gap-6 md:grid-cols-[260px_minmax(0,1fr)]">
            <section aria-label="Список чатов" className={cn("min-w-0 overflow-y-auto rounded-[12px] border border-border bg-card md:max-h-[650px]", selectedId && "hidden md:block")}>
              {loadingChats && <p role="status" className="p-4 text-sm text-muted-foreground">Загружаем чаты…</p>}
              {chatsError && <div role="alert" className="p-4 text-sm text-destructive">Не удалось загрузить чаты. <Button variant="text" size="sm" onClick={() => setRetry((value) => value + 1)}>Повторить</Button></div>}
              {!loadingChats && !chatsError && !chats.length && <p className="p-4 text-sm text-muted-foreground">Переписок пока нет.</p>}
              <ul>
                {chats.map((chat) => (
                  <li key={chat.id}>
                    <button type="button" aria-pressed={selectedId === chat.id} onClick={() => chooseChat(chat.id)} className="flex w-full items-center gap-3 border-b border-border p-4 text-left hover:bg-muted aria-pressed:bg-primary-50 focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-ring">
                      <ProfileAvatar userId={interlocutorId(chat)} name={interlocutor(chat)} />
                      <span className="min-w-0 flex-1"><span className="block truncate text-sm font-semibold">{interlocutor(chat)}</span><span className="mt-1 block truncate text-xs/4 text-muted-foreground">{latestMessages.get(chat.id)?.text?.trim() || (latestMessages.get(chat.id)?.attachments?.length ? "Вложение" : "Переписка по объявлению")}</span></span>
                      {(messenger.unreadChatIds ?? []).includes(chat.id) && <span className="size-2 shrink-0 rounded-full bg-primary"><span className="sr-only">Есть новые сообщения</span></span>}
                    </button>
                  </li>
                ))}
              </ul>
            </section>
            <section aria-label="Переписка" className={cn("h-[calc(var(--messenger-viewport,100dvh)_-_24px_-_env(safe-area-inset-bottom))] min-h-0 min-w-0 flex-col overflow-hidden rounded-[12px] border border-border bg-card md:flex md:h-[650px] md:max-h-[75dvh]", selectedId ? "flex" : "hidden")}>
              {!selectedId ? (
                <div className="m-auto p-6 text-center text-sm text-muted-foreground">Выберите переписку или напишите продавцу на странице объявления.</div>
              ) : (
                <>
                  <div className="flex shrink-0 items-center gap-2 border-b border-border px-3 py-2">
                    <Button type="button" variant="ghost" size="icon" className="md:hidden" aria-label="К списку чатов" onClick={() => chooseChat(null)}><ArrowLeft aria-hidden="true" /><MessageUnreadBadge announce={false} /></Button>
                    {selected ? <Link href={routes.userProfile(interlocutorId(selected))} className="flex min-w-0 flex-1 items-center gap-2 rounded-[10px] hover:text-primary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring" aria-label={`Открыть профиль: ${interlocutor(selected)}`}><ProfileAvatar userId={interlocutorId(selected)} name={interlocutor(selected)} className="size-8" /><h2 className="truncate font-semibold">{interlocutor(selected)}</h2></Link> : <h2 className="min-w-0 flex-1 truncate font-semibold">Переписка</h2>}
                    {selected && <Link href={routes.product(selected.productId)} className={buttonVariants({ variant: "ghost", size: "icon" })} aria-label="Открыть объявление" title="Открыть объявление"><ExternalLink aria-hidden="true" /></Link>}
                  </div>
                  <div role="status" className="flex shrink-0 flex-wrap items-center gap-2 border-b border-border px-4 py-2 text-xs/4 text-muted-foreground">
                    {connected ? "Подключено" : "Подключение к сообщениям…"}
                    {!connected && <Button variant="text" size="sm" disabled={messenger.connectionState === "Connecting"} onClick={() => { void messenger.connect() }}>Подключиться</Button>}
                  </div>
                  <div ref={historyViewport} onScroll={(event) => {
                    scrollVersion.current += 1
                    const element = event.currentTarget
                    followTail.current = element.scrollHeight - element.scrollTop - element.clientHeight < 64
                    if (followTail.current) setNewBelow(false)
                  }} className="min-h-0 flex-1 space-y-4 overflow-y-auto p-4">
                    {historyAttempted !== selectedId && <p role="status" className="text-sm text-muted-foreground">Загружаем историю…</p>}
                    {historyAttempted === selectedId && !messages && <div role="alert" className="text-sm text-destructive">Не удалось загрузить историю. <Button variant="text" size="sm" onClick={() => setHistoryRetry((value) => value + 1)}>Повторить</Button></div>}
                    {messages && moreAvailable && messages.length >= 50 && <Button variant="secondary" size="sm" loading={messenger.isLoadingHistory} onClick={() => { void loadOlder() }}>Ранее</Button>}
                    {historyError && <p role="alert" className="text-sm text-destructive">{historyError}</p>}
                    {messages && !messages.length && <p className="text-sm text-muted-foreground">Начните переписку с сообщения.</p>}
                    <ol aria-label="Сообщения" className="space-y-1">
                      {displayedMessages.map(({ message, startsGroup, dayLabel }) => {
                        const own = message.userId.toLowerCase() === session.userId?.toLowerCase()
                        return (
                          <li key={message.id} className={startsGroup && !dayLabel ? "pt-2" : undefined}>
                            {dayLabel && <p className="pb-3 pt-4 text-center text-xs/4 font-medium text-muted-foreground">{dayLabel}</p>}
                            <div className={cn("flex items-start gap-2", own ? "justify-end" : "justify-start")}>
                            {!own && (startsGroup ? <ProfileAvatar userId={message.userId} name={message.senderName || (selected ? interlocutor(selected) : "Собеседник")} className="size-7" /> : <span aria-hidden="true" className="w-7 shrink-0" />)}
                            <div className={cn("max-w-[calc(100%_-_36px)] rounded-[10px] border border-border p-3 text-sm/5 [overflow-wrap:anywhere]", own ? "bg-primary-50" : "bg-muted")}>
                            {startsGroup && <p className="mb-1 text-xs font-medium text-muted-foreground">{own ? "Вы" : message.senderName || (selected ? interlocutor(selected) : "Собеседник")}</p>}
                            {message.reply && <blockquote className="mb-2 border-l-2 border-primary pl-2 text-xs text-muted-foreground">{message.reply.text}</blockquote>}
                            {message.text && <p className="whitespace-pre-wrap">{message.text}</p>}
                            {(message.attachments ?? []).map((attachment) => {
                              const href = attachment.fileUrl ? attachmentHref(attachment.fileUrl) : undefined
                              return href && <a key={attachment.id} href={href} target="_blank" rel="noopener noreferrer" className="mt-1 block text-primary underline">{attachment.fileName || "Вложение"}</a>
                            })}
                            {messageTime(message.createAt) && <time dateTime={message.createAt} className="mt-2 block text-right text-[11px]/4 text-muted-foreground">{messageTime(message.createAt)}</time>}
                            </div>
                            {own && (startsGroup ? <ProfileAvatar userId={message.userId} name={session.login} className="size-7" /> : <span aria-hidden="true" className="w-7 shrink-0" />)}
                            </div>
                          </li>
                        )
                      })}
                    </ol>
                    <div ref={bottom} />
                  </div>
                  {newBelow && <Button type="button" variant="soft" size="sm" className="mx-3 my-2 min-h-11 shrink-0 self-center" onClick={scrollToLatest}><ArrowDown aria-hidden="true" />Новые сообщения</Button>}
                  <form onSubmit={submitMessage} className="shrink-0 border-t border-border p-3">
                    {sendError && <p role="alert" className="mb-2 text-sm text-destructive">{sendError}</p>}
                    {draftStorageError && <p role="status" className="mb-2 text-xs/4 text-muted-foreground">Не удалось сохранить черновик в браузере. Скопируйте текст перед уходом.</p>}
                    <div className="flex min-w-0 items-center gap-2">
                      <Input aria-label="Сообщение" placeholder="Напишите сообщение" value={draft} disabled={sending} onChange={(event) => changeDraft(event.target.value)} className="min-w-0 flex-1" />
                      <Button type="submit" size="icon" aria-label="Отправить сообщение" loading={sending} disabled={!connected || !draft.trim() || !messages || sendingChatId !== null}><Send /></Button>
                    </div>
                  </form>
                </>
              )}
            </section>
          </div>
        )}
      </main>
      <div className={mobileThread ? "hidden md:block" : undefined}><SiteFooter /></div>
      <div className={mobileThread ? "hidden md:block" : undefined}><MobileNavigation authenticated={Boolean(session.token)} active="messages" /></div>
    </div>
  )
}
