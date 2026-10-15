const express = require('express');
const cors = require('cors');
const database = require('./database');

const app = express();
app.use(cors());
app.use(express.json());

// ---------- Helper: Haversine (กม.) ----------
function distanceKm(lat1, lng1, lat2, lng2) {
  const R = 6371;
  const toRad = (d) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) *
    Math.sin(dLng / 2) * Math.sin(dLng / 2);
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

app.get('/', (req, res) => {
  res.json({ message: 'API is running', database: 'mysql' });
});

// =====================================================
// ข้อ 1: CUSTOMERS
// =====================================================

// 1.2 ค้นหาจากชื่อ/นามสกุล
app.get('/customers/search', async (req, res) => {
  try {
    const q = (req.query.q || '').trim();
    if (q === '') return res.status(400).json({ error: 'ต้องส่ง q มาด้วย' });
    const like = '%' + q + '%';
    const [rows] = await database.query(
      'SELECT * FROM customers WHERE first_name LIKE ? OR last_name LIKE ?',
      [like, like]
    );
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 1.3 ลูกค้าในระยะ 1 กม.
app.get('/customers/nearby', async (req, res) => {
  try {
    const lat = parseFloat(req.query.lat);
    const lng = parseFloat(req.query.lng);
    const radius = req.query.radius ? parseFloat(req.query.radius) : 1;
    if (isNaN(lat) || isNaN(lng)) {
      return res.status(400).json({ error: 'lat และ lng ต้องเป็นตัวเลข' });
    }
    const dLat = radius / 111;
    const dLng = radius / (111 * Math.cos((lat * Math.PI) / 180));
    const [candidates] = await database.query(
      'SELECT * FROM customers WHERE lat BETWEEN ? AND ? AND lng BETWEEN ? AND ?',
      [lat - dLat, lat + dLat, lng - dLng, lng + dLng]
    );
    const result = [];
    for (let i = 0; i < candidates.length; i++) {
      const c = candidates[i];
      const d = distanceKm(lat, lng, c.lat, c.lng);
      if (d <= radius) {
        c.distance_km = Math.round(d * 1000) / 1000;
        result.push(c);
      }
    }
    result.sort((a, b) => a.distance_km - b.distance_km);
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 1.1 แสดงทุกคน
app.get('/customers', async (req, res) => {
  try {
    const [rows] = await database.query('SELECT * FROM customers');
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/customers/:id', async (req, res) => {
  try {
    const [rows] = await database.query('SELECT * FROM customers WHERE customer_id = ?', [req.params.id]);
    if (rows.length === 0) return res.status(404).json({ error: 'ไม่พบลูกค้า' });
    res.json(rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 1.1 เพิ่ม
app.post('/customers', async (req, res) => {
  try {
    const { first_name, last_name, phone, lat, lng, address_note } = req.body;
    if (!first_name || !last_name || typeof lat !== 'number' || typeof lng !== 'number') {
      return res.status(400).json({ error: 'ต้องมี first_name, last_name, lat, lng (lat/lng เป็นตัวเลข)' });
    }
    const [result] = await database.query(
      'INSERT INTO customers (first_name, last_name, phone, lat, lng, address_note) VALUES (?, ?, ?, ?, ?, ?)',
      [first_name, last_name, phone || null, lat, lng, address_note || null]
    );
    const [rows] = await database.query('SELECT * FROM customers WHERE customer_id = ?', [result.insertId]);
    res.status(201).json(rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 1.1 แก้ไข
app.put('/customers/:id', async (req, res) => {
  try {
    const [oldRows] = await database.query('SELECT * FROM customers WHERE customer_id = ?', [req.params.id]);
    if (oldRows.length === 0) return res.status(404).json({ error: 'ไม่พบลูกค้า' });
    const old = oldRows[0];
    const b = req.body;
    const first_name   = b.first_name   !== undefined ? b.first_name   : old.first_name;
    const last_name    = b.last_name    !== undefined ? b.last_name    : old.last_name;
    const phone        = b.phone        !== undefined ? b.phone        : old.phone;
    const lat          = b.lat          !== undefined ? b.lat          : old.lat;
    const lng          = b.lng          !== undefined ? b.lng          : old.lng;
    const address_note = b.address_note !== undefined ? b.address_note : old.address_note;
    await database.query(
      'UPDATE customers SET first_name=?, last_name=?, phone=?, lat=?, lng=?, address_note=? WHERE customer_id=?',
      [first_name, last_name, phone, lat, lng, address_note, req.params.id]
    );
    const [rows] = await database.query('SELECT * FROM customers WHERE customer_id = ?', [req.params.id]);
    res.json(rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 1.1 ลบ
app.delete('/customers/:id', async (req, res) => {
  try {
    const [result] = await database.query('DELETE FROM customers WHERE customer_id = ?', [req.params.id]);
    if (result.affectedRows === 0) return res.status(404).json({ error: 'ไม่พบลูกค้า' });
    res.json({ message: 'ลบแล้ว' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// =====================================================
// ข้อ 2: ORDERS
// =====================================================

const ORDER_SELECT =
  'SELECT o.order_id, o.customer_id, o.order_date, o.box_count, o.deadline, o.status, ' +
  'c.first_name, c.last_name, c.phone, c.lat, c.lng, c.address_note ' +
  'FROM orders o JOIN customers c ON o.customer_id = c.customer_id';

// 2.1 จำลองออร์เดอร์ 20-30 รายการ (สุ่มลูกค้าที่มีอยู่)
app.post('/orders/simulate', async (req, res) => {
  try {
    const [customers] = await database.query('SELECT customer_id FROM customers');
    if (customers.length === 0) {
      return res.status(400).json({ error: 'ยังไม่มีลูกค้าในระบบ เพิ่มลูกค้าก่อน' });
    }
    // จำนวนออร์เดอร์ 20-30 (หรือกำหนดเองด้วย body.count ได้ 20-30)
    let count = 20 + Math.floor(Math.random() * 11);
    if (req.body && req.body.count >= 20 && req.body.count <= 30) {
      count = req.body.count;
    }
    const created = [];
    for (let i = 0; i < count; i++) {
      const c = customers[Math.floor(Math.random() * customers.length)];
      const boxes = 1 + Math.floor(Math.random() * 3); // 1-3 กล่อง
      const [result] = await database.query(
        'INSERT INTO orders (customer_id, box_count) VALUES (?, ?)',
        [c.customer_id, boxes]
      );
      created.push(result.insertId);
    }
    const [rows] = await database.query(
      ORDER_SELECT + ' WHERE o.order_id IN (?) ORDER BY o.order_id',
      [created]
    );
    res.status(201).json({ count: rows.length, orders: rows });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 2.2 ล้างออร์เดอร์ทั้งหมด
app.delete('/orders', async (req, res) => {
  try {
    const [result] = await database.query('DELETE FROM orders');
    res.json({ message: 'ล้างรายการสั่งซื้อทั้งหมดแล้ว', deleted: result.affectedRows });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 2.3 ออร์เดอร์ในระยะ 2 กม. (ต้องอยู่ก่อน /orders/:id)
app.get('/orders/nearby', async (req, res) => {
  try {
    const lat = parseFloat(req.query.lat);
    const lng = parseFloat(req.query.lng);
    const radius = req.query.radius ? parseFloat(req.query.radius) : 2;
    if (isNaN(lat) || isNaN(lng)) {
      return res.status(400).json({ error: 'lat และ lng ต้องเป็นตัวเลข' });
    }
    const dLat = radius / 111;
    const dLng = radius / (111 * Math.cos((lat * Math.PI) / 180));
    const [candidates] = await database.query(
      ORDER_SELECT + ' WHERE c.lat BETWEEN ? AND ? AND c.lng BETWEEN ? AND ?',
      [lat - dLat, lat + dLat, lng - dLng, lng + dLng]
    );
    const result = [];
    for (let i = 0; i < candidates.length; i++) {
      const o = candidates[i];
      const d = distanceKm(lat, lng, o.lat, o.lng);
      if (d <= radius) {
        o.distance_km = Math.round(d * 1000) / 1000;
        result.push(o);
      }
    }
    result.sort((a, b) => a.distance_km - b.distance_km);
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 2.1 แสดงออร์เดอร์ทั้งหมด (พร้อมข้อมูลลูกค้า)
app.get('/orders', async (req, res) => {
  try {
    const [rows] = await database.query(ORDER_SELECT + ' ORDER BY o.order_id');
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/orders/:id', async (req, res) => {
  try {
    const [rows] = await database.query(ORDER_SELECT + ' WHERE o.order_id = ?', [req.params.id]);
    if (rows.length === 0) return res.status(404).json({ error: 'ไม่พบออร์เดอร์' });
    res.json(rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 2.1.3 เพิ่มออร์เดอร์
app.post('/orders', async (req, res) => {
  try {
    const { customer_id, box_count } = req.body;
    if (!customer_id || !Number.isInteger(box_count) || box_count < 1 || box_count > 3) {
      return res.status(400).json({ error: 'ต้องมี customer_id และ box_count (จำนวนเต็ม 1-3)' });
    }
    const [cust] = await database.query('SELECT customer_id FROM customers WHERE customer_id = ?', [customer_id]);
    if (cust.length === 0) return res.status(404).json({ error: 'ไม่พบลูกค้า' });
    const [result] = await database.query(
      'INSERT INTO orders (customer_id, box_count) VALUES (?, ?)',
      [customer_id, box_count]
    );
    const [rows] = await database.query(ORDER_SELECT + ' WHERE o.order_id = ?', [result.insertId]);
    res.status(201).json(rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 2.1.3 แก้ไขจำนวนกล่อง
app.put('/orders/:id', async (req, res) => {
  try {
    const { box_count } = req.body;
    if (!Number.isInteger(box_count) || box_count < 1 || box_count > 3) {
      return res.status(400).json({ error: 'box_count ต้องเป็นจำนวนเต็ม 1-3' });
    }
    const [result] = await database.query(
      'UPDATE orders SET box_count = ? WHERE order_id = ?',
      [box_count, req.params.id]
    );
    if (result.affectedRows === 0) return res.status(404).json({ error: 'ไม่พบออร์เดอร์' });
    const [rows] = await database.query(ORDER_SELECT + ' WHERE o.order_id = ?', [req.params.id]);
    res.json(rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 2.1.3 ลบออร์เดอร์
app.delete('/orders/:id', async (req, res) => {
  try {
    const [result] = await database.query('DELETE FROM orders WHERE order_id = ?', [req.params.id]);
    if (result.affectedRows === 0) return res.status(404).json({ error: 'ไม่พบออร์เดอร์' });
    res.json({ message: 'ลบแล้ว' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ---------- รันในเครื่อง: node server.js | บน Vercel: export app ----------
if (require.main === module) {
  const PORT = process.env.PORT || 3000;
  database
    .verifyConnection()
    .then(() => {
      app.listen(PORT, () => console.log('API connected to MySQL on port ' + PORT));
    })
    .catch((err) => {
      console.error('เชื่อมต่อ MySQL ไม่สำเร็จ:', err.message);
      process.exitCode = 1;
    });
}

module.exports = app;