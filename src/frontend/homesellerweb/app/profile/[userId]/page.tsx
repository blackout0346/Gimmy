import type { Metadata } from "next"
import { PublicProfilePage } from "@/components/profile/public-profile-page"

export const metadata: Metadata = { title: "Профиль пользователя" }
export default async function Page({ params }: { params: Promise<{ userId: string }> }) {
  const { userId } = await params
  return <PublicProfilePage key={userId} userId={userId} />
}
