import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Lade alle gültigen Unterscheidungszeichen aus CSV
let kennzeichenKuerzel = new Set();

function loadKennzeichenData() {
  try {
    const csvPath = path.join(__dirname, '../../pdfs/kfzkennzeichen-deutschland.csv');
    const content = fs.readFileSync(csvPath, 'latin1');
    const lines = content.split('\n');
    
    for (const line of lines) {
      const [kuerzel] = line.split(',');
      if (kuerzel && kuerzel.trim()) {
        kennzeichenKuerzel.add(kuerzel.trim().toUpperCase());
      }
    }
    console.log(`Loaded ${kennzeichenKuerzel.size} Kennzeichen-Kürzel`);
  } catch (error) {
    console.error('Error loading Kennzeichen CSV:', error.message);
  }
}

// Beim Import laden
loadKennzeichenData();

/**
 * Bereinigt ein Kennzeichen: nur Großbuchstaben und Zahlen
 * @param {string} raw - Rohes Kennzeichen (z.B. "FG-NP 199", "FG NP 199")
 * @returns {string} - Bereinigtes Kennzeichen (z.B. "FGNP199")
 */
export function formatKennzeichen(raw) {
  if (!raw) return raw;
  
  // Nur Buchstaben und Zahlen, alles Großbuchstaben
  return raw.toUpperCase().replace(/[^A-Z0-9]/g, '');
}

/**
 * Prüft ob ein Unterscheidungszeichen gültig ist
 */
export function isValidPrefix(prefix) {
  return kennzeichenKuerzel.has(prefix.toUpperCase());
}

/**
 * Gibt alle geladenen Kürzel zurück
 */
export function getAllKuerzel() {
  return Array.from(kennzeichenKuerzel).sort();
}

export default { formatKennzeichen, isValidPrefix, getAllKuerzel };
