"use client";

import { useActionState, useState } from "react";
import { KeepForm } from "@/components/KeepForm";
import { FormMessage } from "@/components/FormMessage";
import { SubmitButton } from "@/components/SubmitButton";
import { FileDropzone } from "@/components/FileDropzone";
import { useI18n } from "@/lib/i18n/client";
import { BUNDLED_LOGOS } from "@/lib/departments";
import { saveDepartmentAction } from "../actions";

export type DivisionOption = { id: string; label: string; color: string | null; logo: string | null };
export type DepartmentDefaults = {
  code: string;
  name: string;
  nameTh: string;
  parentId: string;
  color: string | null;
  logoUrl: string | null;
  /** URL of the current uploaded logo, if any. */
  uploadedLogo: string | null;
};

const EMPTY: DepartmentDefaults = { code: "", name: "", nameTh: "", parentId: "", color: null, logoUrl: null, uploadedLogo: null };

export function DepartmentForm({
  id = null,
  defaults = EMPTY,
  divisions,
}: {
  id?: string | null;
  defaults?: DepartmentDefaults;
  divisions: DivisionOption[];
}) {
  const [state, action, pending] = useActionState(saveDepartmentAction.bind(null, id), undefined);
  const { t } = useI18n();
  const [parentId, setParentId] = useState(defaults.parentId);
  const [name, setName] = useState(defaults.name);
  const [inherit, setInherit] = useState(!!defaults.parentId && !defaults.color);
  const [color, setColor] = useState(defaults.color ?? "#5b8cff");
  const [logo, setLogo] = useState(defaults.uploadedLogo ? "keep" : (defaults.logoUrl ?? ""));

  const parent = divisions.find((d) => d.id === parentId);
  const isDept = !!parent;
  const shownColor = isDept && inherit ? (parent?.color ?? "#5b8cff") : color;
  const shownLogo =
    logo === "keep" ? defaults.uploadedLogo : logo === "upload" ? null : logo || (isDept ? (parent?.logo ?? null) : null);

  return (
    <KeepForm action={action} pending={pending} state={state} closeOnSuccess className="space-y-4">
      <div>
        <label className="label" htmlFor="dep-parent">{t("dep.parent")}</label>
        <select id="dep-parent" name="parentId" className="input" value={parentId} onChange={(e) => setParentId(e.target.value)}>
          <option value="">{t("dep.isDivision")}</option>
          {divisions.filter((d) => d.id !== id).map((d) => <option key={d.id} value={d.id}>{d.label}</option>)}
        </select>
      </div>
      <div className="grid grid-cols-[8rem_1fr] gap-3">
        <div>
          <label className="label" htmlFor="dep-code">{t("dep.code")}</label>
          <input id="dep-code" name="code" className="input font-mono uppercase" defaultValue={defaults.code} placeholder="CS" required />
        </div>
        <div>
          <label className="label" htmlFor="dep-name">{t("dep.name")}</label>
          <input id="dep-name" name="name" className="input" value={name} onChange={(e) => setName(e.target.value)} required />
        </div>
      </div>
      <div>
        <label className="label" htmlFor="dep-nameTh">{t("dep.nameTh")}</label>
        <input id="dep-nameTh" name="nameTh" className="input" defaultValue={defaults.nameTh} />
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <span className="label">{t("dep.color")}</span>
          {isDept && (
            <label className="mb-2 flex items-center gap-2 text-sm text-muted">
              <input type="checkbox" name="inheritColor" checked={inherit} onChange={(e) => setInherit(e.target.checked)} className="accent-accent" />
              {t("dep.inheritColor")}
            </label>
          )}
          {!(isDept && inherit) && (
            <div className="flex items-center gap-2">
              <input type="color" name="color" value={color} onChange={(e) => setColor(e.target.value)} className="h-9 w-12 cursor-pointer rounded-md border border-border bg-transparent" aria-label={t("dep.color")} />
              <input value={color} onChange={(e) => setColor(e.target.value)} className="input h-9 w-28 font-mono text-xs" aria-label={`${t("dep.color")} (hex)`} />
            </div>
          )}
        </div>
        <div>
          <label className="label" htmlFor="dep-logo">{t("dep.logo")}</label>
          <select id="dep-logo" name="logo" className="input" value={logo} onChange={(e) => setLogo(e.target.value)}>
            <option value="">{t(isDept ? "dep.logoInherit" : "dep.logoNone")}</option>
            {BUNDLED_LOGOS.map((l) => <option key={l.url} value={l.url}>{l.label}</option>)}
            {defaults.uploadedLogo && <option value="keep">{t("dep.logoKeep")}</option>}
            <option value="upload">{t("dep.logoUpload")}</option>
          </select>
        </div>
      </div>
      {logo === "upload" && (
        <div>
          <FileDropzone id="dep-logo-file" name="logoFile" accept="image/png,image/jpeg,image/webp" required />
          <p className="mt-1.5 text-xs text-subtle">{t("dep.logoHint")}</p>
        </div>
      )}

      <div>
        <span className="label">{t("dep.preview")}</span>
        <div className="cc flex items-center gap-3 rounded-xl border border-border bg-surface-2 p-3" style={{ ["--cc" as string]: shownColor }} data-testid="dep-preview">
          {shownLogo ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={shownLogo} alt="" className="h-10 w-auto max-w-[4.5rem] object-contain" />
          ) : (
            <span className="cc-tint grid h-10 w-10 place-items-center rounded-lg font-mono text-xs font-bold">{(defaults.code || "··").slice(0, 3)}</span>
          )}
          <span className="cc-text text-sm font-semibold">{name || "—"}</span>
          <span className="cc-bar ml-auto h-6 w-1.5 rounded" />
        </div>
      </div>

      <FormMessage state={state} />
      <SubmitButton>{t("es.save")}</SubmitButton>
    </KeepForm>
  );
}
