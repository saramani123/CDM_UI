import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Settings, Save, X, Trash2, Plus, Link, Layers, Upload, ChevronRight, ChevronDown, Database, Users, Key, ArrowUpAZ, ArrowDownZA } from 'lucide-react';
import { getAvatarOptions, concatenateDrivers, parseDriverString } from '../data/mockData';
import { useDrivers } from '../hooks/useDrivers';
import { CsvUploadModal } from './CsvUploadModal';
import { apiService } from '../services/api';

interface MetadataField {
  key: string;
  label: string;
  type: 'text' | 'select' | 'number';
  options?: string[];
  value?: string | number;
}

interface CompositeKey {
  id: string;
  part: string;
  group: string;
}

interface Variant {
  id: string;
  name: string;
}

interface Relationship {
  id: string;
  type: 'Blood' | 'Intra-Table' | 'Inter-Table';
  role: string;
  toBeing: string;
  toAvatar: string;
  toObject: string;
}

interface MetadataPanelProps {
  fields: MetadataField[];
  onSave?: (data: Record<string, any>) => void;
  onClose?: () => void;
  selectedObject?: any;
  allData?: any[];
  selectedCount?: number;
  affectedObjectIds?: Set<string>;
  deletedDriverType?: string | null;
  onEnterRelationshipView?: () => void;
}

export const MetadataPanel: React.FC<MetadataPanelProps> = ({
  fields,
  onSave,
  onClose,
  selectedObject,
  allData = [],
  selectedCount = 0,
  affectedObjectIds = new Set(),
  deletedDriverType = null,
  onEnterRelationshipView
}) => {
  const [formData, setFormData] = useState<Record<string, any>>(() => {
    // Initialize form data from selected object if available
    if (selectedObject) {
      return {
        being: selectedObject.being || '',
        avatar: selectedObject.avatar || '',
        object: selectedObject.object || ''
      };
    }
    // Fallback to empty values
    return {
      being: '',
      avatar: '',
      object: ''
    };
  });

  // Driver selections state
  const [driverSelections, setDriverSelections] = useState(() => {
    if (selectedObject?.driver) {
      return parseDriverString(selectedObject.driver);
    }
    return {
      sector: [],
      domain: [],
      country: [],
      objectClarifier: ''
    };
  });

  const { drivers: driversData } = useDrivers();
  // Collapsible sections state
  const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({
    drivers: false,
    ontology: false,
    identifiers: false,
    relationships: false,
    variants: false
  });

  // Track the previous selected object ID to detect actual object changes
  const prevSelectedObjectId = useRef<string | null>(null);
  const isUserTyping = useRef(false);
  const typingTimeout = useRef<NodeJS.Timeout | null>(null);
  
  // Update form data when a new object is selected (not on every field change)
  React.useEffect(() => {
    const currentObjectId = selectedObject?.id;
    
    // Only reset form data when the selected object actually changes AND we have a valid object AND user is not typing
    if (currentObjectId && currentObjectId !== prevSelectedObjectId.current && !isUserTyping.current) {
      console.log('MetadataPanel: selected object changed from', prevSelectedObjectId.current, 'to', currentObjectId);
      prevSelectedObjectId.current = currentObjectId;
      
      // Initialize form data from the selected object, not from fields
      const newFormData: Record<string, any> = {
        being: selectedObject?.being || '',
        avatar: selectedObject?.avatar || '',
        object: selectedObject?.object || ''
      };
      console.log('MetadataPanel: newFormData for new object', newFormData);
      setFormData(newFormData);
    }
    
    // Update driver selections when selected object changes
    if (selectedObject?.driver) {
      setDriverSelections(parseDriverString(selectedObject.driver));
    } else {
      setDriverSelections({
        sector: [],
        domain: [],
        country: [],
        objectClarifier: ''
      });
    }
  }, [selectedObject?.id]); // Only reset when object actually changes

  // Get dynamic avatar options based on current being and driver values
  const avatarOptions = getAvatarOptions(formData.being || '', formData.driver || '', allData);

  // Initialize composite keys state
  const [discreteId, setDiscreteId] = useState('Public ID');
  const [compositeKeys, setCompositeKeys] = useState<CompositeKey[]>([
    { id: '1', part: '', group: '' },
    { id: '2', part: '', group: '' },
    { id: '3', part: '', group: '' },
    { id: '4', part: '', group: '' },
    { id: '5', part: '', group: '' }
  ]);

  // Initialize relationships state
  const [relationships, setRelationships] = useState<Relationship[]>([]);

  // Initialize variants state - using string for multiline input
  const [variantsText, setVariantsText] = useState('');

  // CSV upload modal states
  const [isRelationshipUploadOpen, setIsRelationshipUploadOpen] = useState(false);
  const [isVariantUploadOpen, setIsVariantUploadOpen] = useState(false);

  // Load relationships when selectedObject changes
  React.useEffect(() => {
    if (selectedObject?.id) {
      console.log('MetadataPanel: Loading relationships for object:', selectedObject.object, 'id:', selectedObject.id);
      
      const loadRelationships = async () => {
        try {
          const relationshipData = await apiService.getObjectRelationships(selectedObject.id);
          console.log('MetadataPanel: API relationship data:', relationshipData);
          const relationshipsList = relationshipData?.relationshipsList || [];
          console.log('MetadataPanel: loaded relationships from API:', relationshipsList);
          setRelationships(relationshipsList);
        } catch (error) {
          console.error('MetadataPanel: failed to load relationships:', error);
          setRelationships([]);
        }
      };
      
      loadRelationships();
    } else {
      setRelationships([]);
    }
  }, [selectedObject?.id]);

  // Load variants when selectedObject changes
  React.useEffect(() => {
    if (selectedObject?.id) {
      console.log('MetadataPanel: Loading variants for object:', selectedObject.object, 'id:', selectedObject.id);
      
      const loadVariants = async () => {
        try {
          const variantData = await apiService.getObjectVariants(selectedObject.id);
          console.log('MetadataPanel: API variant data:', variantData);
          const variantsList = variantData?.variantsList || [];
          console.log('MetadataPanel: loaded variants from API:', variantsList);
          // Convert variants array to multiline text
          const variantsTextContent = variantsList.map(v => v.name).join('\n');
          setVariantsText(variantsTextContent);
        } catch (error) {
          console.error('MetadataPanel: failed to load variants:', error);
          setVariantsText('');
        }
      };
      
      loadVariants();
    } else {
      setVariantsText('');
    }
  }, [selectedObject?.id]);

  // Get distinct values from data
  const getDistinctBeings = () => {
    const beings = [...new Set(allData.map(item => item.being))];
    return ['ALL', ...beings];
  };

  const getDistinctAvatarsForBeing = (being: string) => {
    if (being === 'ALL') return ['ALL'];
    const avatars = [...new Set(allData.filter(item => item.being === being).map(item => item.avatar))];
    return ['ALL', ...avatars];
  };

  const getDistinctObjectsForBeingAndAvatar = (being: string, avatar: string) => {
    if (being === 'ALL' || avatar === 'ALL') return ['ALL'];
    const objects = [...new Set(allData.filter(item => 
      item.being === being && item.avatar === avatar
    ).map(item => item.object))];
    return ['ALL', ...objects];
  };

  // Mock options for Part and Group (will be replaced with Variables tab data later)
  const partOptions = ['Name', 'ID', 'Code', 'Reference', 'Key'];
  const groupOptions = ['Primary', 'Secondary', 'Tertiary', 'System', 'User'];

  // Check if panel should be enabled (exactly 1 object selected)
  const isPanelEnabled = selectedCount === 1;
  
  // Check if the selected object is affected by driver deletion
  const isSelectedObjectAffected = selectedObject && affectedObjectIds.has(selectedObject.id);
  
  // Check which specific drivers are deleted
  const getDeletedDrivers = (driverString: string) => {
    if (!driverString) return [];
    const parts = driverString.split(', ');
    const deleted = [];
    if (parts.length >= 4) {
      // Check if any part is exactly "-" (indicating deleted driver)
      // Don't flag hyphens within names like "E-commerce"
      if (parts[0] === '-') deleted.push('sectors');
      if (parts[1] === '-') deleted.push('domains');
      if (parts[2] === '-') deleted.push('countries');
      if (parts[3] === '-') deleted.push('objectClarifiers');
    }
    return deleted;
  };
  
  const deletedDrivers = selectedObject ? getDeletedDrivers(selectedObject.driver) : [];
  const isSectorDeleted = deletedDrivers.includes('sectors') || (isSelectedObjectAffected && deletedDriverType === 'sectors');
  const isDomainDeleted = deletedDrivers.includes('domains') || (isSelectedObjectAffected && deletedDriverType === 'domains');
  const isCountryDeleted = deletedDrivers.includes('countries') || (isSelectedObjectAffected && deletedDriverType === 'countries');
  const isObjectClarifierDeleted = deletedDrivers.includes('objectClarifiers') || (isSelectedObjectAffected && deletedDriverType === 'objectClarifiers');

  const toggleSection = (sectionKey: string) => {
    setExpandedSections(prev => ({
      ...prev,
      [sectionKey]: !prev[sectionKey]
    }));
  };

  const handleChange = (key: string, value: string | number) => {
    console.log('MetadataPanel handleChange called:', { key, value });
    
    // Mark user as typing
    isUserTyping.current = true;
    
    // Clear existing timeout
    if (typingTimeout.current) {
      clearTimeout(typingTimeout.current);
    }
    
    // Set timeout to mark user as no longer typing
    typingTimeout.current = setTimeout(() => {
      isUserTyping.current = false;
    }, 500); // 500ms delay after last keystroke
    
    setFormData(prev => {
      const newFormData = {
        ...prev,
        [key]: value
      };
      console.log('MetadataPanel newFormData after change:', newFormData);
      return newFormData;
    });
  };

  const handleDriverSelectionChange = (type: 'sector' | 'domain' | 'country', values: string[]) => {
    setDriverSelections(prev => ({
      ...prev,
      [type]: values
    }));
  };

  const handleObjectClarifierChange = (value: string) => {
    setDriverSelections(prev => ({
      ...prev,
      objectClarifier: value
    }));
  };
  const handleCompositeKeyChange = (id: string, field: 'part' | 'group', value: string) => {
    setCompositeKeys(prev => prev.map(key => 
      key.id === id ? { ...key, [field]: value } : key
    ));
  };

  const handleDeleteCompositeKey = (id: string) => {
    setCompositeKeys(prev => prev.map(key => 
      key.id === id ? { ...key, part: '', group: '' } : key
    ));
  };

  const handleRelationshipChange = useCallback((id: string, field: keyof Relationship, value: string) => {
    console.log(`DEBUG: handleRelationshipChange called with id=${id}, field=${field}, value="${value}"`);
    
    setRelationships(prev => prev.map(rel => {
      if (rel.id === id) {
        const updated = { ...rel, [field]: value };
        
        // Handle Intra-Table logic
        if (field === 'type' && value === 'Intra-Table' && selectedObject) {
          // Auto-populate with selected object's values and make unchangeable
          updated.toBeing = selectedObject.being;
          updated.toAvatar = selectedObject.avatar;
          updated.toObject = selectedObject.object;
        } else if (field === 'type' && value !== 'Intra-Table') {
          // Reset fields when switching away from Intra-Table
          updated.toBeing = '';
          updated.toAvatar = '';
          updated.toObject = '';
        } else if (updated.type !== 'Intra-Table') {
          // Handle cascading updates for non-Intra-Table types
          if (field === 'toBeing' && value === 'ALL') {
            updated.toAvatar = 'ALL';
            updated.toObject = 'ALL';
          } else if (field === 'toAvatar' && value === 'ALL') {
            updated.toObject = 'ALL';
          } else if (field === 'toBeing' && value !== 'ALL') {
            // Reset avatar and object when being changes
            updated.toAvatar = '';
            updated.toObject = '';
          } else if (field === 'toAvatar' && value !== 'ALL') {
            // Reset object when avatar changes
            updated.toObject = '';
          }
        }
        
        console.log(`DEBUG: Updated relationship:`, updated);
        return updated;
      }
      return rel;
    }));
  }, [selectedObject]);

  const addRelationship = () => {
    const newRelationship: Relationship = {
      id: Date.now().toString(),
      type: 'Inter-Table',
      role: '',
      toBeing: '',
      toAvatar: '',
      toObject: ''
    };
    setRelationships(prev => [...prev, newRelationship]);
  };

  const deleteRelationship = (id: string) => {
    setRelationships(prev => prev.filter(rel => rel.id !== id));
  };

  const variantsTextareaRef = useRef<HTMLTextAreaElement>(null);
  const isTextareaFocusedRef = useRef<boolean>(false);
  const lastChangeTimeRef = useRef<number>(0);

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

  const handleRelationshipCsvUpload = async (data: any[] | File) => {
    if (!selectedObject?.id) {
      alert('No object selected for relationship upload');
      return;
    }

    // Check if it's a File (new API-based upload) or array (old client-side parsing)
    if (data instanceof File) {
      try {
        const result = await apiService.bulkUploadRelationships(selectedObject.id, data);
        console.log('Bulk relationships upload result:', result);
        
        const response = result as any;
        
        // Check if there were errors (including duplicates)
        if (!response.success || (response.errors && response.errors.length > 0)) {
          // Show detailed error message with all issues
          const errorMessages = response.errors ? response.errors.join('\n') : 'Unknown errors occurred';
          alert(`Relationships upload completed with issues:\n\n${response.message}\n\nErrors:\n${errorMessages}`);
        } else {
          // Show success message
          alert(response.message || `Successfully uploaded ${response.created_count} relationships`);
        }
        
        // Refresh the relationships list by fetching the updated object data
        // This will trigger a re-render with the new relationships
        window.location.reload(); // Simple refresh for now
      } catch (error) {
        console.error('Bulk relationships upload failed:', error);
        alert(`Relationships upload failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
    } else {
      // Old client-side parsing logic (for backward compatibility)
      setRelationships(prev => [...prev, ...data]);
    }
  };

  const handleVariantCsvUpload = async (data: any[] | File) => {
    if (!selectedObject?.id) {
      alert('No object selected for variant upload');
      return;
    }

    // Check if it's a File (new API-based upload) or array (old client-side parsing)
    if (data instanceof File) {
      try {
        const result = await apiService.bulkUploadVariants(selectedObject.id, data);
        console.log('Bulk variants upload result:', result);
        
        // Show success message
        const response = result as any;
        alert(response.message || `Successfully uploaded ${response.created_count} variants`);
        
        // Refresh the variants list by fetching the updated variants
        try {
          const variantData = await apiService.getObjectVariants(selectedObject.id);
          const variantsList = variantData?.variantsList || [];
          // Convert variants array to multiline text
          const variantsTextContent = variantsList.map(v => v.name).join('\n');
          setVariantsText(variantsTextContent);
          console.log('MetadataPanel: refreshed variants after upload:', variantsList);
        } catch (error) {
          console.error('MetadataPanel: failed to refresh variants after upload:', error);
        }
      } catch (error) {
        console.error('Bulk variants upload failed:', error);
        alert(`Variants upload failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
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


  const handleSave = () => {
    console.log('🔴 MetadataPanel handleSave called');
    console.log('🔴 Current formData:', formData);
    console.log('🔴 Current driverSelections:', driverSelections);
    console.log('🔴 Selected object:', selectedObject);
    
    // Generate driver string from selections
    const driverString = concatenateDrivers(
      driverSelections.sector,
      driverSelections.domain,
      driverSelections.country,
      driverSelections.objectClarifier
    );
    
    console.log('🔴 Generated driverString:', driverString);
    
    // Remove duplicate relationships based on unique combination of properties
    const uniqueRelationships = relationships.reduce((acc, rel) => {
      if (!acc.some(existing => 
        existing.role === rel.role && 
        existing.toBeing === rel.toBeing && 
        existing.toAvatar === rel.toAvatar && 
        existing.toObject === rel.toObject && 
        existing.type === rel.type
      )) {
        acc.push(rel);
      }
      return acc;
    }, [] as Relationship[]);
    
    console.log('DEBUG: Original relationships count:', relationships.length);
    console.log('DEBUG: Unique relationships count:', uniqueRelationships.length);
    console.log('DEBUG: Duplicate relationships removed:', relationships.length - uniqueRelationships.length);
    
    // Convert multiline text to variants array
    const variantsList = variantsText
      .split('\n')
      .map(line => line.trim())
      .filter(line => line.length > 0)
      .map((name, index) => ({
        id: (Date.now() + index).toString(),
        name
      }));
    
    // Check for duplicate variant names (case-insensitive)
    const uniqueVariantNames = new Set(variantsList.map(v => v.name.toLowerCase()));
    
    if (variantsList.length !== uniqueVariantNames.size) {
      const duplicateNames = variantsList.filter((variant, index) => 
        variantsList.findIndex(v => v.name.toLowerCase() === variant.name.toLowerCase()) !== index
      ).map(v => v.name);
      
      alert(`Cannot save: Duplicate variant names found: ${duplicateNames.join(', ')}. Please remove duplicates before saving.`);
      return;
    }
    
    const saveData = {
      ...formData,
      // Use the form data object value (user input)
      object: formData.object,
      driver: driverString,
      identifier: {
        discreteId,
        compositeKeys: compositeKeys.filter(key => key.part || key.group)
      },
      relationshipsList: uniqueRelationships,
      variantsList: variantsList
    };
    console.log('🔴 MetadataPanel saving data:', saveData);
    console.log('🔴 Relationships:', uniqueRelationships);
    console.log('🔴 Variants:', variantsList);
    console.log('🔴 Calling onSave with:', saveData);
    onSave?.(saveData);
  };

  // Multi-select component
  const MultiSelect: React.FC<{
    label: string;
    options: string[];
    values: string[];
    onChange: (values: string[]) => void;
    disabled?: boolean;
  }> = ({ label, options, values, onChange, disabled }) => {
    const [isOpen, setIsOpen] = useState(false);
    const dropdownRef = useRef<HTMLDivElement>(null);
    

    // Close dropdown when clicking outside
    useEffect(() => {
      const handleClickOutside = (event: MouseEvent) => {
        if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
          setIsOpen(false);
        }
      };

      if (isOpen) {
        document.addEventListener('mousedown', handleClickOutside);
      }

      return () => {
        document.removeEventListener('mousedown', handleClickOutside);
      };
    }, [isOpen]);
    
    const handleToggle = (option: string) => {
      if (option === 'ALL') {
        if (values.includes('ALL')) {
          onChange([]);
        } else {
          // When ALL is selected, select ALL individual values too
          const allIndividualValues = options.filter(opt => opt !== 'ALL');
          onChange(['ALL', ...allIndividualValues]);
        }
      } else {
        const newValues = values.includes(option)
          ? values.filter(v => v !== option && v !== 'ALL')
          : [...values.filter(v => v !== 'ALL'), option];
        
        // If all individual values are selected, also select ALL
        const allIndividualValues = options.filter(opt => opt !== 'ALL');
        const allSelected = allIndividualValues.every(opt => newValues.includes(opt));
        if (allSelected && allIndividualValues.length > 0) {
          onChange(['ALL', ...newValues]);
        } else {
          onChange(newValues);
        }
      }
      // Keep dropdown open for multiple selections
    };

    const displayText = values.length === 0 
      ? (options.length === 0 ? `No values found — please add new items in Drivers tab` : `Select ${label}`)
      : values.includes('ALL') 
        ? 'ALL' 
        : values.length === 1 
          ? values[0] 
          : `${values.length} selected`;

    return (
      <div className="relative" ref={dropdownRef}>
        <button
          type="button"
          onClick={() => !disabled && setIsOpen(!isOpen)}
          disabled={disabled}
          className={`w-full px-3 py-2 pr-10 bg-ag-dark-bg border border-ag-dark-border rounded text-ag-dark-text focus:ring-2 focus:ring-ag-dark-accent focus:border-ag-dark-accent text-left ${
            disabled ? 'opacity-50 cursor-not-allowed' : ''
          }`}
          style={{
            backgroundImage: `url("data:image/svg+xml,%3csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 20 20'%3e%3cpath stroke='%236b7280' stroke-linecap='round' stroke-linejoin='round' stroke-width='1.5' d='m6 8 4 4 4-4'/%3e%3c/svg%3e")`,
            backgroundPosition: 'right 12px center',
            backgroundRepeat: 'no-repeat',
            backgroundSize: '16px'
          }}
        >
          {displayText}
        </button>
        
        {isOpen && (
          <div className="absolute z-10 w-full mt-1 bg-ag-dark-surface border border-ag-dark-border rounded-lg shadow-lg max-h-60 overflow-y-auto">
            {options.length === 0 ? (
              <div className="px-3 py-2 text-sm text-ag-dark-text-secondary italic">
                No values found — please add new items in Drivers tab
              </div>
            ) : (
              options.map((option) => (
                <label
                  key={option}
                  className="flex items-center gap-2 px-3 py-2 hover:bg-ag-dark-bg cursor-pointer"
                  onClick={(e) => e.stopPropagation()}
                >
                  <input
                    type="checkbox"
                    checked={values.includes(option)}
                    onChange={() => handleToggle(option)}
                    className="rounded border-ag-dark-border bg-ag-dark-bg text-ag-dark-accent focus:ring-ag-dark-accent focus:ring-2 focus:ring-offset-0"
                  />
                  <span className="text-sm text-ag-dark-text">{option}</span>
                </label>
              ))
            )}
          </div>
        )}
      </div>
    );
  };
  const CollapsibleSection: React.FC<{
    title: string;
    sectionKey: string;
    icon?: React.ReactNode;
    actions?: React.ReactNode;
    children: React.ReactNode;
  }> = ({ title, sectionKey, icon, actions, children }) => {
    const isExpanded = expandedSections[sectionKey];
    
    return (
      <div className="border-t border-ag-dark-border pt-8">
        <div 
          className="flex items-center justify-between cursor-pointer hover:bg-ag-dark-bg rounded p-3 -m-3 transition-colors mb-4"
          onClick={() => toggleSection(sectionKey)}
        >
          <div className="flex items-center gap-2">
            {isExpanded ? (
              <ChevronDown className="w-4 h-4 text-ag-dark-text-secondary" />
            ) : (
              <ChevronRight className="w-4 h-4 text-ag-dark-text-secondary" />
            )}
            {icon}
            <h4 className="text-md font-semibold text-ag-dark-text">{title}</h4>
          </div>
          {isExpanded && actions && (
            <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
              {actions}
            </div>
          )}
        </div>
        
        {isExpanded && (
          <div 
            className="mt-6 ml-6 pb-6"
            onClick={(e) => e.stopPropagation()}
            onMouseDown={(e) => e.stopPropagation()}
            onKeyDown={(e) => e.stopPropagation()}
          >
            {children}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="bg-ag-dark-surface rounded-lg border border-ag-dark-border p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-2">
          <Settings className="w-5 h-5 text-ag-dark-text-secondary" />
          <h3 className="text-lg font-semibold text-ag-dark-text">Metadata</h3>
        </div>
        {onClose && (
          <button
            onClick={onClose}
            className="text-ag-dark-text-secondary hover:text-ag-dark-text transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        )}
      </div>

      {/* Object Name Field - Moved out of collapsible section */}
      <div className="mb-6">
        <label className="block text-sm font-medium text-ag-dark-text mb-2">
          Object Name
        </label>
        <input
          type="text"
          value={formData.object}
          onChange={(e) => handleChange('object', e.target.value)}
          disabled={!isPanelEnabled}
          onClick={(e) => e.stopPropagation()}
          className={`w-full px-3 py-2 bg-ag-dark-bg border border-ag-dark-border rounded text-ag-dark-text placeholder-ag-dark-text-secondary focus:ring-2 focus:ring-ag-dark-accent focus:border-ag-dark-accent ${
            !isPanelEnabled ? 'opacity-50 cursor-not-allowed' : ''
          }`}
        />
      </div>

      {/* Drivers Section */}
      <CollapsibleSection title="Drivers" sectionKey="drivers" icon={<Database className="w-4 h-4 text-ag-dark-text-secondary" />}>
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-ag-dark-text mb-2">
              Sector
              {(driverSelections.sector.length === 0 || isSectorDeleted) && (
                <span className="text-red-500 ml-1">*</span>
              )}
            </label>
            {isSectorDeleted ? (
              <div className="text-red-400 text-sm mb-2">
                Please reselect sector
              </div>
            ) : driverSelections.sector.length === 0 ? (
              <div className="text-red-400 text-sm mb-2">
                Please select a relevant Sector
              </div>
            ) : null}
            <MultiSelect
              label="Sector"
              options={['ALL', ...driversData.sectors]}
              values={isSectorDeleted ? [] : driverSelections.sector}
              onChange={(values) => handleDriverSelectionChange('sector', values)}
              disabled={!isPanelEnabled}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-ag-dark-text mb-2">
              Domain
              {(driverSelections.domain.length === 0 || isDomainDeleted) && (
                <span className="text-red-500 ml-1">*</span>
              )}
            </label>
            {isDomainDeleted ? (
              <div className="text-red-400 text-sm mb-2">
                Please reselect domain
              </div>
            ) : driverSelections.domain.length === 0 ? (
              <div className="text-red-400 text-sm mb-2">
                Please select a relevant Domain
              </div>
            ) : null}
            <MultiSelect
              label="Domain"
              options={['ALL', ...driversData.domains]}
              values={isDomainDeleted ? [] : driverSelections.domain}
              onChange={(values) => handleDriverSelectionChange('domain', values)}
              disabled={!isPanelEnabled}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-ag-dark-text mb-2">
              Country
              {(driverSelections.country.length === 0 || isCountryDeleted) && (
                <span className="text-red-500 ml-1">*</span>
              )}
            </label>
            {isCountryDeleted ? (
              <div className="text-red-400 text-sm mb-2">
                Please reselect country
              </div>
            ) : driverSelections.country.length === 0 ? (
              <div className="text-red-400 text-sm mb-2">
                Please select a relevant Country
              </div>
            ) : null}
            <MultiSelect
              label="Country"
              options={['ALL', ...driversData.countries]}
              values={isCountryDeleted ? [] : driverSelections.country}
              onChange={(values) => handleDriverSelectionChange('country', values)}
              disabled={!isPanelEnabled}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-ag-dark-text mb-2">
              Object Clarifier
              {isObjectClarifierDeleted && (
                <span className="text-red-500 ml-1">*</span>
              )}
            </label>
            {isObjectClarifierDeleted && (
              <div className="text-red-400 text-sm mb-2">
                Please reselect object clarifier
              </div>
            )}
            <select
              value={isObjectClarifierDeleted ? "" : driverSelections.objectClarifier}
              onChange={(e) => handleObjectClarifierChange(e.target.value)}
              disabled={!isPanelEnabled}
              className={`w-full px-3 py-2 pr-10 bg-ag-dark-bg border border-ag-dark-border rounded text-ag-dark-text focus:ring-2 focus:ring-ag-dark-accent focus:border-ag-dark-accent appearance-none ${
                !isPanelEnabled ? 'opacity-50 cursor-not-allowed' : ''
              }`}
              style={{
                backgroundImage: `url("data:image/svg+xml,%3csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 20 20'%3e%3cpath stroke='%236b7280' stroke-linecap='round' stroke-linejoin='round' stroke-width='1.5' d='m6 8 4 4 4-4'/%3e%3c/svg%3e")`,
                backgroundPosition: 'right 12px center',
                backgroundRepeat: 'no-repeat',
                backgroundSize: '16px'
              }}
            >
              <option value="">None</option>
              {driversData.objectClarifiers.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
          </div>
        </div>
      </CollapsibleSection>

      {/* Ontology Section */}
      <CollapsibleSection title="Ontology" sectionKey="ontology" icon={<Users className="w-4 h-4 text-ag-dark-text-secondary" />}>
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-ag-dark-text mb-2">
              Being
            </label>
            <select
              value={formData.being}
              onChange={(e) => handleChange('being', e.target.value)}
              disabled={!isPanelEnabled}
              className={`w-full px-3 py-2 pr-10 bg-ag-dark-bg border border-ag-dark-border rounded text-ag-dark-text focus:ring-2 focus:ring-ag-dark-accent focus:border-ag-dark-accent appearance-none ${
                !isPanelEnabled ? 'opacity-50 cursor-not-allowed' : ''
              }`}
              style={{
                backgroundImage: `url("data:image/svg+xml,%3csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 20 20'%3e%3cpath stroke='%236b7280' stroke-linecap='round' stroke-linejoin='round' stroke-width='1.5' d='m6 8 4 4 4-4'/%3e%3c/svg%3e")`,
                backgroundPosition: 'right 12px center',
                backgroundRepeat: 'no-repeat',
                backgroundSize: '16px'
              }}
            >
              <option value="">Select Being</option>
              {fields.find(f => f.key === 'being')?.options?.map(option => (
                <option key={option} value={option}>{option}</option>
              )) || [
                'Master', 'Mate', 'Process', 'Adjunct', 'Rule', 'Roster'
              ].map(option => (
                <option key={option} value={option}>{option}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-ag-dark-text mb-2">
              Avatar
            </label>
            <select
              value={formData.avatar}
              onChange={(e) => handleChange('avatar', e.target.value)}
              disabled={!isPanelEnabled}
              className={`w-full px-3 py-2 pr-10 bg-ag-dark-bg border border-ag-dark-border rounded text-ag-dark-text focus:ring-2 focus:ring-ag-dark-accent focus:border-ag-dark-accent appearance-none ${
                !isPanelEnabled ? 'opacity-50 cursor-not-allowed' : ''
              }`}
              style={{
                backgroundImage: `url("data:image/svg+xml,%3csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 20 20'%3e%3cpath stroke='%236b7280' stroke-linecap='round' stroke-linejoin='round' stroke-width='1.5' d='m6 8 4 4 4-4'/%3e%3c/svg%3e")`,
                backgroundPosition: 'right 12px center',
                backgroundRepeat: 'no-repeat',
                backgroundSize: '16px'
              }}
            >
              <option value="">Select Avatar</option>
              {avatarOptions.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
          </div>

        </div>
      </CollapsibleSection>

      {/* Identifiers Section */}
      <CollapsibleSection title="Identifiers" sectionKey="identifiers" icon={<Key className="w-4 h-4 text-ag-dark-text-secondary" />}>
        <div className="space-y-4">
          {/* Discrete ID */}
          <div>
            <label className="block text-sm font-medium text-ag-dark-text mb-2">
              Discrete ID
            </label>
            <select
              value={discreteId}
              onChange={(e) => setDiscreteId(e.target.value)}
              disabled={!isPanelEnabled}
              className={`w-full px-3 py-2 pr-10 bg-ag-dark-bg border border-ag-dark-border rounded text-ag-dark-text focus:ring-2 focus:ring-ag-dark-accent focus:border-ag-dark-accent appearance-none ${
                !isPanelEnabled ? 'opacity-50 cursor-not-allowed' : ''
              }`}
              style={{
                backgroundImage: `url("data:image/svg+xml,%3csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 20 20'%3e%3cpath stroke='%236b7280' stroke-linecap='round' stroke-linejoin='round' stroke-width='1.5' d='m6 8 4 4 4-4'/%3e%3c/svg%3e")`,
                backgroundPosition: 'right 12px center',
                backgroundRepeat: 'no-repeat',
                backgroundSize: '16px'
              }}
            >
              <option value="Public ID">Public ID</option>
              <option value="Proprietary ID">Proprietary ID</option>
            </select>
          </div>

          {/* Composite Keys */}
          <div className="space-y-4">
            <h5 className="text-sm font-medium text-ag-dark-text">Composite Keys</h5>
            {compositeKeys.map((compositeKey) => (
              <div key={compositeKey.id} className="bg-ag-dark-bg rounded-lg p-4 border border-ag-dark-border">
                <div className="flex items-center justify-between mb-3">
                  <span className="text-sm font-medium text-ag-dark-text">
                    Composite Key #{compositeKey.id}
                  </span>
                  <button
                    onClick={() => handleDeleteCompositeKey(compositeKey.id)}
                    disabled={!isPanelEnabled}
                    className={`text-ag-dark-error hover:text-red-400 transition-colors ${
                      !isPanelEnabled ? 'opacity-50 cursor-not-allowed' : ''
                    }`}
                    title="Clear Composite Key"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
                
                <div className="grid grid-cols-2 gap-3">
                  {/* Part Dropdown */}
                  <div>
                    <label className="block text-xs font-medium text-ag-dark-text-secondary mb-1">
                      Part
                    </label>
                    <select
                      value={compositeKey.part}
                      onChange={(e) => handleCompositeKeyChange(compositeKey.id, 'part', e.target.value)}
                      disabled={!isPanelEnabled}
                      className={`w-full px-2 py-1.5 pr-8 bg-ag-dark-surface border border-ag-dark-border rounded text-sm text-ag-dark-text focus:ring-1 focus:ring-ag-dark-accent focus:border-ag-dark-accent appearance-none ${
                        !isPanelEnabled ? 'opacity-50 cursor-not-allowed' : ''
                      }`}
                      style={{
                        backgroundImage: `url("data:image/svg+xml,%3csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 20 20'%3e%3cpath stroke='%236b7280' stroke-linecap='round' stroke-linejoin='round' stroke-width='1.5' d='m6 8 4 4 4-4'/%3e%3c/svg%3e")`,
                        backgroundPosition: 'right 8px center',
                        backgroundRepeat: 'no-repeat',
                        backgroundSize: '12px'
                      }}
                    >
                      <option value="">Select Part</option>
                      {partOptions.map((option) => (
                        <option key={option} value={option}>
                          {option}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Group Dropdown */}
                  <div>
                    <label className="block text-xs font-medium text-ag-dark-text-secondary mb-1">
                      Group
                    </label>
                    <select
                      value={compositeKey.group}
                      onChange={(e) => handleCompositeKeyChange(compositeKey.id, 'group', e.target.value)}
                      disabled={!isPanelEnabled}
                      className={`w-full px-2 py-1.5 pr-8 bg-ag-dark-surface border border-ag-dark-border rounded text-sm text-ag-dark-text focus:ring-1 focus:ring-ag-dark-accent focus:border-ag-dark-accent appearance-none ${
                        !isPanelEnabled ? 'opacity-50 cursor-not-allowed' : ''
                      }`}
                      style={{
                        backgroundImage: `url("data:image/svg+xml,%3csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 20 20'%3e%3cpath stroke='%236b7280' stroke-linecap='round' stroke-linejoin='round' stroke-width='1.5' d='m6 8 4 4 4-4'/%3e%3c/svg%3e")`,
                        backgroundPosition: 'right 8px center',
                        backgroundRepeat: 'no-repeat',
                        backgroundSize: '12px'
                      }}
                    >
                      <option value="">Select Group</option>
                      {groupOptions.map((option) => (
                        <option key={option} value={option}>
                          {option}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </CollapsibleSection>

      {/* Relationships Section */}
      <CollapsibleSection 
        title="Relationships" 
        sectionKey="relationships"
        icon={<Link className="w-4 h-4 text-ag-dark-text-secondary" />}
        actions={
          <button
            onClick={onEnterRelationshipView}
            disabled={!isPanelEnabled}
            className={`px-3 py-1.5 text-sm font-medium border border-ag-dark-border rounded bg-ag-dark-bg text-ag-dark-text hover:bg-ag-dark-surface transition-colors ${
              !isPanelEnabled ? 'opacity-50 cursor-not-allowed' : ''
            }`}
            title={selectedCount > 1 ? "View relationships (bulk edit not yet supported)" : "View and manage relationships"}
          >
            View Relationships
          </button>
        }
      >
        {/* Relationship Summary - Only show for single object selection */}
        {console.log('MetadataPanel: rendering relationships summary, relationships.length:', relationships.length, 'relationships:', relationships)}
        {!isPanelEnabled && selectedCount > 1 && (
          <div className="mb-6">
            <div className="bg-ag-dark-bg rounded-lg p-4 border border-ag-dark-border">
              <div className="text-sm text-ag-dark-text-secondary">
                <span className="font-medium">Bulk relationship management</span> is not yet supported. 
                Please select a single object to view and manage relationships.
              </div>
            </div>
          </div>
        )}
        {isPanelEnabled && relationships.length > 0 && (
          <div className="mb-6">
            <h5 className="text-sm font-medium text-ag-dark-text mb-3">Current Relationships</h5>
            <div className="space-y-2">
              {(() => {
                // Group relationships by object (toBeing, toAvatar, toObject) and combine roles
                const groupedRelationships = relationships.reduce((acc, relationship) => {
                  const key = `${relationship.toBeing}-${relationship.toAvatar}-${relationship.toObject}`;
                  if (!acc[key]) {
                    acc[key] = {
                      toBeing: relationship.toBeing,
                      toAvatar: relationship.toAvatar,
                      toObject: relationship.toObject,
                      type: relationship.type,
                      roles: []
                    };
                  }
                  acc[key].roles.push(relationship.role);
                  return acc;
                }, {} as Record<string, any>);

                // Convert to array and sort roles
                return Object.values(groupedRelationships).map((groupedRel: any, index) => (
                  <div key={`${groupedRel.toBeing}-${groupedRel.toAvatar}-${groupedRel.toObject}`} className="bg-ag-dark-bg rounded-lg p-3 border border-ag-dark-border">
                    <div className="flex items-center justify-between">
                      <div className="flex-1">
                        <div className="text-sm text-ag-dark-text">
                          <span className="font-medium">{groupedRel.toBeing} - {groupedRel.toAvatar} - {groupedRel.toObject}</span>
                        </div>
                        <div className="text-xs text-ag-dark-text-secondary mt-1">
                          <span className="font-medium">Type:</span> {groupedRel.type} | <span className="font-medium">Roles:</span> {groupedRel.roles.join(', ')}
                        </div>
                      </div>
                    </div>
                  </div>
                ));
              })()}
            </div>
          </div>
        )}
      </CollapsibleSection>

      {/* Variants Section */}
      <CollapsibleSection 
        title="Variants" 
        sectionKey="variants"
        icon={<Layers className="w-4 h-4 text-ag-dark-text-secondary" />}
        actions={
          <div className="flex items-center gap-2">
            <button
              onClick={() => handleSortVariants('asc')}
              disabled={!isPanelEnabled}
              className={`p-1.5 text-ag-dark-text-secondary hover:text-ag-dark-accent transition-colors rounded ${
                !isPanelEnabled ? 'opacity-50 cursor-not-allowed' : 'hover:bg-ag-dark-bg'
              }`}
              title="Sort A-Z"
            >
              <ArrowUpAZ className="w-5 h-5" />
            </button>
            <button
              onClick={() => handleSortVariants('desc')}
              disabled={!isPanelEnabled}
              className={`p-1.5 text-ag-dark-text-secondary hover:text-ag-dark-accent transition-colors rounded ${
                !isPanelEnabled ? 'opacity-50 cursor-not-allowed' : 'hover:bg-ag-dark-bg'
              }`}
              title="Sort Z-A"
            >
              <ArrowDownZA className="w-5 h-5" />
            </button>
            <button
              onClick={() => setIsVariantUploadOpen(true)}
              disabled={!isPanelEnabled}
              className={`text-ag-dark-text-secondary hover:text-ag-dark-accent transition-colors ${
                !isPanelEnabled ? 'opacity-50 cursor-not-allowed' : ''
              }`}
              title="Upload Variants CSV"
            >
              <Upload className="w-4 h-4" />
            </button>
          </div>
        }
      >
        <textarea
          ref={variantsTextareaRef}
          value={variantsText}
          onChange={(e) => {
            const textarea = e.target as HTMLTextAreaElement;
            const cursorPosition = textarea.selectionStart;
            lastChangeTimeRef.current = Date.now();
            setVariantsText(e.target.value);
            // Restore cursor position and focus after state update
            requestAnimationFrame(() => {
              if (variantsTextareaRef.current && isTextareaFocusedRef.current) {
                variantsTextareaRef.current.focus();
                // Try to restore cursor position, but if it's out of bounds, put it at the end
                const maxPos = variantsTextareaRef.current.value.length;
                const safePos = Math.min(cursorPosition, maxPos);
                variantsTextareaRef.current.setSelectionRange(safePos, safePos);
              }
            });
          }}
          onKeyDown={(e) => {
            // Prevent Enter key from propagating to parent components
            e.stopPropagation();
            // Prevent default only for Escape, not Enter
            if (e.key === 'Escape') {
              variantsTextareaRef.current?.blur();
            }
          }}
          onClick={(e) => {
            e.stopPropagation();
            e.nativeEvent.stopImmediatePropagation();
          }}
          onMouseDown={(e) => {
            e.stopPropagation();
            e.nativeEvent.stopImmediatePropagation();
          }}
          onFocus={(e) => {
            e.stopPropagation();
            isTextareaFocusedRef.current = true;
          }}
          onBlur={(e) => {
            // Only restore focus if blur happened very recently after typing (likely accidental)
            const timeSinceLastChange = Date.now() - lastChangeTimeRef.current;
            const wasRecentTyping = timeSinceLastChange < 200; // 200ms window
            
            // Check if blur was intentional (user clicked on another focusable element)
            const relatedTarget = e.relatedTarget as HTMLElement;
            const clickedOutside = !relatedTarget || 
              (relatedTarget.tagName !== 'TEXTAREA' && 
               relatedTarget.tagName !== 'INPUT' && 
               !relatedTarget.isContentEditable);
            
            // Only restore focus if it was recent typing and user didn't click on another input
            if (wasRecentTyping && clickedOutside && variantsTextareaRef.current && isTextareaFocusedRef.current) {
              // Restore focus after a brief delay to let React finish its render cycle
              setTimeout(() => {
                if (variantsTextareaRef.current && document.activeElement !== variantsTextareaRef.current) {
                  variantsTextareaRef.current.focus();
                }
              }, 10);
            } else if (!wasRecentTyping) {
              // User intentionally blurred, don't restore
              isTextareaFocusedRef.current = false;
            }
          }}
          disabled={!isPanelEnabled}
          placeholder="Type one variant per line. Press Enter to add more."
          rows={8}
          className={`w-full px-3 py-2 bg-ag-dark-bg border border-ag-dark-border rounded text-sm text-ag-dark-text placeholder-ag-dark-text-secondary focus:ring-1 focus:ring-ag-dark-accent focus:border-ag-dark-accent resize-y ${
            !isPanelEnabled ? 'opacity-50 cursor-not-allowed' : ''
          }`}
        />
      </CollapsibleSection>

      {/* Actions */}
      {onSave && (
        <div className="mt-6 pt-4 border-t border-ag-dark-border">
          <button
            onClick={handleSave}
            disabled={!isPanelEnabled}
            className={`w-full bg-ag-dark-accent text-white py-2 px-4 rounded hover:bg-ag-dark-accent-hover transition-colors flex items-center justify-center gap-2 ${
              !isPanelEnabled ? 'opacity-50 cursor-not-allowed bg-ag-dark-text-secondary hover:bg-ag-dark-text-secondary' : ''
            }`}
          >
            <Save className="w-4 h-4" />
            Save Changes
          </button>
        </div>
      )}

      {/* CSV Upload Modals */}
      <CsvUploadModal
        isOpen={isRelationshipUploadOpen}
        onClose={() => setIsRelationshipUploadOpen(false)}
        type="relationships"
        onUpload={handleRelationshipCsvUpload}
      />
      
      <CsvUploadModal
        isOpen={isVariantUploadOpen}
        onClose={() => setIsVariantUploadOpen(false)}
        type="variants"
        onUpload={handleVariantCsvUpload}
      />

    </div>
  );
};