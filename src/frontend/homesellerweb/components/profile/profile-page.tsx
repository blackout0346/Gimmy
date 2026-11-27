"use client"

import Link from "next/link"
import { useRouter } from "next/navigation"
import { useEffect, useRef, useState, type FormEvent } from "react"
import type { ProfileRequest, ProfileResponse } from "@/dtos/profile/profile.dto"
import type { ProductsResponse } from "@/dtos/product/product.dto"
import { profileService } from "@/services/profile.service"
import { productService } from "@/services/product.service"
import { attachProductToProfile } from "@/services/profile-products"
import { authService } from "@/services/auth.service"
import { ApiError } from "@/lib/http"
import { readSession, type Session } from "@/lib/session"
import { routes } from "@/lib/routes"
import { cn } from "@/lib/utils"
import { Button, buttonVariants } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Field, FieldLabel, FieldError } from "@/components/ui/field"
import { EmptyState } from "@/components/ui/empty-state"
import { SiteHeader } from "@/components/layout/site-header"
import { SiteFooter } from "@/components/layout/site-footer"
import { MobileNavigation } from "@/components/layout/mobile-navigation"
import { MyProductRow } from "./my-product-row"
import { ProfileAvatar } from "./profile-avatar"
import { profilePhoto } from "@/lib/profile-images"

type ProfileValues = { name: string; description: string; phoneNumber: string }
type ProfileErrors = Partial<Record<keyof ProfileValues, string>>
type OwnProduct = { id: string; product: ProductsResponse | null }

export function ProfilePage() {
  const router = useRouter()
  const [session, setSession] = useState<Session>({ token: null, userId: null, login: "" })
  const [ready, setReady] = useState(false)
  const [profile, setProfile] = useState<ProfileResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState(false)
  const [unauthorized, setUnauthorized] = useState(false)
  const [retry, setRetry] = useState(0)
  const [tab, setTab] = useState<"products" | "settings">("products")
  const [values, setValues] = useState<ProfileValues>({ name: "", description: "", phoneNumber: "" })
  const [fieldErrors, setFieldErrors] = useState<ProfileErrors>({})
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState("")
  const [notice, setNotice] = useState("")
  const [products, setProducts] = useState<OwnProduct[]>([])
  const [productsLoading, setProductsLoading] = useState(false)
  const [productsRetry, setProductsRetry] = useState(0)
  const [refreshing, setRefreshing] = useState(false)
  const [productsError, setProductsError] = useState("")
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null)
  const [deleting, setDeleting] = useState<string | null>(null)
  const [deleteError, setDeleteError] = useState("")
  const [pendingProductId, setPendingProductId] = useState<string | null>(null)
  const [linkRetry, setLinkRetry] = useState(0)
  const [linking, setLinking] = useState(false)
  const [linkError, setLinkError] = useState("")
  const mounted = useRef(false)
  const saveLock = useRef(false)
  const deleteLock = useRef(false)
  const refreshLock = useRef(false)
  const formRef = useRef<HTMLFormElement>(null)
  const saveErrorRef = useRef<HTMLParagraphElement>(null)

  useEffect(() => {
    mounted.current = true
    setSession(readSession())
    setReady(true)
    setPendingProductId(new URLSearchParams(window.location.search).get("productId"))
    return () => { mounted.current = false }
  }, [])

  useEffect(() => {
    if (!ready || !session.token) return
    let cancelled = false
    setLoading(true)
    setLoadError(false)
    setUnauthorized(false)
    async function load() {
      try {
        const result = await profileService.getMyProfile()
        if (cancelled) return
        setProfile(result)
        setValues({ name: result?.name ?? session.login, description: result?.description ?? "", phoneNumber: result?.phoneNumber ?? "" })
        setTab(result ? "products" : "settings")
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
  }, [ready, session.token, session.login, retry])

  const productIdsKey = [...new Set((profile?.productUsers ?? []).map((item) => item.productId))].join(",")
  const ownerId = profile?.userId
  useEffect(() => {
    if (!ownerId) { setProducts([]); setProductsLoading(false); return }
    let cancelled = false
    setProductsLoading(true)
    const ids = productIdsKey ? productIdsKey.split(",") : []

    async function load(userId: string) {
      const result: OwnProduct[] = []
      for (let offset = 0; offset < ids.length; offset += 6) {
        if (cancelled) return
        const batch = await Promise.all(ids.slice(offset, offset + 6).map(async (id): Promise<OwnProduct | null> => {
          try {
            const product = await productService.getProductById(id)
            return product?.userId.toLowerCase() === userId.toLowerCase() ? { id, product } : null
          } catch (error) {
            return error instanceof ApiError && error.status === 404 ? null : { id, product: null }
          }
        }))
        result.push(...batch.filter((item): item is OwnProduct => item !== null))
      }
      if (!cancelled) { setProducts(result); setProductsLoading(false) }
    }

    void load(ownerId)
    return () => { cancelled = true }
  }, [productIdsKey, ownerId, productsRetry])

  const profileId = profile?.id
  useEffect(() => {
    if (!profileId || !pendingProductId) { setLinking(false); return }
    let cancelled = false
    const controller = new AbortController()
    setLinking(true)
    setLinkError("")
    attachProductToProfile(pendingProductId, controller.signal)
      .then((result) => {
        if (cancelled) return
        setLinking(false)
        setProfile(result)
        setPendingProductId(null)
        setNotice("Объявление добавлено в профиль.")
        const url = new URL(window.location.href)
        url.searchParams.delete("productId")
        window.history.replaceState(null, "", url.pathname + url.search + url.hash)
      })
      .catch((error) => {
        if (!cancelled) setLinkError(error instanceof Error ? error.message : "Не удалось добавить объявление в профиль.")
      })
      .finally(() => { if (!cancelled) setLinking(false) })
    return () => { cancelled = true; controller.abort() }
  }, [profileId, pendingProductId, linkRetry])

  useEffect(() => { if (saveError) saveErrorRef.current?.focus() }, [saveError])

  function change(name: keyof ProfileValues, value: string) {
    setValues((current) => ({ ...current, [name]: value }))
    setFieldErrors((current) => ({ ...current, [name]: undefined }))
    setSaveError("")
    setNotice("")
  }

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (saveLock.current || linking || deleteLock.current || refreshLock.current) return
    const errors: ProfileErrors = {}
    if (!values.name.trim()) errors.name = "Введите имя."
    else if (values.name.trim().length > 100) errors.name = "Имя должно быть не длиннее 100 символов."
    if (values.description.trim().length > 500) errors.description = "Описание должно быть не длиннее 500 символов."
    if (values.phoneNumber.trim().length > 20) errors.phoneNumber = "Телефон должен быть не длиннее 20 символов."
    setFieldErrors(errors)
    setSaveError("")
    setNotice("")
    if (Object.keys(errors).length) {
      formRef.current?.querySelector<HTMLElement>(`[name="${Object.keys(errors)[0]}"]`)?.focus()
      return
    }
    saveLock.current = true
    setSaving(true)
    try {
      const request: ProfileRequest = { name: values.name.trim(), description: values.description.trim() || null, phoneNumber: values.phoneNumber.trim() || null }
      const result = profile ? await profileService.updateMyProfile(request) : await profileService.createProfile(request)
      if (!mounted.current) return
      setProfile((current) => ({ ...result, productUsers: result.productUsers ?? current?.productUsers ?? [] }))
      setValues({ name: result.name ?? request.name, description: result.description ?? "", phoneNumber: result.phoneNumber ?? "" })
      setNotice("Профиль сохранён.")
    } catch (error) {
      if (!mounted.current) return
      if (error instanceof ApiError && error.status === 401) setUnauthorized(true)
      else setSaveError(error instanceof ApiError && error.status >= 400 && error.status < 500 ? error.message : "Не удалось сохранить профиль. Попробуйте ещё раз.")
    } finally {
      saveLock.current = false
      if (mounted.current) setSaving(false)
    }
  }

  async function refreshProducts() {
    if (refreshLock.current || deleteLock.current || saveLock.current) return
    refreshLock.current = true
    setRefreshing(true)
    setProductsError("")
    try {
      const result = await profileService.getMyProfile()
      if (mounted.current) { setProfile(result); setProductsRetry((value) => value + 1) }
    } catch (error) {
      if (mounted.current) {
        if (error instanceof ApiError && error.status === 401) setUnauthorized(true)
        else setProductsError("Не удалось обновить список объявлений.")
      }
    } finally {
      refreshLock.current = false
      if (mounted.current) setRefreshing(false)
    }
  }

  async function deleteProduct(id: string) {
    if (deleteLock.current || saveLock.current || refreshLock.current) return
    deleteLock.current = true
    setDeleting(id)
    setDeleteError("")
    try {
      await productService.deleteProduct(id)
      if (mounted.current) {
        setProducts((current) => current.filter((item) => item.id !== id))
        setProfile((current) => current ? { ...current, productUsers: current.productUsers?.filter((item) => item.productId !== id) } : current)
        setConfirmDelete(null)
        setNotice("Объявление удалено.")
      }
    } catch (error) {
      if (mounted.current) {
        if (error instanceof ApiError && error.status === 401) setUnauthorized(true)
        else setDeleteError(error instanceof ApiError && error.status >= 400 && error.status < 500 ? error.message : "Не удалось удалить объявление.")
      }
    } finally {
      deleteLock.current = false
      if (mounted.current) setDeleting(null)
    }
  }

  function logout() {
    try { authService.logout(); router.replace(routes.home) }
    catch { setSaveError("Не удалось завершить выход. Попробуйте ещё раз.") }
  }

  const busy = saving || linking || deleting !== null || refreshing
  const name = profile?.name?.trim() || session.login || "Мой профиль"
  const loginTarget = routes.profile + (pendingProductId ? `?productId=${encodeURIComponent(pendingProductId)}` : "")

  return (
    <div className="flex min-h-dvh flex-col bg-background pb-[calc(64px_+_env(safe-area-inset-bottom))] text-foreground md:pb-0">
      <SiteHeader authenticated={Boolean(session.token)} />
      <main className="mx-auto w-full max-w-[1328px] flex-1 px-4 py-6 md:px-6 md:py-8">
        {!ready ? <p role="status">Загрузка…</p> : !session.token || unauthorized ? (
          <EmptyState title="Войдите, чтобы открыть профиль">
            <Link href={`${routes.login}?next=${encodeURIComponent(loginTarget)}`} className={buttonVariants()}>Войти</Link>
          </EmptyState>
        ) : loading ? <p role="status" className="text-sm text-muted-foreground">Загружаем профиль…</p> : loadError ? (
          <EmptyState role="alert" title="Не удалось загрузить профиль">
            <Button type="button" variant="secondary" onClick={() => setRetry((value) => value + 1)}>Повторить</Button>
          </EmptyState>
        ) : (
          <div className="grid items-start gap-6 md:grid-cols-[240px_minmax(0,1fr)]">
            <aside className="rounded-[12px] border border-border bg-card p-4">
              <div className="mb-4 flex items-center gap-3">
                <ProfileAvatar imageUrl={profilePhoto(profile)} name={name} className="size-11" />
                <p className="min-w-0 font-semibold [overflow-wrap:anywhere]">{name}</p>
              </div>
              <nav aria-label="Разделы профиля" className="grid gap-1">
                {(["products", "settings"] as const).map((value) => (
                  <button key={value} type="button" aria-pressed={tab === value} disabled={busy || (!profile && value === "products")} onClick={() => { setTab(value); setNotice("") }} className="min-h-11 rounded-[10px] px-3 py-2 text-left text-sm hover:bg-muted aria-pressed:bg-primary-50 aria-pressed:font-medium aria-pressed:text-primary disabled:text-muted-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring">{value === "products" ? "Мои объявления" : "Настройки профиля"}</button>
                ))}
                <Link href={routes.favorites} className={cn(buttonVariants({ variant: "ghost" }), "justify-start")}>Избранное</Link>
                <Link href={routes.messages} className={cn(buttonVariants({ variant: "ghost" }), "justify-start")}>Сообщения</Link>
                <Button type="button" variant="ghost" disabled={busy} onClick={logout} className="justify-start">Выйти</Button>
              </nav>
            </aside>
            <div className="min-w-0">
              <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
                <h1 className="text-2xl/8 font-bold">{tab === "products" ? "Мои объявления" : profile ? "Настройки профиля" : "Заполните профиль"}</h1>
                {tab === "products" && <Link href={routes.create} className={buttonVariants()}>Подать объявление</Link>}
              </div>
              {notice && <p role="status" className="mb-4 text-sm/5 text-primary">{notice}</p>}
              {saveError && <p ref={saveErrorRef} tabIndex={-1} role="alert" className="mb-4 text-sm/5 text-destructive outline-none">{saveError}</p>}
              {pendingProductId && <div className="mb-4 rounded-[10px] border border-border bg-card p-4 text-sm/5">
                <p>{!profile ? "Сохраните профиль, чтобы добавить в него опубликованное объявление." : linking ? "Добавляем объявление в профиль…" : "Добавление объявления в профиль."}</p>
                {linkError && <p role="alert" className="mt-2 text-destructive">{linkError}</p>}
                <div className="mt-3 flex flex-wrap gap-2">
                  {linkError && <Button type="button" size="sm" variant="secondary" onClick={() => setLinkRetry((value) => value + 1)}>Повторить</Button>}
                  <Link href={routes.product(pendingProductId)} className={buttonVariants({ variant: "text", size: "sm" })}>Открыть объявление</Link>
                </div>
              </div>}
              {tab === "settings" ? (
                <form ref={formRef} noValidate onSubmit={save} aria-busy={saving} className="max-w-2xl space-y-4 rounded-[12px] border border-border bg-card p-4 md:p-6">
                  <fieldset disabled={busy} className="min-w-0 space-y-4">
                    <Field>
                      <FieldLabel htmlFor="profile-name">Имя</FieldLabel>
                      <Input id="profile-name" name="name" required maxLength={100} value={values.name} onChange={(event) => change("name", event.target.value)} aria-invalid={Boolean(fieldErrors.name)} aria-describedby={fieldErrors.name ? "profile-name-error" : undefined} />
                      {fieldErrors.name && <FieldError id="profile-name-error">{fieldErrors.name}</FieldError>}
                    </Field>
                    <Field>
                      <FieldLabel htmlFor="profile-phone">Телефон</FieldLabel>
                      <Input id="profile-phone" name="phoneNumber" type="tel" autoComplete="tel" maxLength={20} value={values.phoneNumber} onChange={(event) => change("phoneNumber", event.target.value)} aria-invalid={Boolean(fieldErrors.phoneNumber)} aria-describedby={fieldErrors.phoneNumber ? "profile-phone-error" : undefined} />
                      {fieldErrors.phoneNumber && <FieldError id="profile-phone-error">{fieldErrors.phoneNumber}</FieldError>}
                    </Field>
                    <Field>
                      <FieldLabel htmlFor="profile-description">О себе</FieldLabel>
                      <Textarea id="profile-description" name="description" maxLength={500} value={values.description} onChange={(event) => change("description", event.target.value)} aria-invalid={Boolean(fieldErrors.description)} aria-describedby={fieldErrors.description ? "profile-description-error" : undefined} />
                      {fieldErrors.description && <FieldError id="profile-description-error">{fieldErrors.description}</FieldError>}
                    </Field>
                  </fieldset>
                  <Button type="submit" loading={saving} disabled={busy && !saving}>{profile ? "Сохранить изменения" : "Создать профиль"}</Button>
                </form>
              ) : (
                <section aria-label="Мои объявления">
                  <Button type="button" size="sm" variant="secondary" disabled={busy || productsLoading} onClick={() => { void refreshProducts() }} className="mb-4">Обновить список</Button>
                  {productsError && <p role="alert" className="mb-4 text-sm text-destructive">{productsError}</p>}
                  {deleteError && <p role="alert" className="mb-4 text-sm text-destructive">{deleteError}</p>}
                  {productsLoading ? <p role="status" className="text-sm text-muted-foreground">Загружаем объявления…</p> : !products.length ? (
                    <EmptyState title="У вас пока нет объявлений"><Link href={routes.create} className={buttonVariants()}>Подать объявление</Link></EmptyState>
                  ) : (
                    <ul className="space-y-3">
                      {products.map((item) => (
                        <li key={item.id}>
                          {item.product ? <MyProductRow product={item.product}>
                            {confirmDelete === item.id ? (
                              <>
                                <span className="w-full text-sm">Удалить объявление?</span>
                                <Button type="button" variant="danger" size="sm" loading={deleting === item.id} disabled={busy} onClick={() => { void deleteProduct(item.id) }}>Удалить</Button>
                                <Button type="button" variant="secondary" size="sm" disabled={busy} onClick={() => setConfirmDelete(null)}>Отмена</Button>
                              </>
                            ) : (
                              <Button type="button" variant="secondary" size="sm" disabled={busy} onClick={() => setConfirmDelete(item.id)}>Удалить</Button>
                            )}
                          </MyProductRow> : (
                            <div className="rounded-[12px] border border-border bg-card p-4 text-sm">
                              Не удалось загрузить объявление. <Button type="button" variant="text" size="sm" onClick={() => setProductsRetry((value) => value + 1)}>Повторить</Button>
                            </div>
                          )}
                        </li>
                      ))}
                    </ul>
                  )}
                </section>
              )}
            </div>
          </div>
        )}
      </main>
      <SiteFooter />
      <MobileNavigation authenticated={Boolean(session.token)} active="profile" />
    </div>
  )
}
