import express from 'express';
import bcrypt from 'bcryptjs';
import { generateToken, authMiddleware, adminOnly } from '../middleware/auth.js';
import { getUserByUsername, createUser, getAllUsers, getDb, createInviteToken, getInviteToken, useInviteToken, getAllInviteTokens, deleteInviteToken, updateUserActive, updateUserRole } from '../db/database.js';

const router = express.Router();

// Login
router.post('/login', (req, res) => {
  const { username, password } = req.body;

  if (!username || !password) {
    return res.status(400).json({ error: 'Username und Passwort erforderlich' });
  }

  const user = getUserByUsername(username);
  
  if (!user) {
    return res.status(401).json({ error: 'Benutzer nicht gefunden' });
  }

  const validPassword = bcrypt.compareSync(password, user.password_hash);
  
  if (!validPassword) {
    return res.status(401).json({ error: 'Falsches Passwort' });
  }

  const token = generateToken(user);

  res.json({
    success: true,
    token,
    user: {
      id: user.id,
      username: user.username,
      name: user.name,
      role: user.role
    }
  });
});

// Token verifizieren
router.get('/verify', authMiddleware, (req, res) => {
  res.json({ valid: true, user: req.user });
});

// Logout (client-side, aber für Audit-Log)
router.post('/logout', authMiddleware, (req, res) => {
  res.json({ success: true });
});

// Alle User abrufen (nur Admin)
router.get('/users', authMiddleware, adminOnly, (req, res) => {
  const users = getAllUsers();
  res.json(users);
});

// Neuen User anlegen (nur Admin)
router.post('/users', authMiddleware, adminOnly, (req, res) => {
  const { username, password, name, role } = req.body;

  if (!username || !password) {
    return res.status(400).json({ error: 'Username und Passwort erforderlich' });
  }

  const existing = getUserByUsername(username);
  if (existing) {
    return res.status(400).json({ error: 'Benutzername existiert bereits' });
  }

  const password_hash = bcrypt.hashSync(password, 10);

  try {
    createUser({
      username,
      password_hash,
      name: name || username,
      role: role || 'user'
    });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Passwort ändern
router.post('/change-password', authMiddleware, (req, res) => {
  const { currentPassword, newPassword } = req.body;
  const user = getUserByUsername(req.user.username);

  if (!user || !bcrypt.compareSync(currentPassword, user.password_hash)) {
    return res.status(401).json({ error: 'Aktuelles Passwort falsch' });
  }

  const db = getDb();
  const newHash = bcrypt.hashSync(newPassword, 10);
  db.prepare('UPDATE users SET password_hash = ? WHERE id = ?').run(newHash, user.id);

  res.json({ success: true });
});

// Initial Admin erstellen (nur wenn keine User existieren)
router.post('/setup', (req, res) => {
  const users = getAllUsers();
  
  if (users.length > 0) {
    return res.status(400).json({ error: 'Setup bereits abgeschlossen' });
  }

  const { username, password, name } = req.body;

  if (!username || !password) {
    return res.status(400).json({ error: 'Username und Passwort erforderlich' });
  }

  const password_hash = bcrypt.hashSync(password, 10);

  try {
    createUser({
      username,
      password_hash,
      name: name || 'Administrator',
      role: 'admin'
    });
    res.json({ success: true, message: 'Admin-User erstellt' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Check ob Setup nötig
router.get('/setup-required', (req, res) => {
  const users = getAllUsers();
  res.json({ setupRequired: users.length === 0 });
});

// ============ INVITE TOKEN ROUTES ============

// Invite Token erstellen (nur Admin)
router.post('/invite', authMiddleware, adminOnly, (req, res) => {
  const { username, name, role } = req.body;

  if (!username) {
    return res.status(400).json({ error: 'Username erforderlich' });
  }

  const existing = getUserByUsername(username);
  if (existing) {
    return res.status(400).json({ error: 'Benutzername existiert bereits' });
  }

  try {
    const token = createInviteToken({
      username,
      name: name || username,
      role: role || 'user',
      created_by: req.user.id
    });
    res.json({ success: true, token, inviteUrl: `/invite/${token}` });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Invite Token validieren (öffentlich)
router.get('/invite/:token', (req, res) => {
  const invite = getInviteToken(req.params.token);
  
  if (!invite) {
    return res.status(404).json({ error: 'Einladung nicht gefunden oder bereits verwendet' });
  }

  if (new Date(invite.expires_at) < new Date()) {
    return res.status(410).json({ error: 'Einladung abgelaufen' });
  }

  res.json({
    valid: true,
    username: invite.username,
    name: invite.name,
    role: invite.role
  });
});

// Passwort setzen mit Invite Token (öffentlich)
router.post('/invite/:token/complete', (req, res) => {
  const { password } = req.body;
  const invite = getInviteToken(req.params.token);

  if (!invite) {
    return res.status(404).json({ error: 'Einladung nicht gefunden oder bereits verwendet' });
  }

  if (new Date(invite.expires_at) < new Date()) {
    return res.status(410).json({ error: 'Einladung abgelaufen' });
  }

  if (!password || password.length < 4) {
    return res.status(400).json({ error: 'Passwort muss mindestens 4 Zeichen haben' });
  }

  const password_hash = bcrypt.hashSync(password, 10);

  try {
    createUser({
      username: invite.username,
      password_hash,
      name: invite.name,
      role: invite.role
    });
    useInviteToken(req.params.token);
    res.json({ success: true, message: 'Account erstellt. Sie können sich jetzt anmelden.' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Alle Invite Tokens abrufen (nur Admin)
router.get('/invites', authMiddleware, adminOnly, (req, res) => {
  const invites = getAllInviteTokens();
  res.json(invites);
});

// Invite Token löschen (nur Admin)
router.delete('/invite/:id', authMiddleware, adminOnly, (req, res) => {
  try {
    deleteInviteToken(req.params.id);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ============ USER MANAGEMENT ROUTES ============

// User aktivieren/deaktivieren (nur Admin)
router.post('/users/:id/activate', authMiddleware, adminOnly, (req, res) => {
  try {
    updateUserActive(req.params.id, true);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/users/:id/deactivate', authMiddleware, adminOnly, (req, res) => {
  try {
    updateUserActive(req.params.id, false);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// User Rolle ändern (nur Admin)
router.post('/users/:id/role', authMiddleware, adminOnly, (req, res) => {
  const { role } = req.body;
  if (!['user', 'admin'].includes(role)) {
    return res.status(400).json({ error: 'Ungültige Rolle' });
  }
  try {
    updateUserRole(req.params.id, role);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
