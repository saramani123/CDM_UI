import React, { useState } from 'react';
import { X, Upload, FileText, AlertCircle, CheckCircle2 } from 'lucide-react';
import type { ObjectData } from '../data/mockData';

interface RelationshipCsvUploadModalProps {
  isOpen: boolean;
  onClose: () => void;
  selectedObject: ObjectData | null;
  allObjects: ObjectData[];
  onProcessed: (validRelationships: ProcessedRelationship[]) => void;
}

export interface ProcessedRelationship {
  targetObject: ObjectData;
  relationshipType: 'Inter-Table' | 'Blood' | 'Subtype' | 'Intra-Table';
  role: string;
}

interface UploadError {
  type: 'missing_object' | 'existing_relationship';
  message: string;
  rowData: string[];
}

interface ProcessingResult {
  valid: ProcessedRelationship[];
  errors: UploadError[];
}

export const RelationshipCsvUploadModal: React.FC<RelationshipCsvUploadModalProps> = ({
  isOpen,
  onClose,
  selectedObject,
  allObjects,
  onProcessed
}) => {
  const [isDragOver, setIsDragOver] = useState(false);
  const [processingResult, setProcessingResult] = useState<ProcessingResult | null>(null);
  const [showResult, setShowResult] = useState(false);

  if (!isOpen) return null;

  const findMatchingObject = (
    sector: string,
    domain: string,
    country: string,
    being: string,
    avatar: string,
    object: string
  ): ObjectData | null => {
    // Parse driver strings to match
    return allObjects.find(obj => {
      const driverParts = obj.driver?.split(', ') || [];
      const objSector = driverParts[0]?.trim() || '';
      const objDomain = driverParts[1]?.trim() || '';
      const objCountry = driverParts[2]?.trim() || '';
      
      // Match sector, domain, country, being, avatar, object
      const sectorMatch = sector === 'ALL' || objSector === sector || objSector === 'ALL';
      const domainMatch = domain === 'ALL' || objDomain === domain || objDomain === 'ALL';
      const countryMatch = country === 'ALL' || objCountry === country || objCountry === 'ALL';
      const beingMatch = obj.being === being;
      const avatarMatch = obj.avatar === avatar;
      const objectMatch = obj.object === object;

      return sectorMatch && domainMatch && countryMatch && beingMatch && avatarMatch && objectMatch;
    }) || null;
  };

  const checkExistingRelationship = (targetObject: ObjectData): boolean => {
    // Note: Full check for existing relationships requires API call
    // This is handled when RelationshipModal loads existing relationships
    // and merges with CSV-uploaded relationships
    // For now, we only check for duplicates within the CSV itself
    return false;
  };

  const parseCsv = (csvContent: string): ProcessingResult => {
    if (!selectedObject) {
      return { valid: [], errors: [{ type: 'missing_object', message: 'No object selected', rowData: [] }] };
    }

    const lines = csvContent.split('\n').filter(line => line.trim());
    if (lines.length < 2) {
      return { valid: [], errors: [{ type: 'missing_object', message: 'CSV must contain at least a header row and one data row', rowData: [] }] };
    }

    const valid: ProcessedRelationship[] = [];
    const errors: UploadError[] = [];
    const seenTargets = new Set<string>(); // Track targets we've already added to prevent duplicates

    // Skip header row
    for (let i = 1; i < lines.length; i++) {
      const line = lines[i].trim();
      if (!line) continue;

      // Parse CSV row (handle quoted values)
      const values: string[] = [];
      let currentValue = '';
      let insideQuotes = false;
      
      for (let j = 0; j < line.length; j++) {
        const char = line[j];
        if (char === '"') {
          insideQuotes = !insideQuotes;
        } else if (char === ',' && !insideQuotes) {
          values.push(currentValue.trim());
          currentValue = '';
        } else {
          currentValue += char;
        }
      }
      values.push(currentValue.trim()); // Add last value

      if (values.length < 8) {
        errors.push({
          type: 'missing_object',
          message: `Row ${i + 1}: Insufficient columns (expected 8, found ${values.length})`,
          rowData: values
        });
        continue;
      }

      const [sector, domain, country, being, avatar, object, relationshipType, role] = values.map(v => v.trim());

      // Find matching object
      const targetObject = findMatchingObject(sector, domain, country, being, avatar, object);

      if (!targetObject) {
        errors.push({
          type: 'missing_object',
          message: `No matching object found for Sector=${sector}, Domain=${domain}, Country=${country}, Being=${being}, Avatar=${avatar}, Object=${object}`,
          rowData: values
        });
        continue;
      }

      // Check if this is the same object (self-relationship)
      const isSelf = targetObject.id === selectedObject.id;
      
      // Check if relationship already exists
      const relationshipKey = `${targetObject.id}-${relationshipType}-${role}`;
      if (seenTargets.has(targetObject.id)) {
        errors.push({
          type: 'existing_relationship',
          message: `Relationship to ${sector} - ${domain} - ${country} - ${being} - ${avatar} - ${object} already exists in this upload. You can modify roles or relationship type in the UI.`,
          rowData: values
        });
        continue;
      }

      seenTargets.add(targetObject.id);

      // Validate relationship type
      let finalRelationshipType: 'Inter-Table' | 'Blood' | 'Subtype' | 'Intra-Table';
      if (isSelf) {
        // Self-relationships are always Intra-Table
        finalRelationshipType = 'Intra-Table';
      } else {
        // Validate relationship type from CSV
        if (relationshipType === 'Inter-Table' || relationshipType === 'Blood' || relationshipType === 'Subtype') {
          finalRelationshipType = relationshipType;
        } else {
          errors.push({
            type: 'missing_object',
            message: `Row ${i + 1}: Invalid relationship type "${relationshipType}". Must be Inter-Table, Blood, or Subtype.`,
            rowData: values
          });
          continue;
        }
      }

      // Process role - append CSV role to default role (object name)
      const defaultRole = selectedObject.object;
      const csvRole = role || '';
      const finalRole = csvRole 
        ? `${defaultRole}, ${csvRole}`.split(', ').filter(r => r.trim()).join(', ')
        : defaultRole;

      valid.push({
        targetObject,
        relationshipType: finalRelationshipType,
        role: finalRole
      });
    }

    return { valid, errors };
  };

  const handleFileUpload = (file: File) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      let csv = e.target?.result as string;
      
      // Remove BOM if present
      if (csv.charCodeAt(0) === 0xFEFF) {
        csv = csv.slice(1);
      }

      const result = parseCsv(csv);
      setProcessingResult(result);
      setShowResult(true);
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

  const handleConfirm = () => {
    if (processingResult && processingResult.valid.length > 0) {
      onProcessed(processingResult.valid);
    }
    handleClose();
  };

  const handleClose = () => {
    setProcessingResult(null);
    setShowResult(false);
    setIsDragOver(false);
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-70 flex items-center justify-center z-50">
      <div className="bg-ag-dark-surface rounded-lg border border-ag-dark-border max-w-lg w-full mx-4 max-h-[85vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-ag-dark-border sticky top-0 bg-ag-dark-surface">
          <h2 className="text-lg font-semibold text-ag-dark-text">Upload Relationships</h2>
          <button
            onClick={handleClose}
            className="text-ag-dark-text-secondary hover:text-ag-dark-text transition-colors"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* Content */}
        <div className="p-5 space-y-4">
          {!showResult ? (
            <>
              {/* CSV Format Specification */}
              <div className="space-y-3">
                <h3 className="text-sm font-medium text-ag-dark-accent">CSV FORMAT</h3>
                <div className="bg-ag-dark-bg rounded-lg border border-ag-dark-border overflow-hidden">
                  {[
                    { number: 1, name: 'Sector' },
                    { number: 2, name: 'Domain' },
                    { number: 3, name: 'Country' },
                    { number: 4, name: 'Being' },
                    { number: 5, name: 'Avatar' },
                    { number: 6, name: 'Object' },
                    { number: 7, name: 'Relationship Type' },
                    { number: 8, name: 'Role' }
                  ].map((column) => (
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
                  className={`border-2 border-dashed rounded-lg p-6 text-center transition-colors ${
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
                      <FileText className="w-10 h-10 text-ag-dark-text-secondary" />
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
                <p>• Each subsequent row represents one relationship</p>
                <p>• Columns must be in the exact order shown above</p>
                <p>• Allowed Relationship Types: Inter-Table, Blood, Subtype</p>
                <p>• Relationship Type for self-relationships is automatically set to Intra-Table</p>
                <p className="pt-2 text-ag-dark-text">
                  Each row creates a relationship between this object and the specified target. Ensure all fields match existing objects.
                </p>
              </div>
            </>
          ) : (
            /* Results Summary */
            <div className="space-y-4">
              <div className="flex items-center gap-2">
                {processingResult && processingResult.valid.length > 0 ? (
                  <CheckCircle2 className="w-5 h-5 text-green-500" />
                ) : (
                  <AlertCircle className="w-5 h-5 text-yellow-500" />
                )}
                <h3 className="text-lg font-semibold text-ag-dark-text">Upload Results</h3>
              </div>

              {processingResult && processingResult.valid.length > 0 && (
                <div className="bg-green-900/20 border border-green-700 rounded-lg p-4">
                  <p className="text-sm text-green-400 font-medium">
                    Successfully parsed {processingResult.valid.length} relationship(s)
                  </p>
                </div>
              )}

              {processingResult && processingResult.errors.length > 0 && (
                <div className="space-y-3">
                  <div className="bg-yellow-900/20 border border-yellow-700 rounded-lg p-4">
                    <p className="text-sm text-yellow-400 font-medium mb-2">
                      {processingResult.errors.length} row(s) skipped
                    </p>
                    <div className="space-y-2 max-h-60 overflow-y-auto">
                      {processingResult.errors.map((error, idx) => (
                        <div key={idx} className="text-xs text-yellow-300 bg-ag-dark-bg rounded p-2">
                          <p>{error.message}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {processingResult && processingResult.valid.length === 0 && processingResult.errors.length > 0 && (
                <div className="bg-red-900/20 border border-red-700 rounded-lg p-4">
                  <p className="text-sm text-red-400">
                    No valid relationships were parsed. Please check your CSV file and try again.
                  </p>
                </div>
              )}

              <div className="flex justify-end gap-3 pt-4">
                <button
                  onClick={handleClose}
                  className="px-4 py-2 border border-ag-dark-border rounded text-ag-dark-text hover:bg-ag-dark-bg transition-colors"
                >
                  Cancel
                </button>
                {processingResult && processingResult.valid.length > 0 && (
                  <button
                    onClick={handleConfirm}
                    className="px-4 py-2 bg-ag-dark-accent text-white rounded hover:bg-ag-dark-accent-hover transition-colors"
                  >
                    Apply {processingResult.valid.length} Relationship(s)
                  </button>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

