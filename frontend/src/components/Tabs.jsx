export function Tabs({ activeTab, setActiveTab, counts }) {
  const tabs = [
    { id: 'faelligkeiten', label: 'Fälligkeiten' },
    { id: 'archiv', label: 'Archiv', count: counts.archiv },
    { id: 'merged', label: 'Fahrzeuge', count: counts.merged },
    { id: 'hu', label: 'HU', count: counts.hu },
    { id: 'inspektion', label: 'Inspektion', count: counts.inspektion },
    { id: 'service', label: 'Service', count: counts.service },
  ]

  return (
    <div className="border-b border-gray-200 px-6">
      <nav className="flex gap-6 -mb-px">
        {tabs.map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`py-3 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${
              activeTab === tab.id
                ? 'border-gray-900 text-gray-900'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            {tab.label}
            {tab.count !== null && tab.count > 0 && (
              <span className="ml-2 text-xs text-gray-400">
                {tab.count}
              </span>
            )}
          </button>
        ))}
      </nav>
    </div>
  )
}
