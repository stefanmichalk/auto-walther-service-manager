import { useState } from 'react'
import { ArrowUpTrayIcon, CheckCircleIcon } from '@heroicons/react/24/outline'

export function DropZone({ onUpload, loading }) {
  const [isDragging, setIsDragging] = useState(false)
  const [lastUpload, setLastUpload] = useState(null)

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
      for (const file of files) {
        const result = await onUpload(file)
        if (result) {
          setLastUpload(result)
        }
      }
    }
    e.target.value = ''
  }

  return (
    <div
      onDragEnter={handleDragIn}
      onDragLeave={handleDragOut}
      onDragOver={handleDrag}
      onDrop={handleDrop}
      className={`
        relative border border-dashed rounded-lg text-center transition-all cursor-pointer
        ${isDragging 
          ? 'border-gray-400 bg-gray-50 px-8 py-6' 
          : 'border-gray-300 hover:border-gray-400 px-4 py-2'
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
      
      <div className="flex items-center gap-2">
        <ArrowUpTrayIcon className={`w-4 h-4 ${isDragging ? 'text-gray-700' : 'text-gray-400'}`} />
        <span className="text-sm text-gray-500">
          {isDragging ? 'Loslassen zum Hochladen' : 'Dateien hochladen'}
        </span>
        {lastUpload && !isDragging && (
          <span className="flex items-center gap-1 text-xs text-gray-400">
            <CheckCircleIcon className="w-3.5 h-3.5 text-emerald-500" />
            {lastUpload.recordCount}
          </span>
        )}
      </div>
    </div>
  )
}
