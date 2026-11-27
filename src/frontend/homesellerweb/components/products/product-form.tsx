"use client"

import Link from "next/link"
import { useRouter } from "next/navigation"
import { useEffect, useRef, useState, type FormEvent } from "react"
import type { ConditionResponse, ProductsRequest, TagResponse } from "@/dtos/product/product.dto"
import { productService } from "@/services/product.service"
import { attachProductToProfile } from "@/services/profile-products"
import { ApiError } from "@/lib/http"
import { readSession, type Session } from "@/lib/session"
import { draftOwner, emptyPublicationValues, hasPublicationValues, readPublicationDraft, savePublicationDraft, removePublicationDraft, type PublicationValues } from "@/lib/drafts"
import { readPublicationPhotos, savePublicationPhotos, removePublicationPhotos } from "@/lib/publication-photos"
import { routes } from "@/lib/routes"
import { Button, buttonVariants } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Select } from "@/components/ui/select"
import { Radio } from "@/components/ui/selection-controls"
import { Field, FieldDescription, FieldError, FieldLabel } from "@/components/ui/field"
import { Breadcrumbs } from "@/components/ui/breadcrumbs"
import { EmptyState } from "@/components/ui/empty-state"
import { SiteHeader } from "@/components/layout/site-header"
import { SiteFooter } from "@/components/layout/site-footer"
import { MobileNavigation } from "@/components/layout/mobile-navigation"
import { ProductPhotoPicker, type ProductPhotoDraft } from "./product-photo-picker"

type FormValues = PublicationValues

type FieldErrors = Partial<Record<keyof FormValues, string>>

const serverFieldNames: Record<string, keyof FormValues> = {
  nameproduct: "nameProduct",
  description: "description",
  price: "price",
  position: "position",
  tagids: "tagId",
  conditionid: "conditionId",
}

export function ProductForm() {
  const router = useRouter()
  const [session, setSession] = useState<Session>({ token: null, userId: null, login: "" })
  const [ready, setReady] = useState(false)
  const [tags, setTags] = useState<TagResponse[]>([])
  const [conditions, setConditions] = useState<ConditionResponse[]>([])
  const [lookupLoading, setLookupLoading] = useState(true)
  const [lookupError, setLookupError] = useState(false)
  const [lookupRetry, setLookupRetry] = useState(0)
  const [values, setValues] = useState<FormValues>(emptyPublicationValues)
  const [draftReady, setDraftReady] = useState(false)
  const [draftNotice, setDraftNotice] = useState("")
  const [textDraftError, setTextDraftError] = useState(false)
  const [photoDraftError, setPhotoDraftError] = useState(false)
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({})
  const [photos, setPhotos] = useState<ProductPhotoDraft[]>([])
  const [photoError, setPhotoError] = useState("")
  const [error, setError] = useState("")
  const [loginRequired, setLoginRequired] = useState(false)
  const [checkPublication, setCheckPublication] = useState<string | null>(null)
  const [pending, setPending] = useState(false)
  const [stage, setStage] = useState("")
  const [createdId, setCreatedId] = useState<string | null>(null)
  const photoRef = useRef<ProductPhotoDraft[]>([])
  const ownerRef = useRef<string | null>(null)
  const valuesRef = useRef<FormValues>(emptyPublicationValues)
  const createdRef = useRef<string | null>(null)
  const checkRef = useRef<string | null>(null)
  const draftReadyRef = useRef(false)
  const draftClosed = useRef(false)
  const textSaveFailed = useRef(false)
  const photoSaveFailed = useRef(false)
  const photoSavePending = useRef(false)
  const photoVersion = useRef(0)
  const expectedPhotoCount = useRef(0)
  const photoRecoveryNeeded = useRef(false)
  const restoreEpoch = useRef(0)
  const submitLock = useRef(false)
  const mounted = useRef(false)
  const formRef = useRef<HTMLFormElement>(null)
  const errorRef = useRef<HTMLParagraphElement>(null)

  function persistDraft(next = valuesRef.current, createdId = createdRef.current) {
    const owner = ownerRef.current
    if (!draftReadyRef.current || draftClosed.current) return true
    const saved = owner
      ? savePublicationDraft(owner, { values: next, createdId, photoCount: photoRecoveryNeeded.current ? expectedPhotoCount.current : photoRef.current.length, checkPublication: checkRef.current })
      : !hasPublicationValues(next) && photoRef.current.length === 0
    textSaveFailed.current = !saved
    if (mounted.current) setTextDraftError(!saved)
    return saved
  }

  function updateCheckPublication(value: string | null) {
    checkRef.current = value
    setCheckPublication(value)
    persistDraft()
  }

  useEffect(() => {
    mounted.current = true
    const epoch = ++restoreEpoch.current
    const active = () => mounted.current && epoch === restoreEpoch.current
    draftReadyRef.current = false
    setDraftReady(false)
    const current = readSession()
    const owner = draftOwner(current)
    ownerRef.current = owner
    setSession(current)
    setReady(true)
    async function restore() {
      if (owner) {
        const { draft, available } = readPublicationDraft(owner)
        textSaveFailed.current = !available
        if (draft) {
          expectedPhotoCount.current = draft.photoCount
          valuesRef.current = draft.values
          createdRef.current = draft.createdId
          checkRef.current = draft.checkPublication
          setValues(draft.values)
          setCreatedId(draft.createdId)
          setCheckPublication(draft.checkPublication)
          submitLock.current = Boolean(draft.createdId)
          setDraftNotice(draft.createdId ? "Это объявление уже опубликовано. Можно открыть его или завершить добавление в профиль." : "Черновик восстановлен.")
          if (draft.photoCount > 0) {
            try {
              const saved = await readPublicationPhotos(owner)
              if (!active()) return
              updatePhotos(saved.map((photo) => ({ ...photo, previewUrl: URL.createObjectURL(photo.file) })))
              if (saved.length !== draft.photoCount) { photoRecoveryNeeded.current = true; photoSaveFailed.current = true; setPhotoDraftError(true) }
            } catch {
              if (!active()) return
              photoRecoveryNeeded.current = true
              photoSaveFailed.current = true
              setPhotoDraftError(true)
            }
          }
        }
      }
      if (active()) { draftReadyRef.current = true; setDraftReady(true) }
    }
    void restore()
    function beforeUnload(event: BeforeUnloadEvent) {
      if (draftClosed.current) return
      const textSaved = persistDraft()
      const hasContent = hasPublicationValues(valuesRef.current) || photoRef.current.length > 0
      if ((submitLock.current && !createdRef.current) || (hasContent && (!textSaved || photoSavePending.current || photoSaveFailed.current))) {
        event.preventDefault()
        event.returnValue = ""
      }
    }
    window.addEventListener("beforeunload", beforeUnload)
    return () => {
      persistDraft()
      mounted.current = false
      restoreEpoch.current += 1
      photoVersion.current += 1
      window.removeEventListener("beforeunload", beforeUnload)
      photoRef.current.forEach((photo) => URL.revokeObjectURL(photo.previewUrl))
    }
  }, [])

  useEffect(() => { if (draftReady) persistDraft() }, [values, photos, createdId, checkPublication, draftReady])

  useEffect(() => {
    const owner = ownerRef.current
    if (!owner || !draftReady || draftClosed.current || photoRecoveryNeeded.current || (!photos.length && !photoSavePending.current)) return
    const version = ++photoVersion.current
    photoSavePending.current = true
    void savePublicationPhotos(owner, photos)
      .then(() => {
        if (mounted.current && version === photoVersion.current) { photoSaveFailed.current = false; setPhotoDraftError(false) }
      })
      .catch(() => {
        if (mounted.current && version === photoVersion.current) { photoSaveFailed.current = true; setPhotoDraftError(true) }
      })
      .finally(() => { if (version === photoVersion.current) photoSavePending.current = false })
  }, [photos, draftReady])

  useEffect(() => {
    if (!session.token) return
    let cancelled = false
    setLookupLoading(true)
    setLookupError(false)

    async function load() {
      const [tagResult, conditionResult] = await Promise.allSettled([
        productService.getTags(),
        productService.getConditions(),
      ])
      if (cancelled) return

      let failed = false
      if (tagResult.status === "fulfilled" && Array.isArray(tagResult.value)) {
        setTags(tagResult.value.filter((tag) => tag.id && tag.name?.trim()).sort((a, b) => a.name.localeCompare(b.name, "ru")))
      } else {
        failed = true
      }
      if (conditionResult.status === "fulfilled" && Array.isArray(conditionResult.value)) {
        setConditions(conditionResult.value.filter((condition) => condition.id && condition.name?.trim()))
      } else {
        failed = true
      }
      setLookupError(failed)
      setLookupLoading(false)
    }

    void load()
    return () => { cancelled = true }
  }, [session.token, lookupRetry])

  useEffect(() => {
    if (error || photoError) errorRef.current?.focus()
  }, [error, photoError])

  function updateField(name: keyof FormValues, value: string) {
    const next = { ...valuesRef.current, [name]: value }
    valuesRef.current = next
    setValues(next)
    persistDraft(next)
    setFieldErrors((current) => ({ ...current, [name]: undefined }))
    setError("")
  }

  function updatePhotos(next: ProductPhotoDraft[]) {
    if (draftReadyRef.current) photoRecoveryNeeded.current = false
    photoRef.current = next
    setPhotos(next)
    persistDraft()
    if (draftReadyRef.current && ownerRef.current) {
      photoVersion.current += 1
      photoSavePending.current = true
    }
  }

  function addPhotos(files: File[]) {
    if (submitLock.current) return
    const next = [...photoRef.current]
    let invalid = false
    for (const file of files) {
      const image = file.type.startsWith("image/") || (!file.type && /\.(jpe?g|png|webp|gif|avif|bmp|heic|heif)$/i.test(file.name))
      if (!image) {
        invalid = true
        continue
      }
      const duplicate = next.some((photo) => photo.file.name === file.name && photo.file.size === file.size && photo.file.lastModified === file.lastModified)
      if (!duplicate) next.push({ file, previewUrl: URL.createObjectURL(file) })
    }
    updatePhotos(next)
    setPhotoError(invalid ? "Выберите файлы изображений." : "")
  }

  function removePhoto(previewUrl: string) {
    if (submitLock.current) return
    URL.revokeObjectURL(previewUrl)
    updatePhotos(photoRef.current.filter((photo) => photo.previewUrl !== previewUrl))
  }

  function chooseCover(previewUrl: string) {
    if (submitLock.current) return
    const photo = photoRef.current.find((item) => item.previewUrl === previewUrl)
    if (photo) updatePhotos([photo, ...photoRef.current.filter((item) => item !== photo)])
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (submitLock.current || createdId || lookupLoading || !draftReady) return
    if (!session.token) { setLoginRequired(true); return }

    const price = values.price.trim() ? Number(values.price.replace(/\s/g, "").replace(",", ".")) : 0
    const errors: FieldErrors = {}
    if (!values.nameProduct.trim()) errors.nameProduct = "Введите название объявления."
    if (!tags.some((tag) => tag.id === values.tagId)) errors.tagId = "Выберите категорию."
    if (!conditions.some((condition) => condition.id === values.conditionId)) errors.conditionId = "Выберите состояние товара."
    if (!values.position.trim()) errors.position = "Укажите город или населённый пункт."
    if (!Number.isFinite(price) || price < 0) errors.price = "Введите неотрицательную цену числом."

    setFieldErrors(errors)
    setError("")
    if (Object.keys(errors).length) {
      const firstField = Object.keys(errors)[0]
      formRef.current?.querySelector<HTMLElement>(`[data-field="${firstField}"]`)?.focus()
      return
    }

    submitLock.current = true
    setPending(true)
    setPhotoError("")
    setLoginRequired(false)
    updateCheckPublication(null)
    let publishing = false
    let completed = false
    try {
      for (const photo of photoRef.current) {
        if (photo.uploadedUrl) continue
        setStage("Загружаем фотографии…")
        const urls = await productService.uploadImages([photo.file])
        if (!mounted.current) return
        if (!urls[0]?.trim()) throw new Error("Upload did not return an image URL")
        updatePhotos(photoRef.current.map((item) => item === photo ? { ...item, uploadedUrl: urls[0] } : item))
      }
      if (!mounted.current) return

      const imageURLs = photoRef.current
        .map((photo) => photo.uploadedUrl)
        .filter((url): url is string => Boolean(url))
      if (imageURLs.length !== photoRef.current.length) throw new Error("Some images are not uploaded")

      const request: ProductsRequest = {
        nameProduct: values.nameProduct.trim(),
        description: values.description.trim(),
        price,
        conditionId: values.conditionId,
        position: values.position.trim(),
        tagIds: [values.tagId],
        imageURLs,
      }
      publishing = true
      updateCheckPublication(values.nameProduct.trim())
      setStage("Публикуем объявление…")
      const result = await productService.createProduct(request)
      if (result?.id) {
        completed = true
        createdRef.current = result.id
        checkRef.current = null
        persistDraft(valuesRef.current, result.id)
      }
      if (!mounted.current) return
      if (!result?.id) {
        setError("Ответ сервера не содержит номер объявления. Проверьте, появилось ли оно в каталоге.")
        updateCheckPublication(values.nameProduct.trim())
        return
      }
      setCreatedId(result.id)
      setCheckPublication(null)
      setStage("Добавляем объявление в профиль…")
      try {
        await attachProductToProfile(result.id)
      } catch {
        if (mounted.current) setError("Объявление опубликовано, но добавить его в профиль не удалось. Откройте профиль, чтобы завершить этот шаг.")
        return
      }
      if (!mounted.current) return
      draftClosed.current = true
      if (ownerRef.current) {
        removePublicationDraft(ownerRef.current)
        void removePublicationPhotos(ownerRef.current).catch(() => {})
      }
      router.push(routes.product(result.id))
    } catch (failure) {
      if (!mounted.current) return
      updateCheckPublication(publishing ? values.nameProduct.trim() : null)
      if (failure instanceof ApiError) {
        const mappedErrors: FieldErrors = {}
        for (const [key, messages] of Object.entries(failure.fieldErrors ?? {})) {
          const field = serverFieldNames[key.split(".").at(-1)?.toLowerCase() ?? ""]
          if (field && messages.length) mappedErrors[field] = messages.join(" ")
        }
        setFieldErrors(mappedErrors)
        setLoginRequired(failure.status === 401)
        setError(failure.status >= 400 && failure.status < 500
          ? failure.message
          : "Не удалось завершить публикацию. Проверьте соединение.")
      } else {
        setError(publishing ? "Не удалось завершить публикацию. Проверьте соединение." : "Не удалось загрузить фотографии. Попробуйте ещё раз.")
      }
    } finally {
      submitLock.current = completed
      if (mounted.current) { setPending(false); setStage("") }
    }
  }

  function startNew() {
    if (pending) return
    draftClosed.current = false
    submitLock.current = false
    createdRef.current = null
    checkRef.current = null
    valuesRef.current = emptyPublicationValues
    setValues(emptyPublicationValues)
    setCreatedId(null)
    setCheckPublication(null)
    photoRef.current.forEach((photo) => URL.revokeObjectURL(photo.previewUrl))
    updatePhotos([])
    setError("")
    setFieldErrors({})
    setPhotoError("")
    setDraftNotice("")
    persistDraft(emptyPublicationValues, null)
  }

  return (
    <div className="flex min-h-dvh flex-col bg-background pb-[calc(64px_+_env(safe-area-inset-bottom))] text-foreground md:pb-0">
      <SiteHeader authenticated={Boolean(session.token)} />
      <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-6 md:px-6 md:py-8">
        {!ready ? <p role="status">Загрузка…</p> : !session.token ? (
          <EmptyState title="Войдите, чтобы подать объявление">
            <Link href={`${routes.login}?next=${encodeURIComponent(routes.create)}`} className={buttonVariants()}>Войти</Link>
          </EmptyState>
        ) : (
          <>
            <Breadcrumbs className="mb-6" items={[{ label: "Главная", href: routes.home }, { label: "Подать объявление" }]} />
            <h1 className="text-2xl/8 font-bold">Новое объявление</h1>
            {!draftReady && <p role="status" className="mt-3 text-sm text-muted-foreground">Восстанавливаем черновик…</p>}
            {draftNotice && <p role="status" className="mt-3 text-sm text-primary">{draftNotice}</p>}
            {(textDraftError || photoDraftError) && <p role="status" className="mt-3 text-sm/5 text-muted-foreground">{photoDraftError ? "Фотографии черновика не удалось сохранить или восстановить. При необходимости выберите их заново." : "Не удалось сохранить черновик в браузере. Сохраните введённый текст перед уходом со страницы."}</p>}
            <form ref={formRef} onSubmit={submit} noValidate aria-busy={pending} className="mt-6 space-y-6">
              <fieldset disabled={pending || Boolean(createdId) || !draftReady} className="min-w-0 space-y-6">
                <section className="space-y-6 rounded-[12px] border border-border bg-card p-4 md:p-6">
                  <h2 className="text-lg/6 font-semibold">Основное</h2>
                  <Field data-invalid={Boolean(fieldErrors.nameProduct)}>
                    <FieldLabel htmlFor="product-name">Название</FieldLabel>
                    <Input id="product-name" name="nameProduct" data-field="nameProduct" required value={values.nameProduct} onChange={(event) => updateField("nameProduct", event.target.value)} aria-invalid={Boolean(fieldErrors.nameProduct)} aria-describedby={fieldErrors.nameProduct ? "name-error" : undefined} />
                    {fieldErrors.nameProduct && <FieldError id="name-error">{fieldErrors.nameProduct}</FieldError>}
                  </Field>
                  {lookupLoading && <p role="status" className="text-sm text-muted-foreground">Загружаем категории и состояния…</p>}
                  {lookupError && <div role="alert" className="text-sm text-destructive">Не удалось загрузить справочники. <Button type="button" variant="text" size="sm" onClick={() => setLookupRetry((value) => value + 1)}>Повторить</Button></div>}
                  {!lookupLoading && !lookupError && (!tags.length || !conditions.length) && <p role="status" className="text-sm text-muted-foreground">Справочники категорий или состояний пока пусты.</p>}
                  <div className="grid items-start gap-6 sm:grid-cols-2">
                    <Field data-invalid={Boolean(fieldErrors.tagId)}>
                      <FieldLabel htmlFor="product-category">Категория</FieldLabel>
                      <Select id="product-category" name="tagId" data-field="tagId" required value={values.tagId} disabled={lookupLoading || !tags.length} onChange={(event) => updateField("tagId", event.target.value)} aria-invalid={Boolean(fieldErrors.tagId)} aria-describedby={fieldErrors.tagId ? "category-error" : undefined}>
                        <option value="" disabled>Выберите категорию</option>
                        {tags.map((tag) => <option key={tag.id} value={tag.id}>{tag.name}</option>)}
                      </Select>
                      {fieldErrors.tagId && <FieldError id="category-error">{fieldErrors.tagId}</FieldError>}
                    </Field>
                    <Field data-invalid={Boolean(fieldErrors.price)}>
                      <FieldLabel htmlFor="product-price">Цена, ₽</FieldLabel>
                      <Input id="product-price" name="price" data-field="price" inputMode="decimal" placeholder="Например, 24 000" value={values.price} onChange={(event) => updateField("price", event.target.value)} aria-invalid={Boolean(fieldErrors.price)} aria-describedby={fieldErrors.price ? "price-error" : "price-hint"} />
                      {fieldErrors.price ? <FieldError id="price-error">{fieldErrors.price}</FieldError> : <FieldDescription id="price-hint">Оставьте пустым, если цена договорная.</FieldDescription>}
                    </Field>
                  </div>
                  <fieldset disabled={lookupLoading || !conditions.length} aria-describedby={fieldErrors.conditionId ? "condition-error" : undefined}>
                    <legend className="mb-2 text-sm/5 font-medium">Состояние</legend>
                    <div className="flex flex-wrap gap-x-6 gap-y-1">
                      {conditions.map((condition) => (
                        <Radio key={condition.id} name="conditionId" data-field="conditionId" value={condition.id} required checked={values.conditionId === condition.id} onChange={() => updateField("conditionId", condition.id)} aria-invalid={Boolean(fieldErrors.conditionId)}>
                          {condition.name}
                        </Radio>
                      ))}
                    </div>
                    {fieldErrors.conditionId && <FieldError id="condition-error">{fieldErrors.conditionId}</FieldError>}
                  </fieldset>
                  <Field>
                    <FieldLabel htmlFor="product-description">Описание</FieldLabel>
                    <Textarea id="product-description" name="description" data-field="description" value={values.description} onChange={(event) => updateField("description", event.target.value)} aria-invalid={Boolean(fieldErrors.description)} aria-describedby={fieldErrors.description ? "description-error" : undefined} />
                    {fieldErrors.description && <FieldError id="description-error">{fieldErrors.description}</FieldError>}
                  </Field>
                </section>
                <section className="space-y-4 rounded-[12px] border border-border bg-card p-4 md:p-6">
                  <h2 className="text-lg/6 font-semibold">Фотографии</h2>
                  <ProductPhotoPicker photos={photos} disabled={pending || Boolean(createdId) || !draftReady} onAdd={addPhotos} onRemove={removePhoto} onCover={chooseCover} />
                </section>
                <section className="rounded-[12px] border border-border bg-card p-4 md:p-6">
                  <Field data-invalid={Boolean(fieldErrors.position)}>
                    <FieldLabel htmlFor="product-position">Город или населённый пункт</FieldLabel>
                    <Input id="product-position" name="position" data-field="position" required value={values.position} onChange={(event) => updateField("position", event.target.value)} aria-invalid={Boolean(fieldErrors.position)} aria-describedby={fieldErrors.position ? "position-error" : undefined} />
                    {fieldErrors.position && <FieldError id="position-error">{fieldErrors.position}</FieldError>}
                  </Field>
                </section>
              </fieldset>
              {(error || photoError) && <p ref={errorRef} role="alert" tabIndex={-1} className="text-sm/5 text-destructive outline-none">{error || photoError}</p>}
              {checkPublication && <p className="text-sm/5 text-muted-foreground">Перед повторной отправкой <Link href={`${routes.home}?search=${encodeURIComponent(checkPublication)}`} className="text-primary underline">проверьте объявление в каталоге</Link>.</p>}
              {loginRequired && <Link href={`${routes.login}?next=${encodeURIComponent(routes.create)}`} className={buttonVariants({ variant: "secondary" })}>Войти ещё раз</Link>}
              {stage && <p role="status" className="text-sm text-muted-foreground">{stage}</p>}
              <div className="flex flex-wrap justify-end gap-3">
                {createdId ? (
                  <>
                    <Button type="button" variant="text" disabled={pending} onClick={startNew}>Создать ещё объявление</Button>
                    <Link href={`${routes.profile}?productId=${encodeURIComponent(createdId)}`} className={buttonVariants({ variant: "secondary" })}>Открыть профиль</Link>
                    <Link href={routes.product(createdId)} className={buttonVariants()}>Открыть объявление</Link>
                  </>
                ) : (
                  <Button type="submit" loading={pending} disabled={!draftReady || lookupLoading || !tags.length || !conditions.length}>Опубликовать</Button>
                )}
              </div>
            </form>
          </>
        )}
      </main>
      <SiteFooter />
      <MobileNavigation authenticated={Boolean(session.token)} active="create" />
    </div>
  )
}
