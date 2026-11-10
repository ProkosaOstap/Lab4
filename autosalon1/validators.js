// Валідатори — використовуються ТІЛЬКИ на сервері.
// Кожен валідатор повертає текст помилки (українською) або null, якщо значення коректне.

const validators = {
  // Обов'язкове поле: після обрізання пробілів не повинно бути порожнім
  required(value) {
    if (value === undefined || value === null || String(value).trim() === '') {
      return 'Поле не може бути порожнім';
    }
    return null;
  },

  // Довжина рядка
  length(min, max) {
    return (value) => {
      const s = String(value).trim();
      if (s.length < min) return `Мінімальна довжина — ${min} симв.`;
      if (s.length > max) return `Максимальна довжина — ${max} симв.`;
      return null;
    };
  },

  // Ціле число в межах [min, max]
  int(min, max) {
    return (value) => {
      if (!/^-?\d+$/.test(String(value).trim())) return 'Повинно бути цілим числом';
      const n = Number(value);
      if (n < min || n > max) return `Повинно бути в межах від ${min} до ${max}`;
      return null;
    };
  },

  // Додатне число з крапкою або комою (ціна)
  price(max) {
    return (value) => {
      const s = String(value).trim().replace(',', '.');
      if (!/^\d+(\.\d{1,2})?$/.test(s)) return 'Повинно бути невід\'ємним числом (приклад: 12500 або 12500.50)';
      const n = Number(s);
      if (n <= 0) return 'Ціна повинна бути більшою за 0';
      if (n > max) return `Максимальне значення — ${max}`;
      return null;
    };
  },

  // Обсяг двигуна, л (наприклад 1.6 / 2.0 / 5.0)
  engine() {
    return (value) => {
      const s = String(value).trim().replace(',', '.');
      if (!/^\d+(\.\d)?$/.test(s)) return 'Приклад: 2.0';
      const n = Number(s);
      if (n < 0.6 || n > 8) return 'Обсяг повинен бути в межах 0.6–8.0 л';
      return null;
    };
  },

  // Телефон у форматі +380XXXXXXXXX
  phone() {
    return (value) => {
      if (!/^\+380\d{9}$/.test(String(value).trim())) {
        return 'Формат: +380XXXXXXXXX (наприклад, +380671234567)';
      }
      return null;
    };
  },

  // Email
  email() {
    return (value) => {
      if (!/^[^\s@]+@[^\s@]+\.[a-zA-Z]{2,}$/.test(String(value).trim())) {
        return 'Некоректний email (приклад: name@example.com)';
      }
      return null;
    };
  },

  // Дата у форматі РРРР-ММ-ДД, не пізніше сьогоднішньої
  date() {
    return (value) => {
      const s = String(value).trim();
      if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return 'Формат дати: РРРР-ММ-ДД';
      const d = new Date(s + 'T00:00:00');
      if (Number.isNaN(d.getTime())) return 'Такої дати не існує';
      const today = new Date();
      today.setHours(23, 59, 59, 999);
      if (d > today) return 'Дата продажу не може бути в майбутньому';
      return null;
    };
  },

  // Значення з обмеженого списку
  oneOf(list) {
    return (value) => (list.includes(String(value).trim()) ? null : `Дозволені значення: ${list.join(', ')}`);
  },

  // Існування запису в іншій таблиці (зовнішній ключ)
  exists(table, label) {
    return (value, db) => {
      if (!db.get(table, value)) return `Оберіть ${label} (запис не знайдено)`;
      return null;
    };
  },

  // Унікальність значення в таблиці (крім поточного запису при редагуванні)
  unique(table, field, message) {
    return (value, db, currentId) => {
      const dup = db.all(table).find(
        r => String(r[field]).toLowerCase() === String(value).trim().toLowerCase() && r.id !== Number(currentId)
      );
      return dup ? (message || 'Таке значення вже існує') : null;
    };
  }
};

module.exports = validators;
