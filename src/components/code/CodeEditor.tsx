"use client";

import { useEffect, useRef } from "react";
import { fileMode } from "@/lib/code";

/**
 * CodeMirror 6 editor, loaded on demand (only pages with code questions pay for it).
 * Colours come from the app's theme tokens, so it follows light/dark mode.
 */
export function CodeEditor({
  value,
  onChange,
  fileName,
  readOnly = false,
  minHeight = "12rem",
  label,
}: {
  value: string;
  onChange?: (v: string) => void;
  fileName: string;
  readOnly?: boolean;
  minHeight?: string;
  label: string;
}) {
  const host = useRef<HTMLDivElement>(null);
  const view = useRef<import("@codemirror/view").EditorView | null>(null);
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;

  useEffect(() => {
    let disposed = false;
    (async () => {
      const [{ EditorView, keymap, lineNumbers, highlightActiveLine, highlightActiveLineGutter, drawSelection }, { EditorState }, cmds, lang] =
        await Promise.all([import("@codemirror/view"), import("@codemirror/state"), import("@codemirror/commands"), import("@codemirror/language")]);
      const { tags } = await import("@lezer/highlight");
      const v = (name: string) => `var(--code-${name})`;
      const highlight = lang.HighlightStyle.define([
        { tag: [tags.keyword, tags.controlKeyword, tags.operatorKeyword, tags.definitionKeyword, tags.moduleKeyword], color: v("keyword") },
        { tag: [tags.string, tags.special(tags.string), tags.regexp], color: v("string") },
        { tag: [tags.number, tags.bool, tags.null, tags.atom], color: v("number") },
        { tag: [tags.comment, tags.lineComment, tags.blockComment], color: v("comment"), fontStyle: "italic" },
        { tag: [tags.function(tags.variableName), tags.function(tags.propertyName)], color: v("function") },
        { tag: [tags.definition(tags.variableName), tags.className, tags.typeName], color: v("type") },
        { tag: [tags.tagName, tags.angleBracket], color: v("tag") },
        { tag: [tags.attributeName, tags.propertyName], color: v("attr") },
      ]);
      const mode = fileMode(fileName);
      const language =
        mode === "python"
          ? (await import("@codemirror/lang-python")).python()
          : mode === "html"
            ? (await import("@codemirror/lang-html")).html()
            : mode === "css"
              ? (await import("@codemirror/lang-css")).css()
              : (await import("@codemirror/lang-javascript")).javascript();
      if (disposed || !host.current) return;

      const theme = EditorView.theme({
        "&": { backgroundColor: "var(--color-surface-2)", color: "var(--color-fg)", fontSize: "13px", borderRadius: "0.5rem", minHeight },
        "&.cm-focused": { outline: "2px solid color-mix(in srgb, var(--color-accent) 35%, transparent)" },
        ".cm-scroller": { fontFamily: "var(--font-geist-mono), ui-monospace, monospace", lineHeight: "1.6", minHeight },
        ".cm-content": { caretColor: "var(--color-accent)" },
        ".cm-gutters": { backgroundColor: "transparent", color: "var(--color-subtle)", border: "none" },
        ".cm-activeLine, .cm-activeLineGutter": { backgroundColor: "color-mix(in srgb, var(--color-accent) 7%, transparent)" },
        "&.cm-focused .cm-selectionBackground, .cm-selectionBackground, ::selection": {
          backgroundColor: "color-mix(in srgb, var(--color-accent) 30%, transparent) !important",
        },
      });

      view.current = new EditorView({
        parent: host.current,
        state: EditorState.create({
          doc: value,
          extensions: [
            lineNumbers(),
            highlightActiveLineGutter(),
            highlightActiveLine(),
            drawSelection(),
            cmds.history(),
            lang.indentOnInput(),
            lang.bracketMatching(),
            lang.syntaxHighlighting(highlight),
            keymap.of([cmds.indentWithTab, ...cmds.defaultKeymap, ...cmds.historyKeymap]),
            EditorState.tabSize.of(4),
            lang.indentUnit.of("    "),
            language,
            theme,
            EditorView.lineWrapping,
            EditorState.readOnly.of(readOnly),
            EditorView.editable.of(!readOnly),
            EditorView.contentAttributes.of({ "aria-label": label, spellcheck: "false", autocorrect: "off", autocapitalize: "off" }),
            EditorView.updateListener.of((u) => {
              if (u.docChanged) onChangeRef.current?.(u.state.doc.toString());
            }),
          ],
        }),
      });
    })();
    return () => {
      disposed = true;
      view.current?.destroy();
      view.current = null;
    };
    // The editor owns its text after mounting; remount (key) to load different content.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fileName, readOnly]);

  return (
    <div ref={host} className="code-editor min-w-0 select-text" style={{ minHeight }} data-testid="code-editor" data-file={fileName} />
  );
}
