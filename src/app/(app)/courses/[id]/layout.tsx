import { loadCourse } from "@/lib/course";
import { getI18n } from "@/lib/i18n/server";
import { PageHeader } from "@/components/PageHeader";
import { CourseTabs } from "./CourseTabs";

export default async function CourseLayout({ params, children }: { params: Promise<{ id: string }>; children: React.ReactNode }) {
  const { id } = await params;
  const { offering, instructors } = await loadCourse(id);
  const { t, term } = await getI18n();
  return (
    <div>
      <PageHeader
        eyebrow={`${offering.course.code} · ${term(offering.term)}${offering.section !== "1" ? ` · ${t("dash.section", { s: offering.section })}` : ""}`}
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
        labels={{ materials: t("course.tab.materials"), assignments: t("course.tab.assignments") }}
      />
      {children}
    </div>
  );
}
