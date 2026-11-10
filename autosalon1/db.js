// Просте файлове сховище даних (JSON) з автоінкрементом id.
// У лабораторній робі замість нього може бути будь-яка БД —
// інтерфейс (getAll, getById, insert, update, remove) той самий.

const fs = require('fs');
const path = require('path');

const DATA_FILE = path.join(process.env.DATA_DIR || path.join(__dirname, 'data'), 'db.json');

const seed = {
  nextId: { brands: 5, trims: 6, clients: 5, options: 6, sales: 4, sale_options: 100, users: 4 },
  // Користувачі: admin/admin123, manager/manager123, visitor/visitor123
  users: [
    { id: 1, username: 'admin', password_hash: '$2b$10$WN5U28OKjc16PcAIst.AC.xLp0L.Lurjxc7Ds08Y6axmFqevmpOEm', full_name: 'Адміністратор системи', role: 'admin' },
    { id: 2, username: 'manager', password_hash: '$2b$10$j13TAFSptl1TeONgBuHksup65QlN/H.lDKvjTQlRGrR.1wm9qdG2q', full_name: 'Менеджер продажів', role: 'manager' },
    { id: 3, username: 'visitor', password_hash: '$2b$10$rE01WJalYB9xIxR740fGmubQBN7Q/h775nvZg2HdehgEGF8JXo9EO', full_name: 'Відвідувач', role: 'visitor' }
  ],
  brands: [
    { id: 1, name: 'Toyota', country: 'Японія' },
    { id: 2, name: 'BMW', country: 'Німеччина' },
    { id: 3, name: 'Skoda', country: 'Чехія' },
    { id: 4, name: 'Tesla', country: 'США' }
  ],
  trims: [
    { id: 1, brand_id: 1, name: 'Comfort', engine: '2.0', power: 150, transmission: 'Автомат', price: 32000 },
    { id: 2, brand_id: 1, name: 'Prestige', engine: '2.5', power: 200, transmission: 'Автомат', price: 41000 },
    { id: 3, brand_id: 2, name: '320d M Sport', engine: '2.0', power: 190, transmission: 'Автомат', price: 52000 },
    { id: 4, brand_id: 2, name: '530e xDrive', engine: '2.0', power: 292, transmission: 'Автомат', price: 78000 },
    { id: 5, brand_id: 3, name: 'Octavia Style', engine: '1.5', power: 150, transmission: 'Механіка', price: 28000 }
  ],
  clients: [
    { id: 1, full_name: 'Прокоса Остап Богданович', phone: '+380671234567', email: 'ostap@example.com' },
    { id: 2, full_name: 'Ковальчук Ірина Петрівна', phone: '+380509876543', email: 'iryna.k@example.com' },
    { id: 3, full_name: 'Мельник Андрій Ігорович', phone: '+380632221133', email: 'a.melnyk@example.com' },
    { id: 4, full_name: 'Шевченко Олена Василівна', phone: '+380931114455', email: 'elena.sh@example.com' }
  ],
  options: [
    { id: 1, name: 'Панорамний дах', price: 1200 },
    { id: 2, name: 'Обігрів сидінь', price: 400 },
    { id: 3, name: 'Камера заднього огляду', price: 350 },
    { id: 4, name: 'Литі диски R18', price: 900 },
    { id: 5, name: 'Сигналізація з автозапуском', price: 550 }
  ],
  sales: [
    { id: 1, client_id: 1, trim_id: 1, sale_date: '2025-09-12', discount: 5 },
    { id: 2, client_id: 2, trim_id: 3, sale_date: '2025-10-03', discount: 0 },
    { id: 3, client_id: 3, trim_id: 5, sale_date: '2025-10-21', discount: 10 }
  ],
  sale_options: [
    { sale_id: 1, option_id: 2 },
    { sale_id: 1, option_id: 3 },
    { sale_id: 2, option_id: 1 },
    { sale_id: 2, option_id: 4 },
    { sale_id: 3, option_id: 5 }
  ]
};

function load() {
  try {
    return JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
  } catch {
    return JSON.parse(JSON.stringify(seed));
  }
}

let data = load();

function save() {
  fs.mkdirSync(path.dirname(DATA_FILE), { recursive: true });
  fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2), 'utf8');
}

const db = {
  all(table) {
    return data[table];
  },
  get(table, id) {
    return data[table].find(r => r.id === Number(id)) || null;
  },
  insert(table, row) {
    const id = data.nextId[table]++;
    const created = { id, ...row };
    data[table].push(created);
    save();
    return created;
  },
  update(table, id, row) {
    const idx = data[table].findIndex(r => r.id === Number(id));
    if (idx === -1) return null;
    data[table][idx] = { id: Number(id), ...row };
    save();
    return data[table][idx];
  },
  remove(table, id) {
    const idx = data[table].findIndex(r => r.id === Number(id));
    if (idx === -1) return false;
    data[table].splice(idx, 1);
    save();
    return true;
  },
  // вибрані опції продажу (зв'язок багато-до-багатьох)
  getSaleOptions(saleId) {
    return data.sale_options.filter(so => so.sale_id === Number(saleId)).map(so => so.option_id);
  },
  setSaleOptions(saleId, optionIds) {
    data.sale_options = data.sale_options.filter(so => so.sale_id !== Number(saleId));
    for (const oid of optionIds) data.sale_options.push({ sale_id: Number(saleId), option_id: Number(oid) });
    save();
  },
  removeSaleOptions(saleId) {
    data.sale_options = data.sale_options.filter(so => so.sale_id !== Number(saleId));
    save();
  },
  findBy(table, field, value) {
    return data[table].filter(r => String(r[field]) === String(value));
  },
  reset() {
    data = JSON.parse(JSON.stringify(seed));
    save();
  }
};

module.exports = db;
