const { SlashCommandBuilder, EmbedBuilder, AttachmentBuilder } = require('discord.js');
const { fmtApiError, errorEmbed } = require('../utils/discord');
const { ConversionTypes } = require('../musicgpt/conversionTypes');
const { pollUntilDone, headContentLength, fetchBuffer } = require('../utils/http');

function mbToBytes(mb) { return Math.floor(mb * 1024 * 1024); }

async function attachOrLink(url, filename, maxUploadMb) {
  const maxBytes = mbToBytes(maxUploadMb);
  const len = await headContentLength(url);
  if (len !== null && len > maxBytes) return { kind: 'link', url, size: len };
  try {
    const buf = await fetchBuffer(url, maxBytes);
    return { kind: 'file', file: new AttachmentBuilder(buf, { name: filename }), size: buf.length };
  } catch {
    return { kind: 'link', url, size: len };
  }
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName('tts')
    .setDescription('Text To Speech (POST /TextToSpeech)')
    .addStringOption(o => o.setName('text').setDescription('Texte à synthétiser').setRequired(true))
    .addStringOption(o => o.setName('voice_id').setDescription('Voice ID (optionnel)').setRequired(false))
    .addStringOption(o => o.setName('sample_audio_url').setDescription('URL audio sample (optionnel)').setRequired(false))
    .addStringOption(o => o.setName('gender').setDescription('male/female').setRequired(false).addChoices(
      { name: 'male', value: 'male' },
      { name: 'female', value: 'female' }
    ))
    .addBooleanOption(o => o.setName('private').setDescription('Réponse éphémère').setRequired(false)),
  async execute(interaction, ctx) {
    const text = interaction.options.getString('text', true);
    const voice_id = interaction.options.getString('voice_id') ?? '';
    const sample_audio_url = interaction.options.getString('sample_audio_url') ?? '';
    const gender = interaction.options.getString('gender') ?? 'male';
    const isPrivate = interaction.options.getBoolean('private') ?? false;

    await interaction.deferReply({ ephemeral: isPrivate });

    const r = await ctx.api.textToSpeech({ text, voice_id, sample_audio_url, gender, webhook_url: '' });
    if (!r.ok || r.json?.success === false) {
      return interaction.editReply({ embeds: [errorEmbed('API Error', fmtApiError(r.status, r.json))] });
    }

    const task = r.json;
    const maxMs = Math.min(10 * 60 * 1000, Math.max(60_000, (Number(task.eta) || 60) * 1000 * 3));

    const done = await pollUntilDone(
      () => ctx.api.getById({ conversionType: ConversionTypes.TEXT_TO_SPEECH, task_id: task.task_id }),
      { intervalMs: 4000, maxMs }
    );

    if (done.timeout) {
      const e = new EmbedBuilder().setTitle('TTS — Timeout')
        .setDescription(`Conversion trop longue. Utilise \`/status\` avec type TEXT_TO_SPEECH et id \`${task.task_id}\`.`);
      return interaction.editReply({ embeds: [e] });
    }

    const conv = done.json?.conversion ?? {};
    if (String(conv.status).toUpperCase() !== 'COMPLETED' || !conv.audio_url) {
      const e = new EmbedBuilder().setTitle('TTS — Erreur')
        .setDescription(`Status: \`${conv.status ?? 'N/A'}\`\nMsg: ${conv.status_msg ?? 'N/A'}`);
      return interaction.editReply({ embeds: [e] });
    }

    const out = await attachOrLink(conv.audio_url, 'tts.mp3', ctx.limits.maxUploadMb);
    const files = out.kind === 'file' ? [out.file] : [];
    const e = new EmbedBuilder()
      .setTitle('✅ TTS — Résultat')
      .setDescription([
        `• **task_id**: \`${task.task_id}\``,
        `• **status**: \`${conv.status}\``,
        out.kind === 'link' ? `• lien: ${out.url}` : '• fichier attaché',
      ].join('\n'));

    await interaction.editReply({ embeds: [e], files });
  }
};
