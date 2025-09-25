import React, { useState } from 'react';
import { X, Upload, FileText } from 'lucide-react';

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
      { number: 7, name: 'Object', required: true }
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
      const parsedObjects: any[] = [];
      const errors: string[] = [];

      dataRows.forEach((line, index) => {
        const values = line.split(',').map(val => val.trim().replace(/"/g, ''));
        
        if (values.length < 7) {
          errors.push(`Row ${index + 2}: Missing columns (expected 7, got ${values.length})`);
          return;
        }

        // Check required fields (all 7 columns are required)
        const requiredFields = ['Sector', 'Domain', 'Country', 'Object Clarifier', 'Being', 'Avatar', 'Object'];
        const missingFields: string[] = [];
        
        for (let i = 0; i < 7; i++) {
          if (!values[i] || values[i].trim() === '') {
            missingFields.push(requiredFields[i]);
          }
        }

        if (missingFields.length > 0) {
          errors.push(`Row ${index + 2}: Missing required fields: ${missingFields.join(', ')}`);
          return;
        }

        // Create driver string from the four driver components
        const sector = values[0].trim();
        const domain = values[1].trim();
        const country = values[2].trim();
        const objectClarifier = values[3].trim();
        
        const driverString = `${sector}, ${domain}, ${country}, ${objectClarifier === 'None' ? 'None' : objectClarifier}`;

        const newObject = {
          id: Date.now().toString() + index,
          driver: driverString,
          being: values[4].trim(),
          avatar: values[5].trim(),
          object: values[6].trim(),
          relationships: 0,
          variants: 0,
          variables: 54,
          status: 'Active',
          relationshipsList: [],
          variantsList: [],
        };

        parsedObjects.push(newObject);
      });

      if (errors.length > 0) {
        alert(`CSV Upload Errors:\n\n${errors.join('\n')}\n\nPlease fix these errors and try again.`);
        return;
      }

      if (parsedObjects.length > 0) {
        onUpload(parsedObjects);
        onClose();
      } else {
        alert('No valid objects found in CSV. Please check the format.');
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
                  className="flex items-center justify-between px-4 py-3 border-b border-ag-dark-border last:border-b-0 bg-red-900 bg-opacity-20"
                >
                  <span className="text-sm text-ag-dark-text-secondary">
                    Column {column.number}
                  </span>
                  <span className="text-sm font-medium text-ag-dark-error">
                    {column.name} *
                  </span>
                </div>
              ))}
            </div>
            <div className="text-xs text-ag-dark-error">
              * All fields are required
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
            <p>• All 7 columns must have values</p>
            <p>• Object Clarifier can be "None" if not applicable</p>
            <p>• Use "ALL" for Sector/Domain/Country to apply to all values</p>
            <p><strong>After Upload:</strong></p>
            <p>• IDs, relationships, and variants can be added after upload</p>
            <p>• Select any uploaded object to edit its complete metadata</p>
          </div>
        </div>
      </div>
    </div>
  );
};