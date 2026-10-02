const fs = require('fs');
const path = require('path');
const bcrypt = require('bcryptjs');

const dbPath = path.join(__dirname, '..', 'data', 'db.json');

function ensureDb() {
  if (!fs.existsSync(path.dirname(dbPath))) {
    fs.mkdirSync(path.dirname(dbPath), { recursive: true });
  }

  if (!fs.existsSync(dbPath)) {
    const users = [
      { id: 1, name: 'Farm Owner', email: 'admin@farm.com', passwordHash: bcrypt.hashSync('admin123', 10), role: 'admin' },
      { id: 2, name: 'Sale Employee', email: 'employee@farm.com', passwordHash: bcrypt.hashSync('employee123', 10), role: 'employee' },
      { id: 3, name: 'Ali Customer', email: 'customer@farm.com', passwordHash: bcrypt.hashSync('customer123', 10), role: 'customer' },
    ];

    const inventory = [
      { id: 1, product: 'Broiler Chicken', quantity: 500, costPrice: 550 },
      { id: 2, product: 'Feed', quantity: 100, costPrice: 3200 },
      { id: 3, product: 'Medicines', quantity: 40, costPrice: 1500 },
    ];

    const customers = [
      { id: 1, userId: 3, name: 'Ali Customer', phone: '03001234567', totalPurchases: 0, paidCash: 0, paidBank: 0, paidEasypaisa: 0, openingBalance: 0, balance: 0 },
    ];

    const db = {
      users,
      customers,
      transactions: [],
      inventory,
      settings: { mandiMarkupPerKg: 20 },
      nextIds: { users: 4, customers: 2, transactions: 1, inventory: 4 },
    };

    fs.writeFileSync(dbPath, JSON.stringify(db, null, 2));
  }
}

function readDb() {
  ensureDb();
  const db = JSON.parse(fs.readFileSync(dbPath, 'utf-8'));
  if (!db.settings) db.settings = {};
  if (typeof db.settings.mandiMarkupPerKg !== 'number') db.settings.mandiMarkupPerKg = 20;
  if (!Array.isArray(db.customers)) db.customers = [];
  db.customers = db.customers.map((customer) => ({
    ...customer,
    openingBalance: typeof customer.openingBalance === 'number' ? customer.openingBalance : 0,
    balance: Math.max(
      Number(customer.openingBalance || 0) +
      Number(customer.totalPurchases || 0) -
      (Number(customer.paidCash || 0) + Number(customer.paidBank || 0) + Number(customer.paidEasypaisa || 0)),
      0
    ),
    advanceAmount: Math.max(
      (Number(customer.paidCash || 0) + Number(customer.paidBank || 0) + Number(customer.paidEasypaisa || 0)) -
      (Number(customer.openingBalance || 0) + Number(customer.totalPurchases || 0)),
      0
    ),
  }));
  return db;
}

function writeDb(data) {
  fs.writeFileSync(dbPath, JSON.stringify(data, null, 2));
}

module.exports = { readDb, writeDb };
