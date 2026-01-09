import express from 'express';
import * as db from '../db/database.js';
import { formatKennzeichen } from '../utils/kennzeichenFormatter.js';

const router = express.Router();

// Alle Fahrzeuge abrufen
router.get('/fahrzeuge', (req, res) => {
  try {
    const fahrzeuge = db.getAllFahrzeuge();
    res.json(fahrzeuge);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Fahrzeug nach VIN
router.get('/fahrzeuge/:vin', (req, res) => {
  try {
    const fahrzeug = db.getFahrzeugByVin(req.params.vin);
    if (!fahrzeug) {
      return res.status(404).json({ error: 'Fahrzeug nicht gefunden' });
    }
    res.json(fahrzeug);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Neues Fahrzeug anlegen
router.post('/fahrzeuge', (req, res) => {
  try {
    const result = db.insertFahrzeug(req.body);
    res.json({ success: true, id: result.lastInsertRowid });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Alle Termine abrufen
router.get('/termine', (req, res) => {
  try {
    const termine = db.getAllTermine();
    res.json(termine);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Termine für ein Fahrzeug
router.get('/termine/fahrzeug/:id', (req, res) => {
  try {
    const termine = db.getTermineByFahrzeug(req.params.id);
    res.json(termine);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Neuen Termin anlegen
router.post('/termine', (req, res) => {
  try {
    const { vin, typ, datum, km_stand, bezeichnung, vermerk } = req.body;
    
    // Fahrzeug finden oder anlegen
    let fahrzeug = db.getFahrzeugByVin(vin);
    if (!fahrzeug) {
      db.insertFahrzeug({ vin, kennzeichen: req.body.kennzeichen || null, hersteller: null, modell: null, erstzulassung: null });
      fahrzeug = db.getFahrzeugByVin(vin);
    }
    
    const result = db.insertTermin({
      fahrzeug_id: fahrzeug.id,
      typ,
      datum,
      km_stand: km_stand || null,
      bezeichnung: bezeichnung || null,
      vermerk: vermerk || null,
      status: 'geplant',
      quelle: 'manuell'
    });
    
    res.json({ success: true, id: result.lastInsertRowid });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Termin-Status aktualisieren
router.patch('/termine/:id/status', (req, res) => {
  try {
    const { status } = req.body;
    db.updateTerminStatus(req.params.id, status);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Termin löschen
router.delete('/termine/:id', (req, res) => {
  try {
    db.deleteTermin(req.params.id);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Fälligkeiten-Übersicht aus DB
router.get('/faelligkeiten-db', (req, res) => {
  try {
    const data = db.getFaelligkeitenUebersicht();
    res.json(data);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Daten in DB importieren
router.post('/import', (req, res) => {
  try {
    const { parsedData } = req.body;
    const stats = db.importParsedData(parsedData);
    res.json({ success: true, stats });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// === USER ROUTES ===

// Login
router.post('/login', (req, res) => {
  try {
    const { username, password } = req.body;
    const user = db.getUserByUsername(username);
    
    if (!user) {
      return res.status(401).json({ error: 'Benutzer nicht gefunden' });
    }
    
    // Simple password check (in production use bcrypt!)
    if (user.password_hash !== password) {
      return res.status(401).json({ error: 'Falsches Passwort' });
    }
    
    db.updateLastLogin(user.id);
    res.json({ 
      success: true, 
      user: { id: user.id, username: user.username, name: user.name, role: user.role }
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// User anlegen (nur für Admin)
router.post('/users', (req, res) => {
  try {
    const { username, password, name, role } = req.body;
    const result = db.createUser({ 
      username, 
      password_hash: password, // In production: bcrypt hash!
      name: name || username,
      role: role || 'user'
    });
    res.json({ success: true, id: result.lastInsertRowid });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Alle User abrufen
router.get('/users', (req, res) => {
  try {
    const users = db.getAllUsers();
    res.json(users);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// === FAHRZEUG-STATUS ROUTES ===

// Status für alle Fahrzeuge abrufen
router.get('/fahrzeug-status', (req, res) => {
  try {
    const status = db.getAllFahrzeugStatus();
    res.json(status);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Status aktualisieren (angeschrieben, service_termin, nachgefasst, austragen, wiedervorlage)
router.post('/fahrzeug-status', (req, res) => {
  try {
    const { vin, angeschrieben, service_termin, nachgefasst, ausgetragen, austragen_grund, wiedervorlage_datum, wiedervorlage_grund, notiz, bearbeitet_von, user_name } = req.body;
    
    // Alten Status holen für Audit-Log
    const oldStatus = db.getFahrzeugStatus(vin) || {};
    
    // Status aktualisieren
    db.upsertFahrzeugStatus({
      vin,
      angeschrieben: angeschrieben ? 1 : 0,
      service_termin: service_termin || null,
      nachgefasst: nachgefasst ? 1 : 0,
      ausgetragen: ausgetragen ? 1 : 0,
      austragen_grund: austragen_grund || null,
      wiedervorlage_datum: wiedervorlage_datum || null,
      wiedervorlage_grund: wiedervorlage_grund || null,
      notiz: notiz || null,
      bearbeitet_von: bearbeitet_von || null
    });
    
    // Audit-Log Einträge erstellen für Änderungen
    const changes = [];
    const normalize = (v) => v || null; // undefined, '', null → null
    
    if (!!oldStatus.angeschrieben !== !!angeschrieben) {
      changes.push({ feld: 'angeschrieben', alter_wert: oldStatus.angeschrieben ? 'Ja' : 'Nein', neuer_wert: angeschrieben ? 'Ja' : 'Nein' });
    }
    if (normalize(oldStatus.service_termin) !== normalize(service_termin)) {
      changes.push({ feld: 'service_termin', alter_wert: oldStatus.service_termin || '-', neuer_wert: service_termin || '-' });
    }
    if (!!oldStatus.nachgefasst !== !!nachgefasst) {
      changes.push({ feld: 'nachgefasst', alter_wert: oldStatus.nachgefasst ? 'Ja' : 'Nein', neuer_wert: nachgefasst ? 'Ja' : 'Nein' });
    }
    if (!!oldStatus.ausgetragen !== !!ausgetragen) {
      changes.push({ feld: 'ausgetragen', alter_wert: oldStatus.ausgetragen ? 'Ja' : 'Nein', neuer_wert: ausgetragen ? 'Ja' : 'Nein', aktion: 'Ausgetragen' });
    }
    if (normalize(oldStatus.wiedervorlage_datum) !== normalize(wiedervorlage_datum)) {
      changes.push({ feld: 'wiedervorlage_datum', alter_wert: oldStatus.wiedervorlage_datum || '-', neuer_wert: wiedervorlage_datum || '-', aktion: 'Wiedervorlage' });
    }
    
    // Log-Einträge schreiben
    for (const change of changes) {
      db.insertAuditLog({
        vin,
        aktion: change.aktion || 'Status geändert',
        feld: change.feld,
        alter_wert: change.alter_wert,
        neuer_wert: change.neuer_wert,
        user_id: bearbeitet_von || null,
        user_name: user_name || 'System'
      });
    }
    
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// === IMPORT PREVIEW (Merge-Konzept) ===

// Vorschau: Was würde importiert werden, was gibt es schon, was ist anders?
router.post('/import-preview', async (req, res) => {
  try {
    const parsedData = req.body;
    
    const preview = {
      neu: [],        // Komplett neue Fahrzeuge
      aktualisiert: [], // Fahrzeuge mit Änderungen
      unveraendert: [], // Keine Änderungen
      konflikte: []     // Manuelle Entscheidung nötig
    };
    
    // Alle Quellen durchgehen
    const allRecords = [
      ...(parsedData.hu || []).map(r => ({ ...r, quelle: 'hu' })),
      ...(parsedData.inspektion || []).map(r => ({ ...r, quelle: 'inspektion' })),
      ...(parsedData.service || []).map(r => ({ ...r, quelle: 'service' }))
    ];
    
    // Nach VIN gruppieren
    const byVin = {};
    for (const record of allRecords) {
      if (!record.Fahrgestellnr) continue;
      if (!byVin[record.Fahrgestellnr]) {
        byVin[record.Fahrgestellnr] = { records: [], vin: record.Fahrgestellnr };
      }
      byVin[record.Fahrgestellnr].records.push(record);
    }
    
    // Mit DB vergleichen
    for (const vin of Object.keys(byVin)) {
      const existing = db.getFahrzeugByVin(vin);
      const newData = byVin[vin].records[0]; // Erstes Record nehmen
      
      if (!existing) {
        // Komplett neu
        preview.neu.push({
          vin,
          kennzeichen: newData.Kennzeichen,
          kunde: newData.Name,
          quellen: byVin[vin].records.map(r => r.quelle)
        });
      } else {
        // Vergleichen - Kennzeichen formatieren vor Vergleich
        const aenderungen = [];
        const formattedNewKennzeichen = newData.Kennzeichen ? formatKennzeichen(newData.Kennzeichen) : null;
        
        // Kennzeichen nur vergleichen wenn formatiert unterschiedlich
        if (formattedNewKennzeichen && formattedNewKennzeichen !== existing.kennzeichen) {
          aenderungen.push({
            feld: 'kennzeichen',
            alt: existing.kennzeichen,
            neu: formattedNewKennzeichen
          });
        }
        if (newData.Name && newData.Name !== existing.kunde_name) {
          aenderungen.push({
            feld: 'kunde_name',
            alt: existing.kunde_name,
            neu: newData.Name
          });
        }
        
        if (aenderungen.length > 0) {
          preview.aktualisiert.push({
            vin,
            kennzeichen: existing.kennzeichen,
            kunde: existing.kunde_name,
            aenderungen
          });
        } else {
          preview.unveraendert.push({
            vin,
            kennzeichen: existing.kennzeichen
          });
        }
      }
    }
    
    res.json({
      success: true,
      preview,
      summary: {
        neu: preview.neu.length,
        aktualisiert: preview.aktualisiert.length,
        unveraendert: preview.unveraendert.length
      }
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Selektiver Import: Nur ausgewählte Datensätze importieren
router.post('/import-selective', (req, res) => {
  try {
    const { vinsToImport, parsedData } = req.body;
    const vinSet = new Set(vinsToImport);
    
    // Nur ausgewählte VINs importieren
    const filteredData = {
      hu: (parsedData.hu || []).filter(r => vinSet.has(r.Fahrgestellnr)),
      inspektion: (parsedData.inspektion || []).filter(r => vinSet.has(r.Fahrgestellnr)),
      service: (parsedData.service || []).filter(r => vinSet.has(r.Fahrgestellnr))
    };
    
    const stats = db.importParsedData(filteredData);
    res.json({ success: true, stats });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// === DB RESET ===

// Datenbank zurücksetzen (alle Fahrzeuge, Termine, Service-Fälligkeiten löschen)
router.post('/reset', (req, res) => {
  try {
    const dbInstance = db.getDb();
    dbInstance.exec(`
      DELETE FROM audit_log;
      DELETE FROM fahrzeug_status;
      DELETE FROM service_faelligkeiten;
      DELETE FROM termine;
      DELETE FROM fahrzeug_kunde;
      DELETE FROM kunden;
      DELETE FROM fahrzeuge;
    `);
    res.json({ success: true, message: 'Datenbank zurückgesetzt' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// === FÄLLIGKEITEN AUS DB ===

// Fälligkeiten-Übersicht aus DB (für Multi-User)
router.get('/faelligkeiten', (req, res) => {
  try {
    const rawData = db.getFaelligkeitenUebersicht();
    const statusList = db.getAllFahrzeugStatus();
    
    // Status-Map erstellen
    const statusMap = {};
    statusList.forEach(s => {
      statusMap[s.vin] = s;
    });
    
    // Hilfsfunktion für sichere Datumsformatierung
    const formatDate = (dateStr) => {
      if (!dateStr) return null;
      try {
        // Prüfe ob bereits im deutschen Format (DD.MM.YYYY)
        if (/^\d{1,2}\.\d{1,2}\.\d{4}$/.test(dateStr)) {
          return dateStr;
        }
        // ISO oder anderes Format parsen
        const d = new Date(dateStr);
        if (isNaN(d.getTime())) return null;
        return d.toLocaleDateString('de-DE');
      } catch {
        return null;
      }
    };

    // Daten aufbereiten im erwarteten Format
    const faelligkeiten = rawData
      .filter(row => row.vin) // Nur Einträge mit VIN
      .map(row => {
        const status = statusMap[row.vin] || {};
        
        // Frühestes Datum ermitteln (Rohdaten für Sortierung)
        const dates = [
          row.service_faellig,
          row.inspektion_termin,
          row.hu_termin
        ].filter(Boolean).sort();
        
        const nextDateRaw = dates[0] || null;
        
        // Dringlichkeit berechnen
        let urgency = 'normal';
        if (nextDateRaw) {
          const d = new Date(nextDateRaw);
          if (!isNaN(d.getTime())) {
            const diff = (d - new Date()) / (1000 * 60 * 60 * 24);
            if (diff < 0) urgency = 'ueberfaellig';
            else if (diff <= 7) urgency = 'dringend';
          }
        }
        
        return {
          vin: row.vin,
          kennzeichen: row.kennzeichen,
          kunde: row.kunde_name || row.kunde || '',
          nextDate: formatDate(nextDateRaw),
          nextDateRaw: nextDateRaw,
          serviceFaellig: formatDate(row.service_faellig),
          serviceBezeichnung: row.service_bezeichnung,
          inspektionTermin: formatDate(row.inspektion_termin),
          inspektionVermerk: row.inspektion_vermerk,
          huTermin: formatDate(row.hu_termin),
          urgency,
          status
        };
      })
      .filter(f => f.nextDate) // Nur mit Datum
      .sort((a, b) => {
        const dateA = a.nextDate ? new Date(a.nextDate.split('.').reverse().join('-')) : new Date('9999-12-31');
        const dateB = b.nextDate ? new Date(b.nextDate.split('.').reverse().join('-')) : new Date('9999-12-31');
        return dateA - dateB;
      });
    
    res.json(faelligkeiten);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// === AUDIT-LOG ROUTES ===

// Alle Audit-Logs abrufen
router.get('/audit-log', (req, res) => {
  try {
    const logs = db.getAllAuditLog();
    res.json(logs);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Audit-Log für ein Fahrzeug
router.get('/audit-log/:vin', (req, res) => {
  try {
    const logs = db.getAuditLogByVin(req.params.vin);
    res.json(logs);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

export default router;
