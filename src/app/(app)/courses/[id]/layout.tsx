import { loadCourse } from "@/lib/course";
import { db } from "@/lib/db";
import { courseTheme, deptLogo } from "@/lib/departments";
import { getI18n } from "@/lib/i18n/server";
import { PageHeader } from "@/components/PageHeader";
import { CourseTabs } from "./CourseTabs";

export default async function CourseLayout({ params, children }: { params: Promise<{ id: string }>; children: React.ReactNode }) {
  const { id } = await params;
  const { offering, instructors } = await loadCourse(id);
  const { t, term, lang } = await getI18n();
  const dept = offering.course.department;
  const theme = courseTheme(offering.course.code, dept);
  const logo = deptLogo(dept);
  const deptName = (d: { name: string; nameTh: string | null }) => (lang === "th" && d.nameTh ? d.nameTh : d.name);
  const multiSection = (await db.courseOffering.count({ where: { courseId: offering.courseId, termId: offering.termId } })) > 1;
  return (
    <div className={theme.className} style={theme.style}>
      {dept && (
        <div className="mb-3 flex items-center gap-2 text-xs text-muted" data-testid="course-dept">
          {logo && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={logo} alt="" className="h-6 w-auto max-w-12 shrink-0 object-contain" />
          )}
          {/* One line of text that wraps naturally on narrow screens. */}
          <span className="min-w-0">
            {deptName(dept)}
            {dept.parent && <span className="text-subtle"> · {deptName(dept.parent)}</span>}
          </span>
        </div>
      )}
      <PageHeader
        eyebrow={<span className="cc-text">{`${offering.course.code} · ${term(offering.term)}${multiSection ? ` · ${t("dash.section", { s: offering.section })}` : ""}`}</span>}
        title={offering.course.title}
        description={
          <>
            {offering.course.titleTh && <div>{offering.course.titleTh}</div>}
            <div className="mt-1 text-subtle">{instructors.map((e) => e.user.fullName).join(", ") || t("course.noInstructor")}</div>
          </>
        }
      />
      <CourseTabs
        base={`/courses/${offering.id}`}
        labels={{ materials: t("course.tab.materials"), assignments: t("course.tab.assignments"), quizzes: t("course.tab.quizzes"), grades: t("course.tab.grades") }}
      />
      {children}
    </div>
  );
}
