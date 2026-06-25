import React, { useState, useEffect, useRef } from 'react';
import { X, Save, Link, Upload, ArrowUpAZ, Plus, Trash2 } from 'lucide-react';
import { apiService } from '../services/api';
import type { ObjectData } from '../data/mockData';
import { CsvUploadModal } from './CsvUploadModal';
import { RelationshipCustomSortModal } from './RelationshipCustomSortModal';

interface VariableObjectRelationshipModalProps {
  isOpen: boolean;
  onClose: () => void;
  selectedVariable: any; // For single-variable mode (backward compatibility)
  selectedVariables?: any[]; // For bulk mode (multiple variables)
  allObjects: ObjectData[];
  onSave?: () => void; // Callback to refresh main data
  onRelationshipsChange?: (relationships: any[]) => void; // Callback to store relationships for temporary/cloned variables
  initialCsvData?: any[] | null; // CSV data to process when modal opens
  isBulkMode?: boolean; // Flag to indicate bulk edit mode
  previewMode?: boolean; // If true, don't create relationships - just store selections via onSelectionChange
  onSelectionChange?: (selectedObjectIds: string[]) => void; // Callback to store selected object IDs (for preview mode)
  initialSelectedObjectIds?: string[]; // Optional preselected object IDs (used by add-variable preview mode)
  objectsOrderSortOrder?: {
    beingOrder: string[];
    avatarOrders: Record<string, string[]>;
    objectOrders: Record<string, string[]>;
  };
  isObjectsOrderEnabled?: boolean;
}

// Grid-based relevance rows (Being / Avatar / Object only).
interface RelevanceGridRow {
  id: string;
  being: string;
  avatar: string;
  object: string;
}

export const VariableObjectRelationshipModal: React.FC<VariableObjectRelationshipModalProps> = ({
  isOpen,
  onClose,
  selectedVariable,
  selectedVariables = [],
  allObjects,
  onSave,
  onRelationshipsChange,
  initialCsvData,
  isBulkMode = false,
  previewMode = false,
  onSelectionChange,
  initialSelectedObjectIds,
}) => {
  const sourceVariables = isBulkMode && selectedVariables.length > 0
    ? selectedVariables
    : selectedVariable
      ? [selectedVariable]
      : [];

  const [relevanceRows, setRelevanceRows] = useState<RelevanceGridRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [isCsvUploadOpen, setIsCsvUploadOpen] = useState(false);
  const [isCustomSortOpen, setIsCustomSortOpen] = useState(false);
  const [customSortRules, setCustomSortRules] = useState<Array<{
    id: string;
    column: string;
    sortOn: string;
    order: 'asc' | 'desc';
  }>>([]);

  const isInitializingRef = useRef(false);

  const distinctBeings = Array.from(new Set(allObjects.map(obj => obj.being).filter(Boolean))).sort();

  const getAvatarsForBeing = (being: string): string[] => {
    if (!being) return [];
    return Array.from(new Set(
      allObjects.filter(obj => obj.being === being).map(obj => obj.avatar).filter(Boolean)
    )).sort();
  };

  const getObjectsForBeingAndAvatar = (being: string, avatar: string): string[] => {
    if (!being || !avatar) return [];
    return Array.from(new Set(
      allObjects.filter(obj => obj.being === being && obj.avatar === avatar).map(obj => obj.object).filter(Boolean)
    )).sort();
  };

  // Expand a Being/Avatar/Object selection to every matching object. A partial selection
  // (e.g. only Being, or Being+Avatar) matches ALL objects under it.
  const findRelevanceMatchingObjects = (being: string, avatar: string, object: string): ObjectData[] => {
    if (!being) return [];
    return allObjects.filter(obj =>
      obj.being === being &&
      (!avatar || obj.avatar === avatar) &&
      (!object || obj.object === object)
    );
  };

  // Union of object IDs across all (non-empty) rows.
  const expandRowsToObjectIds = (rows: RelevanceGridRow[]): string[] => {
    const ids = new Set<string>();
    for (const row of rows) {
      if (!row.being) continue;
      for (const obj of findRelevanceMatchingObjects(row.being, row.avatar, row.object)) {
        if (obj.id) ids.add(obj.id);
      }
    }
    return Array.from(ids);
  };

  // Build one row per object id (deduped by Being/Avatar/Object combination).
  const buildRowsFromObjectIds = (ids: string[]): RelevanceGridRow[] => {
    const seen = new Set<string>();
    const rows: RelevanceGridRow[] = [];
    for (const id of ids) {
      const obj = allObjects.find(o => o.id === id);
      if (!obj) continue;
      const key = `${obj.being}|${obj.avatar}|${obj.object}`;
      if (seen.has(key)) continue;
      seen.add(key);
      rows.push({
        id: `row-${Date.now()}-${Math.random()}`,
        being: obj.being || '',
        avatar: obj.avatar || '',
        object: obj.object || '',
      });
    }
    return rows;
  };

  // Build rows from existing HAS_SPECIFIC_VARIABLE relationships.
  const buildRowsFromRelationships = (relationships: any[]): RelevanceGridRow[] => {
    const seen = new Set<string>();
    const rows: RelevanceGridRow[] = [];
    for (const rel of relationships) {
      if (rel.relationshipType && rel.relationshipType !== 'HAS_SPECIFIC_VARIABLE') continue;
      const being = rel.toBeing || '';
      const avatar = rel.toAvatar || '';
      const object = rel.toObject || '';
      if (!being) continue;
      const key = `${being}|${avatar}|${object}`;
      if (seen.has(key)) continue;
      seen.add(key);
      rows.push({ id: `row-${Date.now()}-${Math.random()}`, being, avatar, object });
    }
    return rows;
  };

  useEffect(() => {
    if (isOpen && sourceVariables.length > 0 && allObjects.length > 0) {
      void initializeRows().then(() => {
        if (initialCsvData && initialCsvData.length > 0) {
          setTimeout(() => handleCsvUpload(initialCsvData), 100);
        }
      });
    }
    if (!isOpen) {
      setRelevanceRows([]);
      setCustomSortRules([]);
      isInitializingRef.current = false;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, sourceVariables.length, allObjects.length, initialSelectedObjectIds]);

  const initializeRows = async () => {
    if (sourceVariables.length === 0) return;
    if (isInitializingRef.current) return;
    isInitializingRef.current = true;
    setLoading(true);
    try {
      // Preview mode (new variable not yet in Neo4j): default to NONE unless explicit selections.
      if (previewMode) {
        const ids = initialSelectedObjectIds && initialSelectedObjectIds.length > 0
          ? initialSelectedObjectIds
          : [];
        setRelevanceRows(buildRowsFromObjectIds(ids));
        return;
      }

      // Bulk mode: rows define what to ADD to every selected variable; start empty.
      if (isBulkMode) {
        setRelevanceRows([]);
        return;
      }

      // Single mode.
      const variable = sourceVariables[0];
      const isClonedVariable = variable._isCloned && !variable._isSaved;
      let existing: any[] = [];
      if (isClonedVariable) {
        existing = variable.objectRelationshipsList || [];
      } else {
        const resp = await apiService.getVariableObjectRelationships(variable.id) as any;
        existing = resp.relationships || [];
      }
      setRelevanceRows(buildRowsFromRelationships(existing));
    } catch (error) {
      console.error('Failed to load existing relevance:', error);
      setRelevanceRows([]);
    } finally {
      setLoading(false);
      isInitializingRef.current = false;
    }
  };

  const isRowDuplicate = (being: string, avatar: string, object: string, excludeRowId?: string): boolean => {
    return relevanceRows.some(row => {
      if (excludeRowId && row.id === excludeRowId) return false;
      return row.being === being && row.avatar === avatar && row.object === object;
    });
  };

  const handleAddRow = () => {
    setRelevanceRows(prev => [...prev, { id: `row-${Date.now()}-${Math.random()}`, being: '', avatar: '', object: '' }]);
  };

  const handleRemoveRow = (rowId: string) => {
    setRelevanceRows(prev => prev.filter(r => r.id !== rowId));
  };

  const handleRowFieldChange = (rowId: string, field: keyof RelevanceGridRow, value: string) => {
    setRelevanceRows(prev => prev.map(row => {
      if (row.id !== rowId) return row;
      const updated = { ...row, [field]: value };
      if (field === 'being') {
        updated.avatar = '';
        updated.object = '';
      }
      if (field === 'avatar') {
        updated.object = '';
      }
      if (['being', 'avatar', 'object'].includes(field) && updated.being) {
        if (isRowDuplicate(updated.being, updated.avatar, updated.object, rowId)) {
          setTimeout(() => {
            alert('A row with this Being / Avatar / Object combination already exists. Please use a different combination or edit the existing row.');
          }, 100);
          return row;
        }
      }
      return updated;
    }));
  };

  const handleCsvUpload = (csvData: any[]) => {
    const errors: string[] = [];
    const newRows: RelevanceGridRow[] = [];
    const seen = new Set(relevanceRows.map(r => `${r.being}|${r.avatar}|${r.object}`));

    csvData.forEach((row, index) => {
      const being = row.Being || row.being || '';
      const avatar = row.Avatar || row.avatar || '';
      const object = row.Object || row.object || '';

      const matchingObject = allObjects.find(obj =>
        obj.being === being && obj.avatar === avatar && obj.object === object
      );

      if (!matchingObject) {
        const vals = [being, avatar, object].filter(Boolean).join(' - ');
        errors.push(`Row ${index + 1}: No matching object found for [${vals}].`);
        return;
      }
      const key = `${being}|${avatar}|${object}`;
      if (seen.has(key)) {
        errors.push(`Row ${index + 1}: Duplicate entry [${being} - ${avatar} - ${object}]; skipped.`);
        return;
      }
      seen.add(key);
      newRows.push({ id: `row-${Date.now()}-${Math.random()}`, being, avatar, object });
    });

    if (newRows.length > 0) {
      setRelevanceRows(prev => [...prev, ...newRows]);
    }

    if (errors.length > 0) {
      alert(`Upload completed with ${errors.length} error(s):\n\n${errors.slice(0, 10).join('\n')}${errors.length > 10 ? `\n... and ${errors.length - 10} more errors` : ''}`);
    } else {
      alert(`Added ${newRows.length} relevance row(s) from CSV.`);
    }
  };

  const handleSave = async () => {
    if (sourceVariables.length === 0) return;

    const desiredIds = expandRowsToObjectIds(relevanceRows);

    // PREVIEW MODE: just store the selected object IDs.
    if (previewMode && onSelectionChange) {
      onSelectionChange(desiredIds);
      alert('Object selections saved. Relevance will be created when you save the variable.');
      onClose();
      return;
    }

    // CLONED UNSAVED VARIABLE: store relationships locally.
    const isClonedVariable = sourceVariables.length === 1 &&
      sourceVariables[0]._isCloned && !sourceVariables[0]._isSaved;
    if (isClonedVariable && onRelationshipsChange) {
      const relationshipsToStore = desiredIds.map(id => {
        const obj = allObjects.find(o => o.id === id);
        return {
          id: Date.now().toString() + Math.random(),
          toBeing: obj?.being || 'ALL',
          toAvatar: obj?.avatar || 'ALL',
          toObject: obj?.object || 'ALL',
          relationshipType: 'HAS_SPECIFIC_VARIABLE',
        };
      });
      onRelationshipsChange(relationshipsToStore);
      alert('Relevance configured successfully! It will be created when you save the variable.');
      onClose();
      return;
    }

    setSaving(true);
    try {
      if (isBulkMode) {
        if (desiredIds.length === 0) {
          alert('Please add at least one Being / Avatar / Object row to create relevance.');
          setSaving(false);
          return;
        }
        const relationshipsToCreate: Array<{ variableId: string; objectId: string; object: ObjectData }> = [];
        for (const variable of sourceVariables) {
          const resp = await apiService.getVariableObjectRelationships(variable.id) as any;
          const existingList = resp.relationships || [];
          const existingKeys = new Set(
            existingList
              .filter((rel: any) => rel.relationshipType === 'HAS_SPECIFIC_VARIABLE')
              .map((rel: any) => `${rel.toBeing}::${rel.toAvatar}::${rel.toObject}`)
          );
          for (const objectId of desiredIds) {
            const obj = allObjects.find(o => o.id === objectId);
            if (!obj) continue;
            const key = `${obj.being}::${obj.avatar}::${obj.object}`;
            if (existingKeys.has(key)) continue;
            existingKeys.add(key);
            relationshipsToCreate.push({ variableId: variable.id, objectId, object: obj });
          }
        }
        if (relationshipsToCreate.length > 0) {
          try {
            await apiService.bulkCreateVariableObjectRelationships(relationshipsToCreate);
          } catch (error: any) {
            if (error.message?.includes('404') || error.message?.includes('not found')) {
              for (const rel of relationshipsToCreate) {
                try {
                  await apiService.createVariableObjectRelationship(rel.variableId, {
                    relationshipType: 'HAS_SPECIFIC_VARIABLE',
                    toSector: rel.object.sector || '',
                    toDomain: rel.object.domain || '',
                    toCountry: rel.object.country || '',
                    toObjectClarifier: (rel.object as any).classifier || '',
                    toBeing: rel.object.being,
                    toAvatar: rel.object.avatar,
                    toObject: rel.object.object,
                  });
                } catch (err: any) {
                  if (!(err.message?.includes('Duplicate') || err.message?.includes('already exists'))) throw err;
                }
              }
            } else {
              throw error;
            }
          }
        }
        if (onSave) await onSave();
        alert(`Relevance created for ${sourceVariables.length} variable(s).`);
        onClose();
        return;
      }

      // SINGLE MODE: diff desired vs existing; create added, delete removed.
      const variable = sourceVariables[0];
      const resp = await apiService.getVariableObjectRelationships(variable.id) as any;
      const existingList = resp.relationships || [];

      // Remove legacy HAS_VARIABLE "relevant to all" edge if present.
      if (existingList.some((rel: any) => rel.relationshipType === 'HAS_VARIABLE')) {
        try {
          await apiService.deleteVariableObjectRelationship(variable.id, {
            relationshipType: 'HAS_VARIABLE',
            toSector: 'ALL', toDomain: 'ALL', toCountry: 'ALL', toObjectClarifier: '',
            toBeing: 'ALL', toAvatar: 'ALL', toObject: 'ALL',
          });
        } catch (error) {
          console.error('Failed to delete legacy HAS_VARIABLE relationship:', error);
        }
      }

      const desiredKeys = new Set(
        desiredIds.map(id => {
          const obj = allObjects.find(o => o.id === id);
          return obj ? `${obj.being}::${obj.avatar}::${obj.object}` : null;
        }).filter(Boolean) as string[]
      );

      // Existing specific relevance by object key.
      const existingByKey = new Map<string, ObjectData>();
      for (const rel of existingList) {
        if (rel.relationshipType !== 'HAS_SPECIFIC_VARIABLE') continue;
        const obj = allObjects.find(o => o.being === rel.toBeing && o.avatar === rel.toAvatar && o.object === rel.toObject);
        if (obj) existingByKey.set(`${rel.toBeing}::${rel.toAvatar}::${rel.toObject}`, obj);
      }

      // Delete those no longer desired.
      for (const [key, obj] of existingByKey.entries()) {
        if (desiredKeys.has(key)) continue;
        try {
          await apiService.deleteVariableObjectRelationship(variable.id, {
            relationshipType: 'HAS_SPECIFIC_VARIABLE',
            toSector: obj.sector || '', toDomain: obj.domain || '', toCountry: obj.country || '',
            toObjectClarifier: (obj as any).classifier || '',
            toBeing: obj.being, toAvatar: obj.avatar, toObject: obj.object,
          });
        } catch (error) {
          console.error(`Failed to delete relevance for ${obj.object}:`, error);
        }
      }

      // Create newly desired.
      for (const id of desiredIds) {
        const obj = allObjects.find(o => o.id === id);
        if (!obj) continue;
        const key = `${obj.being}::${obj.avatar}::${obj.object}`;
        if (existingByKey.has(key)) continue;
        try {
          await apiService.createVariableObjectRelationship(variable.id, {
            relationshipType: 'HAS_SPECIFIC_VARIABLE',
            toSector: obj.sector || '', toDomain: obj.domain || '', toCountry: obj.country || '',
            toObjectClarifier: (obj as any).classifier || '',
            toBeing: obj.being, toAvatar: obj.avatar, toObject: obj.object,
          });
        } catch (error: any) {
          console.error(`Failed to create relevance for ${obj.object}:`, error);
          alert(`Failed to create relevance for ${obj.object}: ${error?.message || 'Unknown error'}`);
        }
      }

      if (onSave) await onSave();
      alert('Relevance updated successfully.');
      onClose();
    } catch (error) {
      console.error('Failed to save relevance:', error);
      alert('Failed to save relevance. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  const handleClose = () => {
    setRelevanceRows([]);
    onClose();
  };

  if (!isOpen || sourceVariables.length === 0) return null;

  // Display order: apply custom sort rules (Being/Avatar/Object) to a copy of the rows.
  let displayRows = relevanceRows;
  if (customSortRules.some(r => r.column)) {
    displayRows = [...relevanceRows].sort((a, b) => {
      for (const rule of customSortRules) {
        if (!rule.column || !['being', 'avatar', 'object'].includes(rule.column)) continue;
        const aVal = String((a as any)[rule.column] || '').toLowerCase();
        const bVal = String((b as any)[rule.column] || '').toLowerCase();
        let cmp = aVal.localeCompare(bVal);
        if (rule.order === 'desc') cmp = -cmp;
        if (cmp !== 0) return cmp;
      }
      return 0;
    });
  }

  return (
    <>
      <div className="fixed inset-0 bg-black bg-opacity-70 flex items-center justify-center z-[100]">
        <div className="bg-ag-dark-surface rounded-lg border border-ag-dark-border w-[99vw] h-[90vh] max-w-[120rem] flex flex-col">
          {/* Header */}
          <div className="flex items-center justify-between p-6 border-b border-ag-dark-border">
            <div className="flex items-center gap-3">
              <Link className="w-5 h-5 text-ag-dark-text-secondary" />
              <h2 className="text-xl font-semibold text-ag-dark-text">
                {isBulkMode
                  ? `Configuring Relevance (${sourceVariables.length} variables)`
                  : 'Configuring Relevance'}
              </h2>
              <button
                onClick={() => setIsCustomSortOpen(true)}
                className="px-3 py-1.5 text-sm border border-ag-dark-border rounded bg-ag-dark-bg text-ag-dark-text hover:bg-ag-dark-surface transition-colors flex items-center gap-2"
                title="Custom Sort"
              >
                <ArrowUpAZ className="w-4 h-4" />
                Custom Sort
              </button>
            </div>
            <div className="flex items-center gap-3">
              <button
                onClick={() => setIsCsvUploadOpen(true)}
                className="px-3 py-1.5 text-sm border border-ag-dark-border rounded bg-ag-dark-bg text-ag-dark-text hover:bg-ag-dark-surface transition-colors flex items-center gap-2"
                title="Upload Relevance CSV"
              >
                <Upload className="w-4 h-4" />
                Upload CSV
              </button>
              <button
                onClick={handleClose}
                className="text-ag-dark-text-secondary hover:text-ag-dark-text transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>

          {/* Content */}
          <div className="flex-1 p-6 overflow-y-auto">
            {loading ? (
              <div className="flex items-center justify-center h-full">
                <div className="text-ag-dark-text-secondary">Loading relevance...</div>
              </div>
            ) : (
              <div className="h-full bg-ag-dark-bg rounded-lg border border-ag-dark-border overflow-y-auto">
                <div className="p-4">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-lg font-semibold text-ag-dark-text">Relevant Objects</h3>
                    <button
                      onClick={handleAddRow}
                      className="px-3 py-2 bg-ag-dark-accent text-white rounded hover:bg-ag-dark-accent-hover transition-colors flex items-center gap-2"
                    >
                      <Plus className="w-4 h-4" />
                      Add Row
                    </button>
                  </div>

                  <div className="overflow-x-auto">
                    <table className="w-full border-collapse">
                      <thead>
                        <tr className="border-b border-ag-dark-border">
                          <th className="px-3 py-2 text-left text-sm font-medium text-ag-dark-text bg-ag-dark-surface" style={{ width: '300px' }}>Being</th>
                          <th className="px-3 py-2 text-left text-sm font-medium text-ag-dark-text bg-ag-dark-surface" style={{ width: '300px' }}>Avatar</th>
                          <th className="px-3 py-2 text-left text-sm font-medium text-ag-dark-text bg-ag-dark-surface" style={{ width: '300px' }}>Object</th>
                          <th className="px-3 py-2 text-left text-sm font-medium text-ag-dark-text bg-ag-dark-surface">Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {displayRows.length === 0 ? (
                          <tr>
                            <td colSpan={4} className="px-3 py-8 text-center text-ag-dark-text-secondary">
                              Add the objects this variable is relevant to. Selecting only a Being (or Being + Avatar) makes it relevant to every matching object. Click "Add Row" to start.
                            </td>
                          </tr>
                        ) : (
                          displayRows.map((row) => (
                            <tr key={row.id} className="border-b border-ag-dark-border hover:bg-ag-dark-surface">
                              {/* Being */}
                              <td className="px-3 py-2" style={{ width: '300px' }}>
                                <select
                                  value={row.being}
                                  onChange={(e) => handleRowFieldChange(row.id, 'being', e.target.value)}
                                  className="w-full px-2 py-1 text-sm bg-ag-dark-bg border border-ag-dark-border rounded text-ag-dark-text focus:ring-2 focus:ring-ag-dark-accent"
                                >
                                  <option value="">Select Being</option>
                                  {distinctBeings.map(b => (
                                    <option key={b} value={b}>{b}</option>
                                  ))}
                                </select>
                              </td>

                              {/* Avatar */}
                              <td className="px-3 py-2" style={{ width: '300px' }}>
                                <select
                                  value={row.avatar}
                                  onChange={(e) => handleRowFieldChange(row.id, 'avatar', e.target.value)}
                                  disabled={!row.being}
                                  className={`w-full px-2 py-1 text-sm bg-ag-dark-bg border border-ag-dark-border rounded text-ag-dark-text focus:ring-2 focus:ring-ag-dark-accent ${!row.being ? 'opacity-50 cursor-not-allowed' : ''}`}
                                >
                                  <option value="">{row.being ? 'All Avatars' : 'Select Being first'}</option>
                                  {row.being && getAvatarsForBeing(row.being).map(a => (
                                    <option key={a} value={a}>{a}</option>
                                  ))}
                                </select>
                              </td>

                              {/* Object */}
                              <td className="px-3 py-2" style={{ width: '300px' }}>
                                <select
                                  value={row.object}
                                  onChange={(e) => handleRowFieldChange(row.id, 'object', e.target.value)}
                                  disabled={!row.being || !row.avatar}
                                  className={`w-full px-2 py-1 text-sm bg-ag-dark-bg border border-ag-dark-border rounded text-ag-dark-text focus:ring-2 focus:ring-ag-dark-accent ${!row.being || !row.avatar ? 'opacity-50 cursor-not-allowed' : ''}`}
                                >
                                  <option value="">{row.being && row.avatar ? 'All Objects' : 'Select Avatar first'}</option>
                                  {row.being && row.avatar && getObjectsForBeingAndAvatar(row.being, row.avatar).map(o => (
                                    <option key={o} value={o}>{o}</option>
                                  ))}
                                </select>
                              </td>

                              {/* Actions */}
                              <td className="px-3 py-2">
                                <button
                                  onClick={() => handleRemoveRow(row.id)}
                                  className="p-1 text-red-400 hover:text-red-300 transition-colors"
                                  title="Remove row"
                                >
                                  <Trash2 className="w-4 h-4" />
                                </button>
                              </td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="flex items-center justify-end gap-3 p-6 border-t border-ag-dark-border">
            <button
              onClick={handleClose}
              className="px-4 py-2 border border-ag-dark-border rounded text-ag-dark-text hover:bg-ag-dark-bg transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              disabled={saving}
              className="px-4 py-2 bg-ag-dark-accent text-white rounded hover:bg-ag-dark-accent-hover transition-colors flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Save className="w-4 h-4" />
              {saving ? 'Saving...' : 'Save Changes'}
            </button>
          </div>
        </div>
      </div>

      {/* CSV Upload Modal */}
      <CsvUploadModal
        isOpen={isCsvUploadOpen}
        onClose={() => setIsCsvUploadOpen(false)}
        type="variable-object-relationships"
        onUpload={handleCsvUpload}
      />

      {/* Custom Sort Modal */}
      <RelationshipCustomSortModal
        isOpen={isCustomSortOpen}
        onClose={() => setIsCustomSortOpen(false)}
        onApplySort={(sortRules) => {
          setCustomSortRules(sortRules);
        }}
        currentSortRules={customSortRules}
        isDefaultOrderEnabled={false}
        onDefaultOrderToggle={() => {}}
      />
    </>
  );
};
