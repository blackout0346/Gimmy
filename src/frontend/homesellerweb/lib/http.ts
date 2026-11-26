export const AUTH_CHANGE_EVENT = 'gimmy:auth-change';

const TOKEN_KEY = 'gimmy:access_token';

export const tokenStorage = {
  get: (): string | null => {
    if (typeof window === 'undefined') return null;
    return localStorage.getItem(TOKEN_KEY);
  },
  set: (token: string): void => {
    if (typeof window !== 'undefined') {
      localStorage.setItem(TOKEN_KEY, token);
      window.dispatchEvent(new Event(AUTH_CHANGE_EVENT));
    }
  },
  clear: (): void => {
    if (typeof window !== 'undefined') {
      localStorage.removeItem(TOKEN_KEY);
      window.dispatchEvent(new Event(AUTH_CHANGE_EVENT));
    }
  },
};

export class ApiError extends Error {
  constructor(public status: number, message: string) {
    super(message);
    this.name = 'ApiError';
  }
}

interface RequestOptions extends RequestInit {
  auth?: boolean;
}

export async function apiFetch<T>(url: string, options: RequestOptions = {}): Promise<T> {
  const { auth = true, headers, body, ...rest } = options;
  const requestHeaders = new Headers(headers);

  if (auth) {
    const token = tokenStorage.get();
    if (token) {
      requestHeaders.set('Authorization', `Bearer ${token}`);
    }
  }


  if (body && !(body instanceof FormData) && !requestHeaders.has('Content-Type')) {
    requestHeaders.set('Content-Type', 'application/json');
  }

  const response = await fetch(url, {
    ...rest,
    headers: requestHeaders,
    body,
  });

  if (!response.ok) {
    const errorText = await response.text();
    let errorMessage = errorText || `HTTP Error ${response.status}`;
    try {
      const parsed = JSON.parse(errorText);
      errorMessage = parsed.message || parsed.title || errorMessage;
    } catch(ex) {
      
    }
    throw new ApiError(response.status, errorMessage);
  }

  if (response.status === 204) {
    return undefined as T;
  }

  const text = await response.text();
  return text ? (JSON.parse(text) as T) : (undefined as T);
}