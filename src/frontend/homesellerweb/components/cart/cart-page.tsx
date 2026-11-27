"use client"

import Link from "next/link"
import { ShoppingCart, UserRound } from "lucide-react"
import { useEffect, useRef, useState } from "react"
import { cartService } from "@/services/cart.service"
import { AUTH_CHANGE_EVENT, ApiError } from "@/lib/http"
import { routes } from "@/lib/routes"
import { readSession, type Session } from "@/lib/session"
import { Button, buttonVariants } from "@/components/ui/button"
import { EmptyState } from "@/components/ui/empty-state"
import { SiteHeader } from "@/components/layout/site-header"
import { SiteFooter } from "@/components/layout/site-footer"
import { MobileNavigation } from "@/components/layout/mobile-navigation"
import { CartItem } from "./cart-item"
import { cartSummary, formatCartMoney, loadCartLine, loadCartLines, type CartLine } from "./cart-data"

type CartChange = { kind: "remove"; id: string } | { kind: "clear" }
type CartAction = CartChange | { kind: "retry"; id: string }

export function CartPage() {
  const [session, setSession] = useState<Session>({ token: null, userId: null, login: "" })
  const [ready, setReady] = useState(false)
  const [items, setItems] = useState<CartLine[]>([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState(false)
  const [unauthorized, setUnauthorized] = useState(false)
  const [retry, setRetry] = useState(0)
  const [action, setAction] = useState<CartAction | null>(null)
  const [actionError, setActionError] = useState("")
  const [syncError, setSyncError] = useState(false)
  const [notice, setNotice] = useState("")
  const [confirmClear, setConfirmClear] = useState(false)
  const mounted = useRef(false)
  const actionLock = useRef(false)
  const loadVersion = useRef(0)
  const tokenRef = useRef<string | null>(null)

  useEffect(() => {
    mounted.current = true
    function read() {
      const next = readSession()
      if (tokenRef.current !== next.token) {
        loadVersion.current += 1
        setItems([])
        setLoading(true)
        setAction(null)
        setConfirmClear(false)
        setUnauthorized(false)
      }
      tokenRef.current = next.token
      setSession((current) => current.token === next.token ? current : next)
      setReady(true)
    }
    read()
    window.addEventListener(AUTH_CHANGE_EVENT, read)
    window.addEventListener("storage", read)
    window.addEventListener("focus", read)
    return () => {
      mounted.current = false
      loadVersion.current += 1
      window.removeEventListener(AUTH_CHANGE_EVENT, read)
      window.removeEventListener("storage", read)
      window.removeEventListener("focus", read)
    }
  }, [])

  useEffect(() => {
    if (!ready || !session.token) return
    let cancelled = false
    loadVersion.current += 1
    setLoading(true)
    setLoadError(false)
    setUnauthorized(false)
    setActionError("")
    setSyncError(false)
    setNotice("")
    setConfirmClear(false)
    async function load() {
      try {
        const cart = await cartService.getCart()
        if (cancelled) return
        const result = await loadCartLines(cart, () => cancelled)
        if (!cancelled) setItems(result)
      } catch (failure) {
        if (!cancelled) {
          setLoadError(true)
          setUnauthorized(failure instanceof ApiError && failure.status === 401)
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    void load()
    return () => { cancelled = true }
  }, [ready, session.token, retry])

  async function mutate(change: CartChange) {
    if (actionLock.current || loading || !session.token) return
    const kind = change.kind
    const id = change.kind === "remove" ? change.id : undefined
    actionLock.current = true
    setAction(change)
    setActionError("")
    setSyncError(false)
    setNotice("")
    const version = loadVersion.current
    const token = session.token
    const active = () => mounted.current && version === loadVersion.current && tokenRef.current === token
    let completed = false
    let failure: unknown
    try {
      try {
        if (change.kind === "clear") await cartService.clearCart()
        else await cartService.removeCartItem(change.id)
        completed = true
      } catch (error) {
        failure = error
        if (error instanceof ApiError && error.status === 401) {
          if (active()) setUnauthorized(true)
          return
        }
      }
      if (!active()) return
      if (completed) {
        setItems((current) => kind === "clear" ? [] : current.filter((item) => item.productId !== id))
        setConfirmClear(false)
      }
      // Mutation responses have no documented body. Read the authoritative cart again.
      try {
        const cart = await cartService.getCart()
        if (!active()) return
        const result = await loadCartLines(cart, () => !active())
        if (!active()) return
        setItems(result)
        const removed = kind === "clear" ? result.length === 0 : !result.some((item) => item.productId.toLowerCase() === id?.toLowerCase())
        if (removed) {
          setConfirmClear(false)
          setNotice(kind === "clear" ? "Корзина очищена." : "Товар убран из корзины.")
        } else if (completed) {
          setNotice(kind === "clear" ? "В корзине остались товары. Список обновлён." : "Товар всё ещё в корзине. Список обновлён.")
        } else {
          setActionError(failure instanceof ApiError && failure.status >= 400 && failure.status < 500 ? failure.message : "Не удалось изменить корзину. Попробуйте ещё раз.")
        }
      } catch (error) {
        if (!active()) return
        if (error instanceof ApiError && error.status === 401) setUnauthorized(true)
        else if (completed) setSyncError(true)
        else setActionError(failure instanceof ApiError && failure.status >= 400 && failure.status < 500 ? failure.message : "Не удалось подтвердить изменение корзины. Обновите список перед повторной попыткой.")
      }
    } finally {
      actionLock.current = false
      if (active()) setAction(null)
    }
  }

  async function retryItem(line: CartLine) {
    if (actionLock.current || loading) return
    actionLock.current = true
    setAction({ kind: "retry", id: line.productId })
    const version = loadVersion.current
    const result = await loadCartLine(line)
    if (mounted.current && version === loadVersion.current) {
      setItems((current) => current.map((item) => item.productId === line.productId ? result : item))
      setAction(null)
    }
    actionLock.current = false
  }

  const summary = cartSummary(items)
  const busy = loading || action !== null

  return (
    <div className="flex min-h-dvh flex-col bg-background pb-[calc(64px_+_env(safe-area-inset-bottom))] text-foreground md:pb-0">
      <SiteHeader authenticated={Boolean(session.token)} />
      <main className="mx-auto w-full max-w-[1328px] flex-1 px-4 py-6 md:px-6 md:py-8">
        <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
          <h1 className="text-2xl/8 font-bold">Корзина</h1>
          {ready && session.token && !unauthorized && <Button type="button" size="sm" variant="secondary" disabled={busy} onClick={() => setRetry((value) => value + 1)}>Обновить</Button>}
        </div>
        {!ready ? <p role="status">Загрузка…</p> : !session.token || unauthorized ? (
          <EmptyState icon={<UserRound />} title="Войдите, чтобы открыть корзину" description="Добавляйте товары, чтобы вернуться к ним позже.">
            <Link href={`${routes.login}?next=${encodeURIComponent(routes.cart)}`} className={buttonVariants()}>Войти</Link>
          </EmptyState>
        ) : (
          <>
            {actionError && <p role="alert" className="mb-4 text-sm/5 text-destructive">{actionError}</p>}
            {syncError && <p role="alert" className="mb-4 text-sm/5 text-muted-foreground">Изменение сохранено, но обновить корзину не удалось. Нажмите «Обновить».</p>}
            <p role="status" className={notice ? "mb-4 text-sm/5 text-primary" : "sr-only"}>{notice}</p>
            {loading ? (
              <div role="status" className="space-y-3">
                <span className="sr-only">Загружаем корзину</span>
                {Array.from({ length: 3 }, (_, index) => <div key={index} aria-hidden="true" className="h-32 rounded-[12px] border border-border bg-card" />)}
              </div>
            ) : loadError ? (
              <EmptyState role="alert" title="Не удалось загрузить корзину" description="Проверьте соединение и попробуйте ещё раз.">
                <Button type="button" variant="secondary" onClick={() => setRetry((value) => value + 1)}>Повторить</Button>
              </EmptyState>
            ) : !items.length ? (
              <EmptyState icon={<ShoppingCart />} title="Корзина пока пуста" description="Добавьте товар со страницы объявления.">
                <Link href={routes.home} className={buttonVariants()}>Смотреть объявления</Link>
              </EmptyState>
            ) : (
              <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_280px]">
                <ul className="min-w-0 space-y-4">
                  {items.map((line) => <li key={line.productId}>
                    <CartItem line={line} disabled={busy} removing={action?.kind === "remove" && action.id === line.productId} retrying={action?.kind === "retry" && action.id === line.productId} onRemove={() => { void mutate({ kind: "remove", id: line.productId }) }} onRetry={() => { void retryItem(line) }} />
                  </li>)}
                </ul>
                <aside aria-label="Состав корзины" className="space-y-4 rounded-[12px] border border-border bg-card p-4 md:p-6">
                  <h2 className="text-lg/6 font-semibold">В корзине</h2>
                  <p className="text-sm/5 text-muted-foreground">Позиций: {items.length} · Товаров: {summary.quantity}</p>
                  <div>
                    <p className="text-sm/5 text-muted-foreground">{syncError ? "Сумма загруженных позиций" : summary.hasUnknownPrices || summary.hasNegotiablePrices ? "Сумма известных цен" : "Стоимость товаров"}</p>
                    <p className="mt-1 text-2xl/8 font-bold [overflow-wrap:anywhere]">{formatCartMoney(summary.amount)}</p>
                  </div>
                  {summary.hasUnknownPrices && <p className="text-xs/5 text-muted-foreground">Недоступные цены не включены в сумму.</p>}
                  {summary.hasNegotiablePrices && <p className="text-xs/5 text-muted-foreground">Товары с договорной ценой не включены в сумму. Уточните цену у продавца.</p>}
                  <p className="text-xs/5 text-muted-foreground">Обсудите покупку с продавцом через кнопку у товара.</p>
                  {confirmClear ? (
                    <div className="space-y-2 border-t border-border pt-4">
                      <p className="text-sm/5">Убрать все товары из корзины?</p>
                      <Button type="button" variant="danger" className="w-full" disabled={busy} loading={action?.kind === "clear"} onClick={() => { void mutate({ kind: "clear" }) }}>Очистить</Button>
                      <Button type="button" variant="secondary" className="w-full" disabled={busy} onClick={() => setConfirmClear(false)}>Отмена</Button>
                    </div>
                  ) : <Button type="button" variant="secondary" className="w-full" disabled={busy} onClick={() => setConfirmClear(true)}>Очистить корзину</Button>}
                </aside>
              </div>
            )}
          </>
        )}
      </main>
      <SiteFooter />
      <MobileNavigation authenticated={Boolean(session.token)} />
    </div>
  )
}
