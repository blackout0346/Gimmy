export interface CartItemResponse {
  id: string;
  productId: string;
  quantity: number;
}

export interface CartRequest {
  productId: string;
  quantity?: number; 
}

export interface CartResponse {
  id: string;
  userId: string;
  cartItems: CartItemResponse[];
}
  
export interface FavoriteResponse{
    userId: string;
    productIds: string[];
}