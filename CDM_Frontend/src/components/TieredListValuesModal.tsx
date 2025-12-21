import React, { useState, useEffect, useRef, useCallback } from 'react';
import { X, Upload, Save, Plus, Trash2, FileText, ArrowUpAZ, ArrowDownZA } from 'lucide-react';
import { ListData } from '../data/listsData';
import { getTieredListValues } from '../services/api';

interface TieredListValuesModalProps {
  isOpen: boolean;
  onClose: () => void;
  selectedList: ListData | null;
  allLists: ListData[];
  tierNames?: string[]; // Tier names from List Type section (Tier 2, Tier 3, etc.)
  initialValues?: Record<string, string[][]>; // Pre-loaded tiered list values from parent
  onSave: (tieredValues: Record<string, string[][]>) => void;
}

interface TieredValueRow {
  id: string;
  values: string[]; // One value per tier column
  variations: string[]; // One variation per tier column (abbreviated versions)
}

export const TieredListValuesModal: React.FC<TieredListValuesModalProps> = ({
  isOpen,
  onClose,
  selectedList,
  allLists,
  tierNames = [],
  initialValues,
  onSave
}) => {
  const [tieredValueRows, setTieredValueRows] = useState<TieredValueRow[]>([]);
  const [isCsvUploadOpen, setIsCsvUploadOpen] = useState(false);
  const [isDragOver, setIsDragOver] = useState(false);
  const [editingCell, setEditingCell] = useState<{ rowId: string; colIndex: number; isVariation?: boolean } | null>(null);
  const [editValue, setEditValue] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);
  // Track if we've loaded initial data to prevent reloading when parent state updates
  const hasLoadedInitialData = useRef(false);
  // Track current tieredValueRows to avoid stale closure issues
  const tieredValueRowsRef = useRef<TieredValueRow[]>([]);

  // Build column headers: tier names + variation columns
  const columnHeaders: string[] = React.useMemo(() => {
    const headers: string[] = [];
    // Add tier names from props (Tier 1, Tier 2, etc.)
    tierNames.forEach(tierName => {
      if (tierName && tierName.trim()) {
        headers.push(tierName.trim());
      }
    });
    return headers;
  }, [tierNames]);

  // Build variation column headers: one for each tier
  const variationColumnHeaders: string[] = React.useMemo(() => {
    return columnHeaders.map(header => `${header} Value Variations`);
  }, [columnHeaders]);

  const loadTieredValues = useCallback(async () => {
    if (!selectedList) return;
    
    // CRITICAL: Don't reload if we already have data in the modal (user is editing)
    // Only load when modal first opens
    if (hasLoadedInitialData.current) {
      console.log('⚠️ Skipping reload - modal already loaded initial data. Preserving current tieredValueRows.');
      return;
    }
    
    // Double-check: if we have rows with actual data, don't reload
    // Use ref to avoid stale closure issues
    const currentRows = tieredValueRowsRef.current;
    const hasData = currentRows.some(row => 
      row.values.some(v => v && v.trim()) || row.variations.some(v => v && v.trim())
    );
    if (hasData) {
      console.log('⚠️ Skipping reload - modal has user-entered data. Preserving current state.');
      hasLoadedInitialData.current = true; // Mark as loaded to prevent future reloads
      return;
    }
    
    try {
      // Use initialValues if provided (from parent component's local state)
      // Check if initialValues is explicitly provided (not undefined/null), even if it's an empty object
      // This ensures that unsaved local changes persist when reopening the modal
      // The parent component (ListMetadataPanel) always passes tieredListValues as initialValues,
      // so if it's undefined, it means we should load from backend
      let existingValues: Record<string, string[][]>;
      // Use the current initialValues prop (not from closure) - but we'll access it directly
      const currentInitialValues = initialValues;
      
      // Extract variations FIRST (before filtering out _variations from existingValues)
      const savedVariations = (currentInitialValues as any)?._variations || {};
      
      // Determine where to get the actual tiered values from
      if (currentInitialValues !== undefined && currentInitialValues !== null) {
        // initialValues was explicitly provided
        // Filter out _variations to get only the actual tiered values
        const { _variations, ...tieredValuesOnly } = currentInitialValues as any;
        existingValues = tieredValuesOnly;
        
        // If initialValues only had _variations (no actual values), try to load from backend
        // But preserve the variations we extracted
        if (Object.keys(existingValues).length === 0 && Object.keys(savedVariations).length > 0) {
          console.log('⚠️ initialValues only has _variations, loading actual values from backend');
          const backendValues = await getTieredListValues(selectedList.id);
          existingValues = backendValues || {};
        }
      } else {
        // initialValues not provided, load from backend
        existingValues = await getTieredListValues(selectedList.id);
      }
      
      console.log('📦 Loading tiered values:', {
        hasInitialValues: currentInitialValues !== undefined && currentInitialValues !== null,
        existingValuesKeys: Object.keys(existingValues || {}).length,
        hasVariations: Object.keys(savedVariations).length > 0,
        existingValues: existingValues
      });
      
      // Convert the backend format to rows
      // Backend format: { "Tier1Value": [["Tier2Value1", "Tier3Value1"], ["Tier2Value2", "Tier3Value2"]], ... }
      // We need: rows where each row is [Tier1Value, Tier2Value, Tier3Value, ...]
      const rows: TieredValueRow[] = [];
      
      if (existingValues && Object.keys(existingValues).length > 0) {
        // For each Tier 1 value, create rows for each tiered value array
        Object.entries(existingValues).forEach(([tier1Value, tieredArrays]) => {
          tieredArrays.forEach((tieredArray) => {
            // Create a row: [Tier1Value, Tier2Value, Tier3Value, ...]
            const rowValues = [tier1Value, ...tieredArray];
            // Pad with empty strings if needed to match column count
            while (rowValues.length < columnHeaders.length) {
              rowValues.push('');
            }
            
            // Initialize variations array
            const rowVariations: string[] = columnHeaders.map(() => '');
            
            // Load variations for this row's values from savedVariations
            // Variations format: { "Tier1Value": { "Tier1Value": ["var1", "var2"], "Tier2Value": ["var3"] } }
            if (savedVariations[tier1Value]) {
              const tierVariations = savedVariations[tier1Value];
              
              // Tier 1 variations (index 0)
              if (tierVariations[tier1Value] && Array.isArray(tierVariations[tier1Value])) {
                rowVariations[0] = tierVariations[tier1Value].join(', ');
              }
              
              // Tier 2+ variations
              rowValues.slice(1).forEach((value, index) => {
                if (value && value.trim() && tierVariations[value] && Array.isArray(tierVariations[value])) {
                  rowVariations[index + 1] = tierVariations[value].join(', ');
                }
              });
            }
            
            rows.push({
              id: `row-${Date.now()}-${rows.length}`,
              values: rowValues.slice(0, columnHeaders.length),
              variations: rowVariations
            });
          });
        });
      }
      
      // Always ensure we have at least 100 rows for Excel-like experience
      while (rows.length < 100) {
        rows.push({
          id: `row-${Date.now()}-${rows.length}`,
          values: columnHeaders.map(() => ''),
          variations: columnHeaders.map(() => '')
        });
      }
      
      setTieredValueRows(rows);
      console.log('✅ Loaded tiered values into modal:', {
        totalRows: rows.length,
        rowsWithValues: rows.filter(r => r.values.some(v => v && v.trim())).length,
        rowsWithVariations: rows.filter(r => r.variations.some(v => v && v.trim())).length
      });
    } catch (error) {
      console.error('Error loading tiered values:', error);
      // On error, initialize with empty rows only if we don't already have data
      if (tieredValueRows.length === 0) {
        const initialRows: TieredValueRow[] = [];
        for (let i = 0; i < 100; i++) {
          initialRows.push({ 
            id: `row-${i + 1}`, 
            values: columnHeaders.map(() => ''),
            variations: columnHeaders.map(() => '')
          });
        }
        setTieredValueRows(initialRows);
      }
    }
    // Include initialValues in dependencies but guard against reloading when it changes after initial load
    // The hasLoadedInitialData ref prevents reloading after initial load
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedList?.id, columnHeaders.length, initialValues]);

  // Load existing tiered values when modal opens (only once, not on every initialValues change)
  useEffect(() => {
    if (isOpen && selectedList && columnHeaders.length >= 1) {
      // Always reload when modal opens (after being closed)
      // This ensures we load the latest initialValues when reopening
      if (!hasLoadedInitialData.current) {
        console.log('🔄 Modal opened - loading initial tiered values. initialValues:', initialValues);
        loadTieredValues();
        hasLoadedInitialData.current = true;
      } else {
        console.log('✅ Modal already loaded data, skipping reload');
      }
    } else if (!isOpen) {
      // Reset when modal closes - this allows reloading when reopening
      console.log('🔄 Modal closed, resetting state and flag');
      setTieredValueRows([]);
      setEditingCell(null);
      setEditValue('');
      hasLoadedInitialData.current = false; // Reset flag so we load again when reopening
    }
    // Only depend on isOpen and selectedList.id - don't depend on loadTieredValues or initialValues
    // to prevent reloading when parent state updates after saving
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, selectedList?.id, columnHeaders.length]);
  
  // Sync ref with state to avoid stale closure issues
  useEffect(() => {
    tieredValueRowsRef.current = tieredValueRows;
  }, [tieredValueRows]);
  
  // CRITICAL: Prevent any state reset when initialValues changes after initial load
  // This ensures values persist in the modal after saving
  useEffect(() => {
    // If modal is open and we've already loaded data, DO NOT reset or reload
    // This prevents values from disappearing when parent updates initialValues after save
    if (isOpen && hasLoadedInitialData.current && tieredValueRows.length > 0) {
      console.log('✅ Modal is open with data - ignoring initialValues change to preserve user input');
      return;
    }
  }, [initialValues, isOpen, tieredValueRows.length]);

  const handleAddRow = (index?: number) => {
    const newRow: TieredValueRow = {
      id: Date.now().toString(),
      values: columnHeaders.map(() => ''),
      variations: columnHeaders.map(() => '')
    };
    if (index !== undefined) {
      setTieredValueRows(prev => [...prev.slice(0, index), newRow, ...prev.slice(index)]);
    } else {
      setTieredValueRows(prev => [...prev, newRow]);
    }
  };

  const handleDeleteRow = (rowId: string) => {
    setTieredValueRows(prev => prev.filter(row => row.id !== rowId));
  };

  const handleCellClick = (rowId: string, colIndex: number, currentValue: string, isVariation: boolean = false) => {
    setEditingCell({ rowId, colIndex, isVariation });
    setEditValue(currentValue);
  };

  const handleCellChange = (value: string) => {
    setEditValue(value);
  };

  const handlePaste = (e: React.ClipboardEvent, startRowId: string, startColIndex: number, isVariation: boolean = false) => {
    e.preventDefault();
    const pasteData = e.clipboardData.getData('text');
    
    // Parse pasted data (handles tab-separated values and newlines like Excel)
    const lines = pasteData.split(/\r?\n/).filter(line => line.trim() || line.includes('\t'));
    if (lines.length === 0) return;
    
    const rows = tieredValueRows;
    const startRowIndex = rows.findIndex(r => r.id === startRowId);
    if (startRowIndex === -1) return;
    
    const newRows = rows.map((row, rowIndex) => {
      if (rowIndex < startRowIndex) return row;
      
      const lineIndex = rowIndex - startRowIndex;
      if (lineIndex >= lines.length) return row;
      
      const line = lines[lineIndex];
      const values = line.split('\t');
      
      const newValues = [...row.values];
      const newVariations = [...row.variations];
      
      // Paste into the same column type (values or variations) starting from startColIndex
      values.forEach((value, colOffset) => {
        const targetColIndex = startColIndex + colOffset;
        if (isVariation) {
          // Pasting into variations column - paste into consecutive variation columns
          if (targetColIndex >= 0 && targetColIndex < newVariations.length) {
            newVariations[targetColIndex] = value.trim();
          }
        } else {
          // Pasting into values column - paste into consecutive value columns
          if (targetColIndex >= 0 && targetColIndex < newValues.length) {
            newValues[targetColIndex] = value.trim();
          }
        }
      });
      
      return { ...row, values: newValues, variations: newVariations };
    });
    
    // Add more rows if needed
    if (startRowIndex + lines.length > rows.length) {
      const additionalRows: TieredValueRow[] = [];
      for (let i = rows.length; i < startRowIndex + lines.length; i++) {
        const lineIndex = i - startRowIndex;
        const line = lines[lineIndex];
        const values = line.split('\t');
        
        const newValues = columnHeaders.map((_, colIndex) => {
          const colOffset = colIndex - startColIndex;
          return colOffset >= 0 && colOffset < values.length ? values[colOffset].trim() : '';
        });
        const newVariations = columnHeaders.map(() => '');
        
        // If pasting into variations, populate variations instead
        if (isVariation) {
          columnHeaders.forEach((_, colIndex) => {
            const colOffset = colIndex - startColIndex;
            if (colOffset >= 0 && colOffset < values.length) {
              newVariations[colIndex] = values[colOffset].trim();
            }
          });
        }
        
        additionalRows.push({ id: `row-${Date.now()}-${i}`, values: newValues, variations: newVariations });
      }
      setTieredValueRows([...newRows, ...additionalRows]);
    } else {
      setTieredValueRows(newRows);
    }
    
    setEditingCell(null);
    setEditValue('');
  };

  const handleCellBlur = () => {
    if (editingCell) {
      const currentEditValue = editValue; // Capture current value
      const currentEditingCell = editingCell; // Capture current cell info
      setTieredValueRows(prev => prev.map(row => {
        if (row.id === currentEditingCell.rowId) {
          if (currentEditingCell.isVariation) {
            const newVariations = [...row.variations];
            newVariations[currentEditingCell.colIndex] = currentEditValue;
            return { ...row, variations: newVariations };
          } else {
            const newValues = [...row.values];
            newValues[currentEditingCell.colIndex] = currentEditValue;
            return { ...row, values: newValues };
          }
        }
        return row;
      }));
      setEditingCell(null);
      setEditValue('');
    }
  };

  const handleCellKeyDown = (e: React.KeyboardEvent, rowId: string, colIndex: number, isVariation: boolean = false) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      // Save current cell first before moving
      const currentEditValue = editValue;
      const currentEditingCell = editingCell;
      
      if (currentEditingCell) {
        // Update the row with the current edit value
        setTieredValueRows(prev => {
          const updated = prev.map(row => {
            if (row.id === currentEditingCell.rowId) {
              if (currentEditingCell.isVariation) {
                const newVariations = [...row.variations];
                newVariations[currentEditingCell.colIndex] = currentEditValue;
                return { ...row, variations: newVariations };
              } else {
                const newValues = [...row.values];
                newValues[currentEditingCell.colIndex] = currentEditValue;
                return { ...row, values: newValues };
              }
            }
            return row;
          });
          
          // Move to next row using the updated rows
          const currentRowIndex = updated.findIndex(r => r.id === rowId);
          if (currentRowIndex < updated.length - 1) {
            const nextRow = updated[currentRowIndex + 1];
            setEditingCell({ rowId: nextRow.id, colIndex, isVariation });
            setEditValue(isVariation ? (nextRow.variations[colIndex] || '') : (nextRow.values[colIndex] || ''));
          } else {
            setEditingCell(null);
            setEditValue('');
          }
          
          return updated;
        });
      } else {
        // No cell currently editing, just move to next row
        const currentRowIndex = tieredValueRows.findIndex(r => r.id === rowId);
        if (currentRowIndex < tieredValueRows.length - 1) {
          const nextRow = tieredValueRows[currentRowIndex + 1];
          setEditingCell({ rowId: nextRow.id, colIndex, isVariation });
          setEditValue(isVariation ? (nextRow.variations[colIndex] || '') : (nextRow.values[colIndex] || ''));
        } else {
          setEditingCell(null);
          setEditValue('');
        }
      }
    } else if (e.key === 'Tab') {
      e.preventDefault();
      // Move to next column, same row
      if (colIndex < columnHeaders.length - 1) {
        const currentRow = tieredValueRows.find(r => r.id === rowId);
        if (currentRow) {
          setEditingCell({ rowId, colIndex: colIndex + 1 });
          setEditValue(currentRow.values[colIndex + 1] || '');
        }
      } else {
        // Move to next row, first column
        const currentRowIndex = tieredValueRows.findIndex(r => r.id === rowId);
        if (currentRowIndex < tieredValueRows.length - 1) {
          const nextRow = tieredValueRows[currentRowIndex + 1];
          setEditingCell({ rowId: nextRow.id, colIndex: 0 });
          setEditValue(nextRow.values[0] || '');
        }
      }
    } else if (e.key === 'Escape') {
      setEditingCell(null);
      setEditValue('');
    }
  };

  const handleCsvUpload = (file: File) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const csv = e.target?.result as string;
        const lines = csv.split('\n').filter(line => line.trim());
        
        if (lines.length < 2) {
          alert('CSV must contain at least a header row and one data row');
          return;
        }

        // Parse header row to get column order
        const headerLine = lines[0];
        const headers = headerLine.split(',').map(h => h.trim().replace(/^"|"$/g, ''));
        
        // Verify headers match column headers (parent list name + tier names)
        if (headers.length !== columnHeaders.length || !headers.every((h, i) => h === columnHeaders[i])) {
          alert(`CSV headers must match column names in order: ${columnHeaders.join(', ')}`);
          return;
        }

        // Parse data rows
        const newRows: TieredValueRow[] = [];
        for (let i = 1; i < lines.length; i++) {
          const line = lines[i];
          const values: string[] = [];
          let currentValue = '';
          let inQuotes = false;
          
          for (let j = 0; j < line.length; j++) {
            const char = line[j];
            if (char === '"') {
              inQuotes = !inQuotes;
            } else if (char === ',' && !inQuotes) {
              values.push(currentValue.trim().replace(/^"|"$/g, ''));
              currentValue = '';
            } else {
              currentValue += char;
            }
          }
          values.push(currentValue.trim().replace(/^"|"$/g, ''));
          
          // Pad or truncate to match number of columns
          const paddedValues = [...values];
          while (paddedValues.length < columnHeaders.length) {
            paddedValues.push('');
          }
          paddedValues.length = columnHeaders.length;
          
          newRows.push({
            id: (Date.now() + i).toString(),
            values: paddedValues
          });
        }

        setTieredValueRows(newRows);
        setIsCsvUploadOpen(false);
        alert(`Successfully loaded ${newRows.length} rows from CSV`);
      } catch (error) {
        console.error('Error parsing CSV:', error);
        alert('Error parsing CSV file. Please check the format.');
      }
    };
    reader.readAsText(file);
  };

  const handleSortColumn = (colIndex: number, direction: 'asc' | 'desc') => {
    // Separate rows with values and rows without values in the target column
    const rowsWithValues: TieredValueRow[] = [];
    const rowsWithoutValues: TieredValueRow[] = [];
    
    tieredValueRows.forEach(row => {
      const value = (row.values[colIndex] || '').trim();
      if (value.length > 0) {
        rowsWithValues.push(row);
      } else {
        rowsWithoutValues.push(row);
      }
    });
    
    // Sort only rows with values
    const sortedRowsWithValues = rowsWithValues.sort((a, b) => {
      const aValue = (a.values[colIndex] || '').trim().toLowerCase();
      const bValue = (b.values[colIndex] || '').trim().toLowerCase();
      if (direction === 'asc') {
        return aValue.localeCompare(bValue);
      } else {
        return bValue.localeCompare(aValue);
      }
    });
    
    // Combine: sorted rows with values first, then rows without values
    setTieredValueRows([...sortedRowsWithValues, ...rowsWithoutValues]);
  };

  const handleSave = () => {
    // First, validate that if any tier column (Tier 2+) has values, Tier 1 must also have values
    const rowsWithTier2PlusValues: number[] = [];
    const rowsWithMissingTier1: number[] = [];
    
    // Also validate that variations can only exist if the corresponding value exists
    const rowsWithVariationsButNoValue: number[] = [];
    
    tieredValueRows.forEach((row, rowIndex) => {
      const tier1Value = row.values[0] ? row.values[0].trim() : '';
      const tier2PlusValues = row.values.slice(1).filter(v => v && v.trim());
      
      // If Tier 2+ has values but Tier 1 is empty, this is invalid
      if (tier2PlusValues.length > 0 && !tier1Value) {
        rowsWithTier2PlusValues.push(rowIndex + 1);
        rowsWithMissingTier1.push(rowIndex + 1);
      }
      
      // Check if variations exist without corresponding values
      // Tier 1 variation requires Tier 1 value
      if (row.variations[0] && row.variations[0].trim() && !tier1Value) {
        rowsWithVariationsButNoValue.push(rowIndex + 1);
      }
      // Tier 2+ variations require corresponding tier values
      row.variations.slice(1).forEach((variation, index) => {
        const correspondingValue = row.values[index + 1] ? row.values[index + 1].trim() : '';
        if (variation && variation.trim() && !correspondingValue) {
          rowsWithVariationsButNoValue.push(rowIndex + 1);
        }
      });
    });
    
    // If validation fails, show error and prevent save
    if (rowsWithMissingTier1.length > 0) {
      const rowNumbers = rowsWithMissingTier1.join(', ');
      const tier1ColumnName = columnHeaders[0] || 'Tier 1';
      alert(`Cannot save: Rows ${rowNumbers} have values in Tier 2+ columns but are missing values in the "${tier1ColumnName}" column. Please enter values in the "${tier1ColumnName}" column for all rows that have Tier 2+ values.`);
      return;
    }
    
    if (rowsWithVariationsButNoValue.length > 0) {
      const rowNumbers = [...new Set(rowsWithVariationsButNoValue)].join(', ');
      alert(`Cannot save: Rows ${rowNumbers} have variations but are missing the corresponding values. Please enter values before adding variations.`);
      return;
    }
    
    // Convert rows to the format expected by backend
    // Group by Tier 1 value, then create arrays of [Tier2, Tier3, ...] values
    // Format: { "Tier1Value": [["Tier2Value1", "Tier3Value1"], ["Tier2Value2", "Tier3Value2"]], ... }
    // Also include variations: { "Tier1Value": { "Tier1Value": ["var1", "var2"], "Tier2Value1": ["var3"], ... } }
    const tieredValues: Record<string, string[][]> = {};
    const variations: Record<string, Record<string, string[]>> = {}; // Aggregate variations for distinct values
    
    tieredValueRows.forEach(row => {
      if (row.values[0] && row.values[0].trim()) { // Tier 1 value (first column)
        const tier1Value = row.values[0].trim();
        // Get remaining tier values (Tier 2, Tier 3, etc.)
        const remainingTierValues = row.values.slice(1).filter(v => v && v.trim());
        
        // Always include Tier 1 value, even if there are no Tier 2+ values
        // This ensures single-tier entries or entries with only Tier 1 are preserved
        if (!tieredValues[tier1Value]) {
          tieredValues[tier1Value] = [];
        }
        
        // If there are Tier 2+ values, add them; otherwise add empty array to preserve Tier 1 entry
        if (remainingTierValues.length > 0) {
          // Add the array of tier values (Tier 2, Tier 3, etc.)
          tieredValues[tier1Value].push(remainingTierValues);
        } else {
          // No Tier 2+ values, but we still want to preserve the Tier 1 value
          // Add an empty array to indicate this Tier 1 value exists (for single-tier lists or Tier 1 only)
          tieredValues[tier1Value].push([]);
        }
        
        // Store variations for tier 1 value if present (can be comma-separated)
        // Aggregate variations for the same distinct value across multiple rows
        // This should work even if there are no Tier 2+ values
        if (row.variations[0] && row.variations[0].trim()) {
          if (!variations[tier1Value]) {
            variations[tier1Value] = {};
          }
          // Parse comma-separated variations
          const tier1Variations = row.variations[0].split(',').map(v => v.trim()).filter(v => v);
          if (tier1Variations.length > 0) {
            if (!variations[tier1Value][tier1Value]) {
              variations[tier1Value][tier1Value] = [];
            }
            // Add variations, avoiding duplicates for the same distinct value
            tier1Variations.forEach(v => {
              if (!variations[tier1Value][tier1Value].includes(v)) {
                variations[tier1Value][tier1Value].push(v);
              }
            });
          }
        }
        
        // Store variations for tier 2+ values (can be comma-separated)
        // Aggregate variations for the same distinct value across multiple rows
        remainingTierValues.forEach((value, index) => {
          const variationIndex = index + 1; // +1 because variations[0] is for tier 1
          if (row.variations[variationIndex] && row.variations[variationIndex].trim()) {
            if (!variations[tier1Value]) {
              variations[tier1Value] = {};
            }
            // Parse comma-separated variations
            const valueVariations = row.variations[variationIndex].split(',').map(v => v.trim()).filter(v => v);
            if (valueVariations.length > 0) {
              if (!variations[tier1Value][value]) {
                variations[tier1Value][value] = [];
              }
              // Add variations, avoiding duplicates for the same distinct value
              valueVariations.forEach(v => {
                if (!variations[tier1Value][value].includes(v)) {
                  variations[tier1Value][value].push(v);
                }
              });
            }
          }
        });
      }
    });

    // Include variations in the save data as a special key
    // If user only added variations (no tiered values edited), preserve existing tiered values
    const saveData: any = { ...tieredValues };
    if (Object.keys(variations).length > 0) {
      saveData._variations = variations;
    }

    // Update parent component's state (local only, no backend call)
    // Always save, even if only variations were added (tieredValues is empty)
    // The parent component will merge with existing values if needed
    console.log('💾 Saving tiered values to parent state:', {
      tieredValueRowsCount: tieredValueRows.length,
      tieredValuesKeys: Object.keys(tieredValues).length,
      variationsKeys: Object.keys(variations).length,
      saveDataKeys: Object.keys(saveData).length,
      saveData: saveData,
      hasVariations: !!saveData._variations
    });
    onSave(saveData);
    
    // CRITICAL: DO NOT clear or reload the modal's local state after saving
    // The tieredValueRows state should persist so values remain visible in the modal
    // The hasLoadedInitialData ref prevents the useEffect from reloading when initialValues changes
    // DO NOT call setTieredValueRows here - keep the current state!
    console.log('✅ Save complete. tieredValueRows should remain unchanged:', tieredValueRows.length, 'rows');
    
    // Show success message - variations are saved locally in modal
    const totalRows = Object.values(tieredValues).reduce((sum: number, arr: any) => sum + (Array.isArray(arr) ? arr.length : 0), 0);
    const totalVariations = Object.values(variations).reduce((sum: number, tierVariations: any) => {
      if (typeof tierVariations === 'object') {
        return sum + Object.values(tierVariations).reduce((tierSum: number, vars: any) => 
          tierSum + (Array.isArray(vars) ? vars.length : 0), 0);
      }
      return sum;
    }, 0);
    
    if (totalVariations > 0) {
      alert(`Variations saved locally (${totalVariations} variation${totalVariations !== 1 ? 's' : ''}). Click "Save Changes" on the metadata panel to save to Neo4j.`);
    } else if (totalRows > 0) {
      alert(`Tiered list values saved locally (${totalRows} row${totalRows !== 1 ? 's' : ''}). Click "Save Changes" on the metadata panel to save to Neo4j.`);
    }
    
    // CRITICAL: Ensure values persist in the modal state
    // The tieredValueRows state should remain unchanged - values should stay visible
    // DO NOT call setTieredValueRows or any function that would clear/reset the state
    
    // Optionally close the modal after save (user can reopen to see saved values)
    // Closing and reopening ensures a clean state reload from parent's saved state
    // This might help if there are any state persistence issues
    setTimeout(() => {
      onClose();
    }, 100); // Small delay to ensure state is saved to parent
  };

  if (!isOpen || !selectedList || columnHeaders.length < 1) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-70 flex items-center justify-center z-[100]" onClick={onClose}>
      <div 
        className="bg-ag-dark-surface rounded-lg border border-ag-dark-border w-[95vw] h-[90vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-ag-dark-border">
          <h2 className="text-xl font-semibold text-ag-dark-text">
            Tiered List Values: {selectedList.list}
          </h2>
          <div className="flex items-center gap-2">
            <button
              onClick={() => {
                setIsCsvUploadOpen(true);
                fileInputRef.current?.click();
              }}
              className="p-2 text-ag-dark-text-secondary hover:text-ag-dark-accent transition-colors rounded hover:bg-ag-dark-bg"
              title="Upload CSV"
            >
              <Upload className="w-5 h-5" />
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept=".csv"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) {
                  handleCsvUpload(file);
                }
              }}
              className="hidden"
            />
            <button
              onClick={onClose}
              className="p-2 text-ag-dark-text-secondary hover:text-ag-dark-accent transition-colors rounded hover:bg-ag-dark-bg"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* CSV Upload Instructions Modal */}
        {isCsvUploadOpen && (
          <div className="fixed inset-0 bg-black bg-opacity-70 flex items-center justify-center z-[60]">
            <div className="bg-ag-dark-surface rounded-lg border border-ag-dark-border max-w-lg w-full mx-4 max-h-[85vh] overflow-y-auto">
              {/* Header */}
              <div className="flex items-center justify-between p-4 border-b border-ag-dark-border sticky top-0 bg-ag-dark-surface">
                <h2 className="text-lg font-semibold text-ag-dark-text">Upload Tiered List Values</h2>
                <button
                  onClick={() => setIsCsvUploadOpen(false)}
                  className="text-ag-dark-text-secondary hover:text-ag-dark-text transition-colors"
                >
                  <X className="w-6 h-6" />
                </button>
              </div>

              {/* Content */}
              <div className="p-5 space-y-4">
                {/* CSV Format Specification */}
                <div className="space-y-3">
                  <h3 className="text-sm font-medium text-ag-dark-accent">CSV FORMAT</h3>
                  <div className="bg-ag-dark-bg rounded-lg border border-ag-dark-border overflow-hidden">
                    {columnHeaders.map((header, index) => (
                      <div
                        key={index}
                        className="flex items-center justify-between px-4 py-3 border-b border-ag-dark-border last:border-b-0"
                      >
                        <span className="text-sm text-ag-dark-text-secondary">
                          Column {index + 1}
                        </span>
                        <span className="text-sm font-medium text-ag-dark-text">
                          {header}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Upload Area */}
                <div className="space-y-3">
                  <div
                    className={`border-2 border-dashed rounded-lg p-6 text-center transition-colors ${
                      isDragOver
                        ? 'border-ag-dark-accent bg-ag-dark-accent bg-opacity-10'
                        : 'border-ag-dark-border hover:border-ag-dark-accent hover:bg-ag-dark-bg'
                    }`}
                    onDrop={(e) => {
                      e.preventDefault();
                      setIsDragOver(false);
                      const file = e.dataTransfer.files[0];
                      if (file && (file.type === 'text/csv' || file.name.endsWith('.csv'))) {
                        handleCsvUpload(file);
                        setIsCsvUploadOpen(false);
                      } else {
                        alert('Please drop a valid CSV file');
                      }
                    }}
                    onDragOver={(e) => {
                      e.preventDefault();
                      setIsDragOver(true);
                    }}
                    onDragLeave={() => setIsDragOver(false)}
                  >
                    <div className="space-y-4">
                      <div className="flex justify-center">
                        <FileText className="w-10 h-10 text-ag-dark-text-secondary" />
                      </div>
                      <div className="space-y-2">
                        <p className="text-sm font-medium text-ag-dark-text">
                          Drop your CSV file here
                        </p>
                        <p className="text-xs text-ag-dark-text-secondary">
                          or click to browse
                        </p>
                      </div>
                      <label className="inline-flex items-center gap-2 px-4 py-2 bg-ag-dark-accent text-white rounded hover:bg-ag-dark-accent-hover transition-colors cursor-pointer">
                        <Upload className="w-4 h-4" />
                        UPLOAD CSV
                        <input
                          type="file"
                          accept=".csv"
                          onChange={(e) => {
                            const file = e.target.files?.[0];
                            if (file) {
                              handleCsvUpload(file);
                              setIsCsvUploadOpen(false);
                            }
                          }}
                          className="hidden"
                        />
                      </label>
                    </div>
                  </div>
                </div>

                {/* Format Notes */}
                <div className="text-xs text-ag-dark-text-secondary space-y-1">
                  <p>• First row should contain column headers</p>
                  <p>• Column headers must match the column names in order: {columnHeaders.join(', ')}</p>
                  <p>• Each subsequent row represents one tiered value combination</p>
                  <p>• Values should be separated by commas</p>
                  <p>• You can also copy/paste directly from Excel into the grid</p>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Table Content */}
        <div 
          className="flex-1 overflow-auto p-4"
          onPaste={(e) => {
            // Handle paste at table level if a cell is selected
            if (editingCell) {
              e.preventDefault();
              // Paste into the same column type (value or variation) that's currently being edited
              handlePaste(e, editingCell.rowId, editingCell.colIndex, editingCell.isVariation || false);
            }
          }}
        >
          <div className="border border-ag-dark-border rounded">
            {/* Table Header */}
            <div className="sticky top-0 bg-ag-dark-bg border-b border-ag-dark-border z-10">
              <div className="grid gap-2 p-2" style={{ gridTemplateColumns: `40px repeat(${columnHeaders.length * 2}, 250px) auto` }}>
                <div className="text-xs font-medium text-ag-dark-text-secondary"></div>
                {columnHeaders.map((header, index) => (
                  <React.Fragment key={index}>
                    <div className="flex items-center justify-between text-xs font-medium text-ag-dark-text-secondary text-left">
                      <span>{header}</span>
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => handleSortColumn(index, 'asc')}
                          className="p-0.5 text-ag-dark-text-secondary hover:text-ag-dark-accent transition-colors rounded"
                          title="Sort A-Z"
                        >
                          <ArrowUpAZ className="w-3 h-3" />
                        </button>
                        <button
                          onClick={() => handleSortColumn(index, 'desc')}
                          className="p-0.5 text-ag-dark-text-secondary hover:text-ag-dark-accent transition-colors rounded"
                          title="Sort Z-A"
                        >
                          <ArrowDownZA className="w-3 h-3" />
                        </button>
                      </div>
                    </div>
                    <div className="flex items-center justify-between text-xs font-medium text-ag-dark-text-secondary text-left">
                      <span>{variationColumnHeaders[index]}</span>
                    </div>
                  </React.Fragment>
                ))}
                <div className="text-xs font-medium text-ag-dark-text-secondary"></div>
              </div>
            </div>

            {/* Table Rows */}
            <div className="divide-y divide-ag-dark-border">
              {tieredValueRows.map((row, rowIndex) => (
                  <div 
                    key={row.id} 
                    className="grid gap-2 p-2 hover:bg-ag-dark-bg/50"
                    style={{ gridTemplateColumns: `40px repeat(${columnHeaders.length * 2}, 250px) auto` }}
                  >
                    <div className="flex items-center text-xs text-ag-dark-text-secondary">
                      {rowIndex + 1}
                    </div>
                    {row.values.map((value, colIndex) => (
                      <React.Fragment key={colIndex}>
                        {/* Value Column */}
                        <div className="flex items-center">
                          {editingCell?.rowId === row.id && editingCell?.colIndex === colIndex && !editingCell?.isVariation ? (
                            <input
                              type="text"
                              value={editValue}
                              onChange={(e) => handleCellChange(e.target.value)}
                              onBlur={handleCellBlur}
                              onKeyDown={(e) => handleCellKeyDown(e, row.id, colIndex, false)}
                              onPaste={(e) => handlePaste(e, row.id, colIndex, false)}
                              autoFocus
                              className="w-full px-2 py-1 bg-ag-dark-bg border border-ag-dark-accent rounded text-sm text-ag-dark-text focus:ring-1 focus:ring-ag-dark-accent text-left"
                            />
                          ) : (
                            <div
                              onClick={() => {
                                // Save any currently editing cell before switching
                                if (editingCell) {
                                  const currentEditValue = editValue;
                                  const currentEditingCell = editingCell;
                                  setTieredValueRows(prev => prev.map(r => {
                                    if (r.id === currentEditingCell.rowId) {
                                      if (currentEditingCell.isVariation) {
                                        const newVariations = [...r.variations];
                                        newVariations[currentEditingCell.colIndex] = currentEditValue;
                                        return { ...r, variations: newVariations };
                                      } else {
                                        const newValues = [...r.values];
                                        newValues[currentEditingCell.colIndex] = currentEditValue;
                                        return { ...r, values: newValues };
                                      }
                                    }
                                    return r;
                                  }));
                                  setEditingCell(null);
                                  setEditValue('');
                                }
                                // Small delay to ensure state is saved before switching
                                setTimeout(() => {
                                  handleCellClick(row.id, colIndex, value, false);
                                }, 0);
                              }}
                              className="w-full px-2 py-1 bg-ag-dark-surface border border-ag-dark-border rounded text-sm text-ag-dark-text cursor-text hover:border-ag-dark-accent min-h-[32px] flex items-center text-left"
                              tabIndex={0}
                              onFocus={() => {
                                // Save any currently editing cell before switching
                                if (editingCell) {
                                  const currentEditValue = editValue;
                                  const currentEditingCell = editingCell;
                                  setTieredValueRows(prev => prev.map(r => {
                                    if (r.id === currentEditingCell.rowId) {
                                      if (currentEditingCell.isVariation) {
                                        const newVariations = [...r.variations];
                                        newVariations[currentEditingCell.colIndex] = currentEditValue;
                                        return { ...r, variations: newVariations };
                                      } else {
                                        const newValues = [...r.values];
                                        newValues[currentEditingCell.colIndex] = currentEditValue;
                                        return { ...r, values: newValues };
                                      }
                                    }
                                    return r;
                                  }));
                                  setEditingCell(null);
                                  setEditValue('');
                                }
                                // Small delay to ensure state is saved before switching
                                setTimeout(() => {
                                  handleCellClick(row.id, colIndex, value, false);
                                }, 0);
                              }}
                            >
                              {value || <span className="text-ag-dark-text-secondary opacity-0">Click to edit</span>}
                            </div>
                          )}
                        </div>
                        {/* Variation Column */}
                        <div className="flex items-center">
                          {editingCell?.rowId === row.id && editingCell?.colIndex === colIndex && editingCell?.isVariation ? (
                            <input
                              type="text"
                              value={editValue}
                              onChange={(e) => handleCellChange(e.target.value)}
                              onBlur={handleCellBlur}
                              onKeyDown={(e) => handleCellKeyDown(e, row.id, colIndex, true)}
                              onPaste={(e) => handlePaste(e, row.id, colIndex, true)}
                              autoFocus
                              className="w-full px-2 py-1 bg-ag-dark-bg border border-ag-dark-accent rounded text-sm text-ag-dark-text focus:ring-1 focus:ring-ag-dark-accent text-left"
                            />
                          ) : (
                            <div
                              onClick={() => {
                                // Save any currently editing cell before switching
                                if (editingCell) {
                                  const currentEditValue = editValue;
                                  const currentEditingCell = editingCell;
                                  setTieredValueRows(prev => prev.map(r => {
                                    if (r.id === currentEditingCell.rowId) {
                                      if (currentEditingCell.isVariation) {
                                        const newVariations = [...r.variations];
                                        newVariations[currentEditingCell.colIndex] = currentEditValue;
                                        return { ...r, variations: newVariations };
                                      } else {
                                        const newValues = [...r.values];
                                        newValues[currentEditingCell.colIndex] = currentEditValue;
                                        return { ...r, values: newValues };
                                      }
                                    }
                                    return r;
                                  }));
                                  setEditingCell(null);
                                  setEditValue('');
                                }
                                // Small delay to ensure state is saved before switching
                                setTimeout(() => {
                                  handleCellClick(row.id, colIndex, row.variations[colIndex] || '', true);
                                }, 0);
                              }}
                              className="w-full px-2 py-1 bg-ag-dark-surface border border-ag-dark-border rounded text-sm text-ag-dark-text cursor-text hover:border-ag-dark-accent min-h-[32px] flex items-center text-left"
                              tabIndex={0}
                              onFocus={() => {
                                // Save any currently editing cell before switching
                                if (editingCell) {
                                  const currentEditValue = editValue;
                                  const currentEditingCell = editingCell;
                                  setTieredValueRows(prev => prev.map(r => {
                                    if (r.id === currentEditingCell.rowId) {
                                      if (currentEditingCell.isVariation) {
                                        const newVariations = [...r.variations];
                                        newVariations[currentEditingCell.colIndex] = currentEditValue;
                                        return { ...r, variations: newVariations };
                                      } else {
                                        const newValues = [...r.values];
                                        newValues[currentEditingCell.colIndex] = currentEditValue;
                                        return { ...r, values: newValues };
                                      }
                                    }
                                    return r;
                                  }));
                                  setEditingCell(null);
                                  setEditValue('');
                                }
                                // Small delay to ensure state is saved before switching
                                setTimeout(() => {
                                  handleCellClick(row.id, colIndex, row.variations[colIndex] || '', true);
                                }, 0);
                              }}
                            >
                              {row.variations[colIndex] || <span className="text-ag-dark-text-secondary opacity-0">Click to edit</span>}
                            </div>
                          )}
                        </div>
                      </React.Fragment>
                    ))}
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => handleDeleteRow(row.id)}
                        className="p-1 text-ag-dark-error hover:text-red-400 transition-colors rounded hover:bg-red-900/20"
                        title="Delete row"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                ))
              }
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between p-4 border-t border-ag-dark-border">
          <button
            onClick={() => handleAddRow()}
            className="px-4 py-2 border border-ag-dark-border rounded text-ag-dark-text hover:bg-ag-dark-bg transition-colors flex items-center gap-2"
          >
            <Plus className="w-4 h-4" />
            Add Row
          </button>
          <div className="flex items-center gap-2">
            <button
              onClick={onClose}
              className="px-4 py-2 border border-ag-dark-border rounded text-ag-dark-text hover:bg-ag-dark-bg transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              className="px-4 py-2 bg-ag-dark-accent text-white rounded hover:bg-ag-dark-accent-hover transition-colors flex items-center gap-2"
            >
              <Save className="w-4 h-4" />
              Save Changes
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

