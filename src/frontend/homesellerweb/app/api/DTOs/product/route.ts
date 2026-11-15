

export interface ProductsRequest {
  nameProduct: string;
  description: string;
  price: number;
  imageURLs: string[] | null;
  imageFiles?: File[] | null;
  conditionId: string;
  userId: string;
  tagIds: string[];
}

export interface ProductsResponse {
  id: string;
  nameProduct: string;
  description: string;
  price: number;
  createAt: string;
  imageURLs: string[] | null;
  conditionId: string;
  nameCondition: string;
  userId: string;
  sellerLogin: string;
  tags: string[];
}