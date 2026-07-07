// ============================================================
// Data layer. Talks to Firebase Firestore when firebase-config
// has real values; otherwise runs in DEMO MODE with in-memory
// sample data so the site can be previewed with no setup.
// ============================================================

import { firebaseConfig } from "./firebase-config.js";
import { DEFAULT_QUESTIONS, DEFAULT_PASSWORD } from "./defaults.js";

export const isDemo = /^PASTE/.test(firebaseConfig.apiKey || "PASTE");

let db = null;
let fs = null; // firestore module namespace

async function ensureFirebase() {
  if (isDemo || db) return;
  const appMod = await import("https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js");
  fs = await import("https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js");
  const app = appMod.initializeApp(firebaseConfig);
  db = fs.getFirestore(app);
}

// ---------- hashing (passwords are stored as SHA-256 hashes) ----------
export async function sha256(text) {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

// ---------- demo-mode sample data ----------
function makeDemoResponses(questions, n = 26) {
  // Deterministic pseudo-random so the preview looks the same every time.
  let seed = 42;
  const rand = () => ((seed = (seed * 9301 + 49297) % 233280) / 233280);
  const pick = (arr) => arr[Math.floor(rand() * arr.length)];
  const shortSamples = [
    "A little chilly in the back gallery.",
    "More benches near the video room, please!",
    "Loved it — no complaints.",
    "Lighting felt dim near the entrance.",
    "The lobby echoes a lot.",
  ];
  const out = [];
  for (let i = 0; i < n; i++) {
    const answers = {};
    for (const q of questions) {
      if (q.type === "short") {
        answers[q.id] = q.id === "q01" ? `visitor${i + 1}@example.com` : (rand() < 0.5 ? pick(shortSamples) : "");
      } else if (q.type === "multiple") {
        const opts = [...(q.options || [])];
        if (q.allowOther && rand() < 0.12) {
          answers[q.id] = "Other";
          answers[q.id + "_other"] = "Came for the gift shop";
        } else {
          answers[q.id] = pick(opts);
        }
      } else if (q.type === "yesno") {
        if (q.allowOther && rand() < 0.1) {
          answers[q.id] = "Other";
          answers[q.id + "_other"] = "Sometimes";
        } else {
          answers[q.id] = rand() < 0.6 ? "Yes" : "No";
        }
      } else if (q.type === "imagechoice") {
        const labels = (q.images || []).map((im, ix) => im.label || "Option " + (ix + 1));
        if (labels.length) answers[q.id] = pick(labels);
      } else if (q.type === "slider" || q.type === "number") {
        const min = q.min ?? 1, max = q.max ?? 5;
        answers[q.id] = Math.round(min + rand() * (max - min));
      }
    }
    out.push({
      id: "demo-" + i,
      submittedAt: new Date(Date.now() - i * 5.3e6).toISOString(),
      answers,
    });
  }
  return out;
}

const demoStore = {
  questions: JSON.parse(JSON.stringify(DEFAULT_QUESTIONS)),
  responses: null,
  passwordHash: null,
};

// ---------- public API ----------

export async function loadQuestions() {
  if (isDemo) return [...demoStore.questions].sort((a, b) => a.order - b.order);
  await ensureFirebase();
  const snap = await fs.getDocs(fs.query(fs.collection(db, "questions"), fs.orderBy("order")));
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}

export async function saveQuestions(list) {
  if (isDemo) { demoStore.questions = JSON.parse(JSON.stringify(list)); return; }
  await ensureFirebase();
  const existing = await fs.getDocs(fs.collection(db, "questions"));
  const batch = fs.writeBatch(db);
  const keep = new Set(list.map((q) => q.id));
  existing.docs.forEach((d) => { if (!keep.has(d.id)) batch.delete(d.ref); });
  list.forEach((q) => {
    const { id, ...data } = q;
    batch.set(fs.doc(db, "questions", id), data);
  });
  await batch.commit();
}

export async function submitResponse(answers) {
  if (isDemo) return { demo: true };
  await ensureFirebase();
  await fs.addDoc(fs.collection(db, "responses"), {
    submittedAt: new Date().toISOString(),
    answers,
  });
  return { demo: false };
}

export async function loadResponses() {
  if (isDemo) {
    if (!demoStore.responses) demoStore.responses = makeDemoResponses(demoStore.questions);
    return demoStore.responses;
  }
  await ensureFirebase();
  const snap = await fs.getDocs(fs.collection(db, "responses"));
  return snap.docs
    .map((d) => ({ id: d.id, ...d.data() }))
    .sort((a, b) => (b.submittedAt || "").localeCompare(a.submittedAt || ""));
}

export async function deleteResponse(id) {
  if (isDemo) {
    demoStore.responses = (demoStore.responses || []).filter((r) => r.id !== id);
    return;
  }
  await ensureFirebase();
  await fs.deleteDoc(fs.doc(db, "responses", id));
}

export async function deleteAllResponses() {
  if (isDemo) { demoStore.responses = []; return; }
  await ensureFirebase();
  const snap = await fs.getDocs(fs.collection(db, "responses"));
  const docs = snap.docs;
  for (let i = 0; i < docs.length; i += 400) {
    const batch = fs.writeBatch(db);
    docs.slice(i, i + 400).forEach((d) => batch.delete(d.ref));
    await batch.commit();
  }
}

export async function getPasswordHash() {
  if (isDemo) {
    if (!demoStore.passwordHash) demoStore.passwordHash = await sha256(DEFAULT_PASSWORD);
    return demoStore.passwordHash;
  }
  await ensureFirebase();
  const snap = await fs.getDoc(fs.doc(db, "meta", "config"));
  return snap.exists() ? snap.data().passwordHash : null;
}

export async function setPasswordHash(hash) {
  if (isDemo) { demoStore.passwordHash = hash; return; }
  await ensureFirebase();
  await fs.setDoc(fs.doc(db, "meta", "config"), { passwordHash: hash }, { merge: true });
}

// First-time setup: creates the admin password + starter questions.
export async function seedDatabase() {
  const hash = await sha256(DEFAULT_PASSWORD);
  await setPasswordHash(hash);
  const existing = await loadQuestions();
  if (existing.length === 0) await saveQuestions(DEFAULT_QUESTIONS);
}
