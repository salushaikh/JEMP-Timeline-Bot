import { Client, GatewayIntentBits, SlashCommandBuilder, REST, Routes } from 'discord.js';
import { handleTimelineCommand } from './commands.ts';

let discordClient: Client | null = null;
let isBotReady = false;

export function getDiscordStatus() {
  return {
    configured: Boolean(process.env.DISCORD_TOKEN),
    connected: isBotReady,
    guildId: process.env.DISCORD_GUILD_ID || null,
    profileChannelId: process.env.PROFILE_MANAGER_CHANNEL_ID || null,
  };
}

export function buildTimelineSlashCommands() {
  const timelineCommand = new SlashCommandBuilder()
    .setName('timeline')
    .setDescription('Jobless Empire Proof-of-Work dossier and verified timeline engine')
    .addSubcommand((sub) =>
      sub
        .setName('view')
        .setDescription('View personal or member verified proof-of-work timeline')
        .addIntegerOption((opt) => opt.setName('year').setDescription('Filter by specific calendar year (e.g. 2026)'))
        .addStringOption((opt) => opt.setName('month').setDescription('Filter by month (e.g. September)'))
        .addStringOption((opt) => opt.setName('jempid').setDescription('Admin/Public view by JEMP# (e.g. JEMP#014)'))
    )
    .addSubcommand((sub) =>
      sub
        .setName('profile')
        .setDescription('View the Profile Manager card and interactive actions')
        .addStringOption((opt) => opt.setName('jempid').setDescription('Target JEMP# member identifier'))
    )
    .addSubcommand((sub) =>
      sub
        .setName('stats')
        .setDescription('Display comprehensive statistics and verified impact milestones')
        .addStringOption((opt) => opt.setName('jempid').setDescription('Target JEMP# member identifier'))
    )
    .addSubcommand((sub) =>
      sub
        .setName('years')
        .setDescription('List all calendar years with documented proof-of-work records')
        .addStringOption((opt) => opt.setName('jempid').setDescription('Target JEMP# member identifier'))
    )
    .addSubcommand((sub) =>
      sub
        .setName('year')
        .setDescription('View documented timeline records for a specific year')
        .addIntegerOption((opt) => opt.setName('year').setDescription('Year (e.g. 2026)').setRequired(true))
        .addStringOption((opt) => opt.setName('jempid').setDescription('Target JEMP# member identifier'))
    )
    .addSubcommand((sub) =>
      sub
        .setName('search')
        .setDescription('Search proof-of-work dossier by keyword, milestone, or deliverable')
        .addStringOption((opt) => opt.setName('query').setDescription('Search query').setRequired(true))
    )
    .addSubcommand((sub) =>
      sub
        .setName('share')
        .setDescription('Generate a secure, privacy-filtered 24-hour public dossier link')
    )
    .addSubcommand((sub) =>
      sub
        .setName('shares')
        .setDescription('List all your active public share links with view counts')
    )
    .addSubcommand((sub) =>
      sub
        .setName('revoke-share')
        .setDescription('Revoke an active public share link immediately')
        .addStringOption((opt) => opt.setName('shareid').setDescription('Share token or ID to revoke').setRequired(true))
    )
    .addSubcommand((sub) =>
      sub
        .setName('export')
        .setDescription('Generate and download an official verified Proof-of-Work Dossier')
        .addStringOption((opt) =>
          opt
            .setName('format')
            .setDescription('Document format')
            .setRequired(true)
            .addChoices(
              { name: 'PDF (Official Dossier)', value: 'pdf' },
              { name: 'DOCX (Editable Word Document)', value: 'docx' },
              { name: 'Markdown (Plain Text)', value: 'markdown' },
              { name: 'JSON (Raw Verified Data)', value: 'json' }
            )
        )
        .addStringOption((opt) =>
          opt
            .setName('scope')
            .setDescription('Scope of exported events')
            .addChoices(
              { name: 'Full Dossier (All Events)', value: 'full' },
              { name: 'Current Year Only', value: 'year' },
              { name: 'Shareable / Public Only', value: 'shareable' }
            )
        )
    );

  const adminCommand = new SlashCommandBuilder()
    .setName('timeline-admin')
    .setDescription('Administrative operations for the Jobless Empire Timeline Engine')
    .addSubcommand((sub) =>
      sub.setName('health').setDescription('Check system diagnostics, event counts, and database consistency')
    )
    .addSubcommand((sub) =>
      sub.setName('reconcile').setDescription('Run automated reconciliation across members and source systems')
    )
    .addSubcommand((sub) =>
      sub.setName('audit').setDescription('View the latest immutable audit log entries')
    )
    .addSubcommand((sub) =>
      sub
        .setName('correction')
        .setDescription('Append an immutable administrative correction without altering history')
        .addStringOption((opt) => opt.setName('eventid').setDescription('Original Event ID').setRequired(true))
        .addStringOption((opt) => opt.setName('reason').setDescription('Reason for correction').setRequired(true))
        .addStringOption((opt) => opt.setName('title').setDescription('Updated Title'))
        .addStringOption((opt) => opt.setName('description').setDescription('Updated Description'))
    )
    .addSubcommand((sub) =>
      sub.setName('seed-demo').setDescription('Seed demo builder proof-of-work events')
    )
    .addSubcommand((sub) =>
      sub.setName('clear-demo').setDescription('Clear demo builder events')
    );

  return [timelineCommand.toJSON(), adminCommand.toJSON()];
}

export async function registerSlashCommands(clientId: string, token: string, guildId?: string | null) {
  try {
    const rest = new REST({ version: '10' }).setToken(token);
    const commands = buildTimelineSlashCommands();

    if (guildId) {
      console.log(`⚡ Registering ${commands.length} slash commands to Discord Guild: ${guildId}...`);
      await rest.put(Routes.applicationGuildCommands(clientId, guildId), { body: commands });
      console.log(`✅ Successfully registered guild slash commands to guild ${guildId}`);
    } else {
      console.log(`⚡ Registering ${commands.length} global slash commands (Client ID: ${clientId})...`);
      await rest.put(Routes.applicationCommands(clientId), { body: commands });
      console.log(`✅ Successfully registered global slash commands.`);
    }
  } catch (error: any) {
    console.error('❌ Failed to register Discord slash commands:', error?.message || error);
  }
}

export async function initDiscordBot() {
  const token = process.env.DISCORD_TOKEN;
  const clientId = process.env.DISCORD_CLIENT_ID;
  const guildId = process.env.DISCORD_GUILD_ID;

  if (!token) {
    console.log('ℹ️ DISCORD_TOKEN is not configured. Running in local simulated mode.');
    return null;
  }

  try {
    // Automatically register or update slash commands on boot if client ID is provided
    if (clientId) {
      registerSlashCommands(clientId, token, guildId).catch((err) =>
        console.error('Background slash command registration error:', err)
      );
    } else {
      console.warn('⚠️ DISCORD_CLIENT_ID is not set in environment. Slash commands could not be published to Discord REST API.');
    }

    discordClient = new Client({
      intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
      ],
    });

    discordClient.once('ready', () => {
      isBotReady = true;
      console.log(`🤖 Discord Timeline Bot logged in as ${discordClient?.user?.tag}`);
    });

    discordClient.on('interactionCreate', async (interaction) => {
      try {
        if (interaction.isChatInputCommand()) {
          const commandName = interaction.commandName;
          const subcommand = interaction.options.getSubcommand(false) || 'view';

          // Route timeline-admin subcommands with admin prefix
          const effectiveSubcommand = commandName === 'timeline-admin' ? `admin-${subcommand}` : subcommand;

          const year = interaction.options.getInteger('year')?.toString();
          const month = interaction.options.getString('month') || undefined;
          const query = interaction.options.getString('query') || undefined;
          const format = interaction.options.getString('format') || undefined;
          const scope = interaction.options.getString('scope') || undefined;
          const jempId = interaction.options.getString('jempid') || undefined;
          const reason = interaction.options.getString('reason') || undefined;
          const eventId = interaction.options.getString('eventid') || undefined;
          const newTitle = interaction.options.getString('title') || undefined;
          const newDescription = interaction.options.getString('description') || undefined;
          const shareId = interaction.options.getString('shareid') || undefined;

          const response = await handleTimelineCommand(
            effectiveSubcommand,
            { year, month, query, format, scope, jempId, reason, eventId, newTitle, newDescription, shareId },
            {
              userId: interaction.user.id,
              userHandle: interaction.user.username,
              isAdmin: true,
            }
          );

          if (response.type === 'embed') {
            await interaction.reply({
              embeds: [response.embed],
              components: response.components || [],
              ephemeral: response.ephemeral ?? true,
            });
          } else if (response.type === 'file' && response.file) {
            await interaction.reply({
              content: response.content,
              files: [{ attachment: Buffer.from(response.file.buffer), name: response.file.name }],
              ephemeral: response.ephemeral ?? true,
            });
          } else {
            await interaction.reply({
              content: response.content || 'Action executed.',
              ephemeral: response.ephemeral ?? true,
            });
          }
        } else if (interaction.isButton()) {
          // Parse customId: e.g. jemp:timeline:JEMP#014
          const parts = interaction.customId.split(':');
          const action = parts[1];
          const jempId = parts[2];

          const response = await handleTimelineCommand(
            action,
            { jempId },
            {
              userId: interaction.user.id,
              userHandle: interaction.user.username,
            }
          );

          if (response.type === 'embed') {
            await interaction.reply({
              embeds: [response.embed],
              components: response.components || [],
              ephemeral: response.ephemeral ?? true,
            });
          } else {
            await interaction.reply({
              content: response.content || 'Action completed.',
              ephemeral: response.ephemeral ?? true,
            });
          }
        }
      } catch (err: any) {
        console.error('Error handling Discord interaction:', err);
        if (interaction.isRepliable() && !interaction.replied) {
          await interaction.reply({ content: `An error occurred: ${err.message}`, ephemeral: true });
        }
      }
    });

    await discordClient.login(token);
    return discordClient;
  } catch (error) {
    console.error('Failed to initialize Discord client:', error);
    return null;
  }
}
