const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('help')
    .setDescription('Liste des commandes disponibles')
    .addBooleanOption(o => o.setName('private').setDescription('Réponse visible uniquement par vous').setRequired(false)),
  async execute(interaction) {
    const isPrivate = interaction.options.getBoolean('private') ?? true;

    const e = new EmbedBuilder()
      .setTitle('DucraMusicIA — Commandes')
      .setDescription([
        '**Génération / IA**',
        '• `/musicai` — Génère une musique via MusicAI',
        '• `/lyrics` — Génère des lyrics (prompt → lyrics)',
        '• `/tts` — Text-to-speech',
        '',
        '**Audio / Conversions**',
        '• `/voicechanger` — Convertit une voix (audio → voix)',
        '• `/cover` — Cover song (audio → cover)',
        '• `/sound` — Génère un son (SFX/texture) depuis un prompt',
        '• `/fileconvert` — Convertit un fichier audio (format)',
        '• `/keybpm` — Extrait Key & BPM',
        '• `/midi` — Audio → MIDI',
        '',
        '**Helpers**',
        '• `/voices` — Liste / recherche de voices',
        '• `/status` — Vérifie le status d\'une conversion (GET /byId)',
        '• `/about` — Crédits & liens',
      ].join('\n'))
      .setFooter({ text: 'Astuce: ajoutez `private:true` pour répondre en éphémère quand c’est dispo.' });

    await interaction.reply({ embeds: [e], ephemeral: isPrivate });
  }
};
