import type { ProfileResponse } from "@/dtos/profile/profile.dto"
import { profileService } from "@/services/profile.service"
import { productService } from "@/services/product.service"

function containsProduct(profile: ProfileResponse | null, productId: string) {
  return Boolean(profile?.productUsers?.some((item) => item.productId.toLowerCase() === productId.toLowerCase()))
}

// Uses the existing Profile API to connect a published product to its owner.
export async function attachProductToProfile(productId: string, signal?: AbortSignal): Promise<ProfileResponse> {
  const profile = await profileService.getMyProfile()
  signal?.throwIfAborted()
  if (!profile) throw new Error("Сначала заполните профиль продавца.")
  if (containsProduct(profile, productId)) return profile

  const product = await productService.getProductById(productId)
  signal?.throwIfAborted()
  if (product.userId.toLowerCase() !== profile.userId.toLowerCase()) {
    throw new Error("Можно добавить только своё объявление.")
  }

  try {
    await profileService.addProductToMyProfile(productId)
  } catch (error) {
    signal?.throwIfAborted()
    // A concurrent event handler may already have created the same association.
    const latest = await profileService.getMyProfile()
    if (latest && containsProduct(latest, productId)) return latest
    throw error
  }

  const latest = await profileService.getMyProfile()
  if (!latest || !containsProduct(latest, productId)) {
    throw new Error("Не удалось подтвердить добавление объявления в профиль.")
  }
  return latest
}
