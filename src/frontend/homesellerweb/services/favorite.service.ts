import { apiFetch } from '@/lib/http';
import { FavoriteResponse } from '@/dtos/cart/cart.dto';

const BASE_URL = `${process.env.NEXT_PUBLIC_CART_API_URL}/api/Cart/favorites`;

export const favoriteService = {
  async getFavorite(): Promise<FavoriteResponse> {
    return apiFetch<FavoriteResponse>(BASE_URL, {
      method: 'GET',
    });
  },

  async addFavorite(productId: string): Promise<FavoriteResponse> {
    return apiFetch<FavoriteResponse>(`${BASE_URL}/${productId}`, {
      method: 'POST',
    });
  },

  async removeFavorite(productId: string): Promise<FavoriteResponse> {
    return apiFetch<FavoriteResponse>(`${BASE_URL}/${productId}`, {
      method: 'DELETE',
    });
  },
};