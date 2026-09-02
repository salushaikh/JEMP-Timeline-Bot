import React, { useState, useEffect } from 'react';
import { Share2, Clock, ShieldCheck, XCircle, Copy, Check, ExternalLink, Eye, AlertOctagon } from 'lucide-react';
import { TimelineShare } from '../types/timeline.ts';

interface ShareInspectorProps {
  currentJempId: string;
}

export const ShareInspector: React.FC<ShareInspectorProps> = ({ currentJempId }) => {
  const [activeShares, setActiveShares] = useState<TimelineShare[]>([]);
  const [loading, setLoading] = useState(true);
  const [newlyCreatedShare, setNewlyCreatedShare] = useState<{
    shareId: string;
    rawToken: string;
    shareUrl: string;
    expiresAt: string;
  } | null>(null);
  const [copied, setCopied] = useState(false);

  // Live public preview state
  const [inspectToken, setInspectToken] = useState<string | null>(null);
  const [publicPayload, setPublicPayload] = useState<any | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);

  useEffect(() => {
    fetchActiveShares();
  }, [currentJempId]);

  const fetchActiveShares = async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/v1/timeline/shares/active/${currentJempId}`);
      const data = await res.json();
      setActiveShares(data.activeShares || []);
    } catch (err) {
      console.error('Failed to load active shares:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateShare = async () => {
    try {
      const res = await fetch('/api/v1/timeline/shares', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          jempId: currentJempId,
          expiryHours: 24,
          createdBy: 'Member Hub',
        }),
      });
      const data = await res.json();
      if (data.share) {
        setNewlyCreatedShare(data.share);
        setInspectToken(data.share.rawToken);
        fetchActiveShares();
        fetchPublicPreview(data.share.rawToken);
      }
    } catch (err) {
      console.error('Failed to create share link:', err);
    }
  };

  const handleRevokeShare = async (tokenOrId: string) => {
    try {
      await fetch(`/api/v1/timeline/shares/${tokenOrId}/revoke`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ actor: currentJempId }),
      });
      fetchActiveShares();
      if (inspectToken) {
        fetchPublicPreview(inspectToken);
      }
    } catch (err) {
      console.error('Failed to revoke share:', err);
    }
  };

  const fetchPublicPreview = async (token: string) => {
    setPreviewLoading(true);
    try {
      const res = await fetch(`/api/v1/timeline/shares/${token}`);
      const data = await res.json();
      setPublicPayload(data);
    } catch (err) {
      console.error('Failed to load public preview:', err);
    } finally {
      setPreviewLoading(false);
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="space-y-6">
      {/* Top Banner */}
      <div className="bg-[#12141a] border border-[#232733] rounded-xl p-6 shadow-xl flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="text-xs font-mono font-bold text-zinc-400 uppercase tracking-wider">
              CRYPTOGRAPHIC TOKEN MANAGEMENT
            </span>
            <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-emerald-950 text-emerald-300 border border-emerald-800">
              SHA-256 HASHED
            </span>
          </div>
          <h2 className="text-2xl font-bold text-white tracking-tight font-serif">
            24-Hour Public Proof-of-Work Shares
          </h2>
          <p className="text-xs text-zinc-400 mt-1 max-w-xl">
            Members can generate high-entropy, expiring links for hiring managers or client inquiries. Raw tokens are never stored in the database, and only shareable records are revealed.
          </p>
        </div>

        <button
          onClick={handleCreateShare}
          className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-xs font-semibold flex items-center gap-2 transition shadow-md shrink-0"
        >
          <Share2 className="w-4 h-4" />
          GENERATE NEW 24H SHARE
        </button>
      </div>

      {/* Newly Created Share Alert */}
      {newlyCreatedShare && (
        <div className="bg-emerald-950/40 border border-emerald-700/60 rounded-xl p-5 shadow-lg space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-emerald-300 font-bold text-sm">
              <ShieldCheck className="w-4 h-4" />
              Secure Public Share Token Generated
            </div>
            <span className="text-xs text-emerald-400 font-mono">ID: {newlyCreatedShare.shareId}</span>
          </div>

          <p className="text-xs text-emerald-200/90 leading-relaxed">
            This high-entropy token expires automatically in 24 hours. The raw token is displayed only once.
          </p>

          <div className="flex items-center gap-2 bg-[#090a0d] p-3 rounded-lg border border-emerald-900/60 font-mono text-xs text-zinc-200">
            <span className="flex-1 truncate">{newlyCreatedShare.shareUrl}</span>
            <button
              onClick={() => copyToClipboard(newlyCreatedShare.shareUrl)}
              className="px-3 py-1 bg-emerald-800 hover:bg-emerald-700 text-white rounded font-sans text-xs flex items-center gap-1.5 transition shrink-0"
            >
              {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
              {copied ? 'Copied' : 'Copy Link'}
            </button>
          </div>
        </div>
      )}

      {/* Two Column: Active Shares & Live Public Preview */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left: Active Shares Table */}
        <div className="lg:col-span-6 bg-[#12141a] border border-[#232733] rounded-xl p-5 shadow-xl space-y-4">
          <h3 className="text-xs font-mono font-bold uppercase tracking-widest text-zinc-400 flex items-center justify-between">
            <span>Active Shares for {currentJempId}</span>
            <span className="text-zinc-500">{activeShares.length} Active</span>
          </h3>

          {loading ? (
            <div className="p-8 text-center text-zinc-500 font-mono text-xs">Loading shares...</div>
          ) : activeShares.length === 0 ? (
            <div className="p-8 text-center text-zinc-500 text-xs font-mono">
              No active shares. Click "Generate New 24H Share" above to create one.
            </div>
          ) : (
            <div className="space-y-3">
              {activeShares.map((s) => (
                <div
                  key={s.id}
                  className="bg-[#181a22] p-4 rounded-lg border border-[#262a37] flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3"
                >
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-mono font-bold text-white">{s.share_id}</span>
                      <span className="text-[10px] px-1.5 py-0.2 rounded bg-emerald-950 text-emerald-300 border border-emerald-800">
                        ACTIVE
                      </span>
                    </div>
                    <div className="text-[11px] text-zinc-400 flex items-center gap-1">
                      <Clock className="w-3 h-3 text-zinc-500" />
                      Expires: {new Date(s.expires_at).toLocaleString()}
                    </div>
                    <div className="text-[10px] font-mono text-zinc-500">
                      Accesses: {s.access_count} · Created by: {s.created_by}
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      onClick={() => handleRevokeShare(s.share_id)}
                      className="px-2.5 py-1 text-xs text-rose-400 hover:text-rose-300 hover:bg-rose-950/40 rounded border border-rose-900/60 transition"
                    >
                      Revoke
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Right: Live Public Share Web Simulator */}
        <div className="lg:col-span-6 bg-[#12141a] border border-[#232733] rounded-xl p-5 shadow-xl space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-mono font-bold uppercase tracking-widest text-zinc-400 flex items-center gap-2">
              <Eye className="w-4 h-4 text-emerald-400" />
              External Recruiter / Client View Simulator
            </h3>
            <span className="text-[10px] font-mono text-zinc-500">despair.us/timeline/share</span>
          </div>

          <p className="text-xs text-zinc-400 leading-relaxed">
            This represents what an outside recruiter sees when opening an active share link. Sensitive internal data, Discord IDs, and non-shareable entries are excluded.
          </p>

          {previewLoading ? (
            <div className="p-12 text-center text-zinc-500 font-mono text-xs">Resolving token...</div>
          ) : publicPayload ? (
            <div className="bg-[#0b0c10] p-5 rounded-lg border border-[#1e222d] space-y-4">
              {publicPayload.status === 'ACTIVE' ? (
                <>
                  <div className="border-b border-[#232733] pb-3">
                    <div className="text-[10px] font-mono uppercase text-zinc-500 tracking-widest">
                      JOBLESS EMPIRE · VERIFIED PROOF OF WORK
                    </div>
                    <div className="text-xl font-bold text-white font-serif mt-1">
                      {publicPayload.jempId}
                    </div>
                    <div className="text-xs text-zinc-400 font-serif italic mt-0.5">
                      "A job title can disappear. Your work doesn't have to."
                    </div>
                  </div>

                  {publicPayload.stats && (
                    <div className="grid grid-cols-3 gap-2 text-center py-2 bg-[#14161f] rounded border border-[#232733]">
                      <div>
                        <div className="text-[10px] text-zinc-500 uppercase">Entries</div>
                        <div className="text-sm font-mono font-bold text-white">{publicPayload.stats.totalEntries}</div>
                      </div>
                      <div>
                        <div className="text-[10px] text-zinc-500 uppercase">Projects</div>
                        <div className="text-sm font-mono font-bold text-indigo-400">{publicPayload.stats.projectsParticipated}</div>
                      </div>
                      <div>
                        <div className="text-[10px] text-zinc-500 uppercase">Milestones</div>
                        <div className="text-sm font-mono font-bold text-emerald-400">{publicPayload.stats.milestonesCompleted}</div>
                      </div>
                    </div>
                  )}

                  <div className="space-y-2.5 max-h-72 overflow-y-auto pr-1">
                    {publicPayload.events?.map((e: any) => (
                      <div key={e.eventId} className="p-3 rounded bg-[#13151c] border border-[#1f222d] text-xs space-y-1">
                        <div className="flex items-center justify-between text-[10px] font-mono text-zinc-400">
                          <span>{e.date}</span>
                          <span className="text-emerald-400">{e.sourceSystem}</span>
                        </div>
                        <div className="font-bold text-white">{e.title}</div>
                        <p className="text-zinc-400 text-[11px] leading-relaxed">{e.description}</p>
                        {e.relatedEntity && (
                          <div className="text-[10px] font-mono text-amber-300 mt-1">
                            [{e.relatedEntity.id}] {e.relatedEntity.name}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>

                  <div className="pt-2 text-center text-[10px] font-mono text-zinc-500 border-t border-[#1e222d]">
                    Jobless Empire · despair.us · Verified Public Snapshot
                  </div>
                </>
              ) : publicPayload.status === 'REVOKED' ? (
                <div className="p-8 text-center space-y-2">
                  <AlertOctagon className="w-8 h-8 text-rose-500 mx-auto" />
                  <div className="text-sm font-bold text-rose-400 uppercase font-mono">SHARE REVOKED</div>
                  <p className="text-xs text-zinc-400">
                    This public proof-of-work link was revoked by the member. Access is permanently barred.
                  </p>
                </div>
              ) : (
                <div className="p-8 text-center space-y-2">
                  <Clock className="w-8 h-8 text-amber-500 mx-auto" />
                  <div className="text-sm font-bold text-amber-400 uppercase font-mono">SHARE EXPIRED</div>
                  <p className="text-xs text-zinc-400">
                    This public link expired after 24 hours according to security policy.
                  </p>
                </div>
              )}
            </div>
          ) : (
            <div className="p-8 text-center text-zinc-500 font-mono text-xs">
              Generate a share link above to preview the external visitor interface.
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
