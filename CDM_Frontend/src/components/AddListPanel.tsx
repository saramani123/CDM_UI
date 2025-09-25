import React, { useState } from 'react';
import { Settings, Save, X, Trash2, Plus, Link, Upload, List, Database, Users, FileText, ChevronRight, ChevronDown } from 'lucide-react';
import { listFieldOptions } from '../data/listsData';
import { ListCsvUploadModal } from './ListCsvUploadModal';

interface VariableAttached {
  id: string;
  part: string;
  section: string;
  group: string;
  variable: string;
}

interface ListValue {
  id: string;
  value: string;
}

interface AddListPanelProps {
  isOpen: boolean;
  onClose: () => void;
  onAdd: (listData: any) => void;
  allData?: any[];
}

export const AddListPanel: React.FC<AddListPanelProps> = ({
  isOpen,
  onClose,
  onAdd,
  allData = []
}) => {
  // Basic form data
  const [formData, setFormData] = useState({
    driver: '',
    objectType: '',
    clarifier: '',
    format: '',
    variable: '',
    set: '',
    grouping: '',
    list: '',
    source: '',
    upkeep: '',
    graph: '',
    origin: ''
  });

  // Variables attached and list values
  const [variablesAttached, setVariablesAttached] = useState<VariableAttached[]>([]);
  const [listValues, setListValues] = useState<ListValue[]>([]);

  // CSV upload modal states
  const [isVariableAttachedUploadOpen, setIsVariableAttachedUploadOpen] = useState(false);
  const [isListValuesUploadOpen, setIsListValuesUploadOpen] = useState(false);
  
  // Collapsible sections state
  const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({
    drivers: false,
    ontology: false,
    metadata: false,
    relationships: false
  });

  if (!isOpen) return null;

  // Get distinct values from variables data for cascading dropdowns
  const getDistinctParts = () => {
    const variablesData = (window as any).variablesData || [];
    return [...new Set(variablesData.map((item: any) => item.part))].filter(Boolean);
  };

  const getDistinctSectionsForPart = (part: string) => {
    const variablesData = (window as any).variablesData || [];
    return [...new Set(variablesData
      .filter((item: any) => item.part === part)
      .map((item: any) => item.section)
    )].filter(Boolean);
  };

  const getDistinctGroupsForPartAndSection = (part: string, section: string) => {
    const variablesData = (window as any).variablesData || [];
    return [...new Set(variablesData
      .filter((item: any) => item.part === part && item.section === section)
      .map((item: any) => item.group)
    )].filter(Boolean);
  };

  const getDistinctVariablesForPartSectionGroup = (part: string, section: string, group: string) => {
    const variablesData = (window as any).variablesData || [];
    return [...new Set(variablesData
      .filter((item: any) => item.part === part && item.section === section && item.group === group)
      .map((item: any) => item.variable)
    )].filter(Boolean);
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

  const handleVariableAttachedChange = (id: string, field: keyof VariableAttached, value: string) => {
    setVariablesAttached(prev => prev.map(variable => {
      if (variable.id === id) {
        const updated = { ...variable, [field]: value };
        
        // Handle cascading updates
        if (field === 'part') {
          updated.section = '';
          updated.group = '';
          updated.variable = '';
        } else if (field === 'section') {
          updated.group = '';
          updated.variable = '';
        } else if (field === 'group') {
          updated.variable = '';
        }
        
        return updated;
      }
      return variable;
    }));
  };

  const addVariableAttached = () => {
    const newVariable: VariableAttached = {
      id: Date.now().toString(),
      part: '',
      section: '',
      group: '',
      variable: ''
    };
    setVariablesAttached(prev => [...prev, newVariable]);
  };

  const deleteVariableAttached = (id: string) => {
    setVariablesAttached(prev => prev.filter(variable => variable.id !== id));
  };

  const handleListValueChange = (id: string, value: string) => {
    setListValues(prev => prev.map(listValue => 
      listValue.id === id ? { ...listValue, value } : listValue
    ));
  };

  const addListValue = () => {
    const newListValue: ListValue = {
      id: Date.now().toString(),
      value: ''
    };
    setListValues(prev => [...prev, newListValue]);
  };

  const deleteListValue = (id: string) => {
    setListValues(prev => prev.filter(listValue => listValue.id !== id));
  };

  const handleVariableAttachedCsvUpload = (uploadedVariables: VariableAttached[]) => {
    setVariablesAttached(prev => [...prev, ...uploadedVariables]);
  };

  const handleListValuesCsvUpload = (uploadedValues: ListValue[]) => {
    setListValues(prev => [...prev, ...uploadedValues]);
  };

  // Validation - all required fields must be filled
  const isFormValid = () => {
    const requiredFields = ['driver', 'objectType', 'clarifier', 'format', 'variable', 'set', 'list'];
    return requiredFields.every(field => formData[field as keyof typeof formData]);
  };

  const handleAddList = () => {
    if (!isFormValid()) {
      alert('Please fill in all required fields (Driver, Object Type, Clarifier, Format, Variable, Set, List)');
      return;
    }

    const newList = {
      id: Date.now().toString(),
      ...formData,
      status: 'Active',
      variablesAttachedList: variablesAttached,
      listValuesList: listValues
    };

    onAdd(newList);
    
    // Reset form
    setFormData({
      driver: '',
      objectType: '',
      clarifier: '',
      format: '',
      variable: '',
      set: '',
      grouping: '',
      list: '',
      source: '',
      upkeep: '',
      graph: '',
      origin: ''
    });
    setVariablesAttached([]);
    setListValues([]);
    
    onClose();
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
          <h3 className="text-lg font-semibold text-ag-dark-text">Add New List</h3>
        </div>
        <button
          onClick={onClose}
          className="text-ag-dark-text-secondary hover:text-ag-dark-text transition-colors"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      {/* Drivers Section */}
      <CollapsibleSection title="Drivers" sectionKey="drivers" icon={<Database className="w-4 h-4 text-ag-dark-text-secondary" />}>
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-ag-dark-text mb-2">
              Driver <span className="text-ag-dark-error">*</span>
            </label>
            <select
              value={formData.driver}
              onChange={(e) => handleChange('driver', e.target.value)}
              className="w-full px-3 py-2 pr-10 bg-ag-dark-bg border border-ag-dark-border rounded text-ag-dark-text focus:ring-2 focus:ring-ag-dark-accent focus:border-ag-dark-accent appearance-none"
              style={{
                backgroundImage: `url("data:image/svg+xml,%3csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 20 20'%3e%3cpath stroke='%236b7280' stroke-linecap='round' stroke-linejoin='round' stroke-width='1.5' d='m6 8 4 4 4-4'/%3e%3c/svg%3e")`,
                backgroundPosition: 'right 12px center',
                backgroundRepeat: 'no-repeat',
                backgroundSize: '16px'
              }}
            >
              <option value="">Select Driver</option>
              {listFieldOptions.driver.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-ag-dark-text mb-2">
              Clarifier <span className="text-ag-dark-error">*</span>
            </label>
            <select
              value={formData.clarifier}
              onChange={(e) => handleChange('clarifier', e.target.value)}
              className="w-full px-3 py-2 pr-10 bg-ag-dark-bg border border-ag-dark-border rounded text-ag-dark-text focus:ring-2 focus:ring-ag-dark-accent focus:border-ag-dark-accent appearance-none"
              style={{
                backgroundImage: `url("data:image/svg+xml,%3csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 20 20'%3e%3cpath stroke='%236b7280' stroke-linecap='round' stroke-linejoin='round' stroke-width='1.5' d='m6 8 4 4 4-4'/%3e%3c/svg%3e")`,
                backgroundPosition: 'right 12px center',
                backgroundRepeat: 'no-repeat',
                backgroundSize: '16px'
              }}
            >
              <option value="">Select Clarifier</option>
              {listFieldOptions.clarifier.map((option) => (
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
              Set <span className="text-ag-dark-error">*</span>
            </label>
            <select
              value={formData.set}
              onChange={(e) => handleChange('set', e.target.value)}
              className="w-full px-3 py-2 pr-10 bg-ag-dark-bg border border-ag-dark-border rounded text-ag-dark-text focus:ring-2 focus:ring-ag-dark-accent focus:border-ag-dark-accent appearance-none"
              style={{
                backgroundImage: `url("data:image/svg+xml,%3csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 20 20'%3e%3cpath stroke='%236b7280' stroke-linecap='round' stroke-linejoin='round' stroke-width='1.5' d='m6 8 4 4 4-4'/%3e%3c/svg%3e")`,
                backgroundPosition: 'right 12px center',
                backgroundRepeat: 'no-repeat',
                backgroundSize: '16px'
              }}
            >
              <option value="">Select Set</option>
              {listFieldOptions.set.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-ag-dark-text mb-2">
              Grouping
            </label>
            <select
              value={formData.grouping}
              onChange={(e) => handleChange('grouping', e.target.value)}
              className="w-full px-3 py-2 pr-10 bg-ag-dark-bg border border-ag-dark-border rounded text-ag-dark-text focus:ring-2 focus:ring-ag-dark-accent focus:border-ag-dark-accent appearance-none"
              style={{
                backgroundImage: `url("data:image/svg+xml,%3csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 20 20'%3e%3cpath stroke='%236b7280' stroke-linecap='round' stroke-linejoin='round' stroke-width='1.5' d='m6 8 4 4 4-4'/%3e%3c/svg%3e")`,
                backgroundPosition: 'right 12px center',
                backgroundRepeat: 'no-repeat',
                backgroundSize: '16px'
              }}
            >
              <option value="">Select Grouping</option>
              {listFieldOptions.grouping.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-ag-dark-text mb-2">
              List <span className="text-ag-dark-error">*</span>
            </label>
            <input
              type="text"
              value={formData.list}
              onChange={(e) => handleChange('list', e.target.value)}
              placeholder="Enter list name..."
              className="w-full px-3 py-2 bg-ag-dark-bg border border-ag-dark-border rounded text-ag-dark-text placeholder-ag-dark-text-secondary focus:ring-2 focus:ring-ag-dark-accent focus:border-ag-dark-accent"
            />
          </div>
        </div>
      </CollapsibleSection>

      {/* Metadata Section */}
      <CollapsibleSection title="Metadata" sectionKey="metadata" icon={<FileText className="w-4 h-4 text-ag-dark-text-secondary" />}>
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-ag-dark-text mb-2">
              Format <span className="text-ag-dark-error">*</span>
            </label>
            <select
              value={formData.format}
              onChange={(e) => handleChange('format', e.target.value)}
              className="w-full px-3 py-2 pr-10 bg-ag-dark-bg border border-ag-dark-border rounded text-ag-dark-text focus:ring-2 focus:ring-ag-dark-accent focus:border-ag-dark-accent appearance-none"
              style={{
                backgroundImage: `url("data:image/svg+xml,%3csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 20 20'%3e%3cpath stroke='%236b7280' stroke-linecap='round' stroke-linejoin='round' stroke-width='1.5' d='m6 8 4 4 4-4'/%3e%3c/svg%3e")`,
                backgroundPosition: 'right 12px center',
                backgroundRepeat: 'no-repeat',
                backgroundSize: '16px'
              }}
            >
              <option value="">Select Format</option>
              <option value="Text">Text</option>
              <option value="Number">Number</option>
              <option value="Date">Date</option>
              <option value="Boolean">Boolean</option>
              <option value="List">List</option>
              <option value="Special">Special</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-ag-dark-text mb-2">
              Source
            </label>
            <select
              value={formData.source}
              onChange={(e) => handleChange('source', e.target.value)}
              className="w-full px-3 py-2 pr-10 bg-ag-dark-bg border border-ag-dark-border rounded text-ag-dark-text focus:ring-2 focus:ring-ag-dark-accent focus:border-ag-dark-accent appearance-none"
              style={{
                backgroundImage: `url("data:image/svg+xml,%3csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 20 20'%3e%3cpath stroke='%236b7280' stroke-linecap='round' stroke-linejoin='round' stroke-width='1.5' d='m6 8 4 4 4-4'/%3e%3c/svg%3e")`,
                backgroundPosition: 'right 12px center',
                backgroundRepeat: 'no-repeat',
                backgroundSize: '16px'
              }}
            >
              <option value="">Select Source</option>
              <option value="Internal">Internal</option>
              <option value="External">External</option>
              <option value="API">API</option>
              <option value="Manual">Manual</option>
              <option value="Calculated">Calculated</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-ag-dark-text mb-2">
              Upkeep
            </label>
            <select
              value={formData.upkeep}
              onChange={(e) => handleChange('upkeep', e.target.value)}
              className="w-full px-3 py-2 pr-10 bg-ag-dark-bg border border-ag-dark-border rounded text-ag-dark-text focus:ring-2 focus:ring-ag-dark-accent focus:border-ag-dark-accent appearance-none"
              style={{
                backgroundImage: `url("data:image/svg+xml,%3csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 20 20'%3e%3cpath stroke='%236b7280' stroke-linecap='round' stroke-linejoin='round' stroke-width='1.5' d='m6 8 4 4 4-4'/%3e%3c/svg%3e")`,
                backgroundPosition: 'right 12px center',
                backgroundRepeat: 'no-repeat',
                backgroundSize: '16px'
              }}
            >
              <option value="">Select Upkeep</option>
              <option value="Daily">Daily</option>
              <option value="Weekly">Weekly</option>
              <option value="Monthly">Monthly</option>
              <option value="Quarterly">Quarterly</option>
              <option value="Annually">Annually</option>
              <option value="As Needed">As Needed</option>
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
              <option value="Y">Y</option>
              <option value="N">N</option>
              <option value="Conditional">Conditional</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-ag-dark-text mb-2">
              Origin
            </label>
            <select
              value={formData.origin}
              onChange={(e) => handleChange('origin', e.target.value)}
              className="w-full px-3 py-2 pr-10 bg-ag-dark-bg border border-ag-dark-border rounded text-ag-dark-text focus:ring-2 focus:ring-ag-dark-accent focus:border-ag-dark-accent appearance-none"
              style={{
                backgroundImage: `url("data:image/svg+xml,%3csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 20 20'%3e%3cpath stroke='%236b7280' stroke-linecap='round' stroke-linejoin='round' stroke-width='1.5' d='m6 8 4 4 4-4'/%3e%3c/svg%3e")`,
                backgroundPosition: 'right 12px center',
                backgroundRepeat: 'no-repeat',
                backgroundSize: '16px'
              }}
            >
              <option value="">Select Origin</option>
              <option value="System">System</option>
              <option value="User">User</option>
              <option value="Import">Import</option>
              <option value="Migration">Migration</option>
              <option value="Generated">Generated</option>
            </select>
          </div>
        </div>
      </CollapsibleSection>

      {/* Relationships Section */}
      <CollapsibleSection 
        title="Relationships" 
        sectionKey="relationships"
        icon={<Link className="w-4 h-4 text-ag-dark-text-secondary" />}
        actions={
          <>
            <button
              onClick={() => setIsVariableAttachedUploadOpen(true)}
              className="text-ag-dark-text-secondary hover:text-ag-dark-accent transition-colors"
              title="Upload Variables CSV"
            >
              <Upload className="w-4 h-4" />
            </button>
            <button
              onClick={addVariableAttached}
              className="text-ag-dark-accent hover:text-ag-dark-accent-hover transition-colors"
              title="Add Variable"
            >
              <Plus className="w-4 h-4" />
            </button>
          </>
        }
      >
        <div className="space-y-6">
          {/* Object Type Field */}
          <div>
            <label className="block text-sm font-medium text-ag-dark-text mb-2">
              Object Type <span className="text-ag-dark-error">*</span>
            </label>
            <select
              value={formData.objectType}
              onChange={(e) => handleChange('objectType', e.target.value)}
              className="w-full px-3 py-2 pr-10 bg-ag-dark-bg border border-ag-dark-border rounded text-ag-dark-text focus:ring-2 focus:ring-ag-dark-accent focus:border-ag-dark-accent appearance-none"
              style={{
                backgroundImage: `url("data:image/svg+xml,%3csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 20 20'%3e%3cpath stroke='%236b7280' stroke-linecap='round' stroke-linejoin='round' stroke-width='1.5' d='m6 8 4 4 4-4'/%3e%3c/svg%3e")`,
                backgroundPosition: 'right 12px center',
                backgroundRepeat: 'no-repeat',
                backgroundSize: '16px'
              }}
            >
              <option value="">Select Object Type</option>
              {listFieldOptions.objectType.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
          </div>
          {/* Variables Attached */}
          <div>
            <h5 className="text-sm font-medium text-ag-dark-text mb-4">Variables Attached</h5>
            {variablesAttached.length === 0 ? (
              <div className="text-center py-6 text-ag-dark-text-secondary">
                <div className="text-sm">No variables attached</div>
                <button
                  onClick={addVariableAttached}
                  className="mt-2 text-ag-dark-accent hover:text-ag-dark-accent-hover text-sm"
                >
                  Add your first variable
                </button>
              </div>
            ) : (
              <div className="space-y-4">
                {variablesAttached.map((variable, index) => (
                  <div key={variable.id} className="bg-ag-dark-bg rounded-lg p-4 border border-ag-dark-border">
                    <div className="flex items-center justify-between mb-3">
                      <span className="text-sm font-medium text-ag-dark-text">
                        Variable #{index + 1}
                      </span>
                      <button
                        onClick={() => deleteVariableAttached(variable.id)}
                        className="text-ag-dark-error hover:text-red-400 transition-colors"
                        title="Delete Variable"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                    
                    <div className="space-y-3">
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className="block text-xs font-medium text-ag-dark-text-secondary mb-1">
                            Part
                          </label>
                          <select
                            value={variable.part}
                            onChange={(e) => handleVariableAttachedChange(variable.id, 'part', e.target.value)}
                            className="w-full px-2 py-1.5 pr-8 bg-ag-dark-surface border border-ag-dark-border rounded text-sm text-ag-dark-text focus:ring-1 focus:ring-ag-dark-accent focus:border-ag-dark-accent appearance-none"
                            style={{
                              backgroundImage: `url("data:image/svg+xml,%3csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 20 20'%3e%3cpath stroke='%236b7280' stroke-linecap='round' stroke-linejoin='round' stroke-width='1.5' d='m6 8 4 4 4-4'/%3e%3c/svg%3e")`,
                              backgroundPosition: 'right 8px center',
                              backgroundRepeat: 'no-repeat',
                              backgroundSize: '12px'
                            }}
                          >
                            <option value="">Select Part</option>
                            {getDistinctParts().map((option) => (
                              <option key={option} value={option}>
                                {option}
                              </option>
                            ))}
                          </select>
                        </div>

                        <div>
                          <label className="block text-xs font-medium text-ag-dark-text-secondary mb-1">
                            Section
                          </label>
                          <select
                            value={variable.section}
                            onChange={(e) => handleVariableAttachedChange(variable.id, 'section', e.target.value)}
                            className="w-full px-2 py-1.5 pr-8 bg-ag-dark-surface border border-ag-dark-border rounded text-sm text-ag-dark-text focus:ring-1 focus:ring-ag-dark-accent focus:border-ag-dark-accent appearance-none"
                            style={{
                              backgroundImage: `url("data:image/svg+xml,%3csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 20 20'%3e%3cpath stroke='%236b7280' stroke-linecap='round' stroke-linejoin='round' stroke-width='1.5' d='m6 8 4 4 4-4'/%3e%3c/svg%3e")`,
                              backgroundPosition: 'right 8px center',
                              backgroundRepeat: 'no-repeat',
                              backgroundSize: '12px'
                            }}
                          >
                            <option value="">Select Section</option>
                            {variable.part && getDistinctSectionsForPart(variable.part).map((option) => (
                              <option key={option} value={option}>
                                {option}
                              </option>
                            ))}
                          </select>
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className="block text-xs font-medium text-ag-dark-text-secondary mb-1">
                            Group
                          </label>
                          <select
                            value={variable.group}
                            onChange={(e) => handleVariableAttachedChange(variable.id, 'group', e.target.value)}
                            className="w-full px-2 py-1.5 pr-8 bg-ag-dark-surface border border-ag-dark-border rounded text-sm text-ag-dark-text focus:ring-1 focus:ring-ag-dark-accent focus:border-ag-dark-accent appearance-none"
                            style={{
                              backgroundImage: `url("data:image/svg+xml,%3csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 20 20'%3e%3cpath stroke='%236b7280' stroke-linecap='round' stroke-linejoin='round' stroke-width='1.5' d='m6 8 4 4 4-4'/%3e%3c/svg%3e")`,
                              backgroundPosition: 'right 8px center',
                              backgroundRepeat: 'no-repeat',
                              backgroundSize: '12px'
                            }}
                          >
                            <option value="">Select Group</option>
                            {variable.part && variable.section && getDistinctGroupsForPartAndSection(variable.part, variable.section).map((option) => (
                              <option key={option} value={option}>
                                {option}
                              </option>
                            ))}
                          </select>
                        </div>

                        <div>
                          <label className="block text-xs font-medium text-ag-dark-text-secondary mb-1">
                            Variable
                          </label>
                          <select
                            value={variable.variable}
                            onChange={(e) => handleVariableAttachedChange(variable.id, 'variable', e.target.value)}
                            className="w-full px-2 py-1.5 pr-8 bg-ag-dark-surface border border-ag-dark-border rounded text-sm text-ag-dark-text focus:ring-1 focus:ring-ag-dark-accent focus:border-ag-dark-accent appearance-none"
                            style={{
                              backgroundImage: `url("data:image/svg+xml,%3csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 20 20'%3e%3cpath stroke='%236b7280' stroke-linecap='round' stroke-linejoin='round' stroke-width='1.5' d='m6 8 4 4 4-4'/%3e%3c/svg%3e")`,
                              backgroundPosition: 'right 8px center',
                              backgroundRepeat: 'no-repeat',
                              backgroundSize: '12px'
                            }}
                          >
                            <option value="">Select Variable</option>
                            {variable.part && variable.section && variable.group && 
                              getDistinctVariablesForPartSectionGroup(variable.part, variable.section, variable.group).map((option) => (
                              <option key={option} value={option}>
                                {option}
                              </option>
                            ))}
                          </select>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </CollapsibleSection>

      {/* List Values Section */}
      <div className="border-t border-ag-dark-border pt-8">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <List className="w-4 h-4 text-ag-dark-text-secondary" />
            <h4 className="text-md font-semibold text-ag-dark-text">List Values</h4>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setIsListValuesUploadOpen(true)}
              className="text-ag-dark-text-secondary hover:text-ag-dark-accent transition-colors"
              title="Upload List Values CSV"
            >
              <Upload className="w-4 h-4" />
            </button>
            <button
              onClick={addListValue}
              className="text-ag-dark-accent hover:text-ag-dark-accent-hover transition-colors"
              title="Add List Value"
            >
              <Plus className="w-4 h-4" />
            </button>
          </div>
        </div>
        
        {listValues.length === 0 ? (
          <div className="text-center py-6 text-ag-dark-text-secondary">
            <div className="text-sm">No list values defined</div>
            <button
              onClick={addListValue}
              className="mt-2 text-ag-dark-accent hover:text-ag-dark-accent-hover text-sm"
            >
              Add your first list value
            </button>
          </div>
        ) : (
          <div className="space-y-4">
            {listValues.map((listValue, index) => (
              <div key={listValue.id} className="bg-ag-dark-bg rounded-lg p-4 border border-ag-dark-border">
                <div className="flex items-center justify-between mb-3">
                  <span className="text-sm font-medium text-ag-dark-text">
                    List Value #{index + 1}
                  </span>
                  <button
                    onClick={() => deleteListValue(listValue.id)}
                    className="text-ag-dark-error hover:text-red-400 transition-colors"
                    title="Delete List Value"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
                
                <div>
                  <label className="block text-xs font-medium text-ag-dark-text-secondary mb-1">
                    Value
                  </label>
                  <input
                    type="text"
                    placeholder="Enter value..."
                    value={listValue.value}
                    onChange={(e) => handleListValueChange(listValue.id, e.target.value)}
                    className="w-full px-2 py-1.5 bg-ag-dark-surface border border-ag-dark-border rounded text-sm text-ag-dark-text placeholder-ag-dark-text-secondary focus:ring-1 focus:ring-ag-dark-accent focus:border-ag-dark-accent"
                  />
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Add List Button */}
      <div className="mt-8 pt-6 border-t border-ag-dark-border">
        <button
          onClick={handleAddList}
          disabled={!isFormValid()}
          className={`w-full py-2 px-4 rounded transition-colors flex items-center justify-center gap-2 ${
            isFormValid()
              ? 'bg-ag-dark-accent text-white hover:bg-ag-dark-accent-hover'
              : 'bg-ag-dark-text-secondary text-ag-dark-text-secondary cursor-not-allowed opacity-50'
          }`}
        >
          <Plus className="w-4 h-4" />
          Add List
        </button>
      </div>

      {/* CSV Upload Modals */}
      <ListCsvUploadModal
        isOpen={isVariableAttachedUploadOpen}
        onClose={() => setIsVariableAttachedUploadOpen(false)}
        type="variables-attached"
        onUpload={handleVariableAttachedCsvUpload}
      />
      
      <ListCsvUploadModal
        isOpen={isListValuesUploadOpen}
        onClose={() => setIsListValuesUploadOpen(false)}
        type="list-values"
        onUpload={handleListValuesCsvUpload}
      />
    </div>
  );
};