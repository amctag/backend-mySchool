import type { CorsOptions } from 'cors';
import type { Request } from 'express';

const LOCALHOST_ORIGIN =
  /^https?:\/\/(localhost|127\.0\.0\.1|\[::1\])(:\d+)?$/i;

export interface CorsSettings {
  allowedOrigins: string[];
  allowLocalhost: boolean;
  allowSameHost: boolean;
}

export function isLocalhostOrigin(origin: string): boolean {
  return LOCALHOST_ORIGIN.test(origin);
}

export function isOriginMatchingHost(origin: string, host: string): boolean {
  try {
    return new URL(origin).host === host;
  } catch {
    return false;
  }
}

function isOriginAllowed(
  origin: string | undefined,
  host: string | undefined,
  settings: CorsSettings,
): boolean {
  if (!origin) {
    return true;
  }

  if (settings.allowLocalhost && isLocalhostOrigin(origin)) {
    return true;
  }

  if (settings.allowedOrigins.includes(origin)) {
    return true;
  }

  if (settings.allowSameHost && host && isOriginMatchingHost(origin, host)) {
    return true;
  }

  return false;
}

const corsMethods: CorsOptions['methods'] = [
  'GET',
  'POST',
  'PUT',
  'PATCH',
  'DELETE',
  'OPTIONS',
];

const corsHeaders: CorsOptions['allowedHeaders'] = [
  'Content-Type',
  'Authorization',
  'Accept',
];

function buildCorsOptions(origin: string | undefined, allow: boolean): CorsOptions {
  return {
    origin: allow ? (origin ?? true) : false,
    credentials: true,
    methods: corsMethods,
    allowedHeaders: corsHeaders,
  };
}

export function createCorsDelegate(settings: CorsSettings) {
  return (
    req: Request,
    callback: (error: Error | null, options?: CorsOptions) => void,
  ): void => {
    const origin = req.headers.origin;
    const host = req.headers.host;
    const allow = isOriginAllowed(origin, host, settings);

    callback(null, buildCorsOptions(origin, allow));
  };
}
