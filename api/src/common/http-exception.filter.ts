import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Request, Response } from 'express';
import { MulterError } from 'multer';

/**
 * Centralized error handler: every error leaves the API as
 * { statusCode, message, error, path, timestamp } and unexpected errors are
 * logged server-side without leaking internals to the client.
 */
@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger('HTTP');

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const res = ctx.getResponse<Response>();
    const req = ctx.getRequest<Request>();

    let status = HttpStatus.INTERNAL_SERVER_ERROR;
    let message: string | string[] = 'Internal server error';
    let error = 'Internal Server Error';

    if (exception instanceof HttpException) {
      status = exception.getStatus();
      const body = exception.getResponse();
      if (typeof body === 'string') {
        message = body;
      } else if (body && typeof body === 'object') {
        const b = body as { message?: string | string[]; error?: string };
        message = b.message ?? exception.message;
        error = b.error ?? exception.name;
      }
      if (typeof body === 'string' || !(body as { error?: string }).error) {
        error = HttpStatus[status]?.replace(/_/g, ' ') ?? 'Error';
      }
    } else if (exception instanceof MulterError) {
      status = HttpStatus.BAD_REQUEST;
      error = 'Bad Request';
      message = exception.code === 'LIMIT_FILE_SIZE' ? 'Image must be 5 MB or smaller' : exception.message;
    } else {
      this.logger.error(
        `${req.method} ${req.url} — ${(exception as Error)?.message ?? exception}`,
        (exception as Error)?.stack,
      );
    }

    if (status >= 500 && exception instanceof HttpException) {
      this.logger.error(`${req.method} ${req.url} — ${JSON.stringify(message)}`);
    }

    res.status(status).json({
      statusCode: status,
      message,
      error,
      path: req.url,
      timestamp: new Date().toISOString(),
    });
  }
}
