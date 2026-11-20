// Shared chat profanity filter for both client and server.
// Masks offensive words in Russian and English (including common leetspeak and obfuscations)
// while keeping surrounding text, punctuation, emojis, and communication flow intact.

const CYRILLIC_CHAR_RE = /[а-яё]/i;

const LATIN_LEET_MAP: Record<string, string> = {
  '@': 'a',
  '4': 'a',
  '3': 'e',
  '0': 'o',
  '1': 'i',
  '!': 'i',
  '|': 'i',
  '$': 's',
  '5': 's',
  '7': 't',
  '8': 'b',
};

const CYRILLIC_LOOKALIKE_MAP: Record<string, string> = {
  'ё': 'е',
  'a': 'а',
  '@': 'а',
  '4': 'а',
  '6': 'б',
  'b': 'в',
  'c': 'с',
  '$': 'с',
  'e': 'е',
  '3': 'е',
  'h': 'н',
  'k': 'к',
  'm': 'м',
  'o': 'о',
  '0': 'о',
  'p': 'р',
  't': 'т',
  'u': 'у',
  'x': 'х',
  'y': 'у',
  '1': 'и',
  '!': 'и',
};

const LATIN_PROFANITY_PATTERNS: RegExp[] = [
  /fuck/,
  /^(?:fuk+|fck+|fvck+|phuck+)(?:ed|ing|er|ers|s|off)?$/,
  /^(?:bull|dip|bat|dog|horse|ape|no)?shit+(?:s|ty|tiest|tier|ted|ting|ter|head|heads|hole|holes|face|bag|bags|load|show|post|stain)?$/,
  /bitch/,
  /^(?:biatch|btch)(?:es|ing)?$/,
  /^(?:ass|asses|asshole|assholes|asswipe|asshat|dumbass|jackass|smartass|fatass|badass|kickass|hardass|arse|arsehole|arseholes)$/,
  /^(?:dick|dicks|dickhead|dickheads|dickwad|dickface)$/,
  /^(?:cock|cocks|cocksucker|cocksuckers|cockhead)$/,
  /^(?:pussy|pussies)$/,
  /^(?:cunt|cunts|cuntface)$/,
  /^(?:whore|whores|whoring|manwhore)$/,
  /^(?:slut|sluts|slutty|sluttish)$/,
  /^(?:bastard|bastards)$/,
  /(?:nigger|nigga|niggaz|niggas)/,
  /^(?:fag|fags|faggot|faggots|faggy|fagot|fagots)$/,
  /^(?:retard|retards|retarded)$/,
  /^(?:wank|wanks|wanker|wankers|wanking)$/,
  /^(?:twat|twats)$/,
  /^(?:bollocks)$/,
  /^(?:blowjob|handjob|rimjob|cumshot|jizz|dildo|boobs|titties)s?$/,
  // Common Latin transliteration of Russian profanity
  /^(?:cyka|suka|suki|suchka|blya+|blyad[a-z]*|blyat[a-z]*|bliat[a-z]*|pizd[a-z]*|hui+|huilo|huylo|huy+|xui+|xuy+|xyu+|ebat[a-z]*|ebal[a-z]*|eban[a-z]*|eblan[a-z]*|ebuch[a-z]*|zaeb[a-z]*|naeb[a-z]*|vyeb[a-z]*|uebok|ueban|dolboeb[a-z]*|pidor[a-z]*|pidar[a-z]*|pidoras[a-z]*|pidr|gandon[a-z]*|gondon[a-z]*|mudak[a-z]*|mudil[a-z]*|shluha|shlyuha|zalup[a-z]*|nahui|nahuy|pohui|pohuy)$/,
];

const LATIN_WILDCARD_PATTERNS: RegExp[] = [
  /^(?:f\*+c?k|fu\*+k|sh\*+t|s\*+it|b\*+tch|bi\*+ch|a\*+s|a\*+hole|c\*+nt|d\*+ck|p\*+ssy|wh\*+re)(?:s|ed|ing|er)?$/,
];

const CYRILLIC_PROFANITY_PATTERNS: RegExp[] = [
  /^(?:вы|про|не)?бля(?:$|[дтцмшщ][а-я]*|[еияю][а-я]*)/,
  /^(?:за|на|вы|по|про|до|от|раз|рас|пере|при|под|об|у|долбо|осто|мозго|руко|козло)?[ъь]?еб(?:а[лтнвсшч]|у[тчшн]|л[аиоуые]|н[уиеа]|и[тсш]|к[аиоу]|о[кв]|ы[вл]|$)/,
  /^(?:въ|съ|сь)еб[а-я]*/,
  /^(?:на|по|за|не|ни|о|а|об|до|с)?ху[йяеию][а-я]*/,
  /^хули$/,
  /пизд[а-я]*/,
  /^(?:сук[аи]|сучк[аиу]|сучар[а-я]*|сучий|сучь[яеи])$/,
  /^(?:пид[оа]?р[а-я]*|педик[а-я]*)$/,
  /^(?:гандон|гондон)[а-я]*/,
  /^(?:мудак|мудил|мудозвон|мудоеб)[а-я]*/,
  /^(?:шлюх|шлюш)[а-я]*/,
  /^залуп[а-я]*/,
  /^(?:на|по|за|вы|пере|под|до)?дроч[а-я]*/,
  /^(?:хер(?:ня|ни|ню|о[вм][а-я]*|ач[а-я]*|ли|$)|(?:на|по|за|ни|от|до)хер[а-я]*)/,
  /^дерьм[а-я]*/,
  /^(?:ублюд[оа]к[а-я]*|мраз[ьи][а-я]*|мразот[а-я]*)$/,
  /^(?:чмо|чмошник[а-я]*)$/,
];

const CYRILLIC_WILDCARD_PATTERNS: RegExp[] = [
  /^(?:х\*+[йяеи][а-я]*|х[у*]\*+[а-я]*|б\*+я[а-я]*|бл\*+[а-я]*|п\*+зд[а-я]*|пи\*+д[а-я]*|с\*+к[аи][а-я]*|су\*+[аи][а-я]*|е\*+[ауи][а-я]*|еб\*+[а-я]*|пид\*+р[а-я]*)$/,
];

function collapseRepeatedChars(word: string): string {
  return word.replace(/(.)\1+/g, '$1');
}

function normalizeLatinToken(raw: string): string {
  let out = '';
  for (const ch of raw.toLowerCase()) {
    out += LATIN_LEET_MAP[ch] ?? ch;
  }
  return out;
}

function normalizeCyrillicToken(raw: string): string {
  let out = '';
  for (const ch of raw.toLowerCase()) {
    out += CYRILLIC_LOOKALIKE_MAP[ch] ?? ch;
  }
  return out;
}

function matchesAny(candidate: string, patterns: RegExp[]): boolean {
  if (!candidate) return false;
  for (const re of patterns) {
    if (re.test(candidate)) return true;
  }
  return false;
}

function isProfaneToken(coreToken: string): boolean {
  if (!coreToken || /^\*+$/.test(coreToken)) return false;

  const lower = coreToken.toLowerCase();

  // Check explicit asterisk-censored tokens like "f*ck" or "х*й"
  if (lower.includes('*')) {
    if (matchesAny(lower, LATIN_WILDCARD_PATTERNS)) return true;
    if (CYRILLIC_CHAR_RE.test(lower) && matchesAny(lower.replace(/ё/g, 'е'), CYRILLIC_WILDCARD_PATTERNS)) {
      return true;
    }
  }

  // Strip internal obfuscation separators (dots, dashes, underscores, asterisks)
  const stripped = lower.replace(/[._\-*'`~]+/g, '');
  if (!stripped) return false;

  // Latin & transliteration checks
  const latinNorm = normalizeLatinToken(stripped);
  const latinCompact = latinNorm.replace(/[^a-z]/g, '');
  const latinDeduped = collapseRepeatedChars(latinCompact);

  if (
    matchesAny(latinCompact, LATIN_PROFANITY_PATTERNS) ||
    matchesAny(latinDeduped, LATIN_PROFANITY_PATTERNS)
  ) {
    return true;
  }

  // Cyrillic checks (activate when token contains Cyrillic letters to avoid English false positives)
  if (CYRILLIC_CHAR_RE.test(stripped)) {
    const cyrNorm = normalizeCyrillicToken(stripped);
    const cyrCompact = cyrNorm.replace(/[^а-я]/g, '');
    const cyrDeduped = collapseRepeatedChars(cyrCompact);

    if (
      matchesAny(cyrCompact, CYRILLIC_PROFANITY_PATTERNS) ||
      matchesAny(cyrDeduped, CYRILLIC_PROFANITY_PATTERNS)
    ) {
      return true;
    }
  }

  return false;
}

function maskToken(coreToken: string): string {
  return '*'.repeat(Math.max(3, coreToken.length));
}

const LEAD_PUNCT_RE = /^["'«(\[{.,;:!?…]+/;
const TRAIL_PUNCT_RE = /[.,;:!?…)"'»\]}]+$/;

// Matches spaced-out single-character runs like "f u c k" or "х у й"
const SPACED_LETTERS_RE =
  /(?<![\p{L}\p{N}])([\p{L}\p{N}@$!])(?:[ \t._\-*]+([\p{L}\p{N}@$!])){2,}(?![\p{L}\p{N}])/gu;

export function filterProfanity(text: string): string {
  if (!text || typeof text !== 'string') return '';

  // First catch spaced-out obfuscations (e.g. "f u c k", "х у й")
  const afterSpacedPass = text.replace(SPACED_LETTERS_RE, (match) => {
    const joined = match.replace(/[\s._\-*]+/g, '');
    if (isProfaneToken(joined)) {
      return '*'.repeat(Math.max(3, joined.length));
    }
    return match;
  });

  // Process segments separated by whitespace or common punctuation delimiters
  const parts = afterSpacedPass.split(/(\s+|[,;:?()[\]{}"'«»/]+)/);
  for (let i = 0; i < parts.length; i++) {
    const segment = parts[i];
    if (!segment || /^(?:\s+|[,;:?()[\]{}"'«»/]+)$/.test(segment)) continue;

    const leadMatch = segment.match(LEAD_PUNCT_RE);
    const lead = leadMatch ? leadMatch[0] : '';
    const withoutLead = segment.slice(lead.length);

    const trailMatch = withoutLead.match(TRAIL_PUNCT_RE);
    const trail = trailMatch ? trailMatch[0] : '';
    const core = trail ? withoutLead.slice(0, withoutLead.length - trail.length) : withoutLead;

    if (core && isProfaneToken(core)) {
      parts[i] = `${lead}${maskToken(core)}${trail}`;
    }
  }

  return parts.join('');
}

export function containsProfanity(text: string): boolean {
  if (!text || typeof text !== 'string') return false;
  return filterProfanity(text) !== text;
}
