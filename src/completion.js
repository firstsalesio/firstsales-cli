// Shell completions derived from listCommands() (DRY: no hand-maintained list).
import { listCommands } from './commands.js';

export function generateCompletion(shell) {
  // ponytail: shell completion tokens must be single words; multi-word
  // command labels ("orgs list") get hyphenated ("orgs-list") for this
  // purpose only — routing still uses the space-joined label.
  const commands = listCommands().map((command) => command.command.replaceAll(' ', '-'));
  if (shell === 'bash') return bashCompletion(commands);
  if (shell === 'zsh') return zshCompletion(commands);
  if (shell === 'fish') return fishCompletion(commands);
  return null;
}

function bashCompletion(commands) {
  return [
    '_firstsales_completions() {',
    '  local cur="${COMP_WORDS[COMP_CWORD]}"',
    `  local commands="${commands.join(' ')}"`,
    '  COMPREPLY=( $(compgen -W "${commands}" -- "${cur}") )',
    '}',
    'complete -F _firstsales_completions firstsales',
    '',
  ].join('\n');
}

function zshCompletion(commands) {
  return [
    '#compdef firstsales',
    '_firstsales() {',
    `  local -a commands=(${commands.join(' ')})`,
    "  _describe 'command' commands",
    '}',
    'compdef _firstsales firstsales',
    '',
  ].join('\n');
}

function fishCompletion(commands) {
  return commands.map((command) => `complete -c firstsales -f -a "${command}"`).join('\n') + '\n';
}
