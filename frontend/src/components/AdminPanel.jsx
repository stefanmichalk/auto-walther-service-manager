import { useState, useEffect } from 'react'
import { TrashIcon, UserPlusIcon, ClipboardDocumentIcon, XMarkIcon } from '@heroicons/react/24/outline'
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

  useEffect(() => {
    loadData()
  }, [])

  const loadData = async () => {
    try {
      const headers = { 'Authorization': `Bearer ${token}` }
      const [statsRes, usersRes, invitesRes, kapRes] = await Promise.all([
        fetch('/api/db/stats', { headers }),
        fetch('/api/auth/users', { headers }),
        fetch('/api/auth/invites', { headers }),
        fetch('/api/db/kapazitaeten', { headers })
      ])
      if (statsRes.ok) setStats(await statsRes.json())
      if (usersRes.ok) setUsers(await usersRes.json())
      if (invitesRes.ok) setInvites(await invitesRes.json())
      if (kapRes.ok) {
        const kapData = await kapRes.json()
        setKapazitaeten(kapData.kapazitaeten || [])
      }
    } catch (err) {
      console.error('Load error:', err)
    }
    setLoading(false)
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
      <section className="bg-white border border-slate-200 p-6">
        <h2 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-4">Statistiken</h2>
        {stats && (
          <div className="grid grid-cols-4 gap-4">
            <StatBox label="Fahrzeuge" value={stats.fahrzeuge} />
            <StatBox label="Kunden" value={stats.kunden} />
            <StatBox label="Termine" value={stats.termine} />
            <StatBox label="Fälligkeiten" value={stats.service_faelligkeiten} />
          </div>
        )}
        
        <div className="mt-6 pt-6 border-t border-slate-100">
          <button
            onClick={handleDeleteAll}
            className="inline-flex items-center gap-2 px-4 py-2 bg-red-600 text-white text-[13px] font-medium hover:bg-red-700 rounded-lg transition-colors"
          >
            <TrashIcon className="w-4 h-4" />
            Datenbank leeren
          </button>
          <p className="text-xs text-slate-400 mt-2">Löscht alle Daten außer Benutzer</p>
        </div>
      </section>

      {/* Kapazitäts-Einstellungen */}
      <section className="bg-white border border-slate-200 p-6">
        <h2 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-4">Kapazitäten pro Wochentag</h2>
        <p className="text-sm text-slate-500 mb-4">Lege fest, wie viele Termine pro Tag möglich sind.</p>
        
        <div className="space-y-2">
          {WOCHENTAGE.map((tag, i) => {
            const kap = kapazitaeten.find(k => k.wochentag === i) || { max_termine: 0, aktiv: 0 }
            return (
              <div key={i} className="flex items-center gap-4 py-2">
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
                    className="w-16 px-2 py-1 text-sm border border-slate-200 rounded-lg text-center disabled:bg-slate-50 disabled:text-slate-400"
                  />
                  <span className="text-sm text-slate-500">Termine max.</span>
                </div>
              </div>
            )
          })}
        </div>
      </section>

      {/* User einladen */}
      <section className="bg-white border border-slate-200 p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Benutzer einladen</h2>
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
            <div className="grid grid-cols-3 gap-3">
              <input
                type="text"
                placeholder="Benutzername"
                value={inviteData.username}
                onChange={(e) => setInviteData({ ...inviteData, username: e.target.value })}
                className="px-3 py-2 border border-primary-200 text-[13px] focus:border-primary-400 focus:ring-0 outline-none rounded-lg"
                required
              />
              <input
                type="text"
                placeholder="Name"
                value={inviteData.name}
                onChange={(e) => setInviteData({ ...inviteData, name: e.target.value })}
                className="px-3 py-2 border border-primary-200 text-[13px] focus:border-primary-400 focus:ring-0 outline-none rounded-lg"
              />
              <select
                value={inviteData.role}
                onChange={(e) => setInviteData({ ...inviteData, role: e.target.value })}
                className="px-3 py-2 border border-slate-200 text-sm focus:border-slate-400 focus:ring-0 outline-none bg-white"
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
                className="flex-1 px-3 py-2 bg-white border border-emerald-200 text-sm font-mono"
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
            <h3 className="text-xs font-medium text-slate-500 mb-2">Offene Einladungen</h3>
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
      <section className="bg-white border border-slate-200 p-6">
        <h2 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-4">Benutzer</h2>
        <table className="w-full">
          <thead>
            <tr className="text-left text-xs text-slate-400 uppercase tracking-wider border-b border-slate-100">
              <th className="pb-3 font-medium">User</th>
              <th className="pb-3 font-medium">Name</th>
              <th className="pb-3 font-medium">Rolle</th>
              <th className="pb-3 font-medium">Status</th>
              <th className="pb-3 font-medium"></th>
            </tr>
          </thead>
          <tbody>
            {users.map(u => (
              <tr key={u.id} className="border-b border-slate-50">
                <td className="py-3 text-sm text-slate-900">{u.username}</td>
                <td className="py-3 text-sm text-slate-500">{u.name}</td>
                <td className="py-3">
                  <select
                    value={u.role}
                    onChange={(e) => handleRoleChange(u.id, e.target.value)}
                    className="text-[13px] border border-primary-200 px-2 py-1.5 bg-white focus:border-primary-400 focus:ring-0 outline-none rounded-lg"
                  >
                    <option value="user">User</option>
                    <option value="admin">Admin</option>
                  </select>
                </td>
                <td className="py-3">
                  <span className={`text-xs px-2 py-1 font-medium ${u.active ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-500'}`}>
                    {u.active ? 'Aktiv' : 'Inaktiv'}
                  </span>
                </td>
                <td className="py-3 text-right">
                  <button
                    onClick={() => handleToggleUser(u.id, u.active)}
                    className="text-xs text-slate-500 hover:text-slate-900"
                  >
                    {u.active ? 'Deaktivieren' : 'Aktivieren'}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </div>
  )
}

function StatBox({ label, value }) {
  return (
    <div className="p-4 bg-slate-50">
      <div className="text-2xl font-semibold text-slate-900">{value ?? 0}</div>
      <div className="text-xs text-slate-500 mt-1">{label}</div>
    </div>
  )
}
