import { useState } from 'react'
import { ArrowUpTrayIcon, CheckCircleIcon, XMarkIcon, DocumentTextIcon } from '@heroicons/react/24/outline'

export function DropZone({ onUpload, loading }) {
  const [isDragging, setIsDragging] = useState(false)
  const [lastUpload, setLastUpload] = useState(null)
  const [showPreview, setShowPreview] = useState(false)
  const [uploadResults, setUploadResults] = useState([])

  const handleDrag = (e) => {
    e.preventDefault()
    e.stopPropagation()
  }

  const handleDragIn = (e) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragging(true)
  }

  const handleDragOut = (e) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragging(false)
  }

  const handleDrop = async (e) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragging(false)

    const files = e.dataTransfer.files
    if (files && files.length > 0) {
      // Alle Dateien hochladen - der letzte Upload triggert den Wizard
      for (const file of files) {
        const result = await onUpload(file)
        if (result) {
          setLastUpload(result)
        }
      }
    }
  }

  const handleFileSelect = async (e) => {
    const files = e.target.files
    if (files && files.length > 0) {
      // Alle Dateien hochladen - der letzte Upload triggert den Wizard
      for (const file of files) {
        const result = await onUpload(file)
        if (result) {
          setLastUpload(result)
        }
      }
    }
    e.target.value = ''
  }

  const closePreview = () => {
    setShowPreview(false)
    setUploadResults([])
  }

  return (
    <div
      onDragEnter={handleDragIn}
      onDragLeave={handleDragOut}
      onDragOver={handleDrag}
      onDrop={handleDrop}
      className={`
        relative transition-all cursor-pointer rounded-xl border-2 border-dashed
        ${isDragging 
          ? 'border-emerald-400 bg-emerald-50' 
          : 'border-gray-300 hover:border-emerald-400 hover:bg-emerald-50'
        }
        ${loading ? 'opacity-50 pointer-events-none' : ''}
      `}
    >
      <input
        type="file"
        accept=".pdf,.xlsx,.xls"
        multiple
        onChange={handleFileSelect}
        className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
      />
      
      <div className="flex flex-col items-center gap-1 py-4 px-2">
        <ArrowUpTrayIcon className={`w-6 h-6 ${isDragging ? 'text-emerald-600' : 'text-gray-400'}`} />
        <span className="text-xs text-gray-500 font-medium">
          {isDragging ? 'Loslassen' : 'Dateien hochladen'}
        </span>
        {lastUpload && !isDragging && (
          <span className="flex items-center gap-1 text-[10px] text-emerald-600">
            <CheckCircleIcon className="w-3 h-3" />
            {lastUpload.recordCount} importiert
          </span>
        )}
      </div>

      {/* Upload Preview Modal */}
      {showPreview && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4" onClick={closePreview}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between px-6 py-5 border-b border-gray-100">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-xl bg-emerald-100 flex items-center justify-center">
                  <CheckCircleIcon className="w-7 h-7 text-emerald-600" />
                </div>
                <div>
                  <h3 className="font-semibold text-gray-900">Upload erfolgreich</h3>
                  <p className="text-sm text-gray-500">{uploadResults.length} Datei(en) verarbeitet</p>
                </div>
              </div>
              <button onClick={closePreview} className="p-2 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100">
                <XMarkIcon className="w-5 h-5" />
              </button>
            </div>
            
            <div className="p-5 space-y-3 max-h-80 overflow-y-auto">
              {uploadResults.map((result, i) => (
                <div key={i} className="flex items-start gap-3 p-4 bg-gray-50 rounded-xl">
                  <DocumentTextIcon className="w-5 h-5 text-gray-400 flex-shrink-0 mt-0.5" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-900 truncate">{result.fileName}</p>
                    <p className="text-xs text-gray-500 mt-0.5">
                      {result.recordCount} Datensätze • {result.type || 'Unbekannt'}
                    </p>
                  </div>
                  <CheckCircleIcon className="w-5 h-5 text-emerald-500 flex-shrink-0" />
                </div>
              ))}
            </div>

            <div className="px-5 py-4 border-t border-gray-100 bg-gray-50">
              <button
                onClick={closePreview}
                className="w-full py-3 bg-emerald-600 text-white text-sm font-semibold rounded-xl hover:bg-emerald-700 transition-colors"
              >
                Fertig
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
