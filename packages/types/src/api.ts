export interface ApiSuccessResponse<T> {
  data: T
}

export interface ApiErrorResponse {
  error: string
  code: string
}

export type ApiResponse<T> = ApiSuccessResponse<T> | ApiErrorResponse

export function isApiError<T>(
  response: ApiResponse<T>,
): response is ApiErrorResponse {
  return 'error' in response
}
