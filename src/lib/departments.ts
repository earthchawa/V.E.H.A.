import type { CSSProperties } from "react";
import { courseColor } from "./course-color";

/** Logos shipped in /public/logos (division badges supplied by the academy). */
export const BUNDLED_LOGOS = [
  { url: "/logos/ae.webp", label: "Aeronautical Engineering / วิศวกรรมอากาศยาน" },
  { url: "/logos/me.webp", label: "Mechanical Engineering / วิศวกรรมเครื่องกล" },
  { url: "/logos/ee.webp", label: "Electrical Engineering / วิศวกรรมไฟฟ้า" },
  { url: "/logos/ce.webp", label: "Civil Engineering / วิศวกรรมโยธา" },
  { url: "/logos/iea.webp", label: "Industrial Eng. & Aviation Management / วิศวกรรมอุตสาหการและการจัดการการบิน" },
  { url: "/logos/mc.webp", label: "Mathematics & Computer Science / คณิตศาสตร์และคอมพิวเตอร์" },
  { url: "/logos/ms.webp", label: "Military & Aerospace Materials Science / วัสดุศาสตร์ทางการทหารและอากาศยาน" },
  { url: "/logos/eda.webp", label: "Education Administration / กองอำนวยการศึกษา" },
  { url: "/logos/hs.webp", label: "Humanities & Social Sciences / มนุษยศาสตร์และสังคมศาสตร์" },
] as const;

/**
 * The academy's departments (กองวิชา), with colours taken from their badges
 * (Mathematics and Computer Science and Computer Science are grey by the owner's request).
 */
export const ACADEMY_DIVISIONS = [
  { code: "AE", name: "Department of Aeronautical Engineering", nameTh: "กองวิชาวิศวกรรมอากาศยาน", color: "#e5b80b", logoUrl: "/logos/ae.webp" },
  { code: "ME", name: "Department of Mechanical Engineering", nameTh: "กองวิชาวิศวกรรมเครื่องกล", color: "#7c3aed", logoUrl: "/logos/me.webp" },
  { code: "EE", name: "Department of Electrical Engineering", nameTh: "กองวิชาวิศวกรรมไฟฟ้า", color: "#3b5bdb", logoUrl: "/logos/ee.webp" },
  { code: "CE", name: "Department of Civil Engineering", nameTh: "กองวิชาวิศวกรรมโยธา", color: "#6272a4", logoUrl: "/logos/ce.webp" },
  { code: "IEA", name: "Department of Industrial Engineering and Aviation Management", nameTh: "กองวิชาวิศวกรรมอุตสาหการและการจัดการการบิน", color: "#e8507f", logoUrl: "/logos/iea.webp" },
  { code: "MC", name: "Department of Mathematics and Computer Science", nameTh: "กองวิชาคณิตศาสตร์และคอมพิวเตอร์", color: "#9ca3af", logoUrl: "/logos/mc.webp" },
  { code: "CS", name: "Department of Computer Science", nameTh: "กองวิชาวิทยาการคอมพิวเตอร์", color: "#9ca3af", logoUrl: "/logos/mc.webp" },
  { code: "MS", name: "Department of Military and Aerospace Materials Science", nameTh: "กองวิชาวัสดุศาสตร์ทางการทหารและอากาศยาน", color: "#5fae5f", logoUrl: "/logos/ms.webp" },
  { code: "EDA", name: "Department of Education Administration", nameTh: "กองอำนวยการศึกษา", color: "#0e7490", logoUrl: "/logos/eda.webp" },
  { code: "HS", name: "Department of Humanities and Social Sciences", nameTh: "กองวิชามนุษยศาสตร์และสังคมศาสตร์", color: "#12a9de", logoUrl: "/logos/hs.webp" },
] as const;

/** Subject areas (สาขาวิชา) inside a department. They use their department's logo and colour. */
export const ACADEMY_SUBJECT_AREAS = [
  { parent: "MC", code: "MA", name: "Mathematics", nameTh: "สาขาวิชาคณิตศาสตร์" },
  { parent: "MS", code: "PH", name: "Physics", nameTh: "สาขาวิชาฟิสิกส์" },
  { parent: "MS", code: "CH", name: "Chemistry", nameTh: "สาขาวิชาเคมี" },
] as const;

export const isHexColor = (v: string) => /^#[0-9a-f]{6}$/i.test(v);

type Branding = { id: string; color: string | null; logoUrl: string | null; logoKey: string | null };
export type DeptBranding = Branding & { parent?: Branding | null };

/** A department's own colour, else its division's. */
export function deptColor(d: DeptBranding | null | undefined): string | null {
  return d?.color ?? d?.parent?.color ?? null;
}

function ownLogo(d: Branding | null | undefined): string | null {
  if (!d) return null;
  if (d.logoKey) return `/api/department-logo/${d.id}?v=${d.logoKey.slice(0, 8)}`;
  return d.logoUrl;
}

/** A department's own logo, else its division's. */
export function deptLogo(d: DeptBranding | null | undefined): string | null {
  return ownLogo(d) ?? ownLogo(d?.parent);
}

/**
 * Colour theme for a course: its department's colour when set, otherwise a stable colour from the
 * course code. Use as `<div className={th.className} style={th.style}>` with the `cc-*` helpers inside.
 */
export function courseTheme(code: string, dept?: DeptBranding | null): { className: string; style?: CSSProperties } {
  const color = deptColor(dept);
  if (color) return { className: "cc", style: { ["--cc" as string]: color } as CSSProperties };
  return { className: `cc cc-${courseColor(code)}` };
}
