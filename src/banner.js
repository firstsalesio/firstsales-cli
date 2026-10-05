const GLYPHS = {
  F: ['.....', '.    ', '.... ', '.    ', '.    '],
  I: ['.....', '  .  ', '  .  ', '  .  ', '.....'],
  R: ['.... ', '.   .', '.... ', '.  . ', '.   .'],
  S: [' ....', '.    ', ' ... ', '    .', '.... '],
  T: ['.....', '  .  ', '  .  ', '  .  ', '  .  '],
  A: [' ... ', '.   .', '.....', '.   .', '.   .'],
  L: ['.    ', '.    ', '.    ', '.    ', '.....'],
  E: ['.....', '.    ', '.... ', '.    ', '.....'],
};

export const FIRSTSALES_LOGO = Array.from({ length: 5 }, (_, row) =>
  [...'FIRSTSALES'].map((letter) => GLYPHS[letter][row]).join('  ').trimEnd()
).join('\n');

export function printWelcomeBanner(stream, flags, env) {
  if (!stream.isTTY || flags.json || flags.pretty || env.CI || env.TERM === 'dumb') return;
  stream.write(`${FIRSTSALES_LOGO}\n\nFirstSales — your sales workspace from the terminal\n\n`);
}
