import { useState, useEffect } from 'react'
import { ArrowPathIcon, TrashIcon, ArrowRightOnRectangleIcon } from '@heroicons/react/24/outline'
import { DropZone } from './components/DropZone'
import { Stats } from './components/Stats'
import { Tabs } from './components/Tabs'
import { TermineList } from './components/TermineList'
import { MergedView } from './components/MergedView'
import { DataTable, HU_COLUMNS, INSP_COLUMNS, SERVICE_COLUMNS } from './components/DataTable'
import { FaelligkeitenList } from './components/FaelligkeitenList'
import { ArchivList } from './components/ArchivList'
import { Login } from './components/Login'

const API_URL = '/api'

function App() {
  const [data, setData] = useState({ hu: [], inspektion: [], service: [], merged: {} })
  const [termine, setTermine] = useState([])
  const [faelligkeiten, setFaelligkeiten] = useState([])
  const [activeTab, setActiveTab] = useState('faelligkeiten')
  const [loading, setLoading] = useState(false)
  
  // Auth State
  const [token, setToken] = useState(() => localStorage.getItem('token'))
  const [user, setUser] = useState(() => {
    const saved = localStorage.getItem('user')
    return saved ? JSON.parse(saved) : null
  })
  const [setupRequired, setSetupRequired] = useState(false)
  const [authChecking, setAuthChecking] = useState(true)

  // Auth check beim Start
  useEffect(() => {
    checkAuth()
  }, [])

  const checkAuth = async () => {
    // Prüfen ob Setup nötig
    try {
      const setupRes = await fetch('/api/auth/setup-required')
      const setupData = await setupRes.json()
      setSetupRequired(setupData.setupRequired)
      
      if (setupData.setupRequired) {
        setAuthChecking(false)
        return
      }
    } catch (err) {
      console.error('Setup check failed:', err)
    }

    // Token verifizieren falls vorhanden
    if (token) {
      try {
        const res = await fetch('/api/auth/verify', {
          headers: { 'Authorization': `Bearer ${token}` }
        })
        if (!res.ok) {
          handleLogout()
        }
      } catch (err) {
        handleLogout()
      }
    }
    setAuthChecking(false)
  }

  const handleLogin = (newToken, newUser) => {
    setToken(newToken)
    setUser(newUser)
    localStorage.setItem('token', newToken)
    localStorage.setItem('user', JSON.stringify(newUser))
    setSetupRequired(false)
  }

  const handleLogout = () => {
    setToken(null)
    setUser(null)
    localStorage.removeItem('token')
    localStorage.removeItem('user')
  }

  // Auth Header für API Calls
  const authHeaders = {
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json'
  }

  const fetchData = async () => {
    if (!token) return
    try {
      const headers = { 'Authorization': `Bearer ${token}` }
      const [dataRes, termineRes, faelligkeitenRes] = await Promise.all([
        fetch(`${API_URL}/data`, { headers }),
        fetch(`${API_URL}/termine`, { headers }),
        fetch(`${API_URL}/db/faelligkeiten`, { headers })
      ])
      if (faelligkeitenRes.status === 401) {
        handleLogout()
        return
      }
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
        headers: { 'Authorization': `Bearer ${token}` },
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
    const headers = { 'Authorization': `Bearer ${token}` }
    await fetch(`${API_URL}/reset`, { method: 'POST', headers })
    await fetch(`${API_URL}/db/reset`, { method: 'POST', headers })
    setData({ hu: [], inspektion: [], service: [], merged: {} })
    setTermine([])
    setFaelligkeiten([])
    setArchivCount(0)
  }

  useEffect(() => {
    if (token && !authChecking) {
      fetchData()
    }
  }, [token, authChecking])

  const mergedArray = Object.values(data.merged)
  const [archivCount, setArchivCount] = useState(0)

  useEffect(() => {
    if (!token) return
    fetch('/api/db/fahrzeug-status', {
      headers: { 'Authorization': `Bearer ${token}` }
    })
      .then(res => res.json())
      .then(statusList => {
        const ausgetragen = statusList.filter(s => s.ausgetragen).length
        const wiedervorlage = statusList.filter(s => s.wiedervorlage_datum && !s.ausgetragen).length
        setArchivCount(ausgetragen + wiedervorlage)
      })
      .catch(() => {})
  }, [faelligkeiten, token])

  const counts = {
    hu: data.hu.length,
    inspektion: data.inspektion.length,
    service: data.service.length,
    merged: mergedArray.length,
    archiv: archivCount
  }

  // Loading state
  if (authChecking) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-gray-500">Laden...</div>
      </div>
    )
  }

  // Login erforderlich
  if (!token || setupRequired) {
    return <Login onLogin={handleLogin} setupRequired={setupRequired} />
  }

  return (
    <div className="min-h-screen bg-white">
      {/* Clean Header */}
      <header className="sticky top-0 z-50 bg-white border-b border-gray-100">
        <div className="max-w-7xl mx-auto px-6 h-14 flex items-center justify-between">
          <h1 className="text-lg font-semibold text-gray-900 tracking-tight">
            Auto Walther - ServiceManager
          </h1>
          <div className="flex items-center gap-3">
            {/* Eingeloggter User */}
            <span className="text-sm text-gray-600">
              {user?.name || user?.username}
              {user?.role === 'admin' && (
                <span className="ml-1 text-xs bg-gray-100 px-1.5 py-0.5 rounded">Admin</span>
              )}
            </span>
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
            <button
              onClick={handleLogout}
              className="inline-flex items-center gap-2 px-3 py-1.5 text-sm font-medium text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-md transition-colors"
              title="Abmelden"
            >
              <ArrowRightOnRectangleIcon className="w-4 h-4" />
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
            {activeTab === 'faelligkeiten' && <FaelligkeitenList data={faelligkeiten} onRefresh={fetchData} currentUser={user?.name || user?.username} token={token} />}
            {activeTab === 'archiv' && <ArchivList currentUser={user?.name || user?.username} token={token} />}
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
