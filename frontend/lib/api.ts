const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_URL || "http://localhost:3000/api";

interface ApiError {
  success?: boolean;
  message?: string;
}

interface RequestOptions extends Omit<RequestInit, "body"> {
  token?: string;
  body?: unknown;
}

const apiRequest = async <T>(
  endpoint: string,
  options: RequestOptions = {},
): Promise<T> => {
  const { token, body, ...fetchOptions } = options;

  const headers = new Headers(fetchOptions.headers);

  headers.set("Content-Type", "application/json");

  if (token) {
    headers.set("Authorization", `Bearer ${token}`);
  }

  const response = await fetch(`${API_BASE_URL}${endpoint}`, {
    ...fetchOptions,
    headers,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });

  let data: T | ApiError;

  try {
    data = (await response.json()) as T | ApiError;
  } catch {
    throw new Error("Server returned an invalid response.");
  }

  if (!response.ok) {
    const errorData = data as ApiError;

    throw new Error(
      errorData.message || "Something went wrong. Please try again.",
    );
  }

  return data as T;
};

export default apiRequest;
