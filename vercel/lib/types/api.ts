export type ApiSuccess<T> = { ok: true; data: T };
export type ApiError = { ok: false; error: string; status?: number };
export type ApiResult<T> = ApiSuccess<T> | ApiError;

export function apiSuccess<T>(data: T): ApiSuccess<T> {
  return { ok: true, data };
}

export function apiError(error: string, status = 500): ApiError {
  return { ok: false, error, status };
}
