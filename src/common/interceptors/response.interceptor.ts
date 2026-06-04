import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';

export interface ApiResponse<T> {
  success: boolean;
  data: T | null;
  meta: Record<string, unknown> | null;
  error: unknown | null;
}

/**
 * Bọc mọi response thành format thống nhất:
 * { success, data, meta, error }
 *
 * Nếu service trả về { data, meta } thì meta được tách ra (dùng cho pagination).
 */
@Injectable()
export class ResponseInterceptor<T>
  implements NestInterceptor<T, ApiResponse<unknown>>
{
  intercept(
    _context: ExecutionContext,
    next: CallHandler,
  ): Observable<ApiResponse<unknown>> {
    return next.handle().pipe(
      map((payload) => {
        if (
          payload &&
          typeof payload === 'object' &&
          'data' in payload &&
          'meta' in payload
        ) {
          const { data, meta } = payload as {
            data: unknown;
            meta: Record<string, unknown>;
          };
          return { success: true, data, meta: meta ?? null, error: null };
        }
        return {
          success: true,
          data: payload ?? null,
          meta: null,
          error: null,
        };
      }),
    );
  }
}
