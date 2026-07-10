// Output-format dispatch: --output json|table|tsv, --json alias.
// Default: table on a TTY, json when piped (machine-pipeable by default).
export function resolveFormat(flags, isTTY = Boolean(process.stdout.isTTY)) {
  if (flags.output) return flags.output;
  if (flags.json) return 'json';
  return isTTY ? 'table' : 'json';
}

export function render(value, format, flags = {}) {
  if (format === 'tsv' || format === 'table') {
    const rows = extractRows(value);
    if (rows) return format === 'tsv' ? renderDelimited(rows, '\t') : renderTable(rows);
  }
  return JSON.stringify(value, null, flags.pretty ? 2 : 0);
}

function extractRows(value) {
  if (Array.isArray(value)) return value;
  if (value && typeof value === 'object') {
    const arrayKey = Object.keys(value).find((key) => Array.isArray(value[key]));
    if (arrayKey) return value[arrayKey];
  }
  return null;
}

function renderDelimited(rows, sep) {
  if (!rows.length) return '';
  const cols = columnsOf(rows);
  const lines = [cols.join(sep)];
  for (const row of rows) lines.push(cols.map((col) => cell(row[col])).join(sep));
  return lines.join('\n');
}

function renderTable(rows) {
  if (!rows.length) return '(no results)';
  const cols = columnsOf(rows);
  const widths = cols.map((col) => Math.max(col.length, ...rows.map((row) => cell(row[col]).length)));
  const line = (vals) => vals.map((val, i) => val.padEnd(widths[i])).join('  ').trimEnd();
  return [line(cols), ...rows.map((row) => line(cols.map((col) => cell(row[col]))))].join('\n');
}

function columnsOf(rows) {
  return Object.keys(rows[0] ?? {});
}

function cell(value) {
  if (value === undefined || value === null) return '';
  if (typeof value === 'object') return JSON.stringify(value);
  return String(value);
}
