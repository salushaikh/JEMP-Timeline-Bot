import React, { useState, useEffect } from 'react';
import { Terminal, Send, RefreshCw, Shield, Download, Share2, Eye, BarChart3, Clock, CheckCircle2 } from 'lucide-react';

interface DiscordSimulatorProps {
  currentJempId: string;
  onRefreshTimeline?: () => void;
}

interface SimulatedMessage {
  id: string;
  author: string;
  isBot: boolean;
  avatarText: string;
  timestamp: string;
  content?: string;
  embed?: any;
  components?: any[];
  file?: {
    name: string;
    buffer: any;
    contentType: string;
  };
}

export const DiscordSimulator: React.FC<DiscordSimulatorProps> = ({ currentJempId, onRefreshTimeline }) => {
  const [messages, setMessages] = useState<SimulatedMessage[]>([]);
  const [commandInput, setCommandInput] = useState('/timeline');
  const [channel, setChannel] = useState<'profile-manager' | 'commands'>('profile-manager');
  const [loading, setLoading] = useState(false);

  // Load initial Profile Manager embed
  useEffect(() => {
    loadProfileManager();
  }, [currentJempId]);

  const loadProfileManager = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/v1/bot/simulate-command', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          subcommand: 'profile-manager',
          args: { jempId: currentJempId },
          context: { userId: 'usr_' + currentJempId, userHandle: 'builder.' + currentJempId.toLowerCase() },
        }),
      });
      const data = await res.json();
      if (data.embed) {
        setMessages([
          {
            id: 'init-pm',
            author: 'Jobless Empire Timeline Bot',
            isBot: true,
            avatarText: 'JEMP',
            timestamp: 'Today at ' + new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
            embed: data.embed,
            components: data.components,
          },
        ]);
      }
    } catch (e) {
      console.error('Failed to load profile manager embed:', e);
    } finally {
      setLoading(false);
    }
  };

  const handleRunCommand = async (cmdString: string) => {
    if (!cmdString.trim()) return;
    const cleanCmd = cmdString.trim();

    // Add user message to log
    const userMsg: SimulatedMessage = {
      id: 'usr-' + Date.now(),
      author: 'You (Builder)',
      isBot: false,
      avatarText: 'ME',
      timestamp: 'Today at ' + new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      content: cleanCmd,
    };

    setMessages((prev) => [...prev, userMsg]);
    setLoading(true);

    try {
      // Parse command
      const parts = cleanCmd.replace(/^\//, '').split(/\s+/);
      const root = parts[0]; // 'timeline'
      let subcommand = parts[1] || 'view';
      const args: Record<string, any> = { jempId: currentJempId };

      if (root === 'timeline') {
        if (parts[1] === 'years') subcommand = 'years';
        else if (parts[1] === 'year') {
          subcommand = 'year';
          args.year = parts[2];
        } else if (parts[1] === 'month') {
          subcommand = 'month';
          args.month = parts[2];
        } else if (parts[1] === 'search') {
          subcommand = 'search';
          args.query = parts.slice(2).join(' ');
        } else if (parts[1] === 'stats') subcommand = 'stats';
        else if (parts[1] === 'export') {
          subcommand = 'export';
          args.format = parts[2] || 'pdf';
        } else if (parts[1] === 'share') subcommand = 'share';
        else if (parts[1] === 'shares') subcommand = 'shares';
        else if (parts[1] === 'revoke-share') {
          subcommand = 'revoke-share';
          args.shareId = parts[2];
        } else if (parts[1] === 'admin') {
          subcommand = 'admin-' + (parts[2] || 'health');
          if (parts[2] === 'correction') {
            args.eventId = parts[3];
            args.reason = parts.slice(4).join(' ');
          }
        }
      }

      const res = await fetch('/api/v1/bot/simulate-command', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          subcommand,
          args,
          context: { userId: 'usr_' + currentJempId, userHandle: 'builder.' + currentJempId.toLowerCase(), isAdmin: true },
        }),
      });

      const response = await res.json();
      if (!res.ok) {
        throw new Error(response.error || `Command request failed (${res.status})`);
      }

      const botMsg: SimulatedMessage = {
        id: 'bot-' + Date.now(),
        author: 'Jobless Empire Timeline Bot',
        isBot: true,
        avatarText: 'JEMP',
        timestamp: 'Today at ' + new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        content: response.content,
        embed: response.embed,
        components: response.components,
        file: response.file,
      };

      setMessages((prev) => [...prev, botMsg]);
      if (onRefreshTimeline) onRefreshTimeline();
    } catch (err: any) {
      setMessages((prev) => [
        ...prev,
        {
          id: 'err-' + Date.now(),
          author: 'System',
          isBot: true,
          avatarText: 'SYS',
          timestamp: 'Today at ' + new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          content: `❌ Command Error: ${err.message}`,
        },
      ]);
    } finally {
      setLoading(false);
      setCommandInput('');
    }
  };

  const handleButtonClick = async (customId: string) => {
    const parts = customId.split(':');
    const action = parts[1];
    const jempId = parts[2] || currentJempId;

    let cmd = `/timeline ${action}`;
    if (action === 'timeline') cmd = `/timeline`;
    if (action === 'export') cmd = `/timeline export pdf`;

    await handleRunCommand(cmd);
  };

  return (
    <div className="bg-[#1e1f22] text-[#dbdee1] rounded-xl border border-[#2b2d31] overflow-hidden shadow-2xl flex flex-col h-[740px]">
      {/* Discord Channel Header */}
      <div className="bg-[#2b2d31] px-4 py-3 border-b border-[#1f2023] flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="text-xl font-bold text-slate-400">#</div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-semibold text-white tracking-wide">
                {channel === 'profile-manager' ? 'profile-manager' : 'bot-commands'}
              </span>
              <span className="text-[10px] px-2 py-0.5 rounded bg-[#111214] text-slate-400 font-mono">
                JEMP ECOSYSTEM
              </span>
            </div>
            <p className="text-xs text-slate-400">
              {channel === 'profile-manager'
                ? 'Central Member Hub · Canonical Proof-of-Work & Identity'
                : 'Discord Slash Commands Simulator'}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => {
              setChannel('profile-manager');
              loadProfileManager();
            }}
            className={`px-3 py-1 text-xs rounded font-medium transition-colors ${
              channel === 'profile-manager'
                ? 'bg-[#5865f2] text-white'
                : 'bg-[#1e1f22] text-slate-400 hover:text-white'
            }`}
          >
            #profile-manager
          </button>
          <button
            onClick={() => setChannel('commands')}
            className={`px-3 py-1 text-xs rounded font-medium transition-colors ${
              channel === 'commands'
                ? 'bg-[#5865f2] text-white'
                : 'bg-[#1e1f22] text-slate-400 hover:text-white'
            }`}
          >
            Terminal View
          </button>
          <button
            onClick={loadProfileManager}
            title="Reset Profile Manager Embed"
            className="p-1.5 rounded hover:bg-[#35373c] text-slate-400 hover:text-white"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* Messages Scroll Area */}
      <div className="flex-1 overflow-y-auto p-4 space-y-6 font-sans">
        {messages.map((msg) => (
          <div key={msg.id} className="flex gap-4 group hover:bg-[#2b2d31]/30 -mx-4 px-4 py-1.5 rounded transition-colors">
            <div
              className={`w-10 h-10 rounded-full flex items-center justify-center font-bold text-xs shrink-0 ${
                msg.isBot ? 'bg-gradient-to-br from-zinc-800 to-black text-amber-300 border border-zinc-700' : 'bg-indigo-600 text-white'
              }`}
            >
              {msg.avatarText}
            </div>

            <div className="flex-1 min-w-0">
              <div className="flex items-baseline gap-2 mb-1">
                <span className="font-semibold text-sm text-white">{msg.author}</span>
                {msg.isBot && (
                  <span className="bg-[#5865f2] text-white text-[10px] font-bold px-1.5 py-0.2 rounded">
                    BOT
                  </span>
                )}
                <span className="text-[11px] text-slate-500">{msg.timestamp}</span>
              </div>

              {msg.content && (
                <div className="text-sm text-[#dbdee1] whitespace-pre-wrap leading-relaxed">
                  {msg.content}
                </div>
              )}

              {/* Discord File Attachment */}
              {msg.file && (
                <div className="mt-3 p-3 bg-[#2b2d31] rounded-lg border border-[#35373c] flex items-center justify-between max-w-md">
                  <div className="flex items-center gap-3">
                    <Download className="w-5 h-5 text-indigo-400" />
                    <div>
                      <div className="text-xs font-semibold text-white">{msg.file.name}</div>
                      <div className="text-[10px] text-slate-400">{msg.file.contentType}</div>
                    </div>
                  </div>
                  <a
                    href={`/api/v1/timeline/members/${currentJempId}/export?format=${msg.file.name.split('.').pop()}`}
                    download={msg.file.name}
                    className="px-3 py-1 bg-indigo-600 hover:bg-indigo-500 text-white text-xs rounded font-medium transition"
                  >
                    Download
                  </a>
                </div>
              )}

              {/* Discord Embed Render */}
              {msg.embed && (
                <div className="mt-2 border-l-4 border-zinc-500 bg-[#2b2d31] rounded-r p-4 max-w-xl shadow-md">
                  {msg.embed.title && (
                    <div className="font-bold text-base text-white tracking-tight mb-2">
                      {msg.embed.title}
                    </div>
                  )}

                  {msg.embed.description && (
                    <div className="text-xs text-slate-300 whitespace-pre-wrap leading-relaxed mb-3">
                      {msg.embed.description}
                    </div>
                  )}

                  {msg.embed.fields && msg.embed.fields.length > 0 && (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3 my-3">
                      {msg.embed.fields.map((f: any, i: number) => (
                        <div key={i} className={f.inline ? 'col-span-1' : 'col-span-2'}>
                          <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1">
                            {f.name}
                          </div>
                          <div className="text-xs text-slate-200 whitespace-pre-wrap leading-relaxed">
                            {f.value}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

                  {msg.embed.footer && (
                    <div className="pt-2 mt-2 border-t border-zinc-700/50 text-[10px] text-slate-500 font-mono">
                      {msg.embed.footer.text}
                    </div>
                  )}
                </div>
              )}

              {/* Discord Interactive Buttons */}
              {msg.components && msg.components.length > 0 && (
                <div className="mt-3 flex flex-wrap gap-2">
                  {msg.components.map((row: any, rIdx: number) =>
                    row.components?.map((btn: any, bIdx: number) => {
                      let btnStyle = 'bg-[#4e5058] hover:bg-[#6d6f78] text-white';
                      if (btn.style === 1) btnStyle = 'bg-[#5865f2] hover:bg-[#4752c4] text-white';
                      if (btn.style === 3) btnStyle = 'bg-[#248046] hover:bg-[#1a6334] text-white';
                      if (btn.style === 4) btnStyle = 'bg-[#da373c] hover:bg-[#a1282c] text-white';

                      return (
                        <button
                          key={`${rIdx}-${bIdx}`}
                          onClick={() => handleButtonClick(btn.custom_id)}
                          className={`px-3.5 py-1.5 text-xs font-semibold rounded transition shadow-sm flex items-center gap-1.5 ${btnStyle}`}
                        >
                          {btn.label}
                        </button>
                      );
                    })
                  )}
                </div>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Suggested Command Chips */}
      <div className="px-4 py-2 bg-[#2b2d31]/60 border-t border-[#232428] flex items-center gap-2 overflow-x-auto text-[11px]">
        <span className="text-slate-400 uppercase tracking-wider font-semibold text-[10px] shrink-0">Quick Commands:</span>
        {[
          '/timeline',
          '/timeline stats',
          '/timeline years',
          '/timeline search milestone',
          '/timeline export pdf',
          '/timeline export json',
          '/timeline share',
          '/timeline admin health',
          '/timeline admin reconcile',
        ].map((cmd) => (
          <button
            key={cmd}
            onClick={() => handleRunCommand(cmd)}
            className="px-2 py-0.5 rounded bg-[#1e1f22] text-slate-300 hover:text-white hover:bg-[#35373c] border border-zinc-700/50 font-mono whitespace-nowrap transition"
          >
            {cmd}
          </button>
        ))}
      </div>

      {/* Input Bar */}
      <div className="p-4 bg-[#2b2d31]">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            handleRunCommand(commandInput);
          }}
          className="flex items-center gap-2 bg-[#383a40] rounded-lg px-3 py-2 border border-transparent focus-within:border-[#5865f2] transition-colors"
        >
          <span className="text-slate-400 font-mono font-bold text-sm">/</span>
          <input
            type="text"
            value={commandInput}
            onChange={(e) => setCommandInput(e.target.value)}
            placeholder="Type a slash command (e.g. /timeline, /timeline stats, /timeline share)..."
            className="flex-1 bg-transparent text-white text-sm focus:outline-none placeholder-slate-500 font-mono"
          />
          <button
            type="submit"
            disabled={loading || !commandInput.trim()}
            className="p-1.5 text-slate-400 hover:text-white disabled:opacity-40 transition-colors"
          >
            <Send className="w-4 h-4" />
          </button>
        </form>
      </div>
    </div>
  );
};
