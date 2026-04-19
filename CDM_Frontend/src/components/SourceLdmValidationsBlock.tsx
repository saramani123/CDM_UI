import React from 'react';
import { Plus, Trash2, Settings } from 'lucide-react';
import {
  buildValidationString,
  validateValidationInput,
  getOperatorsForValType,
  RANGE_GREATER_OPERATORS,
  RANGE_LESS_OPERATORS,
  type ValidationComponents,
  type ValType,
  type Operator,
  type RangeOperator,
} from '../utils/validationUtils';

const selectStyle: React.CSSProperties = {
  backgroundImage: `url("data:image/svg+xml,%3csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 20 20'%3e%3cpath stroke='%236b7280' stroke-linecap='round' stroke-linejoin='round' stroke-width='1.5' d='m6 8 4 4 4-4'/%3e%3c/svg%3e")`,
  backgroundPosition: 'right 12px center',
  backgroundRepeat: 'no-repeat',
  backgroundSize: '16px',
};

export function validateSourceLdmValidationList(
  validationComponentsList: ValidationComponents[],
  formatVi: string,
  formatVii: string,
  setValidationError: (s: string) => void
): boolean {
  const fi = formatVi.trim() || undefined;
  const fii = formatVii.trim() || undefined;
  for (let i = 0; i < validationComponentsList.length; i++) {
    const comp = validationComponentsList[i];
    if (!comp.valType) continue;
    if (comp.valType === 'Range') {
      const gOp = comp.greaterThanOperator === '>' || comp.greaterThanOperator === '>=';
      const lOp = comp.lessThanOperator === '<' || comp.lessThanOperator === '<=';
      const gVal = (comp.greaterThanValue ?? '').trim();
      const lVal = (comp.lessThanValue ?? '').trim();
      if (!gOp || !gVal) {
        alert(`Please select Greater than Operator and enter Greater than Value for Validation #${i + 1} (Range).`);
        setValidationError('Greater than Operator and Value are required');
        return false;
      }
      if (!lOp || !lVal) {
        alert(`Please select Less than Operator and enter Less than Value for Validation #${i + 1} (Range).`);
        setValidationError('Less than Operator and Value are required');
        return false;
      }
      const vg = validateValidationInput('Range', gVal, fi, fii);
      if (!vg.isValid) {
        alert(`Invalid Greater than Value for Validation #${i + 1}: ${vg.error}`);
        setValidationError(vg.error || 'Invalid value');
        return false;
      }
      const vl = validateValidationInput('Range', lVal, fi, fii);
      if (!vl.isValid) {
        alert(`Invalid Less than Value for Validation #${i + 1}: ${vl.error}`);
        setValidationError(vl.error || 'Invalid value');
        return false;
      }
    } else {
      const requiresOperator = ['Relative', 'Length'].includes(comp.valType);
      if (requiresOperator && !comp.operator) {
        alert(`Please select an operator for Validation #${i + 1} (${comp.valType}).`);
        setValidationError('Operator is required');
        return false;
      }
      const requiresValue = ['Length', 'Character', 'Relative'].includes(comp.valType);
      if (requiresValue && !(comp.value ?? '').trim()) {
        alert(`Please enter or select a value for Validation #${i + 1} (${comp.valType}).`);
        setValidationError('Value is required');
        return false;
      }
      if (comp.valType === 'Length' && comp.value.trim()) {
        const v = validateValidationInput('Length', comp.value);
        if (!v.isValid) {
          alert(`Invalid value for Validation #${i + 1}: ${v.error}`);
          setValidationError(v.error || 'Invalid value');
          return false;
        }
      }
      if (comp.valType === 'Character' && comp.value.trim()) {
        const v = validateValidationInput('Character', comp.value);
        if (!v.isValid) {
          alert(`Invalid value for Validation #${i + 1}: ${v.error}`);
          setValidationError(v.error || 'Invalid value');
          return false;
        }
      }
    }
  }
  setValidationError('');
  return true;
}

export interface SourceLdmValidationsBlockProps {
  formatVi: string;
  formatVii: string;
  validationComponentsList: ValidationComponents[];
  setValidationComponentsList: React.Dispatch<React.SetStateAction<ValidationComponents[]>>;
  validationError: string;
  setValidationError: (s: string) => void;
  relativeVariableOptions: string[];
  inputCls: string;
  selectCls: string;
}

export const SourceLdmValidationsBlock: React.FC<SourceLdmValidationsBlockProps> = ({
  formatVi,
  formatVii,
  validationComponentsList,
  setValidationComponentsList,
  validationError,
  setValidationError,
  relativeVariableOptions,
  inputCls,
  selectCls,
}) => {
  return (
    <div className="border border-ag-dark-border rounded-lg p-4 space-y-4 bg-ag-dark-bg/40">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-sm font-semibold text-ag-dark-text">
          <Settings className="w-4 h-4 text-ag-dark-text-secondary" />
          Validations
        </div>
        <button
          type="button"
          onClick={() =>
            setValidationComponentsList((prev) => [...prev, { valType: '', operator: '', value: '' }])
          }
          className="p-1.5 text-ag-dark-accent hover:text-ag-dark-accent-light transition-colors rounded hover:bg-ag-dark-bg"
          title="Add another validation"
        >
          <Plus className="w-5 h-5" />
        </button>
      </div>

      <div className="space-y-6">
        {validationComponentsList.map((validationComponents, index) => (
          <div key={index} className="space-y-4 border-b border-ag-dark-border pb-4 last:border-b-0 last:pb-0">
            <div className="flex items-center justify-between mb-1">
              <h4 className="text-sm font-semibold text-ag-dark-text">Validation #{index + 1}</h4>
              <button
                type="button"
                onClick={() => {
                  setValidationComponentsList((prev) => {
                    const next = prev.filter((_, i) => i !== index);
                    return next.length > 0 ? next : [{ valType: '', operator: '', value: '' }];
                  });
                  setValidationError('');
                }}
                className="p-1.5 text-red-400 hover:text-red-300 hover:bg-red-400/10 rounded transition-colors"
                title="Remove this validation"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
            <div>
              <label className="block text-sm font-medium text-ag-dark-text mb-2">Val Type</label>
              <select
                value={validationComponents.valType}
                onChange={(e) => {
                  const newValType = e.target.value as ValType | '';
                  const newComponents: ValidationComponents = {
                    valType: newValType,
                    operator: newValType === 'Character' ? 'is' : '',
                    value: '',
                  };
                  if (newValType === 'List') newComponents.value = 'List';
                  else if (newValType === 'Specific') newComponents.value = 'Specific';
                  else if (newValType === 'Range') {
                    newComponents.greaterThanOperator = '';
                    newComponents.greaterThanValue = '';
                    newComponents.lessThanOperator = '';
                    newComponents.lessThanValue = '';
                  }
                  setValidationComponentsList((prev) => prev.map((comp, i) => (i === index ? newComponents : comp)));
                  setValidationError('');
                }}
                className={selectCls}
                style={selectStyle}
              >
                <option value="">Select Val Type</option>
                <option value="List">List</option>
                <option value="Range">Range</option>
                <option value="Relative">Relative</option>
                <option value="Length">Length</option>
                <option value="Character">Character</option>
                <option value="Specific">Specific</option>
              </select>
            </div>
            {validationComponents.valType &&
              validationComponents.valType !== 'Character' &&
              validationComponents.valType !== 'Range' &&
              validationComponents.valType !== 'Specific' &&
              getOperatorsForValType(validationComponents.valType).length > 0 && (
                <div>
                  <label className="block text-sm font-medium text-ag-dark-text mb-2">Operator</label>
                  <select
                    value={validationComponents.operator}
                    onChange={(e) => {
                      setValidationComponentsList((prev) =>
                        prev.map((comp, i) =>
                          i === index ? { ...comp, operator: e.target.value as Operator } : comp
                        )
                      );
                      setValidationError('');
                    }}
                    className={`${selectCls} ${validationError.includes('Operator') ? 'border-red-500' : ''}`}
                    style={selectStyle}
                  >
                    <option value="">Select Operator</option>
                    {getOperatorsForValType(validationComponents.valType).map((op) => (
                      <option key={op} value={op}>
                        {op}
                      </option>
                    ))}
                  </select>
                  {validationError.includes('Operator') && (
                    <p className="mt-1 text-sm text-red-500">{validationError}</p>
                  )}
                </div>
              )}
            {validationComponents.valType === 'Character' && (
              <div>
                <label className="block text-sm font-medium text-ag-dark-text mb-2">Operator</label>
                <input
                  type="text"
                  value="is"
                  disabled
                  className="w-full px-3 py-2 bg-ag-dark-bg border border-ag-dark-border rounded text-ag-dark-text opacity-50 cursor-not-allowed text-sm"
                />
              </div>
            )}
            {validationComponents.valType === 'Range' && (
              <>
                <div>
                  <label className="block text-sm font-medium text-ag-dark-text mb-2">Greater than Operator</label>
                  <select
                    value={validationComponents.greaterThanOperator ?? ''}
                    onChange={(e) => {
                      setValidationComponentsList((prev) =>
                        prev.map((comp, i) =>
                          i === index ? { ...comp, greaterThanOperator: e.target.value as RangeOperator | '' } : comp
                        )
                      );
                      setValidationError('');
                    }}
                    className={selectCls}
                    style={selectStyle}
                  >
                    <option value="">Select</option>
                    {RANGE_GREATER_OPERATORS.map((op) => (
                      <option key={op} value={op}>
                        {op}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-ag-dark-text mb-2">Greater than Value</label>
                  <input
                    type="text"
                    value={validationComponents.greaterThanValue ?? ''}
                    onInput={(e) => {
                      const v = (e.target as HTMLInputElement).value;
                      const res = validateValidationInput('Range', v, formatVi.trim() || undefined, formatVii.trim() || undefined);
                      setValidationError(res.isValid ? '' : res.error || '');
                      setValidationComponentsList((prev) =>
                        prev.map((comp, i) => (i === index ? { ...comp, greaterThanValue: v } : comp))
                      );
                    }}
                    placeholder={formatVi === 'Date' || formatVi === 'Time' ? 'e.g. 12/5/2025' : 'Enter value'}
                    className={`w-full px-3 py-2 bg-ag-dark-bg border rounded text-sm text-ag-dark-text focus:ring-2 focus:ring-ag-dark-accent ${
                      validationError.includes('Value') ? 'border-red-500' : 'border-ag-dark-border'
                    }`}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-ag-dark-text mb-2">Less than Operator</label>
                  <select
                    value={validationComponents.lessThanOperator ?? ''}
                    onChange={(e) => {
                      setValidationComponentsList((prev) =>
                        prev.map((comp, i) =>
                          i === index ? { ...comp, lessThanOperator: e.target.value as RangeOperator | '' } : comp
                        )
                      );
                      setValidationError('');
                    }}
                    className={selectCls}
                    style={selectStyle}
                  >
                    <option value="">Select</option>
                    {RANGE_LESS_OPERATORS.map((op) => (
                      <option key={op} value={op}>
                        {op}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-ag-dark-text mb-2">Less than Value</label>
                  <input
                    type="text"
                    value={validationComponents.lessThanValue ?? ''}
                    onInput={(e) => {
                      const v = (e.target as HTMLInputElement).value;
                      const res = validateValidationInput('Range', v, formatVi.trim() || undefined, formatVii.trim() || undefined);
                      setValidationError(res.isValid ? '' : res.error || '');
                      setValidationComponentsList((prev) =>
                        prev.map((comp, i) => (i === index ? { ...comp, lessThanValue: v } : comp))
                      );
                    }}
                    placeholder={formatVi === 'Date' || formatVi === 'Time' ? 'e.g. 3/8/2026' : 'Enter value'}
                    className={`w-full px-3 py-2 bg-ag-dark-bg border rounded text-sm text-ag-dark-text focus:ring-2 focus:ring-ag-dark-accent ${
                      validationError.includes('Value') ? 'border-red-500' : 'border-ag-dark-border'
                    }`}
                  />
                </div>
              </>
            )}
            {validationComponents.valType && validationComponents.valType !== 'Range' && (
              <div>
                <label className="block text-sm font-medium text-ag-dark-text mb-2">Value</label>
                {validationComponents.valType === 'List' || validationComponents.valType === 'Specific' ? (
                  <input
                    type="text"
                    value={validationComponents.value}
                    disabled
                    className="w-full px-3 py-2 bg-ag-dark-bg border border-ag-dark-border rounded text-sm text-ag-dark-text opacity-50 cursor-not-allowed"
                  />
                ) : validationComponents.valType === 'Relative' ? (
                  <select
                    value={validationComponents.value}
                    onChange={(e) => {
                      setValidationComponentsList((prev) =>
                        prev.map((comp, i) => (i === index ? { ...comp, value: e.target.value } : comp))
                      );
                      setValidationError('');
                    }}
                    className={selectCls}
                    style={selectStyle}
                  >
                    <option value="">Select variable</option>
                    {relativeVariableOptions.map((name) => (
                      <option key={name} value={name}>
                        {name}
                      </option>
                    ))}
                  </select>
                ) : validationComponents.valType === 'Length' ? (
                  <input
                    type="text"
                    value={validationComponents.value}
                    onChange={(e) => {
                      const v = e.target.value;
                      const res = validateValidationInput('Length', v);
                      setValidationError(res.isValid ? '' : res.error || '');
                      setValidationComponentsList((prev) =>
                        prev.map((comp, i) => (i === index ? { ...comp, value: v } : comp))
                      );
                    }}
                    placeholder="Enter integer"
                    className={`w-full px-3 py-2 bg-ag-dark-bg border rounded text-sm text-ag-dark-text focus:ring-2 focus:ring-ag-dark-accent ${
                      validationError ? 'border-red-500' : 'border-ag-dark-border'
                    }`}
                  />
                ) : validationComponents.valType === 'Character' ? (
                  <input
                    type="text"
                    value={validationComponents.value}
                    onChange={(e) => {
                      const v = e.target.value;
                      const res = validateValidationInput('Character', v);
                      setValidationError(res.isValid ? '' : res.error || '');
                      setValidationComponentsList((prev) =>
                        prev.map((comp, i) => (i === index ? { ...comp, value: v } : comp))
                      );
                    }}
                    placeholder="Alpha, Numeric, AlphaNumeric"
                    className={`w-full px-3 py-2 bg-ag-dark-bg border rounded text-sm text-ag-dark-text focus:ring-2 focus:ring-ag-dark-accent ${
                      validationError ? 'border-red-500' : 'border-ag-dark-border'
                    }`}
                  />
                ) : null}
                {(validationComponents.valType === 'Length' || validationComponents.valType === 'Character') &&
                  validationError &&
                  !validationError.includes('Operator') && (
                    <p className="mt-1 text-sm text-red-500">{validationError}</p>
                  )}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
};

export function joinSourceLdmValidationStrings(list: ValidationComponents[]): string {
  const validationStrings = list.filter((comp) => comp.valType).map((comp) => buildValidationString(comp));
  return validationStrings.join(', ');
}
