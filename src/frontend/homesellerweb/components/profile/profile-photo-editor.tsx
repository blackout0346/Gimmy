"use client"

import { useEffect, useRef, useState, type ChangeEvent } from "react"
import type { ProfileResponse } from "@/dtos/profile/profile.dto"
import { profileService } from "@/services/profile.service"
import { ApiError, tokenStorage } from "@/lib/http"
import { profileImageUrl, profilePhoto, publishAvatarProfile } from "@/lib/profile-images"
import { Button } from "@/components/ui/button"
import { ProfileAvatar } from "./profile-avatar"

type Replacement = { keepId: string | null; removeIds: string[] }
type ProfilePhotoEditorProps = {
  profile: ProfileResponse
  disabled: boolean
  onChange: (profile: ProfileResponse) => void
  onBusyChange: (busy: boolean) => void
  onUnauthorized: () => void
}

export function ProfilePhotoEditor({ profile, disabled, onChange, onBusyChange, onUnauthorized }: ProfilePhotoEditorProps) {
  const [file, setFile] = useState<File | null>(null)
  const [preview, setPreview] = useState<string | null>(null)
  const [pending, setPending] = useState(false)
  const [error, setError] = useState("")
  const [notice, setNotice] = useState("")
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [replacement, setReplacement] = useState<Replacement | null>(null)
  const [checkRequired, setCheckRequired] = useState(false)
  const mounted = useRef(false)
  const lock = useRef(false)
  const images = profile.imageURLs ?? []

  useEffect(() => { mounted.current = true; return () => { mounted.current = false } }, [])
  useEffect(() => {
    if (!file) { setPreview(null); return }
    const url = URL.createObjectURL(file)
    setPreview(url)
    return () => URL.revokeObjectURL(url)
  }, [file])

  function currentToken() {
    const token = tokenStorage.get()
    if (!token) throw new ApiError(401, "Войдите в аккаунт ещё раз.")
    return token
  }
  function checkSession(token: string) {
    if (tokenStorage.get() !== token) throw new Error("Аккаунт изменился. Обновите страницу профиля.")
  }
  async function ownedProfile(token: string) {
    checkSession(token)
    const result = await profileService.getMyProfile()
    checkSession(token)
    if (!result || result.userId.toLowerCase() !== profile.userId.toLowerCase()) throw new Error("Не удалось подтвердить профиль. Обновите страницу.")
    return result
  }
  function commit(result: ProfileResponse) {
    publishAvatarProfile(result)
    if (mounted.current) onChange(result)
  }
  function showError(failure: unknown, fallback: string) {
    if (!mounted.current) return
    if (failure instanceof ApiError && failure.status === 401) onUnauthorized()
    else setError(failure instanceof ApiError && failure.status >= 400 && failure.status < 500 ? failure.message : failure instanceof Error && failure.message.includes("Аккаунт изменился") ? failure.message : fallback)
  }
  async function run(work: (token: string) => Promise<void>) {
    if (lock.current || disabled) return
    lock.current = true
    setPending(true)
    onBusyChange(true)
    setError("")
    setNotice("")
    try { await work(currentToken()) }
    catch (failure) { showError(failure, "Не удалось обновить фото. Попробуйте ещё раз.") }
    finally {
      lock.current = false
      if (mounted.current) { setPending(false); onBusyChange(false) }
    }
  }

  async function finish(operation: Replacement, token: string) {
    if (mounted.current) { setReplacement(operation); setConfirmDelete(false) }
    for (const id of operation.removeIds) {
      checkSession(token)
      try { await profileService.deleteMyProfileImage(id) }
      catch { /* Verify the remaining images after the mutations. */ }
    }
    const result = await ownedProfile(token)
    commit(result)
    const currentIds = new Set((result.imageURLs ?? []).map((image) => image.id))
    const remaining = operation.removeIds.filter((id) => currentIds.has(id))
    if (!mounted.current) return
    if (remaining.length) {
      setReplacement({ ...operation, removeIds: remaining })
      setError("Фото загружено или изменено, но удалить прежние фотографии удалось не полностью. Завершите обновление.")
      return
    }
    setReplacement(null)
    setCheckRequired(false)
    setFile(null)
    setConfirmDelete(false)
    setNotice(operation.keepId && !currentIds.has(operation.keepId) ? "Фото изменилось на сервере. Проверьте список фотографий." : "Фото профиля обновлено.")
  }

  async function save() {
    if (!file || replacement || checkRequired) return
    await run(async (token) => {
      const current = await ownedProfile(token)
      const oldIds = new Set((current.imageURLs ?? []).map((image) => image.id))
      checkSession(token)
      try { await profileService.addImageToMyProfile(file) }
      catch (failure) {
        if (mounted.current) setCheckRequired(true)
        try { commit(await ownedProfile(token)) } catch { /* Keep the selected file for review. */ }
        showError(failure, "Не удалось подтвердить загрузку. Обновите фотографии и проверьте результат перед повторной отправкой.")
        return
      }
      if (mounted.current) setCheckRequired(true)
      const updated = await ownedProfile(token)
      const added = (updated.imageURLs ?? []).filter((image) => !oldIds.has(image.id) && profileImageUrl(image.imageURL))
      if (added.length !== 1) {
        commit(updated)
        if (mounted.current) setError("Не удалось однозначно определить загруженное фото. Обновите список и выберите фотографию, которую хотите оставить.")
        return
      }
      const uploaded = added[0]
      if (!uploaded) return
      await finish({ keepId: uploaded.id, removeIds: [...oldIds] }, token)
    })
  }

  function choose(event: ChangeEvent<HTMLInputElement>) {
    const selected = event.target.files?.[0]
    event.target.value = ""
    if (!selected || lock.current || disabled) return
    if (!(selected.type.startsWith("image/") || (!selected.type && /\.(jpe?g|png|webp|gif|avif|heic|heif)$/i.test(selected.name)))) { setError("Выберите файл изображения."); return }
    setFile(selected)
    setCheckRequired(false)
    setError("")
    setNotice("")
  }

  return (
    <section aria-labelledby="profile-photo-title" className="rounded-[12px] border border-border bg-card p-4 md:p-6">
      <h2 id="profile-photo-title" className="text-lg/6 font-semibold">Фото профиля</h2>
      <div className="mt-4 flex flex-wrap items-center gap-4">
        <ProfileAvatar imageUrl={preview || profilePhoto(profile)} name={profile.name || ""} className="size-20 text-2xl" />
        <div className="min-w-0 flex-1 space-y-2">
          <label className="block text-sm/5 font-medium" htmlFor="profile-photo-file">{file ? "Выбрано новое фото" : "Загрузить фотографию"}</label>
          <input id="profile-photo-file" type="file" accept="image/*" disabled={disabled || pending || replacement !== null} onChange={choose} className="block min-h-11 w-full min-w-0 rounded-[10px] text-sm text-muted-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring file:mr-3 file:cursor-pointer file:rounded-[10px] file:border-0 file:bg-primary-50 file:px-3 file:py-3 file:text-sm file:font-semibold file:text-primary file:transition-colors motion-reduce:file:transition-none enabled:hover:file:bg-primary enabled:hover:file:text-primary-foreground enabled:active:file:bg-primary-800 enabled:active:file:text-primary-foreground disabled:cursor-wait disabled:file:cursor-wait" />
          {file && <p className="break-all text-xs/5 text-muted-foreground">{file.name}</p>}
        </div>
      </div>
      {file && <p className="mt-3 text-xs/5 text-muted-foreground">После сохранения выбранная фотография заменит прежние фото профиля.</p>}
      {error && <p role="alert" className="mt-3 text-sm/5 text-destructive">{error}</p>}
      {notice && <p role="status" className="mt-3 text-sm/5 text-primary">{notice}</p>}
      <div className="mt-4 flex flex-wrap gap-2">
        {replacement ? <Button type="button" loading={pending} disabled={disabled} onClick={() => { void run((token) => finish(replacement, token)) }}>Завершить обновление</Button> : file && !checkRequired ? <Button type="button" loading={pending} disabled={disabled} onClick={() => { void save() }}>Сохранить фото</Button> : null}
        {(checkRequired || images.length > 1) && <Button type="button" variant="secondary" disabled={disabled || pending} onClick={() => { void run(async (token) => { commit(await ownedProfile(token)); if (mounted.current) setNotice("Фотографии обновлены. Выберите фото, которое хотите оставить.") }) }}>Обновить фотографии</Button>}
        {file && !replacement && <Button type="button" variant="text" disabled={disabled || pending} onClick={() => { setFile(null); setCheckRequired(false); setError("") }}>Отменить выбор</Button>}
        {images.length > 0 && !file && !replacement && <Button type="button" variant="text" disabled={disabled || pending} onClick={() => setConfirmDelete(true)}>Удалить фото</Button>}
      </div>
      {confirmDelete && <div className="mt-4 space-y-3 border-t border-border pt-4">
        <p className="text-sm/5">Удалить фотографии профиля? Вместо фото будет показана буква имени.</p>
        <div className="flex flex-wrap gap-2">
          <Button type="button" variant="danger" disabled={disabled || pending} onClick={() => { void run(async (token) => { const current = await ownedProfile(token); await finish({ keepId: null, removeIds: (current.imageURLs ?? []).map((image) => image.id) }, token) }) }}>Удалить</Button>
          <Button type="button" variant="secondary" disabled={disabled || pending} onClick={() => setConfirmDelete(false)}>Отмена</Button>
        </div>
      </div>}
      {images.length > 1 && <div className="mt-4 border-t border-border pt-4">
        <p className="mb-3 text-xs/5 text-muted-foreground">Выберите, какое фото оставить. Остальные фотографии профиля будут удалены.</p>
        <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          {images.map((image) => <li key={image.id} className="min-w-0 space-y-2">
            <ProfileAvatar imageUrl={profileImageUrl(image.imageURL)} name={profile.name || ""} className="size-16" />
            <Button type="button" size="sm" variant="secondary" className="h-auto min-h-11 w-full px-2 py-2" disabled={disabled || pending || replacement !== null} onClick={() => { void run(async (token) => { const current = await ownedProfile(token); if (!(current.imageURLs ?? []).some((item) => item.id === image.id)) throw new Error("Фото больше недоступно"); await finish({ keepId: image.id, removeIds: (current.imageURLs ?? []).filter((item) => item.id !== image.id).map((item) => item.id) }, token) }) }}><span className="whitespace-normal">Оставить это фото</span></Button>
          </li>)}
        </ul>
      </div>}
    </section>
  )
}
