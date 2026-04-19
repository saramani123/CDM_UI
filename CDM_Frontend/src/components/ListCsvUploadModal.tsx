import React, { useState } from 'react';
import { X, Upload, FileText } from 'lucide-react';

/** Split a CSV line on commas, respecting double-quoted fields and "" escapes. */
function parseCsvLine(line: string): string[] {
  const values: string[] = [];
  let current = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    const next = line[i + 1];
    if (char === '"' && inQuotes && next === '"') {
      current += '"';
      i++;
      continue;
    }
    if (char === '"') {
      inQuotes = !inQuotes;
      continue;
    }
    if (char === ',' && !inQuotes) {
      values.push(current.trim().replace(/^"|"$/g, ''));
      current = '';
    } else {
      current += char;
    }
  }
  values.push(current.trim().replace(/^"|"$/g, ''));
  return values;
}

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
        { number: 1, name: 'Part', required: false },
        { number: 2, name: 'Section', required: false },
        { number: 3, name: 'Group', required: false },
        { number: 4, name: 'Variable', required: false }
      ]
    },
    'list-values': {
      title: 'Upload List Values',
      columns: [
        { number: 1, name: 'List Value', required: true as const },
        { number: 2, name: 'List Value Variation', required: false as const }
      ]
    }
  };

  const currentSpec = formatSpecs[type];

  const handleFileUpload = (file: File) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      let csv = e.target?.result as string;
      if (csv.charCodeAt(0) === 0xfeff) {
        csv = csv.slice(1);
      }
      const lines = csv.split(/\r?\n/).filter(line => line.trim());
      
      if (lines.length < 2) {
        alert('CSV must contain at least a header row and one data row');
        return;
      }

      if (type === 'list-values') {
        const headers = parseCsvLine(lines[0]);
        const norm = (s: string) => s.trim().toLowerCase();
        let valIdx = headers.findIndex(h => norm(h) === 'list value');
        let varIdx = headers.findIndex(h => norm(h) === 'list value variation');
        if (valIdx < 0) {
          valIdx = headers.findIndex(h => norm(h).includes('value'));
        }
        if (valIdx < 0) {
          valIdx = 0;
        }
        if (varIdx < 0 && headers.length >= 2) {
          const alt = headers.findIndex((h, i) => i !== valIdx && norm(h).includes('variation'));
          if (alt >= 0) {
            varIdx = alt;
          }
        }
        if (headers.length === 0 || valIdx < 0 || valIdx >= headers.length) {
          alert('CSV must include a column with header "List Value" (required). Optional: "List Value Variation".');
          return;
        }

        const parsedData: { id: string; value: string; variation?: string }[] = [];
        const seen = new Set<string>();

        for (let index = 1; index < lines.length; index++) {
          const values = parseCsvLine(lines[index]);
          const rawVal = (values[valIdx] ?? '').trim();
          if (!rawVal) {
            const rawVar = varIdx >= 0 ? (values[varIdx] ?? '').trim() : '';
            if (rawVar) {
              alert(`Row ${index + 1}: List Value Variation is set without a List Value. Fix the CSV and try again.`);
              return;
            }
            continue;
          }
          const key = rawVal.toLowerCase();
          if (seen.has(key)) {
            continue;
          }
          seen.add(key);
          const variation = varIdx >= 0 ? (values[varIdx] ?? '').trim() : '';
          parsedData.push({
            id: Date.now().toString() + index,
            value: rawVal,
            ...(variation ? { variation } : {})
          });
        }

        if (parsedData.length > 0) {
          onUpload(parsedData);
          onClose();
        } else {
          alert('No valid data rows found. Ensure each row has a List Value.');
        }
        return;
      }

      // Parse header row (variables-attached)
      const dataRows = lines.slice(1);
      const parsedData: any[] = [];

      dataRows.forEach((line, index) => {
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
        values.push(currentValue.trim().replace(/^"|"$/g, ''));
        
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

  const isCsvFile = (file: File) =>
    file.type === 'text/csv' ||
    file.type === 'application/csv' ||
    file.name.toLowerCase().endsWith('.csv');

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file && isCsvFile(file)) {
      handleFileUpload(file);
    } else {
      alert('Please select a valid CSV file');
    }
  };

  const handleDrop = (event: React.DragEvent) => {
    event.preventDefault();
    setIsDragOver(false);
    
    const file = event.dataTransfer.files[0];
    if (file && isCsvFile(file)) {
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
    <div className="fixed inset-0 bg-black bg-opacity-70 flex items-center justify-center z-[110]">
      <div className="bg-ag-dark-surface rounded-lg border border-ag-dark-border max-w-lg w-full mx-4">
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
                  <span
                    className={`text-sm font-medium ${
                      'required' in column && column.required ? 'text-red-400' : 'text-ag-dark-text'
                    }`}
                  >
                    {'required' in column && column.required ? `${column.name} *` : column.name}
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
              <>
                <p>
                  • Required header: <span className="text-red-400">List Value</span>
                  <span className="text-red-400"> *</span> (exact name; any column order)
                </p>
                <p>• Optional header: List Value Variation</p>
                <p>• A variation without a list value on the same row is not allowed</p>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};