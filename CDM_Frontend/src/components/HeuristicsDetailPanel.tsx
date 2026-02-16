import React, { useState, useEffect } from 'react';
import { Save, Plus } from 'lucide-react';
import { HeuristicsData } from '../hooks/useHeuristics';
import { apiService } from '../services/api';
import { HeuristicsTrainingDataModal } from './HeuristicsTrainingDataModal';
import { useDrivers } from '../hooks/useDrivers';

interface HeuristicsDetailPanelProps {
  heuristicsItem: HeuristicsData | null;
  onSave: () => void;
  onClose?: () => void;
}

interface PanelData {
  columns: string[];
  rows: string[][];
}

export const HeuristicsDetailPanel: React.FC<HeuristicsDetailPanelProps> = ({
  heuristicsItem,
  onSave,
  onClose
}) => {
  const { drivers: driversData, loading: driversLoading } = useDrivers();
  const [columnNames, setColumnNames] = useState<string[]>(['', 'If']);
  const [rows, setRows] = useState<string[][]>(Array(20).fill(null).map(() => ['', '']));
  const [sector, setSector] = useState<string>('');
  const [domain, setDomain] = useState<string>('');
  const [country, setCountry] = useState<string>('');
  const [agent, setAgent] = useState<string>('');
  const [procedure, setProcedure] = useState<string>('');
  const [is_hero, setIsHero] = useState<boolean>(true);
  const [documentation, setDocumentation] = useState<string>('');
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isTrainingDataModalOpen, setIsTrainingDataModalOpen] = useState(false);
  const [selectedRowIndex, setSelectedRowIndex] = useState<number | null>(null);
  const [existingTrainingData, setExistingTrainingData] = useState<any>(null);

  // Get distinct values from drivers
  const sectors = driversData?.sectors || [];
  const domains = driversData?.domains || [];
  const countries = driversData?.countries || [];

  // Include "ALL" as first option, then distinct values from drivers (excluding "ALL" if it exists)
  const sectorOptions = ['ALL', ...sectors.filter(s => s !== 'ALL' && s !== 'All')];
  const domainOptions = ['ALL', ...domains.filter(d => d !== 'ALL' && d !== 'All')];
  const countryOptions = ['ALL', ...countries.filter(c => c !== 'ALL' && c !== 'All')];

  // Load existing data when heuristicsItem changes
  useEffect(() => {
    if (heuristicsItem) {
      // Initialize editable fields from heuristicsItem
      setSector(heuristicsItem.sector || 'ALL');
      setDomain(heuristicsItem.domain || 'ALL');
      setCountry(heuristicsItem.country || 'ALL');
      setAgent(heuristicsItem.agent || '');
      setProcedure(heuristicsItem.procedure || '');
      setIsHero(heuristicsItem.is_hero !== false);
      setDocumentation(heuristicsItem.documentation ?? '');
      
      loadHeuristicsDetail();
    }
  }, [heuristicsItem]);

  const loadHeuristicsDetail = async () => {
    if (!heuristicsItem) return;
    
    setIsLoading(true);
    setError(null);
    
    try {
      const item = await apiService.getHeuristicItem(heuristicsItem.id);
      const itemAny = item as any;
      setIsHero(itemAny.is_hero !== false);
      setDocumentation(itemAny.documentation ?? '');
      
      let detailData = itemAny.detailData;
      
      // Parse if it's a string
      if (typeof detailData === 'string') {
        try {
          detailData = JSON.parse(detailData);
        } catch (e) {
          console.error('Error parsing detailData:', e);
          detailData = null;
        }
      }
      
      if (detailData && typeof detailData === 'object') {
        // Ensure we have exactly 2 columns; second column is always "If" (fixed)
        const loadedColumns = detailData.columns || ['', 'If'];
        setColumnNames([loadedColumns[0] || '', 'If']);
        // If rows exist, use them; otherwise create 20 empty rows
        const loadedRows = detailData.rows || [];
        // Ensure rows have exactly 2 columns
        const normalizedRows = loadedRows.map((row: string[]) => [
          row[0] || '',
          row[1] || ''
        ]);
        // Ensure at least 20 rows
        if (normalizedRows.length < 20) {
          const emptyRows = Array(20 - normalizedRows.length).fill(null).map(() => ['', '']);
          setRows([...normalizedRows, ...emptyRows]);
        } else {
          setRows(normalizedRows);
        }
      } else {
        // Initialize with default values - create 20 empty rows with 2 columns; second column is always "If"
        setColumnNames(['', 'If']);
        setRows(Array(20).fill(null).map(() => ['', '']));
      }
    } catch (err) {
      console.error('Error loading heuristics detail:', err);
      // Initialize with defaults on error - 20 empty rows with 2 columns
      setColumnNames(['', 'If']);
      setRows(Array(20).fill(null).map(() => ['', '']));
    } finally {
      setIsLoading(false);
    }
  };

  const handleColumnNameChange = (index: number, value: string) => {
    // Second column (index 1) is always "If" and cannot be changed
    if (index === 1) return;
    const newColumns = [...columnNames];
    newColumns[index] = value;
    setColumnNames(newColumns);
  };

  const handleCellChange = (rowIndex: number, colIndex: number, value: string) => {
    const newRows = [...rows];
    if (!newRows[rowIndex]) {
      newRows[rowIndex] = ['', ''];
    }
    newRows[rowIndex][colIndex] = value;
    setRows(newRows);
  };

  const handleAddRow = () => {
    setRows([...rows, ['', '']]);
  };

  const handlePaste = (e: React.ClipboardEvent<HTMLInputElement>, startRowIndex: number, startColIndex: number) => {
    e.preventDefault();
    
    const pastedData = e.clipboardData.getData('text');
    if (!pastedData) return;

    // Parse the pasted data - Excel uses tabs for columns and newlines for rows
    const lines = pastedData.split(/\r?\n/).filter(line => line.trim() !== '');
    const parsedData: string[][] = lines.map(line => 
      line.split('\t').map(cell => cell.trim())
    );

    if (parsedData.length === 0) return;

    // Update rows starting from the clicked cell
    const newRows = [...rows];
    
    parsedData.forEach((pastedRow, rowOffset) => {
      const targetRowIndex = startRowIndex + rowOffset;
      
      // Ensure we have enough rows
      while (targetRowIndex >= newRows.length) {
        newRows.push(['', '']);
      }

      // Update cells in this row (limit to 2 columns)
      pastedRow.forEach((cellValue, colOffset) => {
        const targetColIndex = startColIndex + colOffset;
        if (targetColIndex < 2) {
          if (!newRows[targetRowIndex]) {
            newRows[targetRowIndex] = ['', ''];
          }
          newRows[targetRowIndex][targetColIndex] = cellValue;
        }
      });
    });

    setRows(newRows);
  };

  const handleAddDataClick = async (rowIndex: number) => {
    setSelectedRowIndex(rowIndex);
    // Load existing training data for this rule
    const existing = await getExistingTrainingData(rowIndex);
    setExistingTrainingData(existing);
    setIsTrainingDataModalOpen(true);
  };

  const getExistingTrainingData = async (rowIndex: number): Promise<any> => {
    if (!heuristicsItem) return null;
    
    try {
      const item = await apiService.getHeuristicItem(heuristicsItem.id);
      let detailData = (item as any).detailData;
      
      if (typeof detailData === 'string') {
        try {
          detailData = JSON.parse(detailData);
        } catch (e) {
          console.error('Error parsing detailData when loading training data:', e);
          return null;
        }
      }

      console.log('Loading training data for rule:', rowIndex, 'detailData:', detailData);
      if (detailData && typeof detailData === 'object' && detailData.trainingData) {
        const trainingData = detailData.trainingData[`rule_${rowIndex}`];
        console.log('Found training data:', trainingData);
        return trainingData || null;
      }
      
      console.log('No training data found');
      return null;
    } catch (err) {
      console.error('Error loading training data:', err);
      return null;
    }
  };

  const handleSaveTrainingData = async (trainingData: any) => {
    if (!heuristicsItem || selectedRowIndex === null) return;

    try {
      console.log('Saving training data for rule:', selectedRowIndex, trainingData);
      // Get existing detailData
      const item = await apiService.getHeuristicItem(heuristicsItem.id);
      let detailData = (item as any).detailData;
      
      if (typeof detailData === 'string') {
        try {
          detailData = JSON.parse(detailData);
        } catch (e) {
          console.error('Error parsing detailData:', e);
          detailData = { columns: columnNames, rows: rows, trainingData: {} };
        }
      }

      if (!detailData || typeof detailData !== 'object') {
        detailData = { columns: [columnNames[0] || '', 'If'], rows: rows, trainingData: {} };
      }

      // Ensure columns are correct (second column is always "If")
      detailData.columns = [columnNames[0] || '', 'If'];

      // Initialize trainingData if it doesn't exist
      if (!detailData.trainingData) {
        detailData.trainingData = {};
      }

      // Store training data for this rule (row index)
      // Key format: "rule_{rowIndex}" to make it clear it's training data for a specific rule
      detailData.trainingData[`rule_${selectedRowIndex}`] = trainingData;
      console.log('Updated detailData with training data:', detailData);

      // Save updated detailData to backend
      const result = await apiService.updateHeuristicItem(heuristicsItem.id, {
        detailData: JSON.stringify(detailData)
      });
      console.log('Save result:', result);

      // Refresh
      await loadHeuristicsDetail();
    } catch (err) {
      console.error('Error saving training data:', err);
      throw new Error(err instanceof Error ? err.message : 'Failed to save training data');
    }
  };

  const handleSave = async () => {
    if (!heuristicsItem) return;

    setIsSaving(true);
    setError(null);

    try {
      if (is_hero) {
        // RCPO agent: require detailData (can be empty structure)
        const item = await apiService.getHeuristicItem(heuristicsItem.id);
        let existingDetailData = (item as any).detailData;
        if (typeof existingDetailData === 'string') {
          try {
            existingDetailData = JSON.parse(existingDetailData);
          } catch (e) {
            existingDetailData = {};
          }
        }
        if (!existingDetailData || typeof existingDetailData !== 'object') {
          existingDetailData = {};
        }
        const nonEmptyRows = rows.filter(row => row.some(cell => cell.trim() !== ''));
        const detailData: any = {
          columns: [columnNames[0] || '', 'If'],
          rows: nonEmptyRows
        };
        if (existingDetailData.trainingData) {
          detailData.trainingData = existingDetailData.trainingData;
        }
        const rowCount = nonEmptyRows.length.toString();
        await apiService.updateHeuristicItem(heuristicsItem.id, {
          sector,
          domain,
          country,
          agent,
          procedure,
          rules: rowCount,
          detailData: JSON.stringify(detailData),
          is_hero: true,
        });
      } else {
        // Non-RCPO: require non-empty documentation
        const docTrimmed = (documentation ?? '').trim();
        if (!docTrimmed) {
          setError('Documentation is required when Is HERO is FALSE.');
          setIsSaving(false);
          return;
        }
        await apiService.updateHeuristicItem(heuristicsItem.id, {
          sector,
          domain,
          country,
          agent,
          procedure,
          is_hero: false,
          documentation: documentation,
        });
      }
      onSave();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save heuristics detail');
    } finally {
      setIsSaving(false);
    }
  };

  // Get populated rows (rows that have data in either column)
  const getPopulatedRows = (): number[] => {
    return rows
      .map((row, index) => ({ row, index }))
      .filter(({ row }) => row[0]?.trim() || row[1]?.trim())
      .map(({ index }) => index);
  };

  if (!heuristicsItem) return null;

  return (
    <div className="bg-ag-dark-surface border-l border-ag-dark-border h-full flex flex-col overflow-hidden">
      {/* Header */}
      <div className="px-6 py-4 border-b border-ag-dark-border flex-shrink-0">
        <h3 className="text-lg font-semibold text-ag-dark-text mb-4">Heuristics Detail</h3>
        
        {/* Sector, Domain, Country - Side by side */}
        <div className="grid grid-cols-3 gap-4 mb-4">
          <div>
            <label className="block text-xs text-ag-dark-text-secondary mb-1">
              Sector
            </label>
            <select
              value={sector}
              onChange={(e) => setSector(e.target.value)}
              disabled={isSaving || driversLoading}
              className="w-full px-3 py-2 bg-ag-dark-bg border border-ag-dark-border rounded text-sm text-ag-dark-text focus:ring-2 focus:ring-ag-dark-accent focus:border-ag-dark-accent disabled:opacity-50"
            >
              {sectorOptions.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs text-ag-dark-text-secondary mb-1">
              Domain
            </label>
            <select
              value={domain}
              onChange={(e) => setDomain(e.target.value)}
              disabled={isSaving || driversLoading}
              className="w-full px-3 py-2 bg-ag-dark-bg border border-ag-dark-border rounded text-sm text-ag-dark-text focus:ring-2 focus:ring-ag-dark-accent focus:border-ag-dark-accent disabled:opacity-50"
            >
              {domainOptions.map((d) => (
                <option key={d} value={d}>
                  {d}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs text-ag-dark-text-secondary mb-1">
              Country
            </label>
            <select
              value={country}
              onChange={(e) => setCountry(e.target.value)}
              disabled={isSaving || driversLoading}
              className="w-full px-3 py-2 bg-ag-dark-bg border border-ag-dark-border rounded text-sm text-ag-dark-text focus:ring-2 focus:ring-ag-dark-accent focus:border-ag-dark-accent disabled:opacity-50"
            >
              {countryOptions.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Agent and Procedure - plain text so agent name can be typed/edited */}
        <div className="space-y-4">
          <div>
            <label className="block text-xs text-ag-dark-text-secondary mb-1">
              Agent
            </label>
            <input
              type="text"
              value={agent}
              onChange={(e) => setAgent(e.target.value)}
              placeholder="Enter agent name"
              disabled={isSaving}
              className="w-full px-3 py-2 bg-ag-dark-bg border border-ag-dark-border rounded text-sm text-ag-dark-text placeholder-ag-dark-text-secondary focus:ring-2 focus:ring-ag-dark-accent focus:border-ag-dark-accent disabled:opacity-50"
            />
          </div>
          <div>
            <label className="block text-xs text-ag-dark-text-secondary mb-1">
              Procedure
            </label>
            <input
              type="text"
              value={procedure}
              onChange={(e) => setProcedure(e.target.value)}
              placeholder="Enter procedure name"
              disabled={isSaving}
              className="w-full px-3 py-2 bg-ag-dark-bg border border-ag-dark-border rounded text-sm text-ag-dark-text placeholder-ag-dark-text-secondary focus:ring-2 focus:ring-ag-dark-accent focus:border-ag-dark-accent disabled:opacity-50"
            />
          </div>
          {/* Is HERO - Toggle */}
          <div>
            <label className="block text-xs text-ag-dark-text-secondary mb-1">
              Is HERO
            </label>
            <div className="flex items-center">
              <button
                type="button"
                role="switch"
                aria-checked={is_hero}
                onClick={() => setIsHero(!is_hero)}
                disabled={isSaving}
                className={`relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer items-center rounded-full border-2 border-transparent transition-colors focus:outline-none focus:ring-2 focus:ring-ag-dark-accent focus:ring-offset-2 focus:ring-offset-ag-dark-surface disabled:opacity-50 ${
                  is_hero ? 'bg-ag-dark-accent' : 'bg-ag-dark-border'
                }`}
              >
                <span
                  className={`pointer-events-none block h-5 w-5 shrink-0 rounded-full bg-white shadow ring-0 transition ${
                    is_hero ? 'translate-x-5' : 'translate-x-1'
                  }`}
                />
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Content - Scrollable (flex column when documentation so textarea can fill) */}
      <div className={`flex-1 px-6 py-4 pb-6 min-h-0 flex flex-col ${!is_hero && !isLoading ? 'overflow-hidden' : 'overflow-y-auto'}`}>
        {isLoading ? (
          <div className="flex items-center justify-center h-64">
            <div className="text-ag-dark-text-secondary">Loading...</div>
          </div>
        ) : is_hero ? (
          <>
            {/* Instructional Text */}
            <div className="mb-4 p-4 bg-ag-dark-bg border border-ag-dark-border rounded">
              <p className="text-sm text-ag-dark-text-secondary">
                <span className="font-medium text-ag-dark-text">First column (Then):</span> Header is the exact variable name being set. Values are what that variable is set to.
              </p>
              <p className="text-sm text-ag-dark-text-secondary mt-2">
                <span className="font-medium text-ag-dark-text">Second column (If):</span> Contains the condition statements that trigger the rule.
              </p>
            </div>

            {/* Column Headers */}
            <div className="mb-4">
              <div className="flex items-center justify-between mb-2">
                <label className="block text-sm font-medium text-ag-dark-text">
                  Column Names <span className="text-ag-dark-error">*</span>
                </label>
                <button
                  onClick={handleAddRow}
                  disabled={isSaving}
                  className="px-3 py-1 text-sm bg-ag-dark-accent text-white rounded hover:bg-ag-dark-accent-hover transition-colors disabled:opacity-50"
                >
                  + Add Row
                </button>
              </div>
              <div className="grid gap-4" style={{ gridTemplateColumns: 'repeat(2, 1fr)' }}>
                <div>
                  <label className="block text-xs text-ag-dark-text-secondary mb-1">
                    Then (Variable to Set)
                  </label>
                  <input
                    type="text"
                    value={columnNames[0] || ''}
                    onChange={(e) => handleColumnNameChange(0, e.target.value)}
                    placeholder="Enter variable name"
                    disabled={isSaving}
                    className="w-full px-3 py-2 bg-ag-dark-bg border border-ag-dark-border rounded text-ag-dark-text placeholder-ag-dark-text-secondary focus:ring-2 focus:ring-ag-dark-accent focus:border-ag-dark-accent"
                  />
                </div>
                <div>
                  <label className="block text-xs text-ag-dark-text-secondary mb-1">
                    If (Condition)
                  </label>
                  <input
                    type="text"
                    value="If"
                    readOnly
                    disabled
                    className="w-full px-3 py-2 bg-ag-dark-bg border border-ag-dark-border rounded text-ag-dark-text opacity-90 cursor-not-allowed"
                  />
                </div>
              </div>
            </div>

            {/* Data Rows */}
            <div className="mb-4">
              <div className="border border-ag-dark-border rounded overflow-hidden">
                {/* Header Row */}
                <div 
                  className="grid gap-2 p-2 bg-ag-dark-bg border-b border-ag-dark-border font-medium text-sm text-ag-dark-text"
                  style={{ gridTemplateColumns: '40px 1.2fr 1.8fr 60px' }}
                >
                  <div className="text-center">#</div>
                  <div className="px-2">
                    {columnNames[0] || 'Column 1 (Then)'}
                  </div>
                  <div className="px-2">
                    {columnNames[1] || 'If'}
                  </div>
                  <div className="px-2 text-center">Data</div>
                </div>

                {/* Data Rows */}
                <div className="max-h-[500px] overflow-y-auto">
                  {rows.map((row, rowIndex) => (
                    <div
                      key={rowIndex}
                      className="grid gap-2 p-2 border-b border-ag-dark-border hover:bg-ag-dark-bg/50"
                      style={{ gridTemplateColumns: '40px 1.2fr 1.8fr 60px' }}
                    >
                      <div className="flex items-center justify-center text-sm text-ag-dark-text-secondary">
                        {rowIndex + 1}
                      </div>
                      <input
                        type="text"
                        value={row[0] || ''}
                        onChange={(e) => handleCellChange(rowIndex, 0, e.target.value)}
                        onPaste={(e) => handlePaste(e, rowIndex, 0)}
                        disabled={isSaving}
                        className="px-2 py-1 bg-ag-dark-surface border border-ag-dark-border rounded text-sm text-ag-dark-text focus:ring-2 focus:ring-ag-dark-accent focus:border-ag-dark-accent"
                        placeholder={`Enter ${columnNames[0] || 'column 1'} value`}
                      />
                      <input
                        type="text"
                        value={row[1] || ''}
                        onChange={(e) => handleCellChange(rowIndex, 1, e.target.value)}
                        onPaste={(e) => handlePaste(e, rowIndex, 1)}
                        disabled={isSaving}
                        className="px-2 py-1 bg-ag-dark-surface border border-ag-dark-border rounded text-sm text-ag-dark-text focus:ring-2 focus:ring-ag-dark-accent focus:border-ag-dark-accent"
                        placeholder={`Enter ${columnNames[1] || 'column 2'} value`}
                      />
                      <div className="flex items-center justify-center">
                        <button
                          type="button"
                          onClick={() => handleAddDataClick(rowIndex)}
                          disabled={isSaving || !row[0]?.trim()}
                          className="w-6 h-6 flex items-center justify-center bg-ag-dark-accent text-white rounded hover:bg-ag-dark-accent-hover transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                          title="Add training data"
                        >
                          <Plus className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Error Message */}
            {error && (
              <div className="mb-4 p-3 bg-red-900 bg-opacity-20 border border-red-500 rounded text-red-400 text-sm">
                {error}
              </div>
            )}
          </>
        ) : (
          /* Non-RCPO: documentation textarea extends to bottom, scroll inside */
          <div className="flex flex-col flex-1 min-h-0 overflow-hidden">
            <label className="block text-sm font-medium text-ag-dark-text mb-2 flex-shrink-0">
              Documentation
            </label>
            <textarea
              value={documentation}
              onChange={(e) => setDocumentation(e.target.value)}
              placeholder="Enter documentation (prompts, scripts, or procedural notes)..."
              disabled={isSaving}
              className="w-full flex-1 min-h-0 px-3 py-2 bg-ag-dark-bg border border-ag-dark-border rounded text-sm text-ag-dark-text placeholder-ag-dark-text-secondary focus:ring-2 focus:ring-ag-dark-accent focus:border-ag-dark-accent disabled:opacity-50 resize-none overflow-y-auto"
            />
            {error && (
              <div className="mt-4 p-3 bg-red-900 bg-opacity-20 border border-red-500 rounded text-red-400 text-sm flex-shrink-0">
                {error}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Footer - Fixed at bottom */}
      <div className="px-6 py-4 border-t border-ag-dark-border flex-shrink-0 bg-ag-dark-surface">
        <button
          onClick={handleSave}
          disabled={isSaving || isLoading}
          className="w-full bg-ag-dark-accent text-white py-2 px-4 rounded hover:bg-ag-dark-accent-hover transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
        >
          <Save className="w-4 h-4" />
          {isSaving ? 'Saving...' : 'Save Changes'}
        </button>
      </div>

      {/* Training Data Modal */}
      {selectedRowIndex !== null && (
        <HeuristicsTrainingDataModal
          isOpen={isTrainingDataModalOpen}
          onClose={() => {
            setIsTrainingDataModalOpen(false);
            setSelectedRowIndex(null);
            setExistingTrainingData(null);
          }}
          onSave={handleSaveTrainingData}
          thenColumnName={columnNames[0] || 'Then'}
          thenColumnValue={rows[selectedRowIndex]?.[0] || ''}
          ifColumnValue={rows[selectedRowIndex]?.[1] || ''}
          ruleNumber={selectedRowIndex + 1}
          populatedRows={getPopulatedRows()}
          existingTrainingData={existingTrainingData}
        />
      )}
    </div>
  );
};

