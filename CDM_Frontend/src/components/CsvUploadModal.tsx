import React, { useState } from 'react';
import { X, Upload, FileText } from 'lucide-react';

interface CsvUploadModalProps {
  isOpen: boolean;
  onClose: () => void;
  type: 'relationships' | 'variants' | 'variations' | 'object-relationships' | 'variable-object-relationships';
  onUpload: (data: any[] | File) => void;
}

export const CsvUploadModal: React.FC<CsvUploadModalProps> = ({
  isOpen,
  onClose,
  type,
  onUpload
}) => {
  const [isDragOver, setIsDragOver] = useState(false);

  if (!isOpen) return null;

  const formatSpecs = {
    relationships: {
      title: 'Upload Relationships',
      columns: [
        { number: 1, name: 'Type' },
        { number: 2, name: 'Role' },
        { number: 3, name: 'to Being' },
        { number: 4, name: 'to Avatar' },
        { number: 5, name: 'to Object' }
      ]
    },
    variants: {
      title: 'Upload Variants',
      columns: [
        { number: 1, name: 'Variant' }
      ]
    },
    variations: {
      title: 'Upload Variations',
      columns: [
        { number: 1, name: 'Variation' }
      ]
    },
    'object-relationships': {
      title: 'Upload Object Relationships',
      columns: [
        { number: 1, name: 'To Being' },
        { number: 2, name: 'To Avatar' },
        { number: 3, name: 'To Object' }
      ]
    },
    'variable-object-relationships': {
      title: 'Upload Variable-Object Relationships',
      columns: [
        { number: 1, name: 'Sector' },
        { number: 2, name: 'Domain' },
        { number: 3, name: 'Country' },
        { number: 4, name: 'Object Clarifier' },
        { number: 5, name: 'Being' },
        { number: 6, name: 'Avatar' },
        { number: 7, name: 'Object' }
      ]
    }
  };

  const currentSpec = formatSpecs[type];

  const handleFileUpload = (file: File) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      let csv = e.target?.result as string;
      
      // Remove BOM if present
      if (csv.charCodeAt(0) === 0xFEFF) {
        csv = csv.slice(1);
      }
      
      const lines = csv.split('\n').filter(line => line.trim());
      
      if (lines.length < 2) {
        alert('CSV must contain at least a header row and one data row');
        return;
      }

      // Skip header row and parse data rows
      const dataRows = lines.slice(1);
      const parsedData: any[] = [];

      dataRows.forEach((line, index) => {
        // Try different separators: comma, semicolon, tab
        let values = line.split(',').map(val => val.trim().replace(/"/g, ''));
        if (values.length === 1 && line.includes(';')) {
          values = line.split(';').map(val => val.trim().replace(/"/g, ''));
        }
        if (values.length === 1 && line.includes('\t')) {
          values = line.split('\t').map(val => val.trim().replace(/"/g, ''));
        }
        
        if (type === 'relationships') {
          if (values.length >= 5) {
            parsedData.push({
              id: Date.now().toString() + index,
              type: values[0] || 'Inter-Table',
              role: values[1] || '',
              toBeing: values[2] || '',
              toAvatar: values[3] || '',
              toObject: values[4] || ''
            });
          }
        } else if (type === 'variants') {
          if (values.length >= 1 && values[0]) {
            parsedData.push({
              id: Date.now().toString() + index,
              name: values[0]
            });
          }
        } else if (type === 'variations') {
          if (values.length >= 1 && values[0]) {
            parsedData.push({
              id: Date.now().toString() + index,
              name: values[0]
            });
          }
        } else if (type === 'object-relationships') {
          if (values.length >= 3) {
            parsedData.push({
              id: Date.now().toString() + index,
              toBeing: values[0] || '',
              toAvatar: values[1] || '',
              toObject: values[2] || ''
            });
          }
        } else if (type === 'variable-object-relationships') {
          if (values.length >= 7) {
            parsedData.push({
              id: Date.now().toString() + index,
              Sector: values[0] || '',
              Domain: values[1] || '',
              Country: values[2] || '',
              'Object Clarifier': values[3] || '',
              Being: values[4] || '',
              Avatar: values[5] || '',
              Object: values[6] || ''
            });
          }
        }
      });

      if (type === 'variants' || type === 'variations') {
        // For variants and variations, pass the file directly to the API handler
        onUpload(file);
        onClose();
      } else if (parsedData.length > 0) {
        onUpload(parsedData);
        onClose();
      } else {
        alert('No valid data found in CSV. Please check the format.');
      }
    };
    reader.readAsText(file);
  };

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file && (file.type === 'text/csv' || file.type === 'application/csv' || file.name.endsWith('.csv'))) {
      handleFileUpload(file);
    } else {
      alert('Please select a valid CSV file');
    }
  };

  const handleDrop = (event: React.DragEvent) => {
    event.preventDefault();
    setIsDragOver(false);
    
    const file = event.dataTransfer.files[0];
    if (file && (file.type === 'text/csv' || file.type === 'application/csv' || file.name.endsWith('.csv'))) {
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
    <div className="fixed inset-0 bg-black bg-opacity-70 flex items-center justify-center z-[100]">
      <div className="bg-ag-dark-surface rounded-lg border border-ag-dark-border max-w-md w-full mx-4">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-ag-dark-border">
          <h2 className="text-xl font-semibold text-ag-dark-text">{currentSpec.title}</h2>
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
              {currentSpec.columns.map((column) => (
                <div
                  key={column.number}
                  className="flex items-center justify-between px-4 py-3 border-b border-ag-dark-border last:border-b-0"
                >
                  <span className="text-sm text-ag-dark-text-secondary">
                    Column {column.number}
                  </span>
                  <span className="text-sm font-medium text-ag-dark-text">
                    {column.name}
                  </span>
                </div>
              ))}
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
            <p>• First row should contain column headers</p>
            <p>• Each subsequent row represents one {
              type === 'relationships' ? 'relationship' : 
              type === 'variants' ? 'variant' : 
              type === 'variations' ? 'variation' :
              type === 'object-relationships' ? 'object relationship' :
              'variable-object relationship'
            }</p>
            <p>• Columns must be in the exact order shown above</p>
            {type === 'relationships' && (
              <p>• Type must be: Blood, Intra-Table, or Inter-Table</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};