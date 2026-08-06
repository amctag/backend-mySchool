const LOCALHOST_ORIGIN =
  /^https?:\/\/(localhost|127\.0\.0\.1|\[::1\])(:\d+)?$/i;

export function isLocalhostOrigin(origin: string): boolean {
  return LOCALHOST_ORIGIN.test(origin);
}

export function createCorsOriginChecker(allowedOrigins: string[], allowLocalhost: boolean) {
  return (
    origin: string | undefined,
    callback: (error: Error | null, allow?: boolean) => void,
  ): void => {
    if (!origin) {
      callback(null, true);
      return;
    }

    if (allowLocalhost && isLocalhostOrigin(origin)) {
      callback(null, true);
      return;
    }

    if (allowedOrigins.includes(origin)) {
      callback(null, true);
      return;
    }

    callback(new Error(`CORS blocked for origin: ${origin}`), false);
  };
}
