import React, { useEffect, useMemo, useState } from 'react';
import { X } from 'lucide-react';
import { apiService } from '../services/api';
import type { ObjectData } from '../data/mockData';
import type { VariableData } from '../data/variablesData';
import type { SourceLdmRow } from '../hooks/useSources';
import { getAllFormatIValues, getFormatIIValuesForFormatI } from '../utils/formatMapping';
import type { ValidationComponents } from '../utils/validationUtils';
import {
  SourceLdmValidationsBlock,
  validateSourceLdmValidationList,
  joinSourceLdmValidationStrings,
} from './SourceLdmValidationsBlock';

export interface SourceLdmAddRowModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (row: Omit<SourceLdmRow, 'id' | 'source_id'>) => void | Promise<void>;
  sourceDisplayName: string;
  objects: ObjectData[];
  variables: VariableData[];
}

const selectStyle: React.CSSProperties = {
  backgroundImage: `url("data:image/svg+xml,%3csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 20 20'%3e%3cpath stroke='%236b7280' stroke-linecap='round' stroke-linejoin='round' stroke-width='1.5' d='m6 8 4 4 4-4'/%3e%3c/svg%3e")`,
  backgroundPosition: 'right 12px center',
  backgroundRepeat: 'no-repeat',
  backgroundSize: '16px',
};

function RequiredLabel({ children }: { children: React.ReactNode }) {
  return (
    <span className="text-xs text-ag-dark-text-secondary mb-1 inline-flex items-center gap-0.5">
      {children}
      <span className="text-ag-dark-error">*</span>
    </span>
  );
}

export const SourceLdmAddRowModal: React.FC<SourceLdmAddRowModalProps> = ({
  isOpen,
  onClose,
  onSave,
  sourceDisplayName,
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

  const formatViOptions = useMemo(() => getAllFormatIValues(), []);
  const formatViiOptions = useMemo(
    () => getFormatIIValuesForFormatI(formatVi.trim()),
    [formatVi]
  );

  const groupOptionsForSelect = useMemo(() => {
    const s = new Set<string>(groupsList);
    const gCur = (group || '').trim();
    if (gCur) s.add(gCur);
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
  }, [groupsList, group, variables, part, section]);

  useEffect(() => {
    if (!isOpen) return;
    setSourceTable('');
    setSourceColumn('');
    setBeing('');
    setAvatar('');
    setObject('');
    setVariableName('');
    setPart('');
    setSection('');
    setGroup('');
    setFormatVi('');
    setFormatVii('');
    setValidationComponentsList([{ valType: '', operator: '', value: '' }]);
    setValidationError('');
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;
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
  }, [isOpen, variables]);

  useEffect(() => {
    if (!isOpen || !part) {
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
  }, [isOpen, part, variables]);

  useEffect(() => {
    if (!isOpen || !part || !section) {
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
  }, [isOpen, part, section, variables]);

  useEffect(() => {
    setAvatar('');
  }, [being]);

  useEffect(() => {
    if (avatar && !avatars.includes(avatar)) setAvatar('');
  }, [avatars, avatar]);

  useEffect(() => {
    const fi = formatVi.trim();
    if (!fi) return;
    const allowedII = getFormatIIValuesForFormatI(fi);
    if (formatVii && !allowedII.includes(formatVii)) setFormatVii('');
  }, [formatVi, formatVii]);

  if (!isOpen) return null;

  const inputCls =
    'w-full px-3 py-2 bg-ag-dark-bg border border-ag-dark-border rounded text-sm text-ag-dark-text focus:ring-2 focus:ring-ag-dark-accent focus:border-ag-dark-accent';
  const selectCls = `${inputCls} pr-10 appearance-none`;

  const handleSubmit = async () => {
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

    await onSave({
      source_name: sourceDisplayName.trim(),
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
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-70 flex items-center justify-center z-[100]" data-modal="true">
      <div className="bg-ag-dark-surface rounded-lg border border-ag-dark-border max-w-xl w-full mx-4 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-6 border-b border-ag-dark-border">
          <h2 className="text-xl font-semibold text-ag-dark-text">Add LDM row</h2>
          <button type="button" onClick={onClose} className="text-ag-dark-text-secondary hover:text-ag-dark-text">
            <X className="w-6 h-6" />
          </button>
        </div>

        <div className="p-6 space-y-4 text-sm">
          <p className="text-ag-dark-text-secondary">
            Source name will be saved as <span className="text-ag-dark-text font-medium">{sourceDisplayName || '—'}</span>
          </p>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block mb-1">
                <RequiredLabel>Source Table</RequiredLabel>
              </label>
              <input className={inputCls} value={sourceTable} onChange={(e) => setSourceTable(e.target.value)} />
            </div>
            <div>
              <label className="block mb-1">
                <RequiredLabel>Source Column</RequiredLabel>
              </label>
              <input className={inputCls} value={sourceColumn} onChange={(e) => setSourceColumn(e.target.value)} />
            </div>
            <div>
              <label className="block mb-1">
                <RequiredLabel>Being</RequiredLabel>
              </label>
              <select className={selectCls} style={selectStyle} value={being} onChange={(e) => setBeing(e.target.value)}>
                <option value="">Select…</option>
                {beings.map((b) => (
                  <option key={b} value={b}>
                    {b}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block mb-1">
                <RequiredLabel>Avatar</RequiredLabel>
              </label>
              <select
                className={selectCls}
                style={selectStyle}
                value={avatar}
                onChange={(e) => setAvatar(e.target.value)}
                disabled={!being}
              >
                <option value="">Select…</option>
                {avatars.map((a) => (
                  <option key={a} value={a}>
                    {a}
                  </option>
                ))}
              </select>
            </div>
            <div className="md:col-span-2">
              <label className="block mb-1">
                <RequiredLabel>Object</RequiredLabel>
              </label>
              <input className={inputCls} value={object} onChange={(e) => setObject(e.target.value)} />
            </div>
            <div>
              <label className="block mb-1">
                <RequiredLabel>Part</RequiredLabel>
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
              <label className="block mb-1">
                <RequiredLabel>Section</RequiredLabel>
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
              <label className="block mb-1">
                <RequiredLabel>Group</RequiredLabel>
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
              <label className="block mb-1">
                <RequiredLabel>Variable</RequiredLabel>
              </label>
              <input className={inputCls} value={variableName} onChange={(e) => setVariableName(e.target.value)} />
            </div>
            <div>
              <label className="block text-xs text-ag-dark-text-secondary mb-1">Format VI</label>
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
              <label className="block text-xs text-ag-dark-text-secondary mb-1">Format VII</label>
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

          <div className="flex justify-end gap-2 pt-2 border-t border-ag-dark-border">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded border border-ag-dark-border text-ag-dark-text hover:bg-ag-dark-bg"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleSubmit}
              className="px-4 py-2 rounded bg-ag-dark-accent text-white hover:bg-ag-dark-accent-hover"
            >
              Add row
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
