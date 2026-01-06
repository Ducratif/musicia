require('dotenv').config();

const { Client, GatewayIntentBits, Collection, ActivityType } = require('discord.js');
const { config } = require('./src/config');
const { log } = require('./src/logger');
const { registerCommands } = require('./src/registerCommands');
const { MusicGPTClient } = require('./src/musicgpt/client');
const { hasAllowedRole } = require('./src/permissions');
const { errorEmbed } = require('./src/utils/discord');
const { all: commandModules } = require('./src/commands/_index');
const { startWebhookServer } = require('./src/webhook/server');
const { put, savePayload } = require('./src/webhook/store');


process.on('unhandledRejection', (reason) => log.error(`UnhandledRejection: ${reason?.stack ?? reason}`));
process.on('uncaughtException', (err) => log.error(`UncaughtException: ${err?.stack ?? err}`));

log.banner('DucraMusicIA');
log.info(`Node: ${process.version}`);
log.info(`Guild: ${config.discord.guildId}`);
log.info(`Allowed role: ${config.discord.allowedRoleId}`);
log.info(`MusicGPT base URL: ${config.musicgpt.baseUrl}`);

const client = new Client({
  intents: [GatewayIntentBits.Guilds],
});

const api = new MusicGPTClient({
  apiKey: config.musicgpt.apiKey,
  baseUrl: config.musicgpt.baseUrl,
});

client.commands = new Collection();
for (const m of commandModules) {
  client.commands.set(m.data.name, m);
}

function setPresence(text) {
  client.user.setPresence({
    status: config.presence.status,
    activities: [{ name: text, type: ActivityType.Playing }],
  });
}

client.once('clientReady', async () => {
  log.ok(`Logged in as ${client.user.tag} (${client.user.id})`);
  log.info(`Commands loaded: ${client.commands.size}`);
  if (config.debug) log.debug('Debug logs: ENABLED');

  const pres = [config.presence.text1, config.presence.text2].filter(Boolean);
  let idx = 0;
  setPresence(pres[idx] || 'DucraMusicIA');
  log.info(`Presence: ${config.presence.status} / ${pres.join(' | ')}`);

  if (pres.length >= 2 && config.presence.rotateSeconds > 0) {
    setInterval(() => {
      idx = (idx + 1) % pres.length;
      setPresence(pres[idx]);
    }, config.presence.rotateSeconds * 1000).unref();
  }

  try {
    const commandsJson = commandModules.map(c => c.data.toJSON());
    await registerCommands({
      token: config.discord.token,
      clientId: config.discord.clientId,
      guildId: config.discord.guildId,
      commands: commandsJson,
    });
  } catch (e) {
    log.error(`Command registration failed: ${e?.stack ?? e}`);
  }

  log.ok('Bot is ready.');
});

client.on('interactionCreate', async (interaction) => {
  if (!interaction.isChatInputCommand()) return;
  if (!interaction.inGuild()) {
    return interaction.reply({ embeds: [errorEmbed('Erreur', 'Ce bot fonctionne uniquement dans un serveur.')], ephemeral: true }).catch(() => {});
  }

  const member = interaction.member;
  const ok = hasAllowedRole(member, config.discord.allowedRoleId);
  if (!ok) {
    return interaction.reply({
      embeds: [errorEmbed('Accès refusé', `Vous n'avez pas le rôle autorisé pour utiliser ce bot.\nRole requis: \`${config.discord.allowedRoleId}\``)],
      ephemeral: true,
    }).catch(() => {});
  }

  const cmd = client.commands.get(interaction.commandName);
  if (!cmd) return;

  const ctx = {
    api,
    config,
    credits: config.credits,
    limits: config.limits,
    downloads: config.downloads,
    debug: config.debug,
    log,
  };

  try {
    await cmd.execute(interaction, ctx);
  } catch (e) {
    log.error(`Command error /${interaction.commandName}: ${e?.stack ?? e}`);
    const payload = { embeds: [errorEmbed('Erreur', 'Une erreur est survenue côté bot. Vérifie la console.')], ephemeral: true };
    if (interaction.deferred || interaction.replied) {
      await interaction.editReply(payload).catch(() => {});
    } else {
      await interaction.reply(payload).catch(() => {});
    }
  }
});

if (config.webhook?.enabled) {
  startWebhookServer({
    port: config.webhook.port,
    secret: config.webhook.secret,
    onPayload: async (payload) => {
      put(payload);
      await savePayload(config.downloads.dir, payload);
    },
    log,
    debug: config.debug,
  });
}


client.login(config.discord.token);
