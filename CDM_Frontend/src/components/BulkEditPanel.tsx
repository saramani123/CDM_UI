import React, { useState, useRef, useEffect } from 'react';
import { Settings, Save, X, Trash2, Plus, Link, Layers, Upload, ChevronRight, ChevronDown, Database, Users, Key, ArrowUpAZ, ArrowDownZA } from 'lucide-react';
import { getAvatarOptions, concatenateDrivers } from '../data/mockData';
import { CsvUploadModal } from './CsvUploadModal';
import { useDrivers } from '../hooks/useDrivers';
import { useVariables } from '../hooks/useVariables';

interface CompositeKey {
  id: string;
  part: string;
  group: string;
  variables: string[];
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

interface BulkEditPanelProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (data: Record<string, any>) => void;
  selectedCount: number;
  allData?: any[];
  activeTab?: string;
}

export const BulkEditPanel: React.FC<BulkEditPanelProps> = ({
  isOpen,
  onClose,
  onSave,
  selectedCount,
  allData = [],
  activeTab = 'objects'
}) => {
  // Basic form data
  const [formData, setFormData] = useState({
    being: '',
    avatar: '',
    objectName: ''
  });

  // Driver selections state
  const [driverSelections, setDriverSelections] = useState({
    sector: [] as string[],
    domain: [] as string[],
    country: [] as string[],
    objectClarifier: ''
  });

  // Use only API drivers data
  const { drivers: apiDrivers } = useDrivers();
  const { variables: variablesData } = useVariables();
  const driversData = apiDrivers || {
    sectors: [],
    domains: [],
    countries: [],
    objectClarifiers: [],
    variableClarifiers: []
  };

  // Identifier data
  const [discreteIdVariables, setDiscreteIdVariables] = useState<string[]>([]);
  const [compositeKeys, setCompositeKeys] = useState<CompositeKey[]>([
    { id: '1', part: '', group: '', variables: [] },
    { id: '2', part: '', group: '', variables: [] },
    { id: '3', part: '', group: '', variables: [] },
    { id: '4', part: '', group: '', variables: [] },
    { id: '5', part: '', group: '', variables: [] }
  ]);

  // Relationships and variants - using string for multiline input
  const [relationships, setRelationships] = useState<Relationship[]>([]);
  const [variantsText, setVariantsText] = useState('');
  const [variantsArray, setVariantsArray] = useState<Variant[]>([]);
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

  // CSV upload modal states
  const [isRelationshipUploadOpen, setIsRelationshipUploadOpen] = useState(false);
  const [isVariantUploadOpen, setIsVariantUploadOpen] = useState(false);
  
  // Collapsible sections state
  const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({
    drivers: false,
    ontology: false,
    identifiers: false,
    relationships: false,
    variants: false
  });

  if (!isOpen) return null;

  // Get dynamic avatar options based on current being and driver values
  const driverString = concatenateDrivers(
    driverSelections.sector,
    driverSelections.domain,
    driverSelections.country,
    driverSelections.objectClarifier
  );
  const avatarOptions = getAvatarOptions(formData.being || '', driverString, allData);

  // Get distinct values from data for relationships
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

  // Helper functions to get filtered data from variables
  const getAllParts = () => {
    const parts = [...new Set(variablesData.map(v => v.part))].filter(Boolean).sort();
    return parts;
  };

  const getGroupsForPart = (part: string) => {
    if (!part) return [];
    const groups = [...new Set(
      variablesData.filter(v => v.part === part).map(v => v.group)
    )].filter(Boolean).sort();
    return groups;
  };

  const getVariablesForPartAndGroup = (part: string, group: string) => {
    if (!part || !group) return [];
    return variablesData
      .filter(v => v.part === part && v.group === group)
      .map(v => ({ id: v.id, name: v.variable }));
  };

  const getDiscreteIdVariables = () => {
    return variablesData
      .filter(v => v.part === 'Identifier' && v.group === 'Public ID')
      .map(v => ({ id: v.id, name: v.variable }));
  };
  
  const toggleSection = (sectionKey: string) => {
    setExpandedSections(prev => ({
      ...prev,
      [sectionKey]: !prev[sectionKey]
    }));
  };

  const handleChange = (key: string, value: string) => {
    setFormData(prev => ({
      ...prev,
      [key]: value
    }));
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
    setCompositeKeys(prev => prev.map(key => {
      if (key.id === id) {
        const updated = { ...key, [field]: value };
        if (field === 'part') {
          updated.group = '';
          updated.variables = [];
        } else if (field === 'group') {
          updated.variables = [];
        }
        return updated;
      }
      return key;
    }));
  };

  const handleCompositeKeyVariablesChange = (id: string, variables: string[]) => {
    setCompositeKeys(prev => prev.map(key => 
      key.id === id ? { ...key, variables } : key
    ));
  };

  const handleDeleteCompositeKey = (id: string) => {
    setCompositeKeys(prev => prev.map(key => 
      key.id === id ? { id: key.id, part: '', group: '', variables: [] } : key
    ));
  };

  const handleRelationshipChange = (id: string, field: keyof Relationship, value: string) => {
    setRelationships(prev => prev.map(rel => {
      if (rel.id === id) {
        const updated = { ...rel, [field]: value };
        
        // Handle Intra-Table logic
        if (field === 'type' && value === 'Intra-Table') {
          // Auto-populate with current form data
          updated.toBeing = formData.being;
          updated.toAvatar = formData.avatar;
          updated.toObject = formData.objectName;
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
            updated.toAvatar = '';
            updated.toObject = '';
          } else if (field === 'toAvatar' && value !== 'ALL') {
            updated.toObject = '';
          }
        }
        
        return updated;
      }
      return rel;
    }));
  };

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

  const handleVariantsTextChange = (text: string) => {
    setVariantsText(text);
  };

  const handleRelationshipCsvUpload = (uploadedRelationships: Relationship[]) => {
    setRelationships(prev => [...prev, ...uploadedRelationships]);
  };

  const handleVariantCsvUpload = async (data: any[] | File) => {
    // Check if it's a File (new API-based upload) or array (old client-side parsing)
    if (data instanceof File) {
      try {
        // For bulk edit, we need to handle the file upload differently
        // We'll parse the CSV client-side and add to the variants textarea
        const reader = new FileReader();
        reader.onload = (e) => {
          let csv = e.target?.result as string;
          if (!csv) return;
          
          // Parse CSV
          const lines = csv.split('\n').filter(line => line.trim());
          if (lines.length < 2) {
            alert('CSV file must have at least a header and one data row');
            return;
          }
          
          const header = lines[0].toLowerCase();
          if (!header.includes('variant')) {
            alert('CSV file must have a "Variant" column');
            return;
          }
          
          const variantIndex = lines[0].split(',').findIndex(col => 
            col.toLowerCase().trim().replace(/"/g, '') === 'variant'
          );
          
          if (variantIndex === -1) {
            alert('Could not find "Variant" column in CSV');
            return;
          }
          
          const newVariants: Variant[] = [];
          for (let i = 1; i < lines.length; i++) {
            const values = lines[i].split(',').map(val => val.trim().replace(/"/g, ''));
            if (values[variantIndex] && values[variantIndex].trim()) {
              newVariants.push({
                id: Date.now().toString() + i,
                name: values[variantIndex].trim()
              });
            }
          }
          
          if (newVariants.length > 0) {
            // Append to textarea
            const newLines = newVariants.map(v => v.name).join('\n');
            setVariantsText(prev => prev ? `${prev}\n${newLines}` : newLines);
            alert(`Successfully added ${newVariants.length} variants from CSV`);
          } else {
            alert('No valid variants found in CSV');
          }
        };
        reader.readAsText(data);
      } catch (error) {
        console.error('CSV variants upload failed:', error);
        alert(`Variants upload failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
    } else {
      // Handle array of variants - append to textarea
      const newLines = data.map((v: any) => v.name).join('\n');
      setVariantsText(prev => prev ? `${prev}\n${newLines}` : newLines);
    }
  };

  const handleSaveBulkEdit = () => {
    // Generate driver string from selections if any driver fields are selected
    const hasDriverSelections = driverSelections.sector.length > 0 || 
                               driverSelections.domain.length > 0 || 
                               driverSelections.country.length > 0 || 
                               driverSelections.objectClarifier;
    
    const driverString = hasDriverSelections ? concatenateDrivers(
      driverSelections.sector,
      driverSelections.domain,
      driverSelections.country,
      driverSelections.objectClarifier
    ) : '';
    
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

    // Prepare identifier data (only if any identifiers are specified)
    const hasIdentifiers = discreteIdVariables.length > 0 || compositeKeys.some(key => key.part && key.group);
    const identifierData = hasIdentifiers ? {
      discreteId: {
        variables: discreteIdVariables
      },
      compositeIds: compositeKeys.reduce((acc, key) => {
        if (key.part && key.group) {
          acc[key.id] = {
            part: key.part,
            group: key.group,
            variables: key.variables
          };
        }
        return acc;
      }, {} as Record<string, { part: string; group: string; variables: string[] }>)
    } : undefined;

    const saveData = {
      ...formData,
      ...(driverString && { driver: driverString }),
      ...(identifierData && { identifier: identifierData }),
      relationshipsList: uniqueRelationships,
      variantsList: variantsList
    };
    
    console.log('🔄 BulkEditPanel - saveData:', saveData);
    console.log('🔄 BulkEditPanel - variants array:', variantsList);
    console.log('🔄 BulkEditPanel - variantsList field:', saveData.variantsList);
    
    onSave(saveData);
    onClose();
  };

  // Multi-select component
  const MultiSelect: React.FC<{
    label: string;
    options: string[];
    values: string[];
    onChange: (values: string[]) => void;
    disabled?: boolean;
    compact?: boolean;
  }> = ({ label, options, values, onChange, disabled = false, compact = false }) => {
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
      ? `Keep Current ${label}` 
      : values.includes('ALL') 
        ? 'ALL' 
        : values.length === 1 
          ? values[0] 
          : `${values.length} selected`;

    const buttonClass = compact
      ? `w-full px-2 py-1.5 pr-8 bg-ag-dark-surface border border-ag-dark-border rounded text-sm text-ag-dark-text focus:ring-1 focus:ring-ag-dark-accent focus:border-ag-dark-accent text-left ${
          disabled ? 'opacity-50 cursor-not-allowed' : ''
        }`
      : `w-full px-3 py-2 pr-10 bg-ag-dark-bg border border-ag-dark-border rounded text-ag-dark-text focus:ring-2 focus:ring-ag-dark-accent focus:border-ag-dark-accent text-left ${
          disabled ? 'opacity-50 cursor-not-allowed' : ''
        }`;

    const iconSize = compact ? '12px' : '16px';
    const iconPosition = compact ? 'right 8px center' : 'right 12px center';

    return (
      <div className="relative" ref={dropdownRef}>
        <button
          type="button"
          onClick={() => !disabled && setIsOpen(!isOpen)}
          disabled={disabled}
          className={buttonClass}
          style={{
            backgroundImage: `url("data:image/svg+xml,%3csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 20 20'%3e%3cpath stroke='%236b7280' stroke-linecap='round' stroke-linejoin='round' stroke-width='1.5' d='m6 8 4 4 4-4'/%3e%3c/svg%3e")`,
            backgroundPosition: iconPosition,
            backgroundRepeat: 'no-repeat',
            backgroundSize: iconSize
          }}
        >
          {displayText}
        </button>
        
        {isOpen && (
          <div className="absolute z-10 w-full mt-1 bg-ag-dark-surface border border-ag-dark-border rounded-lg shadow-lg max-h-60 overflow-y-auto">
            {options.map((option) => (
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
            ))}
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
          <div className="mt-6 ml-6 pb-6">
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
          <h3 className="text-lg font-semibold text-ag-dark-text">Edit Selected</h3>
        </div>
        <button
          onClick={onClose}
          className="text-ag-dark-text-secondary hover:text-ag-dark-text transition-colors"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      {/* Bulk Edit Mode Notice - Always Visible */}
      <div className="bg-ag-dark-bg rounded-lg border border-ag-dark-border p-4 mb-6">
        <div className="text-sm text-ag-dark-text">
          <span className="font-semibold text-ag-dark-accent">Bulk Edit Mode:</span> Changes will be applied to all {selectedCount} selected objects. New relationships and variants will be appended to existing ones.
        </div>
      </div>

      {/* Object Name Field - Moved out of collapsible section */}
      <div className="mb-6">
        <label className="block text-sm font-medium text-ag-dark-text mb-2">
          Object Name
        </label>
        <input
          type="text"
          value={formData.objectName}
          onChange={(e) => handleChange('objectName', e.target.value)}
          placeholder="Keep current object names"
          onClick={(e) => e.stopPropagation()}
          className="w-full px-3 py-2 bg-ag-dark-bg border border-ag-dark-border rounded text-ag-dark-text placeholder-ag-dark-text-secondary focus:ring-2 focus:ring-ag-dark-accent focus:border-ag-dark-accent"
        />
      </div>

      {/* Drivers Section */}
      <CollapsibleSection title="Drivers" sectionKey="drivers" icon={<Database className="w-4 h-4 text-ag-dark-text-secondary" />}>
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-ag-dark-text mb-2">
              Sector
            </label>
            <MultiSelect
              label="Sector"
              options={['ALL', ...driversData.sectors]}
              values={driverSelections.sector}
              onChange={(values) => handleDriverSelectionChange('sector', values)}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-ag-dark-text mb-2">
              Domain
            </label>
            <MultiSelect
              label="Domain"
              options={['ALL', ...driversData.domains]}
              values={driverSelections.domain}
              onChange={(values) => handleDriverSelectionChange('domain', values)}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-ag-dark-text mb-2">
              Country
            </label>
            <MultiSelect
              label="Country"
              options={['ALL', ...driversData.countries]}
              values={driverSelections.country}
              onChange={(values) => handleDriverSelectionChange('country', values)}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-ag-dark-text mb-2">
              Object Clarifier
            </label>
            <select
              value={driverSelections.objectClarifier}
              onChange={(e) => handleObjectClarifierChange(e.target.value)}
              className="w-full px-3 py-2 pr-10 bg-ag-dark-bg border border-ag-dark-border rounded text-ag-dark-text focus:ring-2 focus:ring-ag-dark-accent focus:border-ag-dark-accent appearance-none"
              style={{
                backgroundImage: `url("data:image/svg+xml,%3csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 20 20'%3e%3cpath stroke='%236b7280' stroke-linecap='round' stroke-linejoin='round' stroke-width='1.5' d='m6 8 4 4 4-4'/%3e%3c/svg%3e")`,
                backgroundPosition: 'right 12px center',
                backgroundRepeat: 'no-repeat',
                backgroundSize: '16px'
              }}
            >
              <option value="">Keep Current Object Clarifier</option>
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
              className="w-full px-3 py-2 pr-10 bg-ag-dark-bg border border-ag-dark-border rounded text-ag-dark-text focus:ring-2 focus:ring-ag-dark-accent focus:border-ag-dark-accent appearance-none"
              style={{
                backgroundImage: `url("data:image/svg+xml,%3csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 20 20'%3e%3cpath stroke='%236b7280' stroke-linecap='round' stroke-linejoin='round' stroke-width='1.5' d='m6 8 4 4 4-4'/%3e%3c/svg%3e")`,
                backgroundPosition: 'right 12px center',
                backgroundRepeat: 'no-repeat',
                backgroundSize: '16px'
              }}
            >
              <option value="">Keep Current Being</option>
              {getDistinctBeings().filter(being => being !== 'ALL').map(being => (
                <option key={being} value={being}>{being}</option>
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
              className="w-full px-3 py-2 pr-10 bg-ag-dark-bg border border-ag-dark-border rounded text-ag-dark-text focus:ring-2 focus:ring-ag-dark-accent focus:border-ag-dark-accent appearance-none"
              style={{
                backgroundImage: `url("data:image/svg+xml,%3csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 20 20'%3e%3cpath stroke='%236b7280' stroke-linecap='round' stroke-linejoin='round' stroke-width='1.5' d='m6 8 4 4 4-4'/%3e%3c/svg%3e")`,
                backgroundPosition: 'right 12px center',
                backgroundRepeat: 'no-repeat',
                backgroundSize: '16px'
              }}
            >
              <option value="">Keep Current Avatar</option>
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
        <div className="space-y-6">
          {/* Discrete ID */}
          <div>
            <h5 className="text-sm font-medium text-ag-dark-text mb-3">Discrete ID</h5>
            <div className="border border-ag-dark-border rounded">
              {/* Table Header */}
              <div className="grid grid-cols-3 gap-2 bg-ag-dark-bg border-b border-ag-dark-border p-2">
                <div className="text-xs font-medium text-ag-dark-text-secondary">Part</div>
                <div className="text-xs font-medium text-ag-dark-text-secondary">Group</div>
                <div className="text-xs font-medium text-ag-dark-text-secondary">Variable</div>
              </div>
              {/* Table Row */}
              <div className="grid grid-cols-3 gap-2 items-center p-2">
                <input
                  type="text"
                  value="Identifier"
                  disabled
                  className="w-full px-2 py-1.5 bg-ag-dark-surface border border-ag-dark-border rounded text-sm text-ag-dark-text-secondary opacity-50 cursor-not-allowed"
                />
                <input
                  type="text"
                  value="Public ID"
                  disabled
                  className="w-full px-2 py-1.5 bg-ag-dark-surface border border-ag-dark-border rounded text-sm text-ag-dark-text-secondary opacity-50 cursor-not-allowed"
                />
                <MultiSelect
                  label="Variable"
                  options={['ALL', ...getDiscreteIdVariables().map(v => v.name)]}
                  values={discreteIdVariables.map(id => {
                    const varData = getDiscreteIdVariables().find(v => v.id === id);
                    return varData?.name || id;
                  })}
                  onChange={(values) => {
                    const ids = values.map(val => {
                      if (val === 'ALL') return 'ALL';
                      const varData = getDiscreteIdVariables().find(v => v.name === val);
                      return varData?.id || val;
                    });
                    setDiscreteIdVariables(ids);
                  }}
                  compact={true}
                />
              </div>
            </div>
          </div>

          {/* Composite IDs - Matrix Layout */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <h5 className="text-sm font-medium text-ag-dark-text">Composite IDs</h5>
            </div>
            <div className="border border-ag-dark-border rounded">
              {/* Table Header */}
              <div className="grid grid-cols-[25px_0.9fr_1fr_1fr] gap-1 bg-ag-dark-bg border-b border-ag-dark-border p-2">
                <div className="text-xs font-medium text-ag-dark-text-secondary"></div>
                <div className="text-xs font-medium text-ag-dark-text-secondary">Part</div>
                <div className="text-xs font-medium text-ag-dark-text-secondary">Group</div>
                <div className="text-xs font-medium text-ag-dark-text-secondary">Variable</div>
              </div>
              {/* Table Rows */}
              <div className="divide-y divide-ag-dark-border">
                {compositeKeys.map((compositeKey) => {
                  const variableOptions = compositeKey.part && compositeKey.group
                    ? getVariablesForPartAndGroup(compositeKey.part, compositeKey.group)
                    : [];
                  
                  return (
                    <div key={compositeKey.id} className="grid grid-cols-[25px_0.9fr_1fr_1fr] gap-1 items-center p-2 hover:bg-ag-dark-bg/50">
                      {/* Row Label */}
                      <div className="flex items-center">
                        <span className="text-[10px] font-medium text-ag-dark-text">{compositeKey.id}</span>
                      </div>
                      
                      {/* Part Dropdown */}
                      <select
                        value={compositeKey.part}
                        onChange={(e) => handleCompositeKeyChange(compositeKey.id, 'part', e.target.value)}
                        className="w-full px-2 py-1.5 pr-8 bg-ag-dark-surface border border-ag-dark-border rounded text-sm text-ag-dark-text focus:ring-1 focus:ring-ag-dark-accent focus:border-ag-dark-accent appearance-none"
                        style={{
                          backgroundImage: `url("data:image/svg+xml,%3csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 20 20'%3e%3cpath stroke='%236b7280' stroke-linecap='round' stroke-linejoin='round' stroke-width='1.5' d='m6 8 4 4 4-4'/%3e%3c/svg%3e")`,
                          backgroundPosition: 'right 8px center',
                          backgroundRepeat: 'no-repeat',
                          backgroundSize: '12px'
                        }}
                      >
                        <option value="">Select Part</option>
                        {getAllParts().map((part) => (
                          <option key={part} value={part}>
                            {part}
                          </option>
                        ))}
                      </select>

                      {/* Group Dropdown */}
                      <select
                        value={compositeKey.group}
                        onChange={(e) => handleCompositeKeyChange(compositeKey.id, 'group', e.target.value)}
                        disabled={!compositeKey.part}
                        className={`w-full px-2 py-1.5 pr-8 bg-ag-dark-surface border border-ag-dark-border rounded text-sm text-ag-dark-text focus:ring-1 focus:ring-ag-dark-accent focus:border-ag-dark-accent appearance-none ${
                          !compositeKey.part ? 'opacity-50 cursor-not-allowed' : ''
                        }`}
                        style={{
                          backgroundImage: `url("data:image/svg+xml,%3csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 20 20'%3e%3cpath stroke='%236b7280' stroke-linecap='round' stroke-linejoin='round' stroke-width='1.5' d='m6 8 4 4 4-4'/%3e%3c/svg%3e")`,
                          backgroundPosition: 'right 8px center',
                          backgroundRepeat: 'no-repeat',
                          backgroundSize: '12px'
                        }}
                      >
                        <option value="">Select Group</option>
                        {getGroupsForPart(compositeKey.part).map((group) => (
                          <option key={group} value={group}>
                            {group}
                          </option>
                        ))}
                      </select>

                      {/* Variable Multi-select */}
                      <MultiSelect
                        label="Variable"
                        options={['ALL', ...variableOptions.map(v => v.name)]}
                        values={compositeKey.variables.map(id => {
                          const varData = variableOptions.find(v => v.id === id);
                          return varData?.name || id;
                        })}
                        onChange={(values) => {
                          const ids = values.map(val => {
                            if (val === 'ALL') return 'ALL';
                            const varData = variableOptions.find(v => v.name === val);
                            return varData?.id || val;
                          });
                          handleCompositeKeyVariablesChange(compositeKey.id, ids);
                        }}
                        disabled={!compositeKey.part || !compositeKey.group}
                        compact={true}
                      />
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      </CollapsibleSection>

      {/* Relationships Section */}
      <CollapsibleSection 
        title="New Relationships" 
        sectionKey="relationships"
        icon={<Link className="w-4 h-4 text-ag-dark-text-secondary" />}
        actions={
          <button
            disabled={true}
            className="px-3 py-1.5 text-sm font-medium border border-ag-dark-border rounded bg-ag-dark-bg text-ag-dark-text opacity-50 cursor-not-allowed"
            title="Bulk relationship management not yet supported"
          >
            View Relationships
          </button>
        }
      >
        <div className="mb-6">
          <div className="bg-ag-dark-bg rounded-lg p-4 border border-ag-dark-border">
            <div className="text-sm text-ag-dark-text-secondary">
              <span className="font-medium">Bulk relationship management</span> is not yet supported. 
              Please select a single object to view and manage relationships.
            </div>
          </div>
        </div>
      </CollapsibleSection>

      {/* Variants Section */}
      <CollapsibleSection 
        title="New Variants" 
        sectionKey="variants"
        icon={<Layers className="w-4 h-4 text-ag-dark-text-secondary" />}
        actions={
          <div className="flex items-center gap-2">
            <button
              onClick={() => handleSortVariants('asc')}
              className="p-1.5 text-ag-dark-text-secondary hover:text-ag-dark-accent transition-colors rounded hover:bg-ag-dark-bg"
              title="Sort A-Z"
            >
              <ArrowUpAZ className="w-5 h-5" />
            </button>
            <button
              onClick={() => handleSortVariants('desc')}
              className="p-1.5 text-ag-dark-text-secondary hover:text-ag-dark-accent transition-colors rounded hover:bg-ag-dark-bg"
              title="Sort Z-A"
            >
              <ArrowDownZA className="w-5 h-5" />
            </button>
            <button
              onClick={() => setIsVariantUploadOpen(true)}
              className="text-ag-dark-text-secondary hover:text-ag-dark-accent transition-colors"
              title="Upload Variants CSV"
            >
              <Upload className="w-4 h-4" />
            </button>
          </div>
        }
      >
        <div
          onClick={(e) => e.stopPropagation()}
          onMouseDown={(e) => e.stopPropagation()}
          onKeyDown={(e) => e.stopPropagation()}
        >
          <textarea
            ref={variantsTextareaRef}
            value={variantsText}
            onChange={(e) => {
              const textarea = e.target as HTMLTextAreaElement;
              const cursorPosition = textarea.selectionStart;
              lastChangeTimeRef.current = Date.now();
              handleVariantsTextChange(e.target.value);
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
              e.nativeEvent.stopImmediatePropagation();
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
            placeholder="Type one variant per line. Press Enter to add more."
            rows={8}
            className="w-full px-3 py-2 bg-ag-dark-bg border border-ag-dark-border rounded text-sm text-ag-dark-text placeholder-ag-dark-text-secondary focus:ring-1 focus:ring-ag-dark-accent focus:border-ag-dark-accent resize-y"
          />
        </div>
      </CollapsibleSection>

      {/* Apply Changes Button */}
      <div className="mt-8 pt-6 border-t border-ag-dark-border">
        <button
          onClick={handleSaveBulkEdit}
          className="w-full bg-ag-dark-accent text-white py-2 px-4 rounded hover:bg-ag-dark-accent-hover transition-colors flex items-center justify-center gap-2"
        >
          <Save className="w-4 h-4" />
          Apply to {selectedCount} Objects
        </button>
      </div>

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