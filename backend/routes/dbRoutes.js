import express from 'express';
import { getDb, getFaelligkeitenUebersicht, getAllFahrzeugStatus, upsertFahrzeugStatus, insertAuditLog, getAuditLogByVin, getAllFahrzeuge, getAllTermine, importParsedData } from '../db/database.js';
import { adminOnly } from '../middleware/auth.js';

const router = express.Router();

// Hilfsfunktion: Anrede aus Namen entfernen
function cleanName(name) {
  if (!name) return name;
  return name.replace(/^(Herr |Frau )/i, '').trim();
}

// Statistiken
router.get('/stats', (req, res) => {
  try {
    const db = getDb();
    const stats = {
      fahrzeuge: db.prepare('SELECT COUNT(*) as count FROM fahrzeuge').get().count,
      kunden: db.prepare('SELECT COUNT(*) as count FROM kunden').get().count,
      termine: db.prepare('SELECT COUNT(*) as count FROM termine').get().count,
      service_faelligkeiten: db.prepare('SELECT COUNT(*) as count FROM service_faelligkeiten').get().count,
      fahrzeug_status: db.prepare('SELECT COUNT(*) as count FROM fahrzeug_status').get().count,
      audit_log: db.prepare('SELECT COUNT(*) as count FROM audit_log').get().count,
      users: db.prepare('SELECT COUNT(*) as count FROM users').get().count
    };
    res.json(stats);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Fälligkeiten-Übersicht
router.get('/faelligkeiten', (req, res) => {
  try {
    const db = getDb();
    
    // Einmalig: "Herr " und "Frau " aus allen Namen entfernen
    db.exec(`
      UPDATE kunden SET name = TRIM(SUBSTR(name, 6)) WHERE name LIKE 'Herr %';
      UPDATE kunden SET name = TRIM(SUBSTR(name, 6)) WHERE name LIKE 'Frau %';
    `);
    
    // DIREKTE QUERY
    const data = db.prepare(`
      SELECT 
        f.id as fahrzeug_id,
        f.vin,
        f.kennzeichen,
        f.hersteller,
        f.modell,
        k.name as kunde_name,
        k.strasse as kunde_strasse,
        k.plz as kunde_plz,
        k.ort as kunde_ort,
        k.telefon as kunde_telefon,
        k.email as kunde_email,
        (SELECT faelligkeitsdatum FROM service_faelligkeiten WHERE fahrzeug_id = f.id ORDER BY faelligkeitsdatum ASC LIMIT 1) as service_faellig,
        (SELECT bezeichnung FROM service_faelligkeiten WHERE fahrzeug_id = f.id ORDER BY faelligkeitsdatum ASC LIMIT 1) as service_bezeichnung,
        (SELECT datum FROM termine WHERE fahrzeug_id = f.id AND typ = 'inspektion' ORDER BY datum ASC LIMIT 1) as inspektion_termin,
        (SELECT vermerk FROM termine WHERE fahrzeug_id = f.id AND typ = 'inspektion' ORDER BY datum ASC LIMIT 1) as inspektion_vermerk,
        (SELECT datum FROM termine WHERE fahrzeug_id = f.id AND typ = 'hu' ORDER BY datum ASC LIMIT 1) as hu_termin
      FROM fahrzeuge f
      LEFT JOIN kunden k ON f.kunde_id = k.id
      ORDER BY f.kennzeichen
    `).all();
    
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Fahrzeug-Status (alle)
router.get('/fahrzeug-status', (req, res) => {
  try {
    const data = getAllFahrzeugStatus();
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Fahrzeug-Status aktualisieren
router.post('/fahrzeug-status', (req, res) => {
  try {
    console.log('fahrzeug-status req.body:', JSON.stringify(req.body, null, 2));
    
    // Sicherstellen dass alle Werte primitiv sind (string, number, null)
    const toSqlValue = (v) => {
      if (v === undefined || v === '') return null;
      if (typeof v === 'boolean') return v ? 1 : 0;
      if (typeof v === 'object') return JSON.stringify(v);
      return v;
    };
    
    const data = {
      vin: toSqlValue(req.body.vin),
      angeschrieben: toSqlValue(req.body.angeschrieben),
      service_termin: toSqlValue(req.body.service_termin),
      nachgefasst: toSqlValue(req.body.nachgefasst),
      ausgetragen: toSqlValue(req.body.ausgetragen),
      austragen_grund: toSqlValue(req.body.austragen_grund),
      wiedervorlage_datum: toSqlValue(req.body.wiedervorlage_datum),
      wiedervorlage_grund: toSqlValue(req.body.wiedervorlage_grund),
      notiz: toSqlValue(req.body.notiz),
      bearbeitet_von: toSqlValue(req.user?.id)
    };
    
    console.log('fahrzeug-status data:', JSON.stringify(data, null, 2));
    upsertFahrzeugStatus(data);
    
    // Audit-Log
    if (req.body.vin && req.user) {
      insertAuditLog({
        vin: req.body.vin,
        aktion: req.body.aktion || 'Status aktualisiert',
        feld: req.body.feld || null,
        alter_wert: req.body.alter_wert || null,
        neuer_wert: req.body.neuer_wert || null,
        user_id: req.user.id,
        user_name: req.user.username
      });
    }
    
    res.json({ success: true });
  } catch (err) {
    console.error('fahrzeug-status error:', err);
    res.status(500).json({ error: err.message });
  }
});

// Audit-Log für VIN
router.get('/audit-log/:vin', (req, res) => {
  try {
    const data = getAuditLogByVin(req.params.vin);
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Alle Fahrzeuge
router.get('/fahrzeuge', (req, res) => {
  try {
    const data = getAllFahrzeuge();
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Einzelnes Fahrzeug mit Kunde und Terminen
router.get('/fahrzeuge/:id', (req, res) => {
  try {
    const db = getDb();
    const { id } = req.params;
    
    const fahrzeug = db.prepare(`
      SELECT f.*, k.name as kunde_name, k.strasse as kunde_strasse, 
             k.plz as kunde_plz, k.ort as kunde_ort, k.telefon as kunde_telefon
      FROM fahrzeuge f
      LEFT JOIN kunden k ON f.kunde_id = k.id
      WHERE f.id = ?
    `).get(id);
    
    if (!fahrzeug) {
      return res.status(404).json({ error: 'Fahrzeug nicht gefunden' });
    }
    
    const termine = db.prepare(`
      SELECT typ, datum FROM termine WHERE fahrzeug_id = ? ORDER BY datum DESC
    `).all(id);
    
    res.json({
      ...fahrzeug,
      kunde: fahrzeug.kunde_name ? {
        name: fahrzeug.kunde_name,
        strasse: fahrzeug.kunde_strasse,
        plz: fahrzeug.kunde_plz,
        ort: fahrzeug.kunde_ort,
        telefon: fahrzeug.kunde_telefon
      } : null,
      termine
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Kundendaten aktualisieren (per Fahrzeug-ID)
router.post('/fahrzeuge/:id/kunde', (req, res) => {
  try {
    const db = getDb();
    const { id } = req.params;
    const { name, telefon, email, strasse, plz, ort, notizen } = req.body;
    
    // Fahrzeug holen
    const fahrzeug = db.prepare('SELECT * FROM fahrzeuge WHERE id = ?').get(id);
    if (!fahrzeug) {
      return res.status(404).json({ error: 'Fahrzeug nicht gefunden' });
    }
    
    // Kunde aktualisieren oder erstellen
    if (fahrzeug.kunde_id) {
      // DEBUG: Kunde vor Update
      const kundeBefore = db.prepare('SELECT * FROM kunden WHERE id = ?').get(fahrzeug.kunde_id);
      console.log('KUNDE VOR UPDATE:', JSON.stringify(kundeBefore));
      console.log('UPDATE MIT:', { name, telefon, email, strasse, plz, ort, kunde_id: fahrzeug.kunde_id });
      
      // Existierenden Kunden aktualisieren
      const result = db.prepare(`
        UPDATE kunden SET 
          name = ?,
          telefon = ?,
          email = ?,
          strasse = ?,
          plz = ?,
          ort = ?
        WHERE id = ?
      `).run(cleanName(name) || 'Unbekannt', telefon, email, strasse, plz, ort, fahrzeug.kunde_id);
      
      console.log('UPDATE RESULT:', result);
      
      // DEBUG: Kunde nach Update
      const kundeAfter = db.prepare('SELECT * FROM kunden WHERE id = ?').get(fahrzeug.kunde_id);
      console.log('KUNDE NACH UPDATE:', JSON.stringify(kundeAfter));
    } else {
      // Neuen Kunden erstellen und mit Fahrzeug verknüpfen
      const result = db.prepare(`
        INSERT INTO kunden (name, telefon, email, strasse, plz, ort)
        VALUES (?, ?, ?, ?, ?, ?)
      `).run(cleanName(name) || 'Unbekannt', telefon, email, strasse, plz, ort);
      
      db.prepare('UPDATE fahrzeuge SET kunde_id = ? WHERE id = ?').run(result.lastInsertRowid, id);
    }
    
    // Notizen in fahrzeug_status speichern
    if (notizen !== undefined) {
      db.prepare(`
        INSERT INTO fahrzeug_status (vin, notiz) 
        VALUES (?, ?)
        ON CONFLICT(vin) DO UPDATE SET notiz = ?
      `).run(fahrzeug.vin, notizen, notizen);
    }
    
    // Audit-Log
    if (req.user) {
      insertAuditLog({
        vin: fahrzeug.vin,
        aktion: 'Kundendaten aktualisiert',
        feld: 'kunde',
        alter_wert: null,
        neuer_wert: name,
        user_id: req.user.id,
        user_name: req.user.username
      });
    }
    
    res.json({ success: true });
  } catch (err) {
    console.error('Kunde update error:', err);
    res.status(500).json({ error: err.message });
  }
});

// Alle Termine (optional mit VIN-Filter)
router.get('/termine', (req, res) => {
  try {
    const db = getDb();
    if (req.query.vin) {
      const data = db.prepare(`
        SELECT t.* FROM termine t
        JOIN fahrzeuge f ON t.fahrzeug_id = f.id
        WHERE f.vin = ?
        ORDER BY t.datum DESC
      `).all(req.query.vin);
      res.json(data);
    } else {
      const data = getAllTermine();
      res.json(data);
    }
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Import-Vorschau - KONSOLIDIERT aus HU, Inspektion UND XLSX
router.post('/import-preview', (req, res) => {
  try {
    const db = getDb();
    const parsedData = req.body;
    const preview = { neu: [], aktualisiert: [], unveraendert: [] };
    
    // 1. Zuerst alle Daten per VIN zusammenführen
    const consolidated = {};
    
    // HU-Daten haben Kundendaten!
    if (parsedData.hu) {
      for (const record of parsedData.hu) {
        const vin = record.Fahrgestellnr;
        if (!vin) continue;
        consolidated[vin] = consolidated[vin] || { quellen: [], _parseHints: [] };
        consolidated[vin].quellen.push('HU');
        consolidated[vin].kennzeichen = record.Kennzeichen || consolidated[vin].kennzeichen;
        consolidated[vin].hersteller = record.Hersteller || consolidated[vin].hersteller;
        consolidated[vin].kunde = record.Name || consolidated[vin].kunde;
        consolidated[vin].adresse = record.Strasse || consolidated[vin].adresse;
        consolidated[vin].plz = record.PLZ || consolidated[vin].plz;
        consolidated[vin].ort = record.Ort || consolidated[vin].ort;
        consolidated[vin].telefon = record.Telefon || consolidated[vin].telefon;
        consolidated[vin].handy = record.Handy || consolidated[vin].handy;
        consolidated[vin].huTermin = record.HU_Datum;
        consolidated[vin].kdnr = record.KdNr;
        // Parsing-Hinweise durchreichen
        if (record._parseHints) {
          consolidated[vin]._parseHints.push(...record._parseHints);
        }
      }
    }
    
    // Inspektion-Daten haben Kundendaten!
    if (parsedData.inspektion) {
      for (const record of parsedData.inspektion) {
        const vin = record.Fahrgestellnr;
        if (!vin) continue;
        consolidated[vin] = consolidated[vin] || { quellen: [], _parseHints: [] };
        consolidated[vin].quellen.push('Inspektion');
        consolidated[vin].kennzeichen = record.Kennzeichen || consolidated[vin].kennzeichen;
        consolidated[vin].hersteller = record.Hersteller || consolidated[vin].hersteller;
        consolidated[vin].kunde = record.Name || consolidated[vin].kunde;
        consolidated[vin].adresse = record.Strasse || consolidated[vin].adresse;
        consolidated[vin].plz = record.PLZ || consolidated[vin].plz;
        consolidated[vin].ort = record.Ort || consolidated[vin].ort;
        consolidated[vin].telefon = record.Telefon || consolidated[vin].telefon;
        consolidated[vin].handy = record.Handy || consolidated[vin].handy;
        consolidated[vin].inspektionTermin = record.Inspektion;
        consolidated[vin].kdnr = record.KdNr || consolidated[vin].kdnr;
        // Parsing-Hinweise durchreichen
        if (record._parseHints) {
          consolidated[vin]._parseHints = consolidated[vin]._parseHints || [];
          consolidated[vin]._parseHints.push(...record._parseHints);
        }
      }
    }
    
    // XLSX-Daten - Service-Fälligkeiten (Kundendaten oft leer!)
    if (parsedData.service) {
      for (const record of parsedData.service) {
        const vin = record.Fahrgestellnr;
        if (!vin) continue;
        consolidated[vin] = consolidated[vin] || { quellen: [], _parseHints: [] };
        consolidated[vin].quellen.push('XLSX');
        consolidated[vin].kennzeichen = record.Kennzeichen || consolidated[vin].kennzeichen;
        // NUR überschreiben wenn XLSX-Daten NICHT leer sind
        if (record.Name) consolidated[vin].kunde = record.Name;
        if (record.Adresse) consolidated[vin].adresse = record.Adresse;
        if (record.PLZ) consolidated[vin].plz = record.PLZ;
        if (record.Ort) consolidated[vin].ort = record.Ort;
        if (record.Telefon || record.Handy) consolidated[vin].telefon = record.Telefon || record.Handy;
        if (record.Email) consolidated[vin].email = record.Email;
        consolidated[vin].serviceFaellig = record.Faelligkeitsdatum;
        consolidated[vin].serviceBezeichnung = record.Bezeichnung;
      }
    }
    
    // Hilfsfunktion: Datum normalisieren für Vergleich
    const normalizeDate = (dateStr) => {
      if (!dateStr) return null;
      // YYYY/MM/DD -> YYYY-MM-DD
      if (dateStr.includes('/')) {
        return dateStr.replace(/\//g, '-');
      }
      // DD.MM.YYYY -> YYYY-MM-DD
      if (dateStr.includes('.')) {
        const [d, m, y] = dateStr.split('.');
        return `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`;
      }
      return dateStr;
    };
    
    const datesEqual = (d1, d2) => {
      return normalizeDate(d1) === normalizeDate(d2);
    };

    // 2. Jetzt für jeden konsolidierten Datensatz prüfen ob neu oder update
    for (const [vin, data] of Object.entries(consolidated)) {
      const existing = db.prepare(`
        SELECT f.*, k.name as kunde_name, k.strasse, k.plz, k.ort, k.telefon, k.email
        FROM fahrzeuge f
        LEFT JOIN kunden k ON f.kunde_id = k.id
        WHERE f.vin = ?
      `).get(vin);
      
      // Bestehende Termine laden
      const existingService = existing ? db.prepare(`
        SELECT faelligkeitsdatum FROM service_faelligkeiten WHERE fahrzeug_id = ? ORDER BY faelligkeitsdatum DESC LIMIT 1
      `).get(existing.id) : null;
      
      const existingHU = existing ? db.prepare(`
        SELECT datum FROM termine WHERE fahrzeug_id = ? AND typ = 'hu' ORDER BY datum DESC LIMIT 1
      `).get(existing.id) : null;
      
      const existingInsp = existing ? db.prepare(`
        SELECT datum FROM termine WHERE fahrzeug_id = ? AND typ = 'inspektion' ORDER BY datum DESC LIMIT 1
      `).get(existing.id) : null;
      
      if (existing) {
        // Prüfe welche Felder sich ändern
        const aenderungen = [];
        
        if (data.kunde && data.kunde !== existing.kunde_name) {
          aenderungen.push({ feld: 'Kunde', alt: existing.kunde_name, neu: data.kunde });
        }
        if (data.adresse && data.adresse !== existing.strasse) {
          aenderungen.push({ feld: 'Straße', alt: existing.strasse, neu: data.adresse });
        }
        if (data.plz && data.plz !== existing.plz) {
          aenderungen.push({ feld: 'PLZ', alt: existing.plz, neu: data.plz });
        }
        if (data.ort && data.ort !== existing.ort) {
          aenderungen.push({ feld: 'Ort', alt: existing.ort, neu: data.ort });
        }
        if (data.telefon && data.telefon !== existing.telefon) {
          aenderungen.push({ feld: 'Telefon', alt: existing.telefon, neu: data.telefon });
        }
        
        // Termine vergleichen mit Datumsvergleich
        if (data.serviceFaellig) {
          const existingDate = existingService?.faelligkeitsdatum;
          if (!datesEqual(existingDate, data.serviceFaellig)) {
            aenderungen.push({ feld: 'Service', alt: existingDate, neu: data.serviceFaellig });
          }
        }
        if (data.huTermin) {
          const existingDate = existingHU?.datum;
          if (!datesEqual(existingDate, data.huTermin)) {
            aenderungen.push({ feld: 'HU', alt: existingDate, neu: data.huTermin });
          }
        }
        if (data.inspektionTermin) {
          const existingDate = existingInsp?.datum;
          if (!datesEqual(existingDate, data.inspektionTermin)) {
            aenderungen.push({ feld: 'Inspektion', alt: existingDate, neu: data.inspektionTermin });
          }
        }
        
        if (aenderungen.length > 0) {
          preview.aktualisiert.push({ 
            vin, 
            kennzeichen: data.kennzeichen || existing.kennzeichen,
            kunde: data.kunde || existing.kunde_name,
            adresse: data.adresse || existing.strasse,
            plz: data.plz || existing.plz,
            ort: data.ort || existing.ort,
            telefon: data.telefon || existing.telefon,
            handy: data.handy,
            aenderungen,
            quellen: [...new Set(data.quellen)],
            _parseHints: data._parseHints || []
          });
        } else {
          preview.unveraendert.push({ vin, kennzeichen: existing.kennzeichen });
        }
      } else {
        preview.neu.push({ 
          vin, 
          kennzeichen: data.kennzeichen,
          kunde: data.kunde,
          adresse: data.adresse,
          plz: data.plz,
          ort: data.ort,
          telefon: data.telefon,
          handy: data.handy,
          email: data.email,
          faelligkeit: data.serviceFaellig,
          huTermin: data.huTermin,
          inspektionTermin: data.inspektionTermin,
          quellen: [...new Set(data.quellen)],
          _parseHints: data._parseHints || []
        });
      }
    }
    
    res.json({
      success: true,
      summary: {
        neu: preview.neu.length,
        aktualisiert: preview.aktualisiert.length,
        unveraendert: preview.unveraendert.length
      },
      preview
    });
  } catch (err) {
    console.error('import-preview error:', err);
    res.status(500).json({ error: err.message });
  }
});

// Selektiver Import (nur ausgewählte VINs)
router.post('/import-selective', (req, res) => {
  try {
    const { vinsToImport, parsedData } = req.body;
    const vinSet = new Set(vinsToImport);
    
    // Filtere parsedData auf ausgewählte VINs
    const filteredData = {
      hu: (parsedData.hu || []).filter(r => vinSet.has(r.Fahrgestellnr)),
      inspektion: (parsedData.inspektion || []).filter(r => vinSet.has(r.Fahrgestellnr)),
      service: (parsedData.service || []).filter(r => vinSet.has(r.Fahrgestellnr)),
      merged: {}
    };
    
    // Import durchführen
    const stats = importParsedData(filteredData);
    
    res.json({ success: true, stats });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Datenbank zurücksetzen (nur Admin)
router.post('/reset', adminOnly, (req, res) => {
  try {
    const db = getDb();
    // Foreign Keys temporär deaktivieren für sauberes Löschen
    db.exec(`
      PRAGMA foreign_keys = OFF;
      DELETE FROM audit_log;
      DELETE FROM fahrzeug_status;
      DELETE FROM service_faelligkeiten;
      DELETE FROM termine;
      DELETE FROM kunden;
      DELETE FROM fahrzeuge;
      PRAGMA foreign_keys = ON;
    `);
    res.json({ success: true, message: 'Datenbank geleert (User bleiben erhalten)' });
  } catch (err) {
    console.error('DB Reset error:', err);
    res.status(500).json({ error: err.message });
  }
});

// ============================================
// KAPAZITÄTS-EINSTELLUNGEN
// ============================================

// Kapazitäten pro Wochentag abrufen
router.get('/kapazitaeten', (req, res) => {
  try {
    const db = getDb();
    const kapazitaeten = db.prepare(`SELECT * FROM kapazitaeten ORDER BY wochentag`).all();
    const defaultKap = db.prepare(`SELECT value FROM settings WHERE key = 'default_kapazitaet'`).get();
    res.json({ 
      kapazitaeten, 
      default_kapazitaet: parseInt(defaultKap?.value || '8') 
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Kapazität für Wochentag aktualisieren
router.put('/kapazitaeten/:wochentag', adminOnly, (req, res) => {
  try {
    const db = getDb();
    const { wochentag } = req.params;
    const { max_termine, aktiv } = req.body;
    
    db.prepare(`
      UPDATE kapazitaeten SET max_termine = ?, aktiv = ?
      WHERE wochentag = ?
    `).run(max_termine, aktiv ? 1 : 0, wochentag);
    
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Default-Kapazität aktualisieren
router.put('/settings/default-kapazitaet', adminOnly, (req, res) => {
  try {
    const db = getDb();
    const { value } = req.body;
    
    db.prepare(`
      INSERT OR REPLACE INTO settings (key, value, updated_at) 
      VALUES ('default_kapazitaet', ?, CURRENT_TIMESTAMP)
    `).run(String(value));
    
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ============================================
// AUSLASTUNGS-ANSICHT
// ============================================

// Termine pro Tag für Zeitraum (Auslastung) - GEPLANTE Termine!
router.get('/auslastung', (req, res) => {
  try {
    const db = getDb();
    const { von, bis } = req.query;
    
    // Geplante Termine aus der neuen Tabelle
    const termine = db.prepare(`
      SELECT 
        gt.datum as tag,
        gt.typ,
        f.kennzeichen,
        f.id as fahrzeug_id
      FROM geplante_termine gt
      JOIN fahrzeuge f ON gt.fahrzeug_id = f.id
      WHERE gt.datum >= ? AND gt.datum <= ?
      ORDER BY gt.datum
    `).all(von, bis);
    
    // Kapazitäten (Wochentage)
    const kapazitaeten = db.prepare(`SELECT * FROM kapazitaeten`).all();
    const kapMap = {};
    kapazitaeten.forEach(k => { kapMap[k.wochentag] = k; });
    
    // Kapazitäts-Ausnahmen für bestimmte Tage
    const ausnahmen = db.prepare(`
      SELECT datum, max_termine, notiz FROM kapazitaet_ausnahmen 
      WHERE datum >= ? AND datum <= ?
    `).all(von, bis);
    const ausnahmenMap = {};
    ausnahmen.forEach(a => { ausnahmenMap[a.datum] = a; });
    
    // Zusammenführen nach Tag
    const result = {};
    termine.forEach(t => {
      result[t.tag] = result[t.tag] || { items: [] };
      result[t.tag].items.push({ kennzeichen: t.kennzeichen, typ: t.typ, fahrzeug_id: t.fahrzeug_id });
    });
    
    res.json({ 
      tage: result, 
      kapazitaeten: kapMap,
      ausnahmen: ausnahmenMap
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Geplanten Termin erstellen/aktualisieren
router.post('/geplante-termine', (req, res) => {
  try {
    const db = getDb();
    const { fahrzeug_id, typ, datum, notiz } = req.body;
    const userId = req.user?.id;
    
    // Prüfen ob schon ein Termin dieses Typs existiert
    const existing = db.prepare(`
      SELECT id FROM geplante_termine WHERE fahrzeug_id = ? AND typ = ?
    `).get(fahrzeug_id, typ);
    
    if (existing) {
      // Update
      db.prepare(`
        UPDATE geplante_termine SET datum = ?, notiz = ?, erstellt_von = ?, updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `).run(datum, notiz || null, userId, existing.id);
    } else {
      // Insert
      db.prepare(`
        INSERT INTO geplante_termine (fahrzeug_id, typ, datum, notiz, erstellt_von)
        VALUES (?, ?, ?, ?, ?)
      `).run(fahrzeug_id, typ, datum, notiz || null, userId);
    }
    
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Geplanten Termin löschen
router.delete('/geplante-termine/:id', (req, res) => {
  try {
    const db = getDb();
    db.prepare(`DELETE FROM geplante_termine WHERE id = ?`).run(req.params.id);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Geplante Termine für ein Fahrzeug
router.get('/geplante-termine/:fahrzeugId', (req, res) => {
  try {
    const db = getDb();
    const termine = db.prepare(`
      SELECT * FROM geplante_termine WHERE fahrzeug_id = ? ORDER BY datum
    `).all(req.params.fahrzeugId);
    res.json(termine);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ============================================
// KAPAZITÄTS-AUSNAHMEN
// ============================================

// Kapazitäts-Ausnahme für einen Tag setzen/aktualisieren
router.post('/kapazitaet-ausnahme', (req, res) => {
  try {
    const db = getDb();
    const { datum, max_termine, notiz } = req.body;
    const userId = req.user?.id;
    
    db.prepare(`
      INSERT OR REPLACE INTO kapazitaet_ausnahmen (datum, max_termine, notiz, erstellt_von)
      VALUES (?, ?, ?, ?)
    `).run(datum, max_termine, notiz || null, userId);
    
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Kapazitäts-Ausnahme löschen (zurück zu Standard)
router.delete('/kapazitaet-ausnahme/:datum', (req, res) => {
  try {
    const db = getDb();
    db.prepare(`DELETE FROM kapazitaet_ausnahmen WHERE datum = ?`).run(req.params.datum);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Fahrzeug-Suche für Termin-Zuweisung
router.get('/fahrzeuge-suche', (req, res) => {
  try {
    const db = getDb();
    const { q } = req.query;
    
    if (!q || q.length < 2) {
      return res.json([]);
    }
    
    const fahrzeuge = db.prepare(`
      SELECT f.id, f.kennzeichen, f.vin, k.name as kunde
      FROM fahrzeuge f
      LEFT JOIN kunden k ON f.kunde_id = k.id
      WHERE f.kennzeichen LIKE ? OR k.name LIKE ?
      LIMIT 10
    `).all(`%${q}%`, `%${q}%`);
    
    res.json(fahrzeuge);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Details für einen bestimmten Tag
router.get('/auslastung/:datum', (req, res) => {
  try {
    const db = getDb();
    const { datum } = req.params;
    
    // Termine an diesem Tag
    const termine = db.prepare(`
      SELECT t.*, f.kennzeichen, f.vin, k.name as kunde_name
      FROM termine t
      JOIN fahrzeuge f ON t.fahrzeug_id = f.id
      LEFT JOIN kunden k ON f.kunde_id = k.id
      WHERE date(t.datum) = ?
    `).all(datum);
    
    // Service-Fälligkeiten an diesem Tag
    const services = db.prepare(`
      SELECT s.*, f.kennzeichen, f.vin, k.name as kunde_name
      FROM service_faelligkeiten s
      JOIN fahrzeuge f ON s.fahrzeug_id = f.id
      LEFT JOIN kunden k ON f.kunde_id = k.id
      WHERE date(s.faelligkeitsdatum) = ?
    `).all(datum);
    
    res.json({ termine, services });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;