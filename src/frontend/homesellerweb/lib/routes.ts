export const routes = {
  home: "/",
  login: "/login",
  register: "/register",
  favorites: "/favorites",
  cart: "/cart",
  messages: "/messages",
  profile: "/profile",
  create: "/products/new",
  product: (id: string) => `/products/${encodeURIComponent(id)}`,
}
