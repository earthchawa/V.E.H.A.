-- Data-only migration (no schema change).
-- Computer Science becomes its own department (กองวิชาวิทยาการคอมพิวเตอร์) instead of a subject area
-- of Mathematics and Computer Science. Only a CS row still holding the seeded subject-area values is
-- touched; colour and logo are filled only when empty, so admin edits survive.
UPDATE "Department"
  SET "parentId" = NULL,
      "name" = 'Department of Computer Science',
      "nameTh" = 'กองวิชาวิทยาการคอมพิวเตอร์',
      "color" = COALESCE("color", '#9ca3af'),
      "logoUrl" = CASE WHEN "logoUrl" IS NULL AND "logoKey" IS NULL THEN '/logos/mc.webp' ELSE "logoUrl" END
  WHERE "code" = 'CS' AND "name" = 'Computer Science';

-- Keep the seeded department order (CS right after Mathematics and Computer Science).
UPDATE "Department" SET "position" = CASE "code"
    WHEN 'AE' THEN 0 WHEN 'ME' THEN 1 WHEN 'EE' THEN 2 WHEN 'CE' THEN 3 WHEN 'IEA' THEN 4
    WHEN 'MC' THEN 5 WHEN 'CS' THEN 6 WHEN 'MS' THEN 7 WHEN 'EDA' THEN 8 WHEN 'HS' THEN 9 END
  WHERE "parentId" IS NULL AND "code" IN ('AE','ME','EE','CE','IEA','MC','CS','MS','EDA','HS');
