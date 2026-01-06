const { REST, Routes } = require('discord.js');
const { log } = require('./logger');

async function registerCommands({ token, clientId, guildId, commands }) {
  const rest = new REST({ version: '10' }).setToken(token);

  const listRoute = Routes.applicationGuildCommands(clientId, guildId);

  const existing = await rest.get(listRoute).catch(() => []);
  if (Array.isArray(existing) && existing.length) {
    log.info(`Deleting ${existing.length} existing guild command(s)...`);
    for (const c of existing) {
      try {
        await rest.delete(Routes.applicationGuildCommand(clientId, guildId, c.id));
        log.ok(`Deleted: /${c.name}`);
      } catch (e) {
        log.warn(`Failed to delete /${c.name}: ${e?.message ?? e}`);
      }
    }
  } else {
    log.info('No existing guild commands to delete.');
  }

  log.info(`Installing ${commands.length} command(s) to guild ${guildId}...`);
  const out = await rest.put(listRoute, { body: commands });
  log.ok(`Installed ${Array.isArray(out) ? out.length : commands.length} command(s).`);
}

module.exports = { registerCommands };
