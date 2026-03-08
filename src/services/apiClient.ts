import { buildAppPath, normalizeUrlOrPath } from "../utils/appBase";

const API_BASE_URL = normalizeUrlOrPath(
  import.meta.env.VITE_API_BASE_URL,
  buildAppPath("api/v1"),
).replace(/\/$/, "");

interface ApiEnvelope<T> {
  code: number;
  message: string;
  data: T;
}

interface ApiErrorPayload {
  code?: number;
  message?: string;
}

export class ApiError extends Error {
  status: number;
  code?: number;

  constructor(message: string, status: number, code?: number) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.code = code;
  }
}

export async function apiRequest<T>(
  path: string,
  options: RequestInit & {
    token?: string;
  } = {},
): Promise<T> {
  const { token, headers, ...restOptions } = options;
  const requestHeaders = new Headers(headers);

  if (!requestHeaders.has("Content-Type") && restOptions.body) {
    requestHeaders.set("Content-Type", "application/json");
  }

  if (token) {
    requestHeaders.set("Authorization", `Bearer ${token}`);
  }

  let response: Response;

  try {
    response = await fetch(`${API_BASE_URL}${path}`, {
      ...restOptions,
      headers: requestHeaders,
    });
  } catch {
    throw new ApiError("网络连接失败，请检查前后端服务是否已启动", 0);
  }

  const isJson = response.headers.get("content-type")?.includes("application/json");
  const payload = isJson ? ((await response.json()) as ApiEnvelope<T> | ApiErrorPayload) : null;

  if (!response.ok) {
    const errorPayload = payload as ApiErrorPayload | null;
    throw new ApiError(
      errorPayload?.message || `请求失败(${response.status})`,
      response.status,
      errorPayload?.code,
    );
  }

  const successPayload = payload as ApiEnvelope<T> | null;

  if (!successPayload || typeof successPayload !== "object" || !("data" in successPayload)) {
    throw new ApiError("服务端返回格式异常", response.status);
  }

  return successPayload.data;
}
