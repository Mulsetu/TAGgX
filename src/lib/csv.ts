export function csvEscape(value: string): string {
  if (/[",\n\r]/.test(value)) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

export function toCsv(rows: string[][]): string {
  return rows.map((row) => row.map(csvEscape).join(",")).join("\n");
}

/** RFC 4180-style parse; drops blank lines and a leading UTF-8 BOM (Excel adds one). */
export function parseCsv(text: string): string[][] {
  const source = text.charCodeAt(0) === 0xfeff ? text.slice(1) : text;
  const rows: string[][] = [];
  let current: string[] = [];
  let cell = "";
  let inQuotes = false;
  for (let i = 0; i < source.length; i += 1) {
    const char = source[i];
    const next = source[i + 1];
    if (inQuotes) {
      if (char === '"' && next === '"') {
        cell += '"';
        i += 1;
      } else if (char === '"') {
        inQuotes = false;
      } else {
        cell += char;
      }
    } else if (char === '"') {
      inQuotes = true;
    } else if (char === ",") {
      current.push(cell.trim());
      cell = "";
    } else if (char === "\n" || char === "\r") {
      if (char === "\r" && next === "\n") {
        i += 1;
      }
      current.push(cell.trim());
      cell = "";
      if (current.some((value) => value.length > 0)) {
        rows.push(current);
      }
      current = [];
    } else {
      cell += char;
    }
  }
  if (cell.length > 0 || current.length > 0) {
    current.push(cell.trim());
    if (current.some((value) => value.length > 0)) {
      rows.push(current);
    }
  }
  return rows;
}
