import type { ProductsResponse } from "@/dtos/product/product.dto"

const priceFormatter = new Intl.NumberFormat("ru-RU", {
  style: "currency",
  currency: "RUB",
  maximumFractionDigits: 0,
})

const dateFormatter = new Intl.DateTimeFormat("ru-RU", {
  day: "numeric",
  month: "long",
})

export function formatProductPrice(price: number) {
  return Number.isFinite(price) && price > 0
    ? priceFormatter.format(price)
    : "Цена договорная"
}

export function productTimestamp(product: ProductsResponse) {
  const time = Date.parse(product.createAt)
  return Number.isFinite(time) ? time : 0
}

export function formatProductDate(value: string) {
  const date = new Date(value)
  return Number.isFinite(date.getTime()) ? dateFormatter.format(date) : ""
}

export function productImageUrl(value: string | null | undefined) {
  if (!value?.trim()) return null

  try {
    const base = process.env.NEXT_PUBLIC_PRODUCT_API_URL
    const url = base ? new URL(value.trim(), base.replace(/\/$/, "") + "/") : new URL(value.trim())
    return ["http:", "https:"].includes(url.protocol) ? url.href : null
  } catch {
    return null
  }
}

export function productCategories(products: ProductsResponse[]) {
  return [...new Set(products.flatMap((product) => product.tags ?? []).map((tag) => tag.trim()).filter(Boolean))]
    .sort((a, b) => a.localeCompare(b, "ru"))
}
