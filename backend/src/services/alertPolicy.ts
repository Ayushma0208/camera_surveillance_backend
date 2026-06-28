export const getAlertDedupSince = (eventTimestamp: Date, windowSeconds: number) =>
  new Date(eventTimestamp.getTime() - windowSeconds * 1000);

export const getAlertRateLimitSince = (eventTimestamp: Date) =>
  new Date(eventTimestamp.getTime() - 60 * 1000);

export const isAlertRateLimited = (recentAlertCount: number, limitPerMinute: number) =>
  recentAlertCount >= limitPerMinute;
