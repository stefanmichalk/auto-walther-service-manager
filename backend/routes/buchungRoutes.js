import express from 'express';
import crypto from 'crypto';
import { getDb } from '../db/database.js';

const router = express.Router();

// ============================================
// ÖFFENTLICHE ROUTES (kein Auth erforderlich)
// ============================================

// Token prüfen (ohne Kennzeichen-Verifizierung)
router.get('/token/:token/check', (req, res) => {
  try {
    const db = getDb();
    const { token } = req.params;
    
    const buchung = db.prepare(`
      SELECT * FROM buchungs_tokens WHERE token = ?
    `).get(token);
    
    if (!buchung) {
      return res.status(404).json({ error: 'Ungültiger oder abgelaufener Link' });
    }
    
    if (buchung.status === 'gebucht') {
      return res.json({ 
        status: 'gebucht', 
        kennzeichen: buchung.kennzeichen,
        gewaehltes_datum: buchung.gewaehltes_datum 
      });
    }
    
    if (buchung.status === 'abgelaufen' || (buchung.gueltig_bis && new Date(buchung.gueltig_bis) < new Date())) {
      return res.status(410).json({ error: 'Dieser Link ist abgelaufen' });
    }
    
    // Token gültig, aber Kennzeichen noch nicht verifiziert
    res.json({ status: 'offen', requiresVerification: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Kennzeichen verifizieren und Buchungsinfo laden
router.post('/token/:token/verify', (req, res) => {
  try {
    const db = getDb();
    const { token } = req.params;
    const { kennzeichen } = req.body;
    
    const buchung = db.prepare(`
      SELECT * FROM buchungs_tokens WHERE token = ?
    `).get(token);
    
    if (!buchung) {
      return res.status(404).json({ error: 'Ungültiger oder abgelaufener Link' });
    }
    
    // Kennzeichen vergleichen (case-insensitive, ohne Leerzeichen)
    const inputClean = kennzeichen.replace(/\s+/g, '').toUpperCase();
    const storedClean = buchung.kennzeichen.replace(/\s+/g, '').toUpperCase();
    
    if (inputClean !== storedClean) {
      return res.status(403).json({ error: 'Kennzeichen stimmt nicht überein' });
    }
    
    if (buchung.status === 'gebucht') {
      return res.json({ 
        status: 'gebucht', 
        kennzeichen: buchung.kennzeichen,
        gewaehltes_datum: buchung.gewaehltes_datum 
      });
    }
    
    if (buchung.status === 'abgelaufen' || (buchung.gueltig_bis && new Date(buchung.gueltig_bis) < new Date())) {
      return res.status(410).json({ error: 'Dieser Link ist abgelaufen' });
    }
    
    // Verfügbare Termine laden (nächste 30 Tage)
    const heute = new Date();
    const in30Tagen = new Date();
    in30Tagen.setDate(in30Tagen.getDate() + 30);
    
    const von = heute.toISOString().split('T')[0];
    const bis = in30Tagen.toISOString().split('T')[0];
    
    // Kapazitäten laden
    const kapazitaeten = db.prepare(`SELECT * FROM kapazitaeten`).all();
    const kapMap = {};
    kapazitaeten.forEach(k => { kapMap[k.wochentag] = k; });
    
    // Ausnahmen laden
    const ausnahmen = db.prepare(`
      SELECT datum, max_termine FROM kapazitaet_ausnahmen WHERE datum >= ? AND datum <= ?
    `).all(von, bis);
    const ausnahmenMap = {};
    ausnahmen.forEach(a => { ausnahmenMap[a.datum] = a.max_termine; });
    
    // Gebuchte Termine zählen
    const gebuchte = db.prepare(`
      SELECT datum, COUNT(*) as anzahl FROM geplante_termine 
      WHERE datum >= ? AND datum <= ?
      GROUP BY datum
    `).all(von, bis);
    const gebuchtMap = {};
    gebuchte.forEach(g => { gebuchtMap[g.datum] = g.anzahl; });
    
    // Verfügbare Tage berechnen
    const verfuegbareTage = [];
    for (let d = new Date(heute); d <= in30Tagen; d.setDate(d.getDate() + 1)) {
      const dateStr = d.toISOString().split('T')[0];
      const wochentag = d.getDay();
      const kap = kapMap[wochentag];
      
      // Ausnahme hat Vorrang
      const maxTermine = ausnahmenMap[dateStr] !== undefined ? ausnahmenMap[dateStr] : (kap?.aktiv ? kap.max_termine : 0);
      const gebucht = gebuchtMap[dateStr] || 0;
      const frei = maxTermine - gebucht;
      
      if (frei > 0) {
        verfuegbareTage.push({
          datum: dateStr,
          wochentag,
          frei,
          maxTermine
        });
      }
    }
    
    res.json({
      status: 'offen',
      kennzeichen: buchung.kennzeichen,
      kunde_name: buchung.kunde_name,
      typ: buchung.typ,
      verfuegbareTage
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Termin buchen
router.post('/token/:token/buchen', (req, res) => {
  try {
    const db = getDb();
    const { token } = req.params;
    const { datum } = req.body;
    
    const buchung = db.prepare(`
      SELECT * FROM buchungs_tokens WHERE token = ? AND status = 'offen'
    `).get(token);
    
    if (!buchung) {
      return res.status(404).json({ error: 'Ungültiger oder bereits verwendeter Link' });
    }
    
    // Prüfen ob noch Kapazität frei ist
    const wochentag = new Date(datum).getDay();
    const kap = db.prepare(`SELECT * FROM kapazitaeten WHERE wochentag = ?`).get(wochentag);
    const ausnahme = db.prepare(`SELECT max_termine FROM kapazitaet_ausnahmen WHERE datum = ?`).get(datum);
    const maxTermine = ausnahme ? ausnahme.max_termine : (kap?.aktiv ? kap.max_termine : 0);
    
    const gebucht = db.prepare(`SELECT COUNT(*) as anzahl FROM geplante_termine WHERE datum = ?`).get(datum);
    
    if (gebucht.anzahl >= maxTermine) {
      return res.status(409).json({ error: 'Dieser Tag ist leider bereits ausgebucht' });
    }
    
    // Termin erstellen
    db.prepare(`
      INSERT INTO geplante_termine (fahrzeug_id, typ, datum, notiz)
      VALUES (?, ?, ?, ?)
    `).run(buchung.fahrzeug_id, buchung.typ, datum, 'Online-Buchung durch Kunde');
    
    // Token als gebucht markieren
    db.prepare(`
      UPDATE buchungs_tokens SET status = 'gebucht', gewaehltes_datum = ?, gebucht_at = CURRENT_TIMESTAMP
      WHERE token = ?
    `).run(datum, token);
    
    res.json({ success: true, datum });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ============================================
// ADMIN ROUTES (Auth erforderlich)
// ============================================

// Token für Fahrzeug generieren
router.post('/token/generieren', (req, res) => {
  try {
    const db = getDb();
    const { fahrzeug_id, typ } = req.body;
    const userId = req.user?.id;
    
    // Fahrzeug-Infos laden
    const fahrzeug = db.prepare(`
      SELECT f.*, k.name as kunde_name 
      FROM fahrzeuge f 
      LEFT JOIN kunden k ON f.kunde_id = k.id 
      WHERE f.id = ?
    `).get(fahrzeug_id);
    
    if (!fahrzeug) {
      return res.status(404).json({ error: 'Fahrzeug nicht gefunden' });
    }
    
    // Kurzen Code generieren (6 Zeichen, leicht lesbar ohne 0/O, 1/I/l)
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    let code = '';
    for (let i = 0; i < 6; i++) {
      code += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    const token = code;
    
    // Gültigkeit: 30 Tage
    const gueltigBis = new Date();
    gueltigBis.setDate(gueltigBis.getDate() + 30);
    
    db.prepare(`
      INSERT INTO buchungs_tokens (token, fahrzeug_id, vin, kennzeichen, kunde_name, typ, gueltig_bis, erstellt_von)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(token, fahrzeug.id, fahrzeug.vin, fahrzeug.kennzeichen, fahrzeug.kunde_name, typ || 'service', gueltigBis.toISOString(), userId);
    
    res.json({ 
      success: true, 
      token,
      url: `/buchen/${token}`
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Alle offenen Tokens
router.get('/tokens', (req, res) => {
  try {
    const db = getDb();
    const tokens = db.prepare(`
      SELECT * FROM buchungs_tokens ORDER BY created_at DESC LIMIT 100
    `).all();
    res.json(tokens);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
