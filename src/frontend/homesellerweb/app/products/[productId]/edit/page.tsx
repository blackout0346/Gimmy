import type { Metadata } from "next"
import { ProductEditPage } from "@/components/products/product-edit-page"

export const metadata: Metadata = { title: "Редактирование объявления" }
export default async function Page({ params }: { params: Promise<{ productId: string }> }) {
  const { productId } = await params
  return <ProductEditPage key={productId} productId={productId} />
}
