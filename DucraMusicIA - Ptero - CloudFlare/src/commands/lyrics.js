const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const { fmtApiError, errorEmbed } = require('../utils/discord');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('lyrics')
    .setDescription('Génère des lyrics à partir d’un prompt (GET /prompt_to_lyrics)')
    .addStringOption(o => o.setName('prompt').setDescription('Thème / vibe / idée').setRequired(true))
    .addBooleanOption(o => o.setName('private').setDescription('Éphémère').setRequired(false)),
  async execute(interaction, ctx) {
    const prompt = interaction.options.getString('prompt', true);
    const isPrivate = interaction.options.getBoolean('private') ?? true;

    await interaction.deferReply({ ephemeral: isPrivate });

    const r = await ctx.api.promptToLyrics({ prompt });
    if (!r.ok || r.json?.success === false) {
      return interaction.editReply({ embeds: [errorEmbed('API Error', fmtApiError(r.status, r.json))] });
    }

    const lyrics = r.json?.lyrics || r.json?.result || r.json?.text || '(aucune donnée lyrics retournée)';
    const estimate = r.json?.credit_estimate;

    const e = new EmbedBuilder()
      .setTitle('Lyrics Generator')
      .setDescription([
        `**Prompt:** ${prompt}`,
        estimate !== undefined ? `**Crédit estimé:** ${estimate}` : null,
        '',
        '```',
        String(lyrics).slice(0, 3500),
        '```',
      ].filter(Boolean).join('\n'));

    await interaction.editReply({ embeds: [e] });
  }
};
