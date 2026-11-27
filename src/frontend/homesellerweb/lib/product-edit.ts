import type { ProductsRequest, ProductsResponse, TagResponse } from "@/dtos/product/product.dto"
import type { PublicationValues } from "@/lib/drafts"

const normalize = (value: string) => value.trim().toLocaleLowerCase("ru")
export function resolveProductTags(product: ProductsResponse, tags: TagResponse[]): { ids: string[]; unresolved: string[] } {
  const ids = new Set<string>()
  const unresolved: string[] = []
  for (const name of product.tags ?? []) {
    const matches = tags.filter((tag) => normalize(tag.name) === normalize(name))
    if (matches.length === 1 && matches[0]) ids.add(matches[0].id)
    else unresolved.push(name)
  }
  return { ids: [...ids], unresolved }
}

export function productEditValues(product: ProductsResponse): PublicationValues {
  return { nameProduct: product.nameProduct ?? "", description: product.description ?? "", price: product.price === 0 ? "" : String(product.price), position: product.position ?? "", conditionId: product.conditionId ?? "", tagId: "" }
}

export function editedProductRequest(values: PublicationValues, tagIds: string[], imageURLs: string[]): ProductsRequest {
  return { nameProduct: values.nameProduct.trim(), description: values.description.trim(), price: values.price.trim() ? Number(values.price.replace(/\s/g, "").replace(",", ".")) : 0, conditionId: values.conditionId, position: values.position.trim(), tagIds: [...new Set(tagIds)], imageURLs }
}

export type ProductComparison = { differences: string[]; unverifiable: string[] }

const text = (value: string | null | undefined) => (value ?? "").replace(/\r\n?/g, "\n").trim()
const names = (values: string[]) => [...new Set(values.map(normalize))].sort()
const equalList = (left: string[], right: string[]) => JSON.stringify(left) === JSON.stringify(right)
const numericPrice = (value: unknown) => typeof value === "number" || (typeof value === "string" && value.trim()) ? Number(value) : NaN

function imageKey(value: string): string {
  const trimmed = value.trim()
  try {
    const base = process.env.NEXT_PUBLIC_PRODUCT_API_URL
    return (base ? new URL(trimmed, base.replace(/\/$/, "") + "/") : new URL(trimmed)).href
  } catch { return trimmed }
}

export function compareProductRequest(product: ProductsResponse, request: ProductsRequest, tags: TagResponse[]): ProductComparison {
  const differences: string[] = []
  const unverifiable: string[] = []
  if (text(product.nameProduct) !== text(request.nameProduct)) differences.push("название")
  if (text(product.description) !== text(request.description)) differences.push("описание")
  const price = numericPrice(product.price)
  if (!Number.isFinite(price) || Math.abs(price - request.price) > 0.00000001) differences.push("цена")
  if (normalize(product.conditionId ?? "") !== normalize(request.conditionId)) differences.push("состояние")
  if (text(product.position) !== text(request.position)) differences.push("город")

  const actualImages = (product.imageURLs ?? []).filter(Boolean).map(imageKey)
  const expectedImages = request.imageURLs.filter(Boolean).map(imageKey)
  if (!equalList([...new Set(actualImages)].sort(), [...new Set(expectedImages)].sort())) differences.push("фотографии")
  else if (actualImages[0] !== expectedImages[0]) differences.push("обложка")

  const requestedTags = request.tagIds.map((id) => tags.find((tag) => normalize(tag.id) === normalize(id)))
  if (requestedTags.some((tag) => !tag)) unverifiable.push("категории")
  else {
    const expectedNames = names(requestedTags.flatMap((tag) => tag ? [tag.name] : []))
    if (!equalList(names(product.tags ?? []), expectedNames)) differences.push("категории")
    else if (expectedNames.some((name) => tags.filter((tag) => normalize(tag.name) === name).length > 1)) {
      // The response exposes names, so duplicate names cannot prove which IDs were saved.
      unverifiable.push("ID категорий")
    }
  }
  return { differences, unverifiable }
}

export function sameProductRequest(product: ProductsResponse, request: ProductsRequest, tags: TagResponse[]): boolean {
  const result = compareProductRequest(product, request, tags)
  return !result.differences.length && !result.unverifiable.length
}
