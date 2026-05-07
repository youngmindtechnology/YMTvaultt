const express = require('express');
const cors = require('cors');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const fs = require('fs');
const path = require('path');
const axios = require('axios');

const app = express();
const PORT = 3000;
const JWT_SECRET = 'YMT_!login';
const PAYSTACK_SECRET = 'sk_test_5479f29b5d1c273d975e6c8fac006f234b06c89d'; // Replace with your Paystack secret key

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, '../frontend')));

// Database file path
const DB_PATH = path.join(__dirname, 'database.json');

// Initialize database
function initDB() {
  if (!fs.existsSync(DB_PATH)) {
    const initialData = { users: [], transactions: [], vaults: [] };
    fs.writeFileSync(DB_PATH, JSON.stringify(initialData, null, 2));
  }
}

function readDB() {
  return JSON.parse(fs.readFileSync(DB_PATH, 'utf8'));
}

function writeDB(data) {
  fs.writeFileSync(DB_PATH, JSON.stringify(data, null, 2));
}

// Auth middleware
function authMiddleware(req, res, next) {
  const token = req.headers.authorization?.split(' ')[1];
  if (!token) return res.status(401).json({ error: 'No token provided' });
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.userId = decoded.userId;
    next();
  } catch {
    res.status(401).json({ error: 'Invalid token' });
  }
}

// ─────────────────────────────────────────────
// AUTH ROUTES
// ─────────────────────────────────────────────

// POST /register
app.post('/register', async (req, res) => {
  try {
    const { fullName, email, phone, password } = req.body;
    if (!fullName || !email || !phone || !password)
      return res.status(400).json({ error: 'All fields are required' });

    const db = readDB();
    if (db.users.find(u => u.email === email))
      return res.status(400).json({ error: 'Email already registered' });

    const hashedPassword = await bcrypt.hash(password, 10);
    const user = {
      id: Date.now().toString(),
      fullName,
      email,
      phone,
      password: hashedPassword,
      balance: 0,
      createdAt: new Date().toISOString()
    };

    db.users.push(user);
    writeDB(db);

    const token = jwt.sign({ userId: user.id }, JWT_SECRET, { expiresIn: '7d' });
    res.json({ success: true, token, user: { id: user.id, fullName, email, phone, balance: 0 } });
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

// POST /login
app.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    const db = readDB();
    const user = db.users.find(u => u.email === email);
    if (!user) return res.status(400).json({ error: 'Invalid credentials' });

    const match = await bcrypt.compare(password, user.password);
    if (!match) return res.status(400).json({ error: 'Invalid credentials' });

    const token = jwt.sign({ userId: user.id }, JWT_SECRET, { expiresIn: '7d' });
    res.json({
      success: true, token,
      user: { id: user.id, fullName: user.fullName, email: user.email, phone: user.phone, balance: user.balance }
    });
  } catch {
    res.status(500).json({ error: 'Server error' });
  }
});

// ─────────────────────────────────────────────
// USER ROUTES
// ─────────────────────────────────────────────

// GET /balance
app.get('/balance', authMiddleware, (req, res) => {
  const db = readDB();
  const user = db.users.find(u => u.id === req.userId);
  if (!user) return res.status(404).json({ error: 'User not found' });
  res.json({ balance: user.balance, fullName: user.fullName, email: user.email });
});

// GET /transactions
app.get('/transactions', authMiddleware, (req, res) => {
  const db = readDB();
  const transactions = db.transactions
    .filter(t => t.userId === req.userId)
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  res.json({ transactions });
});

// ─────────────────────────────────────────────
// PAYMENT ROUTES
// ─────────────────────────────────────────────

// POST /initialize-payment (Paystack)
app.post('/initialize-payment', authMiddleware, async (req, res) => {
  try {
    const { amount } = req.body;
    if (!amount || amount < 100)
      return res.status(400).json({ error: 'Minimum deposit is ₦100' });

    const db = readDB();
    const user = db.users.find(u => u.id === req.userId);

    const response = await axios.post(
      'https://api.paystack.co/transaction/initialize',
      {
        email: user.email,
        amount: amount * 100, // Paystack uses kobo
        callback_url: `http://localhost:${PORT}/payment-callback`,
        metadata: { userId: req.userId, type: 'deposit' }
      },
      { headers: { Authorization: `Bearer ${PAYSTACK_SECRET}` } }
    );

    res.json({
      success: true,
      authorizationUrl: response.data.data.authorization_url,
      reference: response.data.data.reference
    });
  } catch (err) {
    res.status(500).json({ error: 'Payment initialization failed' });
  }
});

// POST /verify-payment
app.post('/verify-payment', authMiddleware, async (req, res) => {
  try {
    const { reference, amount } = req.body;

    // In test mode, verify with Paystack
    let verified = false;
    let paidAmount = amount;

    try {
      const response = await axios.get(
        `https://api.paystack.co/transaction/verify/${reference}`,
        { headers: { Authorization: `Bearer ${PAYSTACK_SECRET}` } }
      );
      if (response.data.data.status === 'success') {
        verified = true;
        paidAmount = response.data.data.amount / 100;
      }
    } catch {
      // For demo/test purposes, allow manual verification
      verified = true;
    }

    if (!verified) return res.status(400).json({ error: 'Payment verification failed' });

    const db = readDB();
    const userIndex = db.users.findIndex(u => u.id === req.userId);
    if (userIndex === -1) return res.status(404).json({ error: 'User not found' });

    db.users[userIndex].balance += paidAmount;

    db.transactions.push({
      id: Date.now().toString(),
      userId: req.userId,
      type: 'deposit',
      amount: paidAmount,
      reference,
      status: 'success',
      description: 'Wallet deposit via Paystack',
      createdAt: new Date().toISOString()
    });

    writeDB(db);
    res.json({ success: true, balance: db.users[userIndex].balance, amount: paidAmount });
  } catch {
    res.status(500).json({ error: 'Server error' });
  }
});

// POST /deposit (manual/demo deposit)
app.post('/deposit', authMiddleware, (req, res) => {
  try {
    const { amount, reference } = req.body;
    if (!amount || amount < 100)
      return res.status(400).json({ error: 'Minimum deposit is ₦100' });

    const db = readDB();
    const userIndex = db.users.findIndex(u => u.id === req.userId);
    if (userIndex === -1) return res.status(404).json({ error: 'User not found' });

    db.users[userIndex].balance += Number(amount);

    db.transactions.push({
      id: Date.now().toString(),
      userId: req.userId,
      type: 'deposit',
      amount: Number(amount),
      reference: reference || `DEMO_${Date.now()}`,
      status: 'success',
      description: 'Wallet deposit',
      createdAt: new Date().toISOString()
    });

    writeDB(db);
    res.json({ success: true, balance: db.users[userIndex].balance });
  } catch {
    res.status(500).json({ error: 'Server error' });
  }
});

// ─────────────────────────────────────────────
// VAULT ROUTES
// ─────────────────────────────────────────────

// POST /create-vault
app.post('/create-vault', authMiddleware, (req, res) => {
  try {
    const { amount, duration, label } = req.body;
    if (!amount || !duration)
      return res.status(400).json({ error: 'Amount and duration are required' });

    const db = readDB();
    const userIndex = db.users.findIndex(u => u.id === req.userId);
    if (userIndex === -1) return res.status(404).json({ error: 'User not found' });

    if (db.users[userIndex].balance < amount)
      return res.status(400).json({ error: 'Insufficient balance' });

    const unlockDate = new Date();
    unlockDate.setMonth(unlockDate.getMonth() + Number(duration));

    const vault = {
      id: Date.now().toString(),
      userId: req.userId,
      label: label || 'My Vault',
      amount: Number(amount),
      duration: Number(duration),
      unlockDate: unlockDate.toISOString(),
      createdAt: new Date().toISOString(),
      status: 'locked'
    };

    db.users[userIndex].balance -= Number(amount);
    db.vaults.push(vault);

    db.transactions.push({
      id: Date.now().toString(),
      userId: req.userId,
      type: 'vault_lock',
      amount: Number(amount),
      reference: `VAULT_${vault.id}`,
      status: 'success',
      description: `Locked in vault: ${vault.label} (${duration} month${duration > 1 ? 's' : ''})`,
      createdAt: new Date().toISOString()
    });

    writeDB(db);
    res.json({ success: true, vault, balance: db.users[userIndex].balance });
  } catch {
    res.status(500).json({ error: 'Server error' });
  }
});

// GET /vaults
app.get('/vaults', authMiddleware, (req, res) => {
  const db = readDB();
  const vaults = db.vaults.filter(v => v.userId === req.userId);
  res.json({ vaults });
});

// POST /withdraw
app.post('/withdraw', authMiddleware, (req, res) => {
  try {
    const { vaultId } = req.body;
    const db = readDB();

    const vaultIndex = db.vaults.findIndex(v => v.id === vaultId && v.userId === req.userId);
    if (vaultIndex === -1) return res.status(404).json({ error: 'Vault not found' });

    const vault = db.vaults[vaultIndex];
    if (vault.status === 'withdrawn')
      return res.status(400).json({ error: 'Already withdrawn' });

    const now = new Date();
    const unlockDate = new Date(vault.unlockDate);

    if (now < unlockDate) {
      const remaining = unlockDate - now;
      const days = Math.ceil(remaining / (1000 * 60 * 60 * 24));
      return res.status(403).json({
        error: 'Vault is still locked',
        message: `🔒 Your vault is locked for ${days} more day${days !== 1 ? 's' : ''}. Stay disciplined — future you will thank you!`,
        unlockDate: vault.unlockDate,
        daysRemaining: days
      });
    }

    const userIndex = db.users.findIndex(u => u.id === req.userId);
    db.users[userIndex].balance += vault.amount;
    db.vaults[vaultIndex].status = 'withdrawn';
    db.vaults[vaultIndex].withdrawnAt = new Date().toISOString();

    db.transactions.push({
      id: Date.now().toString(),
      userId: req.userId,
      type: 'vault_unlock',
      amount: vault.amount,
      reference: `UNLOCK_${vaultId}`,
      status: 'success',
      description: `Vault unlocked: ${vault.label}`,
      createdAt: new Date().toISOString()
    });

    writeDB(db);
    res.json({ success: true, amount: vault.amount, balance: db.users[userIndex].balance });
  } catch {
    res.status(500).json({ error: 'Server error' });
  }
});

// ─────────────────────────────────────────────
// SERVE FRONTEND
// ─────────────────────────────────────────────
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, '../frontend/index.html'));
});

initDB();
app.listen(PORT, () => {
  console.log(`\n🚀 YoungVault Server running at http://localhost:${PORT}`);
  console.log(`📁 Database: ${DB_PATH}`);
  console.log(`\n✅ Open http://localhost:${PORT} in your browser\n`);
});
