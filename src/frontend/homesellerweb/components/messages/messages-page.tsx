"use client"

import Link from "next/link"
import { useEffect, useRef, useState, type FormEvent } from "react"
import { useRouter } from "next/navigation"
import { MessageCircle, Send } from "lucide-react"
import { cn } from "cn"
import type { ChatResponse } from "@/dtos/messenger/messenger.dto"
import { messengerService } from "@/services/messenger.service"
import { useMessenger } from "@/providers/MessengerProvider"
import { readSession, type Session } from "@/lib/session"
import { ApiError } from "@/lib/http"
import { routes } from "@/lib/routes"
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
  const [sending, setSending] = useState(false)
  const [sendError, setSendError] = useState("")
  const [moreAvailable, setMoreAvailable] = useState(true)
  const activateChat = useRef(messenger.setActiveChat)
  const selectedRef = useRef(selectedId)
  const sendLock = useRef(false)
  const mounted = useRef(false)
  const bottom = useRef<HTMLDivElement>(null)

  useEffect(() => { activateChat.current = messenger.setActiveChat }, [messenger.setActiveChat])
  useEffect(() => { selectedRef.current = selectedId }, [selectedId])

  useEffect(() => {
    mounted.current = true
    setSession(readSession())
    setReady(true)
    function readLocation() {
      setSelectedId(new URLSearchParams(window.location.search).get("chatId"))
    }
    readLocation()
    window.addEventListener("popstate", readLocation)
    return () => {
      mounted.current = false
      window.removeEventListener("popstate", readLocation)
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
    if (!ready || !session.token || !selectedId) return
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
    return () => { cancelled = true }
  }, [ready, session.token, selectedId, historyRetry])

  useEffect(() => {
    setDraft("")
    setSendError("")
    setMoreAvailable(true)
  }, [selectedId])

  const chats = [...new Map([...initialChats, ...messenger.chats].map((chat) => [chat.id, chat] as const)).values()]
    .sort((a, b) => Date.parse(b.createAt) - Date.parse(a.createAt))
  const selected = chats.find((chat) => chat.id === selectedId)
  const messages = selectedId ? messenger.messages[selectedId] : undefined
  const orderedMessages = [...(messages ?? [])].sort((a, b) => Date.parse(a.createAt) - Date.parse(b.createAt))
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

  useEffect(() => {
    bottom.current?.scrollIntoView({ block: "nearest" })
  }, [selectedId, lastId])

  function interlocutor(chat: ChatResponse) {
    return chat.userId1.toLowerCase() === session.userId?.toLowerCase()
      ? chat.userName2 || "Собеседник"
      : chat.userName1 || "Собеседник"
  }

  function chooseChat(chatId: string) {
    const params = new URLSearchParams(window.location.search)
    params.set("chatId", chatId)
    window.history.pushState(null, "", `${routes.messages}?${params}`)
    selectedRef.current = chatId
    setSelectedId(chatId)
  }

  async function submitMessage(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const text = draft.trim()
    if (!selectedId || !messages || !text || !connected || sendLock.current) return
    const chatId = selectedId
    sendLock.current = true
    setSending(true)
    setSendError("")
    try {
      await messenger.sendMessage({ chatId, senderName: session.login || "Покупатель", text })
      if (mounted.current && selectedRef.current === chatId) setDraft("")
    } catch {
      if (mounted.current && selectedRef.current === chatId) setSendError("Не удалось отправить сообщение. Текст сохранён, попробуйте ещё раз.")
    } finally {
      sendLock.current = false
      if (mounted.current) setSending(false)
    }
  }

  async function loadOlder() {
    if (!selectedId || messenger.isLoadingHistory) return
    try {
      const page = Math.floor((messages?.length ?? 0) / 50) + 1
      const hasMore = await messenger.loadMoreMessages(selectedId, page)
      if (mounted.current && selectedRef.current === selectedId) setMoreAvailable(hasMore)
    } catch {
      if (mounted.current && selectedRef.current === selectedId) setHistoryError("Не удалось загрузить предыдущие сообщения.")
    }
  }

  return (
    <div className="flex min-h-dvh flex-col bg-background pb-[calc(64px_+_env(safe-area-inset-bottom))] text-foreground md:pb-0">
      <SiteHeader authenticated={Boolean(session.token)} />
      <main className="mx-auto w-full max-w-[1328px] flex-1 px-4 py-6 md:px-6">
        <h1 className="mb-5 text-2xl/8 font-bold">Сообщения</h1>
        {!ready ? <p role="status">Загрузка…</p> : !session.token || unauthorized ? (
          <EmptyState title="Войдите, чтобы открыть сообщения">
            <Link href={`${routes.login}?next=${encodeURIComponent(routes.messages + (selectedId ? `?chatId=${encodeURIComponent(selectedId)}` : ""))}`} className={buttonVariants()}>Войти</Link>
          </EmptyState>
        ) : (
          <div className="grid gap-4 md:grid-cols-[260px_minmax(0,1fr)]">
            <section aria-label="Список чатов" className="max-h-72 overflow-y-auto rounded-[12px] border border-border bg-card md:max-h-[650px]">
              {loadingChats && <p role="status" className="p-4 text-sm text-muted-foreground">Загружаем чаты…</p>}
              {chatsError && <div role="alert" className="p-4 text-sm text-destructive">Не удалось загрузить чаты. <Button variant="text" size="sm" onClick={() => setRetry((value) => value + 1)}>Повторить</Button></div>}
              {!loadingChats && !chatsError && !chats.length && <p className="p-4 text-sm text-muted-foreground">Переписок пока нет.</p>}
              <ul>
                {chats.map((chat) => (
                  <li key={chat.id}>
                    <button type="button" aria-pressed={selectedId === chat.id} onClick={() => chooseChat(chat.id)} className="flex w-full items-center gap-3 border-b border-border p-4 text-left hover:bg-muted aria-pressed:bg-primary-50 focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-ring">
                      <MessageCircle aria-hidden="true" className="size-5 shrink-0 text-primary" />
                      <span className="min-w-0"><span className="block truncate text-sm font-semibold">{interlocutor(chat)}</span><span className="block text-xs/4 text-muted-foreground">Переписка по объявлению</span></span>
                    </button>
                  </li>
                ))}
              </ul>
            </section>
            <section aria-label="Переписка" className="flex h-[650px] max-h-[75dvh] min-h-96 min-w-0 flex-col overflow-hidden rounded-[12px] border border-border bg-card">
              {!selectedId ? (
                <div className="m-auto p-6 text-center text-sm text-muted-foreground">Выберите переписку слева или напишите продавцу на странице объявления.</div>
              ) : (
                <>
                  <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border p-4">
                    <h2 className="font-semibold">{selected ? interlocutor(selected) : "Переписка"}</h2>
                    {selected && <Link href={routes.product(selected.productId)} className="text-sm text-primary hover:text-primary-800">Открыть объявление</Link>}
                  </div>
                  <div role="status" className="flex flex-wrap items-center gap-2 border-b border-border px-4 py-2 text-xs/4 text-muted-foreground">
                    {connected ? "Подключено" : "Подключение к сообщениям…"}
                    {!connected && <Button variant="text" size="sm" disabled={messenger.connectionState === "Connecting"} onClick={() => { void messenger.connect() }}>Подключиться</Button>}
                  </div>
                  <div className="min-h-0 flex-1 space-y-3 overflow-y-auto p-4">
                    {historyAttempted !== selectedId && <p role="status" className="text-sm text-muted-foreground">Загружаем историю…</p>}
                    {historyAttempted === selectedId && !messages && <div role="alert" className="text-sm text-destructive">Не удалось загрузить историю. <Button variant="text" size="sm" onClick={() => setHistoryRetry((value) => value + 1)}>Повторить</Button></div>}
                    {messages && moreAvailable && messages.length >= 50 && <Button variant="secondary" size="sm" loading={messenger.isLoadingHistory} onClick={() => { void loadOlder() }}>Ранее</Button>}
                    {historyError && <p role="alert" className="text-sm text-destructive">{historyError}</p>}
                    {messages && !messages.length && <p className="text-sm text-muted-foreground">Начните переписку с сообщения.</p>}
                    <ol aria-label="Сообщения" className="space-y-3">
                      {orderedMessages.map((message) => {
                        const own = message.userId.toLowerCase() === session.userId?.toLowerCase()
                        return (
                          <li key={message.id} className={cn("w-fit max-w-[90%] rounded-[10px] border border-border p-3 text-sm/5 [overflow-wrap:anywhere]", own ? "ml-auto bg-primary-50" : "bg-muted")}>
                            <p className="mb-1 text-xs font-medium text-muted-foreground">{own ? "Вы" : message.senderName || (selected ? interlocutor(selected) : "Собеседник")}</p>
                            {message.reply && <blockquote className="mb-2 border-l-2 border-primary pl-2 text-xs text-muted-foreground">{message.reply.text}</blockquote>}
                            {message.text && <p className="whitespace-pre-wrap">{message.text}</p>}
                            {(message.attachments ?? []).map((attachment) => {
                              const href = attachment.fileUrl ? attachmentHref(attachment.fileUrl) : undefined
                              return href && <a key={attachment.id} href={href} target="_blank" rel="noopener noreferrer" className="mt-1 block text-primary underline">{attachment.fileName || "Вложение"}</a>
                            })}
                          </li>
                        )
                      })}
                    </ol>
                    <div ref={bottom} />
                  </div>
                  <form onSubmit={submitMessage} className="border-t border-border p-3">
                    {sendError && <p role="alert" className="mb-2 text-sm text-destructive">{sendError}</p>}
                    <div className="flex min-w-0 items-center gap-2">
                      <Input aria-label="Сообщение" placeholder="Напишите сообщение" value={draft} disabled={sending} onChange={(event) => setDraft(event.target.value)} className="min-w-0 flex-1" />
                      <Button type="submit" size="icon" aria-label="Отправить сообщение" loading={sending} disabled={!connected || !draft.trim() || !messages}><Send /></Button>
                    </div>
                  </form>
                </>
              )}
            </section>
          </div>
        )}
      </main>
      <SiteFooter />
      <MobileNavigation authenticated={Boolean(session.token)} active="messages" />
    </div>
  )
}
