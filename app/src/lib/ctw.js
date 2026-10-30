// Complete the Words generator — ETS rule (guide §5.2):
// first sentence intact; then every second word loses its second half:
// keep floor(n/2) letters, blank ceil(n/2); exactly `gaps` damaged words; rest intact.
// One-letter words and tokens with digits are skipped (they cannot be split) and do not count
// toward the alternation, so the pattern stays "every second splittable word".

const SENT_END = /([.!?])\s+(?=[A-Z])/;

export function makeCtw(text, gaps = 10) {
  const m = text.match(SENT_END);
  if (!m) throw new Error('CtW: text needs at least two sentences');
  const cut = m.index + 1;
  const first = text.slice(0, cut);
  const rest = text.slice(cut);

  const tokens = rest.split(/(\s+)/);           // keep whitespace tokens
  const out = [];
  let candidate = 0, made = 0;
  for (const tok of tokens) {
    if (made >= gaps || /^\s*$/.test(tok)) { out.push({ t: tok }); continue; }
    const mm = tok.match(/^([^A-Za-z]*)([A-Za-z][A-Za-z'’-]*[A-Za-z]|[A-Za-z])([^A-Za-z]*)$/);
    const word = mm && mm[2];
    if (!word || word.length < 2 || /\d/.test(tok) || /['’-]/.test(word)) { out.push({ t: tok }); continue; }
    candidate++;
    if (candidate % 2 === 0) {
      const keep = Math.floor(word.length / 2);
      out.push({ pre: mm[1], keep: word.slice(0, keep), miss: word.slice(keep), post: mm[3], gap: made++ });
    } else out.push({ t: tok });
  }
  if (made < gaps) throw new Error(`CtW: only ${made} gaps possible, need ${gaps}`);
  return { first, parts: out, gaps: made };
}

/** exact-spelling check, case-insensitive (ETS scores exact spelling) */
export const ctwCorrect = (part, typed) => (typed || '').toLowerCase() === part.miss.toLowerCase();
