/** A token with its character range in the original string. */
export type Token = { v: string; s: number; e: number };

const segmenter = new Intl.Segmenter(["th", "en"], { granularity: "word" });

/**
 * Prose: word tokens (Thai is segmented with ICU), lower-cased, punctuation dropped,
 * so small edits to spacing or punctuation do not hide copied text.
 */
export function tokenizeText(text: string, offset = 0): Token[] {
  const out: Token[] = [];
  for (const seg of segmenter.segment(text)) {
    if (!seg.isWordLike) continue;
    out.push({ v: seg.segment.toLowerCase(), s: offset + seg.index, e: offset + seg.index + seg.segment.length });
  }
  return out;
}

const KEYWORDS = new Set(
  (
    "and as assert async await break case catch char class const continue def default del do double elif else " +
    "enum except export extends false final finally float for from func function global go if implements import " +
    "in instanceof int interface is lambda let long new nil none nonlocal not null or package pass print private " +
    "protected public raise return self short static string struct super switch this throw throws true try type " +
    "typeof var void while with yield bool boolean byte include define using namespace std cout cin endl printf " +
    "scanf main len range list dict set tuple str input open map filter sorted append"
  ).split(" "),
);

// Order matters: comments and strings before operators.
const CODE_RE =
  /(\/\/[^\n]*|#[^\n]*|\/\*[\s\S]*?\*\/|"""[\s\S]*?"""|'''[\s\S]*?''')|("(?:\\.|[^"\\\n])*"|'(?:\\.|[^'\\\n])*'|`(?:\\.|[^`\\])*`)|([A-Za-z_฀-๿][\w฀-๿]*)|(\d[\d._]*(?:[eE][+-]?\d+)?)|(==|!=|<=|>=|&&|\|\||\+\+|--|->|=>|::|\*\*|<<|>>|[+\-*/%=<>!&|^~?:;,.(){}\[\]])/g;

/**
 * Source code: comments dropped, identifiers → "ID", literals → "STR"/"NUM", keywords kept.
 * Renaming variables or editing comments therefore does not change the token stream.
 */
export function tokenizeCode(text: string, offset = 0): Token[] {
  const out: Token[] = [];
  for (const m of text.matchAll(CODE_RE)) {
    const [whole, comment, str, ident, num] = m;
    if (comment) continue;
    const s = offset + m.index!;
    const e = s + whole.length;
    const v = str ? "STR" : ident ? (KEYWORDS.has(ident.toLowerCase()) ? ident.toLowerCase() : "ID") : num ? "NUM" : whole;
    out.push({ v, s, e });
  }
  return out;
}
