/** Quote every field and neutralise spreadsheet formulas, including leading control characters. */
export function adminCsvCell(value: unknown): string {
  let text = String(value ?? '');
  if (/^[\s\u0000-\u001f]*[=+\-@]/.test(text) || /^[\t\r\n]/.test(text)) text = "'" + text;
  return '"' + text.replace(/"/g, '""') + '"';
}

export function adminCsv(rows: unknown[][]): string {
  return '\uFEFF' + rows.map(row => row.map(adminCsvCell).join(',')).join('\r\n');
}
