import { apiFetch } from '@/lib/http';
import { ConditionResponse,
  ProductFilterRequest,
  ProductsRequest,
  ProductsResponse,
  TagResponse, } from '@/dtos/product/product.dto';

const BASE_URL = `${process.env.NEXT_PUBLIC_PRODUCT_API_URL}/api/Product`;

export const productService = {
  async getProducts(
    filter: ProductFilterRequest = {}
  ): Promise<ProductsResponse[]> {
    const params = new URLSearchParams();

    params.append('page', (filter.page ?? 1).toString());
    params.append('pageSize', (filter.pageSize ?? 20).toString());

    if (filter.search?.trim()) {
      params.append('search', filter.search.trim());
    }
    if (filter.minPrice !== undefined && !Number.isNaN(filter.minPrice)) {
      params.append('minPrice', filter.minPrice.toString());
    }
    if (filter.maxPrice !== undefined && !Number.isNaN(filter.maxPrice)) {
      params.append('maxPrice', filter.maxPrice.toString());
    }
    if (filter.conditionId) {
      params.append('conditionId', filter.conditionId);
    }
    if (filter.position?.trim()) {
      params.append('position', filter.position.trim());
    }
    if (filter.minRating !== undefined && !Number.isNaN(filter.minRating)) {
      params.append('minRating', filter.minRating.toString());
    }
    if (filter.sortBy) {
      params.append('sortBy', filter.sortBy);
    }
    if (filter.tagIds && filter.tagIds.length > 0) {
      filter.tagIds.forEach((id) => params.append('tagIds', id));
    }

    return apiFetch<ProductsResponse[]>(
      `${BASE_URL}/GetProducts?${params.toString()}`,
      {
        method: 'GET',
        auth: false,
      }
    );
  },

  async getConditions(): Promise<ConditionResponse[]> {
    return apiFetch<ConditionResponse[]>(`${BASE_URL}/GetCondition`, {
      method: 'GET',
      auth: false,
    });
  },

  async getTags(): Promise<TagResponse[]> {
    return apiFetch<TagResponse[]>(`${BASE_URL}/GetTag`, {
      method: 'GET',
      auth: false,
    });
  },

  async getProductById(productId: string): Promise<ProductsResponse> {
    return apiFetch<ProductsResponse>(`${BASE_URL}/GetProduct/${productId}`, {
      method: 'GET',
      cache: 'no-store',
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
