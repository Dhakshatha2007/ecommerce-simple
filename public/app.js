const $ = (s) => document.querySelector(s);
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[c]));
const money = (n) => '₹' + Number(n).toLocaleString('en-IN');
const colors = ['#0e6b66', '#7a4e9c', '#b5651d', '#2f5d9e', '#a23b5b'];

const state = {
  token: localStorage.getItem('token'),
  user: JSON.parse(localStorage.getItem('user') || 'null'),
  cart: JSON.parse(localStorage.getItem('cart') || '[]'), // [{id,name,price,qty,stock}]
  products: []
};

const save = () => {
  state.token ? localStorage.setItem('token', state.token) : localStorage.removeItem('token');
  state.user ? localStorage.setItem('user', JSON.stringify(state.user)) : localStorage.removeItem('user');
  localStorage.setItem('cart', JSON.stringify(state.cart));
};

function toast(msg) {
  const t = $('#toast'); t.textContent = msg; t.classList.add('show');
  setTimeout(() => t.classList.remove('show'), 2200);
}

async function api(path, method = 'GET', body) {
  const res = await fetch('/api' + path, {
    method,
    headers: { 'Content-Type': 'application/json', ...(state.token ? { Authorization: 'Bearer ' + state.token } : {}) },
    body: body ? JSON.stringify(body) : undefined
  });
  const data = await res.json().catch(() => ({}));
  if (res.status === 401 && state.token) logout(true);
  if (!res.ok) throw new Error(data.error || 'Something went wrong');
  return data;
}

function nav() {
  const count = state.cart.reduce((s, i) => s + i.qty, 0);
  $('#nav').innerHTML = `
    <button data-go="shop">Shop</button>
    <button data-go="cart">Cart (${count})</button>
    ${state.user ? `
      <button data-go="orders">My orders</button>
      ${state.user.role === 'admin' ? '<button data-go="admin">Admin</button>' : ''}
      <button id="out">Log out (${esc(state.user.name)})</button>` : '<button class="primary" data-go="login">Log in</button>'}`;
  $('#nav').querySelectorAll('[data-go]').forEach((b) => (b.onclick = () => go(b.dataset.go)));
  if ($('#out')) $('#out').onclick = () => logout();
}

function logout(expired) {
  state.token = null; state.user = null; save();
  go(expired ? 'login' : 'shop');
  if (expired) toast('Session expired. Please log in again.');
}

function go(page) { nav(); ({ shop, cart, login, orders, admin }[page] || shop)(); }

// ---------- Shop ----------
async function shop() {
  $('#view').innerHTML = '<h2>Products</h2><div class="grid" id="grid">Loading…</div>';
  try { state.products = await api('/products'); } catch (e) { return ($('#grid').textContent = e.message); }
  $('#grid').innerHTML = state.products.map((p, i) => `
    <div class="card">
      <div class="thumb" style="background-color:${colors[i % colors.length]};${p.image ? `background-image:url('${esc(p.image)}')` : ''}">${p.image ? '' : esc(p.name[0])}</div>
      <strong>${esc(p.name)}</strong>
      <div class="muted">${esc(p.description)}</div>
      <div class="row" style="border:none;padding-bottom:0">
        <span class="price">${money(p.price)}</span>
        ${p.stock > 0 ? `<button class="primary" data-add="${p._id}">Add to cart</button>` : '<span class="muted">Out of stock</span>'}
      </div>
    </div>`).join('') || '<p class="muted">No products yet.</p>';
  document.querySelectorAll('[data-add]').forEach((b) => (b.onclick = () => addToCart(b.dataset.add)));
}

function addToCart(id) {
  const p = state.products.find((x) => x._id === id);
  const item = state.cart.find((c) => c.id === id);
  if (item) { if (item.qty < p.stock) item.qty++; else return toast('No more stock available'); }
  else state.cart.push({ id, name: p.name, price: p.price, qty: 1, stock: p.stock });
  save(); nav(); toast(p.name + ' added to cart');
}

// ---------- Cart & checkout ----------
function cart() {
  if (!state.cart.length) return ($('#view').innerHTML = '<h2>Your cart</h2><p class="muted">Your cart is empty. Pick something from the shop.</p>');
  const total = state.cart.reduce((s, i) => s + i.price * i.qty, 0);
  $('#view').innerHTML = `<h2>Your cart</h2>
    <div class="card">${state.cart.map((i, n) => `
      <div class="row">
        <span>${esc(i.name)} <span class="muted">${money(i.price)} each</span></span>
        <span>
          <button data-dec="${n}">−</button> ${i.qty} <button data-inc="${n}">+</button>
          <button class="link" data-rm="${n}">Remove</button>
        </span>
      </div>`).join('')}
      <div class="row"><strong>Total</strong><strong>${money(total)}</strong></div>
    </div>
    <div class="card form" style="margin-top:16px">
      <label for="addr">Delivery address</label>
      <textarea id="addr" rows="3"></textarea>
      <p><button class="primary" id="buy">Place order</button></p>
    </div>`;
  const change = (sel, fn) => document.querySelectorAll(sel).forEach((b) => (b.onclick = () => { fn(+b.dataset[sel.slice(6, -1)]); save(); nav(); cart(); }));
  change('[data-dec]', (n) => { state.cart[n].qty > 1 ? state.cart[n].qty-- : state.cart.splice(n, 1); });
  change('[data-inc]', (n) => { if (state.cart[n].qty < state.cart[n].stock) state.cart[n].qty++; });
  change('[data-rm]', (n) => state.cart.splice(n, 1));
  $('#buy').onclick = async () => {
    if (!state.user) { toast('Log in to place your order'); return go('login'); }
    try {
      await api('/orders', 'POST', { items: state.cart.map((i) => ({ productId: i.id, qty: i.qty })), address: $('#addr').value.trim() });
      state.cart = []; save(); toast('Order placed'); go('orders');
    } catch (e) { toast(e.message); }
  };
}

// ---------- Login / register ----------
function login() {
  $('#view').innerHTML = `<div class="card form">
    <h2 id="ttl">Log in</h2>
    <div id="nameBox" hidden><label for="name">Name</label><input id="name"></div>
    <label for="email">Email</label><input id="email" type="email">
    <label for="pw">Password</label><input id="pw" type="password">
    <p><button class="primary" id="go">Log in</button> <button id="swap">Create an account</button></p>
    <p class="muted">Demo admin: admin@shop.com / admin123</p></div>`;
  let reg = false;
  $('#swap').onclick = () => {
    reg = !reg;
    $('#nameBox').hidden = !reg;
    $('#ttl').textContent = $('#go').textContent = reg ? 'Create account' : 'Log in';
    $('#swap').textContent = reg ? 'I already have an account' : 'Create an account';
  };
  $('#go').onclick = async () => {
    try {
      const d = await api(reg ? '/auth/register' : '/auth/login', 'POST',
        { name: $('#name').value, email: $('#email').value, password: $('#pw').value });
      state.token = d.token; state.user = d.user; save(); go('shop');
    } catch (e) { toast(e.message); }
  };
}

// ---------- My orders ----------
async function orders() {
  if (!state.user) return go('login');
  $('#view').innerHTML = '<h2>My orders</h2><div id="list">Loading…</div>';
  try {
    const list = await api('/orders/mine');
    $('#list').innerHTML = list.map(orderCard).join('') || '<p class="muted">No orders yet.</p>';
  } catch (e) { $('#list').textContent = e.message; }
}

const orderCard = (o) => `<div class="card" style="margin-bottom:12px">
  <div class="row" style="padding-top:0"><span>${o.user?.name ? esc(o.user.name) + ' · ' : ''}${new Date(o.createdAt).toLocaleDateString()}</span><span class="tag">${o.status}</span></div>
  ${o.items.map((i) => `<div class="muted">${esc(i.name)} × ${i.qty}</div>`).join('')}
  <div class="row" style="border:none;padding-bottom:0"><span class="muted">${esc(o.address)}</span><strong>${money(o.total)}</strong></div>
</div>`;

// ---------- Admin ----------
function admin() {
  if (state.user?.role !== 'admin') return go('shop');
  $('#view').innerHTML = `<h2>Admin</h2>
    <div class="tabs"><button id="t1" class="on">Products</button><button id="t2">Orders</button></div><div id="panel"></div>`;
  $('#t1').onclick = () => { $('#t1').className = 'on'; $('#t2').className = ''; adminProducts(); };
  $('#t2').onclick = () => { $('#t2').className = 'on'; $('#t1').className = ''; adminOrders(); };
  adminProducts();
}

async function adminProducts() {
  state.products = await api('/products');
  $('#panel').innerHTML = `
    <div class="card form" style="max-width:none">
      <strong id="ftitle">Add a product</strong>
      <div class="cols">
        <div><label for="pn">Name</label><input id="pn"></div>
        <div><label for="pi">Image URL (optional)</label><input id="pi"></div>
        <div><label for="pp">Price (₹)</label><input id="pp" type="number" min="0"></div>
        <div><label for="ps">Stock</label><input id="ps" type="number" min="0"></div>
      </div>
      <label for="pd">Description</label><input id="pd">
      <p><button class="primary" id="psave">Save product</button> <button id="pcancel" hidden>Cancel edit</button></p>
    </div>
    <div class="card" style="margin-top:16px">${state.products.map((p) => `
      <div class="row"><span>${esc(p.name)} <span class="muted">${money(p.price)} · ${p.stock} in stock</span></span>
      <span><button data-edit="${p._id}">Edit</button><button class="link" data-del="${p._id}">Delete</button></span></div>`).join('')}</div>`;
  let editing = null;
  const reset = () => { editing = null; ['pn','pi','pp','ps','pd'].forEach((i) => ($('#' + i).value = '')); $('#ftitle').textContent = 'Add a product'; $('#pcancel').hidden = true; };
  $('#pcancel').onclick = reset;
  $('#psave').onclick = async () => {
    const body = { name: $('#pn').value, image: $('#pi').value, price: +$('#pp').value, stock: +$('#ps').value, description: $('#pd').value };
    try { await api(editing ? '/products/' + editing : '/products', editing ? 'PUT' : 'POST', body); toast('Product saved'); adminProducts(); }
    catch (e) { toast(e.message); }
  };
  document.querySelectorAll('[data-edit]').forEach((b) => (b.onclick = () => {
    const p = state.products.find((x) => x._id === b.dataset.edit); editing = p._id;
    $('#pn').value = p.name; $('#pi').value = p.image || ''; $('#pp').value = p.price; $('#ps').value = p.stock; $('#pd').value = p.description || '';
    $('#ftitle').textContent = 'Edit ' + p.name; $('#pcancel').hidden = false; scrollTo(0, 0);
  }));
  document.querySelectorAll('[data-del]').forEach((b) => (b.onclick = async () => {
    if (!confirm('Delete this product?')) return;
    await api('/products/' + b.dataset.del, 'DELETE'); toast('Product deleted'); adminProducts();
  }));
}

async function adminOrders() {
  const list = await api('/orders');
  $('#panel').innerHTML = list.map((o) => `<div style="margin-bottom:12px">
    ${orderCard(o)}
    <label for="s${o._id}">Status</label>
    <select id="s${o._id}" data-status="${o._id}">${['Pending','Shipped','Delivered','Cancelled'].map((s) => `<option ${s === o.status ? 'selected' : ''}>${s}</option>`).join('')}</select>
  </div>`).join('') || '<p class="muted">No orders yet.</p>';
  document.querySelectorAll('[data-status]').forEach((s) => (s.onchange = async () => {
    await api(`/orders/${s.dataset.status}/status`, 'PUT', { status: s.value }); toast('Status updated');
  }));
}

$('#logo').onclick = () => go('shop');
go('shop');
