export const routes = {
  home: "/",
  login: "/login",
  register: "/register",
  favorites: "/favorites",
  messages: "/messages",
  profile: "/profile",
  create: "/products/new",
  product: (id: string) => `/products/${encodeURIComponent(id)}`,
}
