import React, { useState } from 'react';
import { X, Upload, FileText } from 'lucide-react';
import { apiService } from '../services/api';

interface BulkObjectUploadModalProps {
  isOpen: boolean;
  onClose: () => void;
  onUpload: (objects: any[]) => void;
}

export const BulkObjectUploadModal: React.FC<BulkObjectUploadModalProps> = ({
  isOpen,
  onClose,
  onUpload
}) => {
  const [isDragOver, setIsDragOver] = useState(false);

  if (!isOpen) return null;

  const csvFormat = {
    title: 'Upload Objects',
    columns: [
      { number: 1, name: 'Sector', required: true },
      { number: 2, name: 'Domain', required: true },
      { number: 3, name: 'Country', required: true },
      { number: 4, name: 'Object Clarifier', required: true },
      { number: 5, name: 'Being', required: true },
      { number: 6, name: 'Avatar', required: true },
      { number: 7, name: 'Object', required: true },
      { number: 8, name: 'Variants', required: false }
    ]
  };

  const handleFileUpload = async (file: File) => {
    try {
      console.log('Uploading CSV file:', file.name, 'Type:', file.type, 'Size:', file.size);
      const result = await apiService.uploadObjectsCSV(file) as {
        message: string;
        created_objects: Array<{
          id: string;
          being: string;
          avatar: string;
          object: string;
          driver: string;
          variants: number;
          relationships: number;
          relationshipsList: any[];
          variantsList: any[];
        }>;
        errors: string[];
      };
      console.log('CSV upload result:', result);
      
      if (result.errors && result.errors.length > 0) {
        alert(`CSV Upload completed with errors:\n\n${result.errors.join('\n')}\n\nCreated ${result.created_objects?.length || 0} objects.`);
      } else {
        alert(`CSV upload successful! Created ${result.created_objects?.length || 0} objects.`);
      }
      
      // Call onUpload with the created objects to refresh the UI
      if (result.created_objects && result.created_objects.length > 0) {
        // Convert the created objects to the format expected by the UI
        // Use actual values from backend response
        const uiObjects = result.created_objects.map((obj) => ({
          id: obj.id,
          driver: obj.driver,
          being: obj.being,
          avatar: obj.avatar,
          object: obj.object,
          relationships: obj.relationships || 0,
          variants: obj.variants || 0,
          variables: '-',
          status: 'Active',
          relationshipsList: obj.relationshipsList || [],
          variantsList: obj.variantsList || [],
        }));
        onUpload(uiObjects);
      }
      
      onClose();
    } catch (error) {
      console.error('CSV upload failed:', error);
      console.error('Error details:', error);
      if (error instanceof Error) {
        console.error('Error message:', error.message);
        console.error('Error stack:', error.stack);
      }
      alert(`CSV upload failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  };

  const handleFileSelect = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file && (file.type === 'text/csv' || file.name.toLowerCase().endsWith('.csv'))) {
      await handleFileUpload(file);
    } else {
      alert('Please select a valid CSV file');
    }
  };

  const handleDrop = async (event: React.DragEvent) => {
    event.preventDefault();
    setIsDragOver(false);
    
    const file = event.dataTransfer.files[0];
    if (file && (file.type === 'text/csv' || file.name.toLowerCase().endsWith('.csv'))) {
      await handleFileUpload(file);
    } else {
      alert('Please drop a valid CSV file');
    }
  };

  const handleDragOver = (event: React.DragEvent) => {
    event.preventDefault();
    setIsDragOver(true);
  };

  const handleDragLeave = () => {
    setIsDragOver(false);
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-70 flex items-center justify-center z-50">
      <div className="bg-ag-dark-surface rounded-lg border border-ag-dark-border max-w-lg w-full mx-4 max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-ag-dark-border">
          <h2 className="text-xl font-semibold text-ag-dark-text">{csvFormat.title}</h2>
          <button
            onClick={onClose}
            className="text-ag-dark-text-secondary hover:text-ag-dark-text transition-colors"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-6">
          {/* CSV Format Specification */}
          <div className="space-y-3">
            <h3 className="text-sm font-medium text-ag-dark-accent">CSV FORMAT</h3>
            <div className="bg-ag-dark-bg rounded-lg border border-ag-dark-border overflow-hidden">
              {csvFormat.columns.map((column) => (
                <div
                  key={column.number}
                  className={`flex items-center justify-between px-4 py-3 border-b border-ag-dark-border last:border-b-0 ${
                    column.required ? 'bg-red-900 bg-opacity-20' : 'bg-ag-dark-bg'
                  }`}
                >
                  <span className="text-sm text-ag-dark-text-secondary">
                    Column {column.number}
                  </span>
                  <span className={`text-sm font-medium ${column.required ? 'text-ag-dark-error' : 'text-ag-dark-text-secondary'}`}>
                    {column.name} {column.required ? '*' : '(optional)'}
                  </span>
                </div>
              ))}
            </div>
            <div className="text-xs text-ag-dark-text-secondary">
              * Required fields | (optional) = Optional fields
            </div>
          </div>

          {/* Upload Area */}
          <div className="space-y-3">
            <div
              className={`border-2 border-dashed rounded-lg p-8 text-center transition-colors ${
                isDragOver
                  ? 'border-ag-dark-accent bg-ag-dark-accent bg-opacity-10'
                  : 'border-ag-dark-border hover:border-ag-dark-accent hover:bg-ag-dark-bg'
              }`}
              onDrop={handleDrop}
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
            >
              <div className="space-y-4">
                <div className="flex justify-center">
                  <FileText className="w-12 h-12 text-ag-dark-text-secondary" />
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
                    onChange={handleFileSelect}
                    className="hidden"
                  />
                </label>
              </div>
            </div>
          </div>

          {/* Format Notes */}
          <div className="text-xs text-ag-dark-text-secondary space-y-1">
            <p><strong>Required Fields:</strong></p>
            <p>• Columns 1-7 must have values</p>
            <p>• Object Clarifier can be "None" if not applicable</p>
            <p>• Use "ALL" for Sector/Domain/Country to apply to all values</p>
            <p><strong>Optional Fields:</strong></p>
            <p>• Column 8 (Variants): Comma-separated list of variants (e.g., "Variant1, Variant2, Variant3")</p>
            <p>• Variants will be automatically created and linked to the object</p>
            <p><strong>After Upload:</strong></p>
            <p>• IDs and relationships can be added after upload</p>
            <p>• Select any uploaded object to edit its complete metadata</p>
          </div>
        </div>
      </div>
    </div>
  );
};