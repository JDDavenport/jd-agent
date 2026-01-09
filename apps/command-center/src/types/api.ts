export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
  };
  timestamp?: string;
  count?: number;
  message?: string;
}

export interface PaginatedResponse<T> extends ApiResponse<T> {
  count: number;
  page?: number;
  limit?: number;
}
