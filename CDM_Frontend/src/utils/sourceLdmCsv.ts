import type { SourceLdmRow } from '../hooks/useSources';

export const SOURCE_LDM_CSV_REQUIRED = [
  'Source Table',
  'Source Column',
  'Being',
  'Avatar',
  'Object',
  'Part',
  'Section',
  'Group',
  'Variable',
] as const;

export const SOURCE_LDM_CSV_OPTIONAL = ['Format VI', 'Format VII', 'Validations'] as const;

const HEADER_TO_KEY: Record<string, keyof Pick<SourceLdmRow, 'source_table' | 'source_variable' | 'being' | 'avatar' | 'object' | 'part' | 'section' | 'group' | 'variable' | 'format_vi' | 'format_vii' | 'validations'>> = {
  'source table': 'source_table',
  'source column': 'source_variable',
  being: 'being',
  avatar: 'avatar',
  object: 'object',
  part: 'part',
  section: 'section',
  group: 'group',
  variable: 'variable',
  'format vi': 'format_vi',
  'format vii': 'format_vii',
  validations: 'validations',
};

function normalizeHeader(h: string): string {
  return h.trim().toLowerCase().replace(/\s+/g, ' ');
}

/** Minimal RFC-style CSV parser (handles quotes and commas). */
export function parseCsvToMatrix(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cur = '';
  let inQuotes = false;
  const len = text.length;
  const pushRow = () => {
    row.push(cur);
    cur = '';
    if (row.some((c) => c.trim() !== '')) rows.push(row);
    row = [];
  };
  for (let i = 0; i < len; i++) {
    const c = text[i];
    if (inQuotes) {
      if (c === '"') {
        if (i + 1 < len && text[i + 1] === '"') {
          cur += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        cur += c;
      }
    } else if (c === '"') {
      inQuotes = true;
    } else if (c === ',') {
      row.push(cur);
      cur = '';
    } else if (c === '\n') {
      pushRow();
    } else if (c === '\r') {
      if (i + 1 < len && text[i + 1] === '\n') i++;
      pushRow();
    } else {
      cur += c;
    }
  }
  row.push(cur);
  if (row.some((c) => c.trim() !== '')) rows.push(row);
  return rows;
}

export type SourceLdmCsvRowInput = Omit<SourceLdmRow, 'id' | 'source_id'> & { id?: string; source_id?: string };

/**
 * Parse CSV text into LDM row payloads. Validates headers strictly (no unknown columns).
 * `sourceName` is applied to every row as `source_name` (not read from CSV).
 */
export function parseSourceLdmCsvText(text: string, sourceName: string): SourceLdmCsvRowInput[] {
  const matrix = parseCsvToMatrix(text.trim());
  if (matrix.length < 2) {
    throw new Error('CSV must include a header row and at least one data row.');
  }
  const headerCells = matrix[0].map((h) => h.trim());
  const allowedNorm = new Set<string>([
    ...SOURCE_LDM_CSV_REQUIRED.map((h) => normalizeHeader(h)),
    ...SOURCE_LDM_CSV_OPTIONAL.map((h) => normalizeHeader(h)),
  ]);

  const normToIndex = new Map<string, number>();
  for (let i = 0; i < headerCells.length; i++) {
    const raw = headerCells[i];
    const n = normalizeHeader(raw);
    if (!n) {
      throw new Error(`Empty header at column ${i + 1}`);
    }
    if (!allowedNorm.has(n)) {
      throw new Error(
        `Unexpected column: "${raw}". Allowed: ${[...SOURCE_LDM_CSV_REQUIRED, ...SOURCE_LDM_CSV_OPTIONAL].join(', ')}`
      );
    }
    if (normToIndex.has(n)) {
      throw new Error(`Duplicate column: "${raw}"`);
    }
    normToIndex.set(n, i);
  }

  const missing: string[] = [];
  for (const req of SOURCE_LDM_CSV_REQUIRED) {
    if (!normToIndex.has(normalizeHeader(req))) {
      missing.push(req);
    }
  }
  if (missing.length) {
    throw new Error(`Missing required column(s): ${missing.join(', ')}`);
  }

  const dataRows: SourceLdmCsvRowInput[] = [];
  for (let r = 1; r < matrix.length; r++) {
    const cells = matrix[r];
    const rowNum = r + 1;
    const out: Partial<SourceLdmRow> = {
      source_name: sourceName.trim(),
      source_table: '',
      source_variable: '',
      being: '',
      avatar: '',
      object: '',
      part: '',
      section: '',
      group: '',
      variable: '',
      format_vi: '',
      format_vii: '',
      validations: '',
    };

    for (const req of SOURCE_LDM_CSV_REQUIRED) {
      const idx = normToIndex.get(normalizeHeader(req))!;
      const val = (cells[idx] ?? '').trim();
      if (!val) {
        throw new Error(`Row ${rowNum}: empty required value for "${req}"`);
      }
      const key = HEADER_TO_KEY[normalizeHeader(req)];
      if (key) (out as Record<string, string>)[key] = val;
    }

    for (const opt of SOURCE_LDM_CSV_OPTIONAL) {
      const idx = normToIndex.get(normalizeHeader(opt));
      if (idx === undefined) continue;
      const key = HEADER_TO_KEY[normalizeHeader(opt)];
      if (key) (out as Record<string, string>)[key] = (cells[idx] ?? '').trim();
    }

    dataRows.push(out as SourceLdmCsvRowInput);
  }

  return dataRows;
}
