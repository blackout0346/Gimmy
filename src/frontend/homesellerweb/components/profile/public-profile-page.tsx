"use client"

import Link from "next/link"
import { useRouter } from "next/navigation"
import { useEffect, useRef, useState } from "react"
import { UserRound } from "lucide-react"
import type { ProfileResponse } from "@/dtos/profile/profile.dto"
import type { ProductsResponse } from "@/dtos/product/product.dto"
import { profileService } from "@/services/profile.service"
import { productService } from "@/services/product.service"
import { favoriteService } from "@/services/favorite.service"
import { ApiError } from "@/lib/http"
import { readSession, type Session } from "@/lib/session"
import { profilePhoto } from "@/lib/profile-images"
import { routes } from "@/lib/routes"
import { Button, buttonVariants } from "@/components/ui/button"
import { Breadcrumbs } from "@/components/ui/breadcrumbs"
import { EmptyState } from "@/components/ui/empty-state"
import { SiteHeader } from "@/components/layout/site-header"
import { SiteFooter } from "@/components/layout/site-footer"
import { MobileNavigation } from "@/components/layout/mobile-navigation"
import { ProductCard, ProductCardSkeleton } from "@/components/home/product-card"
import { ProfileAvatar } from "./profile-avatar"

export function PublicProfilePage({ userId }: { userId: string }) {
  const router = useRouter()
  const [session, setSession] = useState<Session>({ token: null, userId: null, login: "" })
  const [profile, setProfile] = useState<ProfileResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [notFound, setNotFound] = useState(false)
  const [failed, setFailed] = useState(false)
  const [retry, setRetry] = useState(0)
  const [products, setProducts] = useState<ProductsResponse[]>([])
  const [productsLoading, setProductsLoading] = useState(false)
  const [productsError, setProductsError] = useState(false)
  const [productsRetry, setProductsRetry] = useState(0)
  const [visible, setVisible] = useState(12)
  const [favorites, setFavorites] = useState<Set<string>>(new Set())
  const [favoriteReady, setFavoriteReady] = useState(false)
  const [favoritePending, setFavoritePending] = useState<string | null>(null)
  const [favoriteError, setFavoriteError] = useState("")
  const [favoriteRetry, setFavoriteRetry] = useState(0)
  const lock = useRef(false)
  const mounted = useRef(false)
  useEffect(() => { mounted.current = true; setSession(readSession()); return () => { mounted.current = false } }, [])
  useEffect(() => {
    let cancelled = false
    setLoading(true); setFailed(false); setNotFound(false); setProfile(null)
    void profileService.getProfileByUserId(userId).then((result) => {
      if (cancelled) return
      if (!result) { setNotFound(true); return }
      if (result.userId.toLowerCase() !== userId.toLowerCase()) throw new Error("Profile owner mismatch")
      setProfile(result)
    }).catch((error) => { if (!cancelled) { setNotFound(error instanceof ApiError && error.status === 404); setFailed(!(error instanceof ApiError && error.status === 404)) } }).finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [userId, retry])
  useEffect(() => {
    let cancelled = false
    setProducts([]); setProductsError(false); setVisible(12)
    if (!profile) { setProductsLoading(false); return }
    const owner = profile.userId
    const ids = [...new Set((profile.productUsers ?? []).map((item) => item.productId).filter(Boolean))]
    setProductsLoading(true)
    void (async () => {
      const found: ProductsResponse[] = []
      let errors = false
      for (let offset = 0; offset < ids.length; offset += 6) {
        if (cancelled) return
        const batch = await Promise.all(ids.slice(offset, offset + 6).map(async (id) => {
          try { const product = await productService.getProductById(id); return product?.userId.toLowerCase() === owner.toLowerCase() ? product : null }
          catch (error) { if (!(error instanceof ApiError && error.status === 404)) errors = true; return null }
        }))
        found.push(...batch.filter((item): item is ProductsResponse => item !== null))
      }
      if (!cancelled) { setProducts(found.sort((a, b) => Date.parse(b.createAt) - Date.parse(a.createAt))); setProductsError(errors); setProductsLoading(false) }
    })()
    return () => { cancelled = true }
  }, [profile, productsRetry])
  useEffect(() => {
    let cancelled = false
    setFavoriteReady(false); setFavoriteError(""); setFavorites(new Set())
    if (!session.token) return
    void favoriteService.getFavorite().then((result) => { if (!cancelled) { setFavorites(new Set((result.productIds ?? []).map((id) => id.toLowerCase()))); setFavoriteReady(true) } }).catch(() => { if (!cancelled) setFavoriteError("Не удалось загрузить избранное.") })
    return () => { cancelled = true }
  }, [session.token, favoriteRetry])
  async function toggleFavorite(id: string) {
    const login = () => router.push(`${routes.login}?next=${encodeURIComponent(routes.userProfile(userId))}`)
    if (!session.token) { login(); return }
    if (lock.current || !favoriteReady) return
    lock.current = true; setFavoritePending(id); setFavoriteError("")
    try {
      const result = favorites.has(id.toLowerCase()) ? await favoriteService.removeFavorite(id) : await favoriteService.addFavorite(id)
      if (mounted.current) setFavorites(new Set((result.productIds ?? []).map((item) => item.toLowerCase())))
    } catch (error) {
      if (mounted.current) { if (error instanceof ApiError && error.status === 401) login(); else setFavoriteError("Не удалось изменить избранное. Попробуйте ещё раз.") }
    } finally { lock.current = false; if (mounted.current) setFavoritePending(null) }
  }
  const name = profile?.name?.trim() || "Пользователь"
  const created = profile ? new Date(profile.createdAt) : null
  const since = created && Number.isFinite(created.getTime()) ? created.toLocaleDateString("ru-RU", { month: "long", year: "numeric" }) : null
  const own = Boolean(profile && session.userId?.toLowerCase() === profile.userId.toLowerCase())
  return <div className="flex min-h-dvh flex-col bg-background pb-[calc(64px_+_env(safe-area-inset-bottom))] text-foreground md:pb-0">
    <SiteHeader authenticated={Boolean(session.token)} />
    <main className="mx-auto w-full max-w-[1328px] flex-1 px-4 py-6 md:px-6 md:py-8">
      <Breadcrumbs className="mb-6" items={[{ label: "Главная", href: routes.home }, { label: loading ? "Профиль пользователя" : name }]} />
      {loading ? <p role="status" className="text-sm text-muted-foreground">Загружаем профиль…</p> : notFound ? <EmptyState icon={<UserRound />} title="Профиль не найден" description="Пользователь ещё не заполнил профиль или удалил его."><Link href={routes.home} className={buttonVariants({ variant: "secondary" })}>На главную</Link></EmptyState> : failed || !profile ? <EmptyState role="alert" title="Не удалось загрузить профиль"><Button type="button" variant="secondary" onClick={() => setRetry((value) => value + 1)}>Повторить</Button></EmptyState> : <>
        <section className="mb-8 rounded-[12px] border border-border bg-card p-4 md:p-6">
          <div className="flex flex-wrap items-center gap-4"><ProfileAvatar imageUrl={profilePhoto(profile)} name={name} className="size-20 text-2xl" /><div className="min-w-0 flex-1"><h1 className="text-2xl/8 font-bold [overflow-wrap:anywhere]">{name}</h1>{since && <p className="mt-1 text-sm/5 text-muted-foreground">На сайте с {since}</p>}</div>{own && <Link href={routes.profile} className={buttonVariants({ variant: "secondary" })}>Мой профиль</Link>}</div>
          {profile.description?.trim() && <p className="mt-4 max-w-3xl whitespace-pre-wrap text-sm/6 [overflow-wrap:anywhere]">{profile.description}</p>}
        </section>
        <h2 className="mb-6 text-xl/7 font-bold">Объявления пользователя</h2>
        {favoriteError && <p role="alert" className="mb-4 text-sm/5 text-destructive">{favoriteError} {!favoriteReady && <Button type="button" variant="text" size="sm" onClick={() => setFavoriteRetry((value) => value + 1)}>Повторить</Button>}</p>}
        {productsError && <div role="alert" className="mb-4 text-sm/5 text-muted-foreground">Часть объявлений не удалось загрузить. <Button type="button" variant="text" size="sm" onClick={() => setProductsRetry((value) => value + 1)}>Повторить загрузку</Button></div>}
        {productsLoading ? <div role="status" className="grid grid-cols-2 gap-4 lg:grid-cols-4 lg:gap-6"><span className="sr-only">Загружаем объявления</span>{Array.from({ length: 4 }, (_, index) => <ProductCardSkeleton key={index} />)}</div> : !products.length ? <EmptyState title={productsError ? "Объявления пока недоступны" : "У пользователя пока нет объявлений"} /> : <>
          <div className="grid grid-cols-2 gap-4 lg:grid-cols-4 lg:gap-6">{products.slice(0, visible).map((product) => <ProductCard key={product.id} product={product} favorite={favorites.has(product.id.toLowerCase())} favoriteDisabled={favoritePending !== null || Boolean(session.token && !favoriteReady)} favoritePending={favoritePending === product.id} onFavorite={(id) => { void toggleFavorite(id) }} />)}</div>
          {visible < products.length && <div className="mt-6 text-center"><Button type="button" variant="secondary" onClick={() => setVisible((value) => value + 12)}>Показать ещё</Button></div>}
        </>}
      </>}
    </main><SiteFooter /><MobileNavigation authenticated={Boolean(session.token)} />
  </div>
}
