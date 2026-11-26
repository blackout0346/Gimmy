import { apiFetch } from '@/lib/http';
import { ProductsRequest, ProductsResponse } from '@/dtos/product/product.dto';

const BASE_URL = `${process.env.NEXT_PUBLIC_PRODUCT_API_URL}/api/Product`;

export const productService = {
  async getProducts(
    search?: string,
    page = 1,
    pageSize = 20
  ): Promise<ProductsResponse[]> {
    const params = new URLSearchParams({
      page: page.toString(),
      pageSize: pageSize.toString(),
    });

    if (search?.trim()) {
      params.append('search', search.trim());
    }

    return apiFetch<ProductsResponse[]>(
      `${BASE_URL}/GetProducts?${params.toString()}`,
      {
        method: 'GET',
        auth: false,
      }
    );
  },

  async getProductById(productId: string): Promise<ProductsResponse> {
    return apiFetch<ProductsResponse>(`${BASE_URL}/GetProduct/${productId}`, {
      method: 'GET',
      auth: false,
    });
  },

  async uploadImages(files: File[]): Promise<string[]> {
    const formData = new FormData();
    files.forEach((file) => formData.append('files', file));

    return apiFetch<string[]>(`${BASE_URL}/upload`, {
      method: 'POST',
      body: formData,
    });
  },

  async createProduct(
    request: ProductsRequest,
    imageFiles?: File[]
  ): Promise<ProductsResponse> {
    let finalImageURLs = request.imageURLs ?? [];

    if (imageFiles && imageFiles.length > 0) {
      const uploadedUrls = await this.uploadImages(imageFiles);
      finalImageURLs = [...finalImageURLs, ...uploadedUrls];
    }

    const dtoPayload: ProductsRequest = {
      nameProduct: request.nameProduct ?? '',
      description: request.description ?? '',
      price: Number(request.price) || 0,
      imageURLs: finalImageURLs,
      conditionId: request.conditionId,
      position: request.position ?? '',
      tagIds: request.tagIds ?? [],
    };

    return apiFetch<ProductsResponse>(`${BASE_URL}/AddProduct`, {
      method: 'POST',
      body: JSON.stringify(dtoPayload),
    });
  },

  async updateProduct(
    productId: string,
    request: ProductsRequest,
    imageFiles?: File[]
  ): Promise<ProductsResponse> {
    let finalImageURLs = request.imageURLs ?? [];

    if (imageFiles && imageFiles.length > 0) {
      const uploadedUrls = await this.uploadImages(imageFiles);
      finalImageURLs = [...finalImageURLs, ...uploadedUrls];
    }

    const dtoPayload: ProductsRequest = {
      nameProduct: request.nameProduct ?? '',
      description: request.description ?? '',
      price: Number(request.price) || 0,
      imageURLs: finalImageURLs,
      conditionId: request.conditionId,
      position: request.position ?? '',
      tagIds: request.tagIds ?? [],
    };

    return apiFetch<ProductsResponse>(`${BASE_URL}/UpdateProduct/${productId}`, {
      method: 'PUT',
      body: JSON.stringify(dtoPayload),
    });
  },

  async deleteProduct(productId: string): Promise<ProductsResponse> {
    return apiFetch<ProductsResponse>(`${BASE_URL}/DeleteProduct/${productId}`, {
      method: 'DELETE',
    });
  },
};