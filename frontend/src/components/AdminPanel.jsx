import { useState, useEffect, useRef } from 'react'
import { TrashIcon, UserPlusIcon, ClipboardDocumentIcon, XMarkIcon, ArrowDownTrayIcon, ArrowUpTrayIcon } from '../icons'
import { useToast } from './Toast'

const WOCHENTAGE = ['Sonntag', 'Montag', 'Dienstag', 'Mittwoch', 'Donnerstag', 'Freitag', 'Samstag']

export function AdminPanel({ token, onResetComplete }) {
  const { addToast } = useToast()
  const [stats, setStats] = useState(null)
  const [users, setUsers] = useState([])
  const [invites, setInvites] = useState([])
  const [loading, setLoading] = useState(true)
  const [showInviteForm, setShowInviteForm] = useState(false)
  const [inviteData, setInviteData] = useState({ username: '', name: '', role: 'user' })
  const [inviteLink, setInviteLink] = useState(null)
  const [kapazitaeten, setKapazitaeten] = useState([])
  const [backupHistory, setBackupHistory] = useState([])
  const [backupLoading, setBackupLoading] = useState(false)
  const restoreInputRef = useRef(null)

  useEffect(() => {
    loadData()
  }, [])

  const loadData = async () => {
    try {
      const headers = { 'Authorization': `Bearer ${token}` }
      const [statsRes, usersRes, invitesRes, kapRes, historyRes] = await Promise.all([
        fetch('/api/db/stats', { headers }),
        fetch('/api/auth/users', { headers }),
        fetch('/api/auth/invites', { headers }),
        fetch('/api/db/kapazitaeten', { headers }),
        fetch('/api/db/backup/history', { headers })
      ])
      if (statsRes.ok) setStats(await statsRes.json())
      if (usersRes.ok) setUsers(await usersRes.json())
      if (invitesRes.ok) setInvites(await invitesRes.json())
      if (kapRes.ok) {
        const kapData = await kapRes.json()
        setKapazitaeten(kapData.kapazitaeten || [])
      }
      if (historyRes.ok) setBackupHistory(await historyRes.json())
    } catch (err) {
      console.error('Load error:', err)
    }
    setLoading(false)
  }

  const handleBackup = async () => {
    setBackupLoading(true)
    try {
      const res = await fetch('/api/db/backup', {
        headers: { 'Authorization': `Bearer ${token}` }
      })
      if (res.ok) {
        const blob = await res.blob()
        const url = URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        a.download = res.headers.get('content-disposition')?.match(/filename="?(.+?)"?$/)?.[1] || 'backup.db'
        a.click()
        URL.revokeObjectURL(url)
        addToast('Backup erfolgreich heruntergeladen', 'success')
        loadData()
      } else {
        addToast('Backup fehlgeschlagen', 'error')
      }
    } catch (err) {
      addToast('Backup fehlgeschlagen: ' + err.message, 'error')
    }
    setBackupLoading(false)
  }

  const handleRestore = async (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    
    if (!confirm(`Datenbank wirklich aus "${file.name}" wiederherstellen?\n\nEin automatisches Backup der aktuellen DB wird vorher erstellt.`)) {
      e.target.value = ''
      return
    }
    
    setBackupLoading(true)
    try {
      const formData = new FormData()
      formData.append('backup', file)
      const res = await fetch('/api/db/restore', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` },
        body: formData
      })
      const data = await res.json()
      if (res.ok) {
        addToast('Datenbank wiederhergestellt! Seite wird neu geladen...', 'success')
        setTimeout(() => window.location.reload(), 3000)
      } else {
        addToast(data.error || 'Restore fehlgeschlagen', 'error')
      }
    } catch (err) {
      addToast('Restore fehlgeschlagen: ' + err.message, 'error')
    }
    setBackupLoading(false)
    e.target.value = ''
  }

  const handleKapazitaetChange = async (wochentag, field, value) => {
    const kap = kapazitaeten.find(k => k.wochentag === wochentag)
    const updated = { 
      max_termine: kap?.max_termine || 0, 
      aktiv: kap?.aktiv ?? 1,
      [field]: field === 'aktiv' ? (value ? 1 : 0) : parseInt(value) || 0
    }
    
    try {
      await fetch(`/api/db/kapazitaeten/${wochentag}`, {
        method: 'PUT',
        headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify(updated)
      })
      loadData()
    } catch (err) {
      console.error('Kapazität update error:', err)
    }
  }

  const handleCreateInvite = async (e) => {
    e.preventDefault()
    try {
      const res = await fetch('/api/auth/invite', {
        method: 'POST',
        headers: { 
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(inviteData)
      })
      if (res.ok) {
        const data = await res.json()
        setInviteLink(`${window.location.origin}/invite/${data.token}`)
        setInviteData({ username: '', name: '', role: 'user' })
        loadData()
      } else {
        const err = await res.json()
        alert(err.error || 'Fehler beim Erstellen der Einladung')
      }
    } catch (err) {
      console.error('Invite error:', err)
    }
  }

  const handleDeleteInvite = async (id) => {
    try {
      await fetch(`/api/auth/invite/${id}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      })
      loadData()
    } catch (err) {
      console.error('Delete invite error:', err)
    }
  }

  const copyToClipboard = (text) => {
    navigator.clipboard.writeText(text)
    alert('Link kopiert!')
  }

  const handleDeleteAll = async () => {
    if (!confirm('Wirklich alle Fahrzeuge, Kunden, Termine etc. löschen? User bleiben erhalten.')) return
    try {
      const res = await fetch('/api/db/reset', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` }
      })
      if (res.ok) {
        addToast('Datenbank erfolgreich geleert! User bleiben erhalten.', 'success')
        loadData()
        // UI in der Hauptansicht aktualisieren
        if (onResetComplete) {
          onResetComplete()
        }
      } else {
        addToast('Fehler beim Leeren der Datenbank', 'error')
      }
    } catch (err) {
      console.error('Delete error:', err)
      addToast('Fehler beim Leeren der Datenbank', 'error')
    }
  }

  const handleToggleUser = async (userId, active) => {
    try {
      const res = await fetch(`/api/auth/users/${userId}/${active ? 'deactivate' : 'activate'}`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` }
      })
      if (res.ok) loadData()
    } catch (err) {
      console.error('Toggle error:', err)
    }
  }

  const handleRoleChange = async (userId, newRole) => {
    try {
      const res = await fetch(`/api/auth/users/${userId}/role`, {
        method: 'POST',
        headers: { 
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ role: newRole })
      })
      if (res.ok) loadData()
    } catch (err) {
      console.error('Role change error:', err)
    }
  }

  if (loading) return <div className="text-slate-500 text-sm">Laden...</div>

  return (
    <div className="space-y-6 h-full overflow-y-auto">
      {/* Statistiken */}
      <section className="bg-white border border-slate-200 shadow-sm p-4 md:p-6">
        <h2 className="font-display text-[17px] font-normal tracking-[-0.2px] text-slate-900 mb-4">Statistiken</h2>
        {stats && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4">
            <StatBox label="Fahrzeuge" value={stats.fahrzeuge} />
            <StatBox label="Kunden" value={stats.kunden} />
            <StatBox label="Termine" value={stats.termine} />
            <StatBox label="Fälligkeiten" value={stats.service_faelligkeiten} />
          </div>
        )}
        
        <div className="mt-6 p-4 bg-red-50 border-l-[3px] border-l-red-600">
          <p className="eyebrow !text-red-700 mb-1">Gefahrenzone</p>
          <p className="text-sm text-slate-900 mb-3">Löscht alle Fahrzeuge, Kunden, Termine und Status. Benutzer bleiben erhalten. Vorher ein Backup erstellen.</p>
          <button
            onClick={handleDeleteAll}
            className="inline-flex items-center gap-2 min-h-[40px] px-4 bg-white text-red-600 border border-red-600 hover:bg-red-50 font-display font-semibold uppercase tracking-[0.1em] text-[12.5px] transition-colors"
          >
            <TrashIcon className="w-4 h-4" />
            Datenbank leeren
          </button>
        </div>
      </section>

      {/* Backup & Restore */}
      <section className="bg-white border border-slate-200 shadow-sm p-4 md:p-6">
        <h2 className="font-display text-[17px] font-normal tracking-[-0.2px] text-slate-900 mb-4">Backup & Restore</h2>
        
        <div className="flex flex-wrap gap-3 mb-4">
          <button
            onClick={handleBackup}
            disabled={backupLoading}
            className="inline-flex items-center gap-2 min-h-[40px] px-4 bg-brand-600 text-white hover:bg-brand-700 font-display font-semibold uppercase tracking-[0.1em] text-[12.5px] transition-colors disabled:opacity-50"
          >
            <ArrowDownTrayIcon className="w-4 h-4" />
            {backupLoading ? 'Läuft...' : 'Backup erstellen'}
          </button>
          <button
            onClick={() => restoreInputRef.current?.click()}
            disabled={backupLoading}
            className="inline-flex items-center gap-2 min-h-[40px] px-4 bg-white text-slate-900 border border-slate-900 hover:bg-slate-100 font-display font-semibold uppercase tracking-[0.1em] text-[12.5px] transition-colors disabled:opacity-50"
          >
            <ArrowUpTrayIcon className="w-4 h-4" />
            Backup einspielen
          </button>
          <input
            ref={restoreInputRef}
            type="file"
            accept=".db,.sqlite"
            onChange={handleRestore}
            className="hidden"
          />
        </div>
        
        {backupHistory.length > 0 && (
          <div>
            <h3 className="eyebrow mb-2">Letzte Aktionen</h3>
            <div className="space-y-1 max-h-40 overflow-y-auto">
              {backupHistory.slice(0, 10).map((entry, i) => (
                <div key={i} className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1 px-3 py-2 border-b border-slate-200 last:border-0 text-xs">
                  <div className="flex items-center gap-2">
                    <span className={`w-2 h-2 rounded-full ${
                      entry.type === 'restore' ? 'bg-amber-500' : 
                      entry.type === 'pre-restore-auto' ? 'bg-slate-400' : 'bg-brand-500'
                    }`} />
                    <span className="text-slate-700">
                      {entry.type === 'manual' && 'Backup erstellt'}
                      {entry.type === 'restore' && 'Restore durchgeführt'}
                      {entry.type === 'pre-restore-auto' && 'Auto-Backup vor Restore'}
                    </span>
                  </div>
                  <div className="flex items-center gap-3 font-mono text-[11px] text-slate-500">
                    <span>{entry.user}</span>
                    <span>{new Date(entry.timestamp).toLocaleString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })}</span>
                    <span>{(entry.size / 1024).toFixed(0)} KB</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </section>

      {/* Kapazitäts-Einstellungen */}
      <section className="bg-white border border-slate-200 shadow-sm p-4 md:p-6">
        <h2 className="font-display text-[17px] font-normal tracking-[-0.2px] text-slate-900 mb-4">Kapazitäten pro Wochentag</h2>
        <p className="text-sm text-slate-500 mb-4">Lege fest, wie viele Termine pro Tag möglich sind.</p>
        
        <div className="space-y-2">
          {WOCHENTAGE.map((tag, i) => {
            const kap = kapazitaeten.find(k => k.wochentag === i) || { max_termine: 0, aktiv: 0 }
            return (
              <div key={i} className="flex flex-wrap items-center gap-x-4 gap-y-2 py-2 border-b border-slate-200 last:border-0">
                <div className="w-28 text-sm text-slate-700">{tag}</div>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={kap.aktiv === 1}
                    onChange={(e) => handleKapazitaetChange(i, 'aktiv', e.target.checked)}
                    className="w-4 h-4 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500"
                  />
                  <span className="text-sm text-slate-500">Aktiv</span>
                </label>
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    min="0"
                    max="20"
                    value={kap.max_termine}
                    onChange={(e) => handleKapazitaetChange(i, 'max_termine', e.target.value)}
                    disabled={kap.aktiv !== 1}
                    className="field field-sm w-16 text-center"
                  />
                  <span className="text-sm text-slate-500">Termine max.</span>
                </div>
              </div>
            )
          })}
        </div>
      </section>

      {/* User einladen */}
      <section className="bg-white border border-slate-200 shadow-sm p-4 md:p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-display text-[17px] font-normal tracking-[-0.2px] text-slate-900">Benutzer einladen</h2>
          <button
            onClick={() => { setShowInviteForm(!showInviteForm); setInviteLink(null); }}
            className="inline-flex items-center gap-2 px-3 py-2 bg-primary-900 text-white text-[13px] font-medium hover:bg-primary-800 rounded-lg transition-colors"
          >
            <UserPlusIcon className="w-4 h-4" />
            Einladen
          </button>
        </div>

        {showInviteForm && (
          <form onSubmit={handleCreateInvite} className="mb-4 p-4 bg-slate-50 space-y-3">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <input
                type="text"
                placeholder="Benutzername"
                value={inviteData.username}
                onChange={(e) => setInviteData({ ...inviteData, username: e.target.value })}
                className="field"
                required
              />
              <input
                type="text"
                placeholder="Name"
                value={inviteData.name}
                onChange={(e) => setInviteData({ ...inviteData, name: e.target.value })}
                className="field"
              />
              <select
                value={inviteData.role}
                onChange={(e) => setInviteData({ ...inviteData, role: e.target.value })}
                className="field"
              >
                <option value="user">User</option>
                <option value="admin">Admin</option>
              </select>
            </div>
            <button type="submit" className="px-4 py-2 bg-primary-900 text-white text-[13px] font-medium hover:bg-primary-800 rounded-lg transition-colors">
              Erstellen
            </button>
          </form>
        )}

        {inviteLink && (
          <div className="mb-4 p-4 bg-emerald-50 border border-emerald-200">
            <p className="text-sm text-emerald-800 mb-2">Einladungslink:</p>
            <div className="flex items-center gap-2">
              <input
                type="text"
                value={inviteLink}
                readOnly
                className="field flex-1 font-mono"
              />
              <button
                onClick={() => copyToClipboard(inviteLink)}
                className="p-2 bg-emerald-600 text-white hover:bg-emerald-700"
              >
                <ClipboardDocumentIcon className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}

        {invites.filter(i => !i.used).length > 0 && (
          <div className="mt-4">
            <h3 className="eyebrow mb-2">Offene Einladungen</h3>
            <div className="space-y-1">
              {invites.filter(i => !i.used).map(inv => (
                <div key={inv.id} className="flex items-center justify-between p-3 bg-slate-50 text-sm">
                  <span className="text-slate-700">{inv.username} <span className="text-slate-400">({inv.role})</span></span>
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => copyToClipboard(`${window.location.origin}/invite/${inv.token}`)}
                      className="p-1.5 text-slate-400 hover:text-slate-600"
                    >
                      <ClipboardDocumentIcon className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => handleDeleteInvite(inv.id)}
                      className="p-1.5 text-slate-400 hover:text-red-600"
                    >
                      <XMarkIcon className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </section>

      {/* User-Verwaltung */}
      <section className="bg-white border border-slate-200 shadow-sm p-4 md:p-6">
        <h2 className="font-display text-[17px] font-normal tracking-[-0.2px] text-slate-900 mb-4">Benutzer</h2>
        <ul className="divide-y divide-slate-200 border-t border-slate-200">
          {users.map(u => (
            <li key={u.id} className="flex flex-wrap items-center gap-x-4 gap-y-2 py-3">
              <div className="w-9 h-9 rounded-full bg-slate-900 text-white grid place-items-center font-mono text-sm flex-shrink-0">
                {(u.name || u.username || '?').trim().charAt(0).toUpperCase()}
              </div>
              <div className="flex-1 min-w-[140px]">
                <div className="text-sm text-slate-900">{u.name || u.username}</div>
                <div className="font-mono text-[11px] text-slate-500">{u.username}</div>
              </div>
              <span className="inline-flex items-center gap-1.5 text-[13px] text-slate-900">
                <span className={`w-2 h-2 rounded-full ${u.active ? 'bg-brand-500' : 'bg-slate-400'}`} />
                {u.active ? 'aktiv' : 'inaktiv'}
              </span>
              <select
                value={u.role}
                onChange={(e) => handleRoleChange(u.id, e.target.value)}
                className="field field-sm"
                aria-label={`Rolle von ${u.username}`}
              >
                <option value="user">Benutzer</option>
                <option value="admin">Admin</option>
              </select>
              <button
                onClick={() => handleToggleUser(u.id, u.active)}
                className="text-sm text-slate-900 underline underline-offset-4 hover:text-brand-700"
              >
                {u.active ? 'Deaktivieren' : 'Aktivieren'}
              </button>
            </li>
          ))}
        </ul>
      </section>
    </div>
  )
}

function StatBox({ label, value }) {
  return (
    <div className="p-4 border border-slate-200">
      <div className="eyebrow">{label}</div>
      <div className="text-[28px] md:text-[32px] font-light tracking-[-1px] tabular-nums text-slate-900 mt-1">{(value ?? 0).toLocaleString('de-DE')}</div>
    </div>
  )
}
