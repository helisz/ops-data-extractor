import * as XLSX from 'xlsx';

export interface ParsedExcel {
  headers: string[];
  rows: Record<string, unknown>[];
}

/**
 * Parse an uploaded xls/xlsx buffer into headers and row objects.
 * Uses the first worksheet; first row is treated as the header row.
 * Empty/duplicate headers are normalized (e.g. "", "Column", "Column (2)").
 */
export function parseExcelFile(buffer: Buffer): ParsedExcel {
  const workbook = XLSX.read(buffer, { type: 'buffer' });
  const firstSheetName = workbook.SheetNames[0];
  if (!firstSheetName) {
    throw new Error('The uploaded file contains no worksheet.');
  }
  const sheet = workbook.Sheets[firstSheetName];
  const rawRows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, {
    defval: '',
  });

  if (rawRows.length === 0) {
    throw new Error('The uploaded file contains no data rows.');
  }

  // Raw headers come from the first object's keys (sheet_to_json with header:1
  // returns objects keyed by the header row values).
  const rawHeaders = Object.keys(rawRows[0]);

  // Normalize empty / duplicate headers.
  const seen = new Map<string, number>();
  const headers = rawHeaders.map((h) => {
    const trimmed = String(h).trim();
    let base = trimmed || 'Column';
    let candidate = base;
    let count = seen.get(base) || 0;
    while (seen.has(candidate)) {
      count += 1;
      candidate = `${base} (${count})`;
    }
    seen.set(base, count + 1);
    seen.set(candidate, 1);
    return candidate;
  });

  // Re-key rows to normalized headers, stringifying values.
  const rows = rawRows.map((raw) => {
    const row: Record<string, unknown> = {};
    headers.forEach((header, i) => {
      const originalKey = rawHeaders[i];
      const value = raw[originalKey];
      row[header] = normalizeCellValue(value);
    });
    return row;
  });

  return { headers, rows };
}

function normalizeCellValue(value: unknown): unknown {
  if (value === null || value === undefined) return '';
  if (typeof value === 'string') return value.trim();
  if (value instanceof Date) return value.toISOString();
  return value;
}

/**
 * Build an xlsx buffer from headers + row objects (original header keys).
 */
export function buildXlsxBuffer(headers: string[], rows: Record<string, unknown>[]): Buffer {
  const aoa: unknown[][] = [headers];
  for (const row of rows) {
    aoa.push(headers.map((h) => row[h] ?? ''));
  }
  const sheet = XLSX.utils.aoa_to_sheet(aoa);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, sheet, 'Data');
  return XLSX.write(workbook, { bookType: 'xlsx', type: 'buffer' }) as Buffer;
}

/**
 * Map a user-facing header to a valid SQLite identifier:
 * - non [A-Za-z0-9_] characters are replaced with `_`
 * - prefixed with `c_` when it would start with a digit
 * - deduped with a numeric suffix (e.g. `name`, `name_2`)
 */
export function sanitizeColumnName(header: string, taken: Set<string> = new Set()): string {
  let base = String(header)
    .trim()
    .replace(/[^A-Za-z0-9_]/g, '_')
    .replace(/_+/g, '_');
  if (!base) base = 'column';
  if (/^[0-9]/.test(base)) base = `c_${base}`;

  let candidate = base;
  let i = 2;
  while (taken.has(candidate)) {
    candidate = `${base}_${i}`;
    i += 1;
  }
  taken.add(candidate);
  return candidate;
}

/**
 * Infer a SQLite column type by sampling non-empty values:
 * INTEGER (all integer literals), REAL (all numeric), DATETIME (all
 * ISO-like date strings), otherwise TEXT.
 */
export function inferColumnType(values: unknown[]): 'TEXT' | 'INTEGER' | 'REAL' | 'DATETIME' {
  const sampled = values.filter((v) => v !== null && v !== undefined && v !== '');

  if (sampled.length === 0) return 'TEXT';

  let allInteger = true;
  let allNumber = true;
  let allDatetime = true;

  for (const v of sampled) {
    const s = String(v).trim();

    if (/^[+-]?\d+$/.test(s)) {
      allDatetime = false;
      continue;
    }
    allInteger = false;

    if (/^[+-]?(\d+\.?\d*|\.\d+)([eE][+-]?\d+)?$/.test(s)) {
      allDatetime = false;
      continue;
    }
    allNumber = false;

    if (/^\d{4}-\d{2}-\d{2}([T\s]\d{2}:\d{2}(:\d{2}(\.\d+)?)?(Z|[+-]\d{2}:?\d{2})?)?$/.test(s)) {
      continue;
    }
    allDatetime = false;
  }

  if (allInteger) return 'INTEGER';
  if (allNumber) return 'REAL';
  if (allDatetime) return 'DATETIME';
  return 'TEXT';
}
