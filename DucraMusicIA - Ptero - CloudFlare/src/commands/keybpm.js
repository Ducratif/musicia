const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const { fmtApiError, errorEmbed } = require('../utils/discord');
const { ConversionTypes } = require('../musicgpt/conversionTypes');
const { pollUntilDone } = require('../utils/http');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('keybpm')
    .setDescription('Extrait Key & BPM (POST /extract_key_bpm)')
    .addAttachmentOption(o => o.setName('audio').setDescription('Fichier audio Discord (optionnel)').setRequired(false))
    .addStringOption(o => o.setName('audio_url').setDescription('URL audio (optionnel)').setRequired(false))
    .addBooleanOption(o => o.setName('private').setDescription('Réponse éphémère').setRequired(false)),
  async execute(interaction, ctx) {
    const audio = interaction.options.getAttachment('audio');
    const audio_url = interaction.options.getString('audio_url') ?? audio?.url ?? '';
    const isPrivate = interaction.options.getBoolean('private') ?? true;

    if (!audio_url) {
      return interaction.reply({ embeds: [errorEmbed('Paramètre manquant', 'Fournis `audio_url` ou `audio` (attachment).')], ephemeral: true });
    }

    await interaction.deferReply({ ephemeral: isPrivate });

    const r = await ctx.api.extractKeyBpm({ audio_url, webhook_url: '' });
    if (!r.ok || r.json?.success === false) {
      return interaction.editReply({ embeds: [errorEmbed('API Error', fmtApiError(r.status, r.json))] });
    }

    const task = r.json;
    const maxMs = Math.min(8 * 60 * 1000, 8 * 60 * 1000);

    const done = await pollUntilDone(
      () => ctx.api.getById({ conversionType: ConversionTypes.KEY_BPM_EXTRACTION, task_id: task.task_id }),
      { intervalMs: 3000, maxMs }
    );

    if (done.timeout) {
      return interaction.editReply({
        embeds: [new EmbedBuilder().setTitle('Key&BPM — Timeout').setDescription(`Utilise \`/status\` type KEY_BPM_EXTRACTION id \`${task.task_id}\`.`)]
      });
    }

    const conv = done.json?.conversion ?? {};
    const e = new EmbedBuilder()
      .setTitle('✅ Key & BPM — Résultat')
      .setDescription([
        `• **task_id**: \`${task.task_id}\``,
        `• **status**: \`${conv.status ?? 'N/A'}\``,
        conv.key ? `• **key**: \`${conv.key}\`` : null,
        conv.bpm ? `• **bpm**: \`${conv.bpm}\`` : null,
        conv.audio_url ? `• **audio_url**: ${conv.audio_url}` : null,
        conv.status_msg ? `• **msg**: ${conv.status_msg}` : null,
      ].filter(Boolean).join('\n'));

    await interaction.editReply({ embeds: [e] });
  }
};
