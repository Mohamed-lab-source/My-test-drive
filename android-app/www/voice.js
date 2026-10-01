/* ======================================================================
 * Jarvis 3.1 — offline voice ("Daniel", Kokoro v1.0 via sherpa-onnx)
 *
 * A British male neural voice that runs entirely on the phone after a
 * one-time ~117 MB download. Replies are spoken sentence by sentence, the
 * next sentence synthesised while the current one plays, through the same
 * player as the premium voice (so the core still pulses with it).
 * Arabic falls through to ElevenLabs (if on) or the phone's Arabic voice.
 * Loads after ops.js.
 * ====================================================================== */

const VOICE_PACK_URL = "https://github.com/Mohamed-lab-source/My-test-drive/releases/download/jarvis-voice/jarvis-voice-daniel.zip";
const DANIEL = 24; // speaker id of bm_daniel in Kokoro v1.0's voices.bin

Object.assign(state, { offlineVoice: false, offlineVoiceSpeed: 1.0 });
let offlineVoiceReady = false;
let offlineVoiceWarned = false;

// Kokoro reads symbols literally: tidy what an LLM reply might contain.
function speakable(text) {
  return String(text)
    .replace(/https?:\/\/\S+/g, "the link")
    .replace(/[*_#`>|]+/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

async function offlineClip(text) {
  const { path } = await DeviceActions.voiceSpeak({ text, speaker: DANIEL, speed: state.offlineVoiceSpeed });
  const src = window.Capacitor && window.Capacitor.convertFileSrc ? window.Capacitor.convertFileSrc("file://" + path) : path;
  const res = await fetch(`${src}${src.includes("?") ? "&" : "?"}t=${Date.now()}`);
  if (!res.ok) throw new Error(`audio ${res.status}`);
  return res.blob();
}

async function speakOffline(text) {
  premiumCancelled = false;
  const chunks = speechChunks(speakable(text));
  let next = offlineClip(chunks[0]);
  for (let i = 0; i < chunks.length; i++) {
    let blob;
    try { blob = await next; }
    catch (e) { e.remaining = chunks.slice(i).join(" "); throw e; }
    if (premiumCancelled) return;
    next = i + 1 < chunks.length ? offlineClip(chunks[i + 1]) : null;
    if (next) next.catch(() => {});
    try { await playBlob(blob); }
    catch (e) { e.remaining = chunks.slice(i).join(" "); throw e; }
    if (premiumCancelled) return;
  }
}

const presenceSpeak = speak;
speak = async function (text) {
  if (!text) return;
  const useOffline = state.offlineVoice && offlineVoiceReady && !state.silentMode && !ARABIC_SCRIPT.test(text);
  if (!useOffline) return presenceSpeak(text);
  try {
    await speakOffline(text);
    finishTyping();
    return;
  } catch (e) {
    if (premiumCancelled) return;
    console.warn("offline voice failed", e);
    if (!offlineVoiceWarned) { offlineVoiceWarned = true; toast("Offline voice hiccup — using the phone voice"); }
    try { await speakDevice(e.remaining || text); } catch {}
    finishTyping();
  }
};

/* Settings ------------------------------------------------------------------------------ */
function renderVoiceStatus(extra) {
  const pill = document.getElementById("offlineVoiceStatus");
  const dl = document.getElementById("offlineVoiceDownloadBtn");
  const del = document.getElementById("offlineVoiceDeleteBtn");
  const toggle = document.getElementById("offlineVoiceToggle");
  if (pill) {
    pill.textContent = extra || (offlineVoiceReady ? (state.offlineVoice ? "in use" : "installed") : "not downloaded");
    pill.classList.toggle("ok", offlineVoiceReady && !extra);
  }
  if (dl) dl.hidden = offlineVoiceReady;
  if (del) del.hidden = !offlineVoiceReady;
  if (toggle) { toggle.checked = !!state.offlineVoice; toggle.disabled = !offlineVoiceReady; }
}

let offlineVoiceCrashed = false;
async function refreshVoiceStatus() {
  try {
    const st = await DeviceActions.voiceStatus();
    offlineVoiceReady = !!st.installed;
    offlineVoiceCrashed = !!st.crashed;
  } catch { offlineVoiceReady = false; }
  // The engine took the app down while loading last time: switch it off rather than crash again.
  if (offlineVoiceCrashed && state.offlineVoice) {
    state.offlineVoice = false;
    store.set("offlineVoice", false);
    setTimeout(() => {
      addMsg("assistant", `My offline voice failed to start on this phone, ${state.address}, so I've switched back to the regular voice. You can try it again from Settings.`);
    }, 1500);
  }
  renderVoiceStatus(offlineVoiceCrashed ? "failed to start" : undefined);
}

async function downloadOfflineVoice() {
  const btn = document.getElementById("offlineVoiceDownloadBtn");
  if (btn) btn.disabled = true;
  renderVoiceStatus("starting…");
  try {
    await DeviceActions.voiceDownload({ url: VOICE_PACK_URL });
    offlineVoiceReady = true;
    state.offlineVoice = true;
    store.set("offlineVoice", true);
    renderVoiceStatus();
    toast("Daniel is installed. Tap Test to hear him; Jarvis now speaks offline.");
    logActivity("OFFLINE VOICE INSTALLED");
  } catch (e) {
    renderVoiceStatus("download failed");
    toast(`Voice download failed: ${e.message}. Check the connection (Wi-Fi recommended) and try again.`, 5000);
  } finally {
    if (btn) btn.disabled = false;
  }
}

async function initVoice() {
  state.offlineVoice = await store.get("offlineVoice", false);
  state.offlineVoiceSpeed = await store.get("offlineVoiceSpeed", 1.0);
  try {
    DeviceActions.addListener("voiceProgress", ({ percent }) => {
      if (percent >= 0 && percent < 100) renderVoiceStatus(percent < 90 ? `downloading ${Math.round(percent / 0.9)}%` : "unpacking…");
    });
  } catch {}
  await refreshVoiceStatus();
  // No loading at startup: the engine loads the first time Jarvis speaks.

  const dl = document.getElementById("offlineVoiceDownloadBtn");
  if (dl) dl.addEventListener("click", () => {
    if (confirm("Download Jarvis's offline voice? About 117 MB, once (Wi-Fi recommended). It's stored on the phone and works without internet.")) downloadOfflineVoice();
  });
  const del = document.getElementById("offlineVoiceDeleteBtn");
  if (del) del.addEventListener("click", async () => {
    if (!confirm("Remove the offline voice and free about 145 MB?")) return;
    await DeviceActions.voiceDelete().catch(() => {});
    state.offlineVoice = false;
    store.set("offlineVoice", false);
    await refreshVoiceStatus();
  });
  const toggle = document.getElementById("offlineVoiceToggle");
  if (toggle) toggle.addEventListener("change", () => {
    state.offlineVoice = toggle.checked;
    store.set("offlineVoice", state.offlineVoice);
    if (state.offlineVoice && offlineVoiceCrashed) {
      // A deliberate retry after a failed start.
      offlineVoiceCrashed = false;
      DeviceActions.voiceClearCrash().catch(() => {});
    }
    renderVoiceStatus();
  });
  const speed = document.getElementById("offlineVoiceSpeed");
  const speedVal = document.getElementById("offlineVoiceSpeedValue");
  if (speed) {
    speed.value = state.offlineVoiceSpeed;
    if (speedVal) speedVal.textContent = Number(state.offlineVoiceSpeed).toFixed(2);
    speed.addEventListener("input", () => { if (speedVal) speedVal.textContent = Number(speed.value).toFixed(2); });
    speed.addEventListener("change", () => { state.offlineVoiceSpeed = Number(speed.value); store.set("offlineVoiceSpeed", state.offlineVoiceSpeed); });
  }
  const test = document.getElementById("offlineVoiceTestBtn");
  if (test) test.addEventListener("click", async () => {
    if (!offlineVoiceReady) { toast("Download the voice first."); return; }
    if (offlineVoiceCrashed) { offlineVoiceCrashed = false; await DeviceActions.voiceClearCrash().catch(() => {}); }
    test.disabled = true;
    try {
      if (speakingNow) await stopSpeaking();
      speakingNow = true;
      setHud("speaking");
      await speakOffline(`Good ${partOfDay()}, ${state.address}. All systems are online, and this is how I sound without the internet.`);
    } catch (e) { toast(`Offline voice error: ${e.message}`, 5000); }
    finally { speakingNow = false; setHud("idle"); test.disabled = false; }
  });
}
