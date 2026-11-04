import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: { default: "NKRAFA Classroom", template: "%s · NKRAFA Classroom" },
  description: "ห้องเรียนออนไลน์ โรงเรียนนายเรืออากาศนวมินทกษัตริยาธิราช",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="th">
      <body>{children}</body>
    </html>
  );
}
