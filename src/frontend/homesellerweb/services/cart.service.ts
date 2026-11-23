import { ApiError, apiFetch } from '@/lib/http';
import { CartRequest, CartResponse } from '@/dtos/cart/cart.dto';

const BASE_URL = `${process.env.NEXT_PUBLIC_CART_API_URL}/api/Cart`;

export const cartService = {
  async getCart(): Promise<CartResponse | null> {
    try {
      return await apiFetch<CartResponse>(`${BASE_URL}/GetCart`, {
        method: 'GET',
      });
    } catch (error) {
      if (error instanceof ApiError && error.status === 404) {
        return null;
      }
      throw error;
    }
  },

  async addToCart(request: CartRequest): Promise<unknown> {
    return apiFetch(`${BASE_URL}/AddCart`, {
      method: 'POST',
      body: JSON.stringify(request),
    });
  },

  async removeCartItem(productId: string): Promise<unknown> {
    return apiFetch(`${BASE_URL}/cartitems/${productId}`, {
      method: 'DELETE',
    });
  },

  async clearCart(): Promise<void> {
    await apiFetch<void>(`${BASE_URL}/clearCart`, {
      method: 'DELETE',
    });
  },
};