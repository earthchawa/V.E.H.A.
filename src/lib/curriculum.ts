/**
 * Courses of the Computer Science cadets' curriculum taught by the Department of Mathematics and
 * Computer Science (หลักสูตร V2.1, pp. 45–49): คต → CS, คณ → MA. Electives still numbered "xxx" in the
 * book are left out until they get real codes. English titles are translations; Thai titles are as printed.
 *
 * Used by `npm run db:seed` (fresh installations) and mirrored by the migration
 * `*_curriculum_cs_ma` for existing databases. Neither overwrites a course that already exists.
 */
export type CurriculumCourse = {
  code: string;
  title: string;
  titleTh: string;
  credits: number;
  /** Year 1–5 and semester (1 = ภาคต้น, 2 = ภาคปลาย, "1–2" = runs across both). */
  year: number;
  semester: "1" | "2" | "1–2";
  /** บรรยาย-ปฏิบัติ-ทบทวน (lecture-practice-self-study hours per week). */
  hours: string;
};

export const CURRICULUM: CurriculumCourse[] = [
  // ---- คต: Computer Science (ภาควิชาคอมพิวเตอร์) ----
  { code: "CS101", title: "Information Technology", titleTh: "เทคโนโลยีสารสนเทศ", credits: 2, year: 1, semester: "1", hours: "2-0-0" },
  { code: "CS132", title: "Introduction to Computer Programming", titleTh: "การโปรแกรมคอมพิวเตอร์เบื้องต้น", credits: 3, year: 1, semester: "2", hours: "2-2-0" },
  { code: "CS231", title: "Data Structures and Algorithms", titleTh: "โครงสร้างข้อมูลและขั้นตอนวิธีทางคอมพิวเตอร์", credits: 3, year: 2, semester: "1", hours: "2-2-0" },
  { code: "CS233", title: "Computer Operating Systems", titleTh: "ระบบปฏิบัติการคอมพิวเตอร์", credits: 3, year: 2, semester: "1", hours: "3-0-0" },
  { code: "CS232", title: "Advanced Computer Programming", titleTh: "การโปรแกรมคอมพิวเตอร์ขั้นสูง", credits: 3, year: 2, semester: "2", hours: "2-2-0" },
  { code: "CS236", title: "Database Management Systems", titleTh: "ระบบการจัดการฐานข้อมูล", credits: 3, year: 2, semester: "2", hours: "2-2-0" },
  { code: "CS331", title: "Computer Architecture", titleTh: "สถาปัตยกรรมคอมพิวเตอร์", credits: 3, year: 3, semester: "1", hours: "3-0-0" },
  { code: "CS333", title: "Computer Networks", titleTh: "ระบบเครือข่ายคอมพิวเตอร์", credits: 3, year: 3, semester: "1", hours: "2-2-0" },
  { code: "CS335", title: "Object-Oriented Programming", titleTh: "การโปรแกรมเชิงวัตถุ", credits: 3, year: 3, semester: "1", hours: "2-2-0" },
  { code: "CS332", title: "Web Programming", titleTh: "การโปรแกรมโครงข่ายเว็บ", credits: 3, year: 3, semester: "2", hours: "2-2-0" },
  { code: "CS334", title: "Systems Analysis and Design", titleTh: "การวิเคราะห์และการออกแบบระบบ", credits: 3, year: 3, semester: "2", hours: "3-0-0" },
  { code: "CS431", title: "Management Information Systems", titleTh: "ระบบสารสนเทศเพื่อการจัดการ", credits: 3, year: 4, semester: "1", hours: "3-0-0" },
  { code: "CS433", title: "Multimedia Systems Programming", titleTh: "การโปรแกรมระบบสื่อประสม", credits: 3, year: 4, semester: "1", hours: "2-2-0" },
  { code: "CS432", title: "Cybersecurity", titleTh: "ความมั่นคงปลอดภัยไซเบอร์", credits: 3, year: 4, semester: "2", hours: "3-0-0" },
  { code: "CS434", title: "Data Mining", titleTh: "เหมืองข้อมูล", credits: 3, year: 4, semester: "2", hours: "3-0-0" },
  { code: "CS436", title: "Mobile Application Development", titleTh: "การพัฒนาโปรแกรมประยุกต์บนอุปกรณ์เคลื่อนที่", credits: 3, year: 4, semester: "2", hours: "2-2-0" },
  { code: "CS530", title: "Research Project", titleTh: "โครงการวิจัย", credits: 4, year: 5, semester: "1–2", hours: "0-4-0" },
  // ---- คณ: Mathematics (ภาควิชาคณิตศาสตร์) ----
  { code: "MA111", title: "Calculus 1", titleTh: "แคลคูลัส 1", credits: 3, year: 1, semester: "1", hours: "3-0-2" },
  { code: "MA112", title: "Calculus 2", titleTh: "แคลคูลัส 2", credits: 3, year: 1, semester: "2", hours: "3-0-2" },
  { code: "MA211", title: "Calculus 3", titleTh: "แคลคูลัส 3", credits: 3, year: 2, semester: "1", hours: "3-0-2" },
  { code: "MA233", title: "Statistics for Science", titleTh: "สถิติสำหรับวิทยาศาสตร์", credits: 3, year: 2, semester: "1", hours: "3-0-0" },
  { code: "MA236", title: "Discrete Mathematics", titleTh: "คณิตศาสตร์ดิสครีต", credits: 3, year: 2, semester: "2", hours: "3-0-0" },
  { code: "MA332", title: "Numerical Analysis", titleTh: "การวิเคราะห์เชิงตัวเลข", credits: 3, year: 3, semester: "2", hours: "2-2-0" },
  { code: "MA431", title: "Quantitative Research", titleTh: "การวิจัยเชิงปริมาณ", credits: 3, year: 4, semester: "1", hours: "2-2-0" },
];

const SEMESTER_TH = { "1": "ภาคต้น", "2": "ภาคปลาย", "1–2": "ภาคต้นและภาคปลาย" } as const;

/** Short note stored as the course description (shown under the course title). */
export function curriculumNote(c: CurriculumCourse): string {
  return `ชั้นปีที่ ${c.year} ${SEMESTER_TH[c.semester]} · ${c.credits} หน่วยกิต (บรรยาย-ปฏิบัติ-ทบทวน ${c.hours})`;
}

/**
 * Read a curriculumNote() back into its parts, so the course header can show year level and credits in its
 * top line. Returns null for a description an admin wrote by hand (shown as it is instead).
 */
export function parseCurriculumNote(note: string | null | undefined): { year: number; credits: number; hours: string } | null {
  const m = note?.trim().match(/^ชั้นปีที่ (\d) \S+ · (\d+) หน่วยกิต \(บรรยาย-ปฏิบัติ-ทบทวน (\d+-\d+-\d+)\)$/);
  return m ? { year: Number(m[1]), credits: Number(m[2]), hours: m[3] } : null;
}

/** Subject area each course belongs to, by code prefix. */
export const curriculumDepartment = (code: string) => code.slice(0, 2);
