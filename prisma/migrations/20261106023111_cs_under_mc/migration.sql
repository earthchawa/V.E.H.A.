-- Data-only migration (no schema change).
-- Computer Science goes back under Mathematics and Computer Science (MC) as a subject area, next to
-- Mathematics; the second level is called ภาควิชา in Thai. Only seeded values are touched.

-- 1. CS still a top-level department with its seeded name → move it under MC and let it inherit MC's
--    colour and logo again.
UPDATE "Department" AS cs
  SET "parentId" = mc."id",
      "name" = 'Computer Science',
      "nameTh" = 'ภาควิชาคอมพิวเตอร์',
      "color" = CASE WHEN cs."color" = '#9ca3af' THEN NULL ELSE cs."color" END,
      "logoUrl" = CASE WHEN cs."logoUrl" = '/logos/mc.webp' AND cs."logoKey" IS NULL THEN NULL ELSE cs."logoUrl" END,
      "position" = 0
  FROM "Department" AS mc
  WHERE cs."code" = 'CS' AND cs."parentId" IS NULL AND cs."name" = 'Department of Computer Science'
    AND mc."code" = 'MC' AND mc."parentId" IS NULL;

-- 2. CS was deleted by an administrator → create it again under MC.
INSERT INTO "Department" ("id", "code", "name", "nameTh", "parentId", "position", "createdAt")
  SELECT 'cs' || substr(md5(random()::text), 1, 22), 'CS', 'Computer Science', 'ภาควิชาคอมพิวเตอร์', mc."id", 0, CURRENT_TIMESTAMP
  FROM "Department" AS mc
  WHERE mc."code" = 'MC' AND mc."parentId" IS NULL
    AND NOT EXISTS (SELECT 1 FROM "Department" WHERE "code" = 'CS');

-- 3. Courses left without a department when CS was deleted, and whose code starts with CS, go back to CS.
UPDATE "Course" SET "departmentId" = (SELECT "id" FROM "Department" WHERE "code" = 'CS')
  WHERE "departmentId" IS NULL AND "code" LIKE 'CS%' AND EXISTS (SELECT 1 FROM "Department" WHERE "code" = 'CS');

-- 4. Subject areas are ภาควิชา (Thai names only; still-default values only).
UPDATE "Department" SET "nameTh" = 'ภาควิชาคณิตศาสตร์' WHERE "code" = 'MA' AND "nameTh" = 'สาขาวิชาคณิตศาสตร์';
UPDATE "Department" SET "nameTh" = 'ภาควิชาฟิสิกส์' WHERE "code" = 'PH' AND "nameTh" = 'สาขาวิชาฟิสิกส์';
UPDATE "Department" SET "nameTh" = 'ภาควิชาเคมี' WHERE "code" = 'CH' AND "nameTh" = 'สาขาวิชาเคมี';
UPDATE "Department" SET "nameTh" = 'ภาควิชาคอมพิวเตอร์' WHERE "code" = 'CS' AND "nameTh" = 'สาขาวิชาวิทยาการคอมพิวเตอร์';
