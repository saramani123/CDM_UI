import React from 'react';
import { ArrowDown, Map, X } from 'lucide-react';
import type { SourceCatalogEntry } from '../hooks/useSources';

const DND_TYPE = 'text/plain';

export interface SourceMapPanelProps {
  onClose: () => void;
  sourceSlot: SourceCatalogEntry | null;
  targetSlot: SourceCatalogEntry | null;
  onDropSlot: (slot: 'source' | 'target', sourceId: string) => void;
  onAutoMap: () => void | Promise<void>;
  /** While the Auto Map request is in flight */
  autoMapBusy?: boolean;
  renderDroppedCard: (entry: SourceCatalogEntry) => React.ReactNode;
}

export const SourceMapPanel: React.FC<SourceMapPanelProps> = ({
  onClose,
  sourceSlot,
  targetSlot,
  onDropSlot,
  onAutoMap,
  autoMapBusy = false,
  renderDroppedCard,
}) => {
  const bothFilled = Boolean(sourceSlot && targetSlot);

  const handleDragStart = (e: React.DragEvent, id: string) => {
    e.dataTransfer.setData(DND_TYPE, id);
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleSlotDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
  };

  const handleSlotDrop = (e: React.DragEvent, slot: 'source' | 'target') => {
    e.preventDefault();
    const id = e.dataTransfer.getData(DND_TYPE).trim();
    if (id) onDropSlot(slot, id);
  };

  const slotBlock = (
    slot: 'source' | 'target',
    title: string,
    entry: SourceCatalogEntry | null
  ) => (
    <div className="flex flex-1 min-h-0 flex-col rounded-xl border-2 border-dashed border-ag-dark-border/80 bg-gradient-to-b from-ag-dark-bg/95 to-ag-dark-surface/40 p-4 shadow-inner">
      <h4 className="text-center text-lg font-bold tracking-tight text-ag-dark-text mb-3">{title}</h4>
      <div
        className="flex flex-1 min-h-[168px] flex-col items-center justify-center rounded-lg border border-ag-dark-border/50 bg-ag-dark-surface/60 ring-1 ring-ag-dark-border/20"
        onDragOver={handleSlotDragOver}
        onDrop={(e) => handleSlotDrop(e, slot)}
      >
        {entry ? (
          <div
            draggable
            onDragStart={(e) => handleDragStart(e, entry.id)}
            className="w-full max-w-[220px] cursor-grab active:cursor-grabbing rounded-lg border border-ag-dark-border bg-ag-dark-surface p-3 shadow-md"
          >
            {renderDroppedCard(entry)}
          </div>
        ) : (
          <span className="select-none text-center text-2xl font-semibold tracking-wide text-ag-dark-text-secondary/90 sm:text-3xl">
            Drag + Drop
          </span>
        )}
      </div>
    </div>
  );

  return (
    <div
      className="bg-ag-dark-surface rounded-lg border border-ag-dark-border flex flex-col h-full min-h-0"
      style={{ display: 'flex', flexDirection: 'column', height: '100%' }}
    >
      <div className="flex items-center justify-between flex-shrink-0 p-6 pb-2">
        <div className="flex items-center gap-2 min-w-0">
          <Map className="w-5 h-5 text-ag-dark-text-secondary flex-shrink-0" />
          <h3 className="text-lg font-semibold text-ag-dark-text truncate">Map sources</h3>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="text-ag-dark-text-secondary hover:text-ag-dark-text transition-colors flex-shrink-0"
          aria-label="Close mapping panel"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      <div className="flex-1 min-h-0 flex flex-col gap-2 px-6 pb-4 overflow-y-auto">
        {slotBlock('source', 'Source Schema', sourceSlot)}
        {bothFilled ? (
          <div
            className="flex flex-shrink-0 items-center justify-center py-2"
            aria-hidden
            title="Source → Target"
          >
            <div className="flex flex-col items-center gap-0.5 text-ag-dark-accent">
              <div className="h-6 w-px rounded-full bg-ag-dark-accent/60" />
              <ArrowDown className="h-9 w-9 drop-shadow-[0_0_12px_rgba(59,130,246,0.35)]" strokeWidth={2.75} />
              <div className="h-6 w-px rounded-full bg-ag-dark-accent/60" />
            </div>
          </div>
        ) : (
          <div className="h-2 flex-shrink-0" aria-hidden />
        )}
        {slotBlock('target', 'Target Schema', targetSlot)}
      </div>

      <div className="flex-shrink-0 p-6 pt-2 border-t border-ag-dark-border">
        <button
          type="button"
          disabled={!bothFilled || autoMapBusy}
          onClick={() => void onAutoMap()}
          className={`w-full py-2.5 rounded-lg text-sm font-semibold transition-colors ${
            bothFilled && !autoMapBusy
              ? 'bg-ag-dark-accent text-white hover:bg-ag-dark-accent-hover'
              : 'bg-ag-dark-bg text-ag-dark-text-secondary cursor-not-allowed opacity-60 border border-ag-dark-border'
          }`}
        >
          {autoMapBusy ? 'Building map…' : 'Auto Map'}
        </button>
      </div>
    </div>
  );
};
