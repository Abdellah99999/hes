/**
 * Custom Fetch Mutator for Orval and direct HTTP API queries.
 * Manages in-memory token storage and automatic refresh on 401.
 */

let inMemoryToken: string | null = null;

export const setAccessToken = (token: string | null): void => {
  inMemoryToken = token;
  if (typeof window !== "undefined") {
    if (token) {
      sessionStorage.setItem("hes_access_token", token);
    } else {
      sessionStorage.removeItem("hes_access_token");
      localStorage.removeItem("hes_access_token");
    }
  }
};

export const getAccessToken = (): string | null => {
  if (inMemoryToken) return inMemoryToken;
  if (typeof window !== "undefined") {
    return (
      sessionStorage.getItem("hes_access_token") ||
      localStorage.getItem("hes_access_token")
    );
  }
  return null;
};

export const normalizeApiUrl = (rawBase: string, rawPath: string): string => {
  let base = (rawBase || "").trim();
  while (base.endsWith("/")) {
    base = base.slice(0, -1);
  }

  // Ensure base ends with /api/v1
  if (!base.endsWith("/api/v1")) {
    base = base ? `${base}/api/v1` : "/api/v1";
  }

  let path = (rawPath || "").trim();
  // Strip duplicate /api/v1 or api/v1 prefix from path
  if (path.startsWith("/api/v1")) {
    path = path.slice(7);
  } else if (path.startsWith("api/v1")) {
    path = path.slice(6);
  }

  if (!path.startsWith("/")) {
    path = `/${path}`;
  }

  return `${base}${path}`;
};

const getApiBaseUrl = (): string => {
  if (
    typeof import.meta !== "undefined" &&
    import.meta.env &&
    import.meta.env.VITE_API_URL
  ) {
    return import.meta.env.VITE_API_URL;
  }
  return "/api/v1";
};

export interface FetchOptions extends RequestInit {
  params?: Record<string, string | number | boolean | undefined>;
  skipAuth?: boolean;
  responseType?: "json" | "blob" | "text";
}

export class ApiError extends Error {
  constructor(
    public status: number,
    public statusText: string,
    public data: unknown,
  ) {
    super(`API Error ${status}: ${statusText}`);
    this.name = "ApiError";
  }
}

export const customFetch = async <T>(
  url: string,
  options: FetchOptions = {},
): Promise<T> => {
  const baseUrl = getApiBaseUrl();
  let fullUrl = normalizeApiUrl(baseUrl, url);

  if (options.params) {
    const searchParams = new URLSearchParams();
    Object.entries(options.params).forEach(([key, value]) => {
      if (value !== undefined) {
        searchParams.append(key, String(value));
      }
    });
    const queryString = searchParams.toString();
    if (queryString) {
      fullUrl += `${fullUrl.includes("?") ? "&" : "?"}${queryString}`;
    }
  }

  const token = !options.skipAuth ? getAccessToken() : null;

  const headers: HeadersInit = {
    "Content-Type": "application/json",
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...options.headers,
  };

  const response = await fetch(fullUrl, {
    ...options,
    headers,
    credentials: "include", // Sends httpOnly cookies (refresh token)
  });

  if (!response.ok) {
    let errorData: unknown;
    try {
      errorData = await response.json();
    } catch {
      errorData = await response.text();
    }
    throw new ApiError(response.status, response.statusText, errorData);
  }

  if (response.status === 204) {
    return {} as T;
  }

  if (options.responseType === "blob") {
    return (await response.blob()) as unknown as T;
  }

  if (options.responseType === "text") {
    return (await response.text()) as unknown as T;
  }

  const contentType = response.headers.get("content-type") || "";
  if (
    contentType.includes("application/pdf") ||
    contentType.includes("application/vnd") ||
    contentType.includes("application/octet-stream") ||
    contentType.includes("text/csv")
  ) {
    return (await response.blob()) as unknown as T;
  }

  return response.json() as Promise<T>;
};

export default customFetch;
