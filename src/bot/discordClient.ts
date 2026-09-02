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

export async function initDiscordBot() {
  const token = process.env.DISCORD_TOKEN;
  if (!token) {
    console.log('ℹ️ DISCORD_TOKEN is not configured. Running in local simulated mode.');
    return null;
  }

  try {
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
          const subcommand = interaction.options.getSubcommand(false) || 'view';
          const year = interaction.options.getInteger('year')?.toString();
          const month = interaction.options.getString('month') || undefined;
          const query = interaction.options.getString('query') || undefined;
          const format = interaction.options.getString('format') || undefined;
          const jempId = interaction.options.getString('jempid') || undefined;
          const reason = interaction.options.getString('reason') || undefined;
          const eventId = interaction.options.getString('eventid') || undefined;

          const response = await handleTimelineCommand(
            subcommand,
            { year, month, query, format, jempId, reason, eventId },
            {
              userId: interaction.user.id,
              userHandle: interaction.user.username,
              isAdmin: true, // evaluated via role in production
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
