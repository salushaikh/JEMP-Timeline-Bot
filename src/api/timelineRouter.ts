import { Router, Request, Response } from 'express';
import { requireServiceAuth, requireAdminAuth, AuthenticatedRequest } from '../security/auth.ts';
import { rateLimiter } from '../security/rateLimiter.ts';
import { IngestEventSchema, AdminCorrectionSchema } from '../types/timeline.ts';
import {
  ingestEvent,
  getMemberTimeline,
  getMemberYears,
  getMemberMonths,
  getMemberStats,
  createAdminCorrection,
  getAllMembers,
  getMemberByJempId,
} from '../services/timelineService.ts';
import {
  createTimelineShare,
  getMemberActiveShares,
  revokeTimelineShare,
  resolvePublicShare,
} from '../services/shareService.ts';
import { generateExport } from '../services/exportService.ts';
import { getAuditLogs, runReconciliationDiagnostics } from '../services/auditService.ts';
import { seedDemoData, clearDemoData } from '../services/seedService.ts';

export const timelineRouter = Router();

function normalizeJempId(raw: string): string {
  if (!raw) return raw;
  const decoded = decodeURIComponent(raw);
  if (/^JEMP\d+$/i.test(decoded)) {
    return 'JEMP#' + decoded.substring(4);
  }
  return decoded;
}

// Apply rate limiting
timelineRouter.use(rateLimiter());

// ==========================================
// 1. EVENT INGESTION (Protected by TIMELINE_SERVICE_SECRET)
// ==========================================
timelineRouter.post('/events', requireServiceAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const parseResult = IngestEventSchema.safeParse(req.body);
    if (!parseResult.success) {
      return res.status(400).json({
        error: 'Validation failed',
        details: parseResult.error.flatten(),
      });
    }

    const actor = req.authenticatedService || (req.body.sourceSystem as string) || 'UNKNOWN_BOT';
    const result = await ingestEvent(parseResult.data, actor, req.ip);

    if (result.isDuplicate) {
      // Return 200 with idempotent flag to prevent caller retry loops
      return res.status(200).json({
        status: 'idempotent_duplicate',
        message: 'Event with (sourceSystem, sourceEventId) has already been recorded in the canonical timeline',
        event: result.event,
      });
    }

    return res.status(201).json({
      status: 'created',
      message: 'Official timeline event recorded',
      event: result.event,
    });
  } catch (error: any) {
    console.error('Failed to ingest timeline event:', error);
    return res.status(500).json({
      error: 'Internal Server Error',
      message: error.message || 'Failed to record event in canonical timeline',
    });
  }
});

// ==========================================
// 2. MEMBER TIMELINE & SEARCH
// ==========================================
timelineRouter.get('/members', async (req: Request, res: Response) => {
  try {
    const members = await getAllMembers();
    return res.json({ members });
  } catch (error: any) {
    return res.status(500).json({ error: error.message });
  }
});

timelineRouter.get('/members/:jempId', async (req: Request, res: Response) => {
  try {
    const jempId = normalizeJempId(req.params.jempId);
    const {
      year,
      month,
      eventType,
      sourceSystem,
      projectId,
      brainstormId,
      opportunityId,
      search,
      authority,
      visibility,
      limit,
      offset,
    } = req.query;

    const visArray = visibility ? (typeof visibility === 'string' ? visibility.split(',') : (visibility as string[])) : undefined;

    const result = await getMemberTimeline({
      jempId,
      year: year ? parseInt(year as string, 10) : undefined,
      month: month ? parseInt(month as string, 10) : undefined,
      eventType: eventType as string,
      sourceSystem: sourceSystem as string,
      projectId: projectId as string,
      brainstormId: brainstormId as string,
      opportunityId: opportunityId as string,
      search: search as string,
      authority: authority as string,
      visibility: visArray,
      limit: limit ? parseInt(limit as string, 10) : 50,
      offset: offset ? parseInt(offset as string, 10) : 0,
    });

    const member = await getMemberByJempId(jempId);

    return res.json({
      jempId,
      member,
      total: result.total,
      events: result.events,
    });
  } catch (error: any) {
    return res.status(500).json({ error: error.message });
  }
});

timelineRouter.get('/members/:jempId/stats', async (req: Request, res: Response) => {
  try {
    const jempId = normalizeJempId(req.params.jempId);
    const stats = await getMemberStats(jempId);
    return res.json({ stats });
  } catch (error: any) {
    return res.status(500).json({ error: error.message });
  }
});

timelineRouter.get('/members/:jempId/years', async (req: Request, res: Response) => {
  try {
    const jempId = normalizeJempId(req.params.jempId);
    const years = await getMemberYears(jempId);
    return res.json({ jempId, years });
  } catch (error: any) {
    return res.status(500).json({ error: error.message });
  }
});

timelineRouter.get('/members/:jempId/months', async (req: Request, res: Response) => {
  try {
    const jempId = normalizeJempId(req.params.jempId);
    const year = parseInt(req.query.year as string, 10) || new Date().getFullYear();
    const months = await getMemberMonths(jempId, year);
    return res.json({ jempId, year, months });
  } catch (error: any) {
    return res.status(500).json({ error: error.message });
  }
});

timelineRouter.get('/members/:jempId/search', async (req: Request, res: Response) => {
  try {
    const jempId = normalizeJempId(req.params.jempId);
    const q = (req.query.q as string) || '';

    const result = await getMemberTimeline({
      jempId,
      search: q,
      limit: 100,
    });

    return res.json({
      jempId,
      query: q,
      totalMatches: result.total,
      results: result.events,
    });
  } catch (error: any) {
    return res.status(500).json({ error: error.message });
  }
});

// ==========================================
// 3. EXPORTS (PDF, DOCX, Markdown, JSON)
// ==========================================
timelineRouter.get('/members/:jempId/export', async (req: Request, res: Response) => {
  try {
    const jempId = normalizeJempId(req.params.jempId);
    const format = ((req.query.format as string) || 'pdf').toLowerCase() as 'pdf' | 'docx' | 'markdown' | 'json';
    const scope = ((req.query.scope as string) || 'full') as 'full' | 'year' | 'project' | 'shareable';
    const filterVal = req.query.filterVal as string;

    const exportResult = await generateExport({
      jempId,
      format,
      scope,
      filterVal,
      shareableOnly: req.query.shareableOnly === 'true',
    });

    res.setHeader('Content-Type', exportResult.contentType);
    res.setHeader('Content-Disposition', `attachment; filename="${exportResult.filename}"`);

    if (exportResult.buffer) {
      return res.send(exportResult.buffer);
    } else {
      return res.send(exportResult.text);
    }
  } catch (error: any) {
    console.error('Export error:', error);
    return res.status(500).json({ error: error.message });
  }
});

// ==========================================
// 4. PUBLIC SHARES
// ==========================================
timelineRouter.post('/shares', async (req: Request, res: Response) => {
  try {
    const { jempId, expiryHours, createdBy } = req.body;
    if (!jempId) {
      return res.status(400).json({ error: 'jempId is required' });
    }

    const share = await createTimelineShare({
      jempId,
      expiryHours: expiryHours ? parseInt(expiryHours, 10) : 24,
      createdBy: createdBy || 'MEMBER',
    });

    return res.status(201).json({
      status: 'created',
      share,
    });
  } catch (error: any) {
    return res.status(400).json({ error: error.message });
  }
});

timelineRouter.get('/shares/active/:jempId', async (req: Request, res: Response) => {
  try {
    const { jempId } = req.params;
    const shares = await getMemberActiveShares(jempId);
    return res.json({ jempId, activeShares: shares });
  } catch (error: any) {
    return res.status(500).json({ error: error.message });
  }
});

timelineRouter.get('/shares/:token', async (req: Request, res: Response) => {
  try {
    const { token } = req.params;
    const payload = await resolvePublicShare(token);

    if (payload.status === 'NOT_FOUND') {
      return res.status(404).json({ error: 'Share link not found or invalid' });
    }
    if (payload.status === 'EXPIRED') {
      return res.status(410).json({ error: 'SHARE EXPIRED', message: 'This public share token has expired after 24 hours.' });
    }
    if (payload.status === 'REVOKED') {
      return res.status(410).json({ error: 'SHARE REVOKED', message: 'This share link was revoked by the member.' });
    }

    return res.json(payload);
  } catch (error: any) {
    return res.status(500).json({ error: error.message });
  }
});

timelineRouter.post('/shares/:token/revoke', async (req: Request, res: Response) => {
  try {
    const { token } = req.params;
    const revoked = await revokeTimelineShare(token, req.body.actor || 'MEMBER');
    if (!revoked) {
      return res.status(404).json({ error: 'Share link not found or already revoked' });
    }
    return res.json({ status: 'revoked', message: 'Share link successfully revoked' });
  } catch (error: any) {
    return res.status(500).json({ error: error.message });
  }
});

// ==========================================
// 5. ADMIN & DIAGNOSTICS
// ==========================================
timelineRouter.post('/admin/correction', requireAdminAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const parse = AdminCorrectionSchema.safeParse(req.body);
    if (!parse.success) {
      return res.status(400).json({ error: 'Invalid correction input', details: parse.error.flatten() });
    }

    const result = await createAdminCorrection(parse.data);
    return res.status(201).json({
      status: 'corrected',
      message: 'Official ADMIN_CORRECTION event created without mutating original record',
      originalEvent: result.originalEvent,
      correctionEvent: result.correctionEvent,
    });
  } catch (error: any) {
    return res.status(400).json({ error: error.message });
  }
});

timelineRouter.get('/admin/audit', requireAdminAuth, async (req: Request, res: Response) => {
  try {
    const limit = parseInt(req.query.limit as string, 10) || 50;
    const jempId = req.query.jempId as string | undefined;
    const logs = await getAuditLogs(limit, jempId);
    return res.json({ logs });
  } catch (error: any) {
    return res.status(500).json({ error: error.message });
  }
});

timelineRouter.get('/admin/reconcile', requireAdminAuth, async (req: Request, res: Response) => {
  try {
    const diagnostics = await runReconciliationDiagnostics();
    return res.json({ diagnostics });
  } catch (error: any) {
    return res.status(500).json({ error: error.message });
  }
});

timelineRouter.post('/admin/seed-demo', requireAdminAuth, async (req: Request, res: Response) => {
  try {
    const result = await seedDemoData();
    return res.json(result);
  } catch (error: any) {
    return res.status(500).json({ error: error.message });
  }
});

timelineRouter.post('/admin/clear-demo', requireAdminAuth, async (req: Request, res: Response) => {
  try {
    const result = await clearDemoData();
    return res.json(result);
  } catch (error: any) {
    return res.status(500).json({ error: error.message });
  }
});
