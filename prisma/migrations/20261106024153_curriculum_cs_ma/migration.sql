-- Data-only migration: courses of the CS cadets' curriculum taught by Mathematics and Computer Science
-- (src/lib/curriculum.ts; คต → CS, คณ → MA). Existing course codes are left untouched.
-- Generated from src/lib/curriculum.ts — keep the two in step (a unit test checks every code is here).

INSERT INTO "Course" ("id", "code", "title", "titleTh", "credits", "description", "departmentId", "createdAt")
  SELECT 'cur' || substr(md5(random()::text), 1, 22), 'CS101', 'Information Technology', 'เทคโนโลยีสารสนเทศ', 2, 'ชั้นปีที่ 1 ภาคต้น · 2 หน่วยกิต (บรรยาย-ปฏิบัติ-ทบทวน 2-0-0)',
         (SELECT "id" FROM "Department" WHERE "code" = 'CS'), CURRENT_TIMESTAMP
  WHERE NOT EXISTS (SELECT 1 FROM "Course" WHERE "code" = 'CS101');
INSERT INTO "Course" ("id", "code", "title", "titleTh", "credits", "description", "departmentId", "createdAt")
  SELECT 'cur' || substr(md5(random()::text), 1, 22), 'CS132', 'Introduction to Computer Programming', 'การโปรแกรมคอมพิวเตอร์เบื้องต้น', 3, 'ชั้นปีที่ 1 ภาคปลาย · 3 หน่วยกิต (บรรยาย-ปฏิบัติ-ทบทวน 2-2-0)',
         (SELECT "id" FROM "Department" WHERE "code" = 'CS'), CURRENT_TIMESTAMP
  WHERE NOT EXISTS (SELECT 1 FROM "Course" WHERE "code" = 'CS132');
INSERT INTO "Course" ("id", "code", "title", "titleTh", "credits", "description", "departmentId", "createdAt")
  SELECT 'cur' || substr(md5(random()::text), 1, 22), 'CS231', 'Data Structures and Algorithms', 'โครงสร้างข้อมูลและขั้นตอนวิธีทางคอมพิวเตอร์', 3, 'ชั้นปีที่ 2 ภาคต้น · 3 หน่วยกิต (บรรยาย-ปฏิบัติ-ทบทวน 2-2-0)',
         (SELECT "id" FROM "Department" WHERE "code" = 'CS'), CURRENT_TIMESTAMP
  WHERE NOT EXISTS (SELECT 1 FROM "Course" WHERE "code" = 'CS231');
INSERT INTO "Course" ("id", "code", "title", "titleTh", "credits", "description", "departmentId", "createdAt")
  SELECT 'cur' || substr(md5(random()::text), 1, 22), 'CS233', 'Computer Operating Systems', 'ระบบปฏิบัติการคอมพิวเตอร์', 3, 'ชั้นปีที่ 2 ภาคต้น · 3 หน่วยกิต (บรรยาย-ปฏิบัติ-ทบทวน 3-0-0)',
         (SELECT "id" FROM "Department" WHERE "code" = 'CS'), CURRENT_TIMESTAMP
  WHERE NOT EXISTS (SELECT 1 FROM "Course" WHERE "code" = 'CS233');
INSERT INTO "Course" ("id", "code", "title", "titleTh", "credits", "description", "departmentId", "createdAt")
  SELECT 'cur' || substr(md5(random()::text), 1, 22), 'CS232', 'Advanced Computer Programming', 'การโปรแกรมคอมพิวเตอร์ขั้นสูง', 3, 'ชั้นปีที่ 2 ภาคปลาย · 3 หน่วยกิต (บรรยาย-ปฏิบัติ-ทบทวน 2-2-0)',
         (SELECT "id" FROM "Department" WHERE "code" = 'CS'), CURRENT_TIMESTAMP
  WHERE NOT EXISTS (SELECT 1 FROM "Course" WHERE "code" = 'CS232');
INSERT INTO "Course" ("id", "code", "title", "titleTh", "credits", "description", "departmentId", "createdAt")
  SELECT 'cur' || substr(md5(random()::text), 1, 22), 'CS236', 'Database Management Systems', 'ระบบการจัดการฐานข้อมูล', 3, 'ชั้นปีที่ 2 ภาคปลาย · 3 หน่วยกิต (บรรยาย-ปฏิบัติ-ทบทวน 2-2-0)',
         (SELECT "id" FROM "Department" WHERE "code" = 'CS'), CURRENT_TIMESTAMP
  WHERE NOT EXISTS (SELECT 1 FROM "Course" WHERE "code" = 'CS236');
INSERT INTO "Course" ("id", "code", "title", "titleTh", "credits", "description", "departmentId", "createdAt")
  SELECT 'cur' || substr(md5(random()::text), 1, 22), 'CS331', 'Computer Architecture', 'สถาปัตยกรรมคอมพิวเตอร์', 3, 'ชั้นปีที่ 3 ภาคต้น · 3 หน่วยกิต (บรรยาย-ปฏิบัติ-ทบทวน 3-0-0)',
         (SELECT "id" FROM "Department" WHERE "code" = 'CS'), CURRENT_TIMESTAMP
  WHERE NOT EXISTS (SELECT 1 FROM "Course" WHERE "code" = 'CS331');
INSERT INTO "Course" ("id", "code", "title", "titleTh", "credits", "description", "departmentId", "createdAt")
  SELECT 'cur' || substr(md5(random()::text), 1, 22), 'CS333', 'Computer Networks', 'ระบบเครือข่ายคอมพิวเตอร์', 3, 'ชั้นปีที่ 3 ภาคต้น · 3 หน่วยกิต (บรรยาย-ปฏิบัติ-ทบทวน 2-2-0)',
         (SELECT "id" FROM "Department" WHERE "code" = 'CS'), CURRENT_TIMESTAMP
  WHERE NOT EXISTS (SELECT 1 FROM "Course" WHERE "code" = 'CS333');
INSERT INTO "Course" ("id", "code", "title", "titleTh", "credits", "description", "departmentId", "createdAt")
  SELECT 'cur' || substr(md5(random()::text), 1, 22), 'CS335', 'Object-Oriented Programming', 'การโปรแกรมเชิงวัตถุ', 3, 'ชั้นปีที่ 3 ภาคต้น · 3 หน่วยกิต (บรรยาย-ปฏิบัติ-ทบทวน 2-2-0)',
         (SELECT "id" FROM "Department" WHERE "code" = 'CS'), CURRENT_TIMESTAMP
  WHERE NOT EXISTS (SELECT 1 FROM "Course" WHERE "code" = 'CS335');
INSERT INTO "Course" ("id", "code", "title", "titleTh", "credits", "description", "departmentId", "createdAt")
  SELECT 'cur' || substr(md5(random()::text), 1, 22), 'CS332', 'Web Programming', 'การโปรแกรมโครงข่ายเว็บ', 3, 'ชั้นปีที่ 3 ภาคปลาย · 3 หน่วยกิต (บรรยาย-ปฏิบัติ-ทบทวน 2-2-0)',
         (SELECT "id" FROM "Department" WHERE "code" = 'CS'), CURRENT_TIMESTAMP
  WHERE NOT EXISTS (SELECT 1 FROM "Course" WHERE "code" = 'CS332');
INSERT INTO "Course" ("id", "code", "title", "titleTh", "credits", "description", "departmentId", "createdAt")
  SELECT 'cur' || substr(md5(random()::text), 1, 22), 'CS334', 'Systems Analysis and Design', 'การวิเคราะห์และการออกแบบระบบ', 3, 'ชั้นปีที่ 3 ภาคปลาย · 3 หน่วยกิต (บรรยาย-ปฏิบัติ-ทบทวน 3-0-0)',
         (SELECT "id" FROM "Department" WHERE "code" = 'CS'), CURRENT_TIMESTAMP
  WHERE NOT EXISTS (SELECT 1 FROM "Course" WHERE "code" = 'CS334');
INSERT INTO "Course" ("id", "code", "title", "titleTh", "credits", "description", "departmentId", "createdAt")
  SELECT 'cur' || substr(md5(random()::text), 1, 22), 'CS431', 'Management Information Systems', 'ระบบสารสนเทศเพื่อการจัดการ', 3, 'ชั้นปีที่ 4 ภาคต้น · 3 หน่วยกิต (บรรยาย-ปฏิบัติ-ทบทวน 3-0-0)',
         (SELECT "id" FROM "Department" WHERE "code" = 'CS'), CURRENT_TIMESTAMP
  WHERE NOT EXISTS (SELECT 1 FROM "Course" WHERE "code" = 'CS431');
INSERT INTO "Course" ("id", "code", "title", "titleTh", "credits", "description", "departmentId", "createdAt")
  SELECT 'cur' || substr(md5(random()::text), 1, 22), 'CS433', 'Multimedia Systems Programming', 'การโปรแกรมระบบสื่อประสม', 3, 'ชั้นปีที่ 4 ภาคต้น · 3 หน่วยกิต (บรรยาย-ปฏิบัติ-ทบทวน 2-2-0)',
         (SELECT "id" FROM "Department" WHERE "code" = 'CS'), CURRENT_TIMESTAMP
  WHERE NOT EXISTS (SELECT 1 FROM "Course" WHERE "code" = 'CS433');
INSERT INTO "Course" ("id", "code", "title", "titleTh", "credits", "description", "departmentId", "createdAt")
  SELECT 'cur' || substr(md5(random()::text), 1, 22), 'CS432', 'Cybersecurity', 'ความมั่นคงปลอดภัยไซเบอร์', 3, 'ชั้นปีที่ 4 ภาคปลาย · 3 หน่วยกิต (บรรยาย-ปฏิบัติ-ทบทวน 3-0-0)',
         (SELECT "id" FROM "Department" WHERE "code" = 'CS'), CURRENT_TIMESTAMP
  WHERE NOT EXISTS (SELECT 1 FROM "Course" WHERE "code" = 'CS432');
INSERT INTO "Course" ("id", "code", "title", "titleTh", "credits", "description", "departmentId", "createdAt")
  SELECT 'cur' || substr(md5(random()::text), 1, 22), 'CS434', 'Data Mining', 'เหมืองข้อมูล', 3, 'ชั้นปีที่ 4 ภาคปลาย · 3 หน่วยกิต (บรรยาย-ปฏิบัติ-ทบทวน 3-0-0)',
         (SELECT "id" FROM "Department" WHERE "code" = 'CS'), CURRENT_TIMESTAMP
  WHERE NOT EXISTS (SELECT 1 FROM "Course" WHERE "code" = 'CS434');
INSERT INTO "Course" ("id", "code", "title", "titleTh", "credits", "description", "departmentId", "createdAt")
  SELECT 'cur' || substr(md5(random()::text), 1, 22), 'CS436', 'Mobile Application Development', 'การพัฒนาโปรแกรมประยุกต์บนอุปกรณ์เคลื่อนที่', 3, 'ชั้นปีที่ 4 ภาคปลาย · 3 หน่วยกิต (บรรยาย-ปฏิบัติ-ทบทวน 2-2-0)',
         (SELECT "id" FROM "Department" WHERE "code" = 'CS'), CURRENT_TIMESTAMP
  WHERE NOT EXISTS (SELECT 1 FROM "Course" WHERE "code" = 'CS436');
INSERT INTO "Course" ("id", "code", "title", "titleTh", "credits", "description", "departmentId", "createdAt")
  SELECT 'cur' || substr(md5(random()::text), 1, 22), 'CS530', 'Research Project', 'โครงการวิจัย', 4, 'ชั้นปีที่ 5 ภาคต้นและภาคปลาย · 4 หน่วยกิต (บรรยาย-ปฏิบัติ-ทบทวน 0-4-0)',
         (SELECT "id" FROM "Department" WHERE "code" = 'CS'), CURRENT_TIMESTAMP
  WHERE NOT EXISTS (SELECT 1 FROM "Course" WHERE "code" = 'CS530');
INSERT INTO "Course" ("id", "code", "title", "titleTh", "credits", "description", "departmentId", "createdAt")
  SELECT 'cur' || substr(md5(random()::text), 1, 22), 'MA111', 'Calculus 1', 'แคลคูลัส 1', 3, 'ชั้นปีที่ 1 ภาคต้น · 3 หน่วยกิต (บรรยาย-ปฏิบัติ-ทบทวน 3-0-2)',
         (SELECT "id" FROM "Department" WHERE "code" = 'MA'), CURRENT_TIMESTAMP
  WHERE NOT EXISTS (SELECT 1 FROM "Course" WHERE "code" = 'MA111');
INSERT INTO "Course" ("id", "code", "title", "titleTh", "credits", "description", "departmentId", "createdAt")
  SELECT 'cur' || substr(md5(random()::text), 1, 22), 'MA112', 'Calculus 2', 'แคลคูลัส 2', 3, 'ชั้นปีที่ 1 ภาคปลาย · 3 หน่วยกิต (บรรยาย-ปฏิบัติ-ทบทวน 3-0-2)',
         (SELECT "id" FROM "Department" WHERE "code" = 'MA'), CURRENT_TIMESTAMP
  WHERE NOT EXISTS (SELECT 1 FROM "Course" WHERE "code" = 'MA112');
INSERT INTO "Course" ("id", "code", "title", "titleTh", "credits", "description", "departmentId", "createdAt")
  SELECT 'cur' || substr(md5(random()::text), 1, 22), 'MA211', 'Calculus 3', 'แคลคูลัส 3', 3, 'ชั้นปีที่ 2 ภาคต้น · 3 หน่วยกิต (บรรยาย-ปฏิบัติ-ทบทวน 3-0-2)',
         (SELECT "id" FROM "Department" WHERE "code" = 'MA'), CURRENT_TIMESTAMP
  WHERE NOT EXISTS (SELECT 1 FROM "Course" WHERE "code" = 'MA211');
INSERT INTO "Course" ("id", "code", "title", "titleTh", "credits", "description", "departmentId", "createdAt")
  SELECT 'cur' || substr(md5(random()::text), 1, 22), 'MA233', 'Statistics for Science', 'สถิติสำหรับวิทยาศาสตร์', 3, 'ชั้นปีที่ 2 ภาคต้น · 3 หน่วยกิต (บรรยาย-ปฏิบัติ-ทบทวน 3-0-0)',
         (SELECT "id" FROM "Department" WHERE "code" = 'MA'), CURRENT_TIMESTAMP
  WHERE NOT EXISTS (SELECT 1 FROM "Course" WHERE "code" = 'MA233');
INSERT INTO "Course" ("id", "code", "title", "titleTh", "credits", "description", "departmentId", "createdAt")
  SELECT 'cur' || substr(md5(random()::text), 1, 22), 'MA236', 'Discrete Mathematics', 'คณิตศาสตร์ดิสครีต', 3, 'ชั้นปีที่ 2 ภาคปลาย · 3 หน่วยกิต (บรรยาย-ปฏิบัติ-ทบทวน 3-0-0)',
         (SELECT "id" FROM "Department" WHERE "code" = 'MA'), CURRENT_TIMESTAMP
  WHERE NOT EXISTS (SELECT 1 FROM "Course" WHERE "code" = 'MA236');
INSERT INTO "Course" ("id", "code", "title", "titleTh", "credits", "description", "departmentId", "createdAt")
  SELECT 'cur' || substr(md5(random()::text), 1, 22), 'MA332', 'Numerical Analysis', 'การวิเคราะห์เชิงตัวเลข', 3, 'ชั้นปีที่ 3 ภาคปลาย · 3 หน่วยกิต (บรรยาย-ปฏิบัติ-ทบทวน 2-2-0)',
         (SELECT "id" FROM "Department" WHERE "code" = 'MA'), CURRENT_TIMESTAMP
  WHERE NOT EXISTS (SELECT 1 FROM "Course" WHERE "code" = 'MA332');
INSERT INTO "Course" ("id", "code", "title", "titleTh", "credits", "description", "departmentId", "createdAt")
  SELECT 'cur' || substr(md5(random()::text), 1, 22), 'MA431', 'Quantitative Research', 'การวิจัยเชิงปริมาณ', 3, 'ชั้นปีที่ 4 ภาคต้น · 3 หน่วยกิต (บรรยาย-ปฏิบัติ-ทบทวน 2-2-0)',
         (SELECT "id" FROM "Department" WHERE "code" = 'MA'), CURRENT_TIMESTAMP
  WHERE NOT EXISTS (SELECT 1 FROM "Course" WHERE "code" = 'MA431');
