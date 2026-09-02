import { query } from '../db/database.ts';
import { ensureMember, ingestEvent } from './timelineService.ts';
import { logAudit } from './auditService.ts';

export async function seedDemoData(): Promise<{ success: boolean; eventsCreated: number; members: string[] }> {
  // Demo Members
  const demoMembers = [
    { jempId: 'JEMP#014', discordId: 'demo_user_014', handle: 'builder.jemp' },
    { jempId: 'JEMP#001', discordId: 'demo_user_001', handle: 'alix.builder' },
    { jempId: 'JEMP#002', discordId: 'demo_user_002', handle: 'marcus.systems' },
    { jempId: 'JEMP#003', discordId: 'demo_user_003', handle: 'elena.design' },
  ];

  for (const m of demoMembers) {
    await ensureMember(m.jempId, m.discordId, m.handle);
  }

  let createdCount = 0;

  // Realistic historical event sequence across multiple months and systems
  const events = [
    // JEMP#014 Events (Primary documented builder from prompt)
    {
      sourceSystem: 'ONBOARDING' as const,
      sourceEventId: 'DEMO-ONB-014-01',
      memberJempId: 'JEMP#014',
      eventType: 'MEMBER_JOINED',
      title: 'Joined Jobless Empire',
      description: 'Accepted builder manifesto and completed identity verification.',
      occurredAt: '2026-01-10T09:00:00.000Z',
      authority: 'OFFICIAL' as const,
      visibility: 'MEMBER_VISIBLE' as const,
      metadata: { demo: true, role: 'Lead Architect' },
    },
    {
      sourceSystem: 'ONBOARDING' as const,
      sourceEventId: 'DEMO-ONB-014-02',
      memberJempId: 'JEMP#014',
      eventType: 'JEMP_ASSIGNED',
      title: 'JEMP#014 Assigned',
      description: 'Permanent canonical identity assigned in builder registry.',
      occurredAt: '2026-01-10T09:05:00.000Z',
      authority: 'OFFICIAL' as const,
      visibility: 'SHAREABLE' as const,
      metadata: { demo: true },
    },
    {
      sourceSystem: 'PROJECT_MANAGEMENT' as const,
      sourceEventId: 'DEMO-PM-014-01',
      memberJempId: 'JEMP#014',
      eventType: 'PROJECT_JOINED',
      title: 'Joined Project P#014',
      description: 'Joined engineering core for Restaurant Ordering Platform.',
      occurredAt: '2026-02-01T11:00:00.000Z',
      authority: 'OFFICIAL' as const,
      visibility: 'SHAREABLE' as const,
      sourceEntity: {
        type: 'PROJECT' as const,
        id: 'P#014',
        name: 'Restaurant Ordering Platform',
      },
      metadata: { demo: true },
    },
    {
      sourceSystem: 'PROJECT_MANAGEMENT' as const,
      sourceEventId: 'DEMO-PM-014-02',
      memberJempId: 'JEMP#014',
      eventType: 'WORK_UPDATE',
      title: 'Implemented Webhook Dispatcher',
      description: 'Constructed idempotent webhook dispatch subsystem with exponential backoff and replay defense.',
      occurredAt: '2026-02-18T14:30:00.000Z',
      authority: 'OFFICIAL' as const,
      visibility: 'SHAREABLE' as const,
      sourceEntity: {
        type: 'PROJECT' as const,
        id: 'P#014',
        name: 'Restaurant Ordering Platform',
      },
      metadata: { demo: true, pr: 142 },
    },
    {
      sourceSystem: 'PROJECT_MANAGEMENT' as const,
      sourceEventId: 'DEMO-PM-014-03',
      memberJempId: 'JEMP#014',
      eventType: 'MILESTONE_COMPLETED',
      title: 'Completed Milestone M1: Core Ordering API',
      description: 'Shipped and validated transactional checkout flow under load test simulating 500 req/s.',
      occurredAt: '2026-03-05T17:00:00.000Z',
      authority: 'OFFICIAL' as const,
      visibility: 'SHAREABLE' as const,
      sourceEntity: {
        type: 'PROJECT' as const,
        id: 'P#014',
        name: 'Restaurant Ordering Platform',
      },
      metadata: { demo: true, milestoneId: 'M1' },
    },
    {
      sourceSystem: 'BRAINSTORMING' as const,
      sourceEventId: 'DEMO-BRN-014-01',
      memberJempId: 'JEMP#014',
      eventType: 'BRAINSTORM_JOINED',
      title: 'Joined Ideation Session B#012',
      description: 'Participated in autonomous logistics ideation and micro-fulfillment topology design.',
      occurredAt: '2026-03-22T15:00:00.000Z',
      authority: 'OFFICIAL' as const,
      visibility: 'SHAREABLE' as const,
      sourceEntity: {
        type: 'BRAINSTORM' as const,
        id: 'B#012',
        name: 'Autonomous Delivery Operations',
      },
      metadata: { demo: true },
    },
    {
      sourceSystem: 'CLIENT_HIRING' as const,
      sourceEventId: 'DEMO-CH-014-01',
      memberJempId: 'JEMP#014',
      eventType: 'OPPORTUNITY_JOINED',
      title: 'Contract Award: OmniPos Integration (HC#007)',
      description: 'Selected as principal architect for enterprise point-of-sale migration.',
      occurredAt: '2026-04-12T10:00:00.000Z',
      authority: 'OFFICIAL' as const,
      visibility: 'SHAREABLE' as const,
      sourceEntity: {
        type: 'OPPORTUNITY' as const,
        id: 'HC#007',
        name: 'OmniPos Global',
      },
      metadata: { demo: true },
    },
    {
      sourceSystem: 'PAYROLL' as const,
      sourceEventId: 'DEMO-PAY-014-01',
      memberJempId: 'JEMP#014',
      eventType: 'PAYMENT_VERIFIED',
      title: 'Milestone M1 Settlement Verified',
      description: 'Disbursement escrow released following multi-signature consensus approval.',
      occurredAt: '2026-04-15T18:00:00.000Z',
      authority: 'OFFICIAL' as const,
      visibility: 'PRIVATE' as const,
      sourceEntity: {
        type: 'PAYMENT' as const,
        id: 'PAY#101',
        name: 'Milestone Escrow Disbursement',
      },
      metadata: { demo: true },
    },
    // JEMP#001 Events
    {
      sourceSystem: 'ONBOARDING' as const,
      sourceEventId: 'DEMO-ONB-001',
      memberJempId: 'JEMP#001',
      eventType: 'MEMBER_JOINED',
      title: 'Joined Jobless Empire',
      description: 'Accepted builder manifesto and completed verification.',
      occurredAt: '2026-06-01T10:00:00.000Z',
      authority: 'OFFICIAL' as const,
      visibility: 'MEMBER_VISIBLE' as const,
      metadata: { demo: true, role: 'Full Stack Engineer' },
    },
    {
      sourceSystem: 'ONBOARDING' as const,
      sourceEventId: 'DEMO-ONB-002',
      memberJempId: 'JEMP#001',
      eventType: 'JEMP_ASSIGNED',
      title: 'JEMP#001 Assigned',
      description: 'Permanent identity assigned in canonical membership directory.',
      occurredAt: '2026-06-01T10:05:00.000Z',
      authority: 'OFFICIAL' as const,
      visibility: 'SHAREABLE' as const,
      metadata: { demo: true },
    },
    {
      sourceSystem: 'BRAINSTORMING' as const,
      sourceEventId: 'DEMO-BRN-001',
      memberJempId: 'JEMP#001',
      eventType: 'BRAINSTORM_JOINED',
      title: 'Joined Brainstorm Session',
      description: 'Participated in architecture ideation for autonomous logistics platform.',
      occurredAt: '2026-06-15T14:30:00.000Z',
      authority: 'OFFICIAL' as const,
      visibility: 'SHAREABLE' as const,
      sourceEntity: {
        type: 'BRAINSTORM' as const,
        id: 'B#012',
        name: 'Autonomous Delivery Operations',
      },
      metadata: { demo: true },
    },
    {
      sourceSystem: 'BRAINSTORMING' as const,
      sourceEventId: 'DEMO-BRN-002',
      memberJempId: 'JEMP#001',
      eventType: 'BRAINSTORM_CONTRIBUTION',
      title: 'Contributed Distributed Routing Architecture',
      description: 'Authored technical proposal for graph-based path optimization and state synchronization.',
      occurredAt: '2026-06-20T16:00:00.000Z',
      authority: 'OFFICIAL' as const,
      visibility: 'SHAREABLE' as const,
      sourceEntity: {
        type: 'BRAINSTORM' as const,
        id: 'B#012',
        name: 'Autonomous Delivery Operations',
      },
      metadata: { demo: true },
    },
    {
      sourceSystem: 'PROJECT_MANAGEMENT' as const,
      sourceEventId: 'DEMO-PM-001',
      memberJempId: 'JEMP#001',
      eventType: 'PROJECT_JOINED',
      title: 'Joined Restaurant Ordering Platform (P#014)',
      description: 'Onboarded as Lead Backend Architect for real-time kitchen display and ordering service.',
      occurredAt: '2026-07-02T09:00:00.000Z',
      authority: 'OFFICIAL' as const,
      visibility: 'SHAREABLE' as const,
      sourceEntity: {
        type: 'PROJECT' as const,
        id: 'P#014',
        name: 'Restaurant Ordering Platform',
      },
      metadata: { demo: true },
    },
    {
      sourceSystem: 'PROJECT_MANAGEMENT' as const,
      sourceEventId: 'DEMO-PM-002',
      memberJempId: 'JEMP#001',
      eventType: 'WORK_UPDATE',
      title: 'Completed Order Ingestion Pipeline',
      description: 'Implemented transactional order processing queue with idempotency safeguards and WebSocket broadcasts.',
      occurredAt: '2026-07-18T18:20:00.000Z',
      authority: 'OFFICIAL' as const,
      visibility: 'SHAREABLE' as const,
      sourceEntity: {
        type: 'PROJECT' as const,
        id: 'P#014',
        name: 'Restaurant Ordering Platform',
      },
      metadata: { demo: true, pr: '#42' },
    },
    {
      sourceSystem: 'PROJECT_MANAGEMENT' as const,
      sourceEventId: 'DEMO-PM-003',
      memberJempId: 'JEMP#001',
      eventType: 'MILESTONE_COMPLETED',
      title: 'Core Backend Engine Milestone Delivered',
      description: 'Completed Milestone M1: Passed end-to-end stress test with sub-25ms P99 latency under simulated peak load.',
      occurredAt: '2026-08-04T12:00:00.000Z',
      authority: 'OFFICIAL' as const,
      visibility: 'SHAREABLE' as const,
      sourceEntity: {
        type: 'PROJECT' as const,
        id: 'P#014',
        name: 'Restaurant Ordering Platform',
      },
      metadata: { demo: true, milestoneId: 'M1-CORE' },
    },
    {
      sourceSystem: 'PROJECT_MANAGEMENT' as const,
      sourceEventId: 'DEMO-PM-004',
      memberJempId: 'JEMP#001',
      eventType: 'PROJECT_REPORT',
      title: 'Published Sprint Security Audit Report',
      description: 'Completed automated SAST analysis and vulnerability remediation on auth token exchange.',
      occurredAt: '2026-08-22T17:00:00.000Z',
      authority: 'OFFICIAL' as const,
      visibility: 'SHAREABLE' as const,
      sourceEntity: {
        type: 'PROJECT' as const,
        id: 'P#014',
        name: 'Restaurant Ordering Platform',
      },
      metadata: { demo: true },
    },
    {
      sourceSystem: 'CLIENT_HIRING' as const,
      sourceEventId: 'DEMO-CH-001',
      memberJempId: 'JEMP#001',
      eventType: 'OPPORTUNITY_JOINED',
      title: 'Assigned to Enterprise Client Integration (HC#007)',
      description: 'Matched with Hospitality Tech client for direct Point-of-Sale synchronization contract.',
      occurredAt: '2026-08-28T10:00:00.000Z',
      authority: 'OFFICIAL' as const,
      visibility: 'SHAREABLE' as const,
      sourceEntity: {
        type: 'OPPORTUNITY' as const,
        id: 'HC#007',
        name: 'OmniPos International',
      },
      metadata: { demo: true },
    },
    {
      sourceSystem: 'PAYROLL' as const,
      sourceEventId: 'DEMO-PAY-001',
      memberJempId: 'JEMP#001',
      eventType: 'PAYMENT_VERIFIED',
      title: 'Milestone Disbursement Verified',
      description: 'Disbursement verified for Milestone M1 completion on client account.',
      occurredAt: '2026-09-01T11:00:00.000Z',
      authority: 'OFFICIAL' as const,
      visibility: 'PRIVATE' as const,
      sourceEntity: {
        type: 'PAYMENT' as const,
        id: 'PAY#101',
        name: 'Client Bounty Settlement',
      },
      metadata: { demo: true },
    },

    // JEMP#002 Events
    {
      sourceSystem: 'ONBOARDING' as const,
      sourceEventId: 'DEMO-ONB-003',
      memberJempId: 'JEMP#002',
      eventType: 'MEMBER_JOINED',
      title: 'Joined Jobless Empire',
      description: 'Verified background in distributed systems and cloud infrastructure.',
      occurredAt: '2026-06-10T11:00:00.000Z',
      authority: 'OFFICIAL' as const,
      visibility: 'MEMBER_VISIBLE' as const,
      metadata: { demo: true },
    },
    {
      sourceSystem: 'ONBOARDING' as const,
      sourceEventId: 'DEMO-ONB-004',
      memberJempId: 'JEMP#002',
      eventType: 'JEMP_ASSIGNED',
      title: 'JEMP#002 Assigned',
      description: 'Permanent builder identity assigned.',
      occurredAt: '2026-06-10T11:05:00.000Z',
      authority: 'OFFICIAL' as const,
      visibility: 'SHAREABLE' as const,
      metadata: { demo: true },
    },
    {
      sourceSystem: 'PROJECT_MANAGEMENT' as const,
      sourceEventId: 'DEMO-PM-005',
      memberJempId: 'JEMP#002',
      eventType: 'PROJECT_JOINED',
      title: 'Joined Observability Mesh (P#008)',
      description: 'Led telemetry cluster provisioning and eBPF kernel event tracking.',
      occurredAt: '2026-07-05T09:30:00.000Z',
      authority: 'OFFICIAL' as const,
      visibility: 'SHAREABLE' as const,
      sourceEntity: {
        type: 'PROJECT' as const,
        id: 'P#008',
        name: 'Zero-Overhead Telemetry Mesh',
      },
      metadata: { demo: true },
    },
    {
      sourceSystem: 'PROJECT_MANAGEMENT' as const,
      sourceEventId: 'DEMO-PM-006',
      memberJempId: 'JEMP#002',
      eventType: 'WORK_UPDATE',
      title: 'Shipped PromQL Ingestion Gateway',
      description: 'Deployed high-throughput metric aggregator with stream compaction in Go.',
      occurredAt: '2026-08-11T15:00:00.000Z',
      authority: 'OFFICIAL' as const,
      visibility: 'SHAREABLE' as const,
      sourceEntity: {
        type: 'PROJECT' as const,
        id: 'P#008',
        name: 'Zero-Overhead Telemetry Mesh',
      },
      metadata: { demo: true },
    },

    // JEMP#003 Events
    {
      sourceSystem: 'ONBOARDING' as const,
      sourceEventId: 'DEMO-ONB-005',
      memberJempId: 'JEMP#003',
      eventType: 'MEMBER_JOINED',
      title: 'Joined Jobless Empire',
      description: 'Design and product builder onboarding completed.',
      occurredAt: '2026-07-01T08:00:00.000Z',
      authority: 'OFFICIAL' as const,
      visibility: 'MEMBER_VISIBLE' as const,
      metadata: { demo: true },
    },
    {
      sourceSystem: 'PROJECT_MANAGEMENT' as const,
      sourceEventId: 'DEMO-PM-007',
      memberJempId: 'JEMP#003',
      eventType: 'PROJECT_JOINED',
      title: 'Joined Restaurant Ordering Platform (P#014)',
      description: 'Staff product designer for touch kitchen displays and guest order web application.',
      occurredAt: '2026-07-10T10:00:00.000Z',
      authority: 'OFFICIAL' as const,
      visibility: 'SHAREABLE' as const,
      sourceEntity: {
        type: 'PROJECT' as const,
        id: 'P#014',
        name: 'Restaurant Ordering Platform',
      },
      metadata: { demo: true },
    },
    {
      sourceSystem: 'PROJECT_MANAGEMENT' as const,
      sourceEventId: 'DEMO-PM-008',
      memberJempId: 'JEMP#003',
      eventType: 'WORK_UPDATE',
      title: 'Finalized High-Contrast Kitchen UI System',
      description: 'Shipped design tokens, optical layout grids, and WCAG AAA color specs for industrial kitchen tablets.',
      occurredAt: '2026-08-01T16:00:00.000Z',
      authority: 'OFFICIAL' as const,
      visibility: 'SHAREABLE' as const,
      sourceEntity: {
        type: 'PROJECT' as const,
        id: 'P#014',
        name: 'Restaurant Ordering Platform',
      },
      metadata: { demo: true },
    },
  ];

  for (const ev of events) {
    const res = await ingestEvent(ev, 'DEMO_SEEDER');
    if (!res.isDuplicate) createdCount++;
  }

  await logAudit({
    action: 'admin_action',
    actor: 'ADMIN',
    source_system: 'ADMIN',
    details: { operation: 'seed_demo_data', eventsCreated: createdCount },
  });

  return {
    success: true,
    eventsCreated: createdCount,
    members: demoMembers.map((m) => m.jempId),
  };
}

export async function clearDemoData(): Promise<{ deletedEvents: number; deletedMembers: number }> {
  // Clear events with demo metadata or DEMO- prefixes
  const evRes = await query<{ count: number }>(
    `DELETE FROM timeline_events
     WHERE source_event_id LIKE 'DEMO-%' OR metadata->>'demo' = 'true'
     RETURNING *`
  );

  const memRes = await query<{ count: number }>(
    `DELETE FROM members
     WHERE jemp_id IN ('JEMP#001', 'JEMP#002', 'JEMP#003')
     RETURNING *`
  );

  await logAudit({
    action: 'admin_action',
    actor: 'ADMIN',
    source_system: 'ADMIN',
    details: { operation: 'clear_demo_data', deletedEvents: evRes.rowCount, deletedMembers: memRes.rowCount },
  });

  return {
    deletedEvents: evRes.rowCount,
    deletedMembers: memRes.rowCount,
  };
}
