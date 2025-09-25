import React, { useState } from 'react';
import { X, Upload, FileText } from 'lucide-react';

interface BulkListUploadModalProps {
  isOpen: boolean;
  onClose: () => void;
  onUpload: (lists: any[]) => void;
}

export const BulkListUploadModal: React.FC<BulkListUploadModalProps> = ({
  isOpen,
  onClose,
  onUpload
}) => {
  const [isDragOver, setIsDragOver] = useState(false);

  if (!isOpen) return null;

  const csvFormat = {
    title: 'Upload Lists',
    columns: [
      { number: 1, name: 'Driver', required: true },
      { number: 2, name: 'Object Type', required: true },
      { number: 3, name: 'Clarifier', required: true },
      { number: 4, name: 'Format', required: true },
      { number: 5, name: 'Variable', required: true },
      { number: 6, name: 'Set', required: true },
      { number: 7, name: 'Grouping', required: true },
      { number: 8, name: 'List Name', required: true },
      { number: 9, name: 'Source', required: false },
      { number: 10, name: 'Upkeep', required: false },
      { number: 11, name: 'Graph', required: false },
      { number: 12, name: 'Origin', required: false }
    ]
  };

  const handleFileUpload = (file: File) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const csv = e.target?.result as string;
      const lines = csv.split('\n').filter(line => line.trim());
      
      if (lines.length < 2) {
        alert('CSV must contain at least a header row and one data row');
        return;
      }

      // Skip header row and parse data rows
      const dataRows = lines.slice(1);
      const parsedLists: any[] = [];
      const errors: string[] = [];

      dataRows.forEach((line, index) => {
        const values = line.split(',').map(val => val.trim().replace(/"/g, ''));
        
        if (values.length < 12) {
          errors.push(`Row ${index + 2}: Missing columns (expected 12, got ${values.length})`);
          return;
        }

        // Check required fields (columns 1-8)
        const requiredFields = ['Driver', 'Object Type', 'Clarifier', 'Format', 'Variable', 'Set', 'Grouping', 'List Name'];
        const missingFields: string[] = [];
        
        for (let i = 0; i < 8; i++) {
          if (!values[i] || values[i].trim() === '') {
            missingFields.push(requiredFields[i]);
          }
        }

        if (missingFields.length > 0) {
          errors.push(`Row ${index + 2}: Missing required fields: ${missingFields.join(', ')}`);
          return;
        }

        const newList = {
          id: Date.now().toString() + index,
          driver: values[0].trim(),
          objectType: values[1].trim(),
          clarifier: values[2].trim(),
          format: values[3].trim(),
          variable: values[4].trim(),
          set: values[5].trim(),
          grouping: values[6].trim(),
          list: values[7].trim(),
          source: values[8] && values[8].trim() !== '' ? values[8].trim() : '',
          upkeep: values[9] && values[9].trim() !== '' ? values[9].trim() : '',
          graph: values[10] && values[10].trim() !== '' ? values[10].trim() : '',
          origin: values[11] && values[11].trim() !== '' ? values[11].trim() : '',
          status: 'Active',
          variablesAttachedList: [],
          listValuesList: []
        };

        parsedLists.push(newList);
      });

      if (errors.length > 0) {
        alert(`CSV Upload Errors:\n\n${errors.join('\n')}\n\nPlease fix these errors and try again.`);
        return;
      }

      if (parsedLists.length > 0) {
        onUpload(parsedLists);
        onClose();
      } else {
        alert('No valid lists found in CSV. Please check the format.');
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
                    column.required ? 'bg-red-900 bg-opacity-20' : ''
                  }`}
                >
                  <span className="text-sm text-ag-dark-text-secondary">
                    Column {column.number}
                  </span>
                  <span className={`text-sm font-medium ${
                    column.required ? 'text-ag-dark-error' : 'text-ag-dark-text'
                  }`}>
                    {column.name} {column.required ? '*' : ''}
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
            <p>• Driver through List Name must have values</p>
            <p>• Source, Upkeep, Graph, Origin are optional and can be left empty</p>
            <p><strong>After Upload:</strong></p>
            <p>• You can attach variables through the List Metadata panel</p>
            <p>• Select any uploaded list to edit its variables attached and list values</p>
          </div>
        </div>
      </div>
    </div>
  );
};