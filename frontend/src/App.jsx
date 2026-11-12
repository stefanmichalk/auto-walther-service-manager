import { useState, useEffect } from 'react'
import { 
  ArrowPathIcon, 
  ArrowRightOnRectangleIcon, 
  Cog6ToothIcon,
  HomeIcon,
  TruckIcon,
  ArchiveBoxIcon,
  UserGroupIcon,
  MagnifyingGlassIcon,
  XMarkIcon,
  PlusIcon,
  BellIcon,
  CalendarDaysIcon
} from './icons'
import { DropZone } from './components/DropZone'
import { FaelligkeitenList } from './components/FaelligkeitenList'
import { FahrzeugeListe } from './components/FahrzeugeListe'
import { ArchivList } from './components/ArchivList'
import { AdminPanel } from './components/AdminPanel'
import { AuslastungView } from './components/AuslastungView'
import { Login } from './components/Login'
import { InvitePage } from './components/InvitePage'
import { ImportMergeDialog } from './components/ImportMergeDialog'
import { ToastProvider } from './components/Toast'
import { BuchungsSeite } from './components/BuchungsSeite'

const API_URL = '/api'

function App() {
  const [data, setData] = useState({ hu: [], inspektion: [], service: [], merged: {} })
  const [termine, setTermine] = useState([])
  const [faelligkeiten, setFaelligkeiten] = useState([])
  const [activeTab, setActiveTab] = useState('faelligkeiten')
  const [globalSearch, setGlobalSearch] = useState('')
  const [loading, setLoading] = useState(false)
  
  // Auth State
  const [token, setToken] = useState(() => localStorage.getItem('token'))
  const [user, setUser] = useState(() => {
    const saved = localStorage.getItem('user')
    return saved ? JSON.parse(saved) : null
  })
  const [setupRequired, setSetupRequired] = useState(false)
  const [authChecking, setAuthChecking] = useState(true)
  const [showSettings, setShowSettings] = useState(false)
  const [inviteToken, setInviteToken] = useState(null)
  const [showBuchung, setShowBuchung] = useState(false)
  const [appVersion, setAppVersion] = useState(null)

  // Version laden
  useEffect(() => {
    fetch(`${API_URL}/version`)
      .then(r => r.json())
      .then(setAppVersion)
      .catch(() => {})
  }, [])

  // Check for invite/buchung in URL
  useEffect(() => {
    const path = window.location.pathname
    if (path.startsWith('/invite/')) {
      setInviteToken(path.replace('/invite/', ''))
    } else if (path === '/buchen' || path === '/buchen/') {
      setShowBuchung(true)
    }
  }, [])

  // Auth check beim Start
  useEffect(() => {
    checkAuth()
  }, [])

  // Event-Listener für Drop-Fläche in leerer Ansicht
  useEffect(() => {
    const handleDropzoneFiles = async (e) => {
      const files = e.detail
      for (const file of files) {
        await handleUpload(file)
      }
    }
    window.addEventListener('dropzone-files', handleDropzoneFiles)
    return () => window.removeEventListener('dropzone-files', handleDropzoneFiles)
  }, [token])

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

  // Hilfsfunktion: Datum parsen und Dringlichkeit berechnen
  const parseDate = (dateStr) => {
    if (!dateStr) return null
    // Format: DD.MM.YYYY oder YYYY-MM-DD
    const parts = dateStr.includes('.') ? dateStr.split('.') : dateStr.split('-')
    if (parts.length !== 3) return null
    const [a, b, c] = parts
    return dateStr.includes('.') 
      ? new Date(c, b - 1, a) 
      : new Date(a, b - 1, c)
  }

  const getUrgency = (dateStr) => {
    const date = parseDate(dateStr)
    if (!date) return 'normal'
    const today = new Date()
    const diffDays = Math.floor((date - today) / (1000 * 60 * 60 * 24))
    if (diffDays < 0) return 'ueberfaellig'
    if (diffDays <= 7) return 'dringend'
    return 'normal'
  }

  const getNextDate = (item) => {
    const dates = [item.service_faellig, item.inspektion_termin, item.hu_termin].filter(Boolean)
    if (dates.length === 0) return null
    return dates.sort((a, b) => {
      const da = parseDate(a)
      const db = parseDate(b)
      if (!da) return 1
      if (!db) return -1
      return da - db
    })[0]
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
      
      // Mapping: snake_case -> camelCase + berechnete Felder
      const mappedFaelligkeiten = faelligkeitenJson.map(item => {
        const nextDate = getNextDate(item)
        return {
          fahrzeug_id: item.fahrzeug_id,
          vin: item.vin,
          kennzeichen: item.kennzeichen,
          hersteller: item.hersteller,
          modell: item.modell,
          kunde: item.kunde_name,
          kundeStrasse: item.kunde_strasse,
          kundePlz: item.kunde_plz,
          kundeOrt: item.kunde_ort,
          kundeTelefon: item.kunde_telefon,
          kundeEmail: item.kunde_email,
          serviceFaellig: item.service_faellig,
          serviceBezeichnung: item.service_bezeichnung,
          inspektionTermin: item.inspektion_termin,
          inspektionVermerk: item.inspektion_vermerk,
          huTermin: item.hu_termin,
          nextDate: nextDate,
          urgency: getUrgency(nextDate)
        }
      })
      
      setData(dataJson)
      setTermine(termineJson)
      setFaelligkeiten(mappedFaelligkeiten)
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

  // State für Import-Vorschau
  const [importPreview, setImportPreview] = useState(null)
  const [parsedDataForImport, setParsedDataForImport] = useState(null)
  const [uploadedFiles, setUploadedFiles] = useState([])

  const handleUpload = async (file) => {
    setLoading(true)
    const formData = new FormData()
    formData.append('file', file)

    try {
      // 1. Datei hochladen und parsen (wird auf Server gesammelt)
      const res = await fetch(`${API_URL}/upload`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` },
        body: formData
      })
      const json = await res.json()
      
      if (json.success) {
        setUploadedFiles(prev => [...prev, file.name])
        
        // 2. Aktuelle geparste Daten vom Server holen
        const dataRes = await fetch(`${API_URL}/data`, {
          headers: { 'Authorization': `Bearer ${token}` }
        })
        const currentData = await dataRes.json()
        
        // 3. Konsolidierte Vorschau mit den vollständigen Daten holen
        const previewRes = await fetch(`${API_URL}/db/import-preview`, {
          method: 'POST',
          headers: { 
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(currentData)
        })
        const previewJson = await previewRes.json()
        
        if (previewJson.success && (previewJson.preview.neu.length > 0 || previewJson.preview.aktualisiert.length > 0)) {
          // 3. Wizard öffnen wenn es Daten gibt
          setImportPreview(previewJson.preview)
          setParsedDataForImport(currentData)
        }
        
        setLoading(false)
        return { ...json, fileName: file.name, recordCount: json.recordCount || 0 }
      }
    } catch (err) {
      console.error('Upload error:', err)
    }
    setLoading(false)
    return null
  }
  
  // Wizard manuell öffnen
  const openImportWizard = async () => {
    setLoading(true)
    try {
      // Hole aktuelle geparste Daten vom Server
      const dataRes = await fetch(`${API_URL}/data`, { 
        headers: { 'Authorization': `Bearer ${token}` } 
      })
      const data = await dataRes.json()
      
      const previewRes = await fetch(`${API_URL}/db/import-preview`, {
        method: 'POST',
        headers: { 
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(data)
      })
      const previewJson = await previewRes.json()
      
      if (previewJson.success) {
        setImportPreview(previewJson.preview)
        setParsedDataForImport(data)
      }
    } catch (err) {
      console.error('Error:', err)
    }
    setLoading(false)
  }

  const handleImportComplete = async (stats) => {
    setImportPreview(null)
    setParsedDataForImport(null)
    await fetchData()
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
  const [statusMap, setStatusMap] = useState({})

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
        
        // StatusMap für Stats
        const map = {}
        statusList.forEach(s => {
          map[s.vin] = s
        })
        setStatusMap(map)
      })
      .catch(() => {})
  }, [faelligkeiten, token])

  const [fahrzeugeCount, setFahrzeugeCount] = useState(0)
  
  useEffect(() => {
    if (!token) return
    fetch('/api/db/fahrzeuge', { headers: { 'Authorization': `Bearer ${token}` } })
      .then(res => res.json())
      .then(data => setFahrzeugeCount(data.length))
      .catch(() => {})
  }, [token])

  const counts = {
    fahrzeuge: fahrzeugeCount,
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

  // Buchungs-Seite (öffentlich, für Kunden)
  if (showBuchung) {
    return <BuchungsSeite />
  }

  // Invite Token Seite (öffentlich)
  if (inviteToken) {
    return <InvitePage token={inviteToken} onComplete={() => { setInviteToken(null); window.history.pushState({}, '', '/'); }} />
  }

  // Login erforderlich
  if (!token || setupRequired) {
    return <Login onLogin={handleLogin} setupRequired={setupRequired} />
  }

  const navItems = [
    { id: 'faelligkeiten', label: 'Dashboard', icon: HomeIcon, showActive: true },
    { id: 'auslastung', label: 'Auslastung', icon: CalendarDaysIcon, showActive: true },
    { id: 'fahrzeuge', label: 'Fahrzeuge', icon: TruckIcon, count: fahrzeugeCount, showActive: true },
    { id: 'archiv', label: 'Archiv', icon: ArchiveBoxIcon, count: archivCount, showActive: true },
  ]

  return (
    <div className="h-[100dvh] w-full bg-gray-50 flex overflow-hidden">
      {/* Sidebar - Clean & Modern */}
      <aside className="hidden md:flex w-64 bg-white border-r border-gray-200 flex-col flex-shrink-0">
        {/* Logo */}
        <div className="h-16 px-6 flex items-center border-b border-gray-100">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-brand-600 flex items-center justify-center">
              <TruckIcon className="w-5 h-5 text-white" />
            </div>
            <span className="font-display text-base font-medium tracking-tight text-gray-900">ServiceManager</span>
          </div>
        </div>

        {/* Navigation */}
        <nav className="flex-1 px-4 py-6 overflow-y-auto">
          {/* MENU Section */}
          <p className="eyebrow mb-3 px-3">Menü</p>
          
          {navItems.map(item => (
            <button
              key={item.id}
              onClick={() => setActiveTab(item.id)}
              aria-current={activeTab === item.id ? 'page' : undefined}
              className="side-link w-full flex items-center gap-3 pl-[14px] pr-3 py-[11px] mb-1 transition-colors"
            >
              <item.icon className="w-5 h-5" />
              <span>{item.label}</span>
              {item.count > 0 && (
                <span className="ml-auto font-mono text-[11px] normal-case tracking-normal px-2 py-0.5 rounded-full border border-gray-300 bg-white text-gray-700">
                  {item.count}
                </span>
              )}
            </button>
          ))}

          {user?.role === 'admin' && (
            <>
              {/* ADMIN Section */}
              <p className="eyebrow mt-8 mb-3 px-3">Admin</p>
              <button
                onClick={() => setActiveTab('admin')}
                aria-current={activeTab === 'admin' ? 'page' : undefined}
                className="side-link w-full flex items-center gap-3 pl-[14px] pr-3 py-[11px] mb-1 transition-colors"
              >
                <Cog6ToothIcon className="w-5 h-5" />
                <span>Einstellungen</span>
              </button>
            </>
          )}
        </nav>

        {/* Upload Section */}
        <div className="px-4 py-4 border-t border-gray-100">
          <DropZone onUpload={handleUpload} loading={loading} />
          {uploadedFiles.length > 0 && (
            <button
              onClick={openImportWizard}
              className="w-full mt-2 px-3 py-2 text-white bg-emerald-600 hover:bg-emerald-700 rounded-xl transition-colors btn-caps min-h-[40px]"
            >
              Import-Wizard öffnen ({uploadedFiles.length} Dateien)
            </button>
          )}
        </div>

        {/* User */}
        <div className="px-4 py-4 border-t border-gray-100">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-gray-900 flex items-center justify-center">
              <span className="text-white font-mono text-sm">
                {(user?.name || user?.username || '?').charAt(0).toUpperCase()}
              </span>
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-gray-900 truncate">{user?.name || user?.username}</p>
              <p className="text-xs text-gray-500">{user?.role === 'admin' ? 'Administrator' : 'Benutzer'}</p>
            </div>
            <button
              onClick={handleLogout}
              className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
              title="Abmelden"
            >
              <ArrowRightOnRectangleIcon className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Version */}
        {appVersion && (
          <div className="px-4 py-2 border-t border-gray-100">
            <p className="font-mono text-[10px] text-gray-500 text-center">
              v{appVersion.version}{appVersion.buildDate ? ` · ${appVersion.buildDate}` : ''}
            </p>
          </div>
        )}
      </aside>

      {/* Main Content */}
      <div className="flex-1 flex flex-col min-w-0 bg-gray-50">
        {/* Top Bar */}
        <header className="h-16 bg-white border-b border-gray-200 flex items-center gap-3 px-4 md:px-8 flex-shrink-0">
          <div className="md:hidden w-8 h-8 bg-brand-600 flex items-center justify-center flex-shrink-0">
            <TruckIcon className="w-5 h-5 text-white" />
          </div>
          <div className="flex-1 md:flex-none flex items-center gap-4 min-w-0">
            <div className="relative w-full md:w-80">
              <MagnifyingGlassIcon className="w-5 h-5 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input 
                type="text" 
                placeholder="Suche (Kennzeichen, Kunde, VIN)..." 
                value={globalSearch}
                onChange={e => {
                  setGlobalSearch(e.target.value)
                  if (activeTab === 'admin' || activeTab === 'auslastung') setActiveTab('fahrzeuge')
                }}
                className="w-full h-10 pl-10 pr-9 bg-white border border-gray-300 hover:border-gray-400 text-sm placeholder:text-gray-500 focus:outline-none focus:border-gray-900 focus:ring-2 focus:ring-gray-900 transition-colors"
              />
              {globalSearch && (
                <button
                  type="button"
                  onClick={() => setGlobalSearch('')}
                  className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-gray-500 hover:text-gray-900"
                  aria-label="Suche leeren"
                >
                  <XMarkIcon className="w-4 h-4" />
                </button>
              )}
            </div>
          </div>
          <button
            onClick={handleLogout}
            className="md:hidden p-2 text-gray-600 hover:text-gray-900"
            aria-label="Abmelden"
          >
            <ArrowRightOnRectangleIcon className="w-5 h-5" />
          </button>
        </header>

        {/* Page Header */}
        <div className="px-4 md:px-8 pt-5 pb-4 md:py-6 flex-shrink-0">
          <h1 className="font-display text-[26px] font-light tracking-[-0.5px] text-gray-900">
            {activeTab === 'faelligkeiten' && 'Dashboard'}
            {activeTab === 'auslastung' && 'Auslastung'}
            {activeTab === 'fahrzeuge' && 'Fahrzeuge'}
            {activeTab === 'archiv' && 'Archiv'}
            {activeTab === 'admin' && 'Einstellungen'}
          </h1>
        </div>

        {/* Content Area */}
        <main className="flex-1 overflow-auto px-4 md:px-8 pb-24 md:pb-8">
          {activeTab === 'faelligkeiten' && (
            <FaelligkeitenList 
              data={faelligkeiten} 
              onRefresh={fetchData} 
              currentUser={user?.name || user?.username} 
              token={token} 
              globalSearch={globalSearch}
              onSearchChange={setGlobalSearch}
              onNavigate={setActiveTab}
            />
          )}
          {activeTab === 'auslastung' && <AuslastungView token={token} />}
          {activeTab === 'fahrzeuge' && <FahrzeugeListe token={token} globalSearch={globalSearch} />}
          {activeTab === 'archiv' && <ArchivList currentUser={user?.name || user?.username} token={token} globalSearch={globalSearch} />}
          {activeTab === 'admin' && user?.role === 'admin' && <AdminPanel token={token} onResetComplete={fetchData} />}
        </main>
      </div>

      {/* Mobile Tab-Leiste */}
      <nav className="md:hidden fixed bottom-0 inset-x-0 z-40 bg-white/95 backdrop-blur border-t border-gray-200 pb-[env(safe-area-inset-bottom)]">
        <div className="flex">
          {[...navItems, ...(user?.role === 'admin' ? [{ id: 'admin', label: 'Admin', icon: Cog6ToothIcon }] : [])].map(item => {
            const active = activeTab === item.id
            return (
              <button
                key={item.id}
                onClick={() => setActiveTab(item.id)}
                aria-current={active ? 'page' : undefined}
                className={`relative flex-1 flex flex-col items-center gap-1 pt-2.5 pb-2 font-display text-[9.5px] font-medium uppercase tracking-[0.06em] ${active ? 'text-gray-900' : 'text-gray-500'}`}
              >
                {active && <span className="absolute top-0 left-[28%] right-[28%] h-[2px] bg-brand-500" />}
                <item.icon className={`w-6 h-6 ${active ? 'text-brand-700' : ''}`} />
                {item.label}
              </button>
            )
          })}
        </div>
      </nav>

      {/* Import-Vorschau Dialog */}
      {importPreview && parsedDataForImport && (
        <ImportMergeDialog
          preview={importPreview}
          parsedData={parsedDataForImport}
          onClose={() => { setImportPreview(null); setParsedDataForImport(null); }}
          onImport={handleImportComplete}
          token={token}
        />
      )}
    </div>
  )
}

function AppWithToast() {
  return (
    <ToastProvider>
      <App />
    </ToastProvider>
  )
}

export default AppWithToast
