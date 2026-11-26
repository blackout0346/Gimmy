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
export interface RateResponse{
  id:string,
  descriptionRate :string,
  rate: number,
  productId:string,
  createAt:string,
  updateAt:string,
  userName:string,
  imageURLs: string[] | null,
  userId:string;
}
export interface RateRequest{
  id:string,
  descriptionRate :string,
  rate: number,
  imageURLs: string[] | null,
  productId:string,

}
export interface ProductFilterRequest {
  search?: string;
  minPrice?: number;
  maxPrice?: number;
  conditionId?: string;
  tagIds?: string[];
  position?: string;
  minRating?: number;
  sortBy?: 'newest' | 'price_asc' | 'price_desc' | 'rating_desc';
  page?: number;
  pageSize?: number;
}
export interface ConditionResponse {
  id: string;
  name: string;
}

export interface TagResponse {
  id: string;
  name: string;
}