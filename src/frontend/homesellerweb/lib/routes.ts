export const routes = {
  home: "/",
  login: "/login",
  register: "/register",
  favorites: "/favorites",
  cart: "/cart",
  messages: "/messages",
  profile: "/profile",
  userProfile: (userId: string) => `/profile/${encodeURIComponent(userId)}`,
  create: "/products/new",
  product: (id: string) => `/products/${encodeURIComponent(id)}`,
  editProduct: (id: string) => `/products/${encodeURIComponent(id)}/edit`,
}
