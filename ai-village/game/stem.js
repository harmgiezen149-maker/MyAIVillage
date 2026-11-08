// Rosie's voice (Harm, 2026-11-08): "Laat Rosie ook spreken. Laat ze met een rustige typische therapeutische stem de
// vragen stellen."
//
// - Uses the speech that is built into Harm's own device (the browser's speech synthesis): free, no key, no extra
//   service, nothing to pay per use.
// - Privacy (the skill: the session stays nowhere but Harm's list): only voices that run ON the device are used
//   (localService). Online voices (for example "Google Nederlands" in Chrome) would send Rosie's words to Google or
//   Microsoft, so they are skipped.
// - Calm: a Dutch female voice where the device has one, a little slower and a little lower than normal, with short
//   pauses between sentences. Harm can switch the voice off and on; that choice is remembered on this device.

const stem = { on: true, voice: null, warned: false, unlocked: false };
try { stem.on = localStorage.getItem('rosie-stem') !== 'uit'; } catch (e) { /* no storage: on */ }
const synth = typeof window.speechSynthesis !== 'undefined' && typeof window.SpeechSynthesisUtterance !== 'undefined' ? window.speechSynthesis : null;

const FEMALE = /claire|colette|fenna|ellen|hanna|laura|femke|lotte|sanne|nl-nl-x-(lfc|tfb|yfr)|female|vrouw/i;
const MALE = /xander|frank|maarten|daan|nl-nl-x-(bmh|dma)|\bmale\b|\bman\b/i;

function pickVoice() {
  if (!synth) return null;
  const local = (synth.getVoices() || []).filter((v) => /^nl([-_]|$)/i.test(v.lang || '') && v.localService !== false);
  if (!local.length) return null;
  const score = (v) => (/^nl[-_]nl/i.test(v.lang) ? 4 : 0) + (FEMALE.test(v.name) ? 3 : 0) - (MALE.test(v.name) ? 3 : 0)
    + (/premium|enhanced|verbeterd|natural|neural/i.test(v.name) ? 2 : 0) + (v.default ? 1 : 0);
  return local.slice().sort((a, b) => score(b) - score(a))[0];
}
if (synth) {
  const again = () => { stem.voice = null; renderVoiceButton(); };
  if (synth.addEventListener) synth.addEventListener('voiceschanged', again); else synth.onvoiceschanged = again;
}

// What Rosie wrote, made fit to say aloud: no Markdown, no emoji, the reflection arrows as pauses.
function spoken(text) {
  return String(text || '')
    .replace(/https?:\/\/\S+/g, '')
    .replace(/[*_#`~]+/g, '')
    .replace(/\s+>\s+/g, ', ')
    .replace(/^\s*[-•]\s+/gm, '')
    .replace(/(\d+)\s*-\s*(\d+)/g, '$1 tot $2')
    .replace(/[\u{1F000}-\u{1FAFF}\u{2600}-\u{27BF}\u{FE0F}]/gu, '')
    .replace(/\s*\n+\s*/g, '. ')
    .replace(/\.(\s*\.)+/g, '.')
    .replace(/\s{2,}/g, ' ')
    .trim();
}
// Short pieces, sentence by sentence: calmer, and some browsers stop a long piece halfway.
function pieces(text) {
  const out = [];
  for (const s of text.match(/[^.!?…]+[.!?…]*/g) || []) {
    let t = s.trim();
    while (t.length > 180) { const cut = t.lastIndexOf(',', 180) > 40 ? t.lastIndexOf(',', 180) + 1 : 180; out.push(t.slice(0, cut).trim()); t = t.slice(cut).trim(); }
    if (t) out.push(t);
  }
  return out;
}

// Phones only allow speech that starts from a tap; call this from a tap (start, send, the voice button).
function rosieUnlock() {
  if (!synth || stem.unlocked) return;
  stem.unlocked = true;
  try { const u = new SpeechSynthesisUtterance(''); u.volume = 0; synth.speak(u); } catch (e) { /* fine */ }
}
function rosieStop() { if (synth) try { synth.cancel(); } catch (e) { /* fine */ } }

function rosieSpeak(text) {
  if (!synth || !stem.on) return;
  stem.voice = stem.voice || pickVoice();
  if (!stem.voice) {
    if (!stem.warned) { stem.warned = true; toast('Op dit apparaat staat geen Nederlandse stem die op het apparaat zelf werkt, dus Rosie spreekt niet. Je kunt er een toevoegen in de instellingen van je apparaat (spraak / voorlezen).'); }
    return;
  }
  rosieStop();
  const female = !MALE.test(stem.voice.name);
  for (const p of pieces(spoken(text))) {
    const u = new SpeechSynthesisUtterance(p);
    u.voice = stem.voice; u.lang = stem.voice.lang;
    u.rate = 0.88;                     // unhurried
    u.pitch = female ? 0.95 : 1.0;     // a little warmer
    u.volume = 1;
    synth.speak(u);
  }
}

// Which voice Rosie uses, under her name (Harm, 2026-11-08: "laat zien welke stem Rosie gebruikt").
function voiceInfo() {
  if (!synth) return 'Stem: deze app kan niet voorlezen. Open het dorp in Chrome of Safari.';
  if (!stem.on) return 'Stem: uit';
  const v = stem.voice || pickVoice();
  if (v) return `Stem: ${v.name} (${v.lang}), op dit apparaat`;
  const all = synth.getVoices() || [];
  if (all.some((x) => /^nl([-_]|$)/i.test(x.lang || ''))) return 'Stem: alleen een online Nederlandse stem gevonden. Die gebruikt Rosie niet, zodat je woorden op je apparaat blijven.';
  return 'Stem: geen Nederlandse stem gevonden op dit apparaat';
}
function renderVoiceButton() {
  const info = document.getElementById('session-voice-info');
  if (info) info.textContent = voiceInfo();
  const b = document.getElementById('session-voice');
  if (!b) return;
  b.hidden = !synth;
  b.setAttribute('aria-pressed', String(stem.on));
  b.textContent = stem.on ? '🔈 Stem aan' : '🔇 Stem uit';
  b.title = stem.on ? 'Rosie spreekt. Tik om haar stem uit te zetten.' : 'Rosie spreekt niet. Tik om haar stem aan te zetten.';
}
document.getElementById('session-voice').addEventListener('click', () => {
  stem.on = !stem.on;
  try { localStorage.setItem('rosie-stem', stem.on ? 'aan' : 'uit'); } catch (e) { /* fine */ }
  renderVoiceButton();
  if (!stem.on) { rosieStop(); return; }
  rosieUnlock();
  const last = [...therapy.turns].reverse().find((t) => t.role === 'assistant');   // say her last message again
  if (last && !therapy.busy) rosieSpeak(last.content);
});
renderVoiceButton();
