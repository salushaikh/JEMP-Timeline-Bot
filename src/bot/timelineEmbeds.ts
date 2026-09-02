import { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, StringSelectMenuBuilder } from 'discord.js';
import { TimelineEvent, ProofOfWorkStats, Member } from '../types/timeline.ts';

export function buildProfileManagerEmbed(member: Member, stats: ProofOfWorkStats) {
  const embed = new EmbedBuilder()
    .setColor(0x1a1a1a) // despair.us dark aesthetic
    .setTitle('⚔️ JOBLESS EMPIRE · PROFILE MANAGER')
    .setDescription(
      `**${member.jemp_id}**\nSTATUS: **${member.status}**\n\n` +
      `*"A job title can disappear. Your work doesn't have to."*\n` +
      `*"NO JOB. STILL BUILDING."*\n\n` +
      `━━━━━━━━━━━━━━━━━━━━━━━━━━━━`
    )
    .addFields(
      {
        name: '📁 PROFILE & IDENTITY',
        value: `**Handle:** @${member.handle}\n**Verified Entries:** ${stats.official_entries}\n**Status:** Registered Builder`,
        inline: true,
      },
      {
        name: '🛡️ DOCUMENTED WORK',
        value: `**Projects:** ${stats.projects_participated}\n**Brainstorms:** ${stats.brainstorms_participated}\n**Client Work:** ${stats.client_opportunities}`,
        inline: true,
      },
      {
        name: '📈 DELIVERABLES',
        value: `**Milestones Completed:** ${stats.milestones_completed}\n**Published Reports:** ${stats.reports_submitted}\n**Work Updates:** ${stats.work_updates}`,
        inline: false,
      }
    )
    .setFooter({
      text: 'Jobless Empire · https://despair.us · Central Proof-of-Work Record',
    });

  const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder()
      .setCustomId(`jemp:timeline:${member.jemp_id}`)
      .setLabel('VIEW TIMELINE')
      .setStyle(ButtonStyle.Primary),
    new ButtonBuilder()
      .setCustomId(`jemp:stats:${member.jemp_id}`)
      .setLabel('TIMELINE STATS')
      .setStyle(ButtonStyle.Secondary),
    new ButtonBuilder()
      .setCustomId(`jemp:export:${member.jemp_id}`)
      .setLabel('EXPORT TIMELINE')
      .setStyle(ButtonStyle.Secondary),
    new ButtonBuilder()
      .setCustomId(`jemp:share:${member.jemp_id}`)
      .setLabel('CREATE 24H SHARE')
      .setStyle(ButtonStyle.Success)
  );

  return { embed, row };
}

export function buildTimelineEmbed(params: {
  member: Member;
  events: TimelineEvent[];
  stats: ProofOfWorkStats;
  year?: number;
  month?: string;
  page?: number;
}) {
  const { member, events, stats, year, month } = params;

  let filterLabel = 'ALL DOCUMENTED EVENTS';
  if (year && month) filterLabel = `${month.toUpperCase()} ${year}`;
  else if (year) filterLabel = `YEAR ${year}`;

  const embed = new EmbedBuilder()
    .setColor(0x222222)
    .setTitle(`⚔️ JOBLESS EMPIRE · PROOF-OF-WORK TIMELINE`)
    .setDescription(
      `**${member.jemp_id}** · ${member.status}\n` +
      `Showing: **${filterLabel}** (${events.length} entries)\n\n` +
      `━━━━━━━━━━━━━━━━━━━━━━━━━━━━`
    );

  if (events.length === 0) {
    embed.addFields({
      name: 'NO RECORDS FOUND',
      value: 'No official timeline events recorded for this selection criteria.',
    });
  } else {
    // Show up to 5 events per Discord message limit
    const displayEvents = events.slice(0, 6);
    displayEvents.forEach((ev) => {
      const dateStr = new Date(ev.occurred_at).toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'short',
        day: '2-digit',
      });

      let entityContext = '';
      if (ev.source_entity_name && ev.source_entity_id) {
        entityContext = `\n**Entity:** \`${ev.source_entity_id}\` · ${ev.source_entity_name}`;
      }

      let correctionNote = '';
      if (ev.corrected_by_event_id) {
        correctionNote = `\n*⚠️ Correction on file: ${ev.correction_reason}*`;
      }

      embed.addFields({
        name: `${dateStr} · ${ev.title}`,
        value: `**${ev.event_type}** · Source: *${ev.source_system}*${entityContext}\n${ev.description}${correctionNote}`,
      });
    });

    if (events.length > 6) {
      embed.addFields({
        name: '...',
        value: `*+${events.length - 6} additional entries. Use filters or export for full view.*`,
      });
    }
  }

  embed.addFields({
    name: 'SUMMARY METRICS',
    value: `Entries: **${stats.total_entries}** · Projects: **${stats.projects_participated}** · Brainstorms: **${stats.brainstorms_participated}** · Client Opps: **${stats.client_opportunities}**`,
  });

  embed.setFooter({
    text: 'Jobless Empire · despair.us · "Your work should leave a trail."',
  });

  const buttonRow = new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder()
      .setCustomId(`jemp:years:${member.jemp_id}`)
      .setLabel('YEARS')
      .setStyle(ButtonStyle.Secondary),
    new ButtonBuilder()
      .setCustomId(`jemp:stats:${member.jemp_id}`)
      .setLabel('STATS')
      .setStyle(ButtonStyle.Secondary),
    new ButtonBuilder()
      .setCustomId(`jemp:export:${member.jemp_id}`)
      .setLabel('EXPORT')
      .setStyle(ButtonStyle.Secondary),
    new ButtonBuilder()
      .setCustomId(`jemp:share:${member.jemp_id}`)
      .setLabel('SHARE')
      .setStyle(ButtonStyle.Success)
  );

  return { embed, buttonRow };
}

export function buildStatsEmbed(member: Member, stats: ProofOfWorkStats) {
  const embed = new EmbedBuilder()
    .setColor(0x1a1a1a)
    .setTitle(`PROOF-OF-WORK SUMMARY · ${member.jemp_id}`)
    .setDescription(
      `**MEMBER PROOF-OF-WORK RECORD**\n` +
      `Canonical Identity: \`${member.jemp_id}\`\n` +
      `Member Handle: @${member.handle}\n\n` +
      `*Timeline tracks documented activity and deliverables only. Working hours are intentionally not estimated.*`
    )
    .addFields(
      {
        name: '📊 DOCUMENTED ACTIVITY',
        value: `Timeline Entries: **${stats.total_entries}**\nVerified Official: **${stats.official_entries}**\nWork Updates: **${stats.work_updates}**`,
        inline: true,
      },
      {
        name: '🏗️ ECOSYSTEM ENGAGEMENT',
        value: `Projects Participated: **${stats.projects_participated}**\nBrainstorms Participated: **${stats.brainstorms_participated}**\nClient/Hiring Opportunities: **${stats.client_opportunities}**`,
        inline: true,
      },
      {
        name: '🎯 VERIFIED OUTCOMES',
        value: `Milestones Completed: **${stats.milestones_completed}**\nOfficial Reports Published: **${stats.reports_submitted}**\nFirst Documented Event: ${
          stats.first_event_at ? new Date(stats.first_event_at).toLocaleDateString() : 'N/A'
        }\nLatest Documented Event: ${
          stats.latest_event_at ? new Date(stats.latest_event_at).toLocaleDateString() : 'N/A'
        }`,
        inline: false,
      }
    )
    .setFooter({
      text: 'Jobless Empire · despair.us · Proof of work remains forever.',
    });

  const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder()
      .setCustomId(`jemp:timeline:${member.jemp_id}`)
      .setLabel('BACK TO TIMELINE')
      .setStyle(ButtonStyle.Primary),
    new ButtonBuilder()
      .setCustomId(`jemp:export:${member.jemp_id}`)
      .setLabel('EXPORT DOSSIER')
      .setStyle(ButtonStyle.Secondary),
    new ButtonBuilder()
      .setCustomId(`jemp:share:${member.jemp_id}`)
      .setLabel('GENERATE SHARE')
      .setStyle(ButtonStyle.Success)
  );

  return { embed, row };
}
