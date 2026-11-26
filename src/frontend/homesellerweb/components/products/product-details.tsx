"use client"

import Link from "next/link"
import { useRouter } from "next/navigation"
import { useEffect, useRef, useState, type FormEvent } from "react"
import { Heart, MapPin } from "lucide-react"
import type { ProductsResponse } from "@/dtos/product/product.dto"
import type { ProfileResponse } from "@/dtos/profile/profile.dto"
import { productService } from "@/services/product.service"
import { profileService } from "@/services/profile.service"
import { favoriteService } from "@/services/favorite.service"
import { messengerService } from "@/services/messenger.service"
import { ApiError } from "@/lib/http"
import { routes } from "@/lib/routes"
import { readSession, type Session } from "@/lib/session"
import { Button, buttonVariants } from "@/components/ui/button"
import { Breadcrumbs } from "@/components/ui/breadcrumbs"
import { EmptyState } from "@/components/ui/empty-state"
import { SiteHeader } from "@/components/layout/site-header"
import { SiteFooter } from "@/components/layout/site-footer"
import { SearchForm } from "@/components/layout/search-form"
import { MobileNavigation } from "@/components/layout/mobile-navigation"
import { formatProductDate, formatProductPrice, productImageUrl } from "@/components/home/product-display"
import { ProductGallery } from "./product-gallery"
import { ContactActions } from "./contact-actions"

type SellerProfile = ProfileResponse & { name?: string | null }

export function ProductDetails({ productId }: { productId: string }) {
  const router = useRouter()
  const [session, setSession] = useState<Session>({ token: null, userId: null, login: "" })
  const [product, setProduct] = useState<ProductsResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [notFound, setNotFound] = useState(false)
  const [loadError, setLoadError] = useState(false)
  const [retry, setRetry] = useState(0)
  const [seller, setSeller] = useState<SellerProfile | null>(null)
  const [sellerError, setSellerError] = useState(false)
  const [sellerRetry, setSellerRetry] = useState(0)
  const [phoneVisible, setPhoneVisible] = useState(false)
  const [favorite, setFavorite] = useState(false)
  const [favoriteLoading, setFavoriteLoading] = useState(false)
  const [favoriteReady, setFavoriteReady] = useState(false)
  const [favoritePending, setFavoritePending] = useState(false)
  const [favoriteError, setFavoriteError] = useState("")
  const [favoriteRetry, setFavoriteRetry] = useState(0)
  const [contactPending, setContactPending] = useState(false)
  const [contactError, setContactError] = useState("")
  const [search, setSearch] = useState("")
  const favoriteLock = useRef(false)
  const contactLock = useRef(false)
  const mounted = useRef(false)

  useEffect(() => {
    mounted.current = true
    setSession(readSession())
    return () => { mounted.current = false }
  }, [])

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setLoadError(false)
    setNotFound(false)
    setProduct(null)
    async function load() {
      try {
        const result = await productService.getProductById(productId)
        if (!cancelled) {
          setProduct(result)
          setNotFound(!result)
        }
      } catch (error) {
        if (!cancelled) {
          setNotFound(error instanceof ApiError && error.status === 404)
          setLoadError(!(error instanceof ApiError && error.status === 404))
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    void load()
    return () => { cancelled = true }
  }, [productId, retry])

  useEffect(() => {
    let cancelled = false
      setSeller(null)
      setSellerError(false)
      setPhoneVisible(false)

      const sellerId = product?.userId
      if (!sellerId) return

      async function load(userId: string) {
        try {
          const result = await profileService.getProfileByUserId(userId)
          if (!cancelled) setSeller(result)
        } catch (error) {
          if (!cancelled) {
            setSellerError(
              !(error instanceof ApiError && error.status === 404)
            )
          }
        }
      }

      void load(sellerId)
      return () => { cancelled = true }
  }, [product, sellerRetry])

  useEffect(() => {
    let cancelled = false
    setFavorite(false)
    setFavoriteReady(false)
    setFavoriteError("")
    if (!session.token) return
    setFavoriteLoading(true)
    async function load() {
      try {
        const result = await favoriteService.getFavorite()
        if (!cancelled) {
          setFavorite((result.productIds ?? []).includes(productId))
          setFavoriteReady(true)
        }
      } catch {
        if (!cancelled) setFavoriteError("Не удалось загрузить избранное.")
      } finally {
        if (!cancelled) setFavoriteLoading(false)
      }
    }
    void load()
    return () => { cancelled = true }
  }, [session.token, productId, favoriteRetry])

  function login() {
    router.push(`${routes.login}?next=${encodeURIComponent(routes.product(productId))}`)
  }

  async function toggleFavorite() {
    if (!session.token) { login(); return }
    if (favoriteLock.current || !favoriteReady) return
    favoriteLock.current = true
    setFavoritePending(true)
    setFavoriteError("")
    try {
      const result = favorite
        ? await favoriteService.removeFavorite(productId)
        : await favoriteService.addFavorite(productId)
      if (mounted.current) setFavorite((result.productIds ?? []).includes(productId))
    } catch (error) {
      if (mounted.current) {
        if (error instanceof ApiError && error.status === 401) login()
        else setFavoriteError(error instanceof ApiError && error.status === 400 ? error.message : "Не удалось изменить избранное. Попробуйте ещё раз.")
      }
    } finally {
      favoriteLock.current = false
      if (mounted.current) setFavoritePending(false)
    }
  }

  async function openChat() {
    if (!session.token) { login(); return }
    if (!product || contactLock.current) return
    contactLock.current = true
    setContactPending(true)
    setContactError("")
    try {
      const chat = await messengerService.getOrCreateChat({
        productId: product.id,
        productName: product.nameProduct,
        targetUserId: product.userId,
        initiatorName: session.login || "Покупатель",
        TargetUserName: sellerName,
      })
      if (!chat?.id) throw new Error("Chat ID is missing")
      if (mounted.current) router.push(`${routes.messages}?chatId=${encodeURIComponent(chat.id)}`)
    } catch (error) {
      if (mounted.current) {
        if (error instanceof ApiError && error.status === 401) login()
        else setContactError(error instanceof ApiError && error.status === 400 ? error.message : "Не удалось открыть переписку. Попробуйте ещё раз.")
      }
    } finally {
      contactLock.current = false
      if (mounted.current) setContactPending(false)
    }
  }

  function submitSearch(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const query = search.trim()
    router.push(query ? `${routes.home}?search=${encodeURIComponent(query)}` : routes.home)
  }

  const ownProduct = Boolean(session.userId && product?.userId.toLowerCase() === session.userId.toLowerCase())
  const hasSellerActions = Boolean(product?.userId && !ownProduct)
  const sellerName = seller?.name?.trim() || product?.sellerLogin?.trim() || "Продавец"
  const rawPhone = seller?.phoneNumber?.trim()
  const phone = rawPhone && /\d/.test(rawPhone) ? rawPhone : null
  const images = [...new Set((product?.imageURLs ?? []).map(productImageUrl).filter((url): url is string => Boolean(url)))]
  const published = product ? formatProductDate(product.createAt) : ""
  const sellerSince = seller && formatProductDate(seller.createdAt) ? new Date(seller.createdAt).getFullYear() : null

  return (
    <div className="flex min-h-dvh flex-col bg-background pb-[calc(64px_+_env(safe-area-inset-bottom))] text-foreground md:pb-0">
      <SiteHeader authenticated={Boolean(session.token)} search={<SearchForm value={search} onValueChange={setSearch} onSubmit={submitSearch} />} />
      <main className="mx-auto w-full max-w-[1328px] flex-1 px-4 py-6 md:px-6">
        {loading ? (
          <div role="status" className="space-y-4">
            <span className="sr-only">Загружаем объявление</span>
            <div aria-hidden="true" className="h-5 w-48 rounded bg-muted" />
            <div aria-hidden="true" className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_340px]">
              <div className="aspect-[4/3] rounded-[12px] bg-muted" />
              <div className="h-72 rounded-[12px] bg-muted" />
            </div>
          </div>
        ) : notFound ? (
          <EmptyState title="Объявление не найдено" description="Возможно, оно было удалено.">
            <Link href={routes.home} className={buttonVariants({ variant: "secondary" })}>На главную</Link>
          </EmptyState>
        ) : loadError || !product ? (
          <EmptyState role="alert" title="Не удалось загрузить объявление" description="Проверьте соединение и попробуйте ещё раз.">
            <Button variant="secondary" onClick={() => setRetry((value) => value + 1)}>Повторить</Button>
          </EmptyState>
        ) : (
          <>
            <Breadcrumbs className="mb-5" items={[{ label: "Главная", href: routes.home }, { label: product.nameProduct || "Объявление" }]} />
            <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_340px]">
              <ProductGallery key={product.id} images={images} title={product.nameProduct || "Объявление"} />
              <aside className="min-w-0 space-y-4 lg:col-start-2 lg:row-span-2 lg:row-start-1">
                <section className="rounded-[12px] border border-border bg-card p-4 md:p-5">
                  <h1 className="text-2xl/8 font-bold [overflow-wrap:anywhere]">{product.nameProduct || "Объявление"}</h1>
                  <p className="mt-2 text-[28px]/[36px] font-bold [overflow-wrap:anywhere]">{formatProductPrice(product.price)}</p>
                  {product.position && <p className="mt-3 flex items-start gap-2 text-sm/5 text-muted-foreground"><MapPin aria-hidden="true" className="mt-0.5 size-4 shrink-0" />{product.position}</p>}
                  {published && <p className="mt-1 text-xs/4 text-muted-foreground">Опубликовано <time dateTime={product.createAt}>{published}</time></p>}
                  {ownProduct && <p className="mt-4 text-sm text-muted-foreground">Это ваше объявление.</p>}
                  {hasSellerActions && <div className="mt-4 hidden md:block"><ContactActions onMessage={() => { void openChat() }} pending={contactPending} phone={phone} phoneVisible={phoneVisible} onRevealPhone={() => setPhoneVisible(true)} /></div>}
                  {contactError && <p role="alert" className="mt-3 text-sm/5 text-destructive">{contactError}</p>}
                  <Button type="button" variant="secondary" className="mt-3 w-full" aria-pressed={favorite} loading={favoritePending} disabled={favoriteLoading || Boolean(session.token && !favoriteReady)} onClick={() => { void toggleFavorite() }}>
                    <Heart aria-hidden="true" className={favorite ? "fill-primary text-primary" : undefined} />
                    {favorite ? "В избранном" : "Добавить в избранное"}
                  </Button>
                  {favoriteError && <div role="alert" className="mt-3 text-sm/5 text-destructive">{favoriteError} {!favoriteReady && <Button variant="text" size="sm" onClick={() => setFavoriteRetry((value) => value + 1)}>Повторить</Button>}</div>}
                </section>
                <section aria-label="Продавец" className="rounded-[12px] border border-border bg-card p-4 md:p-5">
                  <div className="flex items-center gap-3">
                    <span aria-hidden="true" className="grid size-11 shrink-0 place-items-center rounded-full bg-primary-50 font-semibold text-primary">{sellerName.slice(0, 1).toLocaleUpperCase("ru")}</span>
                    <div className="min-w-0"><h2 className="font-semibold [overflow-wrap:anywhere]">{sellerName}</h2>{sellerSince && <p className="text-xs/4 text-muted-foreground">На сайте с {sellerSince}</p>}</div>
                  </div>
                  {seller?.description && <p className="mt-3 whitespace-pre-wrap text-sm/5 [overflow-wrap:anywhere]">{seller.description}</p>}
                  {sellerError && <div role="status" className="mt-3 text-xs/4 text-muted-foreground">Данные профиля временно недоступны. <Button variant="text" size="sm" onClick={() => setSellerRetry((value) => value + 1)}>Повторить</Button></div>}
                </section>
              </aside>
              <div className="min-w-0 space-y-4 lg:col-start-1">
                <section className="rounded-[12px] border border-border bg-card p-4 md:p-5">
                  <h2 className="text-lg/6 font-semibold">Описание</h2>
                  <p className="mt-3 whitespace-pre-wrap text-sm/6 [overflow-wrap:anywhere]">{product.description?.trim() || "Продавец не добавил описание."}</p>
                </section>
                <section className="rounded-[12px] border border-border bg-card p-4 md:p-5">
                  <h2 className="text-lg/6 font-semibold">Характеристики</h2>
                  <dl className="mt-3 grid grid-cols-[minmax(0,1fr)_minmax(0,1fr)] gap-x-4 gap-y-3 text-sm/5">
                    <dt className="text-muted-foreground">Состояние</dt><dd className="[overflow-wrap:anywhere]">{product.nameCondition || "Не указано"}</dd>
                    {product.tags?.length > 0 && <><dt className="text-muted-foreground">Категории</dt><dd className="[overflow-wrap:anywhere]">{product.tags.join(", ")}</dd></>}
                  </dl>
                </section>
              </div>
            </div>
          </>
        )}
      </main>
      <SiteFooter />
      {hasSellerActions ? (
        <div aria-label="Связь с продавцом" className="fixed inset-x-0 bottom-0 z-10 flex h-[calc(64px_+_env(safe-area-inset-bottom))] items-center border-t border-border bg-card px-4 pb-[env(safe-area-inset-bottom)] md:hidden">
          <ContactActions compact onMessage={() => { void openChat() }} pending={contactPending} phone={phone} phoneVisible={phoneVisible} onRevealPhone={() => setPhoneVisible(true)} />
        </div>
      ) : <MobileNavigation authenticated={Boolean(session.token)} />}
    </div>
  )
}
