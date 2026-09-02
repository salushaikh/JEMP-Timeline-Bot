import { Request, Response, NextFunction } from 'express';

interface RateLimitRecord {
  timestamps: number[];
}

const clientRecords = new Map<string, RateLimitRecord>();

// Clean up stale entries every 5 minutes
setInterval(() => {
  const now = Date.now();
  const windowMs = 60 * 1000;
  for (const [key, record] of clientRecords.entries()) {
    record.timestamps = record.timestamps.filter((ts) => now - ts < windowMs);
    if (record.timestamps.length === 0) {
      clientRecords.delete(key);
    }
  }
}, 5 * 60 * 1000);

export function rateLimiter(options?: { windowMs?: number; maxRequests?: number }) {
  const windowMs = options?.windowMs || (parseInt(process.env.RATE_LIMIT_WINDOW_SECONDS || '60', 10) * 1000);
  const maxRequests = options?.maxRequests || parseInt(process.env.RATE_LIMIT_MAX_REQUESTS || '100', 10);

  return (req: Request, res: Response, next: NextFunction) => {
    const clientKey = (req.ip || req.socket.remoteAddress || 'unknown') + ':' + req.baseUrl;
    const now = Date.now();

    let record = clientRecords.get(clientKey);
    if (!record) {
      record = { timestamps: [] };
      clientRecords.set(clientKey, record);
    }

    // Filter out timestamps older than window
    record.timestamps = record.timestamps.filter((ts) => now - ts < windowMs);

    if (record.timestamps.length >= maxRequests) {
      const oldest = record.timestamps[0];
      const retryAfter = Math.ceil((oldest + windowMs - now) / 1000);
      res.setHeader('Retry-After', retryAfter);
      return res.status(429).json({
        error: 'Too Many Requests',
        message: 'Rate limit exceeded. Please retry shortly.',
        retryAfterSeconds: retryAfter,
      });
    }

    record.timestamps.push(now);
    next();
  };
}
