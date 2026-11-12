import { useState } from 'react'
import { XMarkIcon } from '../icons'

export function TerminForm({ fahrzeuge, onSave, onClose }) {
  const [formData, setFormData] = useState({
    vin: '',
    kennzeichen: '',
    typ: 'inspektion',
    datum: '',
    km_stand: '',
    bezeichnung: '',
    vermerk: ''
  })
  const [saving, setSaving] = useState(false)

  const handleSubmit = async (e) => {
    e.preventDefault()
    setSaving(true)
    
    try {
      const res = await fetch('/api/db/termine', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData)
      })
      const json = await res.json()
      if (json.success) {
        onSave && onSave()
        setFormData({
          vin: '', kennzeichen: '', typ: 'inspektion',
          datum: '', km_stand: '', bezeichnung: '', vermerk: ''
        })
      }
    } catch (err) {
      console.error('Save error:', err)
    }
    setSaving(false)
  }

  const handleVinSelect = (vin) => {
    const fahrzeug = fahrzeuge.find(f => f.vin === vin)
    setFormData(prev => ({
      ...prev,
      vin,
      kennzeichen: fahrzeug?.kennzeichen || ''
    }))
  }

  return (
    <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-medium text-gray-900">Neuen Termin eintragen</h3>
        {onClose && (
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <XMarkIcon className="w-5 h-5" />
          </button>
        )}
      </div>

      <form onSubmit={handleSubmit} className="grid grid-cols-4 gap-4">
        <div>
          <label className="field-label">
            Fahrzeug (VIN)
          </label>
          <select
            value={formData.vin}
            onChange={(e) => handleVinSelect(e.target.value)}
            className="field w-full"
            required
          >
            <option value="">-- Auswählen --</option>
            {fahrzeuge.map(f => (
              <option key={f.vin} value={f.vin}>
                {f.kennzeichen || f.vin.substring(0, 10)}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="field-label">
            Kennzeichen
          </label>
          <input
            type="text"
            value={formData.kennzeichen}
            onChange={(e) => setFormData(prev => ({ ...prev, kennzeichen: e.target.value }))}
            className="field w-full"
            placeholder="FG-XX 123"
          />
        </div>

        <div>
          <label className="field-label">
            Termin-Typ
          </label>
          <select
            value={formData.typ}
            onChange={(e) => setFormData(prev => ({ ...prev, typ: e.target.value }))}
            className="field w-full"
          >
            <option value="inspektion">Inspektion</option>
            <option value="hu">HU / AU</option>
            <option value="service">Service</option>
          </select>
        </div>

        <div>
          <label className="field-label">
            Datum
          </label>
          <input
            type="date"
            value={formData.datum}
            onChange={(e) => setFormData(prev => ({ ...prev, datum: e.target.value }))}
            className="field w-full"
            required
          />
        </div>

        <div>
          <label className="field-label">
            KM-Stand
          </label>
          <input
            type="number"
            value={formData.km_stand}
            onChange={(e) => setFormData(prev => ({ ...prev, km_stand: e.target.value }))}
            className="field w-full"
            placeholder="50000"
          />
        </div>

        <div>
          <label className="field-label">
            Bezeichnung
          </label>
          <input
            type="text"
            value={formData.bezeichnung}
            onChange={(e) => setFormData(prev => ({ ...prev, bezeichnung: e.target.value }))}
            className="field w-full"
            placeholder="7. Wartung"
          />
        </div>

        <div className="col-span-2">
          <label className="field-label">
            Vermerk
          </label>
          <input
            type="text"
            value={formData.vermerk}
            onChange={(e) => setFormData(prev => ({ ...prev, vermerk: e.target.value }))}
            className="field w-full"
            placeholder="Ölwechsel + Filter"
          />
        </div>

        <div className="col-span-4 flex justify-end">
          <button
            type="submit"
            disabled={saving}
            className="px-3 py-1.5 text-sm font-medium text-white bg-gray-900 rounded-md hover:bg-gray-800 transition-colors disabled:opacity-50"
          >
            {saving ? 'Speichere...' : 'Speichern'}
          </button>
        </div>
      </form>
    </div>
  )
}
