# ส่งดี — Delivery Manager

ระบบจัดการลูกค้าและออร์เดอร์จัดส่ง ใช้ Angular สำหรับหน้าเว็บ, Express สำหรับ API และ MySQL สำหรับฐานข้อมูล

## ตั้งค่าฐานข้อมูล

1. ติดตั้ง Backend dependencies ที่โฟลเดอร์หลัก:

   ```powershell
   npm ci
   ```

2. คัดลอกไฟล์ตัวอย่าง:

   ```powershell
   Copy-Item .env.example .env
   ```

3. แก้ค่าการเชื่อมต่อใน `.env` ให้ตรงกับฐานข้อมูล MySQL ที่มีอยู่:

   ```dotenv
   DB_HOST=localhost
   DB_PORT=3306
   DB_USER=ชื่อผู้ใช้ฐานข้อมูล
   DB_PASSWORD=รหัสผ่านฐานข้อมูล
   DB_NAME=ชื่อฐานข้อมูล
   DB_SSL=true
   PORT=3000
   ```

   `DB_PASSWORD` เว้นว่างได้หากบัญชีฐานข้อมูลไม่ได้ตั้งรหัสผ่าน ค่าตั้งต้น `DB_SSL=true` ตรงกับการตั้งค่า SSL ในไฟล์เชื่อมต่อที่ส่งมา หาก MySQL ในเครื่องไม่รองรับ SSL ให้ตั้ง `DB_SSL=false`

4. ถ้าฐานข้อมูลยังไม่มีตารางของระบบ ให้สร้างโดยรัน `npm run setup` ที่โฟลเดอร์หลัก คำสั่งนี้ใช้ `CREATE TABLE IF NOT EXISTS` และไม่ลบข้อมูลเดิม หากตารางมีอยู่แล้ว ให้ข้ามขั้นตอนนี้
5. เริ่ม API:

   ```powershell
   npm start
   ```

   API จะทดสอบการเชื่อมต่อ MySQL ก่อนเปิดพอร์ต และจะแจ้งข้อผิดพลาดหากค่าการเชื่อมต่อไม่ถูกต้อง

## เริ่มหน้า Angular

เปิด terminal อีกหน้าต่าง:

```powershell
Set-Location .\frontend
npm ci
npm start
```

เปิด <http://localhost:4200> หน้า Angular จะส่งคำขอ `/customers` และ `/orders` ผ่าน proxy ไปยัง API ที่ `http://localhost:3000`

หาก API อยู่คนละ host หรือ port ให้แก้ `frontend/proxy.conf.json` ให้ตรงกับ API

## Build

```powershell
Set-Location .\frontend
npm run build
```

เก็บไฟล์ `.env` ไว้ในเครื่องและอย่าส่งขึ้น Git; เมื่อนำ Backend ไป deploy ให้ตั้งค่า `DB_HOST`, `DB_PORT`, `DB_USER`, `DB_PASSWORD`, `DB_NAME` และ `DB_SSL` ใน Environment Variables ของผู้ให้บริการ
