const database = require('./database');

async function main() {
  const connection = await database.pool.getConnection();
  try {
    await connection.query(`
      CREATE TABLE IF NOT EXISTS customers (
        customer_id INT AUTO_INCREMENT PRIMARY KEY,
        first_name VARCHAR(100) NOT NULL,
        last_name VARCHAR(100) NOT NULL,
        phone VARCHAR(20),
        lat DOUBLE NOT NULL,
        lng DOUBLE NOT NULL,
        address_note VARCHAR(255),
        INDEX idx_customers_latlng (lat, lng)
      ) CHARACTER SET utf8mb4
    `);

    await connection.query(`
      CREATE TABLE IF NOT EXISTS orders (
        order_id INT AUTO_INCREMENT PRIMARY KEY,
        customer_id INT NOT NULL,
        order_date DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        box_count INT NOT NULL,
        deadline TIME NOT NULL DEFAULT '12:30:00',
        status VARCHAR(20) NOT NULL DEFAULT 'pending',
        CONSTRAINT chk_box CHECK (box_count BETWEEN 1 AND 3),
        CONSTRAINT fk_orders_customer FOREIGN KEY (customer_id)
          REFERENCES customers(customer_id) ON DELETE CASCADE
      ) CHARACTER SET utf8mb4
    `);

    await connection.query(`
      CREATE TABLE IF NOT EXISTS riders (
        rider_id INT AUTO_INCREMENT PRIMARY KEY,
        name VARCHAR(100) NOT NULL,
        phone VARCHAR(20),
        username VARCHAR(50) NOT NULL UNIQUE,
        password_hash VARCHAR(255) NOT NULL,
        capacity INT NOT NULL DEFAULT 3,
        is_active BOOLEAN NOT NULL DEFAULT TRUE
      ) CHARACTER SET utf8mb4
    `);

    await connection.query(`
      CREATE TABLE IF NOT EXISTS route_plans (
        plan_id INT AUTO_INCREMENT PRIMARY KEY,
        plan_date DATE NOT NULL,
        depart_time TIME NOT NULL DEFAULT '11:30:00',
        created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
      ) CHARACTER SET utf8mb4
    `);

    await connection.query(`
      CREATE TABLE IF NOT EXISTS routes (
        route_id INT AUTO_INCREMENT PRIMARY KEY,
        plan_id INT NOT NULL,
        rider_id INT NOT NULL,
        color VARCHAR(20),
        map_link VARCHAR(500),
        CONSTRAINT fk_routes_plan FOREIGN KEY (plan_id)
          REFERENCES route_plans(plan_id) ON DELETE CASCADE,
        CONSTRAINT fk_routes_rider FOREIGN KEY (rider_id)
          REFERENCES riders(rider_id)
      ) CHARACTER SET utf8mb4
    `);

    await connection.query(`
      CREATE TABLE IF NOT EXISTS route_stops (
        stop_id INT AUTO_INCREMENT PRIMARY KEY,
        route_id INT NOT NULL,
        order_id INT NULL UNIQUE,
        stop_seq INT NOT NULL,
        eta TIME,
        delivered_at DATETIME,
        CONSTRAINT fk_stops_route FOREIGN KEY (route_id)
          REFERENCES routes(route_id) ON DELETE CASCADE,
        CONSTRAINT fk_stops_order FOREIGN KEY (order_id)
          REFERENCES orders(order_id) ON DELETE SET NULL
      ) CHARACTER SET utf8mb4
    `);

    const [tables] = await connection.query('SHOW TABLES');
    console.log('ตรวจสอบ/สร้างตารางสำเร็จ:', tables);
  } finally {
    connection.release();
    await database.pool.end();
  }
}

main().catch((err) => {
  console.error('ตั้งค่าฐานข้อมูลไม่สำเร็จ:', err.message);
  process.exitCode = 1;
});
