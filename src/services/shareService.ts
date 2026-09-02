import { query } from '../db/database.ts';
import { generateShareToken, hashToken, verifyTokenHash } from '../security/token.ts';
import { TimelineShare, TimelineEvent } from '../types/timeline.ts';
import { getMemberByJempId } from './timelineService.ts';
import { logAudit } from './auditService.ts';
import crypto from 'crypto';

export interface CreateShareResult {
  shareId: string;
  jempId: string;
  rawToken: string;
  shareUrl: string;
  expiresAt: string;
  createdAt: string;
}

export interface PublicSharePayload {
  status: 'ACTIVE' | 'EXPIRED' | 'REVOKED' | 'NOT_FOUND';
  jempId?: string;
  memberStatus?: string;
  createdAt?: string;
  expiresAt?: string;
  shareUrl?: string;
  events: Array<{
    eventId: string;
    date: string;
    eventType: string;
    authority: string;
    title: string;
    description: string;
    sourceSystem: string;
    relatedEntity?: {
      type: string;
      id: string;
      name: string;
    } | null;
  }>;
  stats?: {
    totalEntries: number;
    projectsParticipated: number;
    brainstormsParticipated: number;
    clientOpportunities: number;
    milestonesCompleted: number;
  };
}

export async function createTimelineShare(params: {
  jempId: string;
  createdBy?: string;
  expiryHours?: number;
}): Promise<CreateShareResult> {
  const member = await getMemberByJempId(params.jempId);
  if (!member) {
    throw new Error(`Member with JEMP ID ${params.jempId} does not exist`);
  }

  const rawToken = generateShareToken();
  const tokenHash = hashToken(rawToken);
  const shareId = 'SHR-' + crypto.randomUUID().substring(0, 8).toUpperCase();
  const hours = params.expiryHours || parseInt(process.env.SHARE_EXPIRY_HOURS || '24', 10);

  const expiresAtDate = new Date(Date.now() + hours * 60 * 60 * 1000);

  await query(
    `INSERT INTO timeline_shares (
      id, share_id, member_id, jemp_id, token_hash,
      created_at, expires_at, created_by, access_count
    ) VALUES ($1, $2, $3, $4, $5, NOW(), $6, $7, 0)`,
    [
      crypto.randomUUID(),
      shareId,
      member.id,
      member.jemp_id,
      tokenHash,
      expiresAtDate,
      params.createdBy || 'MEMBER',
    ]
  );

  const baseUrl = (process.env.PUBLIC_SHARE_BASE_URL || 'https://despair.us/timeline/share').replace(/\/+$/, '');
  const shareUrl = `${baseUrl}/${rawToken}`;

  await logAudit({
    action: 'share_created',
    actor: params.createdBy || member.jemp_id,
    source_system: 'TIMELINE',
    jemp_id: member.jemp_id,
    details: {
      shareId,
      expiresAt: expiresAtDate.toISOString(),
    },
  });

  return {
    shareId,
    jempId: member.jemp_id,
    rawToken,
    shareUrl,
    expiresAt: expiresAtDate.toISOString(),
    createdAt: new Date().toISOString(),
  };
}

export async function getMemberActiveShares(jempId: string): Promise<TimelineShare[]> {
  const res = await query<TimelineShare>(
    `SELECT id, share_id, member_id, jemp_id, token_hash, created_at, expires_at, revoked_at, created_by, access_count, last_accessed_at
     FROM timeline_shares
     WHERE jemp_id = $1 AND revoked_at IS NULL AND expires_at > NOW()
     ORDER BY created_at DESC`,
    [jempId]
  );
  return res.rows;
}

export async function revokeTimelineShare(tokenOrShareId: string, actor = 'MEMBER'): Promise<boolean> {
  const tokenH = hashToken(tokenOrShareId);

  const res = await query<TimelineShare>(
    `UPDATE timeline_shares
     SET revoked_at = NOW()
     WHERE (token_hash = $1 OR share_id = $2) AND revoked_at IS NULL
     RETURNING *`,
    [tokenH, tokenOrShareId]
  );

  if (res.rows.length > 0) {
    const revoked = res.rows[0];
    await logAudit({
      action: 'share_revoked',
      actor,
      source_system: 'TIMELINE',
      jemp_id: revoked.jemp_id,
      details: {
        shareId: revoked.share_id,
      },
    });
    return true;
  }

  return false;
}

export async function resolvePublicShare(token: string): Promise<PublicSharePayload> {
  if (!token || token.trim().length < 16) {
    return { status: 'NOT_FOUND', events: [] };
  }

  const computedHash = hashToken(token);
  const shareRes = await query<TimelineShare>(
    `SELECT * FROM timeline_shares WHERE token_hash = $1`,
    [computedHash]
  );

  if (shareRes.rows.length === 0) {
    return { status: 'NOT_FOUND', events: [] };
  }

  const share = shareRes.rows[0];

  if (share.revoked_at) {
    return {
      status: 'REVOKED',
      jempId: share.jemp_id,
      createdAt: new Date(share.created_at).toISOString(),
      expiresAt: new Date(share.expires_at).toISOString(),
      events: [],
    };
  }

  const now = new Date();
  if (now > new Date(share.expires_at)) {
    return {
      status: 'EXPIRED',
      jempId: share.jemp_id,
      createdAt: new Date(share.created_at).toISOString(),
      expiresAt: new Date(share.expires_at).toISOString(),
      events: [],
    };
  }

  // Increment access count safely
  await query(
    `UPDATE timeline_shares
     SET access_count = access_count + 1, last_accessed_at = NOW()
     WHERE id = $1`,
    [share.id]
  );

  // Fetch only shareable / public events
  const eventsRes = await query<TimelineEvent>(
    `SELECT event_id, occurred_at, event_type, authority, title, description,
            source_system, source_entity_type, source_entity_id, source_entity_name
     FROM timeline_events
     WHERE jemp_id = $1 AND visibility IN ('SHAREABLE', 'PUBLIC')
     ORDER BY occurred_at DESC`,
    [share.jemp_id]
  );

  const events = eventsRes.rows.map((e) => {
    let relatedEntity: { type: string; id: string; name: string } | null = null;
    if (e.source_entity_type && e.source_entity_id) {
      relatedEntity = {
        type: e.source_entity_type,
        id: e.source_entity_id,
        name: e.source_entity_name || e.source_entity_id,
      };
    }

    return {
      eventId: e.event_id,
      date: new Date(e.occurred_at).toISOString().split('T')[0],
      eventType: e.event_type,
      authority: e.authority,
      title: e.title,
      description: e.description,
      sourceSystem: e.source_system,
      relatedEntity,
    };
  });

  // Calculate high-level public stats
  const projects = new Set<string>();
  const brainstorms = new Set<string>();
  const opportunities = new Set<string>();
  let milestones = 0;

  events.forEach((ev) => {
    if (ev.relatedEntity?.type === 'PROJECT') projects.add(ev.relatedEntity.id);
    if (ev.relatedEntity?.type === 'BRAINSTORM') brainstorms.add(ev.relatedEntity.id);
    if (ev.relatedEntity?.type === 'OPPORTUNITY') opportunities.add(ev.relatedEntity.id);
    if (ev.eventType.includes('MILESTONE')) milestones++;
  });

  return {
    status: 'ACTIVE',
    jempId: share.jemp_id,
    memberStatus: 'ACTIVE',
    createdAt: new Date(share.created_at).toISOString(),
    expiresAt: new Date(share.expires_at).toISOString(),
    events,
    stats: {
      totalEntries: events.length,
      projectsParticipated: projects.size,
      brainstormsParticipated: brainstorms.size,
      clientOpportunities: opportunities.size,
      milestonesCompleted: milestones,
    },
  };
}
