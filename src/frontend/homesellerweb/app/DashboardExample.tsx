'use client';

import { useEffect, useState } from 'react';
import { authService } from './api/Services/auth.service';
import { productService } from './api/Services/product.service';
import { cartService } from './api/Services/cart.service';
import { useNotifications } from './provider/NotificationProvider';
import { ProductsResponse } from './api/DTOs/product/route';
import { CartResponse} from './api/DTOs/cart/route';

export function DashboardExample() {
  const [products, setProducts] = useState<ProductsResponse[]>([]);
  const [cart, setCart] = useState<CartResponse | null>(null);
  const { notifications, isConnected } = useNotifications();

  useEffect(() => {
    productService.getProducts().then(setProducts).catch(console.error);
  }, []);

  const handleLoginAndLoadCart = async () => {
    await authService.login({ login: 'user1', password: 'password123' });
    const userCart = await cartService.getCart();
    setCart(userCart);
  };

  const handleAddToCart = async (productId: string) => {
    await cartService.addToCart({ productId, quantity: 1 });
    const updatedCart = await cartService.getCart();
    setCart(updatedCart);
  };

  return (
    <div>
      <div>SignalR статус: {isConnected ? 'Подключено' : 'Отключено'}</div>
      <button onClick={handleLoginAndLoadCart}>Войти и загрузить корзину</button>

      <h3>Уведомления ({notifications.length})</h3>
      <ul>
        {notifications.map((n, idx) => (
          <li key={`${n.entityId}-${idx}`}>
            <strong>{n.title}</strong>: {n.message}
          </li>
        ))}
      </ul>

      <h3>Товары</h3>
      <ul>
        {products.map((p) => (
          <li key={p.id}>
            {p.nameProduct} — {p.price} ₽
            <button onClick={() => handleAddToCart(p.id)}>В корзину</button>
          </li>
        ))}
      </ul>

      <h3>Корзина ({cart?.cartItems.length ?? 0})</h3>
    </div>
  );
}