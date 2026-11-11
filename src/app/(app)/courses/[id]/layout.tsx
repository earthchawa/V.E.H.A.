import { loadCourse } from "@/lib/course";
import { db } from "@/lib/db";
import { courseTheme, deptLogo } from "@/lib/departments";
import { getI18n } from "@/lib/i18n/server";
import { parseCurriculumNote } from "@/lib/curriculum";
import { BackButton } from "@/components/BackButton";
import { CourseTabs } from "./CourseTabs";

/**
 * Course header: what the course is on the left (code · semester · section, title), who runs it on the
 * right (subject area, department, instructors). Tabs below, then — on detail pages — the Back button.
 */
export default async function CourseLayout({ params, children }: { params: Promise<{ id: string }>; children: React.ReactNode }) {
  const { id } = await params;
  const { offering, instructors } = await loadCourse(id);
  const { t, term, lang } = await getI18n();
  const dept = offering.course.department;
  const theme = courseTheme(offering.course.code, dept);
  const logo = deptLogo(dept);
  const deptName = (d: { name: string; nameTh: string | null }) => (lang === "th" && d.nameTh ? d.nameTh : d.name);
  const note = parseCurriculumNote(offering.course.description);
  const multiSection = (await db.courseOffering.count({ where: { courseId: offering.courseId, termId: offering.termId } })) > 1;
  return (
    <div className={theme.className} style={theme.style}>
      <header className="mb-6 flex flex-col gap-5 md:flex-row md:items-end md:justify-between">
        <div className="min-w-0">
          <div className="cc-text mb-1 font-mono text-xs" data-testid="course-meta">
            {[
              offering.course.code,
              // "ชั้นปีที่ 3 ภาคเรียนที่ 2/2569" when the curriculum note gives the year level.
              note ? `${t("yl.level", { n: note.year })} ${term(offering.term)}` : term(offering.term),
              multiSection ? t("dash.section", { s: offering.section }) : null,
              note ? t("course.credits", { n: note.credits, h: note.hours }) : null,
            ]
              .filter(Boolean)
              .join(" · ")}
          </div>
          <h1 className="text-2xl font-semibold tracking-tight">{offering.course.title}</h1>
          {offering.course.titleTh && <div className="mt-1 text-sm text-muted">{offering.course.titleTh}</div>}
          {/* A hand-written description (not a curriculum note, which goes into the top line). */}
          {offering.course.description && !note && <div className="mt-1 text-xs text-subtle" data-testid="course-description">{offering.course.description}</div>}
        </div>
        <div className="flex shrink-0 items-center gap-3 md:flex-row-reverse md:text-right">
          {logo && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={logo} alt="" className="h-11 w-auto max-w-16 shrink-0 object-contain" />
          )}
          <div className="min-w-0 text-xs leading-relaxed">
            {/* Subject area, department and instructors each on their own line (names never break mid-way on desktop). */}
            {dept && (
              <div data-testid="course-dept">
                <div className="font-medium text-fg md:whitespace-nowrap">{deptName(dept)}</div>
                {dept.parent && <div className="text-subtle md:whitespace-nowrap">{deptName(dept.parent)}</div>}
              </div>
            )}
            <div className="mt-0.5 text-muted" data-testid="course-instructors">
              {instructors.map((e) => e.user.fullName).join(", ") || <span className="text-subtle">{t("course.noInstructor")}</span>}
            </div>
          </div>
        </div>
      </header>
      <CourseTabs
        base={`/courses/${offering.id}`}
        labels={{ materials: t("course.tab.materials"), assignments: t("course.tab.assignments"), quizzes: t("course.tab.quizzes"), grades: t("course.tab.grades") }}
      />
      <BackButton placement="course" />
      {children}
    </div>
  );
}
