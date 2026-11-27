"use client"

import { useEffect, useState } from "react"
import { UserRound } from "lucide-react"
import type { ProfileResponse } from "@/dtos/profile/profile.dto"
import { avatarProfile, ownAvatarProfile, profilePhoto } from "@/lib/profile-images"
import { readSession } from "@/lib/session"
import { cn } from "@/lib/utils"

export function ProfileAvatar({ userId, name = "", imageUrl, className }: { userId?: string | null; name?: string; imageUrl?: string | null; className?: string }) {
  const [profile, setProfile] = useState<ProfileResponse | null>(null)
  const [failedImage, setFailedImage] = useState<string | null>(null)
  useEffect(() => {
    let cancelled = false
    setProfile(null)
    if (imageUrl !== undefined || !userId) return
    void avatarProfile(userId).then((result) => { if (!cancelled) setProfile(result) })
    return () => { cancelled = true }
  }, [userId, imageUrl])
  const photo = imageUrl !== undefined ? imageUrl : profilePhoto(profile)
  const label = profile?.name?.trim() || name.trim()
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
    setName(readSession().login)
    void ownAvatarProfile().then((result) => { if (!cancelled) setProfile(result) })
    return () => { cancelled = true }
  }, [])
  return <ProfileAvatar imageUrl={profilePhoto(profile)} name={profile?.name || name} className="size-8" />
}
