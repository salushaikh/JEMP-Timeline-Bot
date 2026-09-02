import { Request, Response, NextFunction } from 'express';
import crypto from 'crypto';

const SERVICE_SECRET = process.env.TIMELINE_SERVICE_SECRET || 'jemp-timeline-shared-secret-key';
const REPLAY_WINDOW_MS = 5 * 60 * 1000; // 5 minutes

export interface AuthenticatedRequest extends Request {
  authenticatedService?: string;
  isAdmin?: boolean;
}

/**
 * Validates service-to-service requests.
 * Accepts:
 * 1. Bearer <secret> in Authorization header
 * 2. HMAC-SHA256 signature with X-JEMP-Signature and X-JEMP-Timestamp
 */
export function requireServiceAuth(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization;
  const signature = req.headers['x-jemp-signature'] as string | undefined;
  const timestampHeader = req.headers['x-jemp-timestamp'] as string | undefined;

  // 1. HMAC Signature with replay protection
  if (signature && timestampHeader) {
    const timestamp = parseInt(timestampHeader, 10);
    const now = Date.now();

    if (isNaN(timestamp) || Math.abs(now - timestamp) > REPLAY_WINDOW_MS) {
      return res.status(401).json({
        error: 'Authentication failed',
        message: 'Request timestamp is invalid or expired (replay protection)',
      });
    }

    const payload = `${req.method}:${req.originalUrl || req.url}:${timestampHeader}:${JSON.stringify(req.body || {})}`;
    const expectedSignature = crypto
      .createHmac('sha256', SERVICE_SECRET)
      .update(payload)
      .digest('hex');

    try {
      const match = crypto.timingSafeEqual(
        Buffer.from(signature, 'hex'),
        Buffer.from(expectedSignature, 'hex')
      );
      if (match) {
        req.authenticatedService = (req.headers['x-jemp-source'] as string) || 'AUTHENTICATED_SERVICE';
        return next();
      }
    } catch {
      // Signature length mismatch or malformed hex
    }
  }

  // 2. Direct Bearer token
  if (authHeader && authHeader.startsWith('Bearer ')) {
    const token = authHeader.substring(7).trim();
    if (token === SERVICE_SECRET) {
      req.authenticatedService = (req.headers['x-jemp-source'] as string) || 'AUTHENTICATED_SERVICE';
      return next();
    }
  }

  // If running in development without strict secret required or secret matches default
  if (process.env.NODE_ENV === 'development' && (!authHeader || authHeader === 'Bearer default')) {
    // Allow for easy developer exploration if explicit mock header passed
    req.authenticatedService = 'DEV_LOCAL_SERVICE';
    return next();
  }

  return res.status(401).json({
    error: 'Unauthorized',
    message: 'Invalid or missing service credentials (TIMELINE_SERVICE_SECRET required)',
  });
}

/**
 * Admin check middleware
 */
export function requireAdminAuth(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  const adminSecret = process.env.ADMIN_SECRET || SERVICE_SECRET;
  const authHeader = req.headers.authorization;

  if (authHeader && authHeader.startsWith('Bearer ')) {
    const token = authHeader.substring(7).trim();
    if (token === adminSecret) {
      req.isAdmin = true;
      return next();
    }
  }

  // In dev environment, allow if flagged
  if (process.env.NODE_ENV === 'development' || !process.env.DISCORD_TOKEN) {
    req.isAdmin = true;
    return next();
  }

  return res.status(403).json({
    error: 'Forbidden',
    message: 'Administrator authorization required',
  });
}
