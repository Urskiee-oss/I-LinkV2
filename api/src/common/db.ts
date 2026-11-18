import {
  BadRequestException,
  ConflictException,
  InternalServerErrorException,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import type { PostgrestError } from '@supabase/supabase-js';

const logger = new Logger('Database');

/** Translate a PostgREST/Postgres error into an HTTP exception. */
export function dbError(error: PostgrestError, context = 'Database operation failed'): never {
  switch (error.code) {
    case 'PGRST116':
      throw new NotFoundException('Record not found');
    case '23505':
      throw new ConflictException('A record with these details already exists');
    case '23503':
      throw new BadRequestException('Referenced record does not exist');
    case '23514':
    case '22P02':
    case '22007':
      throw new BadRequestException(`Invalid value: ${error.message}`);
    default:
      logger.error(`${context}: [${error.code}] ${error.message} ${error.details ?? ''}`);
      throw new InternalServerErrorException(context);
  }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function unwrap<T = any>(
  res: { data: T | null; error: PostgrestError | null },
  context?: string,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
): any {
  if (res.error) dbError(res.error, context);
  return res.data;
}

/** Unwrap a single-row response, throwing 404 when missing. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function unwrapOne<T = any>(
  res: { data: T | null; error: PostgrestError | null },
  what = 'Record',
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
): any {
  if (res.error) {
    if (res.error.code === 'PGRST116') throw new NotFoundException(`${what} not found`);
    dbError(res.error);
  }
  if (!res.data) throw new NotFoundException(`${what} not found`);
  return res.data;
}

/** Remove undefined keys and map camelCase DTO keys to snake_case columns. */
export function toColumns(dto: object, map: Record<string, string>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(dto)) {
    if (value === undefined) continue;
    out[map[key] ?? key] = value;
  }
  return out;
}

/** Escape user input for use inside a PostgREST `ilike` / `or` filter. */
export function escapeFilter(input: string): string {
  return input.replace(/[%_,()*\\]/g, ' ').trim().slice(0, 80);
}
