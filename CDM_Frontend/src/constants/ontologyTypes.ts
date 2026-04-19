/** Allowed ontology classification for objects, variables, and lists (matches backend). */
export const ONTOLOGY_TYPES = ['Meme', 'Variant', 'Vulqan'] as const;
export type OntologyType = (typeof ONTOLOGY_TYPES)[number];

export function normalizeOntologyType(raw: unknown): OntologyType | null {
  if (raw === null || raw === undefined) return null;
  const s = String(raw).trim();
  if (!s) return null;
  for (const t of ONTOLOGY_TYPES) {
    if (s.toLowerCase() === t.toLowerCase()) return t;
  }
  return null;
}

export function coerceOntologyTypeFromRow(row: { isMeme?: boolean; ontologyType?: string }): OntologyType {
  const t = normalizeOntologyType(row.ontologyType);
  if (t) return t;
  if (row.isMeme === true) return 'Meme';
  return 'Variant';
}
