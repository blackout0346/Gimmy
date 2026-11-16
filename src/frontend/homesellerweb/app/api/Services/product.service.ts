import { apiFetch } from '@/lib/http';
import { ProductsRequest, ProductsResponse } from '../DTOs/product/route';

const BASE_URL = `${process.env.NEXT_PUBLIC_PRODUCT_API_URL}/api/Product`;

export const productService = {
  async getProducts(search?: string): Promise<ProductsResponse[]> {
    const query = search ? `?search=${encodeURIComponent(search)}` : '';
    return apiFetch<ProductsResponse[]>(`${BASE_URL}/GetProducts${query}`, {
      method: 'GET',
      auth: false,
    });
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

  async createProduct(request: ProductsRequest): Promise<ProductsResponse> {
    let finalImageURLs = request.imageURLs ?? [];

    if (request.imageFiles && request.imageFiles.length > 0) {
      const uploadedUrls = await this.uploadImages(request.imageFiles);
      finalImageURLs = [...finalImageURLs, ...uploadedUrls];
    }

    const { imageFiles: _, ...payload } = request;

    return apiFetch<ProductsResponse>(`${BASE_URL}/AddProduct`, {
      method: 'POST',
      body: JSON.stringify({
        ...payload,
        imageURLs: finalImageURLs.length > 0 ? finalImageURLs : null,
      }),
    });
  },

  async updateProduct(productId: string, request: ProductsRequest): Promise<ProductsResponse> {
    let finalImageURLs = request.imageURLs ?? [];

    if (request.imageFiles && request.imageFiles.length > 0) {
      const uploadedUrls = await this.uploadImages(request.imageFiles);
      finalImageURLs = [...finalImageURLs, ...uploadedUrls];
    }

    const { imageFiles: _, ...payload } = request;

    return apiFetch<ProductsResponse>(`${BASE_URL}/UpdateProduct/${productId}`, {
      method: 'PUT',
      body: JSON.stringify({
        ...payload,
        imageURLs: finalImageURLs.length > 0 ? finalImageURLs : null,
      }),
    });
  },

  async deleteProduct(productId: string): Promise<ProductsResponse> {
    return apiFetch<ProductsResponse>(`${BASE_URL}/DeleteProduct/${productId}`, {
      method: 'DELETE',
    });
  },
};