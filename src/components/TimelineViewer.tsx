import React, { useState, useEffect } from 'react';
import {
  FileText,
  Search,
  Filter,
  Download,
  Share2,
  Calendar,
  Briefcase,
  Lightbulb,
  CheckCircle2,
  ShieldCheck,
  AlertTriangle,
  ExternalLink,
  Layers,
  Sparkles,
  ArrowUpDown,
  Lock,
} from 'lucide-react';
import { TimelineEvent, ProofOfWorkStats, Member } from '../types/timeline.ts';

interface TimelineViewerProps {
  currentJempId: string;
  onSelectJempId: (id: string) => void;
  availableMembers: Member[];
  onOpenShareModal: () => void;
}

export const TimelineViewer: React.FC<TimelineViewerProps> = ({
  currentJempId,
  onSelectJempId,
  availableMembers,
  onOpenShareModal,
}) => {
  const [events, setEvents] = useState<TimelineEvent[]>([]);
  const [stats, setStats] = useState<ProofOfWorkStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedYear, setSelectedYear] = useState<string>('all');
  const [selectedEventType, setSelectedEventType] = useState<string>('all');
  const [selectedSource, setSelectedSource] = useState<string>('all');
  const [availableYears, setAvailableYears] = useState<number[]>([]);
  const [exportingFormat, setExportingFormat] = useState<string | null>(null);

  useEffect(() => {
    fetchTimelineData();
  }, [currentJempId, selectedYear, selectedEventType, selectedSource, searchQuery]);

  const fetchTimelineData = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (selectedYear !== 'all') params.append('year', selectedYear);
      if (selectedEventType !== 'all') params.append('eventType', selectedEventType);
      if (selectedSource !== 'all') params.append('sourceSystem', selectedSource);
      if (searchQuery.trim()) params.append('search', searchQuery.trim());

      const [eventsRes, statsRes, yearsRes] = await Promise.all([
        fetch(`/api/v1/timeline/members/${currentJempId}?${params.toString()}`),
        fetch(`/api/v1/timeline/members/${currentJempId}/stats`),
        fetch(`/api/v1/timeline/members/${currentJempId}/years`),
      ]);

      const eventsData = await eventsRes.json();
      const statsData = await statsRes.json();
      const yearsData = await yearsRes.json();

      setEvents(eventsData.events || []);
      setStats(statsData.stats || null);
      setAvailableYears(yearsData.years || []);
    } catch (err) {
      console.error('Failed to load timeline records:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleDownloadExport = async (format: 'pdf' | 'docx' | 'markdown' | 'json') => {
    setExportingFormat(format);
    try {
      const url = `/api/v1/timeline/members/${currentJempId}/export?format=${format}`;
      const res = await fetch(url);
      const blob = await res.blob();
      const downloadUrl = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = downloadUrl;
      a.download = `${currentJempId}_timeline.${format === 'markdown' ? 'md' : format}`;
      document.body.appendChild(a);
      a.click();
      a.remove();
    } catch (err) {
      console.error('Export download failed:', err);
    } finally {
      setExportingFormat(null);
    }
  };

  // Group events by Year and Month
  const groupedEvents: { [yearMonth: string]: TimelineEvent[] } = {};
  events.forEach((ev) => {
    const d = new Date(ev.occurred_at);
    const key = d.toLocaleDateString('en-US', { year: 'numeric', month: 'long' });
    if (!groupedEvents[key]) groupedEvents[key] = [];
    groupedEvents[key].push(ev);
  });

  return (
    <div className="space-y-6">
      {/* Top Banner: Canonical Identity & despair.us Aesthetic */}
      <div className="bg-[#12141a] border border-[#232733] rounded-xl p-6 relative overflow-hidden shadow-xl">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
          <div>
            <div className="flex items-center gap-3 mb-2">
              <span className="text-xs uppercase tracking-widest text-zinc-400 font-mono font-semibold">
                JOBLESS EMPIRE · CANONICAL RECORD
              </span>
              <span className="px-2 py-0.5 rounded text-[10px] font-mono font-semibold bg-emerald-950/60 text-emerald-400 border border-emerald-800/60">
                ACTIVE BUILDER
              </span>
              <span className="px-2 py-0.5 rounded text-[10px] font-mono text-zinc-400 bg-zinc-900 border border-zinc-800 flex items-center gap-1">
                <Lock className="w-2.5 h-2.5" /> IMMUTABLE AUDIT LOG
              </span>
            </div>

            <div className="flex items-center gap-4">
              <h1 className="text-3xl font-extrabold text-white tracking-tight font-serif">
                {currentJempId}
              </h1>

              {/* Member Selector Switcher */}
              <div className="flex items-center gap-1.5 bg-[#1a1d26] px-2.5 py-1 rounded-lg border border-[#2b3040]">
                <span className="text-xs text-zinc-400">Switch Builder:</span>
                <select
                  value={currentJempId}
                  onChange={(e) => onSelectJempId(e.target.value)}
                  className="bg-transparent text-xs text-amber-300 font-mono font-bold focus:outline-none cursor-pointer"
                >
                  {availableMembers.map((m) => (
                    <option key={m.jemp_id} value={m.jemp_id} className="bg-[#1a1d26] text-white">
                      {m.jemp_id} (@{m.handle})
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <p className="text-sm text-zinc-400 mt-2 font-serif italic max-w-xl">
              "A job title can disappear. Your work doesn't have to." — No job. Still building.
            </p>
          </div>

          {/* Action Bar */}
          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={onOpenShareModal}
              className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-xs font-semibold flex items-center gap-2 transition shadow-sm"
            >
              <Share2 className="w-3.5 h-3.5" />
              CREATE 24H SHARE
            </button>

            <div className="flex items-center bg-[#1a1d26] border border-[#2b3040] rounded-lg p-1">
              {(['pdf', 'docx', 'markdown', 'json'] as const).map((fmt) => (
                <button
                  key={fmt}
                  onClick={() => handleDownloadExport(fmt)}
                  disabled={exportingFormat !== null}
                  className="px-2.5 py-1 text-[11px] font-mono text-zinc-300 hover:text-white hover:bg-[#272c3b] rounded transition uppercase disabled:opacity-50"
                >
                  {exportingFormat === fmt ? '...' : fmt}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Proof of Work Metrics Bar (strictly no claimed hours!) */}
        {stats && (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 mt-6 pt-6 border-t border-[#232733]">
            <div className="bg-[#181a22] p-3 rounded-lg border border-[#262a37]">
              <div className="text-[11px] text-zinc-400 font-semibold uppercase tracking-wider">Verified Events</div>
              <div className="text-xl font-mono font-bold text-white mt-1">{stats.official_entries}</div>
              <div className="text-[10px] text-zinc-500 mt-0.5">System Recorded</div>
            </div>

            <div className="bg-[#181a22] p-3 rounded-lg border border-[#262a37]">
              <div className="text-[11px] text-zinc-400 font-semibold uppercase tracking-wider">Projects (P#)</div>
              <div className="text-xl font-mono font-bold text-indigo-400 mt-1">{stats.projects_participated}</div>
              <div className="text-[10px] text-zinc-500 mt-0.5">Collaborations</div>
            </div>

            <div className="bg-[#181a22] p-3 rounded-lg border border-[#262a37]">
              <div className="text-[11px] text-zinc-400 font-semibold uppercase tracking-wider">Brainstorms (B#)</div>
              <div className="text-xl font-mono font-bold text-amber-400 mt-1">{stats.brainstorms_participated}</div>
              <div className="text-[10px] text-zinc-500 mt-0.5">Ideation Sessions</div>
            </div>

            <div className="bg-[#181a22] p-3 rounded-lg border border-[#262a37]">
              <div className="text-[11px] text-zinc-400 font-semibold uppercase tracking-wider">Client Opps (HC#)</div>
              <div className="text-xl font-mono font-bold text-emerald-400 mt-1">{stats.client_opportunities}</div>
              <div className="text-[10px] text-zinc-500 mt-0.5">Commercial Contracts</div>
            </div>

            <div className="bg-[#181a22] p-3 rounded-lg border border-[#262a37]">
              <div className="text-[11px] text-zinc-400 font-semibold uppercase tracking-wider">Milestones</div>
              <div className="text-xl font-mono font-bold text-sky-400 mt-1">{stats.milestones_completed}</div>
              <div className="text-[10px] text-zinc-500 mt-0.5">Shipped Deliverables</div>
            </div>

            <div className="bg-[#181a22] p-3 rounded-lg border border-[#262a37]">
              <div className="text-[11px] text-zinc-400 font-semibold uppercase tracking-wider">Reports & Logs</div>
              <div className="text-xl font-mono font-bold text-zinc-300 mt-1">{stats.reports_submitted + stats.work_updates}</div>
              <div className="text-[10px] text-zinc-500 mt-0.5">Proof of Execution</div>
            </div>
          </div>
        )}
      </div>

      {/* Filter and Search Toolbar */}
      <div className="bg-[#15171f] p-4 rounded-xl border border-[#232733] flex flex-col md:flex-row items-center justify-between gap-4">
        <div className="relative flex-1 w-full md:w-auto">
          <Search className="w-4 h-4 text-zinc-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search proof-of-work (e.g. 'P#014', 'API integration', 'milestone')..."
            className="w-full bg-[#1c1f2a] border border-[#2c3142] rounded-lg pl-10 pr-4 py-2 text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-zinc-500 font-mono"
          />
        </div>

        <div className="flex flex-wrap items-center gap-2.5 w-full md:w-auto">
          {/* Year Filter */}
          <div className="flex items-center gap-1.5 bg-[#1c1f2a] border border-[#2c3142] px-3 py-1.5 rounded-lg">
            <Calendar className="w-3.5 h-3.5 text-zinc-400" />
            <select
              value={selectedYear}
              onChange={(e) => setSelectedYear(e.target.value)}
              className="bg-transparent text-xs text-zinc-200 focus:outline-none cursor-pointer"
            >
              <option value="all" className="bg-[#1c1f2a]">All Years</option>
              {availableYears.map((y) => (
                <option key={y} value={y.toString()} className="bg-[#1c1f2a]">
                  {y}
                </option>
              ))}
            </select>
          </div>

          {/* Source System Filter */}
          <div className="flex items-center gap-1.5 bg-[#1c1f2a] border border-[#2c3142] px-3 py-1.5 rounded-lg">
            <Layers className="w-3.5 h-3.5 text-zinc-400" />
            <select
              value={selectedSource}
              onChange={(e) => setSelectedSource(e.target.value)}
              className="bg-transparent text-xs text-zinc-200 focus:outline-none cursor-pointer"
            >
              <option value="all" className="bg-[#1c1f2a]">All Sources</option>
              <option value="ONBOARDING" className="bg-[#1c1f2a]">Onboarding</option>
              <option value="PROJECT_MANAGEMENT" className="bg-[#1c1f2a]">Project Management</option>
              <option value="BRAINSTORMING" className="bg-[#1c1f2a]">Brainstorming</option>
              <option value="CLIENT_HIRING" className="bg-[#1c1f2a]">Client/Hiring</option>
              <option value="PAYROLL" className="bg-[#1c1f2a]">Payroll</option>
              <option value="ADMIN" className="bg-[#1c1f2a]">Admin</option>
            </select>
          </div>

          {(searchQuery || selectedYear !== 'all' || selectedSource !== 'all') && (
            <button
              onClick={() => {
                setSearchQuery('');
                setSelectedYear('all');
                setSelectedSource('all');
                setSelectedEventType('all');
              }}
              className="px-3 py-1.5 text-xs text-zinc-400 hover:text-white underline font-medium"
            >
              Reset Filters
            </button>
          )}
        </div>
      </div>

      {/* Chronological Timeline Records */}
      {loading ? (
        <div className="p-12 text-center text-zinc-500 font-mono text-sm bg-[#12141a] rounded-xl border border-[#232733]">
          Loading canonical proof-of-work records...
        </div>
      ) : events.length === 0 ? (
        <div className="p-12 text-center text-zinc-400 bg-[#12141a] rounded-xl border border-[#232733] space-y-2">
          <p className="text-base font-semibold text-white">No proof-of-work records match your selection.</p>
          <p className="text-xs text-zinc-500">
            Official events are recorded automatically as actions occur across the Jobless Empire ecosystem.
          </p>
        </div>
      ) : (
        <div className="space-y-8">
          {Object.entries(groupedEvents).map(([yearMonth, monthEvents]) => (
            <div key={yearMonth} className="space-y-4">
              {/* Month Header Banner */}
              <div className="flex items-center gap-3">
                <h3 className="text-xs font-mono font-bold uppercase tracking-widest text-zinc-400 bg-[#1a1d26] px-3 py-1 rounded border border-[#262a37]">
                  {yearMonth}
                </h3>
                <div className="h-px bg-[#232733] flex-1"></div>
                <span className="text-[11px] font-mono text-zinc-500">
                  {monthEvents.length} {monthEvents.length === 1 ? 'record' : 'records'}
                </span>
              </div>

              {/* Event Cards */}
              <div className="space-y-3">
                {monthEvents.map((ev) => {
                  const dateDay = new Date(ev.occurred_at).toLocaleDateString('en-US', {
                    day: '2-digit',
                    month: 'short',
                  });

                  // Source badge color
                  let sourceBadge = 'bg-zinc-800 text-zinc-300';
                  if (ev.source_system === 'PROJECT_MANAGEMENT') sourceBadge = 'bg-indigo-950/70 text-indigo-300 border border-indigo-800/40';
                  if (ev.source_system === 'BRAINSTORMING') sourceBadge = 'bg-amber-950/70 text-amber-300 border border-amber-800/40';
                  if (ev.source_system === 'CLIENT_HIRING') sourceBadge = 'bg-emerald-950/70 text-emerald-300 border border-emerald-800/40';
                  if (ev.source_system === 'PAYROLL') sourceBadge = 'bg-purple-950/70 text-purple-300 border border-purple-800/40';
                  if (ev.source_system === 'ONBOARDING') sourceBadge = 'bg-blue-950/70 text-blue-300 border border-blue-800/40';
                  if (ev.source_system === 'ADMIN') sourceBadge = 'bg-rose-950/70 text-rose-300 border border-rose-800/40';

                  return (
                    <div
                      key={ev.event_id}
                      className="bg-[#15171f] hover:bg-[#181a24] p-5 rounded-xl border border-[#232733] transition-all shadow-sm flex flex-col md:flex-row gap-5 items-start"
                    >
                      {/* Date & Event Code Column */}
                      <div className="shrink-0 w-28">
                        <div className="text-xs font-mono font-bold text-zinc-300 uppercase tracking-wide">
                          {dateDay}
                        </div>
                        <div className="text-[10px] font-mono text-zinc-500 mt-1">
                          {ev.event_id}
                        </div>
                        <div className="mt-2">
                          <span
                            className={`text-[9px] font-mono uppercase px-1.5 py-0.5 rounded font-semibold ${
                              ev.authority === 'ADMIN_CORRECTION'
                                ? 'bg-rose-950 text-rose-300 border border-rose-800'
                                : 'bg-zinc-800 text-zinc-400'
                            }`}
                          >
                            {ev.authority}
                          </span>
                        </div>
                      </div>

                      {/* Main Record Body */}
                      <div className="flex-1 min-w-0">
                        <div className="flex flex-wrap items-center gap-2 mb-1.5">
                          <span className={`text-[10px] font-mono uppercase px-2 py-0.5 rounded font-semibold ${sourceBadge}`}>
                            {ev.source_system}
                          </span>

                          <span className="text-[11px] font-mono text-zinc-400 font-medium">
                            {ev.event_type}
                          </span>

                          {ev.visibility === 'SHAREABLE' && (
                            <span className="text-[9px] font-mono px-1.5 py-0.5 rounded bg-zinc-900 text-zinc-400 border border-zinc-800">
                              Publicly Shareable
                            </span>
                          )}
                        </div>

                        <h4 className="text-base font-bold text-white tracking-tight">
                          {ev.title}
                        </h4>

                        <p className="text-xs text-zinc-300 leading-relaxed mt-2 whitespace-pre-wrap">
                          {ev.description}
                        </p>

                        {/* Associated Entity Context (P#, B#, HC#) */}
                        {ev.source_entity_id && (
                          <div className="mt-3 flex items-center gap-2 text-xs">
                            <span className="px-2 py-0.5 rounded bg-[#1f2330] border border-[#2d3245] text-amber-300 font-mono font-bold text-[11px]">
                              {ev.source_entity_id}
                            </span>
                            <span className="text-zinc-400 font-medium truncate">
                              {ev.source_entity_name}
                            </span>
                          </div>
                        )}

                        {/* Administrative Correction Banner */}
                        {ev.corrected_by_event_id && (
                          <div className="mt-3 p-2.5 rounded bg-rose-950/40 border border-rose-800/60 text-xs text-rose-200 flex items-start gap-2">
                            <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
                            <div>
                              <div className="font-semibold text-rose-300">
                                Official Administrative Correction Applied ({ev.corrected_by_event_id})
                              </div>
                              <div className="text-[11px] text-rose-200/90 mt-0.5">
                                Reason: {ev.correction_reason}
                              </div>
                            </div>
                          </div>
                        )}
                      </div>

                      {/* Right-side metadata badge */}
                      <div className="hidden lg:flex flex-col items-end text-[10px] font-mono text-zinc-500 shrink-0">
                        <span>SRC: {ev.source_event_id}</span>
                        <span className="mt-1 flex items-center gap-1 text-emerald-400/80">
                          <CheckCircle2 className="w-3 h-3" /> VERIFIED
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
