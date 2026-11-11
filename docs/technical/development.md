# คู่มือนักพัฒนา (Developer Guide)

สำหรับผู้ที่จะแก้ไขหรือเพิ่มฟีเจอร์ใน V.E.H.A. อ่าน [software-design.md](software-design.md) ก่อน เพื่อเข้าใจสถาปัตยกรรมและแบบจำลองข้อมูล

---

## 1. ตั้งค่าเครื่องนักพัฒนา

ต้องมี Node.js 22+, PostgreSQL 16 (และ `psql` สำหรับ e2e)

```bash
npm install                     # รัน prisma generate ให้อัตโนมัติ
cp .env.example .env            # แก้ DATABASE_URL, ตั้ง COOKIE_SECURE="false"
npm run db:deploy               # สร้างตาราง
npm run db:seed:demo            # admin + ข้อมูลตัวอย่าง (แสดงรหัสผ่าน หรือใช้ DEMO_PASSWORD)
npm run dev                     # http://localhost:3000
```

ข้อมูลตัวอย่างมีภาคเรียน 2/2569, วิชา CS201 / CS202 / MA101 (เฉพาะ demo), อาจารย์ `T0001`, นนอ. `6601001`–`6601005` และงานที่มีคนลอก (Python ที่เปลี่ยนชื่อตัวแปร, เรียงความไทยที่ซ้ำย่อหน้า) จึงเปิดรายงานความคล้ายดูได้ทันที

### คำสั่ง

| คำสั่ง | ทำอะไร |
|---|---|
| `npm run dev` | dev server (คัดลอก Pyodide ไป `public/pyodide` ก่อน) |
| `npm run build` | production build + type-check |
| `npm run typecheck` | `tsc --noEmit` |
| `npm test` | unit tests (Vitest) |
| `npm run test:e2e` | end-to-end (ต้อง `npm run build` ก่อน) |
| `npm run db:deploy` | apply migration |
| `npm run db:seed` | admin + กองวิชา + หลักสูตร (ไม่เขียนทับ) |
| `npm run db:seed:demo` | + ข้อมูลตัวอย่าง (idempotent) |

---

## 2. ข้อตกลงในการเขียนโค้ด

ข้อตกลงฉบับเต็มอยู่ใน `CLAUDE.md` ที่ root ของ repo ด้านล่างเป็นข้อที่ต้องทำทุกครั้ง

### 2.1 ข้อความ (i18n)
- **ทุกข้อความที่ผู้ใช้เห็นต้องผ่าน i18n** เพิ่ม key ใน `src/lib/i18n/en.ts` และ key เดียวกันใน `th.ts` (ไม่ครบ TypeScript จะ fail และมี test ตรวจ placeholder `{n}` ให้ตรงกัน)
- Server: `const { t } = await getI18n()` หรือคืน `Msg` key จาก action / Client: `const { t } = useI18n()`
- วันที่ใช้ `date()` และภาคเรียนใช้ `term()` จาก translator (เวลาไทย, พ.ศ. ในโหมดไทย)
- UI ภาษาอังกฤษใช้คำว่า "semester" ไม่ใช่ "term" ภาษาไทยใช้ "ภาคเรียน"

### 2.2 Server Action
ทุก action ต้องมีลำดับนี้:

```ts
export async function doSomethingAction(_: State, form: FormData): Promise<State> {
  const user = await requireUser();                       // 1. ยืนยันตัวตน
  const access = await offeringAccess(user, offeringId);  // 2. ตรวจสิทธิ์ (หรือ canGrade สำหรับคะแนน)
  if (access !== "manage") return { error: "err.forbidden" };
  const parsed = schema.safeParse(...);                   // 3. ตรวจค่า (zod)
  if (!parsed.success) return { error: ... };
  await db.$transaction(...);                             // 4. เขียนฐานข้อมูล
  await audit({ actorId: user.id, action: "x.updated", targetType, targetId, details }); // 5. audit
  revalidatePath(...);                                    // 6. รีเฟรชหน้า
  return { ok: true };
}
```

- **ห้ามพึ่งการซ่อนปุ่มใน UI** แทนการตรวจสิทธิ์
- คะแนน การตั้งค่าสมุดคะแนน การตรวจข้อสอบ และการให้ทำใหม่ ใช้ `canGrade` (ผู้ดูแลระบบอ่านได้อย่างเดียว)
- action ใหม่ที่ audit ต้องมี label `log.<action>` ใน i18n และ prefix อยู่ใน `AUDIT_CATEGORIES` (`lib/audit-filter.ts`) มี unit test ตรวจ

### 2.3 ฟอร์มและหน้าจอ
- ฟอร์มใช้ `useActionState` + `<KeepForm>` ไม่ใช่ `<form action>` ตรงๆ (React 19 ล้างฟอร์มหลัง action) ใช้ `resetOnSuccess` / `closeOnSuccess` ตามต้องการ
- การสร้าง/แก้ไขเปิดใน `<Modal>`, ไฟล์ใช้ `<FileDropzone>`, คำอธิบายใช้ `<InfoTip>` (ไม่ใช่ย่อหน้า)
- การตั้งค่าเปิด/ปิดใช้ `<input type="checkbox" role="switch" className="toggle">`, การลบ/รีเซ็ตใช้ `<ConfirmForm>` (ห้ามใช้ `window.confirm()`), แจ้งผลหลังหน้าต่างปิดด้วย `toast()`
- เวลาที่ผู้ใช้กรอกเป็นเวลาไทย ใช้ `parseBangkokLocal` / `toBangkokLocal` (`lib/assignments.ts`)
- สีใช้ semantic token (`bg-surface`, `text-muted`, `text-danger`) ไม่ hard-code สีของข้อความ, สีของวิชาใช้ `courseTheme()` + `cc-bar`/`cc-text`/`cc-tint`
- ทุกหน้าต้องใช้ได้ที่ 360–390 px ไม่มี horizontal scroll ตารางกว้างใส่ใน `overflow-x-auto`
- route ใหม่ที่ไม่มีหน้าของตัวเอง เพิ่มใน `parentPath()` (`lib/nav.ts`) เพื่อให้ปุ่มย้อนกลับถูกต้อง

### 2.4 แบบทดสอบ
- ใช้ `sebRequired(quiz)` ไม่ใช่ `quiz.requireSeb`
- ห้ามส่งเฉลย (`correct`, `accepted`) ไปที่ client ในหน้าสอบ
- หน้าสอบบล็อก copy/paste/drop ใน capture phase อย่าเพิ่ม handler ที่ทำให้ editor ข้ามได้

### 2.5 ข้อมูลจริง
- ห้าม commit รายชื่อ เลขประจำตัว หรือรหัสผ่านจริง ข้อมูลจริงนำเข้าผ่านหน้าผู้ดูแลระบบเท่านั้น
- demo seed ต้อง idempotent (รันทุกครั้งที่ build บน Vercel เมื่อ `DEMO_SEED=true`)

---

## 3. Migration

`prisma migrate dev` ไม่ยอมรันแบบ non-interactive เมื่อมี warning ให้สร้าง SQL จาก migration เดิมด้วย shadow database แทน

```bash
mkdir prisma/migrations/$(date -u +%Y%m%d%H%M%S)_name
npx prisma migrate diff --from-migrations prisma/migrations --to-schema-datamodel prisma/schema.prisma \
  --shadow-database-url "$SHADOW_DATABASE_URL" --script > prisma/migrations/<โฟลเดอร์นั้น>/migration.sql
npx prisma migrate deploy && npx prisma generate
```

- commit ทุก migration (Vercel และ Docker apply ตอน build/start)
- ข้อมูลอ้างอิง (เช่น รายวิชาในหลักสูตรของกองวิชาอื่น): เพิ่มใน `lib/curriculum.ts` และสร้าง data migration ใหม่ มี test ตรวจว่าตรงกัน

---

## 4. การทดสอบ

### 4.1 Unit tests (`npm test`)

ครอบคลุม pure logic: นโยบายรหัสผ่าน, lockout, token, CSV, การนำเข้าตารางสอน, similarity (รวมภาษาไทยและคำถาม-คำตอบ), การแยกความคล้ายตามแหล่ง, คำนวณเกรด, logic แบบทดสอบ, หลักสูตร, การนำทาง, ความครบของ i18n (ปัจจุบัน 119 tests) ไฟล์ test อยู่ข้างไฟล์ที่ทดสอบ (`*.test.ts`)

### 4.2 End-to-end (`e2e/`)

```bash
npm run build
npm run test:e2e                                  # ทุกชุด (~15 นาที)
npm run test:e2e -- 05-quiz 10-code-questions     # เฉพาะบางชุด
```

| ชุด | ครอบคลุม |
|---|---|
| 01-auth-and-materials | เข้าสู่ระบบ, เปลี่ยนรหัสครั้งแรก, lockout, ลืมรหัสผ่าน, เอกสาร |
| 02-assignments-similarity | สร้างงาน, ส่งงาน, รายงานความคล้าย, การปกปิดตัวตน |
| 03-gradebook | ตั้งค่าคะแนน, กรอกคะแนน, เผยแพร่, สิทธิ์ผู้ดูแล |
| 04-sections | คัดลอกระหว่างกลุ่มเรียน |
| 05-quiz / 06-quiz-builder | ทำแบบทดสอบ, จับเวลา, ตรวจ, สร้างข้อสอบ |
| 07-branding | สีและโลโก้กองวิชา |
| 08-admin-ui / 17-admin-screens | หน้าผู้ดูแลระบบ |
| 09-activity-log | บันทึกการใช้งานและตัวกรอง |
| 10-code-questions | ข้อสอบโค้ด Python/JS/Web |
| 11-reference-library | คลังแหล่งอ้างอิง |
| 12-navigation-curriculum | ปุ่มย้อนกลับ, รายวิชาในหลักสูตร |
| 13/14/15-import-* | นำเข้าอาจารย์, นนอ., ตารางสอน (fixture สมมติ) |
| 16-mobile-menu / 19-layout / 20-mobile-overflow | หน้าจอมือถือ (360/390/1024 px) |
| 18-info-tips | ⓘ คำอธิบาย |
| 22-system-backup | หน้าระบบ, ดาวน์โหลดข้อมูลสำรองและกู้คืนจริง, ไฟล์ tar, กลุ่มตั้งค่าความคล้ายในฟอร์มงาน |
| 21-year-levels-and-ux | ชั้นปีและการเลื่อนชั้น, ลบกลุ่มเรียน, สวิตช์, หน้าต่างคัดลอก/ยืนยัน, toast, การ์ดรายการ, ธีมสว่าง |

- **ทุกชุดล้างฐานข้อมูลก่อนเริ่ม** ใช้ฐานข้อมูลทดสอบในเครื่องเท่านั้น (ตัวรันปฏิเสธฐานข้อมูลบน cloud ถ้าไม่ตั้ง `E2E_ALLOW_REMOTE_DB=1`)
- fixture ใน `e2e/fixtures/` เป็นข้อมูลสมมติที่มีรูปแบบเหมือนของจริง
- **เปลี่ยน user flow เมื่อไร ต้องแก้หรือเพิ่มชุดทดสอบใน commit เดียวกัน** และแก้คู่มือใน `docs/manual/` ด้วย

---

## 5. Checklist เพิ่มฟีเจอร์

- [ ] แก้ `schema.prisma` + สร้าง migration (ถ้ามี)
- [ ] logic ที่คำนวณได้โดยไม่ใช้ฐานข้อมูล เขียนเป็น pure function ใน `src/lib` + unit test
- [ ] server action: ยืนยันตัวตน → ตรวจสิทธิ์ → ตรวจค่า → เขียน → audit
- [ ] ข้อความ EN + TH, label `log.*` สำหรับ action ใหม่
- [ ] ตรวจหน้าจอที่ 360 px และธีมสว่าง/มืด
- [ ] เพิ่มหรือแก้ชุด e2e
- [ ] แก้คู่มือผู้ใช้ใน `docs/manual/` และ SDD ถ้าเปลี่ยนการออกแบบ
- [ ] `npm run typecheck && npm test && npm run build` แล้วรัน e2e ที่เกี่ยวข้อง
