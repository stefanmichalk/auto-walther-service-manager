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
 * Formatiert ein Kennzeichen ins Format "AA-BB 123" oder "AAA-BB 123"
 * @param {string} raw - Rohes Kennzeichen (z.B. "FGNP199", "FG-NP199", "FG NP 199")
 * @returns {string} - Formatiertes Kennzeichen (z.B. "FG-NP 199")
 */
export function formatKennzeichen(raw) {
  if (!raw) return raw;
  
  // Entferne alle Leerzeichen und Bindestriche
  let clean = raw.toUpperCase().replace(/[\s\-]/g, '');
  
  // Finde das Unterscheidungszeichen (1-3 Buchstaben am Anfang)
  let prefix = '';
  let rest = clean;
  
  // Versuche 3, dann 2, dann 1 Buchstaben zu matchen
  for (let len = 3; len >= 1; len--) {
    const candidate = clean.substring(0, len);
    if (kennzeichenKuerzel.has(candidate)) {
      prefix = candidate;
      rest = clean.substring(len);
      break;
    }
  }
  
  // Fallback: Nimm erste 1-3 Großbuchstaben
  if (!prefix) {
    const match = clean.match(/^([A-Z]{1,3})/);
    if (match) {
      prefix = match[1];
      rest = clean.substring(prefix.length);
    }
  }
  
  if (!prefix) return raw;
  
  // Rest aufteilen in Buchstaben und Zahlen
  const restMatch = rest.match(/^([A-Z]{1,2})(\d+[A-Z]?)$/);
  if (restMatch) {
    const letters = restMatch[1];
    const numbers = restMatch[2];
    return `${prefix}-${letters} ${numbers}`;
  }
  
  // Alternatives Format: Nur Zahlen nach Prefix
  const numMatch = rest.match(/^(\d+[A-Z]?)$/);
  if (numMatch) {
    return `${prefix}-${numMatch[1]}`;
  }
  
  // Wenn nichts passt, original zurückgeben
  return raw;
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
