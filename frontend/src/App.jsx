import { useState, useEffect } from 'react'
import { ArrowPathIcon, TrashIcon, UserCircleIcon } from '@heroicons/react/24/outline'
import { DropZone } from './components/DropZone'
import { Stats } from './components/Stats'
import { Tabs } from './components/Tabs'
import { TermineList } from './components/TermineList'
import { MergedView } from './components/MergedView'
import { DataTable, HU_COLUMNS, INSP_COLUMNS, SERVICE_COLUMNS } from './components/DataTable'
import { FaelligkeitenList } from './components/FaelligkeitenList'
import { ArchivList } from './components/ArchivList'

const API_URL = '/api'

function App() {
  const [data, setData] = useState({ hu: [], inspektion: [], service: [], merged: {} })
  const [termine, setTermine] = useState([])
  const [faelligkeiten, setFaelligkeiten] = useState([])
  const [activeTab, setActiveTab] = useState('faelligkeiten')
  const [loading, setLoading] = useState(false)
  const [currentUser, setCurrentUser] = useState(() => localStorage.getItem('currentUser') || '')
  const [showUserMenu, setShowUserMenu] = useState(false)

  const users = ['Stefan', 'Admin', 'Service']
  
  const handleUserChange = (user) => {
    setCurrentUser(user)
    localStorage.setItem('currentUser', user)
    setShowUserMenu(false)
  }

  const fetchData = async () => {
    try {
      const [dataRes, termineRes, faelligkeitenRes] = await Promise.all([
        fetch(`${API_URL}/data`),
        fetch(`${API_URL}/termine`),
        fetch(`${API_URL}/db/faelligkeiten`)  // Aus DB laden für Multi-User
      ])
      const dataJson = await dataRes.json()
      const termineJson = await termineRes.json()
      const faelligkeitenJson = await faelligkeitenRes.json()
      setData(dataJson)
      setTermine(termineJson)
      setFaelligkeiten(faelligkeitenJson)
    } catch (err) {
      console.error('Fetch error:', err)
    }
  }

  const loadExisting = async () => {
    setLoading(true)
    try {
      // Nur DB-Daten neu laden (keine PDFs parsen)
      await fetchData()
    } catch (err) {
      console.error('Load error:', err)
    }
    setLoading(false)
  }

  const handleUpload = async (file) => {
    setLoading(true)
    const formData = new FormData()
    formData.append('file', file)

    try {
      const res = await fetch(`${API_URL}/upload`, {
        method: 'POST',
        body: formData
      })
      const json = await res.json()
      if (json.success) {
        await fetchData()
        setLoading(false)
        return json
      }
    } catch (err) {
      console.error('Upload error:', err)
    }
    setLoading(false)
    return null
  }

  const handleReset = async () => {
    if (!confirm('Wirklich alle Daten löschen? (Speicher + Datenbank)')) return
    await fetch(`${API_URL}/reset`, { method: 'POST' })
    await fetch(`${API_URL}/db/reset`, { method: 'POST' })
    setData({ hu: [], inspektion: [], service: [], merged: {} })
    setTermine([])
    setFaelligkeiten([])
    setArchivCount(0)
  }

  useEffect(() => {
    fetchData()
  }, [])

  const mergedArray = Object.values(data.merged)
  const [archivCount, setArchivCount] = useState(0)

  useEffect(() => {
    fetch('/api/db/fahrzeug-status')
      .then(res => res.json())
      .then(statusList => {
        const ausgetragen = statusList.filter(s => s.ausgetragen).length
        const wiedervorlage = statusList.filter(s => s.wiedervorlage_datum && !s.ausgetragen).length
        setArchivCount(ausgetragen + wiedervorlage)
      })
      .catch(() => {})
  }, [faelligkeiten])

  const counts = {
    hu: data.hu.length,
    inspektion: data.inspektion.length,
    service: data.service.length,
    merged: mergedArray.length,
    archiv: archivCount
  }

  return (
    <div className="min-h-screen bg-white">
      {/* Clean Header */}
      <header className="sticky top-0 z-50 bg-white border-b border-gray-100">
        <div className="max-w-7xl mx-auto px-6 h-14 flex items-center justify-between">
          <h1 className="text-lg font-semibold text-gray-900 tracking-tight">
            Fahrzeug Inspector
          </h1>
          <div className="flex items-center gap-3">
            {/* User Selector */}
            <div className="relative">
              <button
                onClick={() => setShowUserMenu(!showUserMenu)}
                className="flex items-center gap-2 px-3 py-1.5 text-sm text-gray-600 hover:bg-gray-100 rounded-md transition-colors"
              >
                <UserCircleIcon className="w-5 h-5" />
                <span>{currentUser || 'Benutzer wählen'}</span>
              </button>
              {showUserMenu && (
                <div className="absolute right-0 top-10 bg-white border border-gray-200 rounded-lg shadow-lg z-50 py-1 min-w-[140px]">
                  {users.map(user => (
                    <button
                      key={user}
                      onClick={() => handleUserChange(user)}
                      className={`w-full px-3 py-2 text-left text-sm hover:bg-gray-50 ${currentUser === user ? 'bg-gray-100 font-medium' : ''}`}
                    >
                      {user}
                    </button>
                  ))}
                </div>
              )}
            </div>
            <button
              onClick={loadExisting}
              disabled={loading}
              className="inline-flex items-center gap-2 px-3 py-1.5 text-sm font-medium text-white bg-gray-900 rounded-md hover:bg-gray-800 transition-colors disabled:opacity-50"
            >
              <ArrowPathIcon className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
              Laden
            </button>
            <button
              onClick={handleReset}
              className="inline-flex items-center gap-2 px-3 py-1.5 text-sm font-medium text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-md transition-colors"
            >
              <TrashIcon className="w-4 h-4" />
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-6 py-6">
        {/* Stats - Minimal */}
        <div className="mb-6 flex items-center justify-between">
          <Stats data={data} />
          <DropZone onUpload={handleUpload} loading={loading} />
        </div>

        {/* Main Content */}
        <div className="bg-white border border-gray-200 rounded-lg">
          <Tabs activeTab={activeTab} setActiveTab={setActiveTab} counts={counts} />

          <div className="p-6">
            {activeTab === 'faelligkeiten' && <FaelligkeitenList data={faelligkeiten} onRefresh={fetchData} currentUser={currentUser} />}
            {activeTab === 'archiv' && <ArchivList currentUser={currentUser} />}
            {activeTab === 'termine' && <TermineList termine={termine} />}
            {activeTab === 'merged' && <MergedView data={mergedArray} />}
            {activeTab === 'hu' && (
              <DataTable data={data.hu} columns={HU_COLUMNS} emptyMessage="Keine HU-Daten geladen." />
            )}
            {activeTab === 'inspektion' && (
              <DataTable data={data.inspektion} columns={INSP_COLUMNS} emptyMessage="Keine Inspektions-Daten geladen." />
            )}
            {activeTab === 'service' && (
              <DataTable data={data.service} columns={SERVICE_COLUMNS} emptyMessage="Keine Service-Daten geladen." />
            )}
          </div>
        </div>
      </main>
    </div>
  )
}

export default App
