require('dotenv').config();
const path = require('path');
const express = require('express');
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { User, Product, Order } = require('./models');

const app = express();
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// Connect to MongoDB once and reuse (works locally, on Render and on Vercel)
let dbPromise;
app.use('/api', async (req, res, next) => {
  try {
    dbPromise = dbPromise || mongoose.connect(process.env.MONGO_URI);
    await dbPromise;
    next();
  } catch (e) {
    console.error('DB ERROR:', e.message);
    dbPromise = null;
    res.status(500).json({ error: 'Database connection failed' });
  }
});

// ---------- Auth helpers ----------
const sign = (u) => jwt.sign({ id: u._id, role: u.role, name: u.name }, process.env.JWT_SECRET, { expiresIn: '7d' });

const auth = (req, res, next) => {
  const token = (req.headers.authorization || '').replace('Bearer ', '');
  try {
    req.user = jwt.verify(token, process.env.JWT_SECRET);
    next();
  } catch {
    res.status(401).json({ error: 'Please log in' });
  }
};
const adminOnly = (req, res, next) =>
  req.user.role === 'admin' ? next() : res.status(403).json({ error: 'Admins only' });

// Wrap async handlers so errors return JSON
const h = (fn) => (req, res) => fn(req, res).catch((e) => res.status(400).json({ error: e.message }));

// ---------- Auth routes ----------
app.post('/api/auth/register', h(async (req, res) => {
  const { name, email, password } = req.body;
  if (!name || !email || !password || password.length < 6)
    return res.status(400).json({ error: 'Name, email and a 6+ character password are required' });
  if (await User.findOne({ email: email.toLowerCase() }))
    return res.status(400).json({ error: 'Email already registered' });
  const user = await User.create({ name, email, password: await bcrypt.hash(password, 10), role: 'user' });
  res.json({ token: sign(user), user: { name: user.name, role: user.role } });
}));

app.post('/api/auth/login', h(async (req, res) => {
  const user = await User.findOne({ email: (req.body.email || '').toLowerCase() });
  if (!user || !(await bcrypt.compare(req.body.password || '', user.password)))
    return res.status(401).json({ error: 'Wrong email or password' });
  res.json({ token: sign(user), user: { name: user.name, role: user.role } });
}));

// ---------- Product routes ----------
app.get('/api/products', h(async (req, res) => res.json(await Product.find().sort('-createdAt'))));

app.post('/api/products', auth, adminOnly, h(async (req, res) => res.json(await Product.create(req.body))));

app.put('/api/products/:id', auth, adminOnly, h(async (req, res) =>
  res.json(await Product.findByIdAndUpdate(req.params.id, req.body, { new: true, runValidators: true }))));

app.delete('/api/products/:id', auth, adminOnly, h(async (req, res) => {
  await Product.findByIdAndDelete(req.params.id);
  res.json({ ok: true });
}));

// ---------- Order routes ----------
// Checkout: body = { items: [{ productId, qty }], address }
app.post('/api/orders', auth, h(async (req, res) => {
  const { items, address } = req.body;
  if (!Array.isArray(items) || !items.length || !address)
    return res.status(400).json({ error: 'Cart and delivery address are required' });

  const taken = [];
  const lines = [];
  try {
    for (const it of items) {
      const qty = parseInt(it.qty, 10);
      if (!(qty > 0)) throw new Error('Invalid quantity');
      // Atomic stock decrement: only succeeds if enough stock remains
      const p = await Product.findOneAndUpdate(
        { _id: it.productId, stock: { $gte: qty } }, { $inc: { stock: -qty } }, { new: true });
      if (!p) throw new Error('Not enough stock for one of the items');
      taken.push({ id: p._id, qty });
      lines.push({ product: p._id, name: p.name, price: p.price, qty });
    }
  } catch (e) {
    for (const t of taken) await Product.findByIdAndUpdate(t.id, { $inc: { stock: t.qty } }); // roll back
    return res.status(400).json({ error: e.message });
  }
  const total = lines.reduce((s, l) => s + l.price * l.qty, 0);
  res.json(await Order.create({ user: req.user.id, items: lines, total, address }));
}));

app.get('/api/orders/mine', auth, h(async (req, res) =>
  res.json(await Order.find({ user: req.user.id }).sort('-createdAt'))));

app.get('/api/orders', auth, adminOnly, h(async (req, res) =>
  res.json(await Order.find().populate('user', 'name email').sort('-createdAt'))));

app.put('/api/orders/:id/status', auth, adminOnly, h(async (req, res) =>
  res.json(await Order.findByIdAndUpdate(req.params.id, { status: req.body.status }, { new: true, runValidators: true }))));

// ---------- Start ----------
module.exports = app; // used by Vercel
if (require.main === module) {
  const port = process.env.PORT || 3000;
  app.listen(port, () => console.log(`Running on http://localhost:${port}`));
}
