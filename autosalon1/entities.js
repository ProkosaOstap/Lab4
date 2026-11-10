// Опис сутностей предметної області "Автосалон".
// Кожна сутність: заголовки, список полів із типами та валідаторами,
// а також правила видалення (refererential integrity).

const v = require('./validators');

const entities = {
  // ---------- МАРКИ МАШИН ----------
  brands: {
    key: 'brands',
    title: 'Марки машин',
    single: 'Марка', addLabel: 'марку',
    listColumns: ['id', 'name', 'country'],
    labels: { id: '№', name: 'Назва марки', country: 'Країна' },
    fields: [
      {
        name: 'name', label: 'Назва марки', type: 'text',
        validators: [v.required, v.length(2, 30), v.unique('brands', 'name', 'Марка з такою назвою вже є в базі')]
      },
      {
        name: 'country', label: 'Країна-виробник', type: 'text',
        validators: [v.required, v.length(2, 40)]
      }
    ],
    // марку не можна видалити, якщо є її комплектації
    deleteBlockedBy: { table: 'trims', fk: 'brand_id', message: 'Неможливо видалити: у марки є комплектації' }
  },

  // ---------- КОМПЛЕКТАЦІЯ ----------
  trims: {
    key: 'trims',
    title: 'Комплектації',
    single: 'Комплектація', addLabel: 'комплектацію',
    listColumns: ['id', 'brand_id', 'name', 'engine', 'power', 'transmission', 'price'],
    labels: { id: '№', brand_id: 'Марка', name: 'Назва', engine: 'Двигун, л', power: 'Потужність, к.с.', transmission: 'Коробка передач', price: 'Ціна, $' },
    fields: [
      {
        name: 'brand_id', label: 'Марка машини', type: 'select', optionsFrom: 'brands', optionLabel: r => `${r.name} (${r.country})`,
        validators: [v.required, v.exists('brands', 'марку машини')]
      },
      {
        name: 'name', label: 'Назва комплектації', type: 'text',
        validators: [v.required, v.length(2, 40)]
      },
      {
        name: 'engine', label: 'Обсяг двигуна, л', type: 'text', placeholder: '2.0',
        validators: [v.required, v.engine()]
      },
      {
        name: 'power', label: 'Потужність, к.с.', type: 'text', placeholder: '150',
        validators: [v.required, v.int(40, 1500)]
      },
      {
        name: 'transmission', label: 'Коробка передач', type: 'select',
        choices: ['Механіка', 'Автомат', 'Робот', 'Варіатор'],
        validators: [v.required, v.oneOf(['Механіка', 'Автомат', 'Робот', 'Варіатор'])]
      },
      {
        name: 'price', label: 'Ціна комплектації, $', type: 'text', placeholder: '35000',
        validators: [v.required, v.price(5000000)]
      }
    ],
    deleteBlockedBy: { table: 'sales', fk: 'trim_id', message: 'Неможливо видалити: комплектація вже продавалася' }
  },

  // ---------- КЛІЄНТИ ----------
  clients: {
    key: 'clients',
    title: 'Клієнти',
    single: 'Клієнт', addLabel: 'клієнта',
    listColumns: ['id', 'full_name', 'phone', 'email'],
    labels: { id: '№', full_name: 'ПІБ', phone: 'Телефон', email: 'Email' },
    fields: [
      {
        name: 'full_name', label: 'ПІБ клієнта', type: 'text',
        validators: [v.required, v.length(5, 60), v.unique('clients', 'full_name', 'Клієнт з таким ПІБ вже зареєстрований')]
      },
      {
        name: 'phone', label: 'Телефон', type: 'text', placeholder: '+380671234567',
        validators: [v.required, v.phone()]
      },
      {
        name: 'email', label: 'Email', type: 'text', placeholder: 'name@example.com',
        validators: [v.required, v.email(), v.unique('clients', 'email', 'Клієнт з таким email вже зареєстрований')]
      }
    ],
    deleteBlockedBy: { table: 'sales', fk: 'client_id', message: 'Неможливо видалити: у клієнта є продажі' }
  },

  // ---------- ДОДАТКОВІ ОПЦІЇ ----------
  options: {
    key: 'options',
    title: 'Додаткові опції',
    single: 'Опція', addLabel: 'опцію',
    listColumns: ['id', 'name', 'price'],
    labels: { id: '№', name: 'Назва опції', price: 'Ціна, $' },
    fields: [
      {
        name: 'name', label: 'Назва опції', type: 'text',
        validators: [v.required, v.length(3, 50), v.unique('options', 'name', 'Така опція вже існує')]
      },
      {
        name: 'price', label: 'Ціна опції, $', type: 'text', placeholder: '500',
        validators: [v.required, v.price(100000)]
      }
    ],
    // опцію не можна видалити, якщо її вибрали у продажах
    deleteBlockedBy: { table: 'sale_options', fk: 'option_id', message: 'Неможливо видалити: опція входить у продажі' }
  },

  // ---------- ПРОДАЖІ ----------
  sales: {
    key: 'sales',
    title: 'Продажі',
    single: 'Продаж', addLabel: 'продаж',
    listColumns: ['id', 'client_id', 'trim_id', 'sale_date', 'discount', 'options'],
    labels: { id: '№', client_id: 'Клієнт', trim_id: 'Комплектація', sale_date: 'Дата', discount: 'Знижка, %', options: 'Додаткові опції' },
    fields: [
      {
        name: 'client_id', label: 'Клієнт', type: 'select', optionsFrom: 'clients', optionLabel: r => r.full_name,
        validators: [v.required, v.exists('clients', 'клієнта')]
      },
      {
        name: 'trim_id', label: 'Комплектація', type: 'select', optionsFrom: 'trims',
        optionLabel: r => {
          const brand = r.__brandName || '';
          return `${r.name} — ${brand} (${r.price}$)`;
        },
        validators: [v.required, v.exists('trims', 'комплектацію')]
      },
      {
        name: 'sale_date', label: 'Дата продажу', type: 'date',
        validators: [v.required, v.date()]
      },
      {
        name: 'discount', label: 'Знижка, %', type: 'text', placeholder: '0',
        validators: [v.required, v.int(0, 50)]
      },
      {
        name: 'options', label: 'Додаткові опції', type: 'checkboxes', optionsFrom: 'options', optional: true,
        validators: []
      }
    ],
    // продаж видаляється разом із вибраними опціями
    cascade: 'sale_options'
  }
};

module.exports = entities;
