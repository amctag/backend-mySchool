type ThrottleRequest = {
  ip?: string;
  user?: { id?: number; role?: string };
  headers?: Record<string, string | string[] | undefined>;
  socket?: { remoteAddress?: string };
};

export function resolveThrottleTracker(req: ThrottleRequest): string {
  const userId = req.user?.id;
  if (userId) {
    return `${req.user?.role ?? 'user'}:${userId}`;
  }

  const forwarded = req.headers?.['x-forwarded-for'];
  const forwardedValue = Array.isArray(forwarded) ? forwarded[0] : forwarded;
  const forwardedIp = forwardedValue?.split(',')[0]?.trim();

  return forwardedIp || req.ip || req.socket?.remoteAddress || 'unknown';
}
