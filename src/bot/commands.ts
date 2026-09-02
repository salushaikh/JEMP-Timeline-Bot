import {
  getMemberByDiscordId,
  getMemberByJempId,
  ensureMember,
  getMemberTimeline,
  getMemberStats,
  getMemberYears,
  getMemberMonths,
  createAdminCorrection,
} from '../services/timelineService.ts';
import { createTimelineShare, getMemberActiveShares, revokeTimelineShare } from '../services/shareService.ts';
import { generateExport } from '../services/exportService.ts';
import { runReconciliationDiagnostics, getAuditLogs } from '../services/auditService.ts';
import { seedDemoData, clearDemoData } from '../services/seedService.ts';
import { buildProfileManagerEmbed, buildTimelineEmbed, buildStatsEmbed } from './timelineEmbeds.ts';
import { Member } from '../types/timeline.ts';

export interface CommandContext {
  userId: string;
  userHandle: string;
  isAdmin?: boolean;
}

export interface CommandResponse {
  type: 'embed' | 'text' | 'file';
  embed?: any;
  components?: any[];
  content?: string;
  ephemeral?: boolean;
  file?: {
    name: string;
    buffer: Buffer | string;
    contentType: string;
  };
}

export async function handleTimelineCommand(
  subcommand: string,
  args: Record<string, any>,
  ctx: CommandContext
): Promise<CommandResponse> {
  // Resolve member by Discord ID or JEMP# if provided
  let member: Member | null = null;
  if (args.jempId) {
    member = await getMemberByJempId(args.jempId);
  } else {
    member = await getMemberByDiscordId(ctx.userId);
  }

  // If no member found, create one or fallback to demo member
  if (!member) {
    member = await ensureMember('JEMP#014', ctx.userId, ctx.userHandle);
  }

  const stats = await getMemberStats(member.jemp_id);

  switch (subcommand) {
    case 'profile':
    case 'profile-manager': {
      const { embed, row } = buildProfileManagerEmbed(member, stats);
      return { type: 'embed', embed: embed.toJSON(), components: [row.toJSON()], ephemeral: false };
    }

    case 'view':
    case 'root':
    case 'timeline': {
      const year = args.year ? parseInt(args.year, 10) : undefined;
      const month = args.month as string | undefined;
      const { events } = await getMemberTimeline({
        jempId: member.jemp_id,
        year,
        limit: 10,
      });
      const { embed, buttonRow } = buildTimelineEmbed({ member, events, stats, year, month });
      return { type: 'embed', embed: embed.toJSON(), components: [buttonRow.toJSON()], ephemeral: true };
    }

    case 'stats': {
      const { embed, row } = buildStatsEmbed(member, stats);
      return { type: 'embed', embed: embed.toJSON(), components: [row.toJSON()], ephemeral: true };
    }

    case 'years': {
      const years = await getMemberYears(member.jemp_id);
      const content = years.length > 0
        ? `📅 **Documented Years for ${member.jemp_id}:**\n${years.map((y) => `• **${y}** (/timeline year ${y})`).join('\n')}`
        : `No events recorded yet for ${member.jemp_id}.`;
      return { type: 'text', content, ephemeral: true };
    }

    case 'year': {
      const y = parseInt(args.year, 10);
      if (isNaN(y)) return { type: 'text', content: 'Please provide a valid year (e.g. 2026).', ephemeral: true };
      const { events } = await getMemberTimeline({ jempId: member.jemp_id, year: y });
      const { embed, buttonRow } = buildTimelineEmbed({ member, events, stats, year: y });
      return { type: 'embed', embed: embed.toJSON(), components: [buttonRow.toJSON()], ephemeral: true };
    }

    case 'month': {
      const monthName = args.month as string;
      const { events } = await getMemberTimeline({ jempId: member.jemp_id, search: monthName });
      const { embed, buttonRow } = buildTimelineEmbed({ member, events, stats, month: monthName });
      return { type: 'embed', embed: embed.toJSON(), components: [buttonRow.toJSON()], ephemeral: true };
    }

    case 'search': {
      const query = args.query as string;
      if (!query || query.trim().length === 0) {
        return { type: 'text', content: 'Usage: `/timeline search <query>`', ephemeral: true };
      }
      const { events } = await getMemberTimeline({ jempId: member.jemp_id, search: query, limit: 10 });
      if (events.length === 0) {
        return { type: 'text', content: `No timeline records found matching: "${query}"`, ephemeral: true };
      }
      const { embed, buttonRow } = buildTimelineEmbed({ member, events, stats });
      embed.setTitle(`🔍 TIMELINE SEARCH: "${query}" (${events.length} results)`);
      return { type: 'embed', embed: embed.toJSON(), components: [buttonRow.toJSON()], ephemeral: true };
    }

    case 'share': {
      const shareResult = await createTimelineShare({
        jempId: member.jemp_id,
        createdBy: member.handle,
        expiryHours: 24,
      });
      const content =
        `🛡️ **SECURE 24-HOUR PUBLIC TIMELINE SHARE**\n\n` +
        `**Member:** \`${member.jemp_id}\`\n` +
        `**Share ID:** \`${shareResult.shareId}\`\n` +
        `**Status:** ACTIVE\n` +
        `**Expires:** In 24 Hours (${new Date(shareResult.expiresAt).toLocaleTimeString()} UTC)\n\n` +
        `🔗 **Share Link:**\n${shareResult.shareUrl}\n\n` +
        `*Only shareable, verified proof-of-work events are accessible via this link. No private emails, discord IDs, or unapproved records are visible.*`;
      return { type: 'text', content, ephemeral: true };
    }

    case 'shares': {
      const activeShares = await getMemberActiveShares(member.jemp_id);
      if (activeShares.length === 0) {
        return { type: 'text', content: `No active public shares for ${member.jemp_id}. Generate one with \`/timeline share\`.`, ephemeral: true };
      }
      const list = activeShares
        .map(
          (s) =>
            `• **${s.share_id}** (Expires: ${new Date(s.expires_at).toLocaleString()}) - Accessed: ${s.access_count} times\n  Revoke: \`/timeline revoke-share ${s.share_id}\``
        )
        .join('\n\n');
      return { type: 'text', content: `📋 **Active Shares for ${member.jemp_id}:**\n\n${list}`, ephemeral: true };
    }

    case 'revoke-share': {
      const tokenOrId = args.shareId as string;
      if (!tokenOrId) return { type: 'text', content: 'Usage: `/timeline revoke-share <share_id>`', ephemeral: true };
      const success = await revokeTimelineShare(tokenOrId, member.handle);
      return {
        type: 'text',
        content: success
          ? `✅ Share \`${tokenOrId}\` has been revoked immediately. Any subsequent access will return 'SHARE REVOKED'.`
          : `❌ Share \`${tokenOrId}\` could not be found or was already revoked.`,
        ephemeral: true,
      };
    }

    case 'export': {
      const format = (args.format || 'pdf') as 'pdf' | 'docx' | 'markdown' | 'json';
      const scope = (args.scope || 'full') as 'full' | 'year' | 'project' | 'shareable';
      const exportData = await generateExport({
        jempId: member.jemp_id,
        format,
        scope,
        actor: member.handle,
      });

      return {
        type: 'file',
        content: `📄 **Jobless Empire Proof-of-Work Export** generated for **${member.jemp_id}** (${exportData.eventCount} events included).`,
        file: {
          name: exportData.filename,
          buffer: exportData.buffer || exportData.text || '',
          contentType: exportData.contentType,
        },
        ephemeral: true,
      };
    }

    // ===================================
    // ADMIN SUBCOMMANDS
    // ===================================
    case 'admin-health': {
      const diag = await runReconciliationDiagnostics();
      const content =
        `🏥 **JOBLESS EMPIRE · TIMELINE SYSTEM HEALTH**\n\n` +
        `**Status:** ${diag.status === 'HEALTHY' ? '🟢 HEALTHY' : '⚠️ ' + diag.status}\n` +
        `**Database Engine:** PostgreSQL Connected\n` +
        `**Total Documented Events:** ${diag.summary.totalEvents}\n` +
        `**Total Registered Members:** ${diag.summary.totalMembers}\n` +
        `**Audit Trail Corrections:** ${diag.summary.totalCorrections}\n` +
        `**Future Timestamp Anomalies:** ${diag.summary.futureEvents}\n` +
        `**Timestamp:** ${diag.timestamp}`;
      return { type: 'text', content, ephemeral: true };
    }

    case 'admin-reconcile': {
      const diag = await runReconciliationDiagnostics();
      const issuesCount = diag.issues.missingMembers.length + diag.issues.duplicateSources.length;
      let report = `🩺 **RECONCILIATION AUDIT REPORT**\n\n`;
      if (issuesCount === 0) {
        report += `✅ All foreign references, member identities, and unique constraints are consistent. Zero orphaned events detected.`;
      } else {
        report += `⚠️ Discrepancies detected:\n`;
        if (diag.issues.missingMembers.length > 0) {
          report += `• Missing member identities: ${JSON.stringify(diag.issues.missingMembers)}\n`;
        }
        if (diag.issues.duplicateSources.length > 0) {
          report += `• Duplicate source IDs: ${JSON.stringify(diag.issues.duplicateSources)}\n`;
        }
      }
      return { type: 'text', content: report, ephemeral: true };
    }

    case 'admin-audit': {
      const logs = await getAuditLogs(10);
      const text = logs
        .map(
          (l) =>
            `• \`${new Date(l.timestamp).toLocaleTimeString()}\` [**${l.action}**] Actor: ${l.actor} | Source: ${l.source_system} ${
              l.jemp_id ? `| Member: ${l.jemp_id}` : ''
            }`
        )
        .join('\n');
      return { type: 'text', content: `📜 **TIMELINE AUDIT LOG (Last 10 entries):**\n\n${text}`, ephemeral: true };
    }

    case 'admin-correction': {
      const { eventId, reason, newTitle, newDescription } = args;
      if (!eventId || !reason) {
        return { type: 'text', content: 'Usage: `/timeline admin correction <eventId> <reason>`', ephemeral: true };
      }
      try {
        const corr = await createAdminCorrection({
          originalEventId: eventId,
          reason,
          correctedTitle: newTitle,
          correctedDescription: newDescription,
          adminUser: ctx.userHandle || 'Admin',
        });
        return {
          type: 'text',
          content: `✅ **Correction Registered:**\nOriginal Event: \`${corr.originalEvent.event_id}\` (Preserved)\nNew Correction Event: \`${corr.correctionEvent.event_id}\`\nReason: "${reason}"`,
          ephemeral: true,
        };
      } catch (err: any) {
        return { type: 'text', content: `❌ Correction failed: ${err.message}`, ephemeral: true };
      }
    }

    case 'admin-seed-demo': {
      const res = await seedDemoData();
      return {
        type: 'text',
        content: `🌱 **Demo Seed Completed:** Created ${res.eventsCreated} realistic proof-of-work events across members: ${res.members.join(', ')}.`,
        ephemeral: true,
      };
    }

    case 'admin-clear-demo': {
      const res = await clearDemoData();
      return {
        type: 'text',
        content: `🧹 **Demo Cleared:** Removed ${res.deletedEvents} demo events and ${res.deletedMembers} demo members.`,
        ephemeral: true,
      };
    }

    default:
      return {
        type: 'text',
        content: `Unknown timeline command: \`${subcommand}\`. Try \`/timeline\`, \`/timeline stats\`, or \`/timeline export\`.`,
        ephemeral: true,
      };
  }
}
