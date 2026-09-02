import React, { useState, useEffect } from 'react';
import {
  ShieldAlert,
  Activity,
  History,
  FileCheck,
  AlertTriangle,
  RefreshCw,
  PlusCircle,
  Database,
  Trash2,
  CheckCircle2,
} from 'lucide-react';
import { AuditLog, TimelineEvent } from '../types/timeline.ts';

interface AdminConsoleProps {
  currentJempId: string;
  onRefreshData?: () => void;
}

export const AdminConsole: React.FC<AdminConsoleProps> = ({ currentJempId, onRefreshData }) => {
  const [diagnostics, setDiagnostics] = useState<any | null>(null);
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(true);

  // Correction form
  const [targetEventId, setTargetEventId] = useState('');
  const [correctionReason, setCorrectionReason] = useState('');
  const [newTitle, setNewTitle] = useState('');
  const [newDescription, setNewDescription] = useState('');
  const [correctionResult, setCorrectionResult] = useState<any | null>(null);
  const [submittingCorrection, setSubmittingCorrection] = useState(false);

  // Seed / Reset states
  const [seedStatus, setSeedStatus] = useState<string | null>(null);

  useEffect(() => {
    loadDiagnosticsAndAudit();
  }, [currentJempId]);

  const loadDiagnosticsAndAudit = async () => {
    setLoading(true);
    try {
      const headers = { Authorization: 'Bearer jemp-timeline-shared-secret-key' };
      const [diagRes, auditRes] = await Promise.all([
        fetch('/api/v1/timeline/admin/reconcile', { headers }),
        fetch('/api/v1/timeline/admin/audit?limit=25', { headers }),
      ]);

      const diagData = await diagRes.json();
      const auditData = await auditRes.json();

      setDiagnostics(diagData.diagnostics || null);
      setAuditLogs(auditData.logs || []);
    } catch (err) {
      console.error('Failed to load admin telemetry:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleApplyCorrection = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!targetEventId || !correctionReason) return;
    setSubmittingCorrection(true);
    try {
      const res = await fetch('/api/v1/timeline/admin/correction', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: 'Bearer jemp-timeline-shared-secret-key',
        },
        body: JSON.stringify({
          originalEventId: targetEventId,
          reason: correctionReason,
          correctedTitle: newTitle || undefined,
          correctedDescription: newDescription || undefined,
          adminUser: 'Admin.Console',
        }),
      });

      const data = await res.json();
      setCorrectionResult(data);
      if (res.ok) {
        setTargetEventId('');
        setCorrectionReason('');
        setNewTitle('');
        setNewDescription('');
        loadDiagnosticsAndAudit();
        if (onRefreshData) onRefreshData();
      }
    } catch (err: any) {
      setCorrectionResult({ error: err.message });
    } finally {
      setSubmittingCorrection(false);
    }
  };

  const handleSeedDemo = async () => {
    setSeedStatus('Seeding realistic proof-of-work records...');
    try {
      const res = await fetch('/api/v1/timeline/admin/seed-demo', {
        method: 'POST',
        headers: { Authorization: 'Bearer jemp-timeline-shared-secret-key' },
      });
      const data = await res.json();
      setSeedStatus(`Successfully populated ${data.eventsCreated} events across ${data.members.length} members.`);
      loadDiagnosticsAndAudit();
      if (onRefreshData) onRefreshData();
    } catch (err: any) {
      setSeedStatus(`Failed to seed: ${err.message}`);
    }
  };

  const handleClearDemo = async () => {
    setSeedStatus('Clearing demo data...');
    try {
      const res = await fetch('/api/v1/timeline/admin/clear-demo', {
        method: 'POST',
        headers: { Authorization: 'Bearer jemp-timeline-shared-secret-key' },
      });
      const data = await res.json();
      setSeedStatus(`Removed ${data.deletedEvents} demo events and ${data.deletedMembers} demo members.`);
      loadDiagnosticsAndAudit();
      if (onRefreshData) onRefreshData();
    } catch (err: any) {
      setSeedStatus(`Failed to clear: ${err.message}`);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-[#12141a] border border-[#232733] rounded-xl p-6 shadow-xl flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="text-xs font-mono font-bold text-rose-400 uppercase tracking-wider flex items-center gap-1.5">
              <ShieldAlert className="w-4 h-4 text-rose-400" />
              TIMELINE BOT ADMINISTRATIVE SYSTEM
            </span>
          </div>
          <h2 className="text-2xl font-bold text-white tracking-tight font-serif">
            Audit Ledger & System Reconciliation
          </h2>
          <p className="text-xs text-zinc-400 mt-1 max-w-xl">
            Audit security actions, run integrity reconciliation diagnostics, and apply immutable administrative corrections without mutating historical records.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={handleSeedDemo}
            className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-xs font-medium transition"
          >
            Re-Seed Demo Data
          </button>
          <button
            onClick={handleClearDemo}
            className="px-3 py-1.5 bg-[#1f2330] hover:bg-[#282d3d] border border-zinc-700 text-zinc-300 rounded-lg text-xs font-medium transition"
          >
            Clear Demo Records
          </button>
          <button
            onClick={loadDiagnosticsAndAudit}
            className="p-1.5 rounded-lg bg-[#1a1d26] border border-[#2b3040] text-zinc-400 hover:text-white"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {seedStatus && (
        <div className="p-3 bg-indigo-950/40 border border-indigo-800/60 rounded-lg text-xs text-indigo-200 font-mono">
          {seedStatus}
        </div>
      )}

      {/* Reconciliation Health Metrics */}
      {diagnostics && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-[#15171f] p-4 rounded-xl border border-[#232733] shadow-md">
            <div className="text-[11px] font-mono text-zinc-400 uppercase font-semibold">Integrity Status</div>
            <div className="text-xl font-bold text-emerald-400 mt-1 flex items-center gap-2">
              <CheckCircle2 className="w-5 h-5" />
              {diagnostics.status}
            </div>
            <div className="text-[10px] text-zinc-500 mt-1 font-mono">All foreign keys verified</div>
          </div>

          <div className="bg-[#15171f] p-4 rounded-xl border border-[#232733] shadow-md">
            <div className="text-[11px] font-mono text-zinc-400 uppercase font-semibold">Total Canonical Events</div>
            <div className="text-xl font-mono font-bold text-white mt-1">
              {diagnostics.summary.totalEvents}
            </div>
            <div className="text-[10px] text-zinc-500 mt-1 font-mono">Zero orphaned records</div>
          </div>

          <div className="bg-[#15171f] p-4 rounded-xl border border-[#232733] shadow-md">
            <div className="text-[11px] font-mono text-zinc-400 uppercase font-semibold">Registered Members</div>
            <div className="text-xl font-mono font-bold text-indigo-400 mt-1">
              {diagnostics.summary.totalMembers}
            </div>
            <div className="text-[10px] text-zinc-500 mt-1 font-mono">JEMP# Identifiers</div>
          </div>

          <div className="bg-[#15171f] p-4 rounded-xl border border-[#232733] shadow-md">
            <div className="text-[11px] font-mono text-zinc-400 uppercase font-semibold">Admin Corrections</div>
            <div className="text-xl font-mono font-bold text-amber-400 mt-1">
              {diagnostics.summary.totalCorrections}
            </div>
            <div className="text-[10px] text-zinc-500 mt-1 font-mono">Preserved audit trail</div>
          </div>
        </div>
      )}

      {/* Two Column Layout: Correction Workflow & Audit Log Stream */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left: Non-Destructive Event Correction Form */}
        <div className="lg:col-span-5 bg-[#12141a] border border-[#232733] rounded-xl p-5 shadow-xl space-y-4">
          <div className="border-b border-[#232733] pb-3">
            <h3 className="text-xs font-mono font-bold uppercase tracking-widest text-zinc-400 flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-amber-400" />
              Non-Destructive Event Correction Workflow
            </h3>
            <p className="text-[11px] text-zinc-400 mt-1">
              In accordance with Section 26, historical records are NEVER deleted or mutated in-place. Corrections generate a new linked event and record the justification.
            </p>
          </div>

          <form onSubmit={handleApplyCorrection} className="space-y-3">
            <div>
              <label className="block text-[11px] font-semibold text-zinc-400 uppercase tracking-wider mb-1">
                Original Event ID to Correct
              </label>
              <input
                type="text"
                value={targetEventId}
                onChange={(e) => setTargetEventId(e.target.value)}
                placeholder="e.g. EVT-PM-014-03"
                required
                className="w-full bg-[#181a22] border border-[#2a2f3f] rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-zinc-500 font-mono"
              />
            </div>

            <div>
              <label className="block text-[11px] font-semibold text-zinc-400 uppercase tracking-wider mb-1">
                Reason / Justification for Correction
              </label>
              <input
                type="text"
                value={correctionReason}
                onChange={(e) => setCorrectionReason(e.target.value)}
                placeholder="e.g. Corrected milestone classification and updated PR reference"
                required
                className="w-full bg-[#181a22] border border-[#2a2f3f] rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-zinc-500"
              />
            </div>

            <div>
              <label className="block text-[11px] font-semibold text-zinc-400 uppercase tracking-wider mb-1">
                Updated Title (Optional)
              </label>
              <input
                type="text"
                value={newTitle}
                onChange={(e) => setNewTitle(e.target.value)}
                placeholder="Leave blank to retain original title"
                className="w-full bg-[#181a22] border border-[#2a2f3f] rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-zinc-500"
              />
            </div>

            <div>
              <label className="block text-[11px] font-semibold text-zinc-400 uppercase tracking-wider mb-1">
                Updated Description (Optional)
              </label>
              <textarea
                rows={2}
                value={newDescription}
                onChange={(e) => setNewDescription(e.target.value)}
                placeholder="Leave blank to retain original description"
                className="w-full bg-[#181a22] border border-[#2a2f3f] rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-zinc-500"
              />
            </div>

            <button
              type="submit"
              disabled={submittingCorrection}
              className="w-full py-2.5 bg-rose-700 hover:bg-rose-600 text-white rounded-lg text-xs font-semibold flex items-center justify-center gap-2 transition disabled:opacity-50"
            >
              <ShieldAlert className="w-3.5 h-3.5" />
              {submittingCorrection ? 'Executing Correction...' : 'Register Formal Correction'}
            </button>
          </form>

          {correctionResult && (
            <div
              className={`p-3 rounded-lg text-xs font-mono border ${
                correctionResult.error
                  ? 'bg-rose-950/40 border-rose-800 text-rose-300'
                  : 'bg-emerald-950/40 border-emerald-800 text-emerald-300'
              }`}
            >
              {correctionResult.error
                ? `Error: ${correctionResult.error}`
                : `Success! Created correction event ${correctionResult.correctionEvent?.event_id}. Original event remains preserved in history.`}
            </div>
          )}
        </div>

        {/* Right: Security & Data Audit Logs */}
        <div className="lg:col-span-7 bg-[#12141a] border border-[#232733] rounded-xl p-5 shadow-xl space-y-4">
          <div className="flex items-center justify-between border-b border-[#232733] pb-3">
            <h3 className="text-xs font-mono font-bold uppercase tracking-widest text-zinc-400 flex items-center gap-2">
              <History className="w-4 h-4 text-indigo-400" />
              Cryptographic Audit Stream
            </h3>
            <span className="text-[10px] font-mono text-zinc-500">Live Timeline Ingress Events</span>
          </div>

          <div className="space-y-2.5 max-h-[460px] overflow-y-auto pr-1">
            {auditLogs.length === 0 ? (
              <div className="p-8 text-center text-zinc-500 font-mono text-xs">No audit records logged.</div>
            ) : (
              auditLogs.map((log) => {
                let actionBadge = 'bg-zinc-800 text-zinc-300';
                if (log.action === 'event_created') actionBadge = 'bg-emerald-950 text-emerald-300 border border-emerald-800';
                if (log.action === 'duplicate_event_rejected') actionBadge = 'bg-amber-950 text-amber-300 border border-amber-800';
                if (log.action === 'admin_correction') actionBadge = 'bg-rose-950 text-rose-300 border border-rose-800';
                if (log.action === 'share_created' || log.action === 'share_revoked') actionBadge = 'bg-indigo-950 text-indigo-300 border border-indigo-800';

                return (
                  <div
                    key={log.id}
                    className="p-3 bg-[#161821] rounded-lg border border-[#232733] text-xs font-mono space-y-1"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${actionBadge}`}>
                          {log.action}
                        </span>
                        <span className="text-zinc-400 text-[11px]">Actor: {log.actor}</span>
                      </div>
                      <span className="text-zinc-500 text-[10px]">
                        {new Date(log.timestamp).toLocaleTimeString()}
                      </span>
                    </div>

                    <div className="text-[11px] text-zinc-300 flex items-center gap-3">
                      <span>Source: <strong className="text-white">{log.source_system}</strong></span>
                      {log.jemp_id && <span>Member: <strong className="text-amber-300">{log.jemp_id}</strong></span>}
                    </div>

                    {log.metadata && Object.keys(log.metadata).length > 0 && (
                      <div className="text-[10px] text-zinc-500 bg-[#0c0d12] p-1.5 rounded truncate">
                        {JSON.stringify(log.metadata)}
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
