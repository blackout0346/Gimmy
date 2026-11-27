"use client"

import Link from "next/link"
import { useRouter } from "next/navigation"
import { useEffect, useRef, useState, type FormEvent } from "react"
import type { ConditionResponse, ProductsRequest, ProductsResponse, TagResponse } from "@/dtos/product/product.dto"
import { productService } from "@/services/product.service"
import { ApiError, tokenStorage } from "@/lib/http"
import { readSession, type Session } from "@/lib/session"
import { emptyPublicationValues, type PublicationValues } from "@/lib/drafts"
import { compareProductRequest, editedProductRequest, productEditValues, resolveProductTags } from "@/lib/product-edit"
import { routes } from "@/lib/routes"
import { Button, buttonVariants } from "@/components/ui/button"
import { FieldError } from "@/components/ui/field"
import { Breadcrumbs } from "@/components/ui/breadcrumbs"
import { EmptyState } from "@/components/ui/empty-state"
import { SiteHeader } from "@/components/layout/site-header"
import { SiteFooter } from "@/components/layout/site-footer"
import { MobileNavigation } from "@/components/layout/mobile-navigation"
import { productImageUrl } from "@/components/home/product-display"
import { ProductFields, type ProductFieldErrors } from "./product-fields"
import { ProductPhotoPicker } from "./product-photo-picker"
import { ProductCategorySelector } from "./product-category-selector"

type EditPhoto = { previewUrl: string; uploadedUrl?: string; file?: File; unavailable?: boolean }
type SaveVerification = { request: ProductsRequest; acknowledged: boolean }

export function ProductEditPage({ productId }: { productId: string }) {
  const router = useRouter()
  const [session, setSession] = useState<Session>({ token: null, userId: null, login: "" })
  const [ready, setReady] = useState(false)
  const [product, setProduct] = useState<ProductsResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [notFound, setNotFound] = useState(false)
  const [forbidden, setForbidden] = useState(false)
  const [loadError, setLoadError] = useState(false)
  const [retry, setRetry] = useState(0)
  const [tags, setTags] = useState<TagResponse[]>([])
  const [conditions, setConditions] = useState<ConditionResponse[]>([])
  const [lookupLoading, setLookupLoading] = useState(true)
  const [lookupError, setLookupError] = useState(false)
  const [lookupRetry, setLookupRetry] = useState(0)
  const [values, setValues] = useState<PublicationValues>(emptyPublicationValues)
  const [tagIds, setTagIds] = useState<string[]>([])
  const [unresolvedTags, setUnresolvedTags] = useState<string[]>([])
  const [tagsConfirmed, setTagsConfirmed] = useState(false)
  const tagsTouched = useRef(false)
  const [photos, setPhotos] = useState<EditPhoto[]>([])
  const photoRef = useRef<EditPhoto[]>([])
  const [errors, setErrors] = useState<ProductFieldErrors>({})
  const [error, setError] = useState("")
  const [pending, setPending] = useState(false)
  const [stage, setStage] = useState("")
  const [saved, setSaved] = useState(false)
  const [verification, setVerification] = useState<SaveVerification | null>(null)
  const [loginRequired, setLoginRequired] = useState(false)
  const mounted = useRef(false)
  const lock = useRef(false)
  const dirty = useRef(false)
  const form = useRef<HTMLFormElement>(null)
  const errorRef = useRef<HTMLParagraphElement>(null)
  useEffect(() => {
    mounted.current = true
    setSession(readSession()); setReady(true)
    function leaving(event: BeforeUnloadEvent) { if (dirty.current || lock.current) { event.preventDefault(); event.returnValue = "" } }
    window.addEventListener("beforeunload", leaving)
    return () => { mounted.current = false; window.removeEventListener("beforeunload", leaving); photoRef.current.forEach((photo) => { if (photo.file) URL.revokeObjectURL(photo.previewUrl) }) }
  }, [])
  function updatePhotos(next: EditPhoto[]) { photoRef.current = next; setPhotos(next) }
  useEffect(() => {
    if (!ready || !session.token) return
    let cancelled = false
    setLoading(true); setLoadError(false); setNotFound(false); setForbidden(false)
    void productService.getProductById(productId).then((result) => {
      if (cancelled) return
      if (!result) { setNotFound(true); return }
      if (!session.userId || result.userId.toLowerCase() !== session.userId.toLowerCase()) { setForbidden(true); return }
      setProduct(result); setValues(productEditValues(result)); tagsTouched.current = false
      photoRef.current.forEach((photo) => { if (photo.file) URL.revokeObjectURL(photo.previewUrl) })
      const seen = new Set<string>()
      updatePhotos((result.imageURLs ?? []).filter((url) => Boolean(url?.trim())).map((url, index) => { const preview = productImageUrl(url); return { previewUrl: preview ?? `unavailable:${index}`, uploadedUrl: url, unavailable: !preview } }).filter((photo) => { if (seen.has(photo.previewUrl)) return false; seen.add(photo.previewUrl); return true }))
      dirty.current = false
    }).catch((failure) => { if (!cancelled) { setNotFound(failure instanceof ApiError && failure.status === 404); setLoadError(!(failure instanceof ApiError && failure.status === 404)) } }).finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [ready, session.token, session.userId, productId, retry])
  useEffect(() => {
    if (!product) return
    let cancelled = false
    setLookupLoading(true); setLookupError(false)
    void Promise.all([productService.getTags(), productService.getConditions()]).then(([nextTags, nextConditions]) => {
      if (cancelled) return
      if (!Array.isArray(nextTags) || !Array.isArray(nextConditions)) throw new Error("Invalid lookups")
      const availableTags = nextTags.filter((tag) => tag.id && tag.name?.trim()).sort((a, b) => a.name.localeCompare(b.name, "ru"))
      setTags(availableTags); setConditions(nextConditions.filter((condition) => condition.id && condition.name?.trim()))
      if (!tagsTouched.current) { const resolved = resolveProductTags(product, availableTags); setTagIds(resolved.ids); setUnresolvedTags(resolved.unresolved); setTagsConfirmed(!resolved.unresolved.length) }
    }).catch(() => { if (!cancelled) setLookupError(true) }).finally(() => { if (!cancelled) setLookupLoading(false) })
    return () => { cancelled = true }
  }, [product, lookupRetry])
  useEffect(() => { if (error) errorRef.current?.focus() }, [error])
  function changed() { dirty.current = true; setSaved(false); setVerification(null); setError("") }
  function updateField(name: keyof PublicationValues, value: string) { if (lock.current) return; changed(); setValues((current) => ({ ...current, [name]: value })); setErrors((current) => ({ ...current, [name]: undefined })) }
  function addPhotos(files: File[]) {
    if (lock.current) return
    const next = [...photoRef.current]
    let invalid = false
    for (const file of files) {
      if (!(file.type.startsWith("image/") || (!file.type && /\.(jpe?g|png|webp|gif|avif|bmp|heic|heif)$/i.test(file.name)))) { invalid = true; continue }
      if (!next.some((photo) => photo.file && photo.file.name === file.name && photo.file.size === file.size && photo.file.lastModified === file.lastModified)) next.push({ file, previewUrl: URL.createObjectURL(file) })
    }
    if (next.length !== photoRef.current.length) { changed(); updatePhotos(next) }
    if (invalid) setError("Выберите файлы изображений.")
  }
  function removePhoto(url: string) { if (lock.current) return; const photo = photoRef.current.find((item) => item.previewUrl === url); if (photo?.file) URL.revokeObjectURL(url); changed(); updatePhotos(photoRef.current.filter((item) => item.previewUrl !== url)) }
  function cover(url: string) { if (lock.current) return; const photo = photoRef.current.find((item) => item.previewUrl === url); if (photo) { changed(); updatePhotos([photo, ...photoRef.current.filter((item) => item !== photo)]) } }
  function currentOwner() {
    const current = readSession()
    if (!session.token || tokenStorage.get() !== session.token || !current.userId || current.userId.toLowerCase() !== product?.userId.toLowerCase()) throw new Error("Аккаунт изменился. Обновите страницу перед сохранением.")
  }
  function completeSave() {
    dirty.current = false
    setSaved(true)
    setVerification(null)
    setError("")
  }
  function confirmSaved(result: ProductsResponse, operation: SaveVerification) {
    if (!result?.id || result.id.toLowerCase() !== productId.toLowerCase() || result.userId?.toLowerCase() !== session.userId?.toLowerCase()) {
      throw new Error("Не удалось подтвердить данные объявления. Проверьте его страницу.")
    }
    const comparison = compareProductRequest(result, operation.request, tags)
    const canVerify = !comparison.unverifiable.length || (operation.acknowledged && comparison.unverifiable.every((field) => field === "ID категорий"))
    if (!comparison.differences.length && canVerify) {
      completeSave()
      return true
    }
    const fields = comparison.differences.length ? comparison.differences : comparison.unverifiable.map((field) => field === "ID категорий" ? "категории" : field)
    setVerification(operation)
    setError(`${operation.acknowledged ? "Сервер принял запрос, но сохранение не подтверждено" : "Не удалось подтвердить сохранение"}: ${fields.join(", ")}. Введённые данные остались в форме. Нажмите «Проверить сохранение» или откройте объявление.`)
    return false
  }
  async function checkSaved() {
    if (!verification || lock.current) return
    lock.current = true
    setPending(true)
    setError("")
    setStage("Проверяем сохранённое объявление…")
    try {
      currentOwner()
      const result = await productService.getProductById(productId)
      currentOwner()
      if (mounted.current) confirmSaved(result, verification)
    } catch (failure) {
      if (mounted.current) {
        setLoginRequired(failure instanceof ApiError && failure.status === 401)
        setError(failure instanceof ApiError ? `${failure.message} (HTTP ${failure.status})` : "Не удалось проверить сохранение. Данные остались в форме.")
      }
    } finally {
      lock.current = false
      if (mounted.current) { setPending(false); setStage("") }
    }
  }
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (lock.current || !product || forbidden || lookupLoading || lookupError) return
    const request = editedProductRequest(values, tagIds, [])
    const nextErrors: ProductFieldErrors = {}
    if (!request.nameProduct) nextErrors.nameProduct = "Введите название объявления."
    if (!request.position) nextErrors.position = "Укажите город или населённый пункт."
    if (!Number.isFinite(request.price) || request.price < 0) nextErrors.price = "Введите неотрицательную цену числом."
    if (!conditions.some((condition) => condition.id === request.conditionId)) nextErrors.conditionId = "Выберите состояние товара."
    if (!tagsConfirmed || !tagIds.length || tagIds.some((id) => !tags.some((tag) => tag.id === id))) nextErrors.tagId = "Выберите полный список категорий объявления."
    setErrors(nextErrors); setError(""); setSaved(false)
    if (Object.keys(nextErrors).length) { form.current?.querySelector<HTMLElement>(`[data-field="${Object.keys(nextErrors)[0]}"]`)?.focus(); return }
    lock.current = true; setPending(true); setLoginRequired(false); setVerification(null)
    let submitted = false
    let acknowledged = false
    try {
      currentOwner()
      const fresh = await productService.getProductById(productId)
      currentOwner()
      if (fresh.userId.toLowerCase() !== session.userId?.toLowerCase()) { setForbidden(true); return }
      for (const photo of photoRef.current) {
        if (photo.uploadedUrl || !photo.file) continue
        setStage("Загружаем фотографии…")
        const urls = await productService.uploadImages([photo.file])
        currentOwner()
        if (!Array.isArray(urls) || urls.length !== 1 || !urls[0]?.trim()) throw new Error("Не удалось подтвердить загрузку фотографии. Попробуйте ещё раз.")
        updatePhotos(photoRef.current.map((item) => item === photo ? { ...item, uploadedUrl: urls[0] } : item))
      }
      currentOwner()
      if (!mounted.current) return
      request.imageURLs = photoRef.current.map((photo) => photo.uploadedUrl).filter((url): url is string => Boolean(url))
      if (request.imageURLs.length !== photoRef.current.length) throw new Error("Не все фотографии загружены.")
      setStage("Сохраняем изменения…"); submitted = true
      const result = await productService.updateProduct(productId, request)
      acknowledged = true
      currentOwner()
      if (!mounted.current) return
      if (typeof result?.id === "string" && result.id.toLowerCase() === productId.toLowerCase() && typeof result.userId === "string" && result.userId.toLowerCase() === session.userId?.toLowerCase()) {
        completeSave()
        return
      }
      const confirmed = await productService.getProductById(productId)
      currentOwner()
      if (mounted.current) confirmSaved(confirmed, { request, acknowledged })
    } catch (failure) {
      if (!mounted.current) return
      if (failure instanceof ApiError && failure.status === 401) {
        setLoginRequired(true)
        setError(`${failure.message} (HTTP 401)`)
        return
      }
      if (submitted && tokenStorage.get() === session.token) {
        try {
          const confirmed = await productService.getProductById(productId)
          currentOwner()
          if (!mounted.current) return
          if (confirmSaved(confirmed, { request, acknowledged })) return
          if (acknowledged) return
        } catch { /* Preserve edits when the verification request also fails. */ }
        setVerification({ request, acknowledged })
      }
      if (failure instanceof ApiError) { setLoginRequired(failure.status === 401); setError(`${failure.message} (HTTP ${failure.status})`) }
      else setError(failure instanceof Error ? failure.message : "Не удалось сохранить изменения. Попробуйте ещё раз.")
    } finally { lock.current = false; if (mounted.current) { setPending(false); setStage("") } }
  }
  function cancel() { if (!lock.current && (!dirty.current || window.confirm("Отменить несохранённые изменения?"))) router.push(routes.product(productId)) }
  return <div className="flex min-h-dvh flex-col bg-background pb-[calc(64px_+_env(safe-area-inset-bottom))] text-foreground md:pb-0">
    <SiteHeader authenticated={Boolean(session.token)} />
    <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-6 md:px-6 md:py-8">
      {!ready ? <p role="status">Загрузка…</p> : !session.token ? <EmptyState title="Войдите, чтобы изменить объявление"><Link href={`${routes.login}?next=${encodeURIComponent(routes.editProduct(productId))}`} className={buttonVariants()}>Войти</Link></EmptyState> : loading ? <p role="status">Загружаем объявление…</p> : notFound ? <EmptyState title="Объявление не найдено" /> : forbidden ? <EmptyState title="Изменить объявление может только его автор"><Link href={routes.product(productId)} className={buttonVariants({ variant: "secondary" })}>Открыть объявление</Link></EmptyState> : loadError || !product ? <EmptyState role="alert" title="Не удалось загрузить объявление"><Button type="button" variant="secondary" onClick={() => setRetry((value) => value + 1)}>Повторить</Button></EmptyState> : <>
        <Breadcrumbs className="mb-6" items={[{ label: "Главная", href: routes.home }, { label: product.nameProduct || "Объявление", href: routes.product(productId) }, { label: "Редактирование" }]} />
        <h1 className="text-2xl/8 font-bold">Редактирование объявления</h1>
        <form ref={form} noValidate onSubmit={submit} aria-busy={pending} className="mt-6 space-y-6">
          <fieldset disabled={pending} className="min-w-0 space-y-6">
            <ProductFields
              values={values}
              updateField={updateField}
              tags={tags}
              conditions={conditions}
              lookupLoading={lookupLoading}
              lookupError={lookupError}
              onLookupRetry={() => setLookupRetry((value) => value + 1)}
              fieldErrors={errors}
              photoPicker={<ProductPhotoPicker photos={photos} disabled={pending} onAdd={addPhotos} onRemove={removePhoto} onCover={cover} />}
              categoryControl={
                <fieldset className="min-w-0" disabled={pending || lookupLoading || lookupError} aria-describedby={errors.tagId ? "edit-categories-error" : undefined}>
                  <legend className="mb-2 text-sm/5 font-medium">Категории</legend>
                  {unresolvedTags.length > 0 && !tagsConfirmed && (
                    <div className="mb-3 space-y-2 text-xs/5 text-muted-foreground">
                      <p>Не удалось восстановить категории: {unresolvedTags.join(", ")}. Выберите полный список ниже.</p>
                      <Button type="button" variant="text" size="sm" className="h-auto min-h-11 max-w-full whitespace-normal text-left" onClick={() => { changed(); tagsTouched.current = true; setTagsConfirmed(true) }}>Подтвердить выбранные категории</Button>
                    </div>
                  )}
                  <ProductCategorySelector
                    tags={tags}
                    selectedIds={tagIds}
                    disabled={pending || lookupLoading || lookupError}
                    invalid={Boolean(errors.tagId)}
                    onChange={(ids) => {
                      if (lock.current) return
                      changed()
                      tagsTouched.current = true
                      setTagsConfirmed(true)
                      setTagIds(ids)
                      setErrors((current) => ({ ...current, tagId: undefined }))
                    }}
                  />
                  {errors.tagId && <FieldError id="edit-categories-error">{errors.tagId}</FieldError>}
                </fieldset>
              }
            />
          </fieldset>
          {error && <p ref={errorRef} role="alert" tabIndex={-1} className="text-sm/5 text-destructive outline-none">{error}</p>}
          {saved && <p role="status" className="text-sm/5 text-primary">Изменения сохранены. <Link href={routes.product(productId)} className="underline">Открыть объявление</Link></p>}
          {verification && <div className="flex flex-wrap gap-3"><Button type="button" variant="secondary" disabled={pending} onClick={() => { void checkSaved() }}>Проверить сохранение</Button><Link href={routes.product(productId)} className={buttonVariants({ variant: "text" })}>Открыть объявление</Link></div>}
          {loginRequired && <Link href={`${routes.login}?next=${encodeURIComponent(routes.editProduct(productId))}`} className={buttonVariants({ variant: "secondary" })}>Войти ещё раз</Link>}
          {stage && <p role="status" className="text-sm text-muted-foreground">{stage}</p>}
          <div className="flex flex-wrap justify-end gap-3"><Button type="button" variant="secondary" disabled={pending} onClick={cancel}>{saved ? "К объявлению" : "Отмена"}</Button><Button type="submit" loading={pending} disabled={loading || lookupLoading || lookupError || !tags.length || !conditions.length}>Сохранить изменения</Button></div>
        </form>
      </>}
    </main><SiteFooter /><MobileNavigation authenticated={Boolean(session.token)} />
  </div>
}
