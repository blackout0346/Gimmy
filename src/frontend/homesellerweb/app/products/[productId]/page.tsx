import type { Metadata } from "next"
import { ProductDetails } from "@/components/products/product-details"

export const metadata: Metadata = { title: "Объявление" }

export default async function ProductPage({ params }: { params: Promise<{ productId: string }> }) {
  const { productId } = await params
  return <ProductDetails key={productId} productId={productId} />
}
