// HTML-шаблони (без template-движка, звичайні рядки).

function esc(s) {
  return String(s ?? '')
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

function layout(title, body, flash, user, roleNames) {
  const userBox = user
    ? `<span style="float:right;color:#fff;font-size:14px">
         ${esc(user.full_name)} (${esc(roleNames[user.role] || user.role)})
         <form method="post" action="/logout" style="display:inline">
           <button class="btn btn-del" type="submit" style="padding:3px 10px">Вийти</button>
         </form>
       </span>`
    : `<span style="float:right;font-size:14px">
         <a href="/login" style="color:#fff">Увійти</a> ·
         <a href="/register" style="color:#fff">Зареєструватися</a>
       </span>`;
  const adminLink = user && user.role === 'admin' ? '<a href="/users">Користувачі</a>' : '';
  return `<!DOCTYPE html>
<html lang="uk">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(title)} — Автосалон</title>
<style>
  * { box-sizing: border-box; }
  body { font-family: Arial, sans-serif; margin: 0; background: #f4f6f8; color: #222; }
  header { background: #1a355e; color: #fff; padding: 16px 24px; }
  header h1 { margin: 0; font-size: 22px; }
  nav { background: #24457a; padding: 8px 24px; overflow:hidden; }
  nav a { color: #dbe6f5; text-decoration: none; margin-right: 16px; font-size: 15px; }
  nav a:hover { color: #fff; text-decoration: underline; }
  main { max-width: 980px; margin: 24px auto; padding: 0 16px; }
  h2 { border-bottom: 2px solid #1a355e; padding-bottom: 6px; }
  table { border-collapse: collapse; width: 100%; background: #fff; }
  th, td { border: 1px solid #ccd5e0; padding: 8px 10px; text-align: left; font-size: 14px; }
  th { background: #e8edf4; }
  tr:nth-child(even) td { background: #f7f9fc; }
  .btn { display: inline-block; padding: 6px 12px; border: none; border-radius: 4px;
         text-decoration: none; font-size: 14px; cursor: pointer; }
  .btn-primary { background: #1a6ee0; color: #fff; }
  .btn-edit { background: #2e9e5b; color: #fff; }
  .btn-del { background: #d43f3f; color: #fff; }
  .btn:hover { opacity: .85; }
  form.entity-form { background: #fff; border: 1px solid #ccd5e0; border-radius: 6px;
                    padding: 20px; max-width: 560px; }
  label { display: block; font-weight: bold; margin: 14px 0 4px; font-size: 14px; }
  input[type=text], input[type=password], input[type=date], select { width: 100%; padding: 8px; border: 1px solid #aab6c5;
        border-radius: 4px; font-size: 14px; }
  .checkbox-row { margin: 4px 0; font-size: 14px; }
  .field-error { color: #c0392b; font-size: 13px; margin-top: 3px; }
  .field-invalid input, .field-invalid select { border-color: #c0392b; background: #fdf0ef; }
  .form-actions { margin-top: 20px; }
  .flash { padding: 12px 16px; border-radius: 4px; margin-bottom: 16px; font-size: 15px; }
  .flash-ok { background: #e2f5e8; border: 1px solid #2e9e5b; color: #1d6b3c; }
  .flash-err { background: #fdeceb; border: 1px solid #d43f3f; color: #8f1f1f; }
  .top-actions { margin: 10px 0 16px; }
</style>
</head>
<body>
<header><h1>🚗 Автосалон «Авторитет»</h1></header>
<nav>
  <a href="/">Головна</a>
  <a href="/brands">Марки машин</a>
  <a href="/trims">Комплектації</a>
  <a href="/clients">Клієнти</a>
  <a href="/sales">Продажі</a>
  <a href="/options">Додаткові опції</a>
  ${adminLink}
  ${userBox}
</nav>
<main>
${flash ? flash : ''}
${body}
</main>
</body>
</html>`;
}

function flash(kind, text) {
  return `<div class="flash flash-${kind === 'ok' ? 'ok' : 'err'}">${esc(text)}</div>`;
}

// ---------- Список записів ----------
function listPage(entity, rows, helpers, canEdit) {
  const cols = entity.listColumns;
  const head = cols.map(c => `<th>${esc(entity.labels[c])}</th>`).join('');
  const body = rows.map(r => {
    const cells = cols.map(c => `<td>${esc(helpers.cell(r, c))}</td>`).join('');
    const actions = canEdit
      ? `<a class="btn btn-edit" href="/${entity.key}/${r.id}/edit">Змінити</a>
         <form method="post" action="/${entity.key}/${r.id}/delete" style="display:inline"
               onsubmit="return confirm('Видалити цей запис?')">
           <button class="btn btn-del" type="submit">Видалити</button>
         </form>`
      : '—';
    return `<tr>
      ${cells}
      <td style="white-space:nowrap">${actions}</td>
    </tr>`;
  }).join('\n');

  const addBtn = canEdit
    ? `<a class="btn btn-primary" href="/${entity.key}/new">+ Додати ${esc(entity.addLabel || entity.single.toLowerCase())}</a>`
    : `<span style="color:#777;font-size:14px">Режим перегляду — увійдіть як менеджер або адміністратор, щоб редагувати дані</span>`;

  return `<h2>${esc(entity.title)}</h2>
  <div class="top-actions">${addBtn}</div>
  <table>
    <tr>${head}<th>Дії</th></tr>
    ${body || `<tr><td colspan="${cols.length + 1}">Немає записів</td></tr>`}
  </table>`;
}

// ---------- Форма додавання/редагування ----------
function renderField(f, value, error, db) {
  let control = '';
  const val = value ?? '';

  if (f.type === 'text') {
    control = `<input type="text" name="${f.name}" value="${esc(val)}" placeholder="${esc(f.placeholder || '')}">`;
  } else if (f.type === 'date') {
    control = `<input type="date" name="${f.name}" value="${esc(val)}">`;
  } else if (f.type === 'select') {
    // список із БД (зовнішній ключ) або фіксований (choices)
    const items = f.optionsFrom
      ? db.all(f.optionsFrom).map(r => ({ value: r.id, text: f.optionLabel(r) }))
      : (f.choices || []).map(c => ({ value: c, text: c }));
    const opts = items.map(o =>
      `<option value="${esc(o.value)}" ${String(val) === String(o.value) ? 'selected' : ''}>${esc(o.text)}</option>`
    ).join('');
    control = `<select name="${f.name}"><option value="">— оберіть —</option>${opts}</select>`;
  } else if (f.type === 'checkboxes') {
    const selected = Array.isArray(val) ? val.map(String) : [];
    control = db.all(f.optionsFrom).map(r => `
      <div class="checkbox-row">
        <label style="display:inline;font-weight:normal">
          <input type="checkbox" name="${f.name}" value="${r.id}" ${selected.includes(String(r.id)) ? 'checked' : ''}>
          ${esc(r.name)} (+${esc(r.price)}$)
        </label>
      </div>`).join('');
  }

  return `<div class="${error ? 'field-invalid' : ''}">
    <label>${esc(f.label)}${f.optional ? ' (необов\u2019язково)' : ''}</label>
    ${control}
    ${error ? `<div class="field-error">${esc(error)}</div>` : ''}
  </div>`;
}

function formPage(entity, { values = {}, errors = {}, action, submitLabel, title }) {
  const db = require('./db');
  const fields = entity.fields.map(f => renderField(f, values[f.name], errors[f.name], db)).join('\n');
  return `<h2>${esc(title)}</h2>
  <form class="entity-form" method="post" action="${esc(action)}">
    ${fields}
    <div class="form-actions">
      <button class="btn btn-primary" type="submit">${esc(submitLabel)}</button>
      <a class="btn" href="/${entity.key}" style="color:#1a355e">Скасувати</a>
    </div>
  </form>`;
}

// ---------- Сторінки авторизації ----------
function loginPage({ error, values = {} } = {}) {
  return `<h2>Вхід до системи</h2>
  ${error ? `<div class="flash flash-err">${esc(error)}</div>` : ''}
  <form class="entity-form" method="post" action="/login">
    <div class="${error ? 'field-invalid' : ''}">
      <label>Логін</label>
      <input type="text" name="username" value="${esc(values.username || '')}">
    </div>
    <div class="${error ? 'field-invalid' : ''}">
      <label>Пароль</label>
      <input type="password" name="password">
    </div>
    <div class="form-actions">
      <button class="btn btn-primary" type="submit">Увійти</button>
      <a href="/register" style="color:#1a355e">Немає акаунта? Зареєструватися</a>
    </div>
  </form>
  <p style="font-size:13px;color:#666">Тестові акаунти: admin/admin123, manager/manager123, visitor/visitor123</p>`;
}

function registerPage({ errors = {}, values = {} } = {}) {
  const field = (name, label, type = 'text') => `
    <div class="${errors[name] ? 'field-invalid' : ''}">
      <label>${label}</label>
      <input type="${type}" name="${name}" value="${esc(values[name] || '')}">
      ${errors[name] ? `<div class="field-error">${esc(errors[name])}</div>` : ''}
    </div>`;
  return `<h2>Реєстрація</h2>
  <form class="entity-form" method="post" action="/register">
    ${field('username', 'Логін')}
    ${field('full_name', 'ПІБ')}
    ${field('password', 'Пароль', 'password')}
    ${field('password2', 'Пароль ще раз', 'password')}
    <div class="form-actions">
      <button class="btn btn-primary" type="submit">Зареєструватися</button>
      <a href="/login" style="color:#1a355e">Вже маєте акаунт? Увійти</a>
    </div>
  </form>`;
}

// ---------- Керування користувачами (тільки адмін) ----------
function usersPage(users, roleNames) {
  const rows = users.map(u => `<tr>
    <td>${u.id}</td>
    <td>${esc(u.username)}</td>
    <td>${esc(u.full_name)}</td>
    <td>${esc(roleNames[u.role] || u.role)}</td>
    <td style="white-space:nowrap">
      <a class="btn btn-edit" href="/users/${u.id}/edit">Змінити</a>
      ${u.id !== 1 ? `<form method="post" action="/users/${u.id}/delete" style="display:inline"
        onsubmit="return confirm('Видалити користувача?')">
        <button class="btn btn-del" type="submit">Видалити</button></form>` : ''}
    </td>
  </tr>`).join('\n');
  return `<h2>Користувачі системи</h2>
  <div class="top-actions"><a class="btn btn-primary" href="/users/new">+ Додати користувача</a></div>
  <table>
    <tr><th>№</th><th>Логін</th><th>ПІБ</th><th>Роль</th><th>Дії</th></tr>
    ${rows}
  </table>`;
}

function userFormPage({ values = {}, errors = {}, action, submitLabel, title }) {
  const field = (name, label, type = 'text', hint = '') => `
    <div class="${errors[name] ? 'field-invalid' : ''}">
      <label>${label}</label>
      <input type="${type}" name="${name}" value="${esc(values[name] || '')}">
      ${hint ? `<div style="font-size:12px;color:#777">${hint}</div>` : ''}
      ${errors[name] ? `<div class="field-error">${esc(errors[name])}</div>` : ''}
    </div>`;
  return `<h2>${esc(title)}</h2>
  <form class="entity-form" method="post" action="${esc(action)}">
    ${field('username', 'Логін')}
    ${field('full_name', 'ПІБ')}
    <div class="${errors.role ? 'field-invalid' : ''}">
      <label>Роль</label>
      <select name="role">
        <option value="">— оберіть —</option>
        <option value="admin"   ${values.role === 'admin' ? 'selected' : ''}>Адміністратор</option>
        <option value="manager" ${values.role === 'manager' ? 'selected' : ''}>Менеджер</option>
        <option value="visitor" ${values.role === 'visitor' ? 'selected' : ''}>Відвідувач</option>
      </select>
      ${errors.role ? `<div class="field-error">${esc(errors.role)}</div>` : ''}
    </div>
    ${field('password', 'Пароль', 'password', 'При редагуванні можна залишити порожнім — пароль не зміниться')}
    <div class="form-actions">
      <button class="btn btn-primary" type="submit">${esc(submitLabel)}</button>
      <a class="btn" href="/users" style="color:#1a355e">Скасувати</a>
    </div>
  </form>`;
}

module.exports = { layout, flash, listPage, formPage, loginPage, registerPage, usersPage, userFormPage, esc };
