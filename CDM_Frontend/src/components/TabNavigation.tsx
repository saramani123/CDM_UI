import React from 'react';

interface Tab {
  id: string;
  label: string;
  count?: number;
}

interface TabNavigationProps {
  tabs: Tab[];
  activeTab: string;
  onTabChange: (tabId: string) => void;
}

export const TabNavigation: React.FC<TabNavigationProps> = ({
  tabs,
  activeTab,
  onTabChange
}) => {
  return (
    <div className="border-b border-ag-dark-border bg-ag-dark-surface -mx-6 px-6">
      <nav className="-mb-px flex space-x-8">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => onTabChange(tab.id)}
            className={`
              py-4 px-1 border-b-2 font-medium text-sm whitespace-nowrap transition-colors
              ${activeTab === tab.id
                ? 'border-ag-dark-accent text-ag-dark-accent'
                : 'border-transparent text-ag-dark-text-secondary hover:text-ag-dark-text hover:border-ag-dark-border'
              }
            `}
          >
            {tab.label}
            {tab.count !== undefined && (
              <span className={`
                ml-2 py-0.5 px-2 rounded-full text-xs
                ${activeTab === tab.id
                  ? 'bg-ag-dark-accent bg-opacity-20 text-ag-dark-accent'
                  : 'bg-ag-dark-border text-ag-dark-text-secondary'
                }
              `}>
                {tab.count}
              </span>
            )}
          </button>
        ))}
      </nav>
    </div>
  );
};