import React, { useState } from 'react';
import { X, Check, Eye } from 'lucide-react';

interface ViewsModalProps {
  isOpen: boolean;
  onClose: () => void;
  onApplyView: (viewName: string) => void;
  activeView: string;
}

export const ViewsModal: React.FC<ViewsModalProps> = ({
  isOpen,
  onClose,
  onApplyView,
  activeView
}) => {
  const [selectedView, setSelectedView] = useState<string>(activeView);

  // Update selected view when activeView changes
  React.useEffect(() => {
    setSelectedView(activeView);
  }, [activeView]);

  const views = [
    {
      name: 'None',
      description: '',
      filter: null
    },
    {
      name: 'Generic',
      description: '',
      filter: {
        sector: 'ALL',
        domain: 'ALL',
        country: 'ALL'
      }
    }
  ];

  const handleApplyView = () => {
    onApplyView(selectedView);
    onClose();
  };

  const handleCancel = () => {
    setSelectedView(activeView);
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-70 flex items-center justify-center z-[100]">
      <div className="bg-ag-dark-surface rounded-lg border border-ag-dark-border p-6 max-w-md w-full mx-4">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <Eye className="w-6 h-6 text-ag-dark-accent" />
            <h3 className="text-lg font-semibold text-ag-dark-text">Select View</h3>
          </div>
          <button
            onClick={handleCancel}
            className="text-ag-dark-text-secondary hover:text-ag-dark-text transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
        
        <div className="space-y-3 mb-6">
          {views.map((view) => (
            <div
              key={view.name}
              className={`p-4 border rounded-lg cursor-pointer transition-colors ${
                selectedView === view.name
                  ? 'border-ag-dark-accent bg-ag-dark-accent bg-opacity-10'
                  : 'border-ag-dark-border hover:bg-ag-dark-bg'
              }`}
              onClick={() => setSelectedView(view.name)}
            >
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="font-medium text-ag-dark-text">{view.name}</h4>
                  {view.description && (
                    <p className="text-sm text-ag-dark-text-secondary mt-1">
                      {view.description}
                    </p>
                  )}
                </div>
                {selectedView === view.name && (
                  <Check className="w-5 h-5 text-ag-dark-accent" />
                )}
              </div>
            </div>
          ))}
        </div>

        <div className="flex gap-3 justify-end">
          <button
            onClick={handleCancel}
            className="px-4 py-2 border border-ag-dark-border rounded text-ag-dark-text hover:bg-ag-dark-bg transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleApplyView}
            className="inline-flex items-center gap-2 px-4 py-2 bg-ag-dark-accent text-white rounded hover:bg-ag-dark-accent-hover transition-colors"
          >
            <Check className="w-4 h-4" />
            Save Changes
          </button>
        </div>
      </div>
    </div>
  );
};
