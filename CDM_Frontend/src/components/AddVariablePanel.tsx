import React, { useState, useRef, useEffect } from 'react';
import { Settings, X, Trash2, Plus, Link, Upload, ChevronRight, ChevronDown, Database, Users, FileText } from 'lucide-react';
import { variableFieldOptions, concatenateVariableDrivers } from '../data/variablesData';
import { useDrivers } from '../hooks/useDrivers';
import { CsvUploadModal } from './CsvUploadModal';
import { VariableObjectRelationshipModal } from './VariableObjectRelationshipModal';
import { useObjects } from '../hooks/useObjects';
import { parseDriverField } from '../data/mockData';

interface ObjectRelationship {
  id: string;
  toBeing: string;
  toAvatar: string;
  toObject: string;
}

interface AddVariablePanelProps {
  isOpen: boolean;
  onClose: () => void;
  onAdd: (variableData: any) => void;
  allData?: any[];
  objectsData?: any[];
}

export const AddVariablePanel: React.FC<AddVariablePanelProps> = ({
  isOpen,
  onClose,
  onAdd,
  objectsData = []
}) => {
  // Basic form data
  const [formData, setFormData] = useState({
    part: '',
    section: '',
    group: '',
    variable: '',
    formatI: '',
    formatII: '',
    gType: '',
    validation: '',
    default: '',
    graph: ''
  });

  // Driver selections state
  const [driverSelections, setDriverSelections] = useState({
    sector: [],
    domain: [],
    country: [],
    variableClarifier: ''
  });

  const { drivers: driversData, loading: driversLoading } = useDrivers();

  // Object relationships - store selected object IDs from modal
  const [selectedObjectRelationships, setSelectedObjectRelationships] = useState<string[]>([]);
  
  // Modal state for object relationships
  const [isVariableObjectRelationshipModalOpen, setIsVariableObjectRelationshipModalOpen] = useState(false);
  const [isCsvUploadOpen, setIsCsvUploadOpen] = useState(false);
  const [pendingCsvData, setPendingCsvData] = useState<any[] | null>(null);
  
  // Get objects data - use hook if not provided as prop
  const { objects: objectsFromHook } = useObjects();
  const allObjects = objectsData && objectsData.length > 0 ? objectsData : objectsFromHook;

  // Collapsible sections state
  const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({
    drivers: false,
    ontology: false,
    metadata: false,
    objectRelationships: false
  });

  if (!isOpen) return null;

  // Get distinct values from data for object relationships
  const getDistinctBeings = (): string[] => {
    // Get distinct beings from objects data + ALL option
    const objectsData = (window as any).objectsData || [];
    const beings = [...new Set(objectsData.map((item: any) => item.being))].filter(Boolean) as string[];
    return ['ALL', ...beings];
  };

  const getDistinctAvatarsForBeing = (being: string) => {
    // Get distinct avatars for the selected being from objects data + ALL option
    const objectsData = (window as any).objectsData || [];
    let avatars: string[] = [];
    
    if (being === 'ALL') {
      avatars = [...new Set(objectsData.map((item: any) => item.avatar))].filter(Boolean) as string[];
    } else {
      avatars = [...new Set(objectsData
        .filter((item: any) => item.being === being)
        .map((item: any) => item.avatar)
      )].filter(Boolean) as string[];
    }
    
    return ['ALL', ...avatars];
  };

  const getDistinctObjectsForBeingAndAvatar = (being: string, avatar: string) => {
    // Get distinct objects for the selected being and avatar from objects data + ALL option
    const objectsData = (window as any).objectsData || [];
    let objects: string[] = [];
    
    if (being === 'ALL' && avatar === 'ALL') {
      objects = [...new Set(objectsData.map((item: any) => item.object))].filter(Boolean) as string[];
    } else if (being === 'ALL') {
      objects = [...new Set(objectsData
        .filter((item: any) => item.avatar === avatar)
        .map((item: any) => item.object)
      )].filter(Boolean) as string[];
    } else if (avatar === 'ALL') {
      objects = [...new Set(objectsData
        .filter((item: any) => item.being === being)
        .map((item: any) => item.object)
      )].filter(Boolean) as string[];
    } else {
      objects = [...new Set(objectsData
        .filter((item: any) => item.being === being && item.avatar === avatar)
        .map((item: any) => item.object)
      )].filter(Boolean) as string[];
    }
    
    return ['ALL', ...objects];
  };

  const handleChange = (key: string, value: string) => {
    setFormData(prev => ({
      ...prev,
      [key]: value
    }));
  };

  const handleDriverSelectionChange = (field: 'sector' | 'domain' | 'country' | 'variableClarifier', value: string[] | string) => {
    if (field === 'variableClarifier') {
      setDriverSelections(prev => ({
        ...prev,
        variableClarifier: value as string
      }));
    } else {
      setDriverSelections(prev => ({
        ...prev,
        [field]: value as string[]
      }));
    }
  };

  // Handler for when relationships are saved in the modal
  const handleRelationshipSave = (selectedObjectIds: string[]) => {
    setSelectedObjectRelationships(selectedObjectIds);
  };

  // Validation - all required fields must be filled
  const isFormValid = () => {
    const requiredFields = ['part', 'section', 'group', 'variable', 'formatI', 'formatII'];
    return requiredFields.every(field => formData[field as keyof typeof formData]);
  };

  const handleAddVariable = () => {
    if (!isFormValid()) {
      alert('Please fill in all required fields');
      return;
    }

    // Generate driver string from selections
    const driverString = concatenateVariableDrivers(
      driverSelections.sector,
      driverSelections.domain,
      driverSelections.country,
      driverSelections.variableClarifier
    );

    // Convert selected object IDs to relationship format
    const objectRelationshipsList = selectedObjectRelationships.map(objectId => {
      const obj = allObjects.find(o => o.id === objectId);
      if (!obj) return null;
      
      // Parse sector, domain, country from driver string
      let sector = '';
      let domain = '';
      let country = '';
      if (obj.driver && obj.driver.trim()) {
        try {
          const parsed = parseDriverField(obj.driver);
          sector = parsed.sector || '';
          domain = parsed.domain || '';
          country = parsed.country || '';
        } catch (error) {
          console.error(`Error parsing driver for object ${objectId}:`, error);
        }
      }
      
      return {
        id: objectId,
        toBeing: obj.being || '',
        toAvatar: obj.avatar || '',
        toObject: obj.object || '',
        toSector: sector,
        toDomain: domain,
        toCountry: country
      };
    }).filter(Boolean) as ObjectRelationship[];

    const newVariable = {
      id: Date.now().toString(),
      ...formData,
      driver: driverString,
      objectRelationships: objectRelationshipsList.length,
      status: 'Active',
      objectRelationshipsList: objectRelationshipsList,
      selectedObjectIds: selectedObjectRelationships // Store IDs for reference
    };

    onAdd(newVariable);
    
    // Reset form
    setFormData({
      part: '',
      section: '',
      group: '',
      variable: '',
      formatI: '',
      formatII: '',
      gType: '',
      validation: '',
      default: '',
      graph: ''
    });
    setDriverSelections({
      sector: [],
      domain: [],
      country: [],
      variableClarifier: ''
    });
    setSelectedObjectRelationships([]);
    
    onClose();
  };

  const toggleSection = (sectionKey: string) => {
    setExpandedSections(prev => ({
      ...prev,
      [sectionKey]: !prev[sectionKey]
    }));
  };

  // Multi-select component
  const MultiSelect: React.FC<{
    label: string;
    options: string[];
    values: string[];
    onChange: (values: string[]) => void;
  }> = ({ label, options, values, onChange }) => {
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
          onClick={() => setIsOpen(!isOpen)}
          className="w-full px-3 py-2 pr-10 bg-ag-dark-bg border border-ag-dark-border rounded text-ag-dark-text focus:ring-2 focus:ring-ag-dark-accent focus:border-ag-dark-accent text-left"
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
          <h3 className="text-lg font-semibold text-ag-dark-text">Add</h3>
        </div>
        <button
          onClick={onClose}
          className="text-ag-dark-text-secondary hover:text-ag-dark-text transition-colors"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      {/* Variable Name Field - Outside collapsible sections */}
      <div className="mb-6">
        <label className="block text-sm font-medium text-ag-dark-text mb-2">
          Variable <span className="text-ag-dark-error">*</span>
        </label>
            <input
              type="text"
              value={formData.variable}
              onChange={(e) => {
                e.stopPropagation();
                handleChange('variable', e.target.value);
              }}
              onKeyDown={(e) => e.stopPropagation()}
              onClick={(e) => e.stopPropagation()}
              onMouseDown={(e) => e.stopPropagation()}
              placeholder="Enter variable name..."
              className="w-full px-3 py-2 bg-ag-dark-bg border border-ag-dark-border rounded text-ag-dark-text placeholder-ag-dark-text-secondary focus:ring-2 focus:ring-ag-dark-accent focus:border-ag-dark-accent"
            />
      </div>

      {/* Drivers Section */}
      <CollapsibleSection title="Drivers" sectionKey="drivers" icon={<Database className="w-4 h-4 text-ag-dark-text-secondary" />}>
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-ag-dark-text mb-2">
              Sector <span className="text-ag-dark-error">*</span>
            </label>
            <MultiSelect
              label="Sector"
              options={driversLoading && driversData.sectors.length === 0 ? ['Loading...'] : ['ALL', ...driversData.sectors]}
              values={driverSelections.sector}
              onChange={(values) => handleDriverSelectionChange('sector', values)}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-ag-dark-text mb-2">
              Domain <span className="text-ag-dark-error">*</span>
            </label>
            <MultiSelect
              label="Domain"
              options={driversLoading && driversData.domains.length === 0 ? ['Loading...'] : ['ALL', ...driversData.domains]}
              values={driverSelections.domain}
              onChange={(values) => handleDriverSelectionChange('domain', values)}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-ag-dark-text mb-2">
              Country <span className="text-ag-dark-error">*</span>
            </label>
            <MultiSelect
              label="Country"
              options={driversLoading && driversData.countries.length === 0 ? ['Loading...'] : ['ALL', ...driversData.countries]}
              values={driverSelections.country}
              onChange={(values) => handleDriverSelectionChange('country', values)}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-ag-dark-text mb-2">
              Variable Clarifier
            </label>
            <select
              value={driverSelections.variableClarifier}
              onChange={(e) => handleDriverSelectionChange('variableClarifier', e.target.value)}
              className="w-full px-3 py-2 pr-10 bg-ag-dark-bg border border-ag-dark-border rounded text-ag-dark-text focus:ring-2 focus:ring-ag-dark-accent focus:border-ag-dark-accent appearance-none"
              style={{
                backgroundImage: `url("data:image/svg+xml,%3csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 20 20'%3e%3cpath stroke='%236b7280' stroke-linecap='round' stroke-linejoin='round' stroke-width='1.5' d='m6 8 4 4 4-4'/%3e%3c/svg%3e")`,
                backgroundPosition: 'right 12px center',
                backgroundRepeat: 'no-repeat',
                backgroundSize: '16px'
              }}
            >
              <option value="">None</option>
              {driversData.variableClarifiers.map((clarifier) => (
                <option key={clarifier} value={clarifier}>
                  {clarifier}
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
              Part <span className="text-ag-dark-error">*</span>
            </label>
            <select
              value={formData.part}
              onChange={(e) => handleChange('part', e.target.value)}
              className="w-full px-3 py-2 pr-10 bg-ag-dark-bg border border-ag-dark-border rounded text-ag-dark-text focus:ring-2 focus:ring-ag-dark-accent focus:border-ag-dark-accent appearance-none"
              style={{
                backgroundImage: `url("data:image/svg+xml,%3csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 20 20'%3e%3cpath stroke='%236b7280' stroke-linecap='round' stroke-linejoin='round' stroke-width='1.5' d='m6 8 4 4 4-4'/%3e%3c/svg%3e")`,
                backgroundPosition: 'right 12px center',
                backgroundRepeat: 'no-repeat',
                backgroundSize: '16px'
              }}
            >
              <option value="">Select Part</option>
              {variableFieldOptions.part.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-ag-dark-text mb-2">
              Section <span className="text-ag-dark-error">*</span>
            </label>
            <input
              key="section-input-add"
              type="text"
              value={formData.section}
              onChange={(e) => {
                e.stopPropagation();
                handleChange('section', e.target.value);
              }}
              onKeyDown={(e) => {
                e.stopPropagation();
                e.nativeEvent.stopImmediatePropagation();
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
                e.nativeEvent.stopImmediatePropagation();
              }}
              placeholder="Enter section..."
              className="w-full px-3 py-2 bg-ag-dark-bg border border-ag-dark-border rounded text-ag-dark-text placeholder-ag-dark-text-secondary focus:ring-2 focus:ring-ag-dark-accent focus:border-ag-dark-accent"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-ag-dark-text mb-2">
              Group <span className="text-ag-dark-error">*</span>
            </label>
            <select
              value={formData.group}
              onChange={(e) => handleChange('group', e.target.value)}
              className="w-full px-3 py-2 pr-10 bg-ag-dark-bg border border-ag-dark-border rounded text-ag-dark-text focus:ring-2 focus:ring-ag-dark-accent focus:border-ag-dark-accent appearance-none"
              style={{
                backgroundImage: `url("data:image/svg+xml,%3csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 20 20'%3e%3cpath stroke='%236b7280' stroke-linecap='round' stroke-linejoin='round' stroke-width='1.5' d='m6 8 4 4 4-4'/%3e%3c/svg%3e")`,
                backgroundPosition: 'right 12px center',
                backgroundRepeat: 'no-repeat',
                backgroundSize: '16px'
              }}
            >
              <option value="">Select Group</option>
              {variableFieldOptions.group.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
          </div>

        </div>
      </CollapsibleSection>

      {/* Metadata Section */}
      <CollapsibleSection title="Metadata" sectionKey="metadata" icon={<FileText className="w-4 h-4 text-ag-dark-text-secondary" />}>
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-ag-dark-text mb-2">
              Format I <span className="text-ag-dark-error">*</span>
            </label>
            <select
              value={formData.formatI}
              onChange={(e) => handleChange('formatI', e.target.value)}
              className="w-full px-3 py-2 pr-10 bg-ag-dark-bg border border-ag-dark-border rounded text-ag-dark-text focus:ring-2 focus:ring-ag-dark-accent focus:border-ag-dark-accent appearance-none"
              style={{
                backgroundImage: `url("data:image/svg+xml,%3csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 20 20'%3e%3cpath stroke='%236b7280' stroke-linecap='round' stroke-linejoin='round' stroke-width='1.5' d='m6 8 4 4 4-4'/%3e%3c/svg%3e")`,
                backgroundPosition: 'right 12px center',
                backgroundRepeat: 'no-repeat',
                backgroundSize: '16px'
              }}
            >
              <option value="">Select Format I</option>
              {variableFieldOptions.formatI.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-ag-dark-text mb-2">
              Format II <span className="text-ag-dark-error">*</span>
            </label>
            <select
              value={formData.formatII}
              onChange={(e) => handleChange('formatII', e.target.value)}
              className="w-full px-3 py-2 pr-10 bg-ag-dark-bg border border-ag-dark-border rounded text-ag-dark-text focus:ring-2 focus:ring-ag-dark-accent focus:border-ag-dark-accent appearance-none"
              style={{
                backgroundImage: `url("data:image/svg+xml,%3csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 20 20'%3e%3cpath stroke='%236b7280' stroke-linecap='round' stroke-linejoin='round' stroke-width='1.5' d='m6 8 4 4 4-4'/%3e%3c/svg%3e")`,
                backgroundPosition: 'right 12px center',
                backgroundRepeat: 'no-repeat',
                backgroundSize: '16px'
              }}
            >
              <option value="">Select Format II</option>
              {variableFieldOptions.formatII.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-ag-dark-text mb-2">
              G-Type
            </label>
            <select
              value={formData.gType}
              onChange={(e) => handleChange('gType', e.target.value)}
              className="w-full px-3 py-2 pr-10 bg-ag-dark-bg border border-ag-dark-border rounded text-ag-dark-text focus:ring-2 focus:ring-ag-dark-accent focus:border-ag-dark-accent appearance-none"
              style={{
                backgroundImage: `url("data:image/svg+xml,%3csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 20 20'%3e%3cpath stroke='%236b7280' stroke-linecap='round' stroke-linejoin='round' stroke-width='1.5' d='m6 8 4 4 4-4'/%3e%3c/svg%3e")`,
                backgroundPosition: 'right 12px center',
                backgroundRepeat: 'no-repeat',
                backgroundSize: '16px'
              }}
            >
              <option value="">Select G-Type</option>
              {variableFieldOptions.gType.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-ag-dark-text mb-2">
              Validation
            </label>
            <select
              value={formData.validation}
              onChange={(e) => handleChange('validation', e.target.value)}
              className="w-full px-3 py-2 pr-10 bg-ag-dark-bg border border-ag-dark-border rounded text-ag-dark-text focus:ring-2 focus:ring-ag-dark-accent focus:border-ag-dark-accent appearance-none"
              style={{
                backgroundImage: `url("data:image/svg+xml,%3csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 20 20'%3e%3cpath stroke='%236b7280' stroke-linecap='round' stroke-linejoin='round' stroke-width='1.5' d='m6 8 4 4 4-4'/%3e%3c/svg%3e")`,
                backgroundPosition: 'right 12px center',
                backgroundRepeat: 'no-repeat',
                backgroundSize: '16px'
              }}
            >
              <option value="">Select Validation</option>
              {variableFieldOptions.validation.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-ag-dark-text mb-2">
              Default
            </label>
            <select
              value={formData.default}
              onChange={(e) => handleChange('default', e.target.value)}
              className="w-full px-3 py-2 pr-10 bg-ag-dark-bg border border-ag-dark-border rounded text-ag-dark-text focus:ring-2 focus:ring-ag-dark-accent focus:border-ag-dark-accent appearance-none"
              style={{
                backgroundImage: `url("data:image/svg+xml,%3csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 20 20'%3e%3cpath stroke='%236b7280' stroke-linecap='round' stroke-linejoin='round' stroke-width='1.5' d='m6 8 4 4 4-4'/%3e%3c/svg%3e")`,
                backgroundPosition: 'right 12px center',
                backgroundRepeat: 'no-repeat',
                backgroundSize: '16px'
              }}
            >
              <option value="">Select Default</option>
              {variableFieldOptions.default.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-ag-dark-text mb-2">
              Graph
            </label>
            <select
              value={formData.graph}
              onChange={(e) => handleChange('graph', e.target.value)}
              className="w-full px-3 py-2 pr-10 bg-ag-dark-bg border border-ag-dark-border rounded text-ag-dark-text focus:ring-2 focus:ring-ag-dark-accent focus:border-ag-dark-accent appearance-none"
              style={{
                backgroundImage: `url("data:image/svg+xml,%3csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 20 20'%3e%3cpath stroke='%236b7280' stroke-linecap='round' stroke-linejoin='round' stroke-width='1.5' d='m6 8 4 4 4-4'/%3e%3c/svg%3e")`,
                backgroundPosition: 'right 12px center',
                backgroundRepeat: 'no-repeat',
                backgroundSize: '16px'
              }}
            >
              <option value="">Select Graph</option>
              {variableFieldOptions.graph.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
          </div>
        </div>
      </CollapsibleSection>

      {/* Object Relationships Section */}
      <CollapsibleSection 
        title="Relevance" 
        sectionKey="objectRelationships"
        icon={<Link className="w-4 h-4 text-ag-dark-text-secondary" />}
        actions={
          <div className="flex items-center gap-2">
            <button
              onClick={() => setIsCsvUploadOpen(true)}
              className="text-ag-dark-text-secondary hover:text-ag-dark-accent transition-colors"
              title="Upload Relationships CSV"
            >
              <Upload className="w-4 h-4" />
            </button>
            <button
              onClick={() => setIsVariableObjectRelationshipModalOpen(true)}
              className="px-3 py-1.5 text-sm font-medium border border-ag-dark-border rounded bg-ag-dark-bg text-ag-dark-text hover:bg-ag-dark-surface transition-colors"
              title="View and manage relationships"
            >
              View Relationships
            </button>
          </div>
        }
      >
        <div className="py-4">
          {selectedObjectRelationships.length === 0 ? (
            <div className="text-center py-6 text-ag-dark-text-secondary">
              <div className="text-sm">No object relationships defined</div>
            </div>
          ) : (
            <div className="text-sm text-ag-dark-text">
              {selectedObjectRelationships.length} object{selectedObjectRelationships.length !== 1 ? 's' : ''} selected
            </div>
          )}
        </div>
      </CollapsibleSection>

      {/* Add Variable Button */}
      <div className="mt-8 pt-6 border-t border-ag-dark-border">
        <button
          onClick={handleAddVariable}
          disabled={!isFormValid()}
          className={`w-full py-2 px-4 rounded transition-colors flex items-center justify-center gap-2 ${
            isFormValid()
              ? 'bg-ag-dark-accent text-white hover:bg-ag-dark-accent-hover'
              : 'bg-ag-dark-text-secondary text-ag-dark-text-secondary cursor-not-allowed opacity-50'
          }`}
        >
          <Plus className="w-4 h-4" />
          Add Variable
        </button>
      </div>

      {/* Variable-Object Relationship Modal */}
      <VariableObjectRelationshipModal
        isOpen={isVariableObjectRelationshipModalOpen}
        onClose={() => {
          setIsVariableObjectRelationshipModalOpen(false);
          setPendingCsvData(null); // Clear pending CSV data when modal closes
        }}
        selectedVariable={{
          id: 'new-variable-temp-id',
          variable: formData.variable || 'New Variable'
        }}
        allObjects={allObjects}
        previewMode={true}
        onSelectionChange={(selectedObjectIds: string[]) => {
          setSelectedObjectRelationships(selectedObjectIds);
        }}
        initialCsvData={pendingCsvData}
      />

      {/* CSV Upload Modal */}
      <CsvUploadModal
        isOpen={isCsvUploadOpen}
        onClose={() => setIsCsvUploadOpen(false)}
        type="variable-object-relationships"
        onUpload={(data: any[] | File) => {
          // Store CSV data and open the relationship modal
          if (Array.isArray(data)) {
            setPendingCsvData(data);
            setIsCsvUploadOpen(false);
            setIsVariableObjectRelationshipModalOpen(true);
          }
        }}
      />
    </div>
  );
};