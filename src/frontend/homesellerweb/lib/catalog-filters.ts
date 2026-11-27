import type { ProductFilterRequest } from "@/dtos/product/product.dto"

export type CatalogSort = NonNullable<ProductFilterRequest["sortBy"]>
export type CatalogFilters = Pick<ProductFilterRequest, "minPrice" | "maxPrice" | "conditionId" | "position" | "minRating"> & {
  sortBy: CatalogSort
  page: number
}
export type FilterDraft = {
  minPrice: string
  maxPrice: string
  conditionId: string
  position: string
  minRating: string
}
export type FilterErrors = Partial<Record<keyof FilterDraft, string>>

export const CATALOG_PAGE_SIZE = 24
export const defaultCatalogFilters: CatalogFilters = { sortBy: "newest", page: 1 }
export const catalogSortOptions: { value: CatalogSort; label: string }[] = [
  { value: "newest", label: "Сначала новые" },
  { value: "price_asc", label: "Сначала дешевле" },
  { value: "price_desc", label: "Сначала дороже" },
  { value: "rating_desc", label: "По рейтингу" },
]

function numberFromText(text: string): number | undefined {
  const normalized = text.replace(/\s/g, "").replace(",", ".")
  if (!/^\d+(?:\.\d{1,2})?$/.test(normalized)) return undefined
  const value = Number(normalized)
  return Number.isFinite(value) && value >= 0 ? value : undefined
}

export function hasCatalogFilters(filters: CatalogFilters) {
  return filters.minPrice !== undefined || filters.maxPrice !== undefined || Boolean(filters.conditionId || filters.position) || filters.minRating !== undefined
}

export function filterDraft(filters: CatalogFilters): FilterDraft {
  return {
    minPrice: filters.minPrice?.toString() ?? "",
    maxPrice: filters.maxPrice?.toString() ?? "",
    conditionId: filters.conditionId ?? "",
    position: filters.position ?? "",
    minRating: filters.minRating?.toString() ?? "",
  }
}

export function validateFilterDraft(draft: FilterDraft): { errors: FilterErrors; filters: Omit<CatalogFilters, "sortBy" | "page"> } {
  const errors: FilterErrors = {}
  const minPrice = numberFromText(draft.minPrice)
  const maxPrice = numberFromText(draft.maxPrice)
  const minRating = numberFromText(draft.minRating)
  if (draft.minPrice.trim() && minPrice === undefined) errors.minPrice = "Введите неотрицательную цену, до двух знаков после запятой."
  if (draft.maxPrice.trim() && maxPrice === undefined) errors.maxPrice = "Введите неотрицательную цену, до двух знаков после запятой."
  if (minPrice !== undefined && maxPrice !== undefined && minPrice > maxPrice) errors.maxPrice = "Максимальная цена должна быть не меньше минимальной."
  if (draft.minRating.trim() && (minRating === undefined || minRating > 5)) errors.minRating = "Введите оценку от 0 до 5."
  return {
    errors,
    filters: { minPrice, maxPrice, minRating, conditionId: draft.conditionId || undefined, position: draft.position.trim() || undefined },
  }
}

export function readCatalogLocation(params: URLSearchParams) {
  let minPrice = numberFromText(params.get("minPrice") ?? "")
  let maxPrice = numberFromText(params.get("maxPrice") ?? "")
  if (minPrice !== undefined && maxPrice !== undefined && minPrice > maxPrice) { minPrice = undefined; maxPrice = undefined }
  const rating = numberFromText(params.get("minRating") ?? "")
  const rawPage = params.get("page") ?? "1"
  const page = /^\d+$/.test(rawPage) ? Number(rawPage) : 1
  const sort = catalogSortOptions.find((option) => option.value === params.get("sortBy"))?.value ?? "newest"
  const filters: CatalogFilters = {
    minPrice, maxPrice,
    minRating: rating !== undefined && rating <= 5 ? rating : undefined,
    conditionId: params.get("conditionId")?.trim() || undefined,
    position: params.get("position")?.trim() || undefined,
    sortBy: sort,
    page: Number.isSafeInteger(page) && page > 0 && page < 2147483647 ? page : 1,
  }
  return { search: params.get("search")?.trim() ?? "", category: params.get("category") ?? "", filters }
}

export function writeCatalogLocation(params: URLSearchParams, search: string, category: string, filters: CatalogFilters) {
  const result = new URLSearchParams(params)
  const values = {
    search, category,
    minPrice: filters.minPrice?.toString(), maxPrice: filters.maxPrice?.toString(),
    conditionId: filters.conditionId, position: filters.position, minRating: filters.minRating?.toString(),
    sortBy: filters.sortBy === "newest" ? undefined : filters.sortBy,
    page: filters.page === 1 ? undefined : filters.page.toString(),
  }
  for (const [name, value] of Object.entries(values)) {
    if (value !== undefined && value !== "") result.set(name, value)
    else result.delete(name)
  }
  return result
}
