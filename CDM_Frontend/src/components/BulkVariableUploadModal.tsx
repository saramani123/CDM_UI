import React, { useState } from 'react';
import { X, Upload, FileText } from 'lucide-react';

interface BulkVariableUploadModalProps {
  isOpen: boolean;
  onClose: () => void;
  onUpload: (file: File) => void;
  isLoading?: boolean;
}

export const BulkVariableUploadModal: React.FC<BulkVariableUploadModalProps> = ({
  isOpen,
  onClose,
  onUpload,
  isLoading = false
}) => {
  const [isDragOver, setIsDragOver] = useState(false);

  if (!isOpen) return null;

  const csvFormat = {
    title: 'Upload Variables',
    columns: [
      { number: 1, name: 'Sector' },
      { number: 2, name: 'Domain' },
      { number: 3, name: 'Country' },
      { number: 4, name: 'Variable Clarifier' },
      { number: 5, name: 'Part' },
      { number: 6, name: 'Section' },
      { number: 7, name: 'Group' },
      { number: 8, name: 'Variable' },
      { number: 9, name: 'Format I' },
      { number: 10, name: 'Format II' },
      { number: 11, name: 'G-Type' },
      { number: 12, name: 'Validation' },
      { number: 13, name: 'Default' },
      { number: 14, name: 'Graph' }
    ]
  };

  const handleFileUpload = (file: File) => {
    // Validate file type
    if (!file.name.toLowerCase().endsWith('.csv')) {
      alert('Please select a valid CSV file');
      return;
    }

    // Don't allow upload if already uploading
    if (isLoading) {
      return;
    }

    // Pass the file directly to the parent component
    onUpload(file);
    // Don't close modal here - parent will close it after upload completes
  };

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file && file.type === 'text/csv') {
      handleFileUpload(file);
    } else {
      alert('Please select a valid CSV file');
    }
  };

  const handleDrop = (event: React.DragEvent) => {
    event.preventDefault();
    setIsDragOver(false);
    
    const file = event.dataTransfer.files[0];
    if (file && file.type === 'text/csv') {
      handleFileUpload(file);
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
                    column.number <= 8 ? 'bg-red-900 bg-opacity-20' : ''
                  }`}
                >
                  <span className="text-sm text-ag-dark-text-secondary">
                    Column {column.number}
                  </span>
                  <span className={`text-sm font-medium ${
                    column.number <= 8 ? 'text-ag-dark-error' : 'text-ag-dark-text'
                  }`}>
                    {column.name} {column.number <= 8 ? '*' : ''}
                  </span>
                </div>
              ))}
            </div>
            <div className="text-xs text-ag-dark-error">
              * Required fields (columns 1-8)
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
                <label className={`inline-flex items-center gap-2 px-4 py-2 rounded transition-colors ${
                  isLoading 
                    ? 'bg-ag-dark-bg text-ag-dark-text-secondary cursor-not-allowed' 
                    : 'bg-ag-dark-accent text-white hover:bg-ag-dark-accent-hover cursor-pointer'
                }`}>
                  {isLoading ? (
                    <>
                      <svg className="animate-spin h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                      </svg>
                      UPLOADING...
                    </>
                  ) : (
                    <>
                      <Upload className="w-4 h-4" />
                      UPLOAD CSV
                    </>
                  )}
                  <input
                    type="file"
                    accept=".csv"
                    onChange={handleFileSelect}
                    className="hidden"
                    disabled={isLoading}
                  />
                </label>
              </div>
            </div>
          </div>

          {/* Format Notes */}
          <div className="text-xs text-ag-dark-text-secondary space-y-1">
            <p><strong>Required Fields:</strong></p>
            <p>• Driver through Format II must have values</p>
            <p>• G-Type, Validation, Default, Graph are optional and can be left empty</p>
            <p><strong>After Upload:</strong></p>
            <p>• You can add object relationships through the Variable Metadata panel</p>
            <p>• Select any uploaded variable to edit its object relationships</p>
          </div>
        </div>
      </div>
    </div>
  );
};