import type { ProfileResponse } from "@/dtos/profile/profile.dto"
import { profileService } from "@/services/profile.service"
import { tokenStorage } from "@/lib/http"

type CachedProfile = { expires: number; promise: Promise<ProfileResponse | null> }
const profiles = new Map<string, CachedProfile>()
let own: (CachedProfile & { token: string }) | null = null

export function profileImageUrl(value: string | null | undefined): string | null {
  if (!value?.trim()) return null
  try {
    const base = process.env.NEXT_PUBLIC_PROFILE_API_URL
    const url = base ? new URL(value.trim(), base.replace(/\/$/, "") + "/") : new URL(value.trim())
    return ["http:", "https:"].includes(url.protocol) ? url.href : null
  } catch { return null }
}
export function profilePhoto(profile: ProfileResponse | null): string | null {
  return (profile?.imageURLs ?? []).map((image) => profileImageUrl(image.imageURL)).find(Boolean) ?? null
}
export function avatarProfile(userId: string): Promise<ProfileResponse | null> {
  const key = userId.toLowerCase()
  const current = profiles.get(key)
  if (current && current.expires > Date.now()) return current.promise
  const promise: Promise<ProfileResponse | null> = profileService.getProfileByUserId(userId).catch(() => {
    if (profiles.get(key)?.promise === promise) profiles.delete(key)
    return null
  })
  profiles.set(key, { expires: Date.now() + 60000, promise })
  return promise
}
export function ownAvatarProfile(): Promise<ProfileResponse | null> {
  let token: string | null = null
  try { token = tokenStorage.get() } catch { return Promise.resolve(null) }
  if (!token) { own = null; return Promise.resolve(null) }
  if (own?.token === token && own.expires > Date.now()) return own.promise
  const promise: Promise<ProfileResponse | null> = profileService.getMyProfile().catch(() => {
    if (own?.promise === promise) own = null
    return null
  })
  own = { token, expires: Date.now() + 60000, promise }
  return promise
}
