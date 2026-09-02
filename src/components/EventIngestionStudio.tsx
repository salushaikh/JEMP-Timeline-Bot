import React, { useState } from 'react';
import { Send, Shield, RefreshCw, CheckCircle2, AlertCircle, Key, FileCheck, Layers } from 'lucide-react';
import { SourceSystem } from '../types/timeline.ts';

interface EventIngestionStudioProps {
  currentJempId: string;
  onEventIngested?: () => void;
}

export const EventIngestionStudio: React.FC<EventIngestionStudioProps> = ({ currentJempId, onEventIngested }) => {
  const [sourceSystem, setSourceSystem] = useState<SourceSystem>('PROJECT_MANAGEMENT');
  const [sourceEventId, setSourceEventId] = useState('PM-evt-' + Math.floor(1000 + Math.random() * 9000));
  const [eventType, setEventType] = useState('WORK_UPDATE');
  const [title, setTitle] = useState('Completed API integration for order service');
  const [description, setDescription] = useState(
    'Implemented transactional ordering pipeline with webhook broadcast and opened PR #182.'
  );
  const [entityType, setEntityType] = useState<'PROJECT' | 'BRAINSTORM' | 'OPPORTUNITY' | 'PAYMENT'>('PROJECT');
  const [entityId, setEntityId] = useState('P#014');
  const [entityName, setEntityName] = useState('Restaurant Ordering Platform');
  const [visibility, setVisibility] = useState<'SHAREABLE' | 'MEMBER_VISIBLE' | 'PRIVATE'>('SHAREABLE');
  const [useValidSecret, setUseValidSecret] = useState(true);

  const [responseLog, setResponseLog] = useState<{
    status: number;
    body: any;
    timestamp: string;
    isDuplicate?: boolean;
  } | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const presets = [
    {
      label: 'Project Bot · Work Update',
      sourceSystem: 'PROJECT_MANAGEMENT' as SourceSystem,
      eventType: 'WORK_UPDATE',
      title: 'Implemented distributed rate limiter',
      description: 'Shipped sliding-window token bucket in Redis with unit tests and Grafana telemetry.',
      entityType: 'PROJECT' as const,
      entityId: 'P#014',
      entityName: 'Restaurant Ordering Platform',
      visibility: 'SHAREABLE' as const,
    },
    {
      label: 'Project Bot · Milestone Delivered',
      sourceSystem: 'PROJECT_MANAGEMENT' as SourceSystem,
      eventType: 'MILESTONE_COMPLETED',
      title: 'Delivered Milestone M2: Checkout Service',
      description: 'Zero failure payment orchestration verified against sandbox environment.',
      entityType: 'PROJECT' as const,
      entityId: 'P#014',
      entityName: 'Restaurant Ordering Platform',
      visibility: 'SHAREABLE' as const,
    },
    {
      label: 'Brainstorm Bot · Contribution',
      sourceSystem: 'BRAINSTORMING' as SourceSystem,
      eventType: 'BRAINSTORM_CONTRIBUTION',
      title: 'Proposed Zero-Knowledge Identity Schema',
      description: 'Drafted architecture RFC for cryptographic credentials verification.',
      entityType: 'BRAINSTORM' as const,
      entityId: 'B#021',
      entityName: 'Self-Sovereign Identity Protocol',
      visibility: 'SHAREABLE' as const,
    },
    {
      label: 'Client/Hiring Bot · Client Contract Match',
      sourceSystem: 'CLIENT_HIRING' as SourceSystem,
      eventType: 'OPPORTUNITY_JOINED',
      title: 'Selected for Enterprise POS Migration',
      description: 'Matched with hospitality technology client for 6-week core architecture contract.',
      entityType: 'OPPORTUNITY' as const,
      entityId: 'HC#007',
      entityName: 'OmniPos Global',
      visibility: 'SHAREABLE' as const,
    },
    {
      label: 'Payroll Bot · Bounty Disbursed',
      sourceSystem: 'PAYROLL' as SourceSystem,
      eventType: 'PAYMENT_VERIFIED',
      title: 'Completed Sprint Bounty Settlement',
      description: 'Automated verification of milestone delivery escrow disbursement.',
      entityType: 'PAYMENT' as const,
      entityId: 'PAY#102',
      entityName: 'Contract Disbursement Escrow',
      visibility: 'PRIVATE' as const,
    },
  ];

  const applyPreset = (preset: typeof presets[0]) => {
    setSourceSystem(preset.sourceSystem);
    setEventType(preset.eventType);
    setTitle(preset.title);
    setDescription(preset.description);
    setEntityType(preset.entityType);
    setEntityId(preset.entityId);
    setEntityName(preset.entityName);
    setVisibility(preset.visibility);
    setSourceEventId(
      (preset.sourceSystem === 'PROJECT_MANAGEMENT' ? 'PM-' : preset.sourceSystem === 'BRAINSTORMING' ? 'BRN-' : 'CH-') +
        'evt-' +
        Math.floor(1000 + Math.random() * 9000)
    );
  };

  const handleSubmitEvent = async () => {
    setSubmitting(true);
    try {
      const payload = {
        sourceSystem,
        sourceEventId,
        memberJempId: currentJempId,
        eventType,
        title,
        description,
        occurredAt: new Date().toISOString(),
        authority: 'OFFICIAL',
        visibility,
        sourceEntity: {
          type: entityType,
          id: entityId,
          name: entityName,
        },
        metadata: {
          submittedVia: 'IngestionStudio',
          clientVersion: '1.0.0',
        },
      };

      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
      };

      if (useValidSecret) {
        headers['Authorization'] = 'Bearer jemp-timeline-shared-secret-key';
      } else {
        headers['Authorization'] = 'Bearer invalid-dummy-secret';
      }

      const res = await fetch('/api/v1/timeline/events', {
        method: 'POST',
        headers,
        body: JSON.stringify(payload),
      });

      const body = await res.json();
      setResponseLog({
        status: res.status,
        body,
        timestamp: new Date().toLocaleTimeString(),
        isDuplicate: body.status === 'idempotent_duplicate',
      });

      if (res.ok && onEventIngested) {
        onEventIngested();
      }
    } catch (err: any) {
      setResponseLog({
        status: 500,
        body: { error: err.message },
        timestamp: new Date().toLocaleTimeString(),
      });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
      {/* Left Form: Event Authoring */}
      <div className="lg:col-span-7 bg-[#12141a] border border-[#232733] rounded-xl p-6 space-y-6 shadow-xl">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="text-xs font-mono font-bold text-zinc-400 uppercase tracking-wider">
              OFFICIAL EVENT INGESTION API
            </span>
            <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-indigo-950 text-indigo-300 border border-indigo-800">
              POST /api/v1/timeline/events
            </span>
          </div>
          <h2 className="text-xl font-bold text-white tracking-tight font-serif">
            Ecosystem Originating Bot Dispatcher
          </h2>
          <p className="text-xs text-zinc-400 mt-1">
            Test official events generated by Onboarding, Project, Brainstorming, Client/Hiring, or Payroll bots.
          </p>
        </div>

        {/* Quick Presets */}
        <div>
          <label className="block text-[11px] font-semibold text-zinc-400 uppercase tracking-wider mb-2">
            Load Bot Event Preset:
          </label>
          <div className="flex flex-wrap gap-2">
            {presets.map((p, idx) => (
              <button
                key={idx}
                type="button"
                onClick={() => applyPreset(p)}
                className="px-2.5 py-1 text-xs rounded bg-[#1c1f2a] hover:bg-[#252a3a] border border-[#2e3344] text-zinc-300 font-medium transition text-left"
              >
                {p.label}
              </button>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-[11px] font-semibold text-zinc-400 uppercase tracking-wider mb-1">
              Source System
            </label>
            <select
              value={sourceSystem}
              onChange={(e) => setSourceSystem(e.target.value as SourceSystem)}
              className="w-full bg-[#181a22] border border-[#2a2f3f] rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-zinc-500 font-mono"
            >
              <option value="PROJECT_MANAGEMENT">PROJECT_MANAGEMENT</option>
              <option value="BRAINSTORMING">BRAINSTORMING</option>
              <option value="CLIENT_HIRING">CLIENT_HIRING</option>
              <option value="PAYROLL">PAYROLL</option>
              <option value="ONBOARDING">ONBOARDING</option>
              <option value="ADMIN">ADMIN</option>
            </select>
          </div>

          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="block text-[11px] font-semibold text-zinc-400 uppercase tracking-wider">
                Source Event ID (Idempotency Key)
              </label>
              <button
                type="button"
                onClick={() => setSourceEventId('EVT-' + Math.floor(10000 + Math.random() * 90000))}
                className="text-[10px] text-zinc-400 hover:text-white underline"
              >
                New ID
              </button>
            </div>
            <input
              type="text"
              value={sourceEventId}
              onChange={(e) => setSourceEventId(e.target.value)}
              className="w-full bg-[#181a22] border border-[#2a2f3f] rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-zinc-500 font-mono"
            />
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-[11px] font-semibold text-zinc-400 uppercase tracking-wider mb-1">
              Target Member JEMP#
            </label>
            <input
              type="text"
              value={currentJempId}
              readOnly
              className="w-full bg-[#181a22]/60 border border-[#2a2f3f] rounded-lg px-3 py-2 text-xs text-amber-300 font-mono font-bold"
            />
          </div>

          <div>
            <label className="block text-[11px] font-semibold text-zinc-400 uppercase tracking-wider mb-1">
              Event Type
            </label>
            <input
              type="text"
              value={eventType}
              onChange={(e) => setEventType(e.target.value)}
              className="w-full bg-[#181a22] border border-[#2a2f3f] rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-zinc-500 font-mono"
            />
          </div>
        </div>

        <div>
          <label className="block text-[11px] font-semibold text-zinc-400 uppercase tracking-wider mb-1">
            Event Title
          </label>
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="w-full bg-[#181a22] border border-[#2a2f3f] rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-zinc-500"
          />
        </div>

        <div>
          <label className="block text-[11px] font-semibold text-zinc-400 uppercase tracking-wider mb-1">
            Proof of Work Description
          </label>
          <textarea
            rows={3}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            className="w-full bg-[#181a22] border border-[#2a2f3f] rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-zinc-500"
          />
        </div>

        {/* Entity Context */}
        <div className="p-3.5 bg-[#181a22] rounded-lg border border-[#262a37] space-y-3">
          <span className="text-[11px] font-semibold text-zinc-400 uppercase tracking-wider block">
            Associated Entity Context (P#, B#, HC#)
          </span>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="block text-[10px] text-zinc-500 uppercase mb-1">Entity Type</label>
              <select
                value={entityType}
                onChange={(e) => setEntityType(e.target.value as any)}
                className="w-full bg-[#12141a] border border-[#262a37] rounded px-2.5 py-1.5 text-xs text-white font-mono"
              >
                <option value="PROJECT">PROJECT</option>
                <option value="BRAINSTORM">BRAINSTORM</option>
                <option value="OPPORTUNITY">OPPORTUNITY</option>
                <option value="PAYMENT">PAYMENT</option>
              </select>
            </div>

            <div>
              <label className="block text-[10px] text-zinc-500 uppercase mb-1">Canonical ID</label>
              <input
                type="text"
                value={entityId}
                onChange={(e) => setEntityId(e.target.value)}
                className="w-full bg-[#12141a] border border-[#262a37] rounded px-2.5 py-1.5 text-xs text-white font-mono"
              />
            </div>

            <div>
              <label className="block text-[10px] text-zinc-500 uppercase mb-1">Entity Name</label>
              <input
                type="text"
                value={entityName}
                onChange={(e) => setEntityName(e.target.value)}
                className="w-full bg-[#12141a] border border-[#262a37] rounded px-2.5 py-1.5 text-xs text-white truncate"
              />
            </div>
          </div>
        </div>

        {/* Authentication Simulation Toggle */}
        <div className="flex items-center justify-between p-3 bg-[#181a22] rounded-lg border border-[#262a37]">
          <div className="flex items-center gap-2">
            <Key className="w-4 h-4 text-amber-400" />
            <div>
              <div className="text-xs font-semibold text-white">Service Authentication Secret</div>
              <div className="text-[10px] text-zinc-400 font-mono">TIMELINE_SERVICE_SECRET</div>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setUseValidSecret(!useValidSecret)}
            className={`px-3 py-1 text-xs rounded font-mono font-semibold transition ${
              useValidSecret ? 'bg-emerald-900/60 text-emerald-300 border border-emerald-700' : 'bg-rose-900/60 text-rose-300 border border-rose-700'
            }`}
          >
            {useValidSecret ? 'VALID SECRET' : 'INVALID (TEST 401)'}
          </button>
        </div>

        {/* Buttons */}
        <div className="flex items-center gap-3 pt-2">
          <button
            type="button"
            onClick={handleSubmitEvent}
            disabled={submitting}
            className="flex-1 py-2.5 px-4 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-xs font-semibold flex items-center justify-center gap-2 transition disabled:opacity-50"
          >
            <Send className="w-3.5 h-3.5" />
            {submitting ? 'Transmitting Event...' : 'Transmit Official Event'}
          </button>

          <button
            type="button"
            onClick={handleSubmitEvent}
            disabled={submitting}
            title="Fire the exact same event again to test idempotent deduplication"
            className="py-2.5 px-4 bg-[#1c1f2a] hover:bg-[#252a3a] border border-[#2f3547] text-zinc-300 rounded-lg text-xs font-semibold flex items-center gap-2 transition"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            Test Idempotency
          </button>
        </div>
      </div>

      {/* Right Box: Live API Wire Inspector */}
      <div className="lg:col-span-5 space-y-4">
        <div className="bg-[#12141a] border border-[#232733] rounded-xl p-5 shadow-xl">
          <h3 className="text-xs font-mono font-bold uppercase tracking-widest text-zinc-400 mb-3 flex items-center gap-2">
            <Layers className="w-4 h-4 text-indigo-400" />
            API Wire Response Inspector
          </h3>

          {responseLog ? (
            <div className="space-y-3 font-mono text-xs">
              <div className="flex items-center justify-between pb-2 border-b border-[#232733]">
                <div className="flex items-center gap-2">
                  <span
                    className={`px-2 py-0.5 rounded font-bold text-[11px] ${
                      responseLog.status === 201
                        ? 'bg-emerald-950 text-emerald-300 border border-emerald-800'
                        : responseLog.status === 200
                        ? 'bg-amber-950 text-amber-300 border border-amber-800'
                        : 'bg-rose-950 text-rose-300 border border-rose-800'
                    }`}
                  >
                    HTTP {responseLog.status}
                  </span>
                  <span className="text-zinc-400">{responseLog.status === 201 ? 'CREATED' : responseLog.status === 200 ? 'IDEMPOTENT OK' : 'FAILED'}</span>
                </div>
                <span className="text-zinc-500 text-[10px]">{responseLog.timestamp}</span>
              </div>

              {responseLog.isDuplicate && (
                <div className="p-2.5 rounded bg-amber-950/40 border border-amber-800/60 text-amber-200 text-[11px] flex items-start gap-2">
                  <AlertCircle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                  <div>
                    <strong className="block">Idempotent Replay Verified:</strong>
                    The pair ({sourceSystem}, {sourceEventId}) was already recorded in canonical storage. Duplicate was rejected and existing record returned safely without double-counting!
                  </div>
                </div>
              )}

              <div className="bg-[#090a0d] p-3 rounded-lg border border-[#1e212b] overflow-x-auto text-[11px] text-zinc-300 max-h-80">
                <pre>{JSON.stringify(responseLog.body, null, 2)}</pre>
              </div>
            </div>
          ) : (
            <div className="p-8 text-center text-zinc-500 text-xs font-mono">
              Ready to receive events. Click "Transmit Official Event" to see live REST ingestion.
            </div>
          )}
        </div>

        {/* Ecosystem Architecture Reference Card */}
        <div className="bg-[#12141a] border border-[#232733] rounded-xl p-5 shadow-xl space-y-3 text-xs text-zinc-400">
          <h4 className="font-bold text-white font-mono text-xs uppercase tracking-wider flex items-center gap-2">
            <Shield className="w-4 h-4 text-emerald-400" />
            Core Ingestion Safeguards
          </h4>
          <ul className="space-y-2 list-disc list-inside">
            <li>
              <strong className="text-zinc-200">Zero Discord Scraping:</strong> Timeline Bot never automatically logs chat messages.
            </li>
            <li>
              <strong className="text-zinc-200">No Claimed Hours:</strong> Events record verifiable actions and deliverables only.
            </li>
            <li>
              <strong className="text-zinc-200">Strict Immutability:</strong> Historical events cannot be edited or deleted.
            </li>
            <li>
              <strong className="text-zinc-200">Idempotency Guarantee:</strong> Network retries cannot create duplicate records.
            </li>
          </ul>
        </div>
      </div>
    </div>
  );
};
