

export interface ProductsRequest {
  nameProduct: string;
  description: string;
  price: number;
  imageURLs: string[];
  conditionId: string;
  position: string;
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
  position: string;
  tags: string[];
}