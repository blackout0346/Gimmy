import type { Metadata } from "next"
import { FavoritesPage } from "@/components/favorites/favorites-page"

export const metadata: Metadata = { title: "Избранное" }

export default function Page() {
  return <FavoritesPage />
}
