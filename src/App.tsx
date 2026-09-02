import React, { useState, useEffect } from 'react';
import {
  Shield,
  Layers,
  Terminal,
  FileText,
  Share2,
  Database,
  Activity,
  CheckCircle2,
  Lock,
  ExternalLink,
  ChevronRight,
  Server,
  Zap,
} from 'lucide-react';
import { DiscordSimulator } from './components/DiscordSimulator.tsx';
import { TimelineViewer } from './components/TimelineViewer.tsx';
import { EventIngestionStudio } from './components/EventIngestionStudio.tsx';
import { ShareInspector } from './components/ShareInspector.tsx';
import { AdminConsole } from './components/AdminConsole.tsx';
import { Member } from './types/timeline.ts';

export default function App() {
  const [activeTab, setActiveTab] = useState<
    'discord' | 'timeline' | 'ingestion' | 'shares' | 'admin'
  >('discord');

  const [currentJempId, setCurrentJempId] = useState<string>('JEMP#014');
  const [members, setMembers] = useState<Member[]>([]);
  const [systemHealth, setSystemHealth] = useState<{
    status: string;
    database: string;
    discord: any;
  } | null>(null);

  const [shareModalOpen, setShareModalOpen] = useState(false);
  const [createdShareUrl, setCreatedShareUrl] = useState<string | null>(null);

  useEffect(() => {
    loadMembers();
    checkHealth();
  }, []);

  const loadMembers = async () => {
    try {
      const res = await fetch('/api/v1/timeline/members');
      const contentType = res.headers.get('content-type') || '';
      if (!res.ok || !contentType.includes('application/json')) return;
      const data = await res.json();
      if (data.members && data.members.length > 0) {
        setMembers(data.members);
        // Default to JEMP#014 if present, else first
        const found014 = data.members.find((m: Member) => m.jemp_id === 'JEMP#014');
        if (found014) setCurrentJempId('JEMP#014');
        else setCurrentJempId(data.members[0].jemp_id);
      }
    } catch (err) {
      console.warn('Waiting for members API:', err);
    }
  };

  const checkHealth = async () => {
    try {
      const res = await fetch('/health');
      const contentType = res.headers.get('content-type') || '';
      if (!contentType.includes('application/json')) return;
      const data = await res.json();
      setSystemHealth(data);
    } catch (err) {
      console.warn('Waiting for health check endpoint:', err);
    }
  };

  const handleCreateQuickShare = async () => {
    try {
      const res = await fetch('/api/v1/timeline/shares', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          jempId: currentJempId,
          expiryHours: 24,
          createdBy: 'Quick Action',
        }),
      });
      const data = await res.json();
      if (data.share) {
        setCreatedShareUrl(data.share.shareUrl);
        setShareModalOpen(true);
      }
    } catch (err) {
      console.error('Quick share error:', err);
    }
  };

  return (
    <div className="min-h-screen bg-[#0d0e12] text-[#e2e8f0] flex flex-col selection:bg-zinc-700 selection:text-white">
      {/* Top Header */}
      <header className="border-b border-[#1f2330] bg-[#12141a]/95 backdrop-blur sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          {/* Brand */}
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded bg-gradient-to-br from-zinc-800 to-black border border-zinc-700 flex items-center justify-center font-serif font-bold text-amber-300 text-sm shadow-sm">
              ⚔️
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-extrabold tracking-tight text-white text-sm sm:text-base font-serif">
                  JOBLESS EMPIRE
                </span>
                <span className="text-[10px] font-mono font-semibold px-2 py-0.5 rounded bg-zinc-800 text-zinc-300 border border-zinc-700">
                  TIMELINE BOT
                </span>
                <span className="hidden sm:inline text-[10px] font-mono text-emerald-400 flex items-center gap-1">
                  <CheckCircle2 className="w-2.5 h-2.5" /> CANONICAL RECORD
                </span>
              </div>
              <div className="text-[10px] text-zinc-500 font-mono tracking-wide hidden sm:block">
                NO JOB. STILL BUILDING. · despair.us
              </div>
            </div>
          </div>

          {/* Builder Switcher & Status */}
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1.5 bg-[#181a22] border border-[#252937] px-2.5 py-1 rounded-lg">
              <span className="text-[11px] text-zinc-400 font-mono">Active:</span>
              <select
                value={currentJempId}
                onChange={(e) => setCurrentJempId(e.target.value)}
                className="bg-transparent text-xs font-mono font-bold text-amber-300 focus:outline-none cursor-pointer"
              >
                {members.map((m) => (
                  <option key={m.jemp_id} value={m.jemp_id} className="bg-[#181a22] text-white">
                    {m.jemp_id} (@{m.handle})
                  </option>
                ))}
              </select>
            </div>

            <div className="hidden md:flex items-center gap-2 text-[10px] font-mono bg-[#181a22] border border-[#252937] px-2.5 py-1.5 rounded-lg text-zinc-400">
              <div className="flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
                <span>DB: PostgreSQL</span>
              </div>
              <span>·</span>
              <div className="flex items-center gap-1">
                <span>BOT: Ready</span>
              </div>
            </div>
          </div>
        </div>

        {/* Primary Navigation Tabs */}
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex items-center gap-1 overflow-x-auto border-t border-[#1a1d27]">
          {[
            { id: 'discord', label: 'Discord Simulator', icon: Terminal, badge: 'Live #profile-manager' },
            { id: 'timeline', label: 'Proof-of-Work Timeline', icon: FileText, badge: 'Full Dossier' },
            { id: 'ingestion', label: 'Event Ingestion Studio', icon: Layers, badge: 'Official Ingress' },
            { id: 'shares', label: '24h Public Shares', icon: Share2, badge: 'Recruiter View' },
            { id: 'admin', label: 'Admin & Reconciliation', icon: Shield, badge: 'Diagnostics' },
          ].map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as any)}
                className={`py-2.5 px-3.5 text-xs font-semibold flex items-center gap-2 border-b-2 whitespace-nowrap transition-all ${
                  isActive
                    ? 'border-amber-400 text-white bg-[#181b24]'
                    : 'border-transparent text-zinc-400 hover:text-zinc-200 hover:bg-[#151720]'
                }`}
              >
                <Icon className={`w-3.5 h-3.5 ${isActive ? 'text-amber-400' : 'text-zinc-500'}`} />
                <span>{tab.label}</span>
                <span
                  className={`text-[9px] font-mono px-1.5 py-0.2 rounded ${
                    isActive
                      ? 'bg-amber-400/10 text-amber-300 border border-amber-400/30'
                      : 'bg-[#1e222e] text-zinc-500'
                  }`}
                >
                  {tab.badge}
                </span>
              </button>
            );
          })}
        </div>
      </header>

      {/* Main Workspace Area */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {activeTab === 'discord' && (
          <div className="space-y-6">
            <div className="bg-[#12141a] border border-[#232733] rounded-xl p-4 text-xs text-zinc-400 flex items-center justify-between shadow-md">
              <div className="flex items-center gap-2">
                <Terminal className="w-4 h-4 text-indigo-400" />
                <span>
                  <strong>Interactive Discord Bot Simulator:</strong> Test the `/timeline` slash commands, Year filters, and click the real profile buttons below.
                </span>
              </div>
              <button
                onClick={() => setActiveTab('ingestion')}
                className="text-indigo-400 hover:underline flex items-center gap-1 font-semibold"
              >
                Ingest New Events <ChevronRight className="w-3.5 h-3.5" />
              </button>
            </div>
            <DiscordSimulator currentJempId={currentJempId} onRefreshTimeline={loadMembers} />
          </div>
        )}

        {activeTab === 'timeline' && (
          <TimelineViewer
            currentJempId={currentJempId}
            onSelectJempId={setCurrentJempId}
            availableMembers={members}
            onOpenShareModal={handleCreateQuickShare}
          />
        )}

        {activeTab === 'ingestion' && (
          <EventIngestionStudio
            currentJempId={currentJempId}
            onEventIngested={() => {
              loadMembers();
            }}
          />
        )}

        {activeTab === 'shares' && <ShareInspector currentJempId={currentJempId} />}

        {activeTab === 'admin' && (
          <AdminConsole currentJempId={currentJempId} onRefreshData={loadMembers} />
        )}
      </main>

      {/* Quick Share Modal */}
      {shareModalOpen && createdShareUrl && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-[#151720] border border-[#2b3040] rounded-xl max-w-lg w-full p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-emerald-400 font-bold text-sm">
                <Share2 className="w-4 h-4" />
                24-Hour Public Share Created
              </div>
              <button
                onClick={() => setShareModalOpen(false)}
                className="text-zinc-500 hover:text-white text-sm"
              >
                ✕
              </button>
            </div>

            <p className="text-xs text-zinc-300 leading-relaxed">
              Anyone with this cryptographic link can view verified proof-of-work events for{' '}
              <strong className="text-white">{currentJempId}</strong>. No private data or Discord IDs are exposed. Link expires in 24 hours.
            </p>

            <div className="p-3 bg-[#0d0e12] rounded-lg border border-[#232733] font-mono text-xs text-amber-300 break-all select-all">
              {createdShareUrl}
            </div>

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                onClick={() => {
                  navigator.clipboard.writeText(createdShareUrl);
                  alert('Share link copied to clipboard!');
                }}
                className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-xs font-semibold transition"
              >
                Copy Link
              </button>
              <button
                onClick={() => setShareModalOpen(false)}
                className="px-4 py-2 bg-[#222634] text-zinc-300 hover:text-white rounded-lg text-xs font-semibold transition"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Footer matching despair.us */}
      <footer className="border-t border-[#1a1d27] bg-[#0c0d11] py-6 mt-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-zinc-500">
          <div className="flex items-center gap-3">
            <span className="font-serif font-bold text-zinc-400">JOBLESS EMPIRE</span>
            <span>·</span>
            <span>https://despair.us</span>
            <span>·</span>
            <span className="font-mono">NO JOB. STILL BUILDING.</span>
          </div>
          <div className="flex items-center gap-4 text-[11px] font-mono">
            <span>Official Ecosystem Timeline Record</span>
            <span>·</span>
            <span className="text-emerald-400/80">Zero Chat Scraping</span>
            <span>·</span>
            <span className="text-amber-400/80">No Hours Estimated</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
