import React, { useState } from 'react';
import { X } from 'lucide-react';
import { useDrivers } from '../hooks/useDrivers';

interface AddSourceCatalogModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCreate: (body: { name: string; sector: string; domain: string; country: string }) => Promise<void>;
}

export const AddSourceCatalogModal: React.FC<AddSourceCatalogModalProps> = ({
  isOpen,
  onClose,
  onCreate,
}) => {
  const { drivers: driversData, loading: driversLoading } = useDrivers();
  const [name, setName] = useState('');
  const [sector, setSector] = useState('ALL');
  const [domain, setDomain] = useState('ALL');
  const [country, setCountry] = useState('ALL');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const sectors = driversData?.sectors || [];
  const domains = driversData?.domains || [];
  const countries = driversData?.countries || [];
  const sectorOptions = ['ALL', ...sectors.filter((s) => s !== 'ALL' && s !== 'All')];
  const domainOptions = ['ALL', ...domains.filter((d) => d !== 'ALL' && d !== 'All')];
  const countryOptions = ['ALL', ...countries.filter((c) => c !== 'ALL' && c !== 'All')];

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = name.trim();
    if (!trimmed) {
      setError('Name is required');
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      await onCreate({
        name: trimmed,
        sector,
        domain,
        country,
      });
      setName('');
      setSector('ALL');
      setDomain('ALL');
      setCountry('ALL');
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create source');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black bg-opacity-60" data-modal="true">
      <div className="bg-ag-dark-surface border border-ag-dark-border rounded-lg w-full max-w-md shadow-xl mx-4">
        <div className="flex items-center justify-between px-6 py-4 border-b border-ag-dark-border">
          <h2 className="text-lg font-semibold text-ag-dark-text">Add Source</h2>
          <button
            type="button"
            onClick={onClose}
            className="text-ag-dark-text-secondary hover:text-ag-dark-text"
            aria-label="Close"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div>
            <label className="block text-sm font-medium text-ag-dark-text mb-2">Source name</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full px-3 py-2 bg-ag-dark-bg border border-ag-dark-border rounded text-sm text-ag-dark-text"
              placeholder="e.g. Acme ERP"
              disabled={submitting}
            />
          </div>
          <div className="grid grid-cols-1 gap-3">
            <div>
              <label className="block text-xs text-ag-dark-text-secondary mb-1">Sector</label>
              <select
                value={sector}
                onChange={(e) => setSector(e.target.value)}
                disabled={submitting || driversLoading}
                className="w-full px-3 py-2 bg-ag-dark-bg border border-ag-dark-border rounded text-sm text-ag-dark-text"
              >
                {sectorOptions.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs text-ag-dark-text-secondary mb-1">Domain</label>
              <select
                value={domain}
                onChange={(e) => setDomain(e.target.value)}
                disabled={submitting || driversLoading}
                className="w-full px-3 py-2 bg-ag-dark-bg border border-ag-dark-border rounded text-sm text-ag-dark-text"
              >
                {domainOptions.map((d) => (
                  <option key={d} value={d}>
                    {d}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs text-ag-dark-text-secondary mb-1">Country</label>
              <select
                value={country}
                onChange={(e) => setCountry(e.target.value)}
                disabled={submitting || driversLoading}
                className="w-full px-3 py-2 bg-ag-dark-bg border border-ag-dark-border rounded text-sm text-ag-dark-text"
              >
                {countryOptions.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </div>
          </div>
          {error && <div className="text-sm text-red-400">{error}</div>}
          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 border border-ag-dark-border rounded text-sm text-ag-dark-text hover:bg-ag-dark-bg"
              disabled={submitting}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-4 py-2 bg-ag-dark-accent text-white rounded text-sm font-medium hover:bg-ag-dark-accent-hover disabled:opacity-50"
              disabled={submitting}
            >
              {submitting ? 'Adding…' : 'Add Source'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
