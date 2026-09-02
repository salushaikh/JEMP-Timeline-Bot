import { z } from 'zod';

export type SourceSystem =
  | 'ONBOARDING'
  | 'BRAINSTORMING'
  | 'PROJECT_MANAGEMENT'
  | 'CLIENT_HIRING'
  | 'PAYROLL'
  | 'ADMIN'
  | 'SYSTEM';

export type Authority =
  | 'OFFICIAL'
  | 'SYSTEM_RECORDED'
  | 'MEMBER_AUTHORED'
  | 'ADMIN_CORRECTION';

export type Visibility =
  | 'PRIVATE'
  | 'MEMBER_VISIBLE'
  | 'SHAREABLE'
  | 'PUBLIC';

export type EntityType =
  | 'PROJECT'
  | 'BRAINSTORM'
  | 'OPPORTUNITY'
  | 'PAYMENT'
  | 'MEMBER'
  | 'SYSTEM';

export interface TimelineEvent {
  id: string;
  event_id: string;
  member_id: string;
  jemp_id: string;
  event_type: string;
  authority: Authority;
  title: string;
  description: string;
  occurred_at: string;
  recorded_at: string;
  source_system: SourceSystem;
  source_event_id: string;
  source_entity_type?: EntityType | null;
  source_entity_id?: string | null;
  source_entity_name?: string | null;
  project_id?: string | null;
  project_name?: string | null;
  brainstorm_id?: string | null;
  brainstorm_name?: string | null;
  opportunity_id?: string | null;
  opportunity_name?: string | null;
  metadata: Record<string, any>;
  visibility: Visibility;
  immutable: boolean;
  corrected_by_event_id?: string | null;
  correction_reason?: string | null;
  created_by: string;
  created_at: string;
}

export interface Member {
  id: string;
  jemp_id: string;
  discord_user_id: string;
  status: 'ACTIVE' | 'ONBOARDING' | 'SUSPENDED' | 'TERMINATED';
  handle: string;
  joined_at: string;
  created_at: string;
}

export interface TimelineShare {
  id: string;
  share_id: string;
  member_id: string;
  jemp_id: string;
  token_hash: string;
  created_at: string;
  expires_at: string;
  revoked_at?: string | null;
  created_by: string;
  access_count: number;
  last_accessed_at?: string | null;
}

export interface TimelineExport {
  id: string;
  export_id: string;
  member_id: string;
  jemp_id: string;
  format: 'pdf' | 'docx' | 'markdown' | 'json';
  scope: 'full' | 'year' | 'project' | 'shareable';
  filter_val?: string | null;
  event_count: number;
  generated_at: string;
}

export interface AuditLogEntry {
  id: string;
  timestamp: string;
  action: string;
  actor: string;
  source_system: string;
  jemp_id?: string | null;
  details: Record<string, any>;
  ip_address?: string | null;
  metadata?: Record<string, any>;
}

export type AuditLog = AuditLogEntry;

export interface ProofOfWorkStats {
  jemp_id: string;
  total_entries: number;
  official_entries: number;
  projects_participated: number;
  brainstorms_participated: number;
  client_opportunities: number;
  milestones_completed: number;
  reports_submitted: number;
  work_updates: number;
  first_event_at?: string | null;
  latest_event_at?: string | null;
}

// Zod schema for Event Ingestion API
export const IngestEventSchema = z.object({
  sourceSystem: z.enum([
    'ONBOARDING',
    'BRAINSTORMING',
    'PROJECT_MANAGEMENT',
    'CLIENT_HIRING',
    'PAYROLL',
    'ADMIN',
    'SYSTEM',
  ]),
  sourceEventId: z.string().min(1, 'sourceEventId is required'),
  memberJempId: z.string().regex(/^JEMP#\d{3,}$/, 'Must be valid JEMP ID format (e.g. JEMP#014)'),
  eventType: z.string().min(1, 'eventType is required'),
  title: z.string().min(1, 'title is required').max(200),
  description: z.string().min(1, 'description is required').max(2000),
  occurredAt: z.string().datetime({ offset: true }).or(z.string().regex(/^\d{4}-\d{2}-\d{2}/)),
  authority: z.enum(['OFFICIAL', 'SYSTEM_RECORDED', 'MEMBER_AUTHORED', 'ADMIN_CORRECTION']).optional().default('OFFICIAL'),
  visibility: z.enum(['PRIVATE', 'MEMBER_VISIBLE', 'SHAREABLE', 'PUBLIC']).optional().default('MEMBER_VISIBLE'),
  sourceEntity: z.object({
    type: z.enum(['PROJECT', 'BRAINSTORM', 'OPPORTUNITY', 'PAYMENT', 'MEMBER', 'SYSTEM']),
    id: z.string().min(1),
    name: z.string().min(1),
  }).optional(),
  metadata: z.record(z.string(), z.any()).optional().default({}),
});

export type IngestEventInput = z.infer<typeof IngestEventSchema>;

export const AdminCorrectionSchema = z.object({
  originalEventId: z.string().min(1, 'Original event ID is required'),
  reason: z.string().min(3, 'Reason for correction must be provided'),
  correctedTitle: z.string().optional(),
  correctedDescription: z.string().optional(),
  correctedSourceEntity: z.object({
    type: z.enum(['PROJECT', 'BRAINSTORM', 'OPPORTUNITY', 'PAYMENT', 'MEMBER', 'SYSTEM']),
    id: z.string().min(1),
    name: z.string().min(1),
  }).optional(),
  adminUser: z.string().default('admin'),
});

export type AdminCorrectionInput = z.infer<typeof AdminCorrectionSchema>;
