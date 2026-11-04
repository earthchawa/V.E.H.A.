-- Data-only migration (no schema change).
-- Top-level units are "Department of …" in English (Thai names unchanged); the second level is a
-- subject area (สาขาวิชา). Only rows still holding the previously seeded defaults are touched, so
-- anything an administrator renamed is left alone.

UPDATE "Department" SET "name" = 'Department of Aeronautical Engineering' WHERE "code" = 'AE' AND "name" = 'Division of Aeronautical Engineering';
UPDATE "Department" SET "name" = 'Department of Mechanical Engineering' WHERE "code" = 'ME' AND "name" = 'Division of Mechanical Engineering';
UPDATE "Department" SET "name" = 'Department of Electrical Engineering' WHERE "code" = 'EE' AND "name" = 'Division of Electrical Engineering';
UPDATE "Department" SET "name" = 'Department of Civil Engineering' WHERE "code" = 'CE' AND "name" = 'Division of Civil Engineering';
UPDATE "Department" SET "name" = 'Department of Industrial Engineering and Aviation Management' WHERE "code" = 'IEA' AND "name" = 'Division of Industrial Engineering and Aviation Management';
UPDATE "Department" SET "name" = 'Department of Mathematics and Computer Science' WHERE "code" = 'MC' AND "name" = 'Division of Mathematics and Computer';
UPDATE "Department" SET "name" = 'Department of Military and Aerospace Materials Science' WHERE "code" = 'MS' AND "name" = 'Division of Military and Aerospace Materials Science';
UPDATE "Department" SET "name" = 'Department of Education Administration' WHERE "code" = 'EDA' AND "name" = 'Education Directorate';
UPDATE "Department" SET "name" = 'Department of Humanities and Social Sciences' WHERE "code" = 'HS' AND "name" = 'Division of Humanities and Social Sciences';

-- Mathematics & Computer Science: subject areas CS and MA (MATH → MA), sharing the department's logo and colour.
UPDATE "Department" SET "name" = 'Computer Science', "nameTh" = 'สาขาวิชาวิทยาการคอมพิวเตอร์'
  WHERE "code" = 'CS' AND "name" = 'Department of Computer Science';
UPDATE "Department"
  SET "code" = 'MA', "name" = 'Mathematics', "nameTh" = 'สาขาวิชาคณิตศาสตร์',
      "color" = CASE WHEN "color" = '#f97316' THEN NULL ELSE "color" END
  WHERE "code" = 'MATH' AND "name" = 'Department of Mathematics'
    AND NOT EXISTS (SELECT 1 FROM "Department" WHERE "code" = 'MA');
