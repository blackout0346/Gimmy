import { ApiError, apiFetch, tokenStorage } from '@/lib/http';
import { notifyCartChanged } from '@/lib/cart-events';
import { CartRequest, CartResponse } from '@/dtos/cart/cart.dto';

const BASE_URL = `${process.env.NEXT_PUBLIC_CART_API_URL}/api/Cart`;

export const cartService = {
  async getCart(): Promise<CartResponse | null> {
    try {
      return await apiFetch<CartResponse>(`${BASE_URL}/GetCart`, {
        method: 'GET',
        cache: 'no-store',
      });
    } catch (error) {
      if (error instanceof ApiError && error.status === 404) {
        return null;
      }
      throw error;
    }
  },

  async addToCart(request: CartRequest): Promise<unknown> {
    const token = tokenStorage.get();
    try { return await apiFetch(`${BASE_URL}/AddCart`, {
      method: 'POST',
      body: JSON.stringify(request),
    }); } finally { notifyCartChanged(token); }
  },

  async removeCartItem(productId: string): Promise<unknown> {
    const token = tokenStorage.get();
    try { return await apiFetch(`${BASE_URL}/cartitems/${productId}`, {
      method: 'DELETE',
    }); } finally { notifyCartChanged(token); }
  },

  async clearCart(): Promise<void> {
    const token = tokenStorage.get();
    try { await apiFetch<void>(`${BASE_URL}/clearCart`, {
      method: 'DELETE',
    }); } finally { notifyCartChanged(token); }
  },
};
