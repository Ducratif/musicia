const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const { headContentLength } = require('../utils/http');
const { fmtApiError, errorEmbed } = require('../utils/discord');
const { ConversionTypes } = require('../musicgpt/conversionTypes');

function musicAiFallbackUrls(conversionId) {
  const base = 'https://lalals.s3.amazonaws.com/conversions/';
  return {
    mp3: `${base}${conversionId}.mp3`,
    wav: `${base}${conversionId}.wav`,
  };
}


module.exports = {
  data: new SlashCommandBuilder()
    .setName('status')
    .setDescription('Check le status d’une conversion via GET /byId')
    .addStringOption(o => o.setName('type').setDescription('ConversionType').setRequired(true)
      .addChoices(
        { name: 'MUSIC_AI', value: ConversionTypes.MUSIC_AI },
        { name: 'TEXT_TO_SPEECH', value: ConversionTypes.TEXT_TO_SPEECH },
        { name: 'VOICE_CONVERSION', value: ConversionTypes.VOICE_CONVERSION },
        { name: 'COVER', value: ConversionTypes.COVER },
        { name: 'SOUND_GENERATOR', value: ConversionTypes.SOUND_GENERATOR },
        { name: 'FILE_CONVERT', value: ConversionTypes.FILE_CONVERT },
        { name: 'KEY_BPM_EXTRACTION', value: ConversionTypes.KEY_BPM_EXTRACTION },
        { name: 'AUDIO_TO_MIDI', value: ConversionTypes.AUDIO_TO_MIDI },
      )
    )
    .addStringOption(o => o.setName('id').setDescription('task_id ou conversion_id').setRequired(true))
    .addBooleanOption(o => o.setName('as_conversion_id').setDescription('id = conversion_id (sinon task_id)').setRequired(false))
    .addBooleanOption(o => o.setName('private').setDescription('Réponse éphémère').setRequired(false)),
  async execute(interaction, ctx) {
    const type = interaction.options.getString('type', true);
    const id = interaction.options.getString('id', true);
    const asConv = interaction.options.getBoolean('as_conversion_id') ?? false;
    const isPrivate = interaction.options.getBoolean('private') ?? true;

    await interaction.deferReply({ ephemeral: isPrivate });

    const r = await ctx.api.getById({
      conversionType: type,
      task_id: asConv ? undefined : id,
      conversion_id: asConv ? id : undefined,
    });

    if (!r.ok) {
      return interaction.editReply({ embeds: [errorEmbed('API Error', fmtApiError(r.status, r.json))] });
    }

    const c = r.json?.conversion ?? r.json;

    let fallback = null;
    let fallbackSize = null;

    const convId = c.conversion_id || (asConv ? id : null);

    if (type === ConversionTypes.MUSIC_AI && convId && !c.audio_url && !c.conversion_path) {
      fallback = musicAiFallbackUrls(convId);
      try {
        fallbackSize = await headContentLength(fallback.mp3);
      } catch {}
    }


    const e = new EmbedBuilder()
      .setTitle('Status /byId')
      .setDescription([
        `• **type**: \`${type}\``,
        `• **status**: \`${c.status ?? 'N/A'}\``,
        c.status_msg ? `• **msg**: ${c.status_msg}` : null,
        c.task_id ? `• **task_id**: \`${c.task_id}\`` : null,
        c.conversion_id ? `• **conversion_id**: \`${c.conversion_id}\`` : null,
        c.eta !== undefined ? `• **eta**: ${c.eta}` : null,
        c.audio_url ? `• **audio_url**: ${c.audio_url}` : null,
        c.conversion_path ? `• **conversion_path**: ${c.conversion_path}` : null,
        c.conversion_path_wav ? `• **conversion_path_wav**: ${c.conversion_path_wav}` : null,
        c.conversion_cost !== undefined ? `• **cost**: ${c.conversion_cost}` : null,
        fallback ? `• **fallback_mp3**: ${fallback.mp3}${fallbackSize ? ` (${(fallbackSize/1024/1024).toFixed(2)} MB)` : ''}` : null,
        fallback ? `• **fallback_wav**: ${fallback.wav}` : null,
      ].filter(Boolean).join('\n'));

    await interaction.editReply({ embeds: [e] });
  }
};
