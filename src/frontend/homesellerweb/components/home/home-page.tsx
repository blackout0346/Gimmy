"use client"

import Link from "next/link"
import { useEffect, useRef, useState, type FormEvent } from "react"
import type { ProductsResponse, TagResponse } from "@/dtos/product/product.dto"
import { tokenStorage, ApiError } from "@/lib/http"
import { productService } from "@/services/product.service"
import { favoriteService } from "@/services/favorite.service"
import { Button, buttonVariants } from "@/components/ui/button"
import { CategoryNavigation } from "@/components/layout/category-navigation"
import { ProductCard, ProductCardSkeleton } from "./product-card"
import { productTimestamp } from "./product-display"
import { routes } from "@/lib/routes"
import { SiteHeader } from "@/components/layout/site-header"
import { SiteFooter } from "@/components/layout/site-footer"
import { MobileNavigation } from "@/components/layout/mobile-navigation"
import { SearchForm } from "@/components/layout/search-form"
import { EmptyState } from "@/components/ui/empty-state"
import { HomeHero } from "./home-hero"

export function HomePage() {
  const [products, setProducts] = useState<ProductsResponse[]>([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState(false)
  const [retry, setRetry] = useState(0)
  const [draft, setDraft] = useState("")
  const [query, setQuery] = useState("")
  const [category, setCategory] = useState("")
  const [tags, setTags] = useState<TagResponse[]>([])
  const [tagsReady, setTagsReady] = useState(false)
  const [tagsError, setTagsError] = useState(false)
  const [tagsRetry, setTagsRetry] = useState(0)
  const [urlReady, setUrlReady] = useState(false)
  const [token, setToken] = useState<string | null>(null)
  const [favoriteIds, setFavoriteIds] = useState<string[]>([])
  const [favoritesLoading, setFavoritesLoading] = useState(false)
  const [favoritesReady, setFavoritesReady] = useState(false)
  const [favoritePending, setFavoritePending] = useState<string | null>(null)
  const [favoriteError, setFavoriteError] = useState("")
  const [favoriteRetry, setFavoriteRetry] = useState(0)
  const [loginRequired, setLoginRequired] = useState(false)
  const favoriteLock = useRef(false)
  const tokenRef = useRef<string | null>(null)
  const mounted = useRef(false)

  useEffect(() => {
    mounted.current = true

    function readLocation() {
      const params = new URLSearchParams(window.location.search)
      const search = params.get("search") ?? ""
      setQuery(search)
      setDraft(search)
      setCategory(params.get("category") ?? "")
      setUrlReady(true)
    }

    function readSession() {
      let currentToken: string | null = null
      try {
        currentToken = tokenStorage.get()
      } catch {
        // The public catalog is still usable when browser storage is blocked.
      }
      tokenRef.current = currentToken
      setToken(currentToken)
    }

    readLocation()
    readSession()
    window.addEventListener("popstate", readLocation)
    window.addEventListener("focus", readSession)
    window.addEventListener("storage", readSession)
    return () => {
      mounted.current = false
      window.removeEventListener("popstate", readLocation)
      window.removeEventListener("focus", readSession)
      window.removeEventListener("storage", readSession)
    }
  }, [])

  useEffect(() => {
    let cancelled = false
    setTagsReady(false)
    setTagsError(false)
    productService.getTags()
      .then((result) => {
        if (!cancelled) {
          setTags(result)
          setTagsReady(true)
        }
      })
      .catch(() => { if (!cancelled) setTagsError(true) })
    return () => { cancelled = true }
  }, [tagsRetry])

  const selectedTagIds = tags
    .filter((tag) => tag.name?.trim() === category)
    .map((tag) => tag.id)
    .sort()
  const selectedTagIdsKey = selectedTagIds.join(",")
  const categoryPending = Boolean(category && !tagsReady && !tagsError)

  useEffect(() => {
    if (!urlReady) return
    setLoading(true)
    setLoadError(false)
    if (categoryPending) return
    let cancelled = false

    async function load() {
      try {
        if (!process.env.NEXT_PUBLIC_PRODUCT_API_URL) throw new Error("Product API URL is missing")
        const result = await productService.getProducts({
          search: query || undefined,
          tagIds: selectedTagIdsKey ? selectedTagIdsKey.split(",") : undefined,
          sortBy: "newest",
        })
        if (!cancelled) setProducts([...result].sort((a, b) => productTimestamp(b) - productTimestamp(a)))
      } catch {
        if (!cancelled) setLoadError(true)
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    void load()
    return () => { cancelled = true }
  }, [query, category, categoryPending, selectedTagIdsKey, retry, urlReady])

  useEffect(() => {
    let cancelled = false
    setFavoriteIds([])
    setFavoritesReady(false)
    setFavoriteError("")
    setLoginRequired(false)

    if (!token) {
      setFavoritesLoading(false)
      return
    }

    setFavoritesLoading(true)
    async function load() {
      try {
        if (!process.env.NEXT_PUBLIC_CART_API_URL) throw new Error("Cart API URL is missing")
        const result = await favoriteService.getFavorite()
        if (!cancelled) {
          setFavoriteIds(result.productIds ?? [])
          setFavoritesReady(true)
        }
      } catch (error) {
        if (!cancelled) {
          if (error instanceof ApiError && error.status === 401) {
            setLoginRequired(true)
          } else {
            setFavoriteError("Не удалось загрузить избранное. Попробуйте ещё раз.")
          }
        }
      } finally {
        if (!cancelled) setFavoritesLoading(false)
      }
    }

    void load()
    return () => { cancelled = true }
  }, [token, favoriteRetry])

  function updateLocation(search: string, selectedCategory: string) {
    const params = new URLSearchParams(window.location.search)
    if (search) params.set("search", search)
    else params.delete("search")
    if (selectedCategory) params.set("category", selectedCategory)
    else params.delete("category")
    const suffix = params.toString()
    window.history.pushState(null, "", `${window.location.pathname}${suffix ? `?${suffix}` : ""}${window.location.hash}`)
    setQuery(search)
    setCategory(selectedCategory)
  }

  function submitSearch(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const search = draft.trim()
    setDraft(search)
    updateLocation(search, category)
    if (query === search) setRetry((value) => value + 1)
  }

  async function toggleFavorite(id: string) {
    if (!token || loginRequired) {
      setLoginRequired(true)
      return
    }
    if (favoriteLock.current || !favoritesReady) return

    const session = token
    favoriteLock.current = true
    setFavoritePending(id)
    setFavoriteError("")
    try {
      const result = favoriteIds.includes(id)
        ? await favoriteService.removeFavorite(id)
        : await favoriteService.addFavorite(id)
      if (mounted.current && tokenRef.current === session) {
        setFavoriteIds(result.productIds ?? [])
      }
    } catch (error) {
      if (mounted.current && tokenRef.current === session) {
        if (error instanceof ApiError && error.status === 401) {
          setLoginRequired(true)
        } else {
          setFavoriteError("Не удалось изменить избранное. Попробуйте ещё раз.")
        }
      }
    } finally {
      favoriteLock.current = false
      if (mounted.current) setFavoritePending(null)
    }
  }

  const categories = [...new Set(tags.map((tag) => tag.name?.trim()).filter((name): name is string => Boolean(name)))]
    .sort((a, b) => a.localeCompare(b, "ru"))
  if (category && !categories.includes(category)) categories.unshift(category)
  const visibleProducts = category && !selectedTagIdsKey
    ? products.filter((product) => product.tags?.some((tag) => tag.trim() === category))
    : products

  return (
    <div className="flex min-h-dvh flex-col bg-background pb-[calc(64px_+_env(safe-area-inset-bottom))] text-foreground md:pb-0">
      <SiteHeader
        authenticated={Boolean(token)}
        search={<SearchForm value={draft} onValueChange={setDraft} onSubmit={submitSearch} />}
        categoryNavigation={
          <CategoryNavigation
            categories={categories}
            loading={!tagsReady && !tagsError}
            error={tagsError}
            onRetry={() => setTagsRetry((value) => value + 1)}
            value={category}
            onValueChange={(value) => updateLocation(query, value)}
          />
        }
      />

      <main className="flex-1">
        <HomeHero />

        <section aria-labelledby="catalog-title" className="mx-auto w-full max-w-[1328px] px-4 md:px-6 pt-5 pb-8 md:pt-6 md:pb-12">
          <div className="mb-4 flex flex-wrap items-baseline gap-3 md:mb-5">
            <h2 id="catalog-title" className="text-[22px]/[28px] font-bold [overflow-wrap:anywhere] md:text-2xl/8">{query ? `Результаты поиска «${query}»` : category || "Свежие объявления"}</h2>
            {(query || category) && (
              <button type="button" className="cursor-pointer text-sm text-primary hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring" onClick={() => { setDraft(""); updateLocation("", "") }}>Сбросить фильтры</button>
            )}
          </div>

          {loginRequired && (
            <div role="status" className="mb-5 flex flex-wrap items-center gap-3 rounded-[10px] border border-border bg-card p-4 text-sm/5">
              <p>Войдите, чтобы сохранять объявления в избранное.</p>
              <Link href={routes.login} prefetch={false} className={buttonVariants({ variant: "soft", size: "sm" })}>Войти</Link>
            </div>
          )}
          {favoriteError && (
            <div role="alert" className="mb-5 flex flex-wrap items-center gap-3 rounded-[10px] border border-destructive bg-error-bg text-destructive p-4 text-sm/5">
              <p>{favoriteError}</p>
              {!favoritesReady && <Button variant="secondary" size="sm" onClick={() => setFavoriteRetry((value) => value + 1)}>Повторить</Button>}
            </div>
          )}

          <div aria-busy={loading}>
            {loading ? (
              <>
                <p role="status" className="sr-only">Загружаем объявления</p>
                <div className="grid grid-cols-1 gap-3 min-[360px]:grid-cols-2 md:grid-cols-3 md:gap-5 min-[1200px]:grid-cols-4 min-[1200px]:gap-6 [&>li]:min-w-0">
                  {Array.from({ length: 8 }, (_, index) => <ProductCardSkeleton key={index} />)}
                </div>
              </>
            ) : loadError ? (
              <EmptyState role="alert" title="Не удалось загрузить объявления" description="Проверьте соединение и попробуйте ещё раз.">
                <Button variant="secondary" onClick={() => setRetry((value) => value + 1)}>Повторить</Button>
              </EmptyState>
            ) : visibleProducts.length ? (
              <>
                <p className="sr-only" role="status">Найдено объявлений: {visibleProducts.length}</p>
                <ul className="grid grid-cols-1 gap-3 min-[360px]:grid-cols-2 md:grid-cols-3 md:gap-5 min-[1200px]:grid-cols-4 min-[1200px]:gap-6 [&>li]:min-w-0">
                  {visibleProducts.map((product) => (
                    <li key={product.id}>
                      <ProductCard
                        product={product}
                        favorite={favoriteIds.includes(product.id)}
                        favoriteDisabled={favoritesLoading || favoritePending !== null || Boolean(token && !favoritesReady && !loginRequired)}
                        favoritePending={favoritePending === product.id}
                        onFavorite={(id) => { void toggleFavorite(id) }}
                      />
                    </li>
                  ))}
                </ul>
              </>
            ) : (
              <EmptyState
                title={query || category ? "Объявления не найдены" : "Пока нет объявлений"}
                description={query || category ? "Попробуйте изменить запрос или выбрать другую категорию." : "Здесь появятся новые объявления."}
              >
                {(query || category) && <Button variant="secondary" onClick={() => { setDraft(""); updateLocation("", "") }}>Сбросить фильтры</Button>}
              </EmptyState>
            )}
          </div>
        </section>
      </main>

      <SiteFooter />
      <MobileNavigation authenticated={Boolean(token)} active="home" />
    </div>
  )
}
