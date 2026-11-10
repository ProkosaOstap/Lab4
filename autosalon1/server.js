// АВТОСАЛОН — лабораторна робота (частина 2: авторизація та захищені точки доступу)
// Passport.js + express-session. Ролі: admin, manager, visitor.
// Серверна валідація всіх полів форм (у HTML немає жодного атрибута required).

const express = require('express');
const session = require('express-session');
const bcrypt = require('bcryptjs');
const db = require('./db');
const entities = require('./entities');
const views = require('./views');
const { esc } = views;
const { passport, requireRole, ROLE_NAMES } = require('./auth');

const app = express();
app.use(express.urlencoded({ extended: true })); // розбір даних форм

// ---------- Сесії + Passport ----------
app.use(session({
  secret: process.env.SESSION_SECRET || 'autosalon-secret-key-lab',
  resave: false,
  saveUninitialized: false
}));
app.use(passport.initialize());
app.use(passport.session());

const canEdit = req => req.isAuthenticated() && (req.user.role === 'admin' || req.user.role === 'manager');
const page = (req, title, body, flash = '') =>
  views.layout(title, body, flash, req.user, ROLE_NAMES);

// ---------- Валідація запису на сервері ----------
// Повертає { errors, values } — errors порожній, якщо все гаразд.
function validateEntity(entity, body, currentId = null) {
  const errors = {};
  const values = {};

  for (const f of entity.fields) {
    const raw = body[f.name];

    // чекбокси (додаткові опції) — масив або undefined
    if (f.type === 'checkboxes') {
      values[f.name] = Array.isArray(raw) ? raw.map(Number).filter(Number.isInteger) : [];
      continue;
    }

    const value = typeof raw === 'string' ? raw.trim() : (raw ?? '');
    values[f.name] = value;

    for (const rule of f.validators) {
      const err = rule(value, db, currentId);
      if (err) { errors[f.name] = err; break; } // перша помилка по полю
    }
  }
  return { errors, values };
}

// ---------- Допоміжне: як показувати колонки списку ----------
function cellValue(row, col, entity) {
  if (col === 'brand_id') {
    const b = db.get('brands', row.brand_id);
    return b ? `${b.name} (${b.country})` : '—';
  }
  if (col === 'client_id') {
    const c = db.get('clients', row.client_id);
    return c ? c.full_name : '—';
  }
  if (col === 'trim_id') {
    const t = db.get('trims', row.trim_id);
    if (!t) return '—';
    const b = db.get('brands', t.brand_id);
    return `${b ? b.name + ' ' : ''}${t.name}`;
  }
  if (col === 'options') {
    return db.getSaleOptions(row.id)
      .map(oid => { const o = db.get('options', oid); return o ? o.name : null; })
      .filter(Boolean).join(', ') || '—';
  }
  return row[col];
}

// Для select комплектацій — додамо назву марки у підпис
function decorateTrims() {
  for (const t of db.all('trims')) t.__brandName = (db.get('brands', t.brand_id) || {}).name || '';
}

// ================= АВТОРИЗАЦІЯ =================

app.get('/login', (req, res) => {
  if (req.isAuthenticated()) return res.redirect('/');
  // passport зберігає причину невдалого входу в req.session.messages
  const msgs = req.session.messages || [];
  req.session.messages = [];
  const okMsg = req.query.ok ? views.flash('ok', String(req.query.ok)) : '';
  res.send(page(req, 'Вхід',
    views.loginPage({ error: msgs[msgs.length - 1], values: { username: req.query.u || '' } }), okMsg));
});

app.post('/login',
  passport.authenticate('local', {
    failureRedirect: '/login',
    failureMessage: true
  }),
  (req, res) => res.redirect('/')
);

app.get('/register', (req, res) => {
  if (req.isAuthenticated()) return res.redirect('/');
  res.send(page(req, 'Реєстрація', views.registerPage()));
});

// Реєстрація — серверна валідація, новий користувач завжди отримує роль «відвідувач»
app.post('/register', (req, res) => {
  const { username, full_name, password, password2 } = req.body;
  const errors = {};

  const u = String(username || '').trim();
  if (!u) errors.username = 'Поле не може бути порожнім';
  else if (!/^[a-zA-Z0-9_]{3,20}$/.test(u)) errors.username = '3–20 символів: латиниця, цифри, _';
  else if (db.all('users').some(x => x.username.toLowerCase() === u.toLowerCase()))
    errors.username = 'Такий логін уже зайнятий';

  const f = String(full_name || '').trim();
  if (!f) errors.full_name = 'Поле не може бути порожнім';
  else if (f.length < 5 || f.length > 60) errors.full_name = 'Довжина — від 5 до 60 симв.';

  const p = String(password || '');
  if (!p) errors.password = 'Поле не може бути порожнім';
  else if (p.length < 6) errors.password = 'Мінімум 6 символів';

  if (p !== String(password2 || '')) errors.password2 = 'Паролі не співпадають';

  if (Object.keys(errors).length > 0) {
    return res.status(400).send(page(req, 'Реєстрація',
      views.registerPage({ errors, values: { username: u, full_name: f } })));
  }

  db.insert('users', {
    username: u,
    password_hash: bcrypt.hashSync(p, 10),
    full_name: f,
    role: 'visitor' // самостійна реєстрація — лише роль «відвідувач»
  });
  res.redirect('/login?ok=Реєстрація+успішна');
});

app.post('/logout', (req, res, next) => {
  req.logout(err => { if (err) return next(err); res.redirect('/'); });
});

// ================= КЕРУВАННЯ КОРИСТУВАЧАМИ (тільки адмін) =================

function validateUser(body, currentId = null) {
  const errors = {};
  const values = {
    username: String(body.username || '').trim(),
    full_name: String(body.full_name || '').trim(),
    role: String(body.role || '').trim(),
    password: String(body.password || '')
  };

  if (!values.username) errors.username = 'Поле не може бути порожнім';
  else if (!/^[a-zA-Z0-9_]{3,20}$/.test(values.username)) errors.username = '3–20 символів: латиниця, цифри, _';
  else if (db.all('users').some(x => x.username.toLowerCase() === values.username.toLowerCase() && x.id !== Number(currentId)))
    errors.username = 'Такий логін уже зайнятий';

  if (!values.full_name) errors.full_name = 'Поле не може бути порожнім';
  else if (values.full_name.length < 5 || values.full_name.length > 60) errors.full_name = 'Довжина — від 5 до 60 симв.';

  if (!['admin', 'manager', 'visitor'].includes(values.role)) errors.role = 'Оберіть роль';

  // при створенні пароль обов'язковий; при редагуванні — ні (залишиться старий)
  if (!currentId) {
    if (!values.password) errors.password = 'Поле не може бути порожнім';
    else if (values.password.length < 6) errors.password = 'Мінімум 6 символів';
  } else if (values.password && values.password.length < 6) {
    errors.password = 'Мінімум 6 символів';
  }
  return { errors, values };
}

app.get('/users', requireRole('admin'), (req, res) => {
  const users = db.all('users').map(u => ({ ...u, password_hash: undefined }));
  res.send(page(req, 'Користувачі', views.usersPage(users, ROLE_NAMES)));
});

app.get('/users/new', requireRole('admin'), (req, res) => {
  res.send(page(req, 'Новий користувач', views.userFormPage({
    title: 'Додати користувача', action: '/users', submitLabel: 'Створити'
  })));
});

app.post('/users', requireRole('admin'), (req, res) => {
  const { errors, values } = validateUser(req.body);
  if (Object.keys(errors).length) {
    return res.status(400).send(page(req, 'Новий користувач', views.userFormPage({
      title: 'Додати користувача', action: '/users', submitLabel: 'Створити',
      values, errors
    }), views.flash('err', 'Виправте помилки у формі')));
  }
  db.insert('users', {
    username: values.username,
    full_name: values.full_name,
    role: values.role,
    password_hash: bcrypt.hashSync(values.password, 10)
  });
  res.redirect('/users?ok=Користувача+створено');
});

app.get('/users/:id/edit', requireRole('admin'), (req, res) => {
  const user = db.get('users', req.params.id);
  if (!user) return res.status(404).send(page(req, '404', views.flash('err', 'Користувача не знайдено')));
  res.send(page(req, 'Редагування', views.userFormPage({
    title: `Редагувати користувача №${user.id}`,
    action: `/users/${user.id}`, submitLabel: 'Зберегти зміни',
    values: { username: user.username, full_name: user.full_name, role: user.role }
  })));
});

app.post('/users/:id', requireRole('admin'), (req, res) => {
  const user = db.get('users', req.params.id);
  if (!user) return res.status(404).send(page(req, '404', views.flash('err', 'Користувача не знайдено')));

  const { errors, values } = validateUser(req.body, user.id);
  if (Object.keys(errors).length) {
    return res.status(400).send(page(req, 'Редагування', views.userFormPage({
      title: `Редагувати користувача №${user.id}`,
      action: `/users/${user.id}`, submitLabel: 'Зберегти зміни',
      values, errors
    }), views.flash('err', 'Виправте помилки у формі')));
  }
  db.update('users', user.id, {
    username: values.username,
    full_name: values.full_name,
    role: values.role,
    password_hash: values.password ? bcrypt.hashSync(values.password, 10) : user.password_hash
  });
  res.redirect('/users?ok=Збережено');
});

app.post('/users/:id/delete', requireRole('admin'), (req, res) => {
  const user = db.get('users', req.params.id);
  if (!user) return res.redirect('/users?err=Користувача+не+знайдено');
  // адміністратора №1 (головного) не можна видалити
  if (user.id === 1) return res.redirect('/users?err=' + encodeURIComponent('Головного адміністратора видалити не можна'));
  if (db.all('users').filter(u => u.role === 'admin').length <= 1 && user.role === 'admin')
    return res.redirect('/users?err=Останнього+адміністратора+видалити+не можна');
  db.remove('users', user.id);
  res.redirect('/users?ok=Видалено');
});

// ================= ГОЛОВНА =================

app.get('/', (req, res) => {
  const cards = Object.values(entities).map(e => `
    <p><a href="/${e.key}">${esc(e.title)}</a> — записів: ${db.all(e.key).length}</p>`).join('');
  const roleInfo = req.isAuthenticated()
    ? `<p>Ви увійшли як <b>${esc(req.user.full_name)}</b> — ${esc(ROLE_NAMES[req.user.role])}.
       ${canEdit(req) ? 'Ви можете додавати, змінювати та видаляти записи.' : 'Доступний лише перегляд даних.'}</p>`
    : '<p>Ви не авторизовані: доступний лише перегляд даних. <a href="/login">Увійти</a></p>';
  res.send(page(req, 'Головна', `<h2>Таблиці бази даних</h2>${roleInfo}${cards}`));
});

// ================= ДАНІ АВТОСАЛОНУ =================
// GET-списки — відкриті всім (включно з відвідувачами);
// форми та POST-дії — лише manager і admin.

for (const entity of Object.values(entities)) {
  app.get(`/${entity.key}`, (req, res) => {
    decorateTrims();
    const f = req.query.ok ? views.flash('ok', String(req.query.ok))
           : req.query.err ? views.flash('err', String(req.query.err)) : '';
    res.send(page(req, entity.title,
      views.listPage(entity, db.all(entity.key), { cell: cellValue }, canEdit(req)), f));
  });

  // Захищені точки доступу: форми редагування — тільки manager/admin
  app.get(`/${entity.key}/new`, requireRole('manager', 'admin'), (req, res) => {
    decorateTrims();
    res.send(page(req, entity.title, views.formPage(entity, {
      title: `Додати — ${entity.single}`,
      action: `/${entity.key}`,
      submitLabel: 'Створити',
      values: {}
    })));
  });

  app.post(`/${entity.key}`, requireRole('manager', 'admin'), (req, res) => {
    decorateTrims();
    const { errors, values } = validateEntity(entity, req.body);

    if (Object.keys(errors).length > 0) {
      // ПОМИЛКИ: знову показуємо форму зі введеними значеннями та повідомленнями
      return res.status(400).send(page(req, entity.title, views.formPage(entity, {
        title: `Додати — ${entity.single}`,
        action: `/${entity.key}`,
        submitLabel: 'Створити',
        values,
        errors
      }), views.flash('err', 'Форма заповнена з помилками — виправте поля, виділені червоним')));
    }

    const record = { ...values };
    if (entity.key === 'sales') {
      const optionIds = values.options;
      delete record.options;
      const created = db.insert('sales', record);
      db.setSaleOptions(created.id, optionIds);
    } else {
      for (const f of entity.fields) {
        if (f.name === 'brand_id' || f.name === 'client_id' || f.name === 'trim_id') record[f.name] = Number(record[f.name]);
      }
      db.insert(entity.key, record);
    }
    res.redirect(`/${entity.key}?ok=Створено`);
  });

  app.get(`/${entity.key}/:id/edit`, requireRole('manager', 'admin'), (req, res) => {
    decorateTrims();
    const row = db.get(entity.key, req.params.id);
    if (!row) return res.status(404).send(page(req, '404', views.flash('err', 'Запис не знайдено')));

    const values = { ...row };
    if (entity.key === 'sales') values.options = db.getSaleOptions(row.id);
    res.send(page(req, entity.title, views.formPage(entity, {
      title: `Редагувати — ${entity.single} №${row.id}`,
      action: `/${entity.key}/${row.id}`,
      submitLabel: 'Зберегти зміни',
      values
    })));
  });

  app.post(`/${entity.key}/:id`, requireRole('manager', 'admin'), (req, res) => {
    decorateTrims();
    const row = db.get(entity.key, req.params.id);
    if (!row) return res.status(404).send(page(req, '404', views.flash('err', 'Запис не знайдено')));

    const { errors, values } = validateEntity(entity, req.body, row.id);
    if (Object.keys(errors).length > 0) {
      return res.status(400).send(page(req, entity.title, views.formPage(entity, {
        title: `Редагувати — ${entity.single} №${row.id}`,
        action: `/${entity.key}/${row.id}`,
        submitLabel: 'Зберегти зміни',
        values,
        errors
      }), views.flash('err', 'Форма заповнена з помилками — виправте поля, виділені червоним')));
    }

    const record = { ...values };
    if (entity.key === 'sales') {
      const optionIds = values.options;
      delete record.options;
      db.update('sales', row.id, record);
      db.setSaleOptions(row.id, optionIds);
    } else {
      for (const f of entity.fields) {
        if (f.name === 'brand_id' || f.name === 'client_id' || f.name === 'trim_id') record[f.name] = Number(record[f.name]);
      }
      db.update(entity.key, row.id, record);
    }
    res.redirect(`/${entity.key}?ok=Збережено`);
  });

  app.post(`/${entity.key}/:id/delete`, requireRole('manager', 'admin'), (req, res) => {
    const row = db.get(entity.key, req.params.id);
    if (!row) return res.redirect(`/${entity.key}?err=Запис+не+знайдено`);

    // Серверна перевірка посилальної цілісності перед видаленням
    if (entity.deleteBlockedBy) {
      const { table, fk, message } = entity.deleteBlockedBy;
      if (db.findBy(table, fk, row.id).length > 0) {
        return res.redirect(`/${entity.key}?err=${encodeURIComponent(message)}`);
      }
    }

    if (entity.cascade === 'sale_options') db.removeSaleOptions(row.id);
    db.remove(entity.key, row.id);
    res.redirect(`/${entity.key}?ok=Видалено`);
  });
}

// 403-сторінка з форматуванням
app.use((err, req, res, next) => {
  if (res.headersSent) return next(err);
  res.status(500).send(page(req, 'Помилка', views.flash('err', 'Внутрішня помилка сервера')));
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Автосалон: http://localhost:${PORT}`));
