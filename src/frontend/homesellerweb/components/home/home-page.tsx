"use client"

import Link from "next/link"
import { Search } from "lucide-react"
import { useEffect, useRef, useState, type FormEvent } from "react"
import type { ConditionResponse, ProductsResponse, TagResponse } from "@/dtos/product/product.dto"
import { tokenStorage, ApiError } from "@/lib/http"
import { productService } from "@/services/product.service"
import { favoriteService } from "@/services/favorite.service"
import { Button, buttonVariants } from "@/components/ui/button"
import { CategoryNavigation } from "@/components/layout/category-navigation"
import { ProductCard, ProductCardSkeleton } from "./product-card"
import { Select } from "@/components/ui/select"
import { CatalogFilters } from "@/components/catalog/catalog-filters"
import { cn } from "@/lib/utils"
import {
  CATALOG_PAGE_SIZE, catalogSortOptions, defaultCatalogFilters, filterDraft,
  hasCatalogFilters, readCatalogLocation, writeCatalogLocation,
  type CatalogFilters as Filters, type CatalogSort,
} from "@/lib/catalog-filters"
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
  const [filters, setFilters] = useState<Filters>(defaultCatalogFilters)
  const [filtersOpen, setFiltersOpen] = useState(false)
  const [filterRevision, setFilterRevision] = useState(0)
  const [conditions, setConditions] = useState<ConditionResponse[]>([])
  const [conditionsLoading, setConditionsLoading] = useState(true)
  const [conditionsError, setConditionsError] = useState(false)
  const [conditionsRetry, setConditionsRetry] = useState(0)
  const [hasNextPage, setHasNextPage] = useState<boolean | null>(false)
  const catalogRef = useRef<HTMLHeadingElement>(null)
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
      const location = readCatalogLocation(new URLSearchParams(window.location.search))
      setQuery(location.search)
      setDraft(location.search)
      setCategory(location.category)
      setFilters(location.filters)
      setFilterRevision((value) => value + 1)
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
          if (!Array.isArray(result)) throw new Error("Invalid categories response")
          setTags(result.filter((tag) => tag.id && tag.name?.trim()))
          setTagsReady(true)
        }
      })
      .catch(() => { if (!cancelled) setTagsError(true) })
    return () => { cancelled = true }
  }, [tagsRetry])

  useEffect(() => {
    let cancelled = false
    setConditionsLoading(true)
    setConditionsError(false)
    productService.getConditions()
      .then((result) => {
        if (cancelled) return
        if (!Array.isArray(result)) throw new Error("Invalid conditions response")
        setConditions(result.filter((condition) => condition.id && condition.name?.trim()))
      })
      .catch(() => { if (!cancelled) setConditionsError(true) })
      .finally(() => { if (!cancelled) setConditionsLoading(false) })
    return () => { cancelled = true }
  }, [conditionsRetry])

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
    setHasNextPage(null)
    if (categoryPending) return
    // A category must be resolved before requesting a paginated result.
    if (category && (tagsError || !selectedTagIdsKey)) {
      setProducts([])
      setLoadError(tagsError)
      setHasNextPage(false)
      setLoading(false)
      return
    }
    let cancelled = false

    async function load() {
      try {
        if (!process.env.NEXT_PUBLIC_PRODUCT_API_URL) throw new Error("Product API URL is missing")
        const request = {
          ...filters,
          pageSize: CATALOG_PAGE_SIZE,
          search: query || undefined,
          tagIds: selectedTagIdsKey ? selectedTagIdsKey.split(",") : undefined,
        }
        const result = await productService.getProducts(request)
        if (cancelled) return
        if (!Array.isArray(result)) throw new Error("Invalid products response")
        // Keep the order returned by the API, including price/rating sorting.
        setProducts(result)
        setLoading(false)
        if (result.length < CATALOG_PAGE_SIZE) {
          setHasNextPage(false)
        } else {
          // The API has no total count; inspect the next page using the same size.
          try {
            const next = await productService.getProducts({ ...request, page: filters.page + 1 })
            if (!cancelled) setHasNextPage(!Array.isArray(next) || next.length > 0)
          } catch {
            // A failed probe should still allow the user to request the next page.
            if (!cancelled) setHasNextPage(true)
          }
        }
      } catch {
        if (!cancelled) setLoadError(true)
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    void load()
    return () => { cancelled = true }
  }, [query, category, categoryPending, selectedTagIdsKey, tagsError, filters, retry, urlReady])

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

  function updateLocation(search: string, selectedCategory: string, nextFilters: Filters = { ...filters, page: 1 }) {
    const params = writeCatalogLocation(new URLSearchParams(window.location.search), search, selectedCategory, nextFilters)
    const suffix = params.toString()
    window.history.pushState(null, "", `${window.location.pathname}${suffix ? `?${suffix}` : ""}${window.location.hash}`)
    setQuery(search)
    setCategory(selectedCategory)
    setFilters(nextFilters)
    window.requestAnimationFrame(() => {
      catalogRef.current?.focus({ preventScroll: true })
      catalogRef.current?.scrollIntoView({ block: "start" })
    })
  }

  function resetAll() {
    setDraft("")
    setFilterRevision((value) => value + 1)
    updateLocation("", "", defaultCatalogFilters)
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
  const activeFilters = hasCatalogFilters(filters)
  const catalogMode = Boolean(query || category || activeFilters || filters.sortBy !== "newest" || filters.page > 1)
  const filterKey = `${filterRevision}:${JSON.stringify(filterDraft(filters))}`
  const returnParams = writeCatalogLocation(new URLSearchParams(), query, category, filters).toString()
  const loginHref = `${routes.login}?next=${encodeURIComponent(`${routes.home}${returnParams ? `?${returnParams}` : ""}`)}`
  const filterSummary = [
    filters.minPrice !== undefined ? `От ${filters.minPrice.toLocaleString("ru-RU")} ₽` : "",
    filters.maxPrice !== undefined ? `До ${filters.maxPrice.toLocaleString("ru-RU")} ₽` : "",
    filters.conditionId ? conditions.find((condition) => condition.id === filters.conditionId)?.name || "Выбрано состояние" : "",
    filters.position,
    filters.minRating !== undefined ? `Оценка от ${filters.minRating}` : "",
  ].filter(Boolean).join(" · ")

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
        {!catalogMode && <HomeHero />}

        <section aria-labelledby="catalog-title" className="mx-auto w-full max-w-[1328px] px-4 md:px-6 pt-6 pb-8 md:pt-8 md:pb-12">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3 md:mb-6">
            <h2 ref={catalogRef} tabIndex={-1} id="catalog-title" className="min-w-0 scroll-mt-5 text-[22px]/[28px] font-bold outline-none [overflow-wrap:anywhere] md:text-2xl/8">{query ? `Результаты поиска «${query}»` : category || (catalogMode ? "Объявления" : "Свежие объявления")}</h2>
            <div className="flex w-full flex-wrap items-center gap-2 sm:w-auto">
              <Button type="button" variant={activeFilters || filtersOpen ? "soft" : "secondary"} aria-expanded={filtersOpen} aria-controls="catalog-filters" onClick={() => setFiltersOpen((value) => !value)}>Фильтры</Button>
              <div className="min-w-0 flex-1 sm:w-52">
                <label htmlFor="catalog-sort" className="sr-only">Сортировка объявлений</label>
                <Select id="catalog-sort" name="sortBy" value={filters.sortBy} onChange={(event) => updateLocation(query, category, { ...filters, sortBy: event.target.value as CatalogSort, page: 1 })}>
                  {catalogSortOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
                </Select>
              </div>
            </div>
          </div>
          {filterSummary && <p className="mb-3 text-sm/5 text-muted-foreground [overflow-wrap:anywhere]">{filterSummary}</p>}
          {catalogMode && <Button type="button" variant="text" size="sm" className="mb-4" onClick={resetAll}>Сбросить фильтры</Button>}
          <div className={cn(filtersOpen && "lg:grid lg:grid-cols-[260px_minmax(0,1fr)] lg:items-start lg:gap-6")}>
            <aside id="catalog-filters" hidden={!filtersOpen} className="mb-6 lg:mb-0">
              <CatalogFilters
                key={filterKey}
                value={filters}
                conditions={conditions}
                conditionsLoading={conditionsLoading}
                conditionsError={conditionsError}
                onRetryConditions={() => setConditionsRetry((value) => value + 1)}
                onApply={(value) => { setFiltersOpen(false); updateLocation(query, category, { ...filters, ...value, page: 1 }) }}
                onReset={() => updateLocation(query, category, { ...defaultCatalogFilters, sortBy: filters.sortBy })}
              />
            </aside>
            <div className="min-w-0">
                {loginRequired && (
                  <div role="status" className="mb-6 flex flex-wrap items-center gap-3 rounded-[10px] border border-border bg-card p-4 text-sm/5">
                    <p>Войдите, чтобы сохранять объявления в избранное.</p>
                    <Link href={loginHref} prefetch={false} className={buttonVariants({ variant: "soft", size: "sm" })}>Войти</Link>
                  </div>
                )}
                {favoriteError && (
                  <div role="alert" className="mb-6 flex flex-wrap items-center gap-3 rounded-[10px] border border-destructive bg-error-bg text-destructive p-4 text-sm/5">
                    <p>{favoriteError}</p>
                    {!favoritesReady && <Button variant="secondary" size="sm" onClick={() => setFavoriteRetry((value) => value + 1)}>Повторить</Button>}
                  </div>
                )}

                <div aria-busy={loading}>
                  {loading ? (
                    <>
                      <p role="status" className="sr-only">Загружаем объявления</p>
                      <div className={cn("grid grid-cols-1 gap-4 min-[360px]:grid-cols-2 md:gap-6 min-[1200px]:gap-6 [&>li]:min-w-0", filtersOpen ? "md:grid-cols-3 lg:grid-cols-2 min-[1200px]:grid-cols-3" : "md:grid-cols-3 min-[1200px]:grid-cols-4")}>
                        {Array.from({ length: 8 }, (_, index) => <ProductCardSkeleton key={index} />)}
                      </div>
                    </>
                  ) : loadError ? (
                    <EmptyState role="alert" title={category && tagsError ? "Не удалось загрузить категорию" : "Не удалось загрузить объявления"} description="Проверьте соединение и попробуйте ещё раз.">
                      <Button variant="secondary" onClick={() => category && tagsError ? setTagsRetry((value) => value + 1) : setRetry((value) => value + 1)}>Повторить</Button>
                    </EmptyState>
                  ) : products.length ? (
                    <>
                      <p className="sr-only" role="status">На странице объявлений: {products.length}</p>
                      <ul className={cn("grid grid-cols-1 gap-4 min-[360px]:grid-cols-2 md:gap-6 min-[1200px]:gap-6 [&>li]:min-w-0", filtersOpen ? "md:grid-cols-3 lg:grid-cols-2 min-[1200px]:grid-cols-3" : "md:grid-cols-3 min-[1200px]:grid-cols-4")}>
                        {products.map((product) => (
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
                    <EmptyState icon={<Search />}
                      title={filters.page > 1 ? "На этой странице нет объявлений" : query || category || activeFilters ? "Объявления не найдены" : "Пока нет объявлений"}
                      description={filters.page > 1 ? "Вернитесь на предыдущую страницу." : query || category || activeFilters ? "Попробуйте изменить запрос или параметры фильтров." : "Здесь появятся новые объявления."}
                    >
                      {filters.page > 1 ? <Button variant="secondary" onClick={() => updateLocation(query, category, { ...filters, page: filters.page - 1 })}>Предыдущая страница</Button> : (query || category || activeFilters) && <Button variant="secondary" onClick={resetAll}>Сбросить фильтры</Button>}
                    </EmptyState>
                  )}
                </div>
                {!loading && (filters.page > 1 || (!loadError && hasNextPage !== false)) && (
                  <nav aria-label="Страницы объявлений" className="mt-6 flex flex-wrap items-center justify-center gap-3">
                    <Button type="button" variant="secondary" disabled={filters.page <= 1} onClick={() => updateLocation(query, category, { ...filters, page: filters.page - 1 })}>Назад</Button>
                    <span aria-current="page" className="text-sm text-muted-foreground">Страница {filters.page}</span>
                    <Button type="button" variant="secondary" disabled={loadError || hasNextPage !== true} onClick={() => updateLocation(query, category, { ...filters, page: filters.page + 1 })}>Далее</Button>
                    {hasNextPage === null && <span role="status" className="sr-only">Проверяем следующую страницу…</span>}
                  </nav>
                )}
            </div>
          </div>
        </section>
      </main>

      <SiteFooter />
      <MobileNavigation authenticated={Boolean(token)} active="home" />
    </div>
  )
}
