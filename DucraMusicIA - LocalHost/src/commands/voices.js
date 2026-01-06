const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const { fmtApiError, errorEmbed } = require('../utils/discord');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('voices')
    .setDescription('Lister / rechercher des voices disponibles')
    .addSubcommand(sc =>
      sc.setName('list')
        .setDescription('Liste paginée des voices')
        .addIntegerOption(o => o.setName('limit').setDescription('Max par page (default 20)').setRequired(false))
        .addIntegerOption(o => o.setName('page').setDescription('Page (default 0)').setRequired(false))
        .addBooleanOption(o => o.setName('private').setDescription('Éphémère').setRequired(false))
    )
    .addSubcommand(sc =>
      sc.setName('search')
        .setDescription('Recherche des voices par nom')
        .addStringOption(o => o.setName('query').setDescription('Texte à rechercher').setRequired(true))
        .addIntegerOption(o => o.setName('limit').setDescription('Max par page (default 20)').setRequired(false))
        .addIntegerOption(o => o.setName('page').setDescription('Page (default 0)').setRequired(false))
        .addBooleanOption(o => o.setName('private').setDescription('Éphémère').setRequired(false))
    ),
  async execute(interaction, ctx) {
    const sub = interaction.options.getSubcommand(true);
    const limit = interaction.options.getInteger('limit') ?? 20;
    const page = interaction.options.getInteger('page') ?? 0;
    const isPrivate = interaction.options.getBoolean('private') ?? true;

    await interaction.deferReply({ ephemeral: isPrivate });

    let r;
    if (sub === 'list') {
      r = await ctx.api.getAllVoices({ limit, page });
    } else {
      const query = interaction.options.getString('query', true);
      r = await ctx.api.searchVoices({ query, limit, page });
    }

    if (!r.ok || r.json?.success === false) {
      return interaction.editReply({ embeds: [errorEmbed('API Error', fmtApiError(r.status, r.json))] });
    }

    const voices = r.json?.voices ?? [];
    const e = new EmbedBuilder()
      .setTitle(sub === 'list' ? 'Voices (All)' : 'Voices (Search)')
      .setDescription([
        `• **count**: ${voices.length}`,
        `• **page**: ${r.json?.page ?? page}`,
        `• **limit**: ${r.json?.limit ?? limit}`,
        `• **total**: ${r.json?.total ?? 'N/A'}`,
        '',
        ...voices.slice(0, 25).map(v => `• \`${v.voice_id}\` — ${v.voice_name}`),
        voices.length > 25 ? `… (+${voices.length - 25} non affichés)` : null,
      ].filter(Boolean).join('\n'));

    await interaction.editReply({ embeds: [e] });
  }
};
