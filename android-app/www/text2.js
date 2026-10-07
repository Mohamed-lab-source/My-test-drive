/* ======================================================================
 * Jarvis 4.0 — pack 4: Text, encoding & developer tools (offline)
 * Loads after datetime2.js.
 * ====================================================================== */

const x2req = (t, what) => { const s = String(t == null ? "" : t); if (!s.trim()) throw new Error(what || "Give me some text."); return s; };
async function x2copy(t) { try { await Clipboard.write({ string: String(t) }); } catch {} }

/* ---- Text ------------------------------------------------------------------- */
function charCount({ text } = {}) { const s = x2req(text); return { characters: s.length, charactersNoSpaces: s.replace(/\s/g, "").length, words: (s.match(/\S+/g) || []).length, lines: s.split("\n").length }; }
function reverseText({ text } = {}) { const r = [...x2req(text)].reverse().join(""); x2copy(r); return { result: r }; }
function slugify({ text } = {}) { const r = x2req(text).toLowerCase().trim().replace(/[^\w\s-]/g, "").replace(/[\s_-]+/g, "-").replace(/^-+|-+$/g, ""); x2copy(r); return { slug: r }; }
const X2_LOREM = "lorem ipsum dolor sit amet consectetur adipiscing elit sed do eiusmod tempor incididunt ut labore et dolore magna aliqua enim ad minim veniam quis nostrud exercitation ullamco laboris nisi aliquip ex ea commodo consequat".split(" ");
function loremIpsum({ paragraphs, words } = {}) {
  if (words) { const n = Math.round(clampNum(words, 1, 500, 30)); const out = Array.from({ length: n }, (_, i) => X2_LOREM[i % X2_LOREM.length]).join(" "); return { text: out[0].toUpperCase() + out.slice(1) + "." }; }
  const p = Math.round(clampNum(paragraphs, 1, 20, 3));
  const para = () => { const n = 30 + Math.floor(Math.random() * 30); const w = Array.from({ length: n }, () => X2_LOREM[Math.floor(Math.random() * X2_LOREM.length)]); const s = w.join(" "); return s[0].toUpperCase() + s.slice(1) + "."; };
  return { text: Array.from({ length: p }, para).join("\n\n") };
}
function countOccurrences({ text, term } = {}) { const s = x2req(text); const t = x2req(term, "What should I count?"); return { term: t, count: s.split(t).length - 1 }; }
function findReplace({ text, find, replace, all } = {}) { const s = x2req(text); const f = x2req(find, "What should I find?"); const r = all === false ? s.replace(f, replace || "") : s.split(f).join(replace || ""); x2copy(r); return { result: r, replaced: s.split(f).length - 1 }; }
function removeSpaces({ text, mode } = {}) { const s = x2req(text); const r = /all/i.test(mode || "") ? s.replace(/\s+/g, "") : s.replace(/[ \t]+/g, " ").replace(/\s+\n/g, "\n").trim(); x2copy(r); return { result: r }; }
function extractEmails({ text } = {}) { const m = x2req(text).match(/[\w.+-]+@[\w-]+\.[\w.-]+/g) || []; return { emails: [...new Set(m)], count: new Set(m).size }; }
function extractUrls({ text } = {}) { const m = x2req(text).match(/https?:\/\/[^\s<>"')]+/g) || []; return { urls: [...new Set(m)], count: new Set(m).size }; }
function extractNumbers({ text } = {}) { const m = (x2req(text).match(/-?\d+(?:\.\d+)?/g) || []).map(Number); return { numbers: m, count: m.length, sum: c2r(m.reduce((s, n) => s + n, 0), 4) }; }
function initialsOf({ text } = {}) { const r = x2req(text).trim().split(/\s+/).map(w => w[0]).join("").toUpperCase(); return { initials: r }; }
function acronymOf({ text } = {}) { const r = x2req(text).trim().split(/\s+/).filter(w => !/^(a|an|the|of|and|or|for|to|in|on|at)$/i.test(w)).map(w => w[0].toUpperCase()).join(""); return { acronym: r }; }
function pigLatin({ text } = {}) {
  const r = x2req(text).replace(/\b([a-zA-Z]+)\b/g, w => { const m = w.match(/^[^aeiouAEIOU]+/); return m ? w.slice(m[0].length) + m[0].toLowerCase() + "ay" : w + "way"; });
  x2copy(r); return { result: r };
}
function rot13({ text } = {}) { const r = x2req(text).replace(/[a-z]/gi, c => String.fromCharCode((c <= "Z" ? 90 : 122) >= (c.charCodeAt(0) + 13) ? c.charCodeAt(0) + 13 : c.charCodeAt(0) - 13)); x2copy(r); return { result: r }; }
const X2_MORSE = { a: ".-", b: "-...", c: "-.-.", d: "-..", e: ".", f: "..-.", g: "--.", h: "....", i: "..", j: ".---", k: "-.-", l: ".-..", m: "--", n: "-.", o: "---", p: ".--.", q: "--.-", r: ".-.", s: "...", t: "-", u: "..-", v: "...-", w: ".--", x: "-..-", y: "-.--", z: "--..", 0: "-----", 1: ".----", 2: "..---", 3: "...--", 4: "....-", 5: ".....", 6: "-....", 7: "--...", 8: "---..", 9: "----." };
function morseEncode({ text } = {}) { const r = x2req(text).toLowerCase().split("").map(c => c === " " ? "/" : (X2_MORSE[c] || "")).filter(Boolean).join(" "); x2copy(r); return { morse: r }; }
function morseDecode({ morse } = {}) { const rev = Object.fromEntries(Object.entries(X2_MORSE).map(([k, v]) => [v, k])); const r = x2req(morse, "Give me Morse code.").trim().split(/\s+/).map(c => c === "/" ? " " : (rev[c] || "")).join(""); x2copy(r); return { text: r }; }
function textToBinary({ text } = {}) { const r = x2req(text).split("").map(c => c.charCodeAt(0).toString(2).padStart(8, "0")).join(" "); x2copy(r); return { binary: r }; }
function binaryToText({ binary } = {}) { const r = x2req(binary, "Give me binary.").trim().split(/\s+/).map(b => String.fromCharCode(parseInt(b, 2))).join(""); x2copy(r); return { text: r }; }
const X2_NATO = { a: "Alpha", b: "Bravo", c: "Charlie", d: "Delta", e: "Echo", f: "Foxtrot", g: "Golf", h: "Hotel", i: "India", j: "Juliett", k: "Kilo", l: "Lima", m: "Mike", n: "November", o: "Oscar", p: "Papa", q: "Quebec", r: "Romeo", s: "Sierra", t: "Tango", u: "Uniform", v: "Victor", w: "Whiskey", x: "X-ray", y: "Yankee", z: "Zulu" };
function natoSpell({ text } = {}) { const r = x2req(text).toLowerCase().split("").map(c => /[a-z]/.test(c) ? X2_NATO[c] : /\d/.test(c) ? c : c === " " ? "(space)" : "").filter(Boolean).join(" "); return { phonetic: r }; }
function palindromeCheck({ text } = {}) { const clean = x2req(text).toLowerCase().replace(/[^a-z0-9]/g, ""); return { isPalindrome: clean.length > 0 && clean === [...clean].reverse().join(""), cleaned: clean }; }
function isAnagram({ a, b } = {}) { const norm = s => x2req(s).toLowerCase().replace(/[^a-z0-9]/g, "").split("").sort().join(""); return { anagram: norm(a) === norm(b) && norm(a).length > 0 }; }
function vowelCount({ text } = {}) { const s = x2req(text); const v = (s.match(/[aeiou]/gi) || []).length; return { vowels: v, consonants: (s.match(/[b-df-hj-np-tv-z]/gi) || []).length }; }
function uniqueWords({ text } = {}) { const w = x2req(text).toLowerCase().match(/\b[\w']+\b/g) || []; return { total: w.length, unique: new Set(w).size }; }
function longestWord({ text } = {}) { const w = x2req(text).match(/\b[\w']+\b/g) || []; const l = w.reduce((a, b) => b.length > a.length ? b : a, ""); return { longestWord: l, length: l.length }; }
function repeatText({ text, times } = {}) { const n = Math.round(clampNum(times, 1, 1000, 2)); const r = x2req(text).repeat(n); x2copy(r); return { result: r.slice(0, 2000), count: n }; }
function truncateText({ text, length } = {}) { const s = x2req(text); const n = Math.round(clampNum(length, 1, 10000, 100)); return { result: s.length <= n ? s : s.slice(0, n).trimEnd() + "…" }; }
function countLines({ text } = {}) { const s = x2req(text); return { lines: s.split("\n").length, nonEmptyLines: s.split("\n").filter(l => l.trim()).length }; }
function extractHashtags({ text } = {}) { const m = x2req(text).match(/#[\w]+/g) || []; return { hashtags: [...new Set(m)] }; }
function wordFrequency({ text, top } = {}) { const w = x2req(text).toLowerCase().match(/\b[\w']+\b/g) || []; const f = {}; w.forEach(x => f[x] = (f[x] || 0) + 1); const n = Math.round(clampNum(top, 1, 50, 10)); return { top: Object.entries(f).sort((a, b) => b[1] - a[1]).slice(0, n).map(([word, count]) => ({ word, count })) }; }

/* ---- Encoding / dev --------------------------------------------------------- */
function base64Encode({ text } = {}) { const r = btoa(unescape(encodeURIComponent(x2req(text)))); x2copy(r); return { base64: r }; }
function base64Decode({ text } = {}) { try { const r = decodeURIComponent(escape(atob(x2req(text).trim()))); x2copy(r); return { text: r }; } catch { throw new Error("That isn't valid Base64."); } }
function urlEncode({ text } = {}) { const r = encodeURIComponent(x2req(text)); x2copy(r); return { encoded: r }; }
function urlDecode({ text } = {}) { try { const r = decodeURIComponent(x2req(text)); x2copy(r); return { decoded: r }; } catch { throw new Error("That isn't valid URL encoding."); } }
function hexEncode({ text } = {}) { const r = x2req(text).split("").map(c => c.charCodeAt(0).toString(16).padStart(2, "0")).join(""); x2copy(r); return { hex: r }; }
function hexDecode({ hex } = {}) { const h = x2req(hex, "Give me hex.").replace(/\s|0x/g, ""); if (h.length % 2) throw new Error("Hex length must be even."); const r = h.match(/../g).map(b => String.fromCharCode(parseInt(b, 16))).join(""); x2copy(r); return { text: r }; }
const X2_HTML = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" };
function htmlEncode({ text } = {}) { const r = x2req(text).replace(/[&<>"']/g, c => X2_HTML[c]); x2copy(r); return { encoded: r }; }
function htmlDecode({ text } = {}) { const rev = { "&amp;": "&", "&lt;": "<", "&gt;": ">", "&quot;": '"', "&#39;": "'", "&apos;": "'" }; const r = x2req(text).replace(/&(amp|lt|gt|quot|#39|apos);/g, m => rev[m]); x2copy(r); return { decoded: r }; }
function uuidGen() { const u = "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, c => { const r = Math.random() * 16 | 0; return (c === "x" ? r : (r & 0x3 | 0x8)).toString(16); }); x2copy(u); return { uuid: u }; }
function randomString({ length, type } = {}) {
  const n = Math.round(clampNum(length, 1, 256, 16)); const t = String(type || "alphanumeric").toLowerCase();
  const sets = { numeric: "0123456789", alpha: "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ", alphanumeric: "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789", hex: "0123456789abcdef" };
  const pool = sets[t] || sets.alphanumeric; let r = ""; for (let i = 0; i < n; i++) r += pool[Math.floor(Math.random() * pool.length)]; x2copy(r); return { result: r };
}
function checksum({ text } = {}) { let h = 5381; const s = x2req(text); for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) >>> 0; return { checksum: h.toString(16), note: "djb2 (a fast non-cryptographic hash)." }; }
function jsonPretty({ text } = {}) { try { const r = JSON.stringify(JSON.parse(x2req(text)), null, 2); x2copy(r); return { result: r }; } catch (e) { throw new Error("That isn't valid JSON: " + e.message); } }
function jsonMinify({ text } = {}) { try { const r = JSON.stringify(JSON.parse(x2req(text))); x2copy(r); return { result: r, savedChars: x2req(text).length - r.length }; } catch (e) { throw new Error("That isn't valid JSON: " + e.message); } }
function x2hexToRgb(hex) { const h = hex.replace("#", ""); const v = h.length === 3 ? h.split("").map(c => c + c).join("") : h; if (!/^[0-9a-f]{6}$/i.test(v)) return null; return [parseInt(v.slice(0, 2), 16), parseInt(v.slice(2, 4), 16), parseInt(v.slice(4, 6), 16)]; }
function x2rgbToHsl(r, g, b) { r /= 255; g /= 255; b /= 255; const max = Math.max(r, g, b), min = Math.min(r, g, b); let h = 0, s = 0, l = (max + min) / 2; if (max !== min) { const d = max - min; s = l > 0.5 ? d / (2 - max - min) : d / (max + min); h = max === r ? (g - b) / d + (g < b ? 6 : 0) : max === g ? (b - r) / d + 2 : (r - g) / d + 4; h /= 6; } return [Math.round(h * 360), Math.round(s * 100), Math.round(l * 100)]; }
function colorConvert({ color } = {}) {
  const c = x2req(color, "Give me a colour.").trim(); let rgb;
  const m = c.match(/(\d+)\D+(\d+)\D+(\d+)/);
  if (c.startsWith("#") || /^[0-9a-f]{6}$/i.test(c) || /^[0-9a-f]{3}$/i.test(c)) rgb = x2hexToRgb(c);
  else if (m) rgb = [+m[1], +m[2], +m[3]];
  if (!rgb || rgb.some(v => v == null || v > 255)) throw new Error("Give me a hex (#aabbcc) or rgb (12, 34, 56) colour.");
  const hex = "#" + rgb.map(v => v.toString(16).padStart(2, "0")).join(""); const hsl = x2rgbToHsl(...rgb);
  return { hex, rgb: `rgb(${rgb.join(", ")})`, hsl: `hsl(${hsl[0]}, ${hsl[1]}%, ${hsl[2]}%)` };
}
function randomColor() { const hex = "#" + Array.from({ length: 3 }, () => Math.floor(Math.random() * 256).toString(16).padStart(2, "0")).join(""); return colorConvert({ color: hex }); }
function caesarCipher({ text, shift } = {}) { const s = Math.round(Number(shift || 3)); const r = x2req(text).replace(/[a-z]/gi, c => { const base = c <= "Z" ? 65 : 97; return String.fromCharCode((c.charCodeAt(0) - base + s % 26 + 26) % 26 + base); }); x2copy(r); return { result: r, shift: s }; }
function asciiCode({ char } = {}) { const c = x2req(char, "Give me a character."); return { char: c[0], code: c.charCodeAt(0), hex: c.charCodeAt(0).toString(16), binary: c.charCodeAt(0).toString(2) }; }
function charFromCode({ code } = {}) { const n = Math.round(c2n(code, "a character code")); return { code: n, char: String.fromCharCode(n) }; }

FEATURE_TOOLS.push(
  xfn("char_count", "Count characters, words and lines in text.", { text: xs }, ["text"]),
  xfn("reverse_text", "Reverse text (and copy it).", { text: xs }, ["text"]),
  xfn("slugify", "Turn text into a url-slug.", { text: xs }, ["text"]),
  xfn("lorem_ipsum", "Generate placeholder lorem-ipsum text.", { paragraphs: xi, words: xi }),
  xfn("count_occurrences", "Count how many times a term appears in text.", { text: xs, term: xs }, ["text", "term"]),
  xfn("find_replace", "Find and replace within text.", { text: xs, find: xs, replace: xs, all: xb }, ["text", "find"]),
  xfn("remove_spaces", "Tidy whitespace (extra) or strip all spaces.", { text: xs, mode: { type: "string", enum: ["extra", "all"] } }, ["text"]),
  xfn("extract_emails", "Pull all email addresses out of text.", { text: xs }, ["text"]),
  xfn("extract_urls", "Pull all links out of text.", { text: xs }, ["text"]),
  xfn("extract_numbers", "Pull all numbers out of text and sum them.", { text: xs }, ["text"]),
  xfn("initials", "The initials of a name or phrase.", { text: xs }, ["text"]),
  xfn("acronym", "Make an acronym from a phrase.", { text: xs }, ["text"]),
  xfn("pig_latin", "Translate text into Pig Latin.", { text: xs }, ["text"]),
  xfn("rot13", "ROT13-encode or -decode text.", { text: xs }, ["text"]),
  xfn("morse_encode", "Encode text into Morse code.", { text: xs }, ["text"]),
  xfn("morse_decode", "Decode Morse code into text.", { morse: xs }, ["morse"]),
  xfn("text_to_binary", "Convert text to binary.", { text: xs }, ["text"]),
  xfn("binary_to_text", "Convert binary back to text.", { binary: xs }, ["binary"]),
  xfn("nato_spell", "Spell text in the NATO phonetic alphabet.", { text: xs }, ["text"]),
  xfn("palindrome_check", "Is the text a palindrome?", { text: xs }, ["text"]),
  xfn("is_anagram", "Are two phrases anagrams of each other?", { a: xs, b: xs }, ["a", "b"]),
  xfn("vowel_count", "Count vowels and consonants.", { text: xs }, ["text"]),
  xfn("unique_words", "Count total vs unique words.", { text: xs }, ["text"]),
  xfn("longest_word", "Find the longest word in some text.", { text: xs }, ["text"]),
  xfn("repeat_text", "Repeat text a number of times.", { text: xs, times: xi }, ["text", "times"]),
  xfn("truncate_text", "Shorten text to a length with an ellipsis.", { text: xs, length: xi }, ["text"]),
  xfn("count_lines", "Count lines in text.", { text: xs }, ["text"]),
  xfn("extract_hashtags", "Pull hashtags out of text.", { text: xs }, ["text"]),
  xfn("word_frequency", "The most frequent words in a text.", { text: xs, top: xi }, ["text"]),
  xfn("base64_encode", "Encode text to Base64.", { text: xs }, ["text"]),
  xfn("base64_decode", "Decode Base64 to text.", { text: xs }, ["text"]),
  xfn("url_encode", "Percent-encode text for a URL.", { text: xs }, ["text"]),
  xfn("url_decode", "Decode a percent-encoded URL string.", { text: xs }, ["text"]),
  xfn("hex_encode", "Encode text to hexadecimal.", { text: xs }, ["text"]),
  xfn("hex_decode", "Decode hexadecimal to text.", { hex: xs }, ["hex"]),
  xfn("html_encode", "Escape HTML special characters.", { text: xs }, ["text"]),
  xfn("html_decode", "Unescape HTML entities.", { text: xs }, ["text"]),
  xfn("uuid", "Generate a random UUID.", {}),
  xfn("random_string", "Generate a random string.", { length: xi, type: { type: "string", enum: ["numeric", "alpha", "alphanumeric", "hex"] } }),
  xfn("checksum", "A fast non-cryptographic checksum of text.", { text: xs }, ["text"]),
  xfn("json_pretty", "Pretty-print (format) JSON.", { text: xs }, ["text"]),
  xfn("json_minify", "Minify JSON.", { text: xs }, ["text"]),
  xfn("color_convert", "Convert a colour between hex, rgb and hsl.", { color: xs }, ["color"]),
  xfn("random_color", "Generate a random colour.", {}),
  xfn("caesar_cipher", "Caesar-shift a message.", { text: xs, shift: xi }, ["text"]),
  xfn("ascii_code", "The character code of a character.", { char: xs }, ["char"]),
  xfn("char_from_code", "The character for a code point.", { code: xi }, ["code"]),
);
Object.assign(FEATURE_HANDLERS, {
  char_count: a => charCount(a), reverse_text: a => reverseText(a), slugify: a => slugify(a), lorem_ipsum: a => loremIpsum(a),
  count_occurrences: a => countOccurrences(a), find_replace: a => findReplace(a), remove_spaces: a => removeSpaces(a), extract_emails: a => extractEmails(a),
  extract_urls: a => extractUrls(a), extract_numbers: a => extractNumbers(a), initials: a => initialsOf(a), acronym: a => acronymOf(a),
  pig_latin: a => pigLatin(a), rot13: a => rot13(a), morse_encode: a => morseEncode(a), morse_decode: a => morseDecode(a),
  text_to_binary: a => textToBinary(a), binary_to_text: a => binaryToText(a), nato_spell: a => natoSpell(a), palindrome_check: a => palindromeCheck(a),
  is_anagram: a => isAnagram(a), vowel_count: a => vowelCount(a), unique_words: a => uniqueWords(a), longest_word: a => longestWord(a),
  repeat_text: a => repeatText(a), truncate_text: a => truncateText(a), count_lines: a => countLines(a), extract_hashtags: a => extractHashtags(a), word_frequency: a => wordFrequency(a),
  base64_encode: a => base64Encode(a), base64_decode: a => base64Decode(a), url_encode: a => urlEncode(a), url_decode: a => urlDecode(a),
  hex_encode: a => hexEncode(a), hex_decode: a => hexDecode(a), html_encode: a => htmlEncode(a), html_decode: a => htmlDecode(a),
  uuid: () => uuidGen(), random_string: a => randomString(a), checksum: a => checksum(a), json_pretty: a => jsonPretty(a),
  json_minify: a => jsonMinify(a), color_convert: a => colorConvert(a), random_color: () => randomColor(), caesar_cipher: a => caesarCipher(a),
  ascii_code: a => asciiCode(a), char_from_code: a => charFromCode(a),
});
TOOL_GROUPS.text2 = {
  about: "text & developer tools: counts, reverse, slug, lorem, find/replace, extract emails/links/numbers, pig-latin, ROT13, Morse, binary, NATO, palindrome/anagram, Base64/URL/hex/HTML encode-decode, UUID, random string, JSON format, colour convert, Caesar cipher",
  tools: ["char_count", "reverse_text", "slugify", "lorem_ipsum", "count_occurrences", "find_replace", "remove_spaces", "extract_emails", "extract_urls", "extract_numbers", "initials", "acronym", "pig_latin", "rot13", "morse_encode", "morse_decode", "text_to_binary", "binary_to_text", "nato_spell", "palindrome_check", "is_anagram", "vowel_count", "unique_words", "longest_word", "repeat_text", "truncate_text", "count_lines", "extract_hashtags", "word_frequency", "base64_encode", "base64_decode", "url_encode", "url_decode", "hex_encode", "hex_decode", "html_encode", "html_decode", "uuid", "random_string", "checksum", "json_pretty", "json_minify", "color_convert", "random_color", "caesar_cipher", "ascii_code", "char_from_code"],
  match: /\b(character count|count characters|reverse|slug|lorem|placeholder text|how many times|find and replace|remove spaces|extract (emails?|links?|urls?|numbers?)|initials|acronym|pig latin|rot13|morse|binary|nato|phonetic alphabet|palindrome|anagram|vowels?|unique words|longest word|repeat|truncate|count lines|hashtags?|base ?64|url (en|de)code|hex (en|de)code|html (en|de)code|escape html|uuid|guid|random string|checksum|hash|pretty ?print|format json|minify|colou?r|hex to rgb|rgb to hex|hsl|caesar|cipher|ascii|char code)\b/i,
};

async function initText2() { /* stateless */ }
