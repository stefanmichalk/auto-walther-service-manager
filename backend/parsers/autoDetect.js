// Auto-Detection des Dateityps anhand des Inhalts

export function detectFileType(filename, content) {
  const ext = filename.toLowerCase().split('.').pop();
  
  // XLSX erkennen
  if (ext === 'xlsx' || ext === 'xls') {
    return 'service';
  }
  
  // PDF-Inhalt analysieren
  if (ext === 'pdf' && content) {
    const text = content.toLowerCase();
    
    // HU-Liste erkennen
    if (text.includes('hu-liste') || text.includes('hauptunters') || 
        text.includes('hu-datum') || 
        (text.includes('herstellerfahrgestellnr') && text.includes('hu-datum'))) {
      return 'hu';
    }
    
    // Inspektion erkennen
    if (text.includes('inspektionkmstand') || text.includes('inspektion') ||
        (text.includes('herstellerfahrgestellnr') && text.includes('vermerk'))) {
      return 'inspektion';
    }
  }
  
  return 'unknown';
}
