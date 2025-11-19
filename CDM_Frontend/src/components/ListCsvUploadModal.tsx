import React, { useState } from 'react';
import { X, Upload, FileText } from 'lucide-react';

interface ListCsvUploadModalProps {
  isOpen: boolean;
  onClose: () => void;
  type: 'variables-attached' | 'list-values';
  onUpload: (data: any[]) => void;
}

export const ListCsvUploadModal: React.FC<ListCsvUploadModalProps> = ({
  isOpen,
  onClose,
  type,
  onUpload
}) => {
  const [isDragOver, setIsDragOver] = useState(false);

  if (!isOpen) return null;

  const formatSpecs = {
    'variables-attached': {
      title: 'Upload Variables Attached',
      columns: [
        { number: 1, name: 'Part' },
        { number: 2, name: 'Section' },
        { number: 3, name: 'Group' },
        { number: 4, name: 'Variable' }
      ]
    },
    'list-values': {
      title: 'Upload List Values',
      columns: [
        { number: 1, name: 'Value' }
      ]
    }
  };

  const currentSpec = formatSpecs[type];

  const handleFileUpload = (file: File) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const csv = e.target?.result as string;
      const lines = csv.split('\n').filter(line => line.trim());
      
      if (lines.length < 2) {
        alert('CSV must contain at least a header row and one data row');
        return;
      }

      // Parse header row
      const headerRow = lines[0].toLowerCase().trim();
      
      if (type === 'list-values') {
        // For list values, check that header contains "Values" (case-insensitive)
        if (!headerRow.includes('value')) {
          alert('CSV header must contain "Values" column. Please check the format.');
          return;
        }
      }

      // Skip header row and parse data rows
      const dataRows = lines.slice(1);
      const parsedData: any[] = [];

      dataRows.forEach((line, index) => {
        // Handle CSV parsing more robustly (handles quoted values with commas)
        const values: string[] = [];
        let currentValue = '';
        let inQuotes = false;
        
        for (let i = 0; i < line.length; i++) {
          const char = line[i];
          if (char === '"') {
            inQuotes = !inQuotes;
          } else if (char === ',' && !inQuotes) {
            values.push(currentValue.trim().replace(/^"|"$/g, ''));
            currentValue = '';
          } else {
            currentValue += char;
          }
        }
        values.push(currentValue.trim().replace(/^"|"$/g, '')); // Add last value
        
        if (type === 'variables-attached') {
          if (values.length >= 4) {
            parsedData.push({
              id: Date.now().toString() + index,
              part: values[0] || '',
              section: values[1] || '',
              group: values[2] || '',
              variable: values[3] || ''
            });
          }
        } else if (type === 'list-values') {
          // For list values, use the first column (Values column)
          const value = values[0] || '';
          if (value.trim()) {
            parsedData.push({
              id: Date.now().toString() + index,
              value: value.trim()
            });
          }
        }
      });

      if (parsedData.length > 0) {
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
            <p>• Each subsequent row represents one {type === 'variables-attached' ? 'variable attachment' : 'list value'}</p>
            <p>• Columns must be in the exact order shown above</p>
            {type === 'variables-attached' && (
              <p>• All fields (Part, Section, Group, Variable) are required</p>
            )}
            {type === 'list-values' && (
              <p>• Header must contain "Values" column (case-insensitive)</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};