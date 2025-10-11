import React, { useState, useRef, useEffect } from 'react';
import { Settings, Save, X, Trash2, Plus, Link, Layers, Upload, ChevronRight, ChevronDown, Database, Users, Key } from 'lucide-react';
import { getAvatarOptions, concatenateDrivers } from '../data/mockData';
import { CsvUploadModal } from './CsvUploadModal';
import { useDrivers } from '../hooks/useDrivers';

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
  const driversData = apiDrivers || {
    sectors: [],
    domains: [],
    countries: [],
    objectClarifiers: [],
    variableClarifiers: []
  };

  // Identifier data
  const [discreteId, setDiscreteId] = useState('');
  const [compositeKeys, setCompositeKeys] = useState<CompositeKey[]>([
    { id: '1', part: '', group: '' },
    { id: '2', part: '', group: '' },
    { id: '3', part: '', group: '' },
    { id: '4', part: '', group: '' },
    { id: '5', part: '', group: '' }
  ]);

  // Relationships and variants
  const [relationships, setRelationships] = useState<Relationship[]>([]);
  const [variants, setVariants] = useState<Variant[]>([]);

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

  // Mock options for Part and Group
  const partOptions = ['Name', 'ID', 'Code', 'Reference', 'Key'];
  const groupOptions = ['Primary', 'Secondary', 'Tertiary', 'System', 'User'];
  
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
    setCompositeKeys(prev => prev.map(key => 
      key.id === id ? { ...key, [field]: value } : key
    ));
  };

  const handleDeleteCompositeKey = (id: string) => {
    setCompositeKeys(prev => prev.map(key => 
      key.id === id ? { ...key, part: '', group: '' } : key
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

  const addVariant = () => {
    const newVariant: Variant = {
      id: Date.now().toString(),
      name: ''
    };
    setVariants(prev => [...prev, newVariant]);
  };

  const handleVariantChange = (id: string, name: string) => {
    setVariants(prev => prev.map(variant => 
      variant.id === id ? { ...variant, name } : variant
    ));
  };

  const deleteVariant = (id: string) => {
    setVariants(prev => prev.filter(variant => variant.id !== id));
  };

  const handleRelationshipCsvUpload = (uploadedRelationships: Relationship[]) => {
    setRelationships(prev => [...prev, ...uploadedRelationships]);
  };

  const handleVariantCsvUpload = (uploadedVariants: Variant[]) => {
    setVariants(prev => [...prev, ...uploadedVariants]);
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

    const saveData = {
      ...formData,
      ...(driverString && { driver: driverString }),
      identifier: {
        discreteId,
        compositeKeys: compositeKeys.filter(key => key.part || key.group)
      },
      relationshipsList: uniqueRelationships,
      variantsList: variants
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
      ? `Keep Current ${label}` 
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
          <h3 className="text-lg font-semibold text-ag-dark-text">Edit Selected Objects</h3>
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

          <div>
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
        </div>
      </CollapsibleSection>

      {/* Identifiers Section */}
      <CollapsibleSection title="Identifiers" sectionKey="identifiers" icon={<Key className="w-4 h-4 text-ag-dark-text-secondary" />}>
        <div className="space-y-6">
          {/* Discrete ID */}
          <div>
            <label className="block text-sm font-medium text-ag-dark-text mb-2">
              Discrete ID
            </label>
            <select
              value={discreteId}
              onChange={(e) => setDiscreteId(e.target.value)}
              className="w-full px-3 py-2 pr-10 bg-ag-dark-bg border border-ag-dark-border rounded text-ag-dark-text focus:ring-2 focus:ring-ag-dark-accent focus:border-ag-dark-accent appearance-none"
              style={{
                backgroundImage: `url("data:image/svg+xml,%3csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 20 20'%3e%3cpath stroke='%236b7280' stroke-linecap='round' stroke-linejoin='round' stroke-width='1.5' d='m6 8 4 4 4-4'/%3e%3c/svg%3e")`,
                backgroundPosition: 'right 12px center',
                backgroundRepeat: 'no-repeat',
                backgroundSize: '16px'
              }}
            >
              <option value="">Keep Current Discrete ID</option>
              <option value="Public ID">Public ID</option>
              <option value="Proprietary ID">Proprietary ID</option>
            </select>
          </div>

          {/* Composite Keys */}
          <div className="space-y-4">
            <h5 className="text-sm font-medium text-ag-dark-text">Composite Keys</h5>
            {compositeKeys.map((compositeKey, index) => (
              <div key={compositeKey.id} className="bg-ag-dark-bg rounded-lg p-4 border border-ag-dark-border">
                <div className="flex items-center justify-between mb-3">
                  <span className="text-sm font-medium text-ag-dark-text">
                    Composite Key #{compositeKey.id}
                  </span>
                  <button
                    onClick={() => handleDeleteCompositeKey(compositeKey.id)}
                    className="text-ag-dark-error hover:text-red-400 transition-colors"
                    title="Clear Composite Key"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
                
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-ag-dark-text-secondary mb-1">
                      Part
                    </label>
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
                      {partOptions.map((option) => (
                        <option key={option} value={option}>
                          {option}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-ag-dark-text-secondary mb-1">
                      Group
                    </label>
                    <select
                      value={compositeKey.group}
                      onChange={(e) => handleCompositeKeyChange(compositeKey.id, 'group', e.target.value)}
                      className="w-full px-2 py-1.5 pr-8 bg-ag-dark-surface border border-ag-dark-border rounded text-sm text-ag-dark-text focus:ring-1 focus:ring-ag-dark-accent focus:border-ag-dark-accent appearance-none"
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
              onClick={addRelationship}
              className="text-ag-dark-accent hover:text-ag-dark-accent-hover transition-colors"
              title="Add Relationship"
            >
              <Plus className="w-4 h-4" />
            </button>
          </>
        }
      >
        {relationships.length === 0 ? (
          <div className="text-center py-6 text-ag-dark-text-secondary">
            <div className="text-sm">No new relationships to add</div>
            <button
              onClick={addRelationship}
              className="mt-2 text-ag-dark-accent hover:text-ag-dark-accent-hover text-sm"
            >
              Add your first new relationship
            </button>
          </div>
        ) : (
          <div className="space-y-4">
            {relationships.map((relationship, index) => (
              <div key={relationship.id} className="bg-ag-dark-bg rounded-lg p-4 border border-ag-dark-border">
                <div className="flex items-center justify-between mb-3">
                  <span className="text-sm font-medium text-ag-dark-text">
                    New Relationship #{index + 1}
                  </span>
                  <button
                    onClick={() => deleteRelationship(relationship.id)}
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
                        Type
                      </label>
                      <select
                        value={relationship.type}
                        onChange={(e) => handleRelationshipChange(relationship.id, 'type', e.target.value)}
                        className="w-full px-2 py-1.5 pr-8 bg-ag-dark-surface border border-ag-dark-border rounded text-sm text-ag-dark-text focus:ring-1 focus:ring-ag-dark-accent focus:border-ag-dark-accent appearance-none"
                        style={{
                          backgroundImage: `url("data:image/svg+xml,%3csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 20 20'%3e%3cpath stroke='%236b7280' stroke-linecap='round' stroke-linejoin='round' stroke-width='1.5' d='m6 8 4 4 4-4'/%3e%3c/svg%3e")`,
                          backgroundPosition: 'right 8px center',
                          backgroundRepeat: 'no-repeat',
                          backgroundSize: '12px'
                        }}
                      >
                        <option value="Blood">Blood</option>
                        <option value="Intra-Table">Intra-Table</option>
                        <option value="Inter-Table">Inter-Table</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-xs font-medium text-ag-dark-text-secondary mb-1">
                        Role
                      </label>
                      <input
                        type="text"
                        placeholder="Enter role..."
                        value={relationship.role}
                        onChange={(e) => handleRelationshipChange(relationship.id, 'role', e.target.value)}
                        onClick={(e) => e.stopPropagation()}
                        className="w-full px-2 py-1.5 bg-ag-dark-surface border border-ag-dark-border rounded text-sm text-ag-dark-text placeholder-ag-dark-text-secondary focus:ring-1 focus:ring-ag-dark-accent focus:border-ag-dark-accent"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-medium text-ag-dark-text-secondary mb-1">
                        To Being
                      </label>
                      <select
                        value={relationship.toBeing}
                        onChange={(e) => handleRelationshipChange(relationship.id, 'toBeing', e.target.value)}
                        disabled={relationship.type === 'Intra-Table'}
                        className="w-full px-2 py-1.5 pr-8 bg-ag-dark-surface border border-ag-dark-border rounded text-sm text-ag-dark-text focus:ring-1 focus:ring-ag-dark-accent focus:border-ag-dark-accent appearance-none disabled:opacity-50 disabled:cursor-not-allowed"
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
                        value={relationship.toAvatar}
                        onChange={(e) => handleRelationshipChange(relationship.id, 'toAvatar', e.target.value)}
                        disabled={relationship.type === 'Intra-Table'}
                        className="w-full px-2 py-1.5 pr-8 bg-ag-dark-surface border border-ag-dark-border rounded text-sm text-ag-dark-text focus:ring-1 focus:ring-ag-dark-accent focus:border-ag-dark-accent appearance-none disabled:opacity-50 disabled:cursor-not-allowed"
                        style={{
                          backgroundImage: `url("data:image/svg+xml,%3csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 20 20'%3e%3cpath stroke='%236b7280' stroke-linecap='round' stroke-linejoin='round' stroke-width='1.5' d='m6 8 4 4 4-4'/%3e%3c/svg%3e")`,
                          backgroundPosition: 'right 8px center',
                          backgroundRepeat: 'no-repeat',
                          backgroundSize: '12px'
                        }}
                      >
                        <option value="">Select To Avatar</option>
                        {relationship.toBeing && getDistinctAvatarsForBeing(relationship.toBeing).map((avatar) => (
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
                      value={relationship.toObject}
                      onChange={(e) => handleRelationshipChange(relationship.id, 'toObject', e.target.value)}
                      disabled={relationship.type === 'Intra-Table'}
                      className="w-full px-2 py-1.5 pr-8 bg-ag-dark-surface border border-ag-dark-border rounded text-sm text-ag-dark-text focus:ring-1 focus:ring-ag-dark-accent focus:border-ag-dark-accent appearance-none disabled:opacity-50 disabled:cursor-not-allowed"
                      style={{
                        backgroundImage: `url("data:image/svg+xml,%3csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 20 20'%3e%3cpath stroke='%236b7280' stroke-linecap='round' stroke-linejoin='round' stroke-width='1.5' d='m6 8 4 4 4-4'/%3e%3c/svg%3e")`,
                        backgroundPosition: 'right 8px center',
                        backgroundRepeat: 'no-repeat',
                        backgroundSize: '12px'
                      }}
                    >
                      <option value="">Select To Object</option>
                      {relationship.toBeing && relationship.toAvatar && 
                        getDistinctObjectsForBeingAndAvatar(relationship.toBeing, relationship.toAvatar).map((object) => (
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

      {/* Variants Section */}
      <CollapsibleSection 
        title="New Variants" 
        sectionKey="variants"
        icon={<Layers className="w-4 h-4 text-ag-dark-text-secondary" />}
        actions={
          <>
            <button
              onClick={() => setIsVariantUploadOpen(true)}
              className="text-ag-dark-text-secondary hover:text-ag-dark-accent transition-colors"
              title="Upload Variants CSV"
            >
              <Upload className="w-4 h-4" />
            </button>
            <button
              onClick={addVariant}
              className="text-ag-dark-accent hover:text-ag-dark-accent-hover transition-colors"
              title="Add Variant"
            >
              <Plus className="w-4 h-4" />
            </button>
          </>
        }
      >
        {variants.length === 0 ? (
          <div className="text-center py-6 text-ag-dark-text-secondary">
            <div className="text-sm">No new variants to add</div>
            <button
              onClick={addVariant}
              className="mt-2 text-ag-dark-accent hover:text-ag-dark-accent-hover text-sm"
            >
              Add your first new variant
            </button>
          </div>
        ) : (
          <div className="space-y-4">
            {variants.map((variant, index) => (
              <div key={variant.id} className="bg-ag-dark-bg rounded-lg p-4 border border-ag-dark-border">
                <div className="flex items-center justify-between mb-3">
                  <span className="text-sm font-medium text-ag-dark-text">
                    New Variant #{index + 1}
                  </span>
                  <button
                    onClick={() => deleteVariant(variant.id)}
                    className="text-ag-dark-error hover:text-red-400 transition-colors"
                    title="Delete Variant"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
                
                <div>
                  <label className="block text-xs font-medium text-ag-dark-text-secondary mb-1">
                    Variant Name
                  </label>
                  <input
                    type="text"
                    placeholder="Enter variant name..."
                    value={variant.name}
                    onChange={(e) => handleVariantChange(variant.id, e.target.value)}
                    onClick={(e) => e.stopPropagation()}
                    className="w-full px-2 py-1.5 bg-ag-dark-surface border border-ag-dark-border rounded text-sm text-ag-dark-text placeholder-ag-dark-text-secondary focus:ring-1 focus:ring-ag-dark-accent focus:border-ag-dark-accent"
                  />
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