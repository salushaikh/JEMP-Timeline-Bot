import { query } from '../db/database.ts';
import crypto from 'crypto';
import { AuditLogEntry } from '../types/timeline.ts';

export async function logAudit(params: {
  action: string;
  actor: string;
  source_system: string;
  jemp_id?: string | null;
  details?: Record<string, any>;
  ip_address?: string | null;
}): Promise<void> {
  try {
    const id = 'AUD-' + crypto.randomUUID().substring(0, 8);
    // Sanitize details to ensure no secrets are logged
    const sanitizedDetails = { ...(params.details || {}) };
    delete sanitizedDetails.secret;
    delete sanitizedDetails.token;
    delete sanitizedDetails.password;
    delete sanitizedDetails.signature;

    await query(
      `INSERT INTO timeline_audit_log (id, action, actor, source_system, jemp_id, details, ip_address, timestamp)
       VALUES ($1, $2, $3, $4, $5, $6, $7, NOW())`,
      [
        id,
        params.action,
        params.actor,
        params.source_system,
        params.jemp_id || null,
        JSON.stringify(sanitizedDetails),
        params.ip_address || null,
      ]
    );
  } catch (error) {
    console.error('Failed to write audit log:', error);
  }
}

export async function getAuditLogs(limit = 100, jempId?: string): Promise<AuditLogEntry[]> {
  if (jempId) {
    const res = await query<AuditLogEntry>(
      `SELECT * FROM timeline_audit_log WHERE jemp_id = $1 ORDER BY timestamp DESC LIMIT $2`,
      [jempId, limit]
    );
    return res.rows;
  }
  const res = await query<AuditLogEntry>(
    `SELECT * FROM timeline_audit_log ORDER BY timestamp DESC LIMIT $1`,
    [limit]
  );
  return res.rows;
}

export async function runReconciliationDiagnostics() {
  // 1. Missing members referenced in events
  const missingMembersRes = await query<{ jemp_id: string; count: number }>(
    `SELECT t.jemp_id, COUNT(*)::int as count 
     FROM timeline_events t 
     LEFT JOIN members m ON t.jemp_id = m.jemp_id 
     WHERE m.jemp_id IS NULL 
     GROUP BY t.jemp_id`
  );

  // 2. Duplicate source event check (should be 0 due to unique constraint, but verify)
  const duplicateSourcesRes = await query<{ source_system: string; source_event_id: string; count: number }>(
    `SELECT source_system, source_event_id, COUNT(*)::int as count 
     FROM timeline_events 
     GROUP BY source_system, source_event_id 
     HAVING COUNT(*) > 1`
  );

  // 3. Events with malformed dates or future dates
  const futureDatesRes = await query<{ count: number }>(
    `SELECT COUNT(*)::int as count 
     FROM timeline_events 
     WHERE occurred_at > NOW() + INTERVAL '1 day'`
  );

  // 4. Corrections count
  const correctionsRes = await query<{ count: number }>(
    `SELECT COUNT(*)::int as count 
     FROM timeline_events 
     WHERE event_type = 'ADMIN_CORRECTION' OR authority = 'ADMIN_CORRECTION'`
  );

  // 5. Total events count & total members count
  const totalsRes = await query<{ events_count: number; members_count: number }>(
    `SELECT 
       (SELECT COUNT(*)::int FROM timeline_events) as events_count,
       (SELECT COUNT(*)::int FROM members) as members_count`
  );

  return {
    timestamp: new Date().toISOString(),
    status: missingMembersRes.rows.length === 0 && duplicateSourcesRes.rows.length === 0 ? 'HEALTHY' : 'WARNING',
    summary: {
      totalEvents: totalsRes.rows[0]?.events_count || 0,
      totalMembers: totalsRes.rows[0]?.members_count || 0,
      totalCorrections: correctionsRes.rows[0]?.count || 0,
      futureEvents: futureDatesRes.rows[0]?.count || 0,
    },
    issues: {
      missingMembers: missingMembersRes.rows,
      duplicateSources: duplicateSourcesRes.rows,
    },
  };
}
