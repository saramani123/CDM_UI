import React, { useState, useRef, useEffect } from 'react';
import { Settings, Save, X, Trash2, Plus, Link, Layers, Upload, ChevronRight, ChevronDown, Database, Users, Key } from 'lucide-react';
import { getDriversData, concatenateDrivers } from '../data/mockData';
import { CsvUploadModal } from './CsvUploadModal';

interface ObjectRelationship {
  id: string;
  to_being: string;
  to_avatar: string;
  to_object: string;
}

interface BulkEditVariablesPanelProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (data: Record<string, any>) => void;
  selectedCount: number;
  allData?: any[];
  objectsData?: any[];
}

export const BulkEditVariablesPanel: React.FC<BulkEditVariablesPanelProps> = ({
  isOpen,
  onClose,
  onSave,
  selectedCount,
  allData = [],
  objectsData = []
}) => {
  // Basic form data for variables
  const [formData, setFormData] = useState({
    part: '',
    section: '',
    group: '',
    variable: ''
  });

  // Driver selections state
  const [driverSelections, setDriverSelections] = useState({
    sector: [] as string[],
    domain: [] as string[],
    country: [] as string[],
    variableClarifier: ''
  });

  // Metadata fields
  const [metadata, setMetadata] = useState({
    formatI: '',
    formatII: '',
    gType: '',
    validation: '',
    default: '',
    graph: ''
  });

  const driversData = getDriversData();

  // Object relationships
  const [objectRelationships, setObjectRelationships] = useState<ObjectRelationship[]>([]);

  // CSV upload modal states
  const [isRelationshipUploadOpen, setIsRelationshipUploadOpen] = useState(false);
  
  // Collapsible sections state
  const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({
    drivers: false,
    ontology: false,
    metadata: false,
    relationships: false
  });

  if (!isOpen) return null;

  // Get distinct values from data for relationships
  const getDistinctBeings = () => {
    const beings = [...new Set(objectsData.map(item => item.being))];
    return ['ALL', ...beings];
  };

  const getDistinctAvatarsForBeing = (being: string) => {
    if (being === 'ALL') return ['ALL'];
    const avatars = [...new Set(objectsData.filter(item => item.being === being).map(item => item.avatar))];
    return ['ALL', ...avatars];
  };

  const getDistinctObjectsForBeingAndAvatar = (being: string, avatar: string) => {
    if (being === 'ALL' || avatar === 'ALL') return ['ALL'];
    const objects = [...new Set(objectsData.filter(item => 
      item.being === being && item.avatar === avatar
    ).map(item => item.object))];
    return ['ALL', ...objects];
  };

  // Get distinct parts and groups from variables data
  const getDistinctParts = () => {
    const parts = [...new Set(allData.map(item => item.part))];
    return ['Keep Current Part', ...parts];
  };

  const getDistinctGroups = () => {
    const groups = [...new Set(allData.map(item => item.group))];
    return ['Keep Current Group', ...groups];
  };

  const getDistinctSections = () => {
    const sections = [...new Set(allData.map(item => item.section))];
    return ['Keep Current Section', ...sections];
  };

  const getDistinctVariables = () => {
    const variables = [...new Set(allData.map(item => item.variable))];
    return ['Keep Current Variable', ...variables];
  };

  // Get distinct values for metadata dropdowns
  const getDistinctFormatI = () => {
    const formatIValues = [...new Set(allData.map(item => item.formatI).filter(val => val && val.trim() !== ''))];
    return ['Keep Current Format I', ...formatIValues];
  };

  const getDistinctFormatII = () => {
    const formatIIValues = [...new Set(allData.map(item => item.formatII).filter(val => val && val.trim() !== ''))];
    return ['Keep Current Format II', ...formatIIValues];
  };

  const getDistinctValidation = () => {
    const validationValues = [...new Set(allData.map(item => item.validation).filter(val => val && val.trim() !== ''))];
    return ['Keep Current Validation', ...validationValues];
  };

  const getDistinctGraph = () => {
    const graphValues = [...new Set(allData.map(item => item.graph).filter(val => val && val.trim() !== ''))];
    return ['Keep Current Graph', ...graphValues];
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

  const handleMetadataChange = (key: string, value: string) => {
    setMetadata(prev => ({
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

  const handleVariableClarifierChange = (value: string) => {
    setDriverSelections(prev => ({
      ...prev,
      variableClarifier: value
    }));
  };

  const handleObjectRelationshipChange = (id: string, field: keyof ObjectRelationship, value: string) => {
    setObjectRelationships(prev => prev.map(rel => {
      if (rel.id === id) {
        const updated = { ...rel, [field]: value };
        
        // Handle cascading updates
        if (field === 'to_being' && value === 'ALL') {
          updated.to_avatar = 'ALL';
          updated.to_object = 'ALL';
        } else if (field === 'to_avatar' && value === 'ALL') {
          updated.to_object = 'ALL';
        } else if (field === 'to_being' && value !== 'ALL') {
          updated.to_avatar = '';
          updated.to_object = '';
        } else if (field === 'to_avatar' && value !== 'ALL') {
          updated.to_object = '';
        }
        
        return updated;
      }
      return rel;
    }));
  };

  const addObjectRelationship = () => {
    const newRelationship: ObjectRelationship = {
      id: Date.now().toString(),
      to_being: '',
      to_avatar: '',
      to_object: ''
    };
    setObjectRelationships(prev => [...prev, newRelationship]);
  };

  const deleteObjectRelationship = (id: string) => {
    setObjectRelationships(prev => prev.filter(rel => rel.id !== id));
  };

  const handleObjectRelationshipCsvUpload = (uploadedRelationships: ObjectRelationship[]) => {
    setObjectRelationships(prev => [...prev, ...uploadedRelationships]);
  };

  const handleSaveBulkEdit = () => {
    // Generate driver string from selections if any driver fields are selected
    const hasDriverSelections = driverSelections.sector.length > 0 || 
                               driverSelections.domain.length > 0 || 
                               driverSelections.country.length > 0 || 
                               driverSelections.variableClarifier;
    
    const driverString = hasDriverSelections ? concatenateDrivers(
      driverSelections.sector,
      driverSelections.domain,
      driverSelections.country,
      driverSelections.variableClarifier
    ) : '';
    
    // Remove duplicate relationships based on unique combination of properties
    const uniqueRelationships = objectRelationships.reduce((acc, rel) => {
      if (!acc.some(existing => 
        existing.to_being === rel.to_being && 
        existing.to_avatar === rel.to_avatar && 
        existing.to_object === rel.to_object
      )) {
        acc.push(rel);
      }
      return acc;
    }, [] as ObjectRelationship[]);

    const saveData = {
      ...formData,
      ...(driverString && { driver: driverString }),
      ...metadata,
      objectRelationshipsList: uniqueRelationships
    };
    onSave(saveData);
    onClose();
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
      ? (options.length === 0 ? `No values found — please add new items in Drivers tab` : `Keep Current ${label}`)
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
          <h3 className="text-lg font-semibold text-ag-dark-text">Bulk Edit Variables</h3>
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
          <span className="font-semibold text-ag-dark-accent">Bulk Edit Mode:</span> Changes will be applied to all {selectedCount} selected variables. New relationships will be appended to existing ones.
        </div>
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
              Variable Clarifier
            </label>
            <select
              value={driverSelections.variableClarifier}
              onChange={(e) => handleVariableClarifierChange(e.target.value)}
              className="w-full px-3 py-2 pr-10 bg-ag-dark-bg border border-ag-dark-border rounded text-ag-dark-text focus:ring-2 focus:ring-ag-dark-accent focus:border-ag-dark-accent appearance-none"
              style={{
                backgroundImage: `url("data:image/svg+xml,%3csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 20 20'%3e%3cpath stroke='%236b7280' stroke-linecap='round' stroke-linejoin='round' stroke-width='1.5' d='m6 8 4 4 4-4'/%3e%3c/svg%3e")`,
                backgroundPosition: 'right 12px center',
                backgroundRepeat: 'no-repeat',
                backgroundSize: '16px'
              }}
            >
              <option value="">Keep Current Variable Clarifier</option>
              <option value="">None</option>
              {driversData.variableClarifiers.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
          </div>
        </div>
      </CollapsibleSection>

      {/* Ontology Section */}
      <CollapsibleSection title="Ontology (Taxonomy)" sectionKey="ontology" icon={<Users className="w-4 h-4 text-ag-dark-text-secondary" />}>
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-ag-dark-text mb-2">
              Part
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
              <option value="">Keep Current Part</option>
              {getDistinctParts().filter(p => p !== 'Keep Current Part').map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-ag-dark-text mb-2">
              Group
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
              <option value="">Keep Current Group</option>
              {getDistinctGroups().filter(g => g !== 'Keep Current Group').map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-ag-dark-text mb-2">
              Section
            </label>
            <input
              type="text"
              value={formData.section}
              onChange={(e) => handleChange('section', e.target.value)}
              placeholder="Keep current section"
              onClick={(e) => e.stopPropagation()}
              className="w-full px-3 py-2 bg-ag-dark-bg border border-ag-dark-border rounded text-ag-dark-text placeholder-ag-dark-text-secondary focus:ring-2 focus:ring-ag-dark-accent focus:border-ag-dark-accent"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-ag-dark-text mb-2">
              Variable
            </label>
            <input
              type="text"
              value={formData.variable}
              onChange={(e) => handleChange('variable', e.target.value)}
              placeholder="Keep current variable"
              onClick={(e) => e.stopPropagation()}
              className="w-full px-3 py-2 bg-ag-dark-bg border border-ag-dark-border rounded text-ag-dark-text placeholder-ag-dark-text-secondary focus:ring-2 focus:ring-ag-dark-accent focus:border-ag-dark-accent"
            />
          </div>
        </div>
      </CollapsibleSection>

      {/* Metadata Section */}
      <CollapsibleSection title="Metadata" sectionKey="metadata" icon={<Key className="w-4 h-4 text-ag-dark-text-secondary" />}>
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-ag-dark-text mb-2">
                Format I
              </label>
              <select
                value={metadata.formatI}
                onChange={(e) => handleMetadataChange('formatI', e.target.value)}
                className="w-full px-3 py-2 pr-10 bg-ag-dark-bg border border-ag-dark-border rounded text-ag-dark-text focus:ring-2 focus:ring-ag-dark-accent focus:border-ag-dark-accent appearance-none"
                style={{
                  backgroundImage: `url("data:image/svg+xml,%3csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 20 20'%3e%3cpath stroke='%236b7280' stroke-linecap='round' stroke-linejoin='round' stroke-width='1.5' d='m6 8 4 4 4-4'/%3e%3c/svg%3e")`,
                  backgroundPosition: 'right 12px center',
                  backgroundRepeat: 'no-repeat',
                  backgroundSize: '16px'
                }}
              >
                <option value="">Keep Current Format I</option>
                {getDistinctFormatI().filter(f => f !== 'Keep Current Format I').map((option) => (
                  <option key={option} value={option}>
                    {option}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-ag-dark-text mb-2">
                Format II
              </label>
              <select
                value={metadata.formatII}
                onChange={(e) => handleMetadataChange('formatII', e.target.value)}
                className="w-full px-3 py-2 pr-10 bg-ag-dark-bg border border-ag-dark-border rounded text-ag-dark-text focus:ring-2 focus:ring-ag-dark-accent focus:border-ag-dark-accent appearance-none"
                style={{
                  backgroundImage: `url("data:image/svg+xml,%3csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 20 20'%3e%3cpath stroke='%236b7280' stroke-linecap='round' stroke-linejoin='round' stroke-width='1.5' d='m6 8 4 4 4-4'/%3e%3c/svg%3e")`,
                  backgroundPosition: 'right 12px center',
                  backgroundRepeat: 'no-repeat',
                  backgroundSize: '16px'
                }}
              >
                <option value="">Keep Current Format II</option>
                {getDistinctFormatII().filter(f => f !== 'Keep Current Format II').map((option) => (
                  <option key={option} value={option}>
                    {option}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-ag-dark-text mb-2">
                G-Type
              </label>
              <input
                type="text"
                value={metadata.gType}
                onChange={(e) => handleMetadataChange('gType', e.target.value)}
                placeholder="Keep current G-Type"
                onClick={(e) => e.stopPropagation()}
                className="w-full px-3 py-2 bg-ag-dark-bg border border-ag-dark-border rounded text-ag-dark-text placeholder-ag-dark-text-secondary focus:ring-2 focus:ring-ag-dark-accent focus:border-ag-dark-accent"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-ag-dark-text mb-2">
                Validation
              </label>
              <select
                value={metadata.validation}
                onChange={(e) => handleMetadataChange('validation', e.target.value)}
                className="w-full px-3 py-2 pr-10 bg-ag-dark-bg border border-ag-dark-border rounded text-ag-dark-text focus:ring-2 focus:ring-ag-dark-accent focus:border-ag-dark-accent appearance-none"
                style={{
                  backgroundImage: `url("data:image/svg+xml,%3csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 20 20'%3e%3cpath stroke='%236b7280' stroke-linecap='round' stroke-linejoin='round' stroke-width='1.5' d='m6 8 4 4 4-4'/%3e%3c/svg%3e")`,
                  backgroundPosition: 'right 12px center',
                  backgroundRepeat: 'no-repeat',
                  backgroundSize: '16px'
                }}
              >
                <option value="">Keep Current Validation</option>
                {getDistinctValidation().filter(v => v !== 'Keep Current Validation').map((option) => (
                  <option key={option} value={option}>
                    {option}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-ag-dark-text mb-2">
                Default
              </label>
              <input
                type="text"
                value={metadata.default}
                onChange={(e) => handleMetadataChange('default', e.target.value)}
                placeholder="Keep current Default"
                onClick={(e) => e.stopPropagation()}
                className="w-full px-3 py-2 bg-ag-dark-bg border border-ag-dark-border rounded text-ag-dark-text placeholder-ag-dark-text-secondary focus:ring-2 focus:ring-ag-dark-accent focus:border-ag-dark-accent"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-ag-dark-text mb-2">
                Graph
              </label>
              <select
                value={metadata.graph}
                onChange={(e) => handleMetadataChange('graph', e.target.value)}
                className="w-full px-3 py-2 pr-10 bg-ag-dark-bg border border-ag-dark-border rounded text-ag-dark-text focus:ring-2 focus:ring-ag-dark-accent focus:border-ag-dark-accent appearance-none"
                style={{
                  backgroundImage: `url("data:image/svg+xml,%3csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 20 20'%3e%3cpath stroke='%236b7280' stroke-linecap='round' stroke-linejoin='round' stroke-width='1.5' d='m6 8 4 4 4-4'/%3e%3c/svg%3e")`,
                  backgroundPosition: 'right 12px center',
                  backgroundRepeat: 'no-repeat',
                  backgroundSize: '16px'
                }}
              >
                <option value="">Keep Current Graph</option>
                {getDistinctGraph().filter(g => g !== 'Keep Current Graph').map((option) => (
                  <option key={option} value={option}>
                    {option}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>
      </CollapsibleSection>

      {/* Object Relationships Section */}
      <CollapsibleSection 
        title="New Relationships" 
        sectionKey="relationships"
        icon={<Link className="w-4 h-4 text-ag-dark-text-secondary" />}
        actions={
          <>
            <button
              onClick={() => setIsRelationshipUploadOpen(true)}
              className="text-ag-dark-text-secondary hover:text-ag-dark-accent transition-colors"
              title="Upload Relationships CSV"
            >
              <Upload className="w-4 h-4" />
            </button>
            <button
              onClick={addObjectRelationship}
              className="text-ag-dark-accent hover:text-ag-dark-accent-hover transition-colors"
              title="Add Relationship"
            >
              <Plus className="w-4 h-4" />
            </button>
          </>
        }
      >
        {objectRelationships.length === 0 ? (
          <div className="text-center py-6 text-ag-dark-text-secondary">
            <div className="text-sm">No new relationships to add</div>
            <button
              onClick={addObjectRelationship}
              className="mt-2 text-ag-dark-accent hover:text-ag-dark-accent-hover text-sm"
            >
              Add your first new relationship
            </button>
          </div>
        ) : (
          <div className="space-y-4">
            {objectRelationships.map((relationship, index) => (
              <div key={relationship.id} className="bg-ag-dark-bg rounded-lg p-4 border border-ag-dark-border">
                <div className="flex items-center justify-between mb-3">
                  <span className="text-sm font-medium text-ag-dark-text">
                    New Relationship #{index + 1}
                  </span>
                  <button
                    onClick={() => deleteObjectRelationship(relationship.id)}
                    className="text-ag-dark-error hover:text-red-400 transition-colors"
                    title="Delete Relationship"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
                
                <div className="space-y-3">
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-medium text-ag-dark-text-secondary mb-1">
                        To Being
                      </label>
                      <select
                        value={relationship.to_being}
                        onChange={(e) => handleObjectRelationshipChange(relationship.id, 'to_being', e.target.value)}
                        className="w-full px-2 py-1.5 pr-8 bg-ag-dark-surface border border-ag-dark-border rounded text-sm text-ag-dark-text focus:ring-1 focus:ring-ag-dark-accent focus:border-ag-dark-accent appearance-none"
                        style={{
                          backgroundImage: `url("data:image/svg+xml,%3csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 20 20'%3e%3cpath stroke='%236b7280' stroke-linecap='round' stroke-linejoin='round' stroke-width='1.5' d='m6 8 4 4 4-4'/%3e%3c/svg%3e")`,
                          backgroundPosition: 'right 8px center',
                          backgroundRepeat: 'no-repeat',
                          backgroundSize: '12px'
                        }}
                      >
                        <option value="">Select To Being</option>
                        {getDistinctBeings().map((being) => (
                          <option key={being} value={being}>
                            {being}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="block text-xs font-medium text-ag-dark-text-secondary mb-1">
                        To Avatar
                      </label>
                      <select
                        value={relationship.to_avatar}
                        onChange={(e) => handleObjectRelationshipChange(relationship.id, 'to_avatar', e.target.value)}
                        className="w-full px-2 py-1.5 pr-8 bg-ag-dark-surface border border-ag-dark-border rounded text-sm text-ag-dark-text focus:ring-1 focus:ring-ag-dark-accent focus:border-ag-dark-accent appearance-none"
                        style={{
                          backgroundImage: `url("data:image/svg+xml,%3csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 20 20'%3e%3cpath stroke='%236b7280' stroke-linecap='round' stroke-linejoin='round' stroke-width='1.5' d='m6 8 4 4 4-4'/%3e%3c/svg%3e")`,
                          backgroundPosition: 'right 8px center',
                          backgroundRepeat: 'no-repeat',
                          backgroundSize: '12px'
                        }}
                      >
                        <option value="">Select To Avatar</option>
                        {relationship.to_being && getDistinctAvatarsForBeing(relationship.to_being).map((avatar) => (
                          <option key={avatar} value={avatar}>
                            {avatar}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-ag-dark-text-secondary mb-1">
                      To Object
                    </label>
                    <select
                      value={relationship.to_object}
                      onChange={(e) => handleObjectRelationshipChange(relationship.id, 'to_object', e.target.value)}
                      className="w-full px-2 py-1.5 pr-8 bg-ag-dark-surface border border-ag-dark-border rounded text-sm text-ag-dark-text focus:ring-1 focus:ring-ag-dark-accent focus:border-ag-dark-accent appearance-none"
                      style={{
                        backgroundImage: `url("data:image/svg+xml,%3csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 20 20'%3e%3cpath stroke='%236b7280' stroke-linecap='round' stroke-linejoin='round' stroke-width='1.5' d='m6 8 4 4 4-4'/%3e%3c/svg%3e")`,
                        backgroundPosition: 'right 8px center',
                        backgroundRepeat: 'no-repeat',
                        backgroundSize: '12px'
                      }}
                    >
                      <option value="">Select To Object</option>
                      {relationship.to_being && relationship.to_avatar && 
                        getDistinctObjectsForBeingAndAvatar(relationship.to_being, relationship.to_avatar).map((object) => (
                        <option key={object} value={object}>
                          {object}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </CollapsibleSection>

      {/* Apply Changes Button */}
      <div className="mt-8 pt-6 border-t border-ag-dark-border">
        <button
          onClick={handleSaveBulkEdit}
          className="w-full bg-ag-dark-accent text-white py-2 px-4 rounded hover:bg-ag-dark-accent-hover transition-colors flex items-center justify-center gap-2"
        >
          <Save className="w-4 h-4" />
          Apply to {selectedCount} Variables
        </button>
      </div>

      {/* CSV Upload Modal */}
      <CsvUploadModal
        isOpen={isRelationshipUploadOpen}
        onClose={() => setIsRelationshipUploadOpen(false)}
        type="relationships"
        onUpload={handleObjectRelationshipCsvUpload}
      />
    </div>
  );
};
