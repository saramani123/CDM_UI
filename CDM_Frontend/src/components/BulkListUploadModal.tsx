import React, { useState } from 'react';
import { X, Upload, FileText, Loader2 } from 'lucide-react';

import { ListData } from '../data/listsData';

interface BulkListUploadModalProps {
  isOpen: boolean;
  onClose: () => void;
  onUpload: (lists: ListData[]) => Promise<void>;
  existingData?: ListData[];
}

export const BulkListUploadModal: React.FC<BulkListUploadModalProps> = ({
  isOpen,
  onClose,
  onUpload,
  existingData = []
}) => {
  const [isDragOver, setIsDragOver] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [parsedListsCount, setParsedListsCount] = useState(0);

  if (!isOpen) return null;

  const csvFormat = {
    title: 'Upload Lists',
    columns: [
      { number: 1, name: 'Sector', required: true },
      { number: 2, name: 'Domain', required: true },
      { number: 3, name: 'Country', required: true },
      { number: 4, name: 'Set', required: true },
      { number: 5, name: 'Grouping', required: true },
      { number: 6, name: 'List', required: true },
      { number: 7, name: 'Format', required: false },
      { number: 8, name: 'Source', required: false },
      { number: 9, name: 'Upkeep', required: false },
      { number: 10, name: 'Graph', required: false },
      { number: 11, name: 'Origin', required: false }
    ]
  };

  const handleFileUpload = async (file: File) => {
    setIsLoading(true);
    const reader = new FileReader();
    reader.onload = async (e) => {
      try {
        const csv = e.target?.result as string;
        const lines = csv.split('\n').filter(line => line.trim());
        
        if (lines.length < 2) {
          alert('CSV must contain at least a header row and one data row');
          setIsLoading(false);
          return;
        }

      // Skip header row and parse data rows
      const dataRows = lines.slice(1);
      const parsedLists: ListData[] = [];
      const errors: string[] = [];

      dataRows.forEach((line, index) => {
        // Parse CSV line, handling quoted values
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
        
        // Check required fields (columns 1-6)
        const requiredFields = ['Sector', 'Domain', 'Country', 'Set', 'Grouping', 'List'];
        const missingFields: string[] = [];
        
        for (let i = 0; i < 6; i++) {
          if (!values[i] || values[i].trim() === '') {
            missingFields.push(requiredFields[i]);
          }
        }

        if (missingFields.length > 0) {
          errors.push(`Row ${index + 2}: Missing required fields: ${missingFields.join(', ')}`);
          return;
        }

        const sector = values[0]?.trim() || '';
        const domain = values[1]?.trim() || '';
        const country = values[2]?.trim() || '';
        const set = values[3]?.trim() || '';
        const grouping = values[4]?.trim() || '';
        const list = values[5]?.trim() || '';

        // Check for duplicate in existing data
        const isDuplicateInExisting = existingData.some(existingList => {
          const existingSector = Array.isArray(existingList.sector) 
            ? (existingList.sector.length === 1 && existingList.sector[0] === 'ALL' ? 'ALL' : existingList.sector.sort().join(','))
            : existingList.sector || '';
          const existingDomain = Array.isArray(existingList.domain)
            ? (existingList.domain.length === 1 && existingList.domain[0] === 'ALL' ? 'ALL' : existingList.domain.sort().join(','))
            : existingList.domain || '';
          const existingCountry = Array.isArray(existingList.country)
            ? (existingList.country.length === 1 && existingList.country[0] === 'ALL' ? 'ALL' : existingList.country.sort().join(','))
            : existingList.country || '';
          
          return existingSector === sector &&
                 existingDomain === domain &&
                 existingCountry === country &&
                 existingList.set === set &&
                 existingList.grouping === grouping &&
                 existingList.list === list;
        });

        if (isDuplicateInExisting) {
          errors.push(`Row ${index + 2}: A list with the same Sector (${sector}), Domain (${domain}), Country (${country}), Set (${set}), Grouping (${grouping}), and List (${list}) already exists in the dataset.`);
          return;
        }

        // Check for duplicate within the CSV file itself
        const isDuplicateInCSV = parsedLists.some(parsedList => {
          const parsedSector = Array.isArray(parsedList.sector)
            ? (parsedList.sector.length === 1 && parsedList.sector[0] === 'ALL' ? 'ALL' : parsedList.sector.sort().join(','))
            : parsedList.sector || '';
          const parsedDomain = Array.isArray(parsedList.domain)
            ? (parsedList.domain.length === 1 && parsedList.domain[0] === 'ALL' ? 'ALL' : parsedList.domain.sort().join(','))
            : parsedList.domain || '';
          const parsedCountry = Array.isArray(parsedList.country)
            ? (parsedList.country.length === 1 && parsedList.country[0] === 'ALL' ? 'ALL' : parsedList.country.sort().join(','))
            : parsedList.country || '';
          
          return parsedSector === sector &&
                 parsedDomain === domain &&
                 parsedCountry === country &&
                 parsedList.set === set &&
                 parsedList.grouping === grouping &&
                 parsedList.list === list;
        });

        if (isDuplicateInCSV) {
          errors.push(`Row ${index + 2}: A duplicate entry with the same Sector (${sector}), Domain (${domain}), Country (${country}), Set (${set}), Grouping (${grouping}), and List (${list}) already exists earlier in the CSV file.`);
          return;
        }

        const newList: ListData = {
          id: `list-${Date.now()}-${index}`,
          sector,
          domain,
          country,
          set,
          grouping,
          list,
          format: values[6] && values[6].trim() !== '' ? values[6].trim() : undefined,
          source: values[7] && values[7].trim() !== '' ? values[7].trim() : undefined,
          upkeep: values[8] && values[8].trim() !== '' ? values[8].trim() : undefined,
          graph: values[9] && values[9].trim() !== '' ? values[9].trim() : undefined,
          origin: values[10] && values[10].trim() !== '' ? values[10].trim() : undefined,
          status: 'Active',
          variablesAttachedList: [],
          listValuesList: []
        };

        parsedLists.push(newList);
      });

        if (errors.length > 0) {
          alert(`CSV Upload Errors:\n\n${errors.join('\n')}\n\nPlease fix these errors and try again.`);
          setIsLoading(false);
          return;
        }

        if (parsedLists.length > 0) {
          // Keep modal open and show loading animation while backend processes
          // onUpload is async and will handle closing the modal when done
          setParsedListsCount(parsedLists.length);
          try {
            await onUpload(parsedLists);
            // Modal will be closed by parent component after upload completes
          } catch (error) {
            // Error handling is done in parent, just reset loading state
            setIsLoading(false);
            setParsedListsCount(0);
          }
        } else {
          alert('No valid lists found in CSV. Please check the format.');
          setIsLoading(false);
          setParsedListsCount(0);
        }
      } catch (error) {
        console.error('Error processing CSV:', error);
        alert('Error processing CSV file. Please try again.');
        setIsLoading(false);
        setParsedListsCount(0);
      }
    };
    reader.onerror = () => {
      alert('Error reading file. Please try again.');
      setIsLoading(false);
      setParsedListsCount(0);
    };
    reader.readAsText(file);
  };

  const handleFileSelect = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file && file.type === 'text/csv') {
      await handleFileUpload(file);
    } else {
      alert('Please select a valid CSV file');
    }
  };

  const handleDrop = async (event: React.DragEvent) => {
    event.preventDefault();
    setIsDragOver(false);
    
    const file = event.dataTransfer.files[0];
    if (file && file.type === 'text/csv') {
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
    <div className="fixed inset-0 bg-black bg-opacity-70 flex items-center justify-center z-[100]">
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
              * Required fields (columns 1-6)
            </div>
          </div>

          {/* Upload Area */}
          <div className="space-y-3">
            <div
              className={`border-2 border-dashed rounded-lg p-8 text-center transition-colors ${
                isDragOver
                  ? 'border-ag-dark-accent bg-ag-dark-accent bg-opacity-10'
                  : 'border-ag-dark-border hover:border-ag-dark-accent hover:bg-ag-dark-bg'
              } ${isLoading ? 'opacity-50 pointer-events-none' : ''}`}
              onDrop={handleDrop}
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
            >
              {isLoading ? (
                <div className="space-y-4">
                  <div className="flex justify-center">
                    <Loader2 className="w-12 h-12 text-ag-dark-accent animate-spin" />
                  </div>
                  <div className="space-y-2">
                    <p className="text-sm font-medium text-ag-dark-text">
                      {parsedListsCount > 0 
                        ? `Creating ${parsedListsCount} list${parsedListsCount !== 1 ? 's' : ''} in Neo4j...`
                        : 'Processing CSV file...'}
                    </p>
                    <p className="text-xs text-ag-dark-text-secondary">
                      {parsedListsCount > 0
                        ? 'Please wait while we create the data in the database'
                        : 'Please wait while we load your data'}
                    </p>
                  </div>
                </div>
              ) : (
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
                      disabled={isLoading}
                    />
                  </label>
                </div>
              )}
            </div>
          </div>

          {/* Format Notes */}
          <div className="text-xs text-ag-dark-text-secondary space-y-1">
            <p><strong>Required Fields:</strong></p>
            <p>• Sector, Domain, Country, Set, Grouping, and List must have values</p>
            <p>• Format, Source, Upkeep, Graph, Origin are optional and can be left empty</p>
            <p><strong>After Upload:</strong></p>
            <p>• You can attach variables through the List Metadata panel</p>
            <p>• Select any uploaded list to edit its variables attached and list values</p>
          </div>
        </div>
      </div>
    </div>
  );
};