"use client"

import Link from "next/link"
import { useEffect, useRef, useState } from "react"
import type { ProductsResponse } from "@/dtos/product/product.dto"
import { favoriteService } from "@/services/favorite.service"
import { productService } from "@/services/product.service"
import { ApiError } from "@/lib/http"
import { readSession, type Session } from "@/lib/session"
import { routes } from "@/lib/routes"
import { Button, buttonVariants } from "@/components/ui/button"
import { EmptyState } from "@/components/ui/empty-state"
import { ProductCard, ProductCardSkeleton } from "@/components/home/product-card"
import { SiteHeader } from "@/components/layout/site-header"
import { SiteFooter } from "@/components/layout/site-footer"
import { MobileNavigation } from "@/components/layout/mobile-navigation"

type FavoriteItem =
  | { id: string; state: "ready"; product: ProductsResponse }
  | { id: string; state: "loading" | "missing" | "error" }

async function loadFavoriteItem(id: string): Promise<FavoriteItem> {
  try {
    const product = await productService.getProductById(id)
    return product ? { id, state: "ready", product } : { id, state: "missing" }
  } catch (error) {
    return { id, state: error instanceof ApiError && error.status === 404 ? "missing" : "error" }
  }
}

async function loadFavoriteItems(ids: string[], cancelled: () => boolean): Promise<FavoriteItem[]> {
  const result: FavoriteItem[] = []
  for (let offset = 0; offset < ids.length; offset += 6) {
    if (cancelled()) break
    const batch = ids.slice(offset, offset + 6)
    result.push(...await Promise.all(batch.map(loadFavoriteItem)))
  }
  return result
}

export function FavoritesPage() {
  const [session, setSession] = useState<Session>({ token: null, userId: null, login: "" })
  const [ready, setReady] = useState(false)
  const [items, setItems] = useState<FavoriteItem[]>([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState(false)
  const [unauthorized, setUnauthorized] = useState(false)
  const [retry, setRetry] = useState(0)
  const [pendingId, setPendingId] = useState<string | null>(null)
  const [retryingId, setRetryingId] = useState<string | null>(null)
  const [removeError, setRemoveError] = useState("")
  const [notice, setNotice] = useState("")
  const mounted = useRef(false)
  const removeLock = useRef(false)
  const retryLock = useRef(false)
  const loadVersion = useRef(0)

  useEffect(() => {
    mounted.current = true
    setSession(readSession())
    setReady(true)
    return () => { mounted.current = false }
  }, [])

  useEffect(() => {
    if (!ready || !session.token) return
    let cancelled = false
    loadVersion.current += 1
    setLoading(true)
    setLoadError(false)
    setUnauthorized(false)
    setRemoveError("")
    setNotice("")

    async function load() {
      try {
        const response = await favoriteService.getFavorite()
        const ids = [...new Set(response.productIds ?? [])]
        const result = await loadFavoriteItems(ids, () => cancelled)
        if (!cancelled) setItems(result)
      } catch (error) {
        if (!cancelled) {
          setLoadError(true)
          setUnauthorized(error instanceof ApiError && error.status === 401)
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    void load()
    return () => { cancelled = true }
  }, [ready, session.token, retry])

  async function removeFavorite(id: string) {
    if (removeLock.current || loading) return
    removeLock.current = true
    setPendingId(id)
    setRemoveError("")
    setNotice("")
    const version = loadVersion.current
    try {
      const response = await favoriteService.removeFavorite(id)
      if (!mounted.current || version !== loadVersion.current) return
      const ids = [...new Set(response.productIds ?? [])]
      const existingIds = new Set(items.map((item) => item.id))
      const newIds = ids.filter((productId) => !existingIds.has(productId))
      setItems((current) => {
        const byId = new Map(current.map((item) => [item.id, item] as const))
        return ids.map((productId) => byId.get(productId) ?? { id: productId, state: "loading" as const })
      })
      setNotice(ids.includes(id) ? "Список избранного обновлён." : "Объявление удалено из избранного.")

      if (newIds.length) {
        const added = await loadFavoriteItems(newIds, () => !mounted.current || version !== loadVersion.current)
        if (mounted.current && version === loadVersion.current) {
          const byId = new Map(added.map((item) => [item.id, item] as const))
          setItems((current) => current.map((item) => byId.get(item.id) ?? item))
        }
      }
    } catch (error) {
      if (mounted.current && version === loadVersion.current) {
        if (error instanceof ApiError && error.status === 401) setUnauthorized(true)
        else setRemoveError(error instanceof ApiError && error.status === 400 ? error.message : "Не удалось удалить объявление из избранного. Попробуйте ещё раз.")
      }
    } finally {
      removeLock.current = false
      if (mounted.current) setPendingId(null)
    }
  }

  async function retryProduct(id: string) {
    if (retryLock.current || removeLock.current || loading) return
    retryLock.current = true
    setRetryingId(id)
    const version = loadVersion.current
    const result = await loadFavoriteItem(id)
    if (mounted.current && version === loadVersion.current) {
      setItems((current) => current.map((item) => item.id === id ? result : item))
    }
    retryLock.current = false
    if (mounted.current) setRetryingId(null)
  }

  return (
    <div className="flex min-h-dvh flex-col bg-background pb-[calc(64px_+_env(safe-area-inset-bottom))] text-foreground md:pb-0">
      <SiteHeader authenticated={Boolean(session.token)} />
      <main className="mx-auto w-full max-w-[1328px] flex-1 px-4 py-6 md:px-6 md:py-8">
        <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
          <h1 className="text-2xl/8 font-bold">Избранное</h1>
          {ready && session.token && !unauthorized && (
            <Button type="button" size="sm" variant="secondary" disabled={loading || pendingId !== null} onClick={() => setRetry((value) => value + 1)}>Обновить</Button>
          )}
        </div>

        {!ready ? <p role="status" className="text-sm text-muted-foreground">Загрузка…</p> : !session.token || unauthorized ? (
          <EmptyState title="Войдите, чтобы открыть избранное" description="Сохраняйте объявления, чтобы вернуться к ним позже.">
            <Link href={`${routes.login}?next=${encodeURIComponent(routes.favorites)}`} className={buttonVariants()}>Войти</Link>
          </EmptyState>
        ) : (
          <>
            {removeError && <p role="alert" className="mb-4 text-sm/5 text-destructive">{removeError}</p>}
            <p role="status" className="sr-only">{notice}</p>
            {loading ? (
              <div role="status">
                <span className="sr-only">Загружаем избранное</span>
                <div className="grid grid-cols-1 gap-3 min-[360px]:grid-cols-2 md:grid-cols-3 md:gap-5 min-[1200px]:grid-cols-4 min-[1200px]:gap-6">
                  {Array.from({ length: 8 }, (_, index) => <ProductCardSkeleton key={index} />)}
                </div>
              </div>
            ) : loadError ? (
              <EmptyState role="alert" title="Не удалось загрузить избранное" description="Проверьте соединение и попробуйте ещё раз.">
                <Button type="button" variant="secondary" onClick={() => setRetry((value) => value + 1)}>Повторить</Button>
              </EmptyState>
            ) : !items.length ? (
              <EmptyState title="В избранном пока пусто" description="Нажмите на сердечко в карточке объявления, чтобы сохранить его здесь.">
                <Link href={routes.home} className={buttonVariants()}>Смотреть объявления</Link>
              </EmptyState>
            ) : (
              <>
                <p className="mb-4 text-sm text-muted-foreground">Всего {items.length}</p>
                <ul className="grid grid-cols-1 gap-3 min-[360px]:grid-cols-2 md:grid-cols-3 md:gap-5 min-[1200px]:grid-cols-4 min-[1200px]:gap-6">
                  {items.map((item) => (
                    <li key={item.id} className="min-w-0">
                      {item.state === "ready" ? (
                        <ProductCard
                          product={item.product}
                          favorite
                          favoriteDisabled={pendingId !== null}
                          favoritePending={pendingId === item.id}
                          onFavorite={(id) => { void removeFavorite(id) }}
                        />
                      ) : item.state === "loading" ? (
                        <div role="status"><span className="sr-only">Загружаем объявление</span><ProductCardSkeleton /></div>
                      ) : (
                        <article className="flex h-full min-h-64 flex-col justify-center rounded-[12px] border border-border bg-card p-4">
                          <h2 className="text-base/6 font-semibold">{item.state === "missing" ? "Объявление не найдено" : "Не удалось загрузить объявление"}</h2>
                          <p className="mt-2 text-sm/5 text-muted-foreground">{item.state === "missing" ? "Оно могло быть удалено продавцом." : "Попробуйте загрузить его ещё раз."}</p>
                          <div className="mt-4 grid gap-2">
                            {item.state === "error" && <Button type="button" variant="secondary" loading={retryingId === item.id} disabled={pendingId !== null || retryingId !== null} onClick={() => { void retryProduct(item.id) }}>Повторить</Button>}
                            <Button type="button" variant="text" loading={pendingId === item.id} disabled={pendingId !== null} onClick={() => { void removeFavorite(item.id) }} className="w-full whitespace-normal">Убрать из избранного</Button>
                          </div>
                        </article>
                      )}
                    </li>
                  ))}
                </ul>
              </>
            )}
          </>
        )}
      </main>
      <SiteFooter />
      <MobileNavigation authenticated={Boolean(session.token)} active="favorites" />
    </div>
  )
}
