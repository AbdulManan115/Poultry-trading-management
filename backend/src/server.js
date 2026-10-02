const express = require('express');
const cors = require('cors');
const bcrypt = require('bcryptjs');
const multer = require('multer');
const XLSX = require('xlsx');
const { readDb, writeDb } = require('./store');
const { signToken, authRequired, roleRequired } = require('./auth');

const app = express();
const upload = multer({ storage: multer.memoryStorage() });
const PORT = process.env.PORT || 4000;

app.use(cors());
app.use(express.json());

function sanitizeUser(user) {
  return { id: user.id, name: user.name, email: user.email, role: user.role };
}

function recalculateCustomerBalance(customer) {
  const openingBalance = Number(customer.openingBalance || 0);
  const totalPurchases = Number(customer.totalPurchases || 0);
  const paidCash = Number(customer.paidCash || 0);
  const paidBank = Number(customer.paidBank || 0);
  const paidEasypaisa = Number(customer.paidEasypaisa || 0);
  const netReceivable = openingBalance + totalPurchases - (paidCash + paidBank + paidEasypaisa);
  customer.balance = Math.max(netReceivable, 0);
  customer.advanceAmount = Math.max(-netReceivable, 0);
}

function calculateTransaction(db, payload) {
  const quantity = Number(payload.quantityBought || 0);
  let costPrice = Number(payload.costPrice || 0);
  const costManPrice = Number(payload.costManPrice || 0);
  if (!costPrice && costManPrice) {
    costPrice = costManPrice / 40;
  }

  let salePrice = Number(payload.salePrice || 0);
  const manPrice = Number(payload.manPrice || 0);
  const mandiPrice = Number(payload.mandiPrice || 0);
  if (!salePrice && manPrice) {
    salePrice = manPrice / 40;
  } else if (!salePrice && mandiPrice) {
    salePrice = mandiPrice + Number(db.settings.mandiMarkupPerKg || 0);
  }

  const paymentCash = Number(payload.paymentCash || 0);
  const paymentBank = Number(payload.paymentBank || 0);
  const paymentEasypaisa = Number(payload.paymentEasypaisa || 0);
  const total = salePrice * quantity;
  const paid = paymentCash + paymentBank + paymentEasypaisa;

  return {
    quantity,
    costPrice,
    costManPrice,
    salePrice,
    manPrice,
    mandiPrice,
    paymentCash,
    paymentBank,
    paymentEasypaisa,
    total,
    paid,
    profit: (salePrice * quantity) - (costPrice * quantity),
  };
}

app.get('/api/health', (_req, res) => {
  res.json({ ok: true });
});

app.post('/api/auth/login', (req, res) => {
  const { email, password } = req.body;
  const db = readDb();
  const user = db.users.find((u) => u.email.toLowerCase() === String(email || '').toLowerCase());

  if (!user || !bcrypt.compareSync(password || '', user.passwordHash)) {
    return res.status(401).json({ message: 'Invalid credentials' });
  }

  const token = signToken(user);
  return res.json({ token, user: sanitizeUser(user) });
});

app.get('/api/auth/me', authRequired, (req, res) => {
  const db = readDb();
  const user = db.users.find((u) => u.id === req.user.userId);
  if (!user) {
    return res.status(404).json({ message: 'User not found' });
  }
  res.json({ user: sanitizeUser(user) });
});

app.get('/api/dashboard/summary', authRequired, (req, res) => {
  const db = readDb();
  const allTransactions = db.transactions;
  let transactions = allTransactions;

  if (req.user.role === 'customer') {
    const customer = db.customers.find((c) => c.userId === req.user.userId);
    transactions = customer ? allTransactions.filter((t) => t.customerId === customer.id) : [];
  }

  const totalSales = transactions.reduce((a, t) => a + t.totalAmount, 0);
  const totalPaid = transactions.reduce((a, t) => a + t.totalPaid, 0);
  const previousBalance = req.user.role === 'customer'
    ? Number(db.customers.find((c) => c.userId === req.user.userId)?.openingBalance || 0)
    : db.customers.reduce((sum, c) => sum + Number(c.openingBalance || 0), 0);
  const pendingPayments = req.user.role === 'customer'
    ? Number(db.customers.find((c) => c.userId === req.user.userId)?.balance || 0)
    : db.customers.reduce((sum, c) => sum + Number(c.balance || 0), 0);
  const totalAdvance = req.user.role === 'customer'
    ? Number(db.customers.find((c) => c.userId === req.user.userId)?.advanceAmount || 0)
    : db.customers.reduce((sum, c) => sum + Number(c.advanceAmount || 0), 0);
  const totalProfit = transactions.reduce((a, t) => a + t.profit, 0);

  res.json({
    totalSales,
    receivedPayments: totalPaid,
    pendingPayments,
    previousBalance,
    netReceivable: pendingPayments,
    totalAdvance,
    totalProfit,
    inventory: db.inventory,
    transactionsCount: transactions.length,
  });
});

app.get('/api/customer/portal-data', authRequired, roleRequired('customer'), (req, res) => {
  const db = readDb();
  const user = db.users.find((u) => u.id === req.user.userId);
  const customer = db.customers.find((c) => c.userId === req.user.userId);

  if (!user || !customer) {
    return res.status(404).json({ message: 'Customer account not found' });
  }

  const transactions = db.transactions.filter((t) => t.customerId === customer.id);
  const totalPurchasedAmount = transactions.reduce((sum, t) => sum + Number(t.totalAmount || 0), 0);
  const totalPaidAmount = transactions.reduce((sum, t) => sum + Number(t.totalPaid || 0), 0);
  const pendingPayments = Number(customer.balance || 0);
  const advanceAmount = Number(customer.advanceAmount || 0);
  const previousBalance = Number(customer.openingBalance || 0);

  return res.json({
    customer: {
      id: customer.id,
      name: customer.name,
      email: user.email,
      phone: customer.phone,
    },
    summary: {
      pendingPayments,
      previousBalance,
      netReceivable: pendingPayments,
      advanceAmount,
      totalTransactions: transactions.length,
      totalPurchasedAmount,
    },
    transactions,
  });
});

app.get('/api/customers', authRequired, roleRequired('admin', 'employee'), (req, res) => {
  const db = readDb();
  res.json(db.customers);
});

app.post('/api/customers', authRequired, roleRequired('admin'), (req, res) => {
  const { name, email, password, phone, openingBalance } = req.body;
  if (!name || !email || !password) {
    return res.status(400).json({ message: 'name, email and password are required' });
  }

  const db = readDb();
  if (db.users.some((u) => u.email.toLowerCase() === email.toLowerCase())) {
    return res.status(409).json({ message: 'Email already exists' });
  }

  const userId = db.nextIds.users++;
  const customerId = db.nextIds.customers++;

  db.users.push({
    id: userId,
    name,
    email,
    passwordHash: bcrypt.hashSync(password, 10),
    role: 'customer',
  });

  db.customers.push({
    id: customerId,
    userId,
    name,
    phone: phone || '',
    totalPurchases: 0,
    paidCash: 0,
    paidBank: 0,
    paidEasypaisa: 0,
    openingBalance: Number(openingBalance || 0),
    balance: Math.max(Number(openingBalance || 0), 0),
  });

  writeDb(db);
  res.status(201).json({ message: 'Customer created' });
});

app.delete('/api/customers/:id', authRequired, roleRequired('admin'), (req, res) => {
  const db = readDb();
  const customerId = Number(req.params.id);
  const customerIndex = db.customers.findIndex((c) => c.id === customerId);
  if (customerIndex === -1) {
    return res.status(404).json({ message: 'Customer not found' });
  }

  const customer = db.customers[customerIndex];
  const customerTransactions = db.transactions.filter((t) => t.customerId === customerId);

  const chicken = db.inventory.find((i) => i.product === 'Broiler Chicken');
  if (chicken) {
    const totalReturnedQty = customerTransactions.reduce((sum, tx) => sum + Number(tx.quantityBought || 0), 0);
    chicken.quantity += totalReturnedQty;
  }

  db.transactions = db.transactions.filter((t) => t.customerId !== customerId);
  db.customers.splice(customerIndex, 1);
  db.users = db.users.filter((u) => u.id !== customer.userId);

  writeDb(db);
  return res.json({
    message: 'Customer deleted',
    deletedTransactions: customerTransactions.length,
  });
});

app.put('/api/customers/:id', authRequired, roleRequired('admin'), (req, res) => {
  const db = readDb();
  const customerId = Number(req.params.id);
  const customer = db.customers.find((c) => c.id === customerId);
  if (!customer) {
    return res.status(404).json({ message: 'Customer not found' });
  }

  const nextName = String(req.body?.name || '').trim();
  const nextPhone = String(req.body?.phone || '').trim();
  if (!nextName) {
    return res.status(400).json({ message: 'name is required' });
  }

  customer.name = nextName;
  customer.phone = nextPhone;
  const linkedUser = db.users.find((u) => u.id === customer.userId);
  if (linkedUser) {
    linkedUser.name = nextName;
  }

  writeDb(db);
  return res.json({ message: 'Customer updated', customer });
});

app.put('/api/customers/:id/opening-balance', authRequired, roleRequired('admin'), (req, res) => {
  const db = readDb();
  const customerId = Number(req.params.id);
  const customer = db.customers.find((c) => c.id === customerId);
  if (!customer) {
    return res.status(404).json({ message: 'Customer not found' });
  }

  const openingBalance = Number(req.body?.openingBalance || 0);
  if (Number.isNaN(openingBalance) || openingBalance < 0) {
    return res.status(400).json({ message: 'openingBalance must be a non-negative number' });
  }

  customer.openingBalance = openingBalance;
  recalculateCustomerBalance(customer);
  writeDb(db);
  return res.json({ id: customer.id, openingBalance: customer.openingBalance, balance: customer.balance });
});

app.get('/api/transactions', authRequired, (req, res) => {
  const db = readDb();
  if (req.user.role === 'customer') {
    const customer = db.customers.find((c) => c.userId === req.user.userId);
    const rows = customer ? db.transactions.filter((t) => t.customerId === customer.id) : [];
    return res.json(rows);
  }
  res.json(db.transactions);
});

app.post('/api/transactions', authRequired, roleRequired('admin', 'employee'), (req, res) => {
  const db = readDb();
  const { customerId, date } = req.body;

  const customer = db.customers.find((c) => c.id === Number(customerId));
  if (!customer) {
    return res.status(404).json({ message: 'Customer not found' });
  }

  const cal = calculateTransaction(db, req.body);
  const tx = {
    id: db.nextIds.transactions++,
    customerId: customer.id,
    date: date || new Date().toISOString(),
    quantityBought: cal.quantity,
    costPrice: cal.costPrice,
    costManPrice: cal.costManPrice,
    salePrice: cal.salePrice,
    manPrice: cal.manPrice,
    mandiPrice: cal.mandiPrice,
    paymentCash: cal.paymentCash,
    paymentBank: cal.paymentBank,
    paymentEasypaisa: cal.paymentEasypaisa,
    paymentTiming: req.body.paymentTiming === 'evening' ? 'evening' : 'morning',
    totalAmount: cal.total,
    totalPaid: cal.paid,
    remainingBalance: Math.max(cal.total - cal.paid, 0),
    overpaidAmount: Math.max(cal.paid - cal.total, 0),
    profit: cal.profit,
    createdBy: req.user.userId,
  };

  customer.totalPurchases += cal.total;
  customer.paidCash += cal.paymentCash;
  customer.paidBank += cal.paymentBank;
  customer.paidEasypaisa += cal.paymentEasypaisa;
  recalculateCustomerBalance(customer);

  const chicken = db.inventory.find((i) => i.product === 'Broiler Chicken');
  if (chicken) {
    chicken.quantity = Math.max(chicken.quantity - cal.quantity, 0);
  }

  db.transactions.push(tx);
  writeDb(db);
  res.status(201).json(tx);
});

app.put('/api/transactions/:id', authRequired, roleRequired('admin', 'employee'), (req, res) => {
  const db = readDb();
  const txId = Number(req.params.id);
  const txIndex = db.transactions.findIndex((t) => t.id === txId);
  if (txIndex === -1) {
    return res.status(404).json({ message: 'Transaction not found' });
  }

  const oldTx = db.transactions[txIndex];
  const oldCustomer = db.customers.find((c) => c.id === oldTx.customerId);
  if (oldCustomer) {
    oldCustomer.totalPurchases = Math.max(oldCustomer.totalPurchases - Number(oldTx.totalAmount || 0), 0);
    oldCustomer.paidCash = Math.max(oldCustomer.paidCash - Number(oldTx.paymentCash || 0), 0);
    oldCustomer.paidBank = Math.max(oldCustomer.paidBank - Number(oldTx.paymentBank || 0), 0);
    oldCustomer.paidEasypaisa = Math.max(oldCustomer.paidEasypaisa - Number(oldTx.paymentEasypaisa || 0), 0);
    recalculateCustomerBalance(oldCustomer);
  }

  const chicken = db.inventory.find((i) => i.product === 'Broiler Chicken');
  if (chicken) {
    chicken.quantity += Number(oldTx.quantityBought || 0);
  }

  const nextCustomerId = Number(req.body.customerId || oldTx.customerId);
  const nextCustomer = db.customers.find((c) => c.id === nextCustomerId);
  if (!nextCustomer) {
    return res.status(404).json({ message: 'Customer not found' });
  }

  const cal = calculateTransaction(db, req.body);
  const updatedTx = {
    ...oldTx,
    customerId: nextCustomerId,
    date: req.body.date || oldTx.date,
    quantityBought: cal.quantity,
    costPrice: cal.costPrice,
    costManPrice: cal.costManPrice,
    salePrice: cal.salePrice,
    manPrice: cal.manPrice,
    mandiPrice: cal.mandiPrice,
    paymentCash: cal.paymentCash,
    paymentBank: cal.paymentBank,
    paymentEasypaisa: cal.paymentEasypaisa,
    paymentTiming: req.body.paymentTiming === 'evening' ? 'evening' : 'morning',
    totalAmount: cal.total,
    totalPaid: cal.paid,
    remainingBalance: Math.max(cal.total - cal.paid, 0),
    overpaidAmount: Math.max(cal.paid - cal.total, 0),
    profit: cal.profit,
  };

  nextCustomer.totalPurchases += cal.total;
  nextCustomer.paidCash += cal.paymentCash;
  nextCustomer.paidBank += cal.paymentBank;
  nextCustomer.paidEasypaisa += cal.paymentEasypaisa;
  recalculateCustomerBalance(nextCustomer);

  if (chicken) {
    chicken.quantity = Math.max(chicken.quantity - cal.quantity, 0);
  }

  db.transactions[txIndex] = updatedTx;
  writeDb(db);
  return res.json(updatedTx);
});

app.delete('/api/transactions/:id', authRequired, roleRequired('admin', 'employee'), (req, res) => {
  const db = readDb();
  const txId = Number(req.params.id);
  const txIndex = db.transactions.findIndex((t) => t.id === txId);

  if (txIndex === -1) {
    return res.status(404).json({ message: 'Transaction not found' });
  }

  const tx = db.transactions[txIndex];
  const customer = db.customers.find((c) => c.id === tx.customerId);
  if (customer) {
    customer.totalPurchases = Math.max(customer.totalPurchases - Number(tx.totalAmount || 0), 0);
    customer.paidCash = Math.max(customer.paidCash - Number(tx.paymentCash || 0), 0);
    customer.paidBank = Math.max(customer.paidBank - Number(tx.paymentBank || 0), 0);
    customer.paidEasypaisa = Math.max(customer.paidEasypaisa - Number(tx.paymentEasypaisa || 0), 0);
    recalculateCustomerBalance(customer);
  }

  const chicken = db.inventory.find((i) => i.product === 'Broiler Chicken');
  if (chicken) {
    chicken.quantity += Number(tx.quantityBought || 0);
  }

  db.transactions.splice(txIndex, 1);
  writeDb(db);
  return res.json({ message: 'Transaction deleted' });
});

app.post('/api/transactions/upload', authRequired, roleRequired('admin'), upload.single('file'), (req, res) => {
  if (!req.file) {
    return res.status(400).json({ message: 'Excel file is required' });
  }

  const db = readDb();
  const workbook = XLSX.read(req.file.buffer, { type: 'buffer' });
  const sheet = workbook.Sheets[workbook.SheetNames[0]];
  const rows = XLSX.utils.sheet_to_json(sheet);

  let imported = 0;
  for (const row of rows) {
    const customerId = Number(row.customerId || row.CustomerId || row.customer_id);
    const customer = db.customers.find((c) => c.id === customerId);
    if (!customer) continue;

    const payload = {
      quantityBought: row.quantityBought || row.Quantity,
      costPrice: row.costPrice || row.CostPrice,
      costManPrice: row.costManPrice || row.CostManPrice,
      salePrice: row.salePrice || row.SalePrice,
      manPrice: row.manPrice || row.ManPrice,
      mandiPrice: row.mandiPrice || row.MandiPrice,
      paymentCash: row.paymentCash || row.Cash,
      paymentBank: row.paymentBank || row.Bank,
      paymentEasypaisa: row.paymentEasypaisa || row.Easypaisa,
      paymentTiming: row.paymentTiming || row.PaymentTiming,
    };

    const cal = calculateTransaction(db, payload);
    const tx = {
      id: db.nextIds.transactions++,
      customerId,
      date: row.date ? new Date(row.date).toISOString() : new Date().toISOString(),
      quantityBought: cal.quantity,
      costPrice: cal.costPrice,
      costManPrice: cal.costManPrice,
      salePrice: cal.salePrice,
      manPrice: cal.manPrice,
      mandiPrice: cal.mandiPrice,
      paymentCash: cal.paymentCash,
      paymentBank: cal.paymentBank,
      paymentEasypaisa: cal.paymentEasypaisa,
      paymentTiming: String(payload.paymentTiming || '').toLowerCase() === 'evening' ? 'evening' : 'morning',
      totalAmount: cal.total,
      totalPaid: cal.paid,
      remainingBalance: Math.max(cal.total - cal.paid, 0),
      overpaidAmount: Math.max(cal.paid - cal.total, 0),
      profit: cal.profit,
      createdBy: req.user.userId,
    };

    customer.totalPurchases += cal.total;
    customer.paidCash += cal.paymentCash;
    customer.paidBank += cal.paymentBank;
    customer.paidEasypaisa += cal.paymentEasypaisa;
    recalculateCustomerBalance(customer);

    db.transactions.push(tx);
    imported += 1;
  }

  writeDb(db);
  res.json({ message: 'Imported', imported });
});

app.get('/api/inventory', authRequired, roleRequired('admin', 'employee'), (_req, res) => {
  const db = readDb();
  res.json(db.inventory);
});

app.post('/api/inventory', authRequired, roleRequired('admin'), (req, res) => {
  const db = readDb();
  const { product, quantity, costPrice } = req.body;
  if (!product) {
    return res.status(400).json({ message: 'product is required' });
  }

  db.inventory.push({
    id: db.nextIds.inventory++,
    product,
    quantity: Number(quantity || 0),
    costPrice: Number(costPrice || 0),
  });

  writeDb(db);
  res.status(201).json({ message: 'Inventory item added' });
});

app.listen(PORT, () => {
  // eslint-disable-next-line no-console
  console.log(`Backend running on http://localhost:${PORT}`);
});
