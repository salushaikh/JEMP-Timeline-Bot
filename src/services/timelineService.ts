import { query } from '../db/database.ts';
import {
  TimelineEvent,
  IngestEventInput,
  ProofOfWorkStats,
  AdminCorrectionInput,
  Member,
} from '../types/timeline.ts';
import { logAudit } from './auditService.ts';
import crypto from 'crypto';

export async function ensureMember(jempId: string, discordUserId?: string, handle?: string): Promise<Member> {
  const existing = await query<Member>('SELECT * FROM members WHERE jemp_id = $1', [jempId]);
  if (existing.rows.length > 0) {
    return existing.rows[0];
  }

  const id = 'MEM-' + crypto.randomUUID().substring(0, 8);
  const fallbackDiscordId = discordUserId || 'disc_' + jempId.replace(/[^0-9]/g, '');
  const fallbackHandle = handle || `Builder (${jempId})`;

  await query(
    `INSERT INTO members (id, jemp_id, discord_user_id, handle, status, joined_at, created_at)
     VALUES ($1, $2, $3, $4, 'ACTIVE', NOW(), NOW())
     ON CONFLICT (jemp_id) DO NOTHING`,
    [id, jempId, fallbackDiscordId, fallbackHandle]
  );

  const res = await query<Member>('SELECT * FROM members WHERE jemp_id = $1', [jempId]);
  return res.rows[0];
}

export async function getMemberByJempId(jempId: string): Promise<Member | null> {
  const res = await query<Member>('SELECT * FROM members WHERE jemp_id = $1', [jempId]);
  return res.rows[0] || null;
}

export async function getMemberByDiscordId(discordUserId: string): Promise<Member | null> {
  const res = await query<Member>('SELECT * FROM members WHERE discord_user_id = $1', [discordUserId]);
  return res.rows[0] || null;
}

export async function getAllMembers(): Promise<Member[]> {
  const res = await query<Member>('SELECT * FROM members ORDER BY jemp_id ASC');
  return res.rows;
}

export async function ingestEvent(input: IngestEventInput, actor = 'SYSTEM', ipAddress?: string): Promise<{
  event: TimelineEvent;
  isDuplicate: boolean;
  status: 'created' | 'idempotent_duplicate';
}> {
  // 1. Check idempotency: (source_system, source_event_id)
  const existingRes = await query<TimelineEvent>(
    'SELECT * FROM timeline_events WHERE source_system = $1 AND source_event_id = $2',
    [input.sourceSystem, input.sourceEventId]
  );

  if (existingRes.rows.length > 0) {
    const existing = existingRes.rows[0];
    await logAudit({
      action: 'duplicate_event_rejected',
      actor,
      source_system: input.sourceSystem,
      jemp_id: input.memberJempId,
      details: {
        sourceEventId: input.sourceEventId,
        existingEventId: existing.event_id,
      },
      ip_address: ipAddress,
    });

    return {
      event: existing,
      isDuplicate: true,
      status: 'idempotent_duplicate',
    };
  }

  // 2. Ensure canonical member identity exists
  const member = await ensureMember(input.memberJempId);

  // 3. Generate event ID (TLE-xxxxx)
  const id = crypto.randomUUID();
  const eventId = 'TLE-' + crypto.randomUUID().substring(0, 8).toUpperCase();

  // Extract source entity information
  const entityType = input.sourceEntity?.type || null;
  const entityId = input.sourceEntity?.id || null;
  const entityName = input.sourceEntity?.name || null;

  let projectId: string | null = null;
  let projectName: string | null = null;
  let brainstormId: string | null = null;
  let brainstormName: string | null = null;
  let opportunityId: string | null = null;
  let opportunityName: string | null = null;

  if (entityType === 'PROJECT') {
    projectId = entityId;
    projectName = entityName;
  } else if (entityType === 'BRAINSTORM') {
    brainstormId = entityId;
    brainstormName = entityName;
  } else if (entityType === 'OPPORTUNITY') {
    opportunityId = entityId;
    opportunityName = entityName;
  }

  // Determine authority and visibility defaults based on event type if not provided
  const authority = input.authority || 'OFFICIAL';
  const visibility = input.visibility || (input.eventType.startsWith('MEMBER_') || input.eventType.startsWith('RULES_') ? 'MEMBER_VISIBLE' : 'SHAREABLE');

  const insertSql = `
    INSERT INTO timeline_events (
      id, event_id, member_id, jemp_id, event_type, authority,
      title, description, occurred_at, recorded_at,
      source_system, source_event_id, source_entity_type, source_entity_id, source_entity_name,
      project_id, project_name, brainstorm_id, brainstorm_name, opportunity_id, opportunity_name,
      metadata, visibility, immutable, created_by, created_at
    ) VALUES (
      $1, $2, $3, $4, $5, $6,
      $7, $8, $9, NOW(),
      $10, $11, $12, $13, $14,
      $15, $16, $17, $18, $19, $20,
      $21, $22, true, $23, NOW()
    )
    RETURNING *;
  `;

  const values = [
    id,
    eventId,
    member.id,
    member.jemp_id,
    input.eventType,
    authority,
    input.title,
    input.description,
    new Date(input.occurredAt),
    input.sourceSystem,
    input.sourceEventId,
    entityType,
    entityId,
    entityName,
    projectId,
    projectName,
    brainstormId,
    brainstormName,
    opportunityId,
    opportunityName,
    JSON.stringify(input.metadata || {}),
    visibility,
    actor,
  ];

  const insertRes = await query<TimelineEvent>(insertSql, values);
  const createdEvent = insertRes.rows[0];

  await logAudit({
    action: 'event_created',
    actor,
    source_system: input.sourceSystem,
    jemp_id: input.memberJempId,
    details: {
      eventId: createdEvent.event_id,
      eventType: createdEvent.event_type,
      title: createdEvent.title,
      sourceEventId: input.sourceEventId,
    },
    ip_address: ipAddress,
  });

  return {
    event: createdEvent,
    isDuplicate: false,
    status: 'created',
  };
}

export interface GetTimelineOptions {
  jempId: string;
  year?: number;
  month?: number; // 1-12
  eventType?: string;
  sourceSystem?: string;
  projectId?: string;
  brainstormId?: string;
  opportunityId?: string;
  search?: string;
  visibility?: string[]; // e.g. ['SHAREABLE', 'PUBLIC']
  authority?: string;
  limit?: number;
  offset?: number;
}

export async function getMemberTimeline(options: GetTimelineOptions): Promise<{ events: TimelineEvent[]; total: number }> {
  const whereClauses: string[] = ['jemp_id = $1'];
  const params: any[] = [options.jempId];
  let paramIndex = 2;

  if (options.year) {
    whereClauses.push(`EXTRACT(YEAR FROM occurred_at) = $${paramIndex++}`);
    params.push(options.year);
  }

  if (options.month) {
    whereClauses.push(`EXTRACT(MONTH FROM occurred_at) = $${paramIndex++}`);
    params.push(options.month);
  }

  if (options.eventType) {
    whereClauses.push(`event_type = $${paramIndex++}`);
    params.push(options.eventType);
  }

  if (options.sourceSystem) {
    whereClauses.push(`source_system = $${paramIndex++}`);
    params.push(options.sourceSystem);
  }

  if (options.projectId) {
    whereClauses.push(`project_id = $${paramIndex++}`);
    params.push(options.projectId);
  }

  if (options.brainstormId) {
    whereClauses.push(`brainstorm_id = $${paramIndex++}`);
    params.push(options.brainstormId);
  }

  if (options.opportunityId) {
    whereClauses.push(`opportunity_id = $${paramIndex++}`);
    params.push(options.opportunityId);
  }

  if (options.authority) {
    whereClauses.push(`authority = $${paramIndex++}`);
    params.push(options.authority);
  }

  if (options.visibility && options.visibility.length > 0) {
    whereClauses.push(`visibility = ANY($${paramIndex++})`);
    params.push(options.visibility);
  }

  if (options.search && options.search.trim().length > 0) {
    const term = `%${options.search.trim()}%`;
    whereClauses.push(`(
      title ILIKE $${paramIndex} OR
      description ILIKE $${paramIndex} OR
      project_name ILIKE $${paramIndex} OR
      project_id ILIKE $${paramIndex} OR
      brainstorm_name ILIKE $${paramIndex} OR
      brainstorm_id ILIKE $${paramIndex} OR
      opportunity_name ILIKE $${paramIndex} OR
      opportunity_id ILIKE $${paramIndex} OR
      event_type ILIKE $${paramIndex}
    )`);
    params.push(term);
    paramIndex++;
  }

  const whereSql = whereClauses.join(' AND ');

  const countRes = await query<{ count: number }>(
    `SELECT COUNT(*)::int as count FROM timeline_events WHERE ${whereSql}`,
    params
  );
  const total = countRes.rows[0]?.count || 0;

  let limitClause = '';
  if (options.limit) {
    limitClause = `LIMIT ${Math.max(1, options.limit)}`;
    if (options.offset) {
      limitClause += ` OFFSET ${Math.max(0, options.offset)}`;
    }
  }

  const eventsRes = await query<TimelineEvent>(
    `SELECT * FROM timeline_events WHERE ${whereSql} ORDER BY occurred_at DESC, recorded_at DESC ${limitClause}`,
    params
  );

  return {
    events: eventsRes.rows,
    total,
  };
}

export async function getMemberYears(jempId: string): Promise<number[]> {
  const res = await query<{ year: number }>(
    `SELECT DISTINCT EXTRACT(YEAR FROM occurred_at)::int as year
     FROM timeline_events
     WHERE jemp_id = $1
     ORDER BY year DESC`,
    [jempId]
  );
  return res.rows.map((r) => r.year);
}

export async function getMemberMonths(jempId: string, year: number): Promise<{ month: number; name: string; count: number }[]> {
  const monthNames = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ];

  const res = await query<{ month: number; count: number }>(
    `SELECT EXTRACT(MONTH FROM occurred_at)::int as month, COUNT(*)::int as count
     FROM timeline_events
     WHERE jemp_id = $1 AND EXTRACT(YEAR FROM occurred_at) = $2
     GROUP BY month
     ORDER BY month DESC`,
    [jempId, year]
  );

  return res.rows.map((r) => ({
    month: r.month,
    name: monthNames[r.month - 1],
    count: r.count,
  }));
}

export async function getMemberStats(jempId: string): Promise<ProofOfWorkStats> {
  const statsRes = await query<{
    total_entries: number;
    official_entries: number;
    projects_participated: number;
    brainstorms_participated: number;
    client_opportunities: number;
    milestones_completed: number;
    reports_submitted: number;
    work_updates: number;
    first_event: string;
    latest_event: string;
  }>(
    `SELECT
       COUNT(*)::int as total_entries,
       COUNT(CASE WHEN authority IN ('OFFICIAL', 'SYSTEM_RECORDED') THEN 1 END)::int as official_entries,
       COUNT(DISTINCT project_id)::int as projects_participated,
       COUNT(DISTINCT brainstorm_id)::int as brainstorms_participated,
       COUNT(DISTINCT opportunity_id)::int as client_opportunities,
       COUNT(CASE WHEN event_type IN ('MILESTONE_COMPLETED', 'CLIENT_MILESTONE', 'BRAINSTORM_MILESTONE') THEN 1 END)::int as milestones_completed,
       COUNT(CASE WHEN event_type IN ('PROJECT_REPORT', 'CLIENT_REPORT') THEN 1 END)::int as reports_submitted,
       COUNT(CASE WHEN event_type = 'WORK_UPDATE' THEN 1 END)::int as work_updates,
       MIN(occurred_at) as first_event,
       MAX(occurred_at) as latest_event
     FROM timeline_events
     WHERE jemp_id = $1`,
    [jempId]
  );

  const row = statsRes.rows[0] || {
    total_entries: 0,
    official_entries: 0,
    projects_participated: 0,
    brainstorms_participated: 0,
    client_opportunities: 0,
    milestones_completed: 0,
    reports_submitted: 0,
    work_updates: 0,
    first_event: null,
    latest_event: null,
  };

  return {
    jemp_id: jempId,
    total_entries: row.total_entries,
    official_entries: row.official_entries,
    projects_participated: row.projects_participated,
    brainstorms_participated: row.brainstorms_participated,
    client_opportunities: row.client_opportunities,
    milestones_completed: row.milestones_completed,
    reports_submitted: row.reports_submitted,
    work_updates: row.work_updates,
    first_event_at: row.first_event ? new Date(row.first_event).toISOString() : null,
    latest_event_at: row.latest_event ? new Date(row.latest_event).toISOString() : null,
  };
}

export async function createAdminCorrection(input: AdminCorrectionInput): Promise<{
  originalEvent: TimelineEvent;
  correctionEvent: TimelineEvent;
}> {
  // 1. Fetch original event
  const origRes = await query<TimelineEvent>('SELECT * FROM timeline_events WHERE event_id = $1 OR id = $1', [
    input.originalEventId,
  ]);

  if (origRes.rows.length === 0) {
    throw new Error(`Original event ${input.originalEventId} not found`);
  }

  const origEvent = origRes.rows[0];

  // 2. Generate new ADMIN_CORRECTION event
  const correctionId = crypto.randomUUID();
  const correctionEventId = 'TLE-CORR-' + crypto.randomUUID().substring(0, 8).toUpperCase();

  const entityType = input.correctedSourceEntity?.type || origEvent.source_entity_type;
  const entityId = input.correctedSourceEntity?.id || origEvent.source_entity_id;
  const entityName = input.correctedSourceEntity?.name || origEvent.source_entity_name;

  let projectId = origEvent.project_id;
  let projectName = origEvent.project_name;
  let brainstormId = origEvent.brainstorm_id;
  let brainstormName = origEvent.brainstorm_name;
  let opportunityId = origEvent.opportunity_id;
  let opportunityName = origEvent.opportunity_name;

  if (entityType === 'PROJECT') {
    projectId = entityId;
    projectName = entityName;
  } else if (entityType === 'BRAINSTORM') {
    brainstormId = entityId;
    brainstormName = entityName;
  } else if (entityType === 'OPPORTUNITY') {
    opportunityId = entityId;
    opportunityName = entityName;
  }

  const title = input.correctedTitle || `Correction for [${origEvent.event_id}]: ${origEvent.title}`;
  const description = input.correctedDescription
    ? `${input.correctedDescription} (Correction reason: ${input.reason})`
    : `Administrative correction applied: ${input.reason}. Original statement: "${origEvent.description}"`;

  const corrSql = `
    INSERT INTO timeline_events (
      id, event_id, member_id, jemp_id, event_type, authority,
      title, description, occurred_at, recorded_at,
      source_system, source_event_id, source_entity_type, source_entity_id, source_entity_name,
      project_id, project_name, brainstorm_id, brainstorm_name, opportunity_id, opportunity_name,
      metadata, visibility, immutable, created_by, created_at
    ) VALUES (
      $1, $2, $3, $4, 'ADMIN_CORRECTION', 'ADMIN_CORRECTION',
      $5, $6, $7, NOW(),
      'ADMIN', $8, $9, $10, $11,
      $12, $13, $14, $15, $16, $17,
      $18, $19, true, $20, NOW()
    ) RETURNING *;
  `;

  const corrRes = await query<TimelineEvent>(corrSql, [
    correctionId,
    correctionEventId,
    origEvent.member_id,
    origEvent.jemp_id,
    title,
    description,
    new Date(origEvent.occurred_at),
    `CORR-${origEvent.event_id}-${Date.now()}`,
    entityType,
    entityId,
    entityName,
    projectId,
    projectName,
    brainstormId,
    brainstormName,
    opportunityId,
    opportunityName,
    JSON.stringify({
      original_event_id: origEvent.event_id,
      reason: input.reason,
      corrected_by: input.adminUser,
    }),
    origEvent.visibility,
    input.adminUser,
  ]);

  const correctionEvent = corrRes.rows[0];

  // 3. Mark original event with pointer to correction (without changing its historical contents)
  await query(
    `UPDATE timeline_events
     SET corrected_by_event_id = $1, correction_reason = $2
     WHERE event_id = $3`,
    [correctionEvent.event_id, input.reason, origEvent.event_id]
  );

  await logAudit({
    action: 'event_correction',
    actor: input.adminUser,
    source_system: 'ADMIN',
    jemp_id: origEvent.jemp_id,
    details: {
      originalEventId: origEvent.event_id,
      correctionEventId: correctionEvent.event_id,
      reason: input.reason,
    },
  });

  return {
    originalEvent: origEvent,
    correctionEvent,
  };
}
