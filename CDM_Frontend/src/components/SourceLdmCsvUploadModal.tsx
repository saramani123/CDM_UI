import React, { useState } from 'react';
import { X, Upload, FileText } from 'lucide-react';
import { SOURCE_LDM_CSV_OPTIONAL, SOURCE_LDM_CSV_REQUIRED } from '../utils/sourceLdmCsv';

interface SourceLdmCsvUploadModalProps {
  isOpen: boolean;
  onClose: () => void;
  onUpload: (file: File) => void;
  isLoading?: boolean;
}

export const SourceLdmCsvUploadModal: React.FC<SourceLdmCsvUploadModalProps> = ({
  isOpen,
  onClose,
  onUpload,
  isLoading = false,
}) => {
  const [isDragOver, setIsDragOver] = useState(false);

  if (!isOpen) return null;

  const columns = [
    ...SOURCE_LDM_CSV_REQUIRED.map((name, i) => ({ number: i + 1, name, required: true as const })),
    ...SOURCE_LDM_CSV_OPTIONAL.map((name, i) => ({
      number: SOURCE_LDM_CSV_REQUIRED.length + i + 1,
      name,
      required: false as const,
    })),
  ];

  const isCsvFile = (file: File) => {
    const n = file.name.toLowerCase();
    return file.type === 'text/csv' || file.type === 'application/csv' || n.endsWith('.csv');
  };

  const handleFileUpload = (file: File) => {
    if (!isCsvFile(file)) {
      alert('Please select a valid CSV file');
      return;
    }
    if (isLoading) return;
    onUpload(file);
  };

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) handleFileUpload(file);
    event.target.value = '';
  };

  const handleDrop = (event: React.DragEvent) => {
    event.preventDefault();
    setIsDragOver(false);
    const file = event.dataTransfer.files[0];
    if (file) handleFileUpload(file);
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-70 flex items-center justify-center z-[100]" data-modal="true">
      <div className="bg-ag-dark-surface rounded-lg border border-ag-dark-border max-w-lg w-full mx-4 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-6 border-b border-ag-dark-border">
          <h2 className="text-xl font-semibold text-ag-dark-text">Upload Source LDM CSV</h2>
          <button
            type="button"
            onClick={() => !isLoading && onClose()}
            className="text-ag-dark-text-secondary hover:text-ag-dark-text transition-colors"
            aria-label="Close"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        <div className="p-6 space-y-6">
          <div className="space-y-3">
            <h3 className="text-sm font-medium text-ag-dark-accent">CSV FORMAT</h3>
            <div className="bg-ag-dark-bg rounded-lg border border-ag-dark-border overflow-hidden">
              {columns.map((column) => (
                <div
                  key={column.number}
                  className={`flex items-center justify-between px-4 py-3 border-b border-ag-dark-border last:border-b-0 ${
                    column.required ? 'bg-red-900 bg-opacity-20' : ''
                  }`}
                >
                  <span className="text-sm text-ag-dark-text-secondary">Column {column.number}</span>
                  <span
                    className={`text-sm font-medium ${
                      column.required ? 'text-ag-dark-error' : 'text-ag-dark-text'
                    }`}
                  >
                    {column.name} {column.required ? '*' : ''}
                  </span>
                </div>
              ))}
            </div>
            <div className="text-xs text-ag-dark-error">
              * Required: {SOURCE_LDM_CSV_REQUIRED.join(', ')}
            </div>
          </div>

          <div className="space-y-3">
            <div
              className={`border-2 border-dashed rounded-lg p-8 text-center transition-colors ${
                isDragOver
                  ? 'border-ag-dark-accent bg-ag-dark-accent bg-opacity-10'
                  : 'border-ag-dark-border hover:border-ag-dark-accent hover:bg-ag-dark-bg'
              }`}
              onDrop={handleDrop}
              onDragOver={(e) => {
                e.preventDefault();
                setIsDragOver(true);
              }}
              onDragLeave={() => setIsDragOver(false)}
            >
              <div className="space-y-4">
                <div className="flex justify-center">
                  <FileText className="w-12 h-12 text-ag-dark-text-secondary" />
                </div>
                <div className="space-y-2">
                  <p className="text-sm font-medium text-ag-dark-text">Drop your CSV file here</p>
                  <p className="text-xs text-ag-dark-text-secondary">or click to browse</p>
                </div>
                <label
                  className={`inline-flex items-center gap-2 px-4 py-2 rounded transition-colors ${
                    isLoading
                      ? 'bg-ag-dark-bg text-ag-dark-text-secondary cursor-not-allowed'
                      : 'bg-ag-dark-accent text-white hover:bg-ag-dark-accent-hover cursor-pointer'
                  }`}
                >
                  {isLoading ? (
                    <>
                      <svg className="animate-spin h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                        <path
                          className="opacity-75"
                          fill="currentColor"
                          d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                        />
                      </svg>
                      UPLOADING…
                    </>
                  ) : (
                    <>
                      <Upload className="w-4 h-4" />
                      UPLOAD CSV
                    </>
                  )}
                  <input type="file" accept=".csv,text/csv" onChange={handleFileSelect} className="hidden" disabled={isLoading} />
                </label>
              </div>
            </div>
          </div>

          <div className="text-xs text-ag-dark-text-secondary space-y-1">
            <p>
              <strong>Required headers</strong> (names must match exactly, any column order):{' '}
              {SOURCE_LDM_CSV_REQUIRED.join(', ')}.
            </p>
            <p>
              <strong>Optional:</strong> {SOURCE_LDM_CSV_OPTIONAL.join(', ')} — omit columns or leave cells empty.
            </p>
            <p>
              <strong>Source Name</strong> is filled automatically from the current source; do not include it in the CSV.
            </p>
            <p>Unknown column headers or missing required columns will show an error and nothing will be imported.</p>
          </div>
        </div>
      </div>
    </div>
  );
};
