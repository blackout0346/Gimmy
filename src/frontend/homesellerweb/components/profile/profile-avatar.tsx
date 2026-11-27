"use client"

import { useEffect, useState } from "react"
import { UserRound } from "lucide-react"
import type { ProfileResponse } from "@/dtos/profile/profile.dto"
import { avatarProfile, ownAvatarProfile, profilePhoto, PROFILE_IMAGE_UPDATED } from "@/lib/profile-images"
import { readSession } from "@/lib/session"
import { cn } from "@/lib/utils"

export function ProfileAvatar({ userId, name = "", imageUrl, className }: { userId?: string | null; name?: string; imageUrl?: string | null; className?: string }) {
  const [profile, setProfile] = useState<ProfileResponse | null>(null)
  const [failedImage, setFailedImage] = useState<string | null>(null)
  useEffect(() => {
    let cancelled = false
    let version = 0
    setProfile(null)
    if (imageUrl !== undefined || !userId) return
    const id = userId
    function refresh() {
      const current = ++version
      void avatarProfile(id).then((result) => { if (!cancelled && current === version) setProfile(result) })
    }
    function changed(event: Event) {
      const changedId = (event as CustomEvent<unknown>).detail
      if (typeof changedId === "string" && changedId.toLowerCase() === id.toLowerCase()) refresh()
    }
    refresh()
    window.addEventListener(PROFILE_IMAGE_UPDATED, changed)
    return () => { cancelled = true; window.removeEventListener(PROFILE_IMAGE_UPDATED, changed) }
  }, [userId, imageUrl])

  const photo = imageUrl !== undefined ? imageUrl : profilePhoto(profile)
  const label = profile?.name?.trim() || name?.trim() || ""
  return (
    <span aria-hidden="true" className={cn("inline-grid size-9 shrink-0 place-items-center overflow-hidden rounded-full bg-primary-50 text-sm font-semibold text-primary", className)}>
      {photo && photo !== failedImage ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={photo} alt="" loading="lazy" decoding="async" className="size-full object-cover" onError={() => setFailedImage(photo)} />
      ) : label ? Array.from(label)[0]?.toLocaleUpperCase("ru") : <UserRound className="size-5" />}
    </span>
  )
}

export function AccountAvatar() {
  const [profile, setProfile] = useState<ProfileResponse | null>(null)
  const [name, setName] = useState("")
  useEffect(() => {
    let cancelled = false
    let version = 0
    setName(readSession().login)
    function refresh() {
      const current = ++version
      void ownAvatarProfile().then((result) => { if (!cancelled && current === version) setProfile(result) })
    }
    refresh()
    window.addEventListener(PROFILE_IMAGE_UPDATED, refresh)
    return () => { cancelled = true; window.removeEventListener(PROFILE_IMAGE_UPDATED, refresh) }
  }, [])
  return <ProfileAvatar imageUrl={profilePhoto(profile)} name={profile?.name || name} className="size-8" />
}
