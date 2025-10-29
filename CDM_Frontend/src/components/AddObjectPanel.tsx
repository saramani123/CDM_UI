import React, { useState, useRef, useEffect } from 'react';
import { Settings, X, Trash2, Plus, Link, Layers, Upload, ChevronRight, ChevronDown, Database, Users, Key, ArrowUpAZ, ArrowDownZA } from 'lucide-react';
import { getAvatarOptions, concatenateDrivers } from '../data/mockData';
import { CsvUploadModal } from './CsvUploadModal';
import { RelationshipModal } from './RelationshipModal';
import { useDrivers } from '../hooks/useDrivers';
import { useObjects } from '../hooks/useObjects';

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

interface AddObjectPanelProps {
  isOpen: boolean;
  onClose: () => void;
  onAdd: (objectData: any) => void;
  allData?: any[];
}

interface CollapsibleSectionProps {
  title: string;
  sectionKey: string;
  icon?: React.ReactNode;
  actions?: React.ReactNode;
  children: React.ReactNode;
  isExpanded: boolean;
  onToggle: (sectionKey: string) => void;
}

interface MultiSelectProps {
  label: string;
  options: string[];
  values: string[];
  onChange: (values: string[]) => void;
}

const CollapsibleSection: React.FC<CollapsibleSectionProps> = ({ 
  title, 
  sectionKey, 
  icon, 
  actions, 
  children, 
  isExpanded, 
  onToggle 
}) => {
  return (
    <div className="border-t border-ag-dark-border pt-8">
      <div 
        className="flex items-center justify-between cursor-pointer hover:bg-ag-dark-bg rounded p-3 -m-3 transition-colors mb-4"
        onClick={() => onToggle(sectionKey)}
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

const MultiSelect: React.FC<MultiSelectProps> = ({ label, options, values, onChange }) => {
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

export const AddObjectPanel: React.FC<AddObjectPanelProps> = ({
  isOpen,
  onClose,
  onAdd,
  allData = []
}) => {
  // Use API hooks
  const { drivers: apiDrivers } = useDrivers();
  const { getBeings, getAvatars } = useObjects();
  
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
  const driversData = apiDrivers || {
    sectors: [],
    domains: [],
    countries: [],
    objectClarifiers: [],
    variableClarifiers: []
  };
  
  // Taxonomy data from API
  const [beings, setBeings] = useState<string[]>([]);
  const [avatars, setAvatars] = useState<string[]>([]);
  
  // Load taxonomy data from API
  useEffect(() => {
    const loadTaxonomyData = async () => {
      try {
        const beingsData = await getBeings();
        setBeings(beingsData as string[]);
      } catch (error) {
        console.error('Failed to load beings:', error);
        // Fallback to mock data
        setBeings(['Master', 'Mate', 'Process', 'Adjunct', 'Rule', 'Roster']);
      }
    };
    
    if (isOpen && beings.length === 0) {
      loadTaxonomyData();
    }
  }, [isOpen, getBeings, beings.length]);
  
  // Load avatars when being changes
  useEffect(() => {
    const loadAvatars = async () => {
      if (formData.being) {
        try {
        const avatarsData = await getAvatars(formData.being);
        setAvatars(avatarsData as string[]);
        } catch (error) {
          console.error('Failed to load avatars:', error);
          // Fallback to mock data
          setAvatars(getAvatarOptions(formData.being, '***, ***, ***, ***'));
        }
      } else {
        setAvatars([]);
      }
    };
    
    if (formData.being) {
      loadAvatars();
    } else {
      setAvatars([]);
    }
  }, [formData.being, getAvatars]);
  
  // Identifier data
  const [discreteId, setDiscreteId] = useState('Public ID');
  const [compositeKeys, setCompositeKeys] = useState<CompositeKey[]>([
    { id: '1', part: '', group: '' },
    { id: '2', part: '', group: '' },
    { id: '3', part: '', group: '' },
    { id: '4', part: '', group: '' },
    { id: '5', part: '', group: '' }
  ]);

  // Variants - using string for multiline input
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
  const [isVariantUploadOpen, setIsVariantUploadOpen] = useState(false);
  
  // Relationship modal state
  const [isRelationshipModalOpen, setIsRelationshipModalOpen] = useState(false);
  const [pendingRelationships, setPendingRelationships] = useState<any[]>([]);
  
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
  // Use API avatars data with fallback to mock data
  const avatarOptions = avatars.length > 0 ? avatars : getAvatarOptions(formData.being || '', driverString);

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


  const handleVariantsTextChange = (text: string) => {
    setVariantsText(text);
  };

  const handleVariantCsvUpload = (uploadedVariants: Variant[]) => {
    // Append new variants to textarea
    const newLines = uploadedVariants.map(v => v.name).join('\n');
    setVariantsText(prev => prev ? `${prev}\n${newLines}` : newLines);
  };

  // Validation - all required fields must be filled
  const isFormValid = () => {
    return driverSelections.sector.length > 0 && 
           driverSelections.domain.length > 0 && 
           driverSelections.country.length > 0 && 
           formData.being && 
           formData.avatar && 
           formData.objectName;
  };

  const handleAddObject = () => {
    if (!isFormValid()) {
      alert('Please fill in all required fields (Sector, Domain, Country, Being, Avatar, Object Name)');
      return;
    }

    const driverString = concatenateDrivers(
      driverSelections.sector,
      driverSelections.domain,
      driverSelections.country,
      driverSelections.objectClarifier
    );

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
      
      alert(`Cannot add: Duplicate variant names found: ${duplicateNames.join(', ')}. Please remove duplicates before adding.`);
      return;
    }

    const newObject = {
      id: Date.now().toString(),
      driver: driverString,
      being: formData.being,
      avatar: formData.avatar,
      object: formData.objectName,
      relationships: 0, // Will be updated when relationships are created
      variants: variantsList.length,
      variables: 54, // Fixed value as requested
      status: 'Active',
      relationshipsList: [], // Will be populated when relationships are created
      variantsList: variantsList,
      identifier: {
        discreteId,
        compositeKeys: compositeKeys.filter(key => key.part || key.group)
      }
    };

    onAdd(newObject);
    
    // Reset form
    setFormData({ being: '', avatar: '', objectName: '' });
    setDriverSelections({
      sector: [],
      domain: [],
      country: [],
      objectClarifier: ''
    });
    setDiscreteId('Public ID');
    setCompositeKeys([
      { id: '1', part: '', group: '' },
      { id: '2', part: '', group: '' },
      { id: '3', part: '', group: '' },
      { id: '4', part: '', group: '' },
      { id: '5', part: '', group: '' }
    ]);
    setVariantsText('');
    setVariantsArray([]);
    setPendingRelationships([]);
    
    onClose();
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

      {/* Object Name Field - Moved out of collapsible section */}
      <div className="mb-6">
        <label className="block text-sm font-medium text-ag-dark-text mb-2">
          Object Name <span className="text-ag-dark-error">*</span>
        </label>
        <input
          type="text"
          value={formData.objectName}
          onChange={(e) => handleChange('objectName', e.target.value)}
          placeholder="Enter object name..."
          onClick={(e) => e.stopPropagation()}
          className="w-full px-3 py-2 bg-ag-dark-bg border border-ag-dark-border rounded text-ag-dark-text placeholder-ag-dark-text-secondary focus:ring-2 focus:ring-ag-dark-accent focus:border-ag-dark-accent"
        />
      </div>

      {/* Drivers Section */}
      <CollapsibleSection 
        title="Drivers" 
        sectionKey="drivers" 
        icon={<Database className="w-4 h-4 text-ag-dark-text-secondary" />}
        isExpanded={expandedSections.drivers}
        onToggle={toggleSection}
      >
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-ag-dark-text mb-2">
              Sector <span className="text-ag-dark-error">*</span>
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
              Domain <span className="text-ag-dark-error">*</span>
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
              Country <span className="text-ag-dark-error">*</span>
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
      <CollapsibleSection 
        title="Ontology" 
        sectionKey="ontology" 
        icon={<Users className="w-4 h-4 text-ag-dark-text-secondary" />}
        isExpanded={expandedSections.ontology}
        onToggle={toggleSection}
      >
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-ag-dark-text mb-2">
              Being <span className="text-ag-dark-error">*</span>
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
              <option value="">Select Being</option>
              {beings.map((being) => (
                <option key={being} value={being}>
                  {being}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-ag-dark-text mb-2">
              Avatar <span className="text-ag-dark-error">*</span>
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
      <CollapsibleSection 
        title="Identifiers" 
        sectionKey="identifiers" 
        icon={<Key className="w-4 h-4 text-ag-dark-text-secondary" />}
        isExpanded={expandedSections.identifiers}
        onToggle={toggleSection}
      >
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
        title="Relationships" 
        sectionKey="relationships"
        icon={<Link className="w-4 h-4 text-ag-dark-text-secondary" />}
        isExpanded={expandedSections.relationships}
        onToggle={toggleSection}
        actions={
          <button
            onClick={() => setIsRelationshipModalOpen(true)}
            className="px-3 py-1.5 text-sm font-medium border border-ag-dark-border rounded bg-ag-dark-bg text-ag-dark-text hover:bg-ag-dark-surface transition-colors"
            title="View and manage relationships"
          >
            Add Relationships
          </button>
        }
      >
        <div className="text-center py-6 text-ag-dark-text-secondary">
          <div className="text-sm">No relationships defined</div>
        </div>
      </CollapsibleSection>

      {/* Variants Section */}
      <CollapsibleSection 
        title="Variants" 
        sectionKey="variants"
        icon={<Layers className="w-4 h-4 text-ag-dark-text-secondary" />}
        isExpanded={expandedSections.variants}
        onToggle={toggleSection}
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

      {/* Add Object Button */}
      <div className="mt-8 pt-6 border-t border-ag-dark-border">
        <button
          onClick={handleAddObject}
          disabled={!isFormValid()}
          className={`w-full py-2 px-4 rounded transition-colors flex items-center justify-center gap-2 ${
            isFormValid()
              ? 'bg-ag-dark-accent text-white hover:bg-ag-dark-accent-hover'
              : 'bg-ag-dark-text-secondary text-ag-dark-text-secondary cursor-not-allowed opacity-50'
          }`}
        >
          <Plus className="w-4 h-4" />
          Add Object
        </button>
      </div>

      {/* CSV Upload Modals */}
      <CsvUploadModal
        isOpen={isVariantUploadOpen}
        onClose={() => setIsVariantUploadOpen(false)}
        type="variants"
        onUpload={handleVariantCsvUpload}
      />

      {/* Relationship Modal */}
      <RelationshipModal
        isOpen={isRelationshipModalOpen}
        onClose={() => setIsRelationshipModalOpen(false)}
        selectedObject={{
          id: 'temp-new-object',
          being: formData.being,
          avatar: formData.avatar,
          object: formData.objectName,
          sector: driverSelections.sector,
          domain: driverSelections.domain,
          country: driverSelections.country,
          objectClarifier: driverSelections.objectClarifier
        }}
        allObjects={allData || []}
        onSave={() => {
          // Close the modal - relationships will be handled when object is created
          setIsRelationshipModalOpen(false);
        }}
      />
    </div>
  );
};