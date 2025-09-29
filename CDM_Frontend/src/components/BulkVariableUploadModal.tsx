import React, { useState } from 'react';
import { X, Upload, FileText } from 'lucide-react';
import { concatenateVariableDrivers } from '../data/variablesData';
import { useDrivers } from '../hooks/useDrivers';

interface BulkVariableUploadModalProps {
  isOpen: boolean;
  onClose: () => void;
  onUpload: (variables: any[]) => void;
}

export const BulkVariableUploadModal: React.FC<BulkVariableUploadModalProps> = ({
  isOpen,
  onClose,
  onUpload
}) => {
  const [isDragOver, setIsDragOver] = useState(false);
  const { drivers: driversData } = useDrivers();

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
      const parsedVariables: any[] = [];
      const errors: string[] = [];

      dataRows.forEach((line, index) => {
        const values = line.split(',').map(val => val.trim().replace(/"/g, ''));
        
        if (values.length < 14) {
          errors.push(`Row ${index + 2}: Missing columns (expected 14, got ${values.length})`);
          return;
        }

        // Check required fields (columns 1-8: Sector through Variable)
        const requiredFields = ['Sector', 'Domain', 'Country', 'Variable Clarifier', 'Part', 'Section', 'Group', 'Variable'];
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

        // Parse driver selections
        const sector = values[0].trim() === 'ALL' ? ['ALL'] : values[0].trim().split(',').map(s => s.trim());
        const domain = values[1].trim() === 'ALL' ? ['ALL'] : values[1].trim().split(',').map(d => d.trim());
        const country = values[2].trim() === 'ALL' ? ['ALL'] : values[2].trim().split(',').map(c => c.trim());
        const variableClarifier = values[3].trim() || '';

        // Validate driver selections against real drivers data
        const invalidSectors = sector.filter(s => s !== 'ALL' && !driversData.sectors.includes(s));
        const invalidDomains = domain.filter(d => d !== 'ALL' && !driversData.domains.includes(d));
        const invalidCountries = country.filter(c => c !== 'ALL' && !driversData.countries.includes(c));
        const invalidClarifiers = variableClarifier && variableClarifier !== 'None' && !driversData.variableClarifiers.includes(variableClarifier);

        if (invalidSectors.length > 0 || invalidDomains.length > 0 || invalidCountries.length > 0 || invalidClarifiers) {
          const invalidFields = [];
          if (invalidSectors.length > 0) invalidFields.push(`Invalid Sectors: ${invalidSectors.join(', ')}`);
          if (invalidDomains.length > 0) invalidFields.push(`Invalid Domains: ${invalidDomains.join(', ')}`);
          if (invalidCountries.length > 0) invalidFields.push(`Invalid Countries: ${invalidCountries.join(', ')}`);
          if (invalidClarifiers) invalidFields.push(`Invalid Variable Clarifier: ${variableClarifier}`);
          
          errors.push(`Row ${index + 2}: ${invalidFields.join('; ')}`);
          return;
        }

        // Generate driver string
        const driverString = concatenateVariableDrivers(sector, domain, country, variableClarifier);

        const newVariable = {
          id: Date.now().toString() + index,
          driver: driverString,
          part: values[4].trim(),
          section: values[5].trim(),
          group: values[6].trim(),
          variable: values[7].trim(),
          formatI: values[8].trim(),
          formatII: values[9].trim(),
          gType: values[10] && values[10].trim() !== '' ? values[10].trim() : '',
          validation: values[11] && values[11].trim() !== '' ? values[11].trim() : '',
          default: values[12] && values[12].trim() !== '' ? values[12].trim() : '',
          graph: values[13] && values[13].trim() !== '' ? values[13].trim() : '',
          objectRelationships: 0,
          status: 'Active',
          objectRelationshipsList: []
        };

        parsedVariables.push(newVariable);
      });

      if (errors.length > 0) {
        alert(`CSV Upload Errors:\n\n${errors.join('\n')}\n\nPlease fix these errors and try again.`);
        return;
      }

      if (parsedVariables.length > 0) {
        onUpload(parsedVariables);
        onClose();
      } else {
        alert('No valid variables found in CSV. Please check the format.');
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