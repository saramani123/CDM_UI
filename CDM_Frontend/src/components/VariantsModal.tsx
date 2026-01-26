import React, { useState, useRef, useEffect } from 'react';
import { X, Save, ArrowUpAZ, ArrowDownZA, Upload } from 'lucide-react';
import { CsvUploadModal } from './CsvUploadModal';
import { apiService } from '../services/api';
import type { ObjectData } from '../data/mockData';

interface VariantsModalProps {
  isOpen: boolean;
  onClose: () => void;
  selectedObject?: ObjectData | null; // For single-object mode
  selectedObjects?: ObjectData[]; // For bulk mode
  initialVariantsText?: string; // Initial variants text (for single object)
  onSave?: () => void; // Callback to refresh main data
  onVariantsChange?: (variants: string[]) => void; // Callback to store variants for temporary objects
  isBulkMode?: boolean; // Flag to indicate bulk edit mode
}

export const VariantsModal: React.FC<VariantsModalProps> = ({
  isOpen,
  onClose,
  selectedObject,
  selectedObjects = [],
  initialVariantsText = '',
  onSave,
  onVariantsChange,
  isBulkMode = false
}) => {
  // Determine source objects: use selectedObjects if provided (bulk mode), otherwise use selectedObject (single mode)
  const sourceObjects = isBulkMode && selectedObjects.length > 0 
    ? selectedObjects 
    : selectedObject 
      ? [selectedObject] 
      : [];

  const [variantsText, setVariantsText] = useState(initialVariantsText);
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isVariantUploadOpen, setIsVariantUploadOpen] = useState(false);
  const variantsTextareaRef = useRef<HTMLTextAreaElement>(null);
  const isTextareaFocusedRef = useRef(false);
  const lastChangeTimeRef = useRef(0);

  // Load variants when modal opens or selectedObject changes
  useEffect(() => {
    if (isOpen && !isBulkMode && selectedObject?.id && !selectedObject?._isCloned) {
      setIsLoading(true);
      const loadVariants = async () => {
        try {
          // If object has variantsList, use it directly
          if (selectedObject?.variantsList && Array.isArray(selectedObject.variantsList) && selectedObject.variantsList.length > 0) {
            const variantsTextContent = selectedObject.variantsList.map((v: any) => typeof v === 'string' ? v : v.name).join('\n');
            setVariantsText(variantsTextContent);
            setIsLoading(false);
            return;
          }
          
          // Otherwise fetch from API
          const variantData = await apiService.getObjectVariants(selectedObject.id);
          const variantsList = variantData?.variantsList || [];
          const variantsTextContent = variantsList.map((v: any) => v.name).join('\n');
          setVariantsText(variantsTextContent);
        } catch (error) {
          console.error('Failed to load variants:', error);
          setVariantsText('');
        } finally {
          setIsLoading(false);
        }
      };
      loadVariants();
    } else if (isOpen && isBulkMode) {
      // Bulk mode: start with empty text
      setVariantsText('');
    } else if (isOpen && initialVariantsText) {
      // Use provided initial text (for cloned objects)
      setVariantsText(initialVariantsText);
    }
  }, [isOpen, selectedObject?.id, selectedObject?.variantsList, isBulkMode, initialVariantsText]);

  // Focus textarea when modal opens
  useEffect(() => {
    if (isOpen && variantsTextareaRef.current) {
      setTimeout(() => {
        variantsTextareaRef.current?.focus();
      }, 100);
    }
  }, [isOpen]);

  const handleSortVariants = (direction: 'asc' | 'desc') => {
    const lines = variantsText.split('\n').filter(line => line.trim() !== '');
    const sortedLines = [...lines].sort((a, b) => {
      const aTrimmed = a.trim().toLowerCase();
      const bTrimmed = b.trim().toLowerCase();
      if (direction === 'asc') {
        return aTrimmed.localeCompare(bTrimmed);
      } else {
        return bTrimmed.localeCompare(aTrimmed);
      }
    });
    setVariantsText(sortedLines.join('\n') + (variantsText.endsWith('\n') ? '\n' : ''));
  };

  const handleVariantCsvUpload = async (data: any[] | File) => {
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
          const parsedVariants: string[] = [];
          dataRows.forEach((line) => {
            let values = line.split(',').map(val => val.trim().replace(/"/g, ''));
            if (values.length === 1 && line.includes(';')) {
              values = line.split(';').map(val => val.trim().replace(/"/g, ''));
            }
            if (values.length === 1 && line.includes('\t')) {
              values = line.split('\t').map(val => val.trim().replace(/"/g, ''));
            }
            if (values.length >= 1 && values[0]) {
              parsedVariants.push(values[0]);
            }
          });
          
          // Append to existing text
          const existingNames = new Set(variantsText.split('\n').filter(line => line.trim()).map(name => name.toLowerCase()));
          const newVariants = parsedVariants.filter(name => !existingNames.has(name.toLowerCase()));
          
          if (newVariants.length < parsedVariants.length) {
            const skippedCount = parsedVariants.length - newVariants.length;
            alert(`Uploaded ${newVariants.length} new variants. Skipped ${skippedCount} duplicates.`);
          }
          
          const newLines = newVariants.join('\n');
          setVariantsText(prev => prev ? `${prev}\n${newLines}` : newLines);
        };
        reader.readAsText(data);
      } else if (selectedObject?.id) {
        // Single object mode: use API upload
        try {
          const result = await apiService.bulkUploadVariants(selectedObject.id, data);
          const response = result as any;
          alert(response.message || `Successfully uploaded ${response.created_count} variants`);
          
          // Refresh the variants list
          try {
            const variantData = await apiService.getObjectVariants(selectedObject.id);
            const variantsList = variantData?.variantsList || [];
            const variantsTextContent = variantsList.map((v: any) => v.name).join('\n');
            setVariantsText(variantsTextContent);
          } catch (error) {
            console.error('Failed to refresh variants after upload:', error);
          }
        } catch (error) {
          console.error('Bulk variants upload failed:', error);
          alert(`Variants upload failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
      }
    } else {
      // Old client-side parsing logic - append to textarea
      const existingNames = new Set(variantsText.split('\n').filter(line => line.trim()).map(name => name.toLowerCase()));
      const newVariants = data.filter((variant: any) => 
        !existingNames.has(variant.name.toLowerCase())
      );
      
      if (newVariants.length < data.length) {
        const skippedCount = data.length - newVariants.length;
        alert(`Uploaded ${newVariants.length} new variants. Skipped ${skippedCount} duplicates.`);
      }
      
      // Append new variants to textarea
      const newLines = newVariants.map((v: any) => v.name).join('\n');
      setVariantsText(prev => prev ? `${prev}\n${newLines}` : newLines);
    }
  };

  const handleSave = async () => {
    if (isSaving) return;

    // Convert multiline text to variants array
    const variantsList = variantsText
      .split('\n')
      .map(line => line.trim())
      .filter(line => line.length > 0);

    // Check for duplicate variant names (case-insensitive) - same object cannot have duplicates
    const uniqueVariantNames = new Set(variantsList.map(v => v.toLowerCase()));
    
    if (variantsList.length !== uniqueVariantNames.size) {
      const duplicateNames = variantsList.filter((variant, index) => 
        variantsList.findIndex(v => v.toLowerCase() === variant.toLowerCase()) !== index
      ).map(v => v);
      
      alert(`Cannot save: Duplicate variant names found: ${duplicateNames.join(', ')}. Please remove duplicates before saving.`);
      return;
    }

    setIsSaving(true);

    try {
      if (isBulkMode && selectedObjects.length > 0) {
        // Bulk mode: append variants to each selected object
        for (const obj of selectedObjects) {
          if (!obj.id || obj._isCloned) continue; // Skip cloned unsaved objects
          
          // Get existing variants for this object
          let existingVariants: string[] = [];
          try {
            if (obj.variantsList && Array.isArray(obj.variantsList)) {
              existingVariants = obj.variantsList.map((v: any) => typeof v === 'string' ? v : v.name);
            } else {
              const variantData = await apiService.getObjectVariants(obj.id);
              existingVariants = (variantData?.variantsList || []).map((v: any) => v.name);
            }
          } catch (error) {
            console.error(`Failed to load existing variants for object ${obj.id}:`, error);
          }

          // Combine existing and new variants, removing duplicates
          const allVariants = [...new Set([...existingVariants, ...variantsList])];
          
          // Save all variants for this object
          // Convert string array to array of objects with 'name' property
          const variantsArray = allVariants.map(name => ({ name }));
          await apiService.updateObject(obj.id, {
            variants: variantsArray
          });
        }
        
        alert(`Successfully added variants to ${selectedObjects.length} object(s).`);
      } else if (selectedObject) {
        // Single object mode
        if (selectedObject._isCloned && !selectedObject._isSaved) {
          // For cloned unsaved objects, just store variants in callback
          if (onVariantsChange) {
            onVariantsChange(variantsList);
          }
        } else if (selectedObject.id) {
          // Save to backend
          // Convert string array to array of objects with 'name' property
          const variantsArray = variantsList.map(name => ({ name }));
          await apiService.updateObject(selectedObject.id, {
            variants: variantsArray
          });
        } else {
          // For new objects that don't exist yet (AddObjectPanel), store in callback
          if (onVariantsChange) {
            onVariantsChange(variantsList);
          }
        }
      } else if (!isBulkMode && onVariantsChange) {
        // No selected object but not bulk mode (e.g., AddObjectPanel before object is created)
        // Store variants in callback
        onVariantsChange(variantsList);
      } else if (!isBulkMode && !selectedObject) {
        // No object and no callback - this shouldn't happen, but handle gracefully
        console.warn('VariantsModal: No object selected and no onVariantsChange callback provided');
      }

      // Call onSave callback to refresh data
      if (onSave) {
        onSave();
      }

      onClose();
    } catch (error) {
      console.error('Failed to save variants:', error);
      alert(`Failed to save variants: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setIsSaving(false);
    }
  };

  if (!isOpen) return null;

  const hasVariants = variantsText.trim().length > 0;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[100]">
      <div className="bg-ag-dark-surface border border-ag-dark-border rounded-xl p-6 max-w-4xl w-full mx-4 shadow-2xl max-h-[95vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-ag-dark-text">
            {isBulkMode ? `Variants (${selectedObjects.length} objects)` : 'Variants'}
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
              onClick={() => handleSortVariants('asc')}
              disabled={!hasVariants || isSaving}
              className={`p-1.5 text-ag-dark-text-secondary hover:text-ag-dark-accent transition-colors rounded ${
                !hasVariants || isSaving ? 'opacity-50 cursor-not-allowed' : 'hover:bg-ag-dark-bg'
              }`}
              title="Sort A-Z"
            >
              <ArrowUpAZ className="w-5 h-5" />
            </button>
            <button
              onClick={() => handleSortVariants('desc')}
              disabled={!hasVariants || isSaving}
              className={`p-1.5 text-ag-dark-text-secondary hover:text-ag-dark-accent transition-colors rounded ${
                !hasVariants || isSaving ? 'opacity-50 cursor-not-allowed' : 'hover:bg-ag-dark-bg'
              }`}
              title="Sort Z-A"
            >
              <ArrowDownZA className="w-5 h-5" />
            </button>
            <button
              onClick={() => setIsVariantUploadOpen(true)}
              disabled={isSaving}
              className={`text-ag-dark-text-secondary hover:text-ag-dark-accent transition-colors ${
                isSaving ? 'opacity-50 cursor-not-allowed' : ''
              }`}
              title="Upload Variants CSV"
            >
              <Upload className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Textarea */}
        <div className="flex-1 overflow-hidden flex flex-col mb-4 min-h-[500px]">
          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <div className="text-ag-dark-text-secondary">Loading variants...</div>
            </div>
          ) : (
            <textarea
              ref={variantsTextareaRef}
              value={variantsText}
              onChange={(e) => {
                const textarea = e.target as HTMLTextAreaElement;
                const cursorPosition = textarea.selectionStart;
                const selectionEnd = textarea.selectionEnd;
                lastChangeTimeRef.current = Date.now();
                setVariantsText(e.target.value);
                // Restore cursor position and focus after state update
                requestAnimationFrame(() => {
                  if (variantsTextareaRef.current && isTextareaFocusedRef.current) {
                    variantsTextareaRef.current.focus();
                    const maxPos = variantsTextareaRef.current.value.length;
                    const safeStart = Math.min(cursorPosition, maxPos);
                    const safeEnd = Math.min(selectionEnd, maxPos);
                    variantsTextareaRef.current.setSelectionRange(safeStart, safeEnd);
                  }
                });
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.stopPropagation();
                } else if (e.key === 'Escape') {
                  e.stopPropagation();
                  variantsTextareaRef.current?.blur();
                } else {
                  e.stopPropagation();
                }
              }}
              onClick={(e) => {
                e.stopPropagation();
                e.nativeEvent.stopImmediatePropagation();
                if (variantsTextareaRef.current) {
                  variantsTextareaRef.current.focus();
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
                
                if (wasRecentTyping && clickedOutside && variantsTextareaRef.current && isTextareaFocusedRef.current) {
                  setTimeout(() => {
                    if (variantsTextareaRef.current && document.activeElement !== variantsTextareaRef.current) {
                      variantsTextareaRef.current.focus();
                    }
                  }, 10);
                } else if (!wasRecentTyping && !clickedOutside) {
                  isTextareaFocusedRef.current = false;
                }
              }}
              disabled={isSaving}
              placeholder={isBulkMode 
                ? "Type one variant per line. Press Enter to add more. These variants will be appended to each selected object."
                : "Type one variant per line. Press Enter to add more."}
              className="flex-1 w-full px-3 py-2 bg-ag-dark-bg border border-ag-dark-border rounded text-sm text-ag-dark-text placeholder-ag-dark-text-secondary focus:ring-1 focus:ring-ag-dark-accent focus:border-ag-dark-accent resize-none min-h-[500px] ${
                isSaving ? 'opacity-50 cursor-not-allowed' : ''
              }"
            />
          )}
        </div>

        {/* Info text when empty */}
        {!hasVariants && !isLoading && (
          <div className="mb-4 text-sm text-ag-dark-text-secondary">
            <p>Type one variant per line. Press Enter to add more.</p>
            {isBulkMode && (
              <p className="mt-1">These variants will be appended to each selected object's existing variants.</p>
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
            disabled={isSaving || (!hasVariants && !isBulkMode && !onVariantsChange)}
            className="px-4 py-2 bg-ag-dark-accent text-white rounded hover:bg-opacity-90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
          >
            <Save className="w-4 h-4" />
            {isSaving ? 'Saving...' : 'Save Changes'}
          </button>
        </div>
      </div>

      {/* CSV Upload Modal */}
      <CsvUploadModal
        isOpen={isVariantUploadOpen}
        onClose={() => setIsVariantUploadOpen(false)}
        type="variants"
        onUpload={handleVariantCsvUpload}
      />
    </div>
  );
};
