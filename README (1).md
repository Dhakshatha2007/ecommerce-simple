# Corner Shop – E-Commerce Web App
Live link : https://your-site.onrender.com
Simple full-stack store: product catalog, cart, checkout, order tracking, JWT login with Admin/User roles.

**Stack:** Node.js, Express, MongoDB (Mongoose), vanilla HTML/CSS/JS frontend.

## Features
- Browse products, add to cart, checkout with delivery address
- Register / login (JWT, bcrypt-hashed passwords)
- **User:** place orders, view own orders and their status
- **Admin:** add/edit/delete products, view all orders, update order status
- Stock is reduced atomically at checkout; prices are always taken from the database

## API
| Method | Endpoint | Access |
|---|---|---|
| POST | /api/auth/register, /api/auth/login | public |
| GET | /api/products | public |
| POST / PUT / DELETE | /api/products, /api/products/:id | admin |
| POST | /api/orders | logged-in user |
| GET | /api/orders/mine | logged-in user |
| GET | /api/orders | admin |
| PUT | /api/orders/:id/status | admin |

## Run locally (VS Code)
1. Install Node.js 18+. Get a free MongoDB Atlas connection string (or run MongoDB locally).
2. `npm install`
3. Copy `.env.example` to `.env` and fill in `MONGO_URI` and `JWT_SECRET`
4. `npm run seed` (creates admin + sample products)
5. `npm run dev` and open http://localhost:3000

Admin login: `admin@shop.com` / `admin123`

## Deploy on Render
1. Push to GitHub. On Render: New → Web Service → pick the repo.
2. Build command: `npm install` — Start command: `npm start`
3. Add environment variables `MONGO_URI` and `JWT_SECRET`.
4. In Atlas → Network Access, allow `0.0.0.0/0`.

## Deploy on Vercel
1. Import the repo on vercel.com (`vercel.json` is included).
2. Add `MONGO_URI` and `JWT_SECRET` environment variables, then deploy.
3. Allow `0.0.0.0/0` in Atlas Network Access.

## Folder structure
```
server.js   – Express app, auth, product and order APIs
models.js   – User, Product, Order schemas
seed.js     – admin account + sample data
public/     – frontend (index.html, app.js, style.css)
```
