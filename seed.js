// Creates an admin account and a few sample products:  npm run seed
require('dotenv').config();
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const { User, Product } = require('./models');

(async () => {
  await mongoose.connect(process.env.MONGO_URI);
  await User.deleteOne({ email: 'admin@shop.com' });
  await User.create({ name: 'Admin', email: 'admin@shop.com', password: await bcrypt.hash('admin123', 10), role: 'admin' });
  if (!(await Product.countDocuments())) {
    await Product.insertMany([
      { name: 'Canvas Backpack', description: 'Water-resistant, 20L, fits a 15" laptop.', price: 1499, stock: 25 },
      { name: 'Steel Water Bottle', description: 'Keeps drinks cold for 24 hours.', price: 599, stock: 60 },
      { name: 'Wireless Mouse', description: 'Quiet clicks, 12-month battery.', price: 799, stock: 40 },
      { name: 'Notebook Set (3)', description: 'A5 dotted, 120 pages each.', price: 349, stock: 100 },
      { name: 'Desk Lamp', description: 'Dimmable LED with USB charging port.', price: 1199, stock: 15 }
    ]);
  }
  console.log('Seeded. Admin login: admin@shop.com / admin123');
  process.exit(0);
})();
