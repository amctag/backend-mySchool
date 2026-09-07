export const AUTH_ROUTE_THROTTLE = {
  default: {
    ttl: 60_000,
    limit: 30,
  },
} as const;
