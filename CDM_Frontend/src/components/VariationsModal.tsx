import React, { useState, useRef, useEffect } from 'react';
import { X, Save, ArrowUpAZ, ArrowDownZA, Upload } from 'lucide-react';
import { CsvUploadModal } from './CsvUploadModal';
import { apiService } from '../services/api';
import type { VariableData } from '../data/variablesData';

interface VariationsModalProps {
  isOpen: boolean;
  onClose: () => void;
  selectedVariable?: VariableData | null; // For single-variable mode
  selectedVariables?: VariableData[]; // For bulk mode
  initialVariationsText?: string; // Initial variations text (for single variable)
  onSave?: () => void; // Callback to refresh main data
  onVariationsChange?: (variations: string[]) => void; // Callback to store variations for temporary variables
  isBulkMode?: boolean; // Flag to indicate bulk edit mode
}

export const VariationsModal: React.FC<VariationsModalProps> = ({
  isOpen,
  onClose,
  selectedVariable,
  selectedVariables = [],
  initialVariationsText = '',
  onSave,
  onVariationsChange,
  isBulkMode = false
}) => {
  // Determine source variables: use selectedVariables if provided (bulk mode), otherwise use selectedVariable (single mode)
  const sourceVariables = isBulkMode && selectedVariables.length > 0 
    ? selectedVariables 
    : selectedVariable 
      ? [selectedVariable] 
      : [];

  const [variationsText, setVariationsText] = useState(initialVariationsText);
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isVariationUploadOpen, setIsVariationUploadOpen] = useState(false);
  const variationsTextareaRef = useRef<HTMLTextAreaElement>(null);
  const isTextareaFocusedRef = useRef(false);
  const lastChangeTimeRef = useRef(0);

  // Load variations when modal opens or selectedVariable changes
  useEffect(() => {
    if (isOpen && !isBulkMode && selectedVariable?.id && !selectedVariable?._isCloned) {
      setIsLoading(true);
      const loadVariations = async () => {
        try {
          // If variable has variationsList, use it directly
          if (selectedVariable?.variationsList && Array.isArray(selectedVariable.variationsList) && selectedVariable.variationsList.length > 0) {
            const variationsTextContent = selectedVariable.variationsList.map((v: any) => typeof v === 'string' ? v : v.name).join('\n');
            setVariationsText(variationsTextContent);
            setIsLoading(false);
            return;
          }
          
          // Otherwise fetch from API
          const variationData = await apiService.getVariableVariations(selectedVariable.id);
          const variationsList = variationData?.variationsList || [];
          const variationsTextContent = variationsList.map((v: any) => v.name).join('\n');
          setVariationsText(variationsTextContent);
        } catch (error) {
          console.error('Failed to load variations:', error);
          setVariationsText('');
        } finally {
          setIsLoading(false);
        }
      };
      loadVariations();
    } else if (isOpen && isBulkMode) {
      // Bulk mode: start with empty text
      setVariationsText('');
    } else if (isOpen && initialVariationsText) {
      // Use provided initial text (for cloned variables)
      setVariationsText(initialVariationsText);
    }
  }, [isOpen, selectedVariable?.id, selectedVariable?.variationsList, isBulkMode, initialVariationsText]);

  // Focus textarea when modal opens
  useEffect(() => {
    if (isOpen && variationsTextareaRef.current) {
      setTimeout(() => {
        variationsTextareaRef.current?.focus();
      }, 100);
    }
  }, [isOpen]);

  const handleSortVariations = (direction: 'asc' | 'desc') => {
    const lines = variationsText.split('\n').filter(line => line.trim() !== '');
    const sortedLines = [...lines].sort((a, b) => {
      const aTrimmed = a.trim().toLowerCase();
      const bTrimmed = b.trim().toLowerCase();
      if (direction === 'asc') {
        return aTrimmed.localeCompare(bTrimmed);
      } else {
        return bTrimmed.localeCompare(aTrimmed);
      }
    });
    setVariationsText(sortedLines.join('\n') + (variationsText.endsWith('\n') ? '\n' : ''));
  };

  const handleVariationCsvUpload = async (data: any[] | File) => {
    // Check if it's a File (new API-based upload) or array (old client-side parsing)
    if (data instanceof File) {
      // For bulk mode, we can't use API upload directly - need to parse and append
      if (isBulkMode) {
        const reader = new FileReader();
        reader.onload = (e) => {
          let csv = e.target?.result as string;
          if (csv.charCodeAt(0) === 0xFEFF) {
            csv = csv.slice(1);
          }
          const lines = csv.split('\n').filter(line => line.trim());
          if (lines.length < 2) {
            alert('CSV must contain at least a header row and one data row');
            return;
          }
          const dataRows = lines.slice(1);
          const parsedVariations: string[] = [];
          dataRows.forEach((line) => {
            let values = line.split(',').map(val => val.trim().replace(/"/g, ''));
            if (values.length === 1 && line.includes(';')) {
              values = line.split(';').map(val => val.trim().replace(/"/g, ''));
            }
            if (values.length === 1 && line.includes('\t')) {
              values = line.split('\t').map(val => val.trim().replace(/"/g, ''));
            }
            if (values.length >= 1 && values[0]) {
              parsedVariations.push(values[0]);
            }
          });
          
          // Append to existing text
          const existingNames = new Set(variationsText.split('\n').filter(line => line.trim()).map(name => name.toLowerCase()));
          const newVariations = parsedVariations.filter(name => !existingNames.has(name.toLowerCase()));
          
          if (newVariations.length < parsedVariations.length) {
            const skippedCount = parsedVariations.length - newVariations.length;
            alert(`Uploaded ${newVariations.length} new variations. Skipped ${skippedCount} duplicates.`);
          }
          
          const newLines = newVariations.join('\n');
          setVariationsText(prev => prev ? `${prev}\n${newLines}` : newLines);
        };
        reader.readAsText(data);
      } else if (selectedVariable?.id) {
        // Single variable mode: use API upload
        try {
          const result = await apiService.bulkUploadVariations(selectedVariable.id, data);
          const response = result as any;
          alert(response.message || `Successfully uploaded ${response.created_count} variations`);
          
          // Refresh the variations list
          try {
            const variationData = await apiService.getVariableVariations(selectedVariable.id);
            const variationsList = variationData?.variationsList || [];
            const variationsTextContent = variationsList.map((v: any) => v.name).join('\n');
            setVariationsText(variationsTextContent);
          } catch (error) {
            console.error('Failed to refresh variations after upload:', error);
          }
        } catch (error) {
          console.error('Bulk variations upload failed:', error);
          alert(`Variations upload failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
      }
    } else {
      // Old client-side parsing logic - append to textarea
      const existingNames = new Set(variationsText.split('\n').filter(line => line.trim()).map(name => name.toLowerCase()));
      const newVariations = data.filter((variation: any) => 
        !existingNames.has(variation.name.toLowerCase())
      );
      
      if (newVariations.length < data.length) {
        const skippedCount = data.length - newVariations.length;
        alert(`Uploaded ${newVariations.length} new variations. Skipped ${skippedCount} duplicates.`);
      }
      
      // Append new variations to textarea
      const newLines = newVariations.map((v: any) => v.name).join('\n');
      setVariationsText(prev => prev ? `${prev}\n${newLines}` : newLines);
    }
  };

  const handleSave = async () => {
    if (isSaving) return;

    // Convert multiline text to variations array
    const variationsList = variationsText
      .split('\n')
      .map(line => line.trim())
      .filter(line => line.length > 0);

    // Check for duplicate variation names (case-insensitive) - same variable cannot have duplicates
    const uniqueVariationNames = new Set(variationsList.map(v => v.toLowerCase()));
    
    if (variationsList.length !== uniqueVariationNames.size) {
      const duplicateNames = variationsList.filter((variation, index) => 
        variationsList.findIndex(v => v.toLowerCase() === variation.toLowerCase()) !== index
      ).map(v => v);
      
      alert(`Cannot save: Duplicate variation names found: ${duplicateNames.join(', ')}. Please remove duplicates before saving.`);
      return;
    }

    setIsSaving(true);

    try {
      if (isBulkMode && selectedVariables.length > 0) {
        // Bulk mode: append variations to each selected variable
        for (const variable of selectedVariables) {
          if (!variable.id || variable._isCloned) continue; // Skip cloned unsaved variables
          
          // Get existing variations for this variable
          let existingVariations: string[] = [];
          try {
            if (variable.variationsList && Array.isArray(variable.variationsList)) {
              existingVariations = variable.variationsList.map((v: any) => typeof v === 'string' ? v : v.name);
            } else {
              const variationData = await apiService.getVariableVariations(variable.id);
              existingVariations = (variationData?.variationsList || []).map((v: any) => v.name);
            }
          } catch (error) {
            console.error(`Failed to load existing variations for variable ${variable.id}:`, error);
          }

          // Combine existing and new variations, removing duplicates
          const allVariations = [...new Set([...existingVariations, ...variationsList])];
          
          // Save all variations for this variable
          // Convert string array to array of objects with 'name' property
          const variationsArray = allVariations.map(name => ({ name }));
          await apiService.updateVariable(variable.id, {
            variationsList: variationsArray
          });
        }
        
        alert(`Successfully added variations to ${selectedVariables.length} variable(s).`);
      } else if (selectedVariable) {
        // Single variable mode
        if (selectedVariable._isCloned && !selectedVariable._isSaved) {
          // For cloned unsaved variables, just store variations in callback
          if (onVariationsChange) {
            onVariationsChange(variationsList);
          }
        } else if (selectedVariable.id) {
          // Save to backend
          // Convert string array to array of objects with 'name' property
          const variationsArray = variationsList.map(name => ({ name }));
          await apiService.updateVariable(selectedVariable.id, {
            variationsList: variationsArray
          });
        } else {
          // For new variables that don't exist yet (AddVariablePanel), store in callback
          if (onVariationsChange) {
            onVariationsChange(variationsList);
          }
        }
      } else if (!isBulkMode && onVariationsChange) {
        // No selected variable but not bulk mode (e.g., AddVariablePanel before variable is created)
        // Store variations in callback
        onVariationsChange(variationsList);
      } else if (!isBulkMode && !selectedVariable) {
        // No variable and no callback - this shouldn't happen, but handle gracefully
        console.warn('VariationsModal: No variable selected and no onVariationsChange callback provided');
      }

      // Call onSave callback to refresh data
      if (onSave) {
        onSave();
      }

      onClose();
    } catch (error) {
      console.error('Failed to save variations:', error);
      alert(`Failed to save variations: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setIsSaving(false);
    }
  };

  if (!isOpen) return null;

  const hasVariations = variationsText.trim().length > 0;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[100]">
      <div className="bg-ag-dark-surface border border-ag-dark-border rounded-xl p-6 max-w-4xl w-full mx-4 shadow-2xl max-h-[95vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-ag-dark-text">
            {isBulkMode ? `Variations (${selectedVariables.length} variables)` : 'Variations'}
          </h3>
          <button
            onClick={onClose}
            className="text-ag-dark-text-secondary hover:text-ag-dark-text transition-colors"
            disabled={isSaving}
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Actions Bar */}
        <div className="flex items-center justify-between mb-4 pb-4 border-b border-ag-dark-border">
          <div className="flex items-center gap-2">
            <button
              onClick={() => handleSortVariations('asc')}
              disabled={!hasVariations || isSaving}
              className={`p-1.5 text-ag-dark-text-secondary hover:text-ag-dark-accent transition-colors rounded ${
                !hasVariations || isSaving ? 'opacity-50 cursor-not-allowed' : 'hover:bg-ag-dark-bg'
              }`}
              title="Sort A-Z"
            >
              <ArrowUpAZ className="w-5 h-5" />
            </button>
            <button
              onClick={() => handleSortVariations('desc')}
              disabled={!hasVariations || isSaving}
              className={`p-1.5 text-ag-dark-text-secondary hover:text-ag-dark-accent transition-colors rounded ${
                !hasVariations || isSaving ? 'opacity-50 cursor-not-allowed' : 'hover:bg-ag-dark-bg'
              }`}
              title="Sort Z-A"
            >
              <ArrowDownZA className="w-5 h-5" />
            </button>
            <button
              onClick={() => setIsVariationUploadOpen(true)}
              disabled={isSaving}
              className={`text-ag-dark-text-secondary hover:text-ag-dark-accent transition-colors ${
                isSaving ? 'opacity-50 cursor-not-allowed' : ''
              }`}
              title="Upload Variations CSV"
            >
              <Upload className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Textarea */}
        <div className="flex-1 overflow-hidden flex flex-col mb-4 min-h-[500px]">
          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <div className="text-ag-dark-text-secondary">Loading variations...</div>
            </div>
          ) : (
            <textarea
              ref={variationsTextareaRef}
              value={variationsText}
              onChange={(e) => {
                const textarea = e.target as HTMLTextAreaElement;
                const cursorPosition = textarea.selectionStart;
                const selectionEnd = textarea.selectionEnd;
                lastChangeTimeRef.current = Date.now();
                setVariationsText(e.target.value);
                // Restore cursor position and focus after state update
                requestAnimationFrame(() => {
                  if (variationsTextareaRef.current && isTextareaFocusedRef.current) {
                    variationsTextareaRef.current.focus();
                    const maxPos = variationsTextareaRef.current.value.length;
                    const safeStart = Math.min(cursorPosition, maxPos);
                    const safeEnd = Math.min(selectionEnd, maxPos);
                    variationsTextareaRef.current.setSelectionRange(safeStart, safeEnd);
                  }
                });
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.stopPropagation();
                } else if (e.key === 'Escape') {
                  e.stopPropagation();
                  variationsTextareaRef.current?.blur();
                } else {
                  e.stopPropagation();
                }
              }}
              onClick={(e) => {
                e.stopPropagation();
                e.nativeEvent.stopImmediatePropagation();
                if (variationsTextareaRef.current) {
                  variationsTextareaRef.current.focus();
                  isTextareaFocusedRef.current = true;
                }
              }}
              onMouseDown={(e) => {
                e.stopPropagation();
                e.nativeEvent.stopImmediatePropagation();
                isTextareaFocusedRef.current = true;
              }}
              onFocus={(e) => {
                e.stopPropagation();
                isTextareaFocusedRef.current = true;
              }}
              onBlur={(e) => {
                const timeSinceLastChange = Date.now() - lastChangeTimeRef.current;
                const wasRecentTyping = timeSinceLastChange < 200;
                const relatedTarget = e.relatedTarget as HTMLElement;
                const clickedOutside = !relatedTarget || 
                  (relatedTarget.tagName !== 'TEXTAREA' && 
                   relatedTarget.tagName !== 'INPUT' && 
                   !relatedTarget.isContentEditable &&
                   !relatedTarget.closest('button') &&
                   !relatedTarget.closest('[role="button"]'));
                
                if (wasRecentTyping && clickedOutside && variationsTextareaRef.current && isTextareaFocusedRef.current) {
                  setTimeout(() => {
                    if (variationsTextareaRef.current && document.activeElement !== variationsTextareaRef.current) {
                      variationsTextareaRef.current.focus();
                    }
                  }, 10);
                } else if (!wasRecentTyping && !clickedOutside) {
                  isTextareaFocusedRef.current = false;
                }
              }}
              disabled={isSaving}
              placeholder={isBulkMode 
                ? "Type one variation per line. Press Enter to add more. These variations will be appended to each selected variable."
                : "Type one variation per line. Press Enter to add more."}
              className="flex-1 w-full px-3 py-2 bg-ag-dark-bg border border-ag-dark-border rounded text-sm text-ag-dark-text placeholder-ag-dark-text-secondary focus:ring-1 focus:ring-ag-dark-accent focus:border-ag-dark-accent resize-none min-h-[500px] ${
                isSaving ? 'opacity-50 cursor-not-allowed' : ''
              }"
            />
          )}
        </div>

        {/* Info text when empty */}
        {!hasVariations && !isLoading && (
          <div className="mb-4 text-sm text-ag-dark-text-secondary">
            <p>Type one variation per line. Press Enter to add more.</p>
            {isBulkMode && (
              <p className="mt-1">These variations will be appended to each selected variable's existing variations.</p>
            )}
          </div>
        )}

        {/* Footer with Save button */}
        <div className="flex justify-end gap-3 pt-4 border-t border-ag-dark-border">
          <button
            onClick={onClose}
            className="px-4 py-2 text-ag-dark-text-secondary hover:text-ag-dark-text transition-colors"
            disabled={isSaving}
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={isSaving || (!hasVariations && !isBulkMode && !onVariationsChange)}
            className="px-4 py-2 bg-ag-dark-accent text-white rounded hover:bg-opacity-90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
          >
            <Save className="w-4 h-4" />
            {isSaving ? 'Saving...' : 'Save Changes'}
          </button>
        </div>
      </div>

      {/* CSV Upload Modal */}
      <CsvUploadModal
        isOpen={isVariationUploadOpen}
        onClose={() => setIsVariationUploadOpen(false)}
        type="variations"
        onUpload={handleVariationCsvUpload}
      />
    </div>
  );
};
