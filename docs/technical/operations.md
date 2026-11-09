# คู่มือการติดตั้งและดูแลระบบ (Operations Guide)

สำหรับผู้ดูแลเซิร์ฟเวอร์และฝ่าย IT เอกสารนี้ครอบคลุมการติดตั้ง ตัวแปรสภาพแวดล้อม การสำรองข้อมูล การอัปเดต และการแก้ปัญหา

> สำหรับงานผู้ดูแลระบบในหน้าเว็บ (สร้างบัญชี นำเข้าตารางสอน ฯลฯ) ดู [คู่มือผู้ดูแลระบบ](../manual/admin.md)

---

## 1. รูปแบบการติดตั้ง

| รูปแบบ | ใช้เมื่อ | ฐานข้อมูล | ไฟล์อัปโหลด |
|---|---|---|---|
| **Docker Compose บนเซิร์ฟเวอร์ของสถาบัน** | ใช้งานจริง | PostgreSQL 16 ใน container (volume `db-data`) | ดิสก์ (volume `uploads`) ไฟล์ละไม่เกิน 50 MB |
| **Vercel + Neon** | demo / ทดลองใช้ | Neon Postgres (region สิงคโปร์) | เก็บในฐานข้อมูล ไม่เกิน 4 MB ต่อครั้ง |

> ⚠️ **ห้ามใส่ข้อมูลจริงของ นนอ. ในระบบ demo** ที่เปิด `DEMO_SEED=true` เพราะบัญชี demo ใช้รหัสผ่านเริ่มต้นเดียวกันและเป็นเว็บสาธารณะ

---

## 2. ติดตั้งบนเซิร์ฟเวอร์ของสถาบัน (Docker Compose)

### 2.1 ความต้องการขั้นต่ำ

- Linux ที่ติดตั้ง Docker และ Docker Compose plugin
- 2 vCPU, 4 GB RAM สำหรับผู้ใช้หลักร้อยคน
- ดิสก์: ระบบประมาณ 2 GB + ไฟล์อัปโหลด (ประมาณการ: เอกสารและงานส่ง 1–3 GB ต่อภาคเรียนต่อ 100 คน ขึ้นกับชนิดไฟล์)
- ชื่อโดเมนภายในและใบรับรอง TLS (เช่น `classroom.nkrafa.ac.th`)

### 2.2 ขั้นตอน

```bash
git clone <repo-url> veha && cd veha
cp .env.example .env
```

แก้ `.env` อย่างน้อย:

| ตัวแปร | ค่า |
|---|---|
| `POSTGRES_PASSWORD` | รหัสผ่านฐานข้อมูลที่สุ่มขึ้นมา (เช่น `openssl rand -base64 24`) |
| `APP_URL` | URL จริงของระบบ เช่น `https://classroom.nkrafa.ac.th` |
| `COOKIE_SECURE` | `"true"` (ใช้ `"false"` เฉพาะเมื่อให้บริการผ่าน http ในเครือข่ายภายในเท่านั้น) |
| `SEED_ADMIN_USERNAME` | username ของผู้ดูแลระบบคนแรก |

```bash
docker compose up -d --build
docker compose exec app npx tsx prisma/seed.ts
```

คำสั่ง seed จะ:
- สร้างบัญชีผู้ดูแลระบบคนแรก และ**แสดงรหัสผ่านชั่วคราวครั้งเดียว** (จดไว้ แล้วเปลี่ยนเมื่อเข้าครั้งแรก)
- สร้างกองวิชา/ภาควิชาของสถาบัน และรายวิชาในหลักสูตร CS/MA ที่ยังไม่มี
- รันซ้ำได้โดยไม่เขียนทับสิ่งที่ผู้ดูแลระบบแก้ไว้

Container `app` รัน `prisma migrate deploy` ทุกครั้งที่เริ่ม จึงไม่ต้องสั่ง migration เอง

### 2.3 Reverse proxy (HTTPS)

แอปฟังที่พอร์ต 3000 วาง nginx หรือ Caddy ไว้ด้านหน้า ตัวอย่าง Caddy:

```
classroom.nkrafa.ac.th {
    reverse_proxy localhost:3000
    request_body {
        max_size 60MB
    }
}
```

ถ้าใช้ nginx ให้ตั้ง `client_max_body_size 60m;` และส่ง header `X-Forwarded-For` / `X-Forwarded-Proto` (ระบบใช้ IP จาก header นี้ในบันทึกการใช้งานและการจำกัดห้องสอบ)

> ถ้าจะใช้ "จำกัดห้องสอบตาม IP" ต้องตรวจว่า IP ที่ระบบเห็นเป็น IP ของเครื่อง นนอ. จริง ไม่ใช่ IP ของ proxy หรือ NAT หน้าเว็บ **ตั้งค่าการสอบ** แสดง "IP ของคุณตอนนี้" ไว้ให้ตรวจ

---

## 3. ตัวแปรสภาพแวดล้อม

| ตัวแปร | ค่าเริ่มต้น | ความหมาย |
|---|---|---|
| `DATABASE_URL` | — | connection string ของ PostgreSQL (Docker Compose ตั้งให้เอง) ระบบรู้จักชื่ออื่นที่ integration ตั้งให้ด้วย (`lib/db-url.ts`) |
| `DATABASE_URL_UNPOOLED` | — | (Vercel/Neon) connection ตรงสำหรับรัน migration |
| `APP_URL` | `http://localhost:3000` | URL สาธารณะ ใช้สร้างลิงก์ในอีเมล |
| `COOKIE_SECURE` | `true` เมื่อ production | ส่ง cookie เฉพาะผ่าน HTTPS |
| `UPLOAD_DIR` | `./storage/uploads` (Docker: `/data/uploads`) | ที่เก็บไฟล์อัปโหลด |
| `STORAGE_DRIVER` | `disk` (Vercel: `db`) | `disk` หรือ `db` |
| `MAX_UPLOAD_MB` | `50` (Vercel: `4`) | ขนาดอัปโหลดสูงสุดต่อครั้ง (งานส่งยังจำกัดไฟล์ละ 20 MB, ไม่เกิน 5 ไฟล์) |
| `TEMP_PASSWORD_DAYS` | `14` | อายุรหัสผ่านชั่วคราว |
| `SMTP_HOST` `SMTP_PORT` `SMTP_USER` `SMTP_PASS` `SMTP_FROM` | ว่าง | ถ้าตั้ง `SMTP_HOST` ปุ่ม "ลืมรหัสผ่าน?" จะส่งลิงก์ทางอีเมล ถ้าว่าง หน้าลืมรหัสผ่านจะแจ้งให้ติดต่อผู้ดูแลระบบ (ค่าปัจจุบัน) |
| `SEB_ENABLED` | `false` | เปิดโหมด Safe Exam Browser และหน้าตั้งค่า SEB |
| `SEED_ADMIN_USERNAME` | `admin` | username ผู้ดูแลระบบคนแรกตอน seed |
| `POSTGRES_PASSWORD` | — | (Docker Compose) รหัสผ่านฐานข้อมูล |
| `DEMO_SEED` | — | (demo เท่านั้น) `true` = สร้างบัญชีและข้อมูลตัวอย่างทุกครั้งที่ build |
| `DEMO_PASSWORD` | — | (demo เท่านั้น) รหัสผ่านเริ่มต้นของบัญชีตัวอย่าง |

> ค่า `SMTP_PASS`, `POSTGRES_PASSWORD` และ `.env` ทั้งไฟล์เป็นความลับ ห้าม commit (`.env` อยู่ใน `.gitignore` แล้ว)

---

## 4. การสำรองและกู้คืนข้อมูล

ต้องสำรอง**ทั้งสองส่วน**: ฐานข้อมูล และไฟล์อัปโหลด

### 4.1 สำรองทุกวัน (ตัวอย่าง cron บนเครื่องเซิร์ฟเวอร์)

```bash
# /etc/cron.d/veha-backup — ทุกวัน 02:30
30 2 * * * root /opt/veha/backup.sh
```

```bash
#!/bin/sh
# /opt/veha/backup.sh
set -e
cd /opt/veha/veha
DAY=$(date +%F)
DEST=/backup/veha
mkdir -p "$DEST"
docker compose exec -T db pg_dump -U classroom -Fc classroom > "$DEST/db-$DAY.dump"
docker run --rm -v veha_uploads:/data -v "$DEST":/out alpine tar czf "/out/uploads-$DAY.tgz" -C /data .
find "$DEST" -type f -mtime +30 -delete      # เก็บ 30 วัน
```

> ชื่อ volume จริงขึ้นกับชื่อโฟลเดอร์โปรเจกต์ (`<โฟลเดอร์>_uploads`) ตรวจด้วย `docker volume ls`
> ควรคัดลอกไฟล์สำรองไปเก็บอีกเครื่องหรืออีกอาคารด้วย

### 4.2 กู้คืน

```bash
docker compose stop app
docker compose exec -T db pg_restore -U classroom -d classroom --clean --if-exists < /backup/veha/db-YYYY-MM-DD.dump
docker run --rm -v veha_uploads:/data -v /backup/veha:/in alpine sh -c "rm -rf /data/* && tar xzf /in/uploads-YYYY-MM-DD.tgz -C /data"
docker compose start app
```

ทดลองกู้คืนบนเครื่องทดสอบอย่างน้อยภาคเรียนละครั้ง เพื่อให้มั่นใจว่าไฟล์สำรองใช้ได้จริง

---

## 5. อัปเดตเวอร์ชัน

```bash
cd /opt/veha/veha
./backup.sh                       # สำรองก่อนทุกครั้ง
git pull
docker compose up -d --build      # migration รันอัตโนมัติตอน container เริ่ม
docker compose exec app npx tsx prisma/seed.ts   # (ถ้ามีกองวิชา/รายวิชาใหม่ในหลักสูตร)
docker compose logs -f app        # ตรวจว่าเริ่มได้ปกติ
```

- ควรอัปเดตช่วงที่ไม่มีการสอบ
- migration ออกแบบให้รันไปข้างหน้าอย่างเดียว ถ้าต้องย้อนเวอร์ชันหลัง migration ให้กู้คืนจากไฟล์สำรอง

---

## 6. Demo บน Vercel

1. [vercel.com/new](https://vercel.com/new) → Import repo
2. Environment Variables: `DEMO_SEED=true`, `DEMO_PASSWORD=<รหัสตัวอย่าง>`
3. Deploy ครั้งแรกจะไม่ผ่านเพราะยังไม่มีฐานข้อมูล (ปกติ)
4. Storage → Create Database → Neon (Singapore) → Connect กับโปรเจกต์ (ตั้ง `DATABASE_URL`, `DATABASE_URL_UNPOOLED` ให้)
5. Deployments → Redeploy

`npm run vercel-build` (`scripts/vercel-build.ts`) ทำงานตามลำดับ: หา connection string → `prisma migrate deploy` ผ่าน connection ตรง → (ถ้า `DEMO_SEED=true`) seed ข้อมูลตัวอย่าง (idempotent) → คัดลอก Pyodide → `next build` และ `vercel.json` ตั้ง region `sin1`

> ถ้าเริ่มใช้ระบบบน Vercel กับข้อมูลจริง ต้อง**ปิด `DEMO_SEED`** และลบบัญชี demo ก่อน

---

## 7. งานประจำภาคเรียน

### งานต้นภาคเรียน / ต้นปีการศึกษา

ระบบไม่มีช่อง "ชั้นปี" ในบัญชี นนอ. การเรียนผูกกับกลุ่มเรียนของแต่ละภาค ขึ้นปีใหม่จึงไม่ต้องย้ายข้อมูล

| ลำดับ | งาน | ที่ไหน |
|---|---|---|
| 1 | สำรองข้อมูล | เซิร์ฟเวอร์ |
| 2 | นำเข้าบัญชี นนอ. ชั้นปีใหม่ และอาจารย์ใหม่ (CSV) | ผู้ใช้ › นำเข้าจาก CSV |
| 3 | นำเข้าตารางสอนภาคใหม่ (มีคอลัมน์รายชื่อ นนอ. ได้) | ภาคเรียนและรายวิชา › นำเข้าตารางสอน |
| 4 | ตรวจกลุ่มเรียนที่ "ยังไม่มีอาจารย์ผู้สอน" | ภาคเรียนและรายวิชา |
| 5 | ตั้งเป็นภาคเรียนปัจจุบันเมื่อเปิดภาค | ภาคเรียนและรายวิชา › ตั้งเป็นภาคเรียนปัจจุบัน |
| 6 | ปิดใช้งานบัญชีผู้สำเร็จการศึกษาและบุคลากรที่ย้ายออก | ผู้ใช้ › จัดการ › ปิดใช้งาน |

ประวัติภาคเก่า (งาน คะแนน ผลสอบ) ยังเปิดดูได้จากปุ่มภาคเรียน และงานรุ่นก่อนใช้เป็นแหล่งอ้างอิงตรวจความคล้ายได้

### งานปลายภาค

- อาจารย์ export คะแนน CSV ส่งงานทะเบียน
- ผู้ดูแลระบบ export ประวัติการใช้งานของภาค (ถ้าหน่วยงานต้องเก็บ)
- ตรวจพื้นที่ดิสก์ (`df -h`, `docker system df`)

---

## 8. การเฝ้าระวังและแก้ปัญหา

### 8.1 ดู log

```bash
docker compose logs --tail 200 app
docker compose logs --tail 100 db
```

### 8.2 ปัญหาที่พบบ่อย

| อาการ | สาเหตุที่เป็นไปได้ | วิธีแก้ |
|---|---|---|
| เข้าสู่ระบบแล้วเด้งกลับหน้า login | ใช้ http แต่ `COOKIE_SECURE="true"` | ใช้ HTTPS หรือตั้ง `COOKIE_SECURE="false"` (เฉพาะเครือข่ายภายใน) |
| ผู้ใช้แจ้งว่า "บัญชีถูกล็อก" | ใส่รหัสผิด 5 ครั้ง | รอ 15 นาที หรือผู้ดูแลกด "รีเซ็ตรหัสผ่าน" |
| "รหัสผ่านเริ่มต้นหมดอายุ" | ไม่ได้เข้าระบบภายใน 14 วัน | ผู้ดูแลกด "รีเซ็ตรหัสผ่าน" เพื่อออกรหัสใหม่ |
| อัปโหลดไม่ผ่าน (413) | reverse proxy จำกัดขนาด | เพิ่ม `client_max_body_size` / `max_size` |
| ข้อสอบโค้ดขึ้น "โหลดตัวรันโค้ดไม่สำเร็จ" | ไม่มี `public/pyodide` (build ไม่ผ่าน `prebuild`) | build ใหม่ด้วย `npm run build` หรือ `docker compose up -d --build` |
| แบบทดสอบที่จำกัดห้อง นนอ. เริ่มไม่ได้ | IP ที่ระบบเห็นไม่อยู่ในช่วงของห้อง | ดู "IP ของคุณตอนนี้" ในหน้าตั้งค่าการสอบ แก้ช่วง CIDR หรือการส่ง `X-Forwarded-For` ของ proxy |
| container `app` เริ่มไม่ได้หลังอัปเดต | migration ล้มเหลว | ดู `docker compose logs app` แก้ตามข้อความ หรือกู้คืนไฟล์สำรอง |
| ดิสก์เต็ม | ไฟล์อัปโหลดหรือ image เก่า | `docker image prune`, ย้าย volume ไปดิสก์ใหญ่ขึ้น |
| ไม่มีผู้ดูแลระบบคนใดเข้าระบบได้ | ลืมรหัส / บัญชีถูกปิด | `docker compose exec -e SEED_ADMIN_USERNAME=admin2 app npx tsx prisma/seed.ts` สร้างบัญชีผู้ดูแลใหม่ (ชื่อต้องยังไม่มีในระบบ) และแสดงรหัสชั่วคราว แล้วใช้บัญชีนั้นรีเซ็ตบัญชีเดิม |

### 8.3 ตรวจการใช้งานผิดปกติ

ในหน้า **ประวัติการใช้งาน** ติ๊ก "เฉพาะปัญหา" เพื่อดูการเข้าสู่ระบบที่ล้มเหลวและการล็อกบัญชี ถ้าเห็นการลองรหัสจำนวนมากจาก IP เดียว ให้แจ้งฝ่าย IT เพื่อบล็อกที่ firewall

---

## 9. ข้อควรระวังด้านข้อมูลส่วนบุคคล

- ไฟล์รายชื่อจริง (CSV ของ นนอ./อาจารย์ และรหัสผ่านเริ่มต้น) **ห้าม commit เข้า repo** และควรลบจากเครื่องหลังนำเข้าเสร็จ
- ใบรหัสผ่านชั่วคราวที่พิมพ์แจก ให้แจกเป็นรายบุคคลและทำลายหลังใช้
- ชุดทดสอบ e2e **ล้างฐานข้อมูลทั้งหมด** ห้ามชี้ `DATABASE_URL` ไปที่ฐานข้อมูลจริง (ตัวรันปฏิเสธฐานข้อมูลบน cloud อยู่แล้ว แต่ไม่รู้จักเซิร์ฟเวอร์ภายในของสถาบัน)
