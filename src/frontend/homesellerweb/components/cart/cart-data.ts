import type { CartResponse } from "@/dtos/cart/cart.dto"
import type { ProductsResponse } from "@/dtos/product/product.dto"
import { ApiError } from "@/lib/http"
import { productService } from "@/services/product.service"

type CartPosition = { productId: string; quantity: number }
export type CartLine = CartPosition & (
  | { state: "ready"; product: ProductsResponse }
  | { state: "missing" | "error" }
)

const money = new Intl.NumberFormat("ru-RU", { style: "currency", currency: "RUB", minimumFractionDigits: 0, maximumFractionDigits: 2 })
export function formatCartMoney(amount: number) { return money.format(amount) }

export function cartPositions(cart: CartResponse | null): CartPosition[] {
  if (!cart) return []
  if (!Array.isArray(cart.cartItems)) throw new Error("Invalid cart response")
  const positions = new Map<string, CartPosition>()
  for (const item of cart.cartItems) {
    if (!item.productId || !Number.isSafeInteger(item.quantity) || item.quantity < 1) throw new Error("Invalid cart item")
    const key = item.productId.toLowerCase()
    const current = positions.get(key)
    const quantity = (current?.quantity ?? 0) + item.quantity
    if (!Number.isSafeInteger(quantity)) throw new Error("Invalid cart quantity")
    positions.set(key, { productId: current?.productId ?? item.productId, quantity })
  }
  return [...positions.values()]
}

export function cartContains(cart: CartResponse | null, productId: string) {
  return cartPositions(cart).some((item) => item.productId.toLowerCase() === productId.toLowerCase())
}

export async function loadCartLine(position: CartPosition): Promise<CartLine> {
  try {
    const product = await productService.getProductById(position.productId)
    return product ? { ...position, state: "ready", product } : { ...position, state: "missing" }
  } catch (error) {
    return { ...position, state: error instanceof ApiError && error.status === 404 ? "missing" : "error" }
  }
}

export async function loadCartLines(cart: CartResponse | null, cancelled: () => boolean): Promise<CartLine[]> {
  const positions = cartPositions(cart)
  const lines: CartLine[] = []
  for (let offset = 0; offset < positions.length; offset += 6) {
    if (cancelled()) return []
    lines.push(...await Promise.all(positions.slice(offset, offset + 6).map(loadCartLine)))
  }
  return lines
}

export function cartSummary(lines: CartLine[]) {
  let amount = 0
  let quantity = 0
  let hasUnknownPrices = false
  let hasNegotiablePrices = false
  for (const line of lines) {
    quantity += line.quantity
    if (line.state !== "ready" || !Number.isFinite(line.product.price) || line.product.price < 0) {
      hasUnknownPrices = true
    } else if (line.product.price === 0) {
      hasNegotiablePrices = true
    } else {
      // Sum displayed amounts in kopecks to avoid floating-point drift.
      const kopecks = Math.round(line.product.price * 100) * line.quantity
      if (!Number.isSafeInteger(kopecks) || !Number.isSafeInteger(amount + kopecks)) hasUnknownPrices = true
      else amount += kopecks
    }
  }
  return { amount: amount / 100, quantity, hasUnknownPrices, hasNegotiablePrices }
}
