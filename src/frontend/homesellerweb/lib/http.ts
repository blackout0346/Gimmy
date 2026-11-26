export const AUTH_CHANGE_EVENT = 'homeseller:auth-change';

const TOKEN_KEY = 'homeseller_access_token';

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
  constructor(
    public status: number,
    message: string,
    public body?: unknown,
    public rawBody?: string,
    public fieldErrors: Record<string, string[]> = {},
  ) {
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
    const rawBody = await response.text();
    let errorBody: unknown = rawBody;
    try {
      errorBody = JSON.parse(rawBody);
    } catch {
      // ошибки не в формате json сохраняются как текст
    }

    const details = errorBody !== null && typeof errorBody === 'object' && !Array.isArray(errorBody)
      ? errorBody as Record<string, unknown>
      : {};
    const validation = details.errors !== null && typeof details.errors === 'object' && !Array.isArray(details.errors)
      ? details.errors as Record<string, unknown>
      : details;
    const fieldErrors: Record<string, string[]> = Object.fromEntries(
      Object.entries(validation)
        .filter(([, value]) => Array.isArray(value) && value.some((item) => typeof item === 'string'))
        .map(([field, value]) => [field, (value as unknown[]).filter((item): item is string => typeof item === 'string')]),
    );
    const validationMessage = Object.values(fieldErrors).flat().join(' ');
    const plainMessage = typeof errorBody === 'string' && !errorBody.trimStart().startsWith('<')
      ? errorBody
      : '';
    const message = [details.message, validationMessage, details.detail, details.title, plainMessage]
      .find((value): value is string => typeof value === 'string' && value.trim().length > 0);

    throw new ApiError(
      response.status,
      message?.trim() || `HTTP Error ${response.status}`,
      errorBody,
      rawBody,
      fieldErrors,
    );
  }

  if (response.status === 204) {
    return undefined as T;
  }

  const text = await response.text();
  return text ? (JSON.parse(text) as T) : (undefined as T);
}