import React, { useState, useEffect } from 'react';
import { X, Settings, Save, ChevronRight, ChevronDown, Database, Map, FileText, Layers, CheckCircle } from 'lucide-react';
import { SourcesData } from '../hooks/useSources';
import { apiService } from '../services/api';

interface SourcesDetailPanelProps {
  selectedSource: SourcesData | null;
  onClose: () => void;
  onSave: () => void;
}

export const SourcesDetailPanel: React.FC<SourcesDetailPanelProps> = ({
  selectedSource,
  onClose,
  onSave
}) => {
  const [formData, setFormData] = useState({
    drivers: {
      sector: '',
      domain: '',
      country: ''
    },
    map: {
      object: '',
      variable: '',
      list: '',
      transformation: ''
    },
    format: {
      format_s_i: '',
      format_s_ii: '',
      format_v_i: '',
      format_v_ii: ''
    },
    ontology: {
      being: '',
      avatar: '',
      tier: '',
      part: '',
      section: '',
      group: '',
      group_type: '',
      group_key: ''
    },
    validation: {
      source: '',
      vulqan: ''
    }
  });
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  // Collapsible sections state
  const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({
    drivers: true,
    map: false,
    format: false,
    ontology: false,
    validation: false
  });

  const toggleSection = (sectionKey: string) => {
    setExpandedSections(prev => ({
      ...prev,
      [sectionKey]: !prev[sectionKey]
    }));
  };

  // Load existing data when selectedSource changes
  useEffect(() => {
    if (selectedSource) {
      loadSourceDetail();
    }
  }, [selectedSource]);

  const loadSourceDetail = async () => {
    if (!selectedSource) return;
    
    setIsLoading(true);
    setError(null);
    
    try {
      const item = await apiService.getSourceItem(selectedSource.id);
      let detailData = (item as any).detailData;
      
      // Parse if it's a string
      if (typeof detailData === 'string') {
        try {
          detailData = JSON.parse(detailData);
        } catch (e) {
          console.error('Error parsing detailData:', e);
          detailData = null;
        }
      }
      
      if (detailData && typeof detailData === 'object') {
        setFormData({
          drivers: {
            sector: detailData.drivers?.sector || selectedSource.sector,
            domain: detailData.drivers?.domain || selectedSource.domain,
            country: detailData.drivers?.country || selectedSource.country
          },
          map: detailData.map || {
            object: '',
            variable: '',
            list: '',
            transformation: ''
          },
          format: detailData.format || {
            format_s_i: '',
            format_s_ii: '',
            format_v_i: '',
            format_v_ii: ''
          },
          ontology: detailData.ontology || {
            being: '',
            avatar: '',
            tier: '',
            part: '',
            section: '',
            group: '',
            group_type: '',
            group_key: ''
          },
          validation: detailData.validation || {
            source: '',
            vulqan: ''
          }
        });
      } else {
        // Initialize with values from S, D, C
        // For new rows, these will be empty
        setFormData({
          drivers: {
            sector: selectedSource.sector,
            domain: selectedSource.domain,
            country: selectedSource.country
          },
          map: {
            object: '',
            variable: '',
            list: '',
            transformation: ''
          },
          format: {
            format_s_i: '',
            format_s_ii: '',
            format_v_i: '',
            format_v_ii: ''
          },
          ontology: {
            being: '',
            avatar: '',
            tier: '',
            part: '',
            section: '',
            group: '',
            group_type: '',
            group_key: ''
          },
          validation: {
            source: '',
            vulqan: ''
          }
        });
      }
    } catch (err) {
      console.error('Error loading source detail:', err);
      // Initialize with defaults on error
      setFormData({
        drivers: {
          sector: selectedSource.sector,
          domain: selectedSource.domain,
          country: selectedSource.country
        },
        map: {
          object: '',
          variable: '',
          list: '',
          transformation: ''
        },
        format: {
          format_s_i: '',
          format_s_ii: '',
          format_v_i: '',
          format_v_ii: ''
        },
        ontology: {
          being: '',
          avatar: '',
          tier: '',
          part: '',
          section: '',
          group: '',
          group_type: '',
          group_key: ''
        },
        validation: {
          source: '',
          vulqan: ''
        }
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleChange = (section: string, field: string, value: string) => {
    setFormData(prev => ({
      ...prev,
      [section]: {
        ...prev[section as keyof typeof prev],
        [field]: value
      }
    }));
    setError(null);
  };

  const handleSave = async () => {
    if (!selectedSource) return;

    setIsSaving(true);
    setError(null);

    try {
      // Prepare detail data
      const detailData = {
        drivers: formData.drivers,
        map: formData.map,
        format: formData.format,
        ontology: formData.ontology,
        validation: formData.validation
      };

      // Save detail data to backend
      await apiService.updateSourceItem(selectedSource.id, {
        detailData: JSON.stringify(detailData)
      });

      // Refresh and close
      onSave();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save source detail');
    } finally {
      setIsSaving(false);
    }
  };

  if (!selectedSource) return null;

  const CollapsibleSection: React.FC<{
    title: string;
    sectionKey: string;
    icon: React.ReactNode;
    children: React.ReactNode;
  }> = ({ title, sectionKey, icon, children }) => {
    const isExpanded = expandedSections[sectionKey];
    
    return (
      <div className="border-t border-ag-dark-border pt-6">
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
        </div>
        {isExpanded && (
          <div className="space-y-4">
            {children}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="bg-ag-dark-surface rounded-lg border border-ag-dark-border flex flex-col h-full" style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      {/* Header */}
      <div className="flex items-center justify-between mb-6 flex-shrink-0 p-6 pb-4">
        <div className="flex items-center gap-2">
          <Settings className="w-5 h-5 text-ag-dark-text-secondary" />
          <h3 className="text-lg font-semibold text-ag-dark-text">Source Metadata</h3>
        </div>
        <button
          onClick={onClose}
          className="text-ag-dark-text-secondary hover:text-ag-dark-text transition-colors"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      {/* Scrollable Content Area */}
      <div className="flex-1 overflow-y-auto px-6">
        {isLoading ? (
          <div className="flex items-center justify-center h-64">
            <div className="text-ag-dark-text-secondary">Loading...</div>
          </div>
        ) : (
          <div className="space-y-6">
            {/* Drivers Section */}
            <CollapsibleSection title="Drivers" sectionKey="drivers" icon={<Database className="w-4 h-4 text-ag-dark-text-secondary" />}>
              <div>
                <label className="block text-sm font-medium text-ag-dark-text mb-2">
                  Sector
                </label>
                <input
                  type="text"
                  value={formData.drivers.sector}
                  onChange={(e) => handleChange('drivers', 'sector', e.target.value)}
                  disabled={isSaving}
                  className="w-full px-3 py-2 bg-ag-dark-bg border border-ag-dark-border rounded text-ag-dark-text focus:ring-2 focus:ring-ag-dark-accent focus:border-ag-dark-accent disabled:opacity-50"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-ag-dark-text mb-2">
                  Domain
                </label>
                <input
                  type="text"
                  value={formData.drivers.domain}
                  onChange={(e) => handleChange('drivers', 'domain', e.target.value)}
                  disabled={isSaving}
                  className="w-full px-3 py-2 bg-ag-dark-bg border border-ag-dark-border rounded text-ag-dark-text focus:ring-2 focus:ring-ag-dark-accent focus:border-ag-dark-accent disabled:opacity-50"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-ag-dark-text mb-2">
                  Country
                </label>
                <input
                  type="text"
                  value={formData.drivers.country}
                  onChange={(e) => handleChange('drivers', 'country', e.target.value)}
                  disabled={isSaving}
                  className="w-full px-3 py-2 bg-ag-dark-bg border border-ag-dark-border rounded text-ag-dark-text focus:ring-2 focus:ring-ag-dark-accent focus:border-ag-dark-accent disabled:opacity-50"
                />
              </div>
            </CollapsibleSection>

            {/* Map Section */}
            <CollapsibleSection title="Map" sectionKey="map" icon={<Map className="w-4 h-4 text-ag-dark-text-secondary" />}>
              <div>
                <label className="block text-sm font-medium text-ag-dark-text mb-2">
                  Object
                </label>
                <input
                  type="text"
                  value={formData.map.object}
                  onChange={(e) => handleChange('map', 'object', e.target.value)}
                  disabled={isSaving}
                  className="w-full px-3 py-2 bg-ag-dark-bg border border-ag-dark-border rounded text-ag-dark-text focus:ring-2 focus:ring-ag-dark-accent focus:border-ag-dark-accent disabled:opacity-50"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-ag-dark-text mb-2">
                  Variable
                </label>
                <input
                  type="text"
                  value={formData.map.variable}
                  onChange={(e) => handleChange('map', 'variable', e.target.value)}
                  disabled={isSaving}
                  className="w-full px-3 py-2 bg-ag-dark-bg border border-ag-dark-border rounded text-ag-dark-text focus:ring-2 focus:ring-ag-dark-accent focus:border-ag-dark-accent disabled:opacity-50"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-ag-dark-text mb-2">
                  List
                </label>
                <input
                  type="text"
                  value={formData.map.list}
                  onChange={(e) => handleChange('map', 'list', e.target.value)}
                  disabled={isSaving}
                  className="w-full px-3 py-2 bg-ag-dark-bg border border-ag-dark-border rounded text-ag-dark-text focus:ring-2 focus:ring-ag-dark-accent focus:border-ag-dark-accent disabled:opacity-50"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-ag-dark-text mb-2">
                  Transformation
                </label>
                <input
                  type="text"
                  value={formData.map.transformation}
                  onChange={(e) => handleChange('map', 'transformation', e.target.value)}
                  disabled={isSaving}
                  className="w-full px-3 py-2 bg-ag-dark-bg border border-ag-dark-border rounded text-ag-dark-text focus:ring-2 focus:ring-ag-dark-accent focus:border-ag-dark-accent disabled:opacity-50"
                />
              </div>
            </CollapsibleSection>

            {/* Format Section */}
            <CollapsibleSection title="Format" sectionKey="format" icon={<FileText className="w-4 h-4 text-ag-dark-text-secondary" />}>
              <div>
                <label className="block text-sm font-medium text-ag-dark-text mb-2">
                  Format S-I
                </label>
                <input
                  type="text"
                  value={formData.format.format_s_i}
                  onChange={(e) => handleChange('format', 'format_s_i', e.target.value)}
                  disabled={isSaving}
                  className="w-full px-3 py-2 bg-ag-dark-bg border border-ag-dark-border rounded text-ag-dark-text focus:ring-2 focus:ring-ag-dark-accent focus:border-ag-dark-accent disabled:opacity-50"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-ag-dark-text mb-2">
                  Format S-II
                </label>
                <input
                  type="text"
                  value={formData.format.format_s_ii}
                  onChange={(e) => handleChange('format', 'format_s_ii', e.target.value)}
                  disabled={isSaving}
                  className="w-full px-3 py-2 bg-ag-dark-bg border border-ag-dark-border rounded text-ag-dark-text focus:ring-2 focus:ring-ag-dark-accent focus:border-ag-dark-accent disabled:opacity-50"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-ag-dark-text mb-2">
                  Format V-I
                </label>
                <input
                  type="text"
                  value={formData.format.format_v_i}
                  onChange={(e) => handleChange('format', 'format_v_i', e.target.value)}
                  disabled={isSaving}
                  className="w-full px-3 py-2 bg-ag-dark-bg border border-ag-dark-border rounded text-ag-dark-text focus:ring-2 focus:ring-ag-dark-accent focus:border-ag-dark-accent disabled:opacity-50"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-ag-dark-text mb-2">
                  Format V-II
                </label>
                <input
                  type="text"
                  value={formData.format.format_v_ii}
                  onChange={(e) => handleChange('format', 'format_v_ii', e.target.value)}
                  disabled={isSaving}
                  className="w-full px-3 py-2 bg-ag-dark-bg border border-ag-dark-border rounded text-ag-dark-text focus:ring-2 focus:ring-ag-dark-accent focus:border-ag-dark-accent disabled:opacity-50"
                />
              </div>
            </CollapsibleSection>

            {/* Ontology Section */}
            <CollapsibleSection title="Ontology" sectionKey="ontology" icon={<Layers className="w-4 h-4 text-ag-dark-text-secondary" />}>
              <div>
                <label className="block text-sm font-medium text-ag-dark-text mb-2">
                  Being
                </label>
                <input
                  type="text"
                  value={formData.ontology.being}
                  onChange={(e) => handleChange('ontology', 'being', e.target.value)}
                  disabled={isSaving}
                  className="w-full px-3 py-2 bg-ag-dark-bg border border-ag-dark-border rounded text-ag-dark-text focus:ring-2 focus:ring-ag-dark-accent focus:border-ag-dark-accent disabled:opacity-50"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-ag-dark-text mb-2">
                  Avatar
                </label>
                <input
                  type="text"
                  value={formData.ontology.avatar}
                  onChange={(e) => handleChange('ontology', 'avatar', e.target.value)}
                  disabled={isSaving}
                  className="w-full px-3 py-2 bg-ag-dark-bg border border-ag-dark-border rounded text-ag-dark-text focus:ring-2 focus:ring-ag-dark-accent focus:border-ag-dark-accent disabled:opacity-50"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-ag-dark-text mb-2">
                  Tier
                </label>
                <input
                  type="text"
                  value={formData.ontology.tier}
                  onChange={(e) => handleChange('ontology', 'tier', e.target.value)}
                  disabled={isSaving}
                  className="w-full px-3 py-2 bg-ag-dark-bg border border-ag-dark-border rounded text-ag-dark-text focus:ring-2 focus:ring-ag-dark-accent focus:border-ag-dark-accent disabled:opacity-50"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-ag-dark-text mb-2">
                  Part
                </label>
                <input
                  type="text"
                  value={formData.ontology.part}
                  onChange={(e) => handleChange('ontology', 'part', e.target.value)}
                  disabled={isSaving}
                  className="w-full px-3 py-2 bg-ag-dark-bg border border-ag-dark-border rounded text-ag-dark-text focus:ring-2 focus:ring-ag-dark-accent focus:border-ag-dark-accent disabled:opacity-50"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-ag-dark-text mb-2">
                  Section
                </label>
                <input
                  type="text"
                  value={formData.ontology.section}
                  onChange={(e) => handleChange('ontology', 'section', e.target.value)}
                  disabled={isSaving}
                  className="w-full px-3 py-2 bg-ag-dark-bg border border-ag-dark-border rounded text-ag-dark-text focus:ring-2 focus:ring-ag-dark-accent focus:border-ag-dark-accent disabled:opacity-50"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-ag-dark-text mb-2">
                  Group
                </label>
                <input
                  type="text"
                  value={formData.ontology.group}
                  onChange={(e) => handleChange('ontology', 'group', e.target.value)}
                  disabled={isSaving}
                  className="w-full px-3 py-2 bg-ag-dark-bg border border-ag-dark-border rounded text-ag-dark-text focus:ring-2 focus:ring-ag-dark-accent focus:border-ag-dark-accent disabled:opacity-50"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-ag-dark-text mb-2">
                  Group-Type
                </label>
                <input
                  type="text"
                  value={formData.ontology.group_type}
                  onChange={(e) => handleChange('ontology', 'group_type', e.target.value)}
                  disabled={isSaving}
                  className="w-full px-3 py-2 bg-ag-dark-bg border border-ag-dark-border rounded text-ag-dark-text focus:ring-2 focus:ring-ag-dark-accent focus:border-ag-dark-accent disabled:opacity-50"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-ag-dark-text mb-2">
                  Group-Key
                </label>
                <input
                  type="text"
                  value={formData.ontology.group_key}
                  onChange={(e) => handleChange('ontology', 'group_key', e.target.value)}
                  disabled={isSaving}
                  className="w-full px-3 py-2 bg-ag-dark-bg border border-ag-dark-border rounded text-ag-dark-text focus:ring-2 focus:ring-ag-dark-accent focus:border-ag-dark-accent disabled:opacity-50"
                />
              </div>
            </CollapsibleSection>

            {/* Validation Section */}
            <CollapsibleSection title="Validation" sectionKey="validation" icon={<CheckCircle className="w-4 h-4 text-ag-dark-text-secondary" />}>
              <div>
                <label className="block text-sm font-medium text-ag-dark-text mb-2">
                  Source
                </label>
                <input
                  type="text"
                  value={formData.validation.source}
                  onChange={(e) => handleChange('validation', 'source', e.target.value)}
                  disabled={isSaving}
                  className="w-full px-3 py-2 bg-ag-dark-bg border border-ag-dark-border rounded text-ag-dark-text focus:ring-2 focus:ring-ag-dark-accent focus:border-ag-dark-accent disabled:opacity-50"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-ag-dark-text mb-2">
                  Vulqan
                </label>
                <input
                  type="text"
                  value={formData.validation.vulqan}
                  onChange={(e) => handleChange('validation', 'vulqan', e.target.value)}
                  disabled={isSaving}
                  className="w-full px-3 py-2 bg-ag-dark-bg border border-ag-dark-border rounded text-ag-dark-text focus:ring-2 focus:ring-ag-dark-accent focus:border-ag-dark-accent disabled:opacity-50"
                />
              </div>
            </CollapsibleSection>
          </div>
        )}
      </div>

      {/* Error Message */}
      {error && (
        <div className="px-6 pb-4 flex-shrink-0">
          <div className="p-3 bg-red-900 bg-opacity-20 border border-red-500 rounded text-red-400 text-sm">
            {error}
          </div>
        </div>
      )}

      {/* Footer */}
      <div className="flex items-center justify-end gap-3 flex-shrink-0 border-t border-ag-dark-border p-6 pt-4">
        <button
          type="button"
          onClick={onClose}
          disabled={isSaving}
          className="px-4 py-2 border border-ag-dark-border rounded text-ag-dark-text hover:bg-ag-dark-surface transition-colors disabled:opacity-50"
        >
          Cancel
        </button>
        <button
          onClick={handleSave}
          disabled={isSaving || isLoading}
          className="px-4 py-2 bg-ag-dark-accent text-white rounded hover:bg-ag-dark-accent-hover transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
        >
          <Save className="w-4 h-4" />
          {isSaving ? 'Saving...' : 'Save Changes'}
        </button>
      </div>
    </div>
  );
};
