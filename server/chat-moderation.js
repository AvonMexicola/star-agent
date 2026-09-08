/** Explicit English-first policy. These offensive terms are enforcement fixtures,
 * never room announcements. Identity words and ordinary profanity are not rules.
 * Operators review this file and its regressions when changing policy. */
export const CHAT_LIMIT = 400;
export const CHAT_BYTE_LIMIT = 1600;
export const CHAT_POLICY = Object.freeze({
  version: 1,
  severeSlurs: Object.freeze(['nigger', 'niggers', 'faggot', 'faggots', 'kike', 'kikes', 'wetback', 'wetbacks', 'raghead', 'ragheads']),
  promotion: Object.freeze(['heil hitler', 'sieg heil', 'hitler was right', 'white power', 'join the nazis', 'join the neo nazis']),
  violentHate: Object.freeze(['gas the jews', 'kill all jews', 'kill all gay people', 'kill all gays', 'kill all muslims', 'exterminate the jews']),
});

// NFKC handles full-width text; the small confusable table covers tested Cyrillic,
// Greek and leetspeak substitutions. This is bounded normalization, not language AI.
const substitutions = { '0': 'o', '1': 'i', '3': 'e', '4': 'a', '5': 's', '7': 't', '@': 'a', '$': 's', '!': 'i', '|': 'i',
  'а': 'a', 'е': 'e', 'і': 'i', 'ӏ': 'i', 'о': 'o', 'р': 'p', 'с': 'c', 'х': 'x', 'у': 'y', 'к': 'k', 'ν': 'v', 'ι': 'i', 'ο': 'o', 'α': 'a' };
function normalized(value) {
  return value.normalize('NFKD').toLowerCase().replace(/[\p{Cf}\p{M}]/gu, '')
    .replace(/[013457@$аеіӏорсхукνιοα]/gu, character => substitutions[character])
    .replace(/(?<=[a-z])[!|](?=[a-z])/gu, character => substitutions[character]);
}
function pattern(term) {
  // Fixed bounded separators catch clear letter-spacing/asterisk evasion without
  // deleting all word boundaries (which would join unrelated innocent words).
  return new RegExp(`(?<![a-z0-9])${[...term].map(character => character === ' ' ? '[\\s._*~\\-]{1,4}' : character).join('[\\s._*~\\-]{0,3}')}(?![a-z0-9])`, 'u');
}
function clearReference(text, match) {
  const before = text.slice(Math.max(0, match.index - 90), match.index);
  const after = text.slice(match.index + match[0].length, match.index + match[0].length + 65);
  // References are still withheld, never broadcast. This only avoids an automatic
  // kick for clearly quoted/reporting/condemning context; it is not an allowlist.
  return /["“'‘]\s*$/.test(before) && /^\s*["”'’]/.test(after)
    || /\b(?:reported|reporting|report|said|saying|called|quoted|quoting|slur|slogan|condemn|condemning|reject|rejecting)\b.{0,60}$/u.test(before)
    || /^.{0,35}\b(?:is|was|are)\s+(?:racist|hateful|wrong|unacceptable|a slur)\b/u.test(after);
}

export function createChatModerator(policy = CHAT_POLICY) {
  const entries = ['severeSlurs', 'promotion', 'violentHate'].flatMap(category => {
    if (!Array.isArray(policy[category]) || policy[category].length > 64) throw new TypeError('Invalid chat policy.');
    return policy[category].map(term => {
      if (typeof term !== 'string' || !/^[a-z ]{3,64}$/.test(term)) throw new TypeError('Policy rules must be bounded lowercase terms.');
      return { category, term, expression: pattern(term) };
    });
  });
  return input => {
    if (typeof input !== 'string' || input.length > CHAT_BYTE_LIMIT || Buffer.byteLength(input, 'utf8') > CHAT_BYTE_LIMIT || [...input].length > CHAT_LIMIT) {
      return { allowed: false, kick: false, reason: `Messages may contain up to ${CHAT_LIMIT} characters.` };
    }
    // Single-line plain text. Strip invisible controls from display as well as
    // moderation, so bidi controls cannot disguise the visible sender/message.
    const text = input.replace(/[\p{Cc}\p{Cf}]/gu, character => /[\t\n\r]/.test(character) ? ' ' : '').trim();
    if (!text || !text.isWellFormed()) return { allowed: false, kick: false, reason: 'Enter a text message.' };
    const check = normalized(text);
    let reference = false;
    for (const { category, term, expression } of entries) {
      // Check every occurrence: a quoted/reporting term must not shelter a second
      // independently directed abusive phrase elsewhere in the same message.
      const scanner = new RegExp(expression.source, 'gu');
      for (const match of check.matchAll(scanner)) {
        if (term === 'white power' && /^\s+(?:cable|supply|connector|socket|unit|bank|cell|wire)s?\b/u.test(check.slice(match.index + match[0].length))) continue;
        if (clearReference(check, match)) { reference = true; continue; }
        return { allowed: false, kick: true, category, reason: 'Removed from this session for severe hateful abuse.' };
      }
    }
    if (reference) return { allowed: false, kick: false, reason: 'Message not sent. Describe reported abuse without repeating the severe term or slogan.' };
    return { allowed: true, kick: false, text };
  };
}

export const moderateChat = createChatModerator();
