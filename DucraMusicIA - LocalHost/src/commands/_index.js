const about = require('./about');
const help = require('./help');
const status = require('./status');
const voices = require('./voices');
const lyrics = require('./lyrics');
const musicai = require('./musicai');
const tts = require('./tts');
const voicechanger = require('./voicechanger');
const cover = require('./cover');
const sound = require('./sound');
const fileconvert = require('./fileconvert');
const keybpm = require('./keybpm');
const midi = require('./midi');

const all = [
  about,
  help,
  status,
  voices,
  lyrics,
  musicai,
  tts,
  voicechanger,
  cover,
  sound,
  fileconvert,
  keybpm,
  midi,
];

module.exports = { all };
