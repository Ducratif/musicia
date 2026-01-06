const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('about')
    .setDescription('Infos sur DucraMusicIA (liens, crédits, etc.)')
    .addBooleanOption(o => o.setName('private').setDescription('Réponse visible uniquement par vous').setRequired(false)),
  async execute(interaction, ctx) {
    const isPrivate = interaction.options.getBoolean('private') ?? true;

    const e = new EmbedBuilder()
      .setTitle('DucraMusicIA — About')
      .setDescription([
        `**${ctx.credits.tagline}**`,
        '',
        `• Site IA: ${ctx.credits.website}`,
        `• Documentation API: ${ctx.credits.docs}`,
        ctx.credits.github ? `• GitHub: ${ctx.credits.github}` : null,
        ctx.credits.discord ? `• Discord: ${ctx.credits.discord}` : null,
        '',
        'Ce bot installe automatiquement les slash commands à chaque démarrage (et supprime les anciennes avant).',
      ].filter(Boolean).join('\n'))
      .setFooter({ text: `© ${new Date().getFullYear()} ${ctx.credits.name}` });

    await interaction.reply({ embeds: [e], ephemeral: isPrivate });
  }
};
