const mongoose = require('mongoose');
const { Schema, model, models } = mongoose;

const User = models.User || model('User', new Schema({
  name: { type: String, required: true },
  email: { type: String, required: true, unique: true, lowercase: true },
  password: { type: String, required: true },
  role: { type: String, enum: ['user', 'admin'], default: 'user' }
}));

const Product = models.Product || model('Product', new Schema({
  name: { type: String, required: true },
  description: String,
  price: { type: Number, required: true, min: 0 },
  stock: { type: Number, default: 0, min: 0 },
  image: String
}, { timestamps: true }));

const Order = models.Order || model('Order', new Schema({
  user: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  items: [{ product: Schema.Types.ObjectId, name: String, price: Number, qty: Number }],
  total: Number,
  address: String,
  status: { type: String, enum: ['Pending', 'Shipped', 'Delivered', 'Cancelled'], default: 'Pending' }
}, { timestamps: true }));

module.exports = { User, Product, Order };
