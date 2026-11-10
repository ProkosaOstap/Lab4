// Авторизація через Passport.js (локальна стратегія: логін + пароль).
// Ролі: admin (все), manager (дані автосалону), visitor (лише перегляд).

const passport = require('passport');
const LocalStrategy = require('passport-local').Strategy;
const bcrypt = require('bcryptjs');
const db = require('./db');

passport.use(new LocalStrategy((username, password, done) => {
  const user = db.all('users').find(u => u.username === String(username).trim());
  if (!user) return done(null, false, { message: 'Невірний логін або пароль' });
  if (!bcrypt.compareSync(String(password), user.password_hash)) {
    return done(null, false, { message: 'Невірний логін або пароль' });
  }
  return done(null, user);
}));

passport.serializeUser((user, done) => done(null, user.id));
passport.deserializeUser((id, done) => {
  const user = db.get('users', id);
  done(null, user ? { id: user.id, username: user.username, full_name: user.full_name, role: user.role } : null);
});

// ---------- Middleware для захисту точок доступу ----------

// лише авторизовані
function requireAuth(req, res, next) {
  if (!req.isAuthenticated || !req.isAuthenticated()) return res.redirect('/login');
  next();
}

// лише з дозволеними ролями
function requireRole(...roles) {
  return (req, res, next) => {
    if (!req.isAuthenticated || !req.isAuthenticated()) return res.redirect('/login');
    if (!roles.includes(req.user.role)) {
      return res.status(403).send('403 — доступ заборонено для вашої ролі');
    }
    next();
  };
}

const ROLE_NAMES = { admin: 'Адміністратор', manager: 'Менеджер', visitor: 'Відвідувач' };

module.exports = { passport, requireAuth, requireRole, ROLE_NAMES };
