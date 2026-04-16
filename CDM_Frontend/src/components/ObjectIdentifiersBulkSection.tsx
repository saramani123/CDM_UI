import React, {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useLayoutEffect,
  useRef,
  useState,
} from 'react';
import { Plus, Trash2 } from 'lucide-react';
import { apiService } from '../services/api';
import { useVariables } from '../hooks/useVariables';

export interface UniqueIdEntry {
  id: string;
  part: string;
  section: string;
  group: string;
  variableId: string;
}

export interface CompositeIdRow {
  id: string;
  part: string;
  section: string;
  group: string;
  variableId: string;
}

export interface CompositeIdBlock {
  blockNumber: number;
  rows: CompositeIdRow[];
}

export type IdentifierSavePayload = {
  identifier?: Record<string, unknown>;
  error?: string;
};

export type ObjectIdentifiersBulkRef = {
  /** Returns identifier API payload, or undefined if nothing configured. Sets `error` on validation failure. */
  prepareIdentifierForSave: () => IdentifierSavePayload;
};

type Props = {
  /** When true, all inputs are read-only */
  readOnly?: boolean;
  /**
   * Parent can read the latest payload on save without relying on ref timing.
   * Called with null when unmounted or read-only.
   */
  onRegisterPrepareIdentifier?: (fn: (() => IdentifierSavePayload) | null) => void;
};

export const ObjectIdentifiersBulkSection = forwardRef<ObjectIdentifiersBulkRef, Props>(
  function ObjectIdentifiersBulkSection({ readOnly = false, onRegisterPrepareIdentifier }, ref) {
    const { variables: variablesData } = useVariables();

    const [uniqueIdEntries, setUniqueIdEntries] = useState<UniqueIdEntry[]>([
      { id: 'unique-1', part: '', section: '', group: '', variableId: '' },
    ]);

    const [compositeIdBlocks, setCompositeIdBlocks] = useState<CompositeIdBlock[]>([
      {
        blockNumber: 1,
        rows: [
          { id: 'block1-row1', part: '', section: '', group: '', variableId: '' },
          { id: 'block1-row2', part: '', section: '', group: '', variableId: '' },
          { id: 'block1-row3', part: '', section: '', group: '', variableId: '' },
          { id: 'block1-row4', part: '', section: '', group: '', variableId: '' },
          { id: 'block1-row5', part: '', section: '', group: '', variableId: '' },
        ],
      },
    ]);

    const [partsList, setPartsList] = useState<string[]>([]);
    const [sectionsCache, setSectionsCache] = useState<Record<string, string[]>>({});
    const [groupsCache, setGroupsCache] = useState<Record<string, string[]>>({});
    const [variablesCache, setVariablesCache] = useState<Record<string, Array<{ id: string; name: string }>>>({});
    const [loadingStates, setLoadingStates] = useState<Record<string, boolean>>({});
    const pendingLoadsRef = useRef<Set<string>>(new Set());

    useEffect(() => {
      const loadParts = async () => {
        try {
          const response = (await apiService.getVariableParts()) as { parts: string[] };
          setPartsList(response.parts || []);
        } catch {
          if (variablesData && Array.isArray(variablesData)) {
            const parts = [...new Set(variablesData.map(v => v.part))].filter(Boolean).sort();
            setPartsList(parts);
          }
        }
      };
      loadParts();
    }, [variablesData]);

    const loadSectionsForPart = async (part: string) => {
      if (!part) return [];
      const cacheKey = `part:${part}`;
      if (sectionsCache[cacheKey]) return sectionsCache[cacheKey];
      if (pendingLoadsRef.current.has(cacheKey)) return [];
      pendingLoadsRef.current.add(cacheKey);
      setLoadingStates(prev => ({ ...prev, [cacheKey]: true }));
      try {
        const response = (await apiService.getVariableSections(part)) as { sections: string[] };
        const sections = response.sections || [];
        setSectionsCache(prev => ({ ...prev, [cacheKey]: sections }));
        return sections;
      } catch {
        if (variablesData && Array.isArray(variablesData)) {
          const sections = [...new Set(variablesData.filter(v => v.part === part).map(v => v.section))]
            .filter(Boolean)
            .sort();
          setSectionsCache(prev => ({ ...prev, [cacheKey]: sections }));
          return sections;
        }
        return [];
      } finally {
        setLoadingStates(prev => ({ ...prev, [cacheKey]: false }));
        pendingLoadsRef.current.delete(cacheKey);
      }
    };

    const loadGroupsForPartAndSection = async (part: string, section: string) => {
      if (!part || !section) return [];
      const cacheKey = `part:${part}|section:${section}`;
      if (groupsCache[cacheKey]) return groupsCache[cacheKey];
      if (pendingLoadsRef.current.has(cacheKey)) return [];
      pendingLoadsRef.current.add(cacheKey);
      setLoadingStates(prev => ({ ...prev, [cacheKey]: true }));
      try {
        const response = (await apiService.getVariableGroups(part, section)) as { groups: string[] };
        const groups = response.groups || [];
        setGroupsCache(prev => ({ ...prev, [cacheKey]: groups }));
        return groups;
      } catch {
        if (variablesData && Array.isArray(variablesData)) {
          const groups = [...new Set(variablesData.filter(v => v.part === part && v.section === section).map(v => v.group))]
            .filter(Boolean)
            .sort();
          setGroupsCache(prev => ({ ...prev, [cacheKey]: groups }));
          return groups;
        }
        return [];
      } finally {
        setLoadingStates(prev => ({ ...prev, [cacheKey]: false }));
        pendingLoadsRef.current.delete(cacheKey);
      }
    };

    const loadVariablesForPartSectionAndGroup = async (part: string, section: string, group: string) => {
      if (!part || !section || !group) return [];
      const cacheKey = `part:${part}|section:${section}|group:${group}`;
      if (variablesCache[cacheKey]) return variablesCache[cacheKey];
      if (pendingLoadsRef.current.has(cacheKey)) return [];
      pendingLoadsRef.current.add(cacheKey);
      setLoadingStates(prev => ({ ...prev, [cacheKey]: true }));
      try {
        const response = (await apiService.getVariablesForSelection(part, section, group)) as {
          variables: Array<{ id: string; name: string }>;
        };
        const variables = response.variables || [];
        setVariablesCache(prev => ({ ...prev, [cacheKey]: variables }));
        return variables;
      } catch {
        if (variablesData && Array.isArray(variablesData)) {
          const variables = variablesData
            .filter(v => v.part === part && v.section === section && v.group === group)
            .map(v => ({ id: v.id, name: v.variable }));
          setVariablesCache(prev => ({ ...prev, [cacheKey]: variables }));
          return variables;
        }
        return [];
      } finally {
        setLoadingStates(prev => ({ ...prev, [cacheKey]: false }));
        pendingLoadsRef.current.delete(cacheKey);
      }
    };

    const getAllParts = useCallback(() => {
      if (partsList.length > 0) return partsList;
      if (!variablesData || !Array.isArray(variablesData)) return [];
      return [...new Set(variablesData.map(v => v.part))].filter(Boolean).sort();
    }, [partsList, variablesData]);

    const getSectionsForPart = (part: string): string[] => {
      if (!part) return [];
      return sectionsCache[`part:${part}`] || [];
    };

    const getGroupsForPartAndSection = (part: string, section: string): string[] => {
      if (!part || !section) return [];
      return groupsCache[`part:${part}|section:${section}`] || [];
    };

    const getVariablesForPartSectionAndGroup = (part: string, section: string, group: string) => {
      if (!part || !section || !group) return [];
      return variablesCache[`part:${part}|section:${section}|group:${group}`] || [];
    };

    const getUniqueIdVariables = (part: string, section: string, group: string) =>
      getVariablesForPartSectionAndGroup(part, section, group);

    useEffect(() => {
      const partsToLoad = new Set(uniqueIdEntries.map(e => e.part).filter(Boolean));
      (async () => {
        for (const part of partsToLoad) {
          const cacheKey = `part:${part}`;
          if (!sectionsCache[cacheKey]) await loadSectionsForPart(part);
        }
      })();
    }, [uniqueIdEntries.map(e => e.part).join(',')]);

    useEffect(() => {
      const combinations = uniqueIdEntries.filter(e => e.part && e.section).map(e => ({ part: e.part, section: e.section }));
      (async () => {
        for (const { part, section } of combinations) {
          const cacheKey = `part:${part}|section:${section}`;
          if (!groupsCache[cacheKey]) await loadGroupsForPartAndSection(part, section);
        }
      })();
    }, [uniqueIdEntries.map(e => `${e.part}|${e.section}`).join(',')]);

    useEffect(() => {
      const combinations = uniqueIdEntries
        .filter(e => e.part && e.section && e.group && e.group !== 'ANY')
        .map(e => ({ part: e.part, section: e.section, group: e.group }));
      (async () => {
        for (const { part, section, group } of combinations) {
          const cacheKey = `part:${part}|section:${section}|group:${group}`;
          if (!variablesCache[cacheKey]) await loadVariablesForPartSectionAndGroup(part, section, group);
        }
      })();
    }, [uniqueIdEntries.map(e => `${e.part}|${e.section}|${e.group}`).join(',')]);

    useEffect(() => {
      const partsToLoad = new Set<string>();
      compositeIdBlocks.forEach(block => {
        block.rows.forEach(row => {
          if (row.part) partsToLoad.add(row.part);
        });
      });
      (async () => {
        for (const part of partsToLoad) {
          const cacheKey = `part:${part}`;
          if (!sectionsCache[cacheKey]) await loadSectionsForPart(part);
        }
      })();
    }, [compositeIdBlocks.map(b => b.rows.map(r => r.part).join(',')).join('|')]);

    useEffect(() => {
      const combinations: Array<{ part: string; section: string }> = [];
      compositeIdBlocks.forEach(block => {
        block.rows.forEach(row => {
          if (row.part && row.section) combinations.push({ part: row.part, section: row.section });
        });
      });
      (async () => {
        for (const { part, section } of combinations) {
          const cacheKey = `part:${part}|section:${section}`;
          if (!groupsCache[cacheKey]) await loadGroupsForPartAndSection(part, section);
        }
      })();
    }, [compositeIdBlocks.map(b => b.rows.map(r => `${r.part}|${r.section}`).join(',')).join('|')]);

    useEffect(() => {
      const combinations: Array<{ part: string; section: string; group: string }> = [];
      compositeIdBlocks.forEach(block => {
        block.rows.forEach(row => {
          if (row.part && row.section && row.group && row.group !== 'ANY') {
            combinations.push({ part: row.part, section: row.section, group: row.group });
          }
        });
      });
      (async () => {
        for (const { part, section, group } of combinations) {
          const cacheKey = `part:${part}|section:${section}|group:${group}`;
          if (!variablesCache[cacheKey]) await loadVariablesForPartSectionAndGroup(part, section, group);
        }
      })();
    }, [compositeIdBlocks.map(b => b.rows.map(r => `${r.part}|${r.section}|${r.group}`).join(',')).join('|')]);

    const handleAddUniqueIdEntry = () => {
      const newId = `unique-${Date.now()}`;
      setUniqueIdEntries(prev => [...prev, { id: newId, part: '', section: '', group: '', variableId: '' }]);
    };

    const handleRemoveUniqueIdEntry = (entryId: string) => {
      setUniqueIdEntries(prev => prev.filter(entry => entry.id !== entryId));
    };

    const handleUniqueIdPartChange = async (entryId: string, part: string) => {
      setUniqueIdEntries(prev =>
        prev.map(entry => (entry.id === entryId ? { ...entry, part, section: '', group: '', variableId: '' } : entry))
      );
      if (part) await loadSectionsForPart(part);
    };

    const handleUniqueIdSectionChange = async (entryId: string, section: string) => {
      const entry = uniqueIdEntries.find(e => e.id === entryId);
      setUniqueIdEntries(prev =>
        prev.map(e => {
          if (e.id !== entryId) return e;
          if (section === 'ANY') return { ...e, section, group: 'ANY', variableId: 'ANY' };
          return { ...e, section, group: '', variableId: '' };
        })
      );
      if (entry?.part && section && section !== 'ANY') await loadGroupsForPartAndSection(entry.part, section);
    };

    const handleUniqueIdGroupChange = async (entryId: string, group: string) => {
      const entry = uniqueIdEntries.find(e => e.id === entryId);
      setUniqueIdEntries(prev =>
        prev.map(e => {
          if (e.id !== entryId) return e;
          if (group === 'ANY') return { ...e, group, variableId: 'ANY' };
          return { ...e, group, variableId: '' };
        })
      );
      if (entry?.part && entry.section && group && group !== 'ANY') {
        await loadVariablesForPartSectionAndGroup(entry.part, entry.section, group);
      }
    };

    const handleUniqueIdVariableChange = (entryId: string, variableId: string) => {
      setUniqueIdEntries(prev => prev.map(entry => (entry.id === entryId ? { ...entry, variableId } : entry)));
    };

    const handleAddCompositeIdBlock = () => {
      const newBlockNumber = compositeIdBlocks.length + 1;
      setCompositeIdBlocks(prev => [
        ...prev,
        {
          blockNumber: newBlockNumber,
          rows: [
            { id: `block${newBlockNumber}-row1`, part: '', section: '', group: '', variableId: '' },
            { id: `block${newBlockNumber}-row2`, part: '', section: '', group: '', variableId: '' },
            { id: `block${newBlockNumber}-row3`, part: '', section: '', group: '', variableId: '' },
            { id: `block${newBlockNumber}-row4`, part: '', section: '', group: '', variableId: '' },
            { id: `block${newBlockNumber}-row5`, part: '', section: '', group: '', variableId: '' },
          ],
        },
      ]);
    };

    const handleRemoveCompositeIdBlock = (blockNumber: number) => {
      setCompositeIdBlocks(prev => {
        const filtered = prev.filter(block => block.blockNumber !== blockNumber);
        return filtered.map((block, index) => ({
          ...block,
          blockNumber: index + 1,
          rows: block.rows.map((row, rowIndex) => ({
            ...row,
            id: `block${index + 1}-row${rowIndex + 1}`,
          })),
        }));
      });
    };

    const handleCompositeIdRowChange = async (
      blockNumber: number,
      rowId: string,
      field: 'part' | 'section' | 'group' | 'variableId',
      value: string
    ) => {
      const block = compositeIdBlocks.find(b => b.blockNumber === blockNumber);
      const row = block?.rows.find(r => r.id === rowId);

      setCompositeIdBlocks(prev =>
        prev.map(b => {
          if (b.blockNumber !== blockNumber) return b;
          return {
            ...b,
            rows: b.rows.map(r => {
              if (r.id !== rowId) return r;
              if (field === 'part') return { ...r, part: value, section: '', group: '', variableId: '' };
              if (field === 'section') {
                if (value === 'ANY') return { ...r, section: value, group: 'ANY', variableId: 'ANY' };
                return { ...r, section: value, group: '', variableId: '' };
              }
              if (field === 'group') {
                if (value === 'ANY') return { ...r, group: value, variableId: 'ANY' };
                return { ...r, group: value, variableId: '' };
              }
              return { ...r, variableId: value };
            }),
          };
        })
      );

      if (field === 'part' && value) await loadSectionsForPart(value);
      else if (field === 'section' && row?.part && value) await loadGroupsForPartAndSection(row.part, value);
      else if (field === 'group' && row?.part && row?.section && value && value !== 'ANY') {
        await loadVariablesForPartSectionAndGroup(row.part, row.section, value);
      }
    };

    const disabled = readOnly;

    const buildIdentifierPayload = useCallback((): IdentifierSavePayload => {
      const discreteIdEntries = uniqueIdEntries
        .filter(entry => entry.part && entry.section && entry.group && entry.variableId)
        .map(entry => ({
          part: entry.part,
          section: entry.section,
          group: entry.group,
          variableId: entry.variableId,
        }));

      const seen = new Set<string>();
      const duplicates: string[] = [];
      for (const entry of discreteIdEntries) {
        const key = `${entry.part}|${entry.section}|${entry.group}|${entry.variableId}`;
        if (seen.has(key)) {
          duplicates.push(`${entry.part} / ${entry.section} / ${entry.group} / ${entry.variableId}`);
        } else {
          seen.add(key);
        }
      }
      if (duplicates.length > 0) {
        return {
          error: `Cannot save: You have added duplicate unique IDs. Duplicate entries: ${duplicates.join(', ')}`,
        };
      }

      const compositeIds: Record<string, Array<{ part: string; section: string; group: string; variableId: string }>> =
        {};
      compositeIdBlocks.forEach(block => {
        const blockKey = String(block.blockNumber);
        const entries = block.rows
          .filter(row => row.part && row.section && row.group && row.variableId)
          .map(row => ({
            part: row.part,
            section: row.section,
            group: row.group,
            variableId: row.variableId,
          }));
        if (entries.length > 0) compositeIds[blockKey] = entries;
      });

      const hasAny = discreteIdEntries.length > 0 || Object.keys(compositeIds).length > 0;
      if (!hasAny) return {};

      return {
        identifier: {
          discreteId: { entries: discreteIdEntries },
          compositeIds,
        },
      };
    }, [uniqueIdEntries, compositeIdBlocks]);

    useImperativeHandle(
      ref,
      () => ({
        prepareIdentifierForSave: buildIdentifierPayload,
      }),
      [buildIdentifierPayload]
    );

    useLayoutEffect(() => {
      if (!onRegisterPrepareIdentifier) return;
      onRegisterPrepareIdentifier(disabled ? null : buildIdentifierPayload);
      return () => onRegisterPrepareIdentifier(null);
    }, [onRegisterPrepareIdentifier, buildIdentifierPayload, disabled]);

    const selectCls = disabled
      ? 'w-full px-2 py-1.5 pr-8 bg-ag-dark-surface border border-ag-dark-border rounded text-sm opacity-50 cursor-not-allowed appearance-none'
      : 'w-full px-2 py-1.5 pr-8 bg-ag-dark-bg border border-ag-dark-border rounded text-sm text-ag-dark-text focus:ring-2 focus:ring-ag-dark-accent focus:border-ag-dark-accent appearance-none';

    const selectStyle = {
      backgroundImage: `url("data:image/svg+xml,%3csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 20 20'%3e%3cpath stroke='%236b7280' stroke-linecap='round' stroke-linejoin='round' stroke-width='1.5' d='m6 8 4 4 4-4'/%3e%3c/svg%3e")`,
      backgroundPosition: 'right 8px center',
      backgroundRepeat: 'no-repeat',
      backgroundSize: '16px',
    } as const;

    return (
      <div className="space-y-6">
        <div>
          <div className="flex items-center justify-between mb-3">
            <h5 className="text-sm font-medium text-ag-dark-text">Unique ID</h5>
            <button
              type="button"
              onClick={handleAddUniqueIdEntry}
              disabled={disabled}
              className="flex items-center justify-center text-ag-dark-accent hover:text-ag-dark-accent-hover disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              title="Add Unique ID"
            >
              <Plus className="w-5 h-5" />
            </button>
          </div>
          <div className="border border-ag-dark-border rounded">
            <div className="grid grid-cols-4 gap-2 bg-ag-dark-bg border-b border-ag-dark-border p-2">
              <div className="text-xs font-medium text-ag-dark-text-secondary">Part</div>
              <div className="text-xs font-medium text-ag-dark-text-secondary">Section</div>
              <div className="text-xs font-medium text-ag-dark-text-secondary">Group</div>
              <div className="text-xs font-medium text-ag-dark-text-secondary">Variable</div>
            </div>
            <div className="divide-y divide-ag-dark-border">
              {uniqueIdEntries.map((entry, index) => {
                const variableOptions = getUniqueIdVariables(entry.part, entry.section, entry.group);
                return (
                  <div
                    key={entry.id}
                    className={`grid gap-2 items-center p-2 hover:bg-ag-dark-bg/50 ${
                      index > 0 ? 'grid-cols-[1fr_1fr_1fr_1fr_auto]' : 'grid-cols-4'
                    }`}
                  >
                    <select
                      value={entry.part}
                      onChange={e => handleUniqueIdPartChange(entry.id, e.target.value)}
                      disabled={disabled}
                      className={selectCls}
                      style={selectStyle}
                    >
                      <option value="">Select Part</option>
                      {getAllParts().map(part => (
                        <option key={part} value={part}>
                          {part}
                        </option>
                      ))}
                    </select>
                    <select
                      value={entry.section}
                      onChange={e => handleUniqueIdSectionChange(entry.id, e.target.value)}
                      disabled={disabled || !entry.part || loadingStates[`part:${entry.part}`]}
                      className={selectCls}
                      style={selectStyle}
                    >
                      <option value="">Select Section</option>
                      <option value="ANY">ANY</option>
                      {loadingStates[`part:${entry.part}`] ? (
                        <option value="">Loading...</option>
                      ) : (
                        getSectionsForPart(entry.part).map(section => (
                          <option key={section} value={section}>
                            {section}
                          </option>
                        ))
                      )}
                    </select>
                    <select
                      value={entry.group}
                      onChange={e => handleUniqueIdGroupChange(entry.id, e.target.value)}
                      disabled={
                        disabled ||
                        !entry.part ||
                        !entry.section ||
                        entry.section === 'ANY' ||
                        loadingStates[`part:${entry.part}|section:${entry.section}`]
                      }
                      className={selectCls}
                      style={selectStyle}
                    >
                      <option value="">Select Group</option>
                      <option value="ANY">ANY</option>
                      {loadingStates[`part:${entry.part}|section:${entry.section}`] ? (
                        <option value="">Loading...</option>
                      ) : (
                        getGroupsForPartAndSection(entry.part, entry.section).map(group => (
                          <option key={group} value={group}>
                            {group}
                          </option>
                        ))
                      )}
                    </select>
                    <select
                      value={entry.variableId}
                      onChange={e => handleUniqueIdVariableChange(entry.id, e.target.value)}
                      disabled={
                        disabled ||
                        !entry.part ||
                        !entry.section ||
                        !entry.group ||
                        entry.section === 'ANY' ||
                        (entry.group !== 'ANY' &&
                          loadingStates[`part:${entry.part}|section:${entry.section}|group:${entry.group}`])
                      }
                      className={selectCls}
                      style={selectStyle}
                    >
                      <option value="">Select Variable</option>
                      <option value="ANY">ANY</option>
                      {entry.group !== 'ANY' &&
                      loadingStates[`part:${entry.part}|section:${entry.section}|group:${entry.group}`] ? (
                        <option value="">Loading...</option>
                      ) : (
                        variableOptions.map(v => (
                          <option key={v.id} value={v.id}>
                            {v.name}
                          </option>
                        ))
                      )}
                    </select>
                    {index > 0 && (
                      <button
                        type="button"
                        onClick={() => handleRemoveUniqueIdEntry(entry.id)}
                        disabled={disabled}
                        className="flex items-center justify-center w-6 h-6 rounded text-ag-dark-error hover:bg-red-900/20 disabled:opacity-50 transition-colors"
                        title="Remove Unique ID"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        <div className="space-y-4">
          <div className="flex items-center justify-between mb-3">
            <h5 className="text-sm font-medium text-ag-dark-text">Composite IDs</h5>
            <button
              type="button"
              onClick={handleAddCompositeIdBlock}
              disabled={disabled}
              className="flex items-center justify-center text-ag-dark-accent hover:text-ag-dark-accent-hover disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              title="Add Composite ID Block"
            >
              <Plus className="w-5 h-5" />
            </button>
          </div>

          {compositeIdBlocks.map((block, blockIndex) => (
            <div key={block.blockNumber} className="border border-ag-dark-border rounded">
              <div className="flex items-center justify-between bg-ag-dark-bg border-b border-ag-dark-border p-2">
                <h6 className="text-sm font-medium text-ag-dark-text">Composite ID #{block.blockNumber}</h6>
                {blockIndex > 0 && (
                  <button
                    type="button"
                    onClick={() => handleRemoveCompositeIdBlock(block.blockNumber)}
                    disabled={disabled}
                    className="flex items-center justify-center w-6 h-6 rounded text-ag-dark-error hover:bg-red-900/20 disabled:opacity-50 transition-colors"
                    title="Remove Composite ID Block"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                )}
              </div>
              <div className="grid grid-cols-[25px_1fr_1fr_1fr_1fr] gap-1 bg-ag-dark-bg border-b border-ag-dark-border p-2">
                <div />
                <div className="text-xs font-medium text-ag-dark-text-secondary">Part</div>
                <div className="text-xs font-medium text-ag-dark-text-secondary">Section</div>
                <div className="text-xs font-medium text-ag-dark-text-secondary">Group</div>
                <div className="text-xs font-medium text-ag-dark-text-secondary">Variable</div>
              </div>
              <div className="divide-y divide-ag-dark-border">
                {block.rows.map((row, rowIndex) => {
                  const variableOptions =
                    row.part && row.section && row.group && row.group !== 'ANY'
                      ? getVariablesForPartSectionAndGroup(row.part, row.section, row.group)
                      : [];
                  return (
                    <div
                      key={row.id}
                      className="grid grid-cols-[25px_1fr_1fr_1fr_1fr] gap-1 items-center p-2 hover:bg-ag-dark-bg/50"
                    >
                      <div className="flex items-center">
                        <span className="text-[10px] font-medium text-ag-dark-text">{rowIndex + 1}</span>
                      </div>
                      <select
                        value={row.part}
                        onChange={e => handleCompositeIdRowChange(block.blockNumber, row.id, 'part', e.target.value)}
                        disabled={disabled}
                        className={selectCls}
                        style={selectStyle}
                      >
                        <option value="">Select Part</option>
                        {getAllParts().map(part => (
                          <option key={part} value={part}>
                            {part}
                          </option>
                        ))}
                      </select>
                      <select
                        value={row.section}
                        onChange={e =>
                          handleCompositeIdRowChange(block.blockNumber, row.id, 'section', e.target.value)
                        }
                        disabled={disabled || !row.part || loadingStates[`part:${row.part}`]}
                        className={selectCls}
                        style={selectStyle}
                      >
                        <option value="">Select Section</option>
                        <option value="ANY">ANY</option>
                        {loadingStates[`part:${row.part}`] ? (
                          <option value="">Loading...</option>
                        ) : (
                          getSectionsForPart(row.part).map(section => (
                            <option key={section} value={section}>
                              {section}
                            </option>
                          ))
                        )}
                      </select>
                      <select
                        value={row.group}
                        onChange={e => handleCompositeIdRowChange(block.blockNumber, row.id, 'group', e.target.value)}
                        disabled={
                          disabled ||
                          !row.part ||
                          !row.section ||
                          row.section === 'ANY' ||
                          loadingStates[`part:${row.part}|section:${row.section}`]
                        }
                        className={selectCls}
                        style={selectStyle}
                      >
                        <option value="">Select Group</option>
                        <option value="ANY">ANY</option>
                        {loadingStates[`part:${row.part}|section:${row.section}`] ? (
                          <option value="">Loading...</option>
                        ) : (
                          getGroupsForPartAndSection(row.part, row.section).map(group => (
                            <option key={group} value={group}>
                              {group}
                            </option>
                          ))
                        )}
                      </select>
                      <select
                        value={row.variableId}
                        onChange={e =>
                          handleCompositeIdRowChange(block.blockNumber, row.id, 'variableId', e.target.value)
                        }
                        disabled={
                          disabled ||
                          !row.part ||
                          !row.section ||
                          !row.group ||
                          row.section === 'ANY' ||
                          (row.group !== 'ANY' &&
                            loadingStates[`part:${row.part}|section:${row.section}|group:${row.group}`])
                        }
                        className={selectCls}
                        style={selectStyle}
                      >
                        <option value="">Select Variable</option>
                        <option value="ANY">ANY</option>
                        {row.group !== 'ANY' &&
                        loadingStates[`part:${row.part}|section:${row.section}|group:${row.group}`] ? (
                          <option value="">Loading...</option>
                        ) : row.group !== 'ANY' ? (
                          variableOptions.map(v => (
                            <option key={v.id} value={v.id}>
                              {v.name}
                            </option>
                          ))
                        ) : null}
                      </select>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }
);
