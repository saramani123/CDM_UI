/**
 * Helpers for the Format VII filter in the Objects "Identifiers" pickers
 * (Unique ID + Composite ID, on the edit / add / bulk-edit panels).
 *
 * Format VII is a property of Variable nodes (`formatII`). It acts as an
 * optional, bidirectional cross-filter alongside Part → Section → Group →
 * Variable: picking it narrows the other dropdowns, and the other selections
 * narrow the Format VII options.
 *
 * Per product decision, variables with a BLANK Format VII are excluded from the
 * Identifier pickers entirely.
 *
 * All functions are pure and computed from the already-loaded variables list
 * (no backend calls). "ANY" is treated as "no constraint" at that level.
 */
import { VariableData } from '../data/variablesData';

const norm = (s?: string): string => (s || '').trim();
const isAny = (s?: string): boolean => norm(s).toUpperCase() === 'ANY';

/** Variables eligible to appear in an Identifier picker (real taxonomy + non-blank Format VII). */
export function eligibleIdentifierVariables(vars: VariableData[] | undefined): VariableData[] {
  if (!Array.isArray(vars)) return [];
  return vars.filter(
    (v) =>
      v &&
      norm(v.part) &&
      norm(v.section) &&
      norm(v.group) &&
      norm(v.variable) &&
      norm(v.formatII),
  );
}

/** Distinct Format VII values among variables matching the selected (non-ANY) Part/Section/Group. */
export function getFormatVIIOptions(
  vars: VariableData[] | undefined,
  part?: string,
  section?: string,
  group?: string,
): string[] {
  const p = norm(part);
  const s = norm(section);
  const g = norm(group);
  const values = eligibleIdentifierVariables(vars)
    .filter(
      (v) =>
        (!p || v.part === p) &&
        (!s || isAny(section) || v.section === s) &&
        (!g || isAny(group) || v.group === g),
    )
    .map((v) => norm(v.formatII));
  return [...new Set(values)].filter(Boolean).sort();
}

/** Parts that have at least one eligible variable with the given Format VII (or any, if blank). */
export function partsForFormatVII(vars: VariableData[] | undefined, formatVII?: string): Set<string> {
  const f = norm(formatVII);
  return new Set(
    eligibleIdentifierVariables(vars)
      .filter((v) => !f || v.formatII === f)
      .map((v) => v.part),
  );
}

/** Sections under a Part that have an eligible variable with the given Format VII (or any). */
export function sectionsForFormatVII(
  vars: VariableData[] | undefined,
  part: string,
  formatVII?: string,
): Set<string> {
  const p = norm(part);
  const f = norm(formatVII);
  return new Set(
    eligibleIdentifierVariables(vars)
      .filter((v) => v.part === p && (!f || v.formatII === f))
      .map((v) => v.section),
  );
}

/** Groups under a Part/Section that have an eligible variable with the given Format VII (or any). */
export function groupsForFormatVII(
  vars: VariableData[] | undefined,
  part: string,
  section: string,
  formatVII?: string,
): Set<string> {
  const p = norm(part);
  const s = norm(section);
  const f = norm(formatVII);
  return new Set(
    eligibleIdentifierVariables(vars)
      .filter((v) => v.part === p && v.section === s && (!f || v.formatII === f))
      .map((v) => v.group),
  );
}

/** Eligible variable ids for a Part/Section/Group, optionally constrained to a Format VII. */
export function eligibleVariableIdsFor(
  vars: VariableData[] | undefined,
  part: string,
  section: string,
  group: string,
  formatVII?: string,
): Set<string> {
  const p = norm(part);
  const s = norm(section);
  const g = norm(group);
  const f = norm(formatVII);
  return new Set(
    eligibleIdentifierVariables(vars)
      .filter(
        (v) =>
          v.part === p &&
          v.section === s &&
          v.group === g &&
          (!f || v.formatII === f),
      )
      .map((v) => v.id),
  );
}

/** The Format VII (formatII) value of a specific variable id, or '' if unknown/blank. */
export function formatVIIForVariableId(vars: VariableData[] | undefined, variableId?: string): string {
  if (!Array.isArray(vars) || !variableId) return '';
  const match = vars.find((v) => v.id === variableId);
  return match ? norm(match.formatII) : '';
}
