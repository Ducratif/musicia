const chalk = require('chalk');

function ts() {
  return new Date().toISOString().replace('T', ' ').replace('Z', '');
}

function fmt(level, msg) {
  return `[${ts()}] ${level} ${msg}`;
}

const log = {
  info: (msg) => console.log(fmt(chalk.cyan('INFO'), msg)),
  ok: (msg) => console.log(fmt(chalk.green('OK  '), msg)),
  warn: (msg) => console.warn(fmt(chalk.yellow('WARN'), msg)),
  error: (msg) => console.error(fmt(chalk.red('ERR '), msg)),
  debug: (msg) => console.log(fmt(chalk.gray('DBG '), msg)),
  banner: (title) => {
    const line = '═'.repeat(Math.max(28, title.length + 6));
    console.log(chalk.magenta(`
╔${line}╗`));
    console.log(chalk.magenta(`║  ${title}  ║`));
    console.log(chalk.magenta(`╚${line}╝
`));
  },
};

module.exports = { log };
