import React, { useEffect, useMemo, useState } from 'react';
import { Save, X } from 'lucide-react';
import { apiService } from '../services/api';
import type { ObjectData } from '../data/mockData';
import type { VariableData } from '../data/variablesData';
import type { SourceLdmRow } from '../hooks/useSources';
import {
  getAllFormatIValues,
  getFormatIIValuesForFormatI,
  sanitizeStoredFormatPair,
} from '../utils/formatMapping';
import { parseValidation, splitValidationString } from '../utils/validationUtils';
import type { ValidationComponents } from '../utils/validationUtils';
import {
  SourceLdmValidationsBlock,
  validateSourceLdmValidationList,
  joinSourceLdmValidationStrings,
} from './SourceLdmValidationsBlock';

export interface SourceLdmRowMetadataPanelProps {
  row: SourceLdmRow | null;
  onClose: () => void;
  onSave: (row: SourceLdmRow) => void | Promise<void>;
  objects: ObjectData[];
  variables: VariableData[];
}

const selectStyle: React.CSSProperties = {
  backgroundImage: `url("data:image/svg+xml,%3csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 20 20'%3e%3cpath stroke='%236b7280' stroke-linecap='round' stroke-linejoin='round' stroke-width='1.5' d='m6 8 4 4 4-4'/%3e%3c/svg%3e")`,
  backgroundPosition: 'right 12px center',
  backgroundRepeat: 'no-repeat',
  backgroundSize: '16px',
};

export const SourceLdmRowMetadataPanel: React.FC<SourceLdmRowMetadataPanelProps> = ({
  row,
  onClose,
  onSave,
  objects,
  variables,
}) => {
  const [sourceTable, setSourceTable] = useState('');
  const [sourceColumn, setSourceColumn] = useState('');
  const [being, setBeing] = useState('');
  const [avatar, setAvatar] = useState('');
  const [object, setObject] = useState('');
  const [variableName, setVariableName] = useState('');
  const [part, setPart] = useState('');
  const [section, setSection] = useState('');
  const [group, setGroup] = useState('');
  const [formatVi, setFormatVi] = useState('');
  const [formatVii, setFormatVii] = useState('');

  const [validationComponentsList, setValidationComponentsList] = useState<ValidationComponents[]>([
    { valType: '', operator: '', value: '' },
  ]);
  const [validationError, setValidationError] = useState('');

  const [partsList, setPartsList] = useState<string[]>([]);
  const [sectionsList, setSectionsList] = useState<string[]>([]);
  const [groupsList, setGroupsList] = useState<string[]>([]);
  const [loadingParts, setLoadingParts] = useState(false);
  const [loadingSections, setLoadingSections] = useState(false);
  const [loadingGroups, setLoadingGroups] = useState(false);
  const [saving, setSaving] = useState(false);

  const relativeVariableOptions = useMemo(() => {
    const s = new Set<string>();
    for (const v of variables) {
      const n = (v.variable || '').trim();
      if (n) s.add(n);
    }
    return [...s].sort((a, b) => a.localeCompare(b));
  }, [variables]);

  const beings = useMemo(() => {
    const s = new Set<string>();
    for (const o of objects) {
      const b = (o.being || '').trim();
      if (b) s.add(b);
    }
    return [...s].sort((a, b) => a.localeCompare(b));
  }, [objects]);

  const avatars = useMemo(() => {
    if (!being) return [] as string[];
    const s = new Set<string>();
    for (const o of objects) {
      if ((o.being || '').trim() !== being) continue;
      const a = (o.avatar || '').trim();
      if (a) s.add(a);
    }
    return [...s].sort((a, b) => a.localeCompare(b));
  }, [objects, being]);

  const formatCandidates = useMemo(() => {
    if (!part || !section || !group) return [];
    let vs = variables.filter(
      (v) =>
        (v.part || '').trim() === part &&
        (v.section || '').trim() === section &&
        (v.group || '').trim() === group
    );
    const vn = variableName.trim();
    if (vn) vs = vs.filter((v) => (v.variable || '').trim() === vn);
    return vs;
  }, [variables, part, section, group, variableName]);

  const formatViOptions = useMemo(() => getAllFormatIValues(), []);
  const formatViiOptions = useMemo(
    () => getFormatIIValuesForFormatI(formatVi.trim()),
    [formatVi]
  );

  const groupOptionsForSelect = useMemo(() => {
    const s = new Set<string>(groupsList);
    const fromRow = (row?.group || '').trim();
    if (fromRow) s.add(fromRow);
    const p = (part || '').trim();
    const sec = (section || '').trim();
    if (p && sec) {
      for (const v of variables) {
        if ((v.part || '').trim() !== p) continue;
        if ((v.section || '').trim() !== sec) continue;
        const g = (v.group || '').trim();
        if (g) s.add(g);
      }
    }
    return [...s].sort((a, b) => a.localeCompare(b));
  }, [groupsList, row?.group, variables, part, section]);

  useEffect(() => {
    if (!row) return;
    setSourceTable(row.source_table || '');
    setSourceColumn(row.source_variable || '');
    setBeing(row.being || '');
    setAvatar(row.avatar || '');
    setObject(row.object || '');
    setVariableName(row.variable || '');
    setPart(row.part || '');
    setSection(row.section || '');
    setGroup(row.group || '');
    const fmt = sanitizeStoredFormatPair(row.format_vi || '', row.format_vii || '');
    setFormatVi(fmt.formatI);
    setFormatVii(fmt.formatII);
    const raw = (row.validations || '').trim();
    if (!raw) {
      setValidationComponentsList([{ valType: '', operator: '', value: '' }]);
    } else {
      const parts = splitValidationString(raw);
      setValidationComponentsList(parts.length ? parts.map((p) => parseValidation(p)) : [{ valType: '', operator: '', value: '' }]);
    }
    setValidationError('');
    // Only re-hydrate when the selected row identity changes. Depending on `[row]`
    // resets the form on every new object reference from the parent (wiping Variable
    // while typing or right before Save).
  }, [row?.id]);

  useEffect(() => {
    if (!row) return;
    let cancelled = false;
    (async () => {
      setLoadingParts(true);
      try {
        const res = (await apiService.getVariableParts()) as { parts?: string[] };
        if (!cancelled) setPartsList(res.parts || []);
      } catch {
        const fallback = [...new Set(variables.map((v) => v.part).filter(Boolean))] as string[];
        if (!cancelled) setPartsList(fallback.sort());
      } finally {
        if (!cancelled) setLoadingParts(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [row?.id, variables]);

  useEffect(() => {
    if (!row || !part) {
      setSectionsList([]);
      return;
    }
    let cancelled = false;
    (async () => {
      setLoadingSections(true);
      try {
        const res = (await apiService.getVariableSections(part)) as { sections?: string[] };
        if (!cancelled) setSectionsList(res.sections || []);
      } catch {
        const fallback = [
          ...new Set(variables.filter((v) => v.part === part).map((v) => v.section).filter(Boolean)),
        ] as string[];
        if (!cancelled) setSectionsList(fallback.sort());
      } finally {
        if (!cancelled) setLoadingSections(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [row?.id, part, variables]);

  useEffect(() => {
    if (!row || !part || !section) {
      setGroupsList([]);
      return;
    }
    let cancelled = false;
    (async () => {
      setLoadingGroups(true);
      try {
        const res = (await apiService.getVariableGroups(part, section)) as { groups?: string[] };
        if (!cancelled) setGroupsList(res.groups || []);
      } catch {
        const fallback = [
          ...new Set(
            variables.filter((v) => v.part === part && v.section === section).map((v) => v.group).filter(Boolean)
          ),
        ] as string[];
        if (!cancelled) setGroupsList(fallback.sort());
      } finally {
        if (!cancelled) setLoadingGroups(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [row?.id, part, section, variables]);

  useEffect(() => {
    const fi = formatVi.trim();
    if (!fi) return;
    const allowedII = getFormatIIValuesForFormatI(fi);
    if (formatVii && !allowedII.includes(formatVii)) setFormatVii('');
  }, [formatVi, formatVii]);

  const avatarOptionsForSelect = useMemo(() => {
    const s = new Set<string>(avatars);
    const fromRow = (row?.avatar || '').trim();
    if (fromRow) s.add(fromRow);
    return [...s].sort((a, b) => a.localeCompare(b));
  }, [avatars, row?.avatar]);

  const inputCls =
    'w-full px-3 py-2 bg-ag-dark-bg border border-ag-dark-border rounded text-sm text-ag-dark-text focus:ring-2 focus:ring-ag-dark-accent focus:border-ag-dark-accent';
  const selectCls = `${inputCls} pr-10 appearance-none`;

  const handleSave = async () => {
    if (!row) return;
    const err: string[] = [];
    if (!sourceTable.trim()) err.push('Source Table');
    if (!sourceColumn.trim()) err.push('Source Column');
    if (!object.trim()) err.push('Object');
    if (!variableName.trim()) err.push('Variable');
    if (!being) err.push('Being');
    if (!avatar) err.push('Avatar');
    if (!part) err.push('Part');
    if (!section) err.push('Section');
    if (!group) err.push('Group');
    if (err.length) {
      alert(`Please fill: ${err.join(', ')}`);
      return;
    }
    if (!validateSourceLdmValidationList(validationComponentsList, formatVi, formatVii, setValidationError)) return;

    const validationsJoined = joinSourceLdmValidationStrings(validationComponentsList);
    setSaving(true);
    try {
      await onSave({
        ...row,
        source_table: sourceTable.trim(),
        source_variable: sourceColumn.trim(),
        being,
        avatar,
        object: object.trim(),
        part,
        section,
        group,
        variable: variableName.trim(),
        format_vi: formatVi.trim(),
        format_vii: formatVii.trim(),
        validations: validationsJoined,
      });
    } finally {
      setSaving(false);
    }
  };

  if (!row) {
    return (
      <div className="h-full min-h-[200px] flex items-center justify-center rounded-lg border border-ag-dark-border border-dashed bg-ag-dark-bg/40 px-4">
        <p className="text-sm text-ag-dark-text-secondary text-center">Select a row in the grid to view and edit metadata.</p>
      </div>
    );
  }

  const sourceReadOnlyName = (row.source_name || '').trim() || '—';
  const headTitle = [row.source_name, row.source_table, row.source_variable]
    .map((x) => String(x || '').trim())
    .filter(Boolean)
    .join(' ');
  const panelTitle = headTitle ? `${headTitle} LDM Mapping` : 'LDM Mapping';

  return (
    <div className="flex flex-col h-full min-h-0 border border-ag-dark-border rounded-lg bg-ag-dark-surface shadow-sm">
      <div className="flex items-center justify-between gap-2 px-4 py-3 border-b border-ag-dark-border flex-shrink-0">
        <h3 className="text-base font-semibold text-ag-dark-text">{panelTitle}</h3>
        <button
          type="button"
          onClick={onClose}
          className="p-1.5 rounded text-ag-dark-text-secondary hover:text-ag-dark-text hover:bg-ag-dark-bg transition-colors"
          title="Close"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      <div className="flex-1 min-h-0 overflow-y-auto px-4 py-4 space-y-4 text-sm">
        <div>
          <label className="block text-xs text-ag-dark-text-secondary mb-1">Source Name</label>
          <input
            className={`${inputCls} opacity-60 cursor-not-allowed`}
            value={sourceReadOnlyName}
            readOnly
            disabled
          />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block mb-1 text-xs text-ag-dark-text-secondary">
              Source Table <span className="text-ag-dark-error">*</span>
            </label>
            <input className={inputCls} value={sourceTable} onChange={(e) => setSourceTable(e.target.value)} />
          </div>
          <div>
            <label className="block mb-1 text-xs text-ag-dark-text-secondary">
              Source Column <span className="text-ag-dark-error">*</span>
            </label>
            <input className={inputCls} value={sourceColumn} onChange={(e) => setSourceColumn(e.target.value)} />
          </div>
          <div>
            <label className="block mb-1 text-xs text-ag-dark-text-secondary">
              Being <span className="text-ag-dark-error">*</span>
            </label>
            <select
              className={selectCls}
              style={selectStyle}
              value={being}
              onChange={(e) => {
                setBeing(e.target.value);
                setAvatar('');
              }}
            >
              <option value="">Select…</option>
              {beings.map((b) => (
                <option key={b} value={b}>
                  {b}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block mb-1 text-xs text-ag-dark-text-secondary">
              Avatar <span className="text-ag-dark-error">*</span>
            </label>
            <select
              className={selectCls}
              style={selectStyle}
              value={avatar}
              onChange={(e) => setAvatar(e.target.value)}
              disabled={!being}
            >
              <option value="">Select…</option>
              {avatarOptionsForSelect.map((a) => (
                <option key={a} value={a}>
                  {a}
                </option>
              ))}
            </select>
          </div>
          <div className="md:col-span-2">
            <label className="block mb-1 text-xs text-ag-dark-text-secondary">
              Object <span className="text-ag-dark-error">*</span>
            </label>
            <input className={inputCls} value={object} onChange={(e) => setObject(e.target.value)} />
          </div>
          <div>
            <label className="block mb-1 text-xs text-ag-dark-text-secondary">
              Part <span className="text-ag-dark-error">*</span>
            </label>
            <select
              className={selectCls}
              style={selectStyle}
              value={part}
              onChange={(e) => {
                setPart(e.target.value);
                setSection('');
                setGroup('');
              }}
              disabled={loadingParts}
            >
              <option value="">{loadingParts ? 'Loading…' : 'Select…'}</option>
              {partsList.map((p) => (
                <option key={p} value={p}>
                  {p}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block mb-1 text-xs text-ag-dark-text-secondary">
              Section <span className="text-ag-dark-error">*</span>
            </label>
            <select
              className={selectCls}
              style={selectStyle}
              value={section}
              onChange={(e) => {
                setSection(e.target.value);
                setGroup('');
              }}
              disabled={!part || loadingSections}
            >
              <option value="">{loadingSections ? 'Loading…' : 'Select…'}</option>
              {sectionsList.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block mb-1 text-xs text-ag-dark-text-secondary">
              Group <span className="text-ag-dark-error">*</span>
            </label>
            <select
              className={selectCls}
              style={selectStyle}
              value={group}
              onChange={(e) => setGroup(e.target.value)}
              disabled={!part || !section || loadingGroups}
            >
              <option value="">{loadingGroups ? 'Loading…' : 'Select…'}</option>
              {groupOptionsForSelect.map((g) => (
                <option key={g} value={g}>
                  {g}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block mb-1 text-xs text-ag-dark-text-secondary">
              Variable <span className="text-ag-dark-error">*</span>
            </label>
            <input className={inputCls} value={variableName} onChange={(e) => setVariableName(e.target.value)} />
          </div>
          <div>
            <label className="block mb-1 text-xs text-ag-dark-text-secondary">Format VI</label>
            <select
              className={selectCls}
              style={selectStyle}
              value={formatVi}
              onChange={(e) => {
                setFormatVi(e.target.value);
                setFormatVii('');
              }}
              disabled={!part || !section || !group}
            >
              <option value="">Optional</option>
              {formatViOptions.map((x) => (
                <option key={x} value={x}>
                  {x}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block mb-1 text-xs text-ag-dark-text-secondary">Format VII</label>
            <select
              className={selectCls}
              style={selectStyle}
              value={formatVii}
              onChange={(e) => setFormatVii(e.target.value)}
              disabled={!part || !section || !group}
            >
              <option value="">Optional</option>
              {formatViiOptions.map((x) => (
                <option key={x} value={x}>
                  {x}
                </option>
              ))}
            </select>
          </div>
        </div>

        <SourceLdmValidationsBlock
          formatVi={formatVi}
          formatVii={formatVii}
          validationComponentsList={validationComponentsList}
          setValidationComponentsList={setValidationComponentsList}
          validationError={validationError}
          setValidationError={setValidationError}
          relativeVariableOptions={relativeVariableOptions}
          inputCls={inputCls}
          selectCls={selectCls}
        />

        <div className="flex justify-end pt-2 border-t border-ag-dark-border">
          <button
            type="button"
            onClick={() => void handleSave()}
            disabled={saving}
            className="inline-flex items-center gap-2 px-4 py-2 rounded bg-ag-dark-accent text-white text-sm font-medium hover:bg-ag-dark-accent-hover disabled:opacity-50"
          >
            <Save className="w-4 h-4" />
            {saving ? 'Saving…' : 'Save changes'}
          </button>
        </div>
      </div>
    </div>
  );
};
