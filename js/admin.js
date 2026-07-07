import {
  loadQuestions, saveQuestions, loadResponses, deleteResponse, deleteAllResponses,
  getPasswordHash, setPasswordHash, seedDatabase, sha256, isDemo,
} from "./db.js";
import { EXAMPLE_IMAGE_QUESTION } from "./defaults.js";

const $ = (sel, el = document) => el.querySelector(sel);
const $$ = (sel, el = document) => [...el.querySelectorAll(sel)];

$("#marqueeTrack").textContent = "Staff only 〰️ Yay for data! 〰️ SITE Survey 2026 〰️ ".repeat(8);

const PALETTE = ["#D7DF21", "#25BEC0", "#ED217C", "#25AAE1", "#8CC63F", "#8685C0", "#0F416F", "#9F2064"];
const chartFont = { family: "'Josefin Sans', sans-serif", size: 12 };
if (window.Chart) {
  Chart.defaults.font = chartFont;
  Chart.defaults.color = "#000000";
}

let QUESTIONS = [];
let RESPONSES = [];
let charts = [];

// ============================================================
// AUTH
// ============================================================
async function checkSetup() {
  if (isDemo) { $("#demoBannerLogin").hidden = false; return; }
  try {
    const hash = await getPasswordHash();
    if (!hash) $("#setupCard").hidden = false;
  } catch (err) {
    console.error(err);
    $("#loginError").textContent = "Couldn't reach the database. Check js/firebase-config.js and your Firestore rules.";
    $("#loginError").style.display = "block";
  }
}

$("#setupBtn")?.addEventListener("click", async () => {
  const btn = $("#setupBtn");
  btn.disabled = true;
  btn.textContent = "Setting up...";
  try {
    await seedDatabase();
    $("#setupCard").innerHTML = `<div class="banner banner--ok">Done! Sign in below with <strong>yaypda</strong> — then change it under Settings.</div>`;
  } catch (err) {
    console.error(err);
    btn.disabled = false;
    btn.textContent = "Set up the database";
    alert("Setup failed — check the browser console and your Firestore rules.");
  }
});

async function doLogin() {
  const entered = $("#passwordInput").value;
  try {
    const stored = await getPasswordHash();
    if (!stored) {
      $("#loginError").textContent = "No password exists yet — run the first-time setup above.";
      $("#loginError").style.display = "block";
      $("#setupCard").hidden = false;
      return;
    }
    if ((await sha256(entered)) === stored) {
      sessionStorage.setItem("pda_admin", "1");
      openDashboard();
    } else {
      $("#loginError").textContent = "That password didn't match. Try again.";
      $("#loginError").style.display = "block";
    }
  } catch (err) {
    console.error(err);
    $("#loginError").textContent = "Couldn't reach the database. Check your connection and Firebase setup.";
    $("#loginError").style.display = "block";
  }
}

$("#signInBtn").addEventListener("click", doLogin);
$("#passwordInput").addEventListener("keydown", (e) => {
  if (e.key === "Enter") { e.preventDefault(); doLogin(); }
});
$("#loginForm").addEventListener("submit", (e) => { e.preventDefault(); doLogin(); });

$("#logoutBtn").addEventListener("click", () => {
  sessionStorage.removeItem("pda_admin");
  location.reload();
});

async function openDashboard() {
  $("#loginView").hidden = true;
  $("#dashView").hidden = false;
  $("#logoutBtn").hidden = false;
  if (isDemo) $("#demoBannerDash").hidden = false;
  QUESTIONS = await loadQuestions();
  renderBuilder();
  await refreshResults();
}

// ============================================================
// TABS
// ============================================================
$$(".tab").forEach((tab) => tab.addEventListener("click", () => {
  $$(".tab").forEach((t) => t.setAttribute("aria-selected", t === tab ? "true" : "false"));
  ["results", "responses", "builder", "settings"].forEach((name) => {
    $("#tab-" + name).hidden = name !== tab.dataset.tab;
  });
}));

// ============================================================
// RESULTS
// ============================================================
$("#refreshBtn").addEventListener("click", refreshResults);

async function refreshResults() {
  RESPONSES = await loadResponses();
  renderStats();
  renderCharts();
  renderResponseList();
}

function renderStats() {
  const row = $("#statRow");
  const last = RESPONSES[0]?.submittedAt;
  row.innerHTML = "";
  const stats = [
    [RESPONSES.length, "responses collected"],
    [QUESTIONS.length, "live questions"],
    [last ? new Date(last).toLocaleDateString() : "—", "latest response"],
  ];
  for (const [num, label] of stats) {
    const div = document.createElement("div");
    div.className = "stat";
    div.innerHTML = `<div class="stat-num">${num}</div><div class="stat-label">${label}</div>`;
    row.append(div);
  }
}

function answersFor(q) {
  return RESPONSES.map((r) => r.answers?.[q.id]).filter((v) => v !== undefined && v !== null && v !== "");
}
function otherTextsFor(q) {
  return RESPONSES.map((r) => r.answers?.[q.id + "_other"]).filter((v) => v);
}
function countBy(values) {
  const map = new Map();
  for (const v of values) map.set(String(v), (map.get(String(v)) || 0) + 1);
  return map;
}

function renderCharts() {
  charts.forEach((c) => c.destroy());
  charts = [];
  const grid = $("#chartGrid");
  grid.innerHTML = "";

  QUESTIONS.forEach((q, i) => {
    const card = document.createElement("div");
    card.className = "card chart-card";
    const values = answersFor(q);
    card.innerHTML = `<h3>${i + 1}. ${escapeHtml(q.title)}</h3><div class="chart-meta">${values.length} answer${values.length === 1 ? "" : "s"}</div>`;
    grid.append(card);

    if (q.type === "short") {
      const list = document.createElement("ul");
      list.className = "answer-list";
      if (values.length === 0) list.innerHTML = "<li>No answers yet.</li>";
      values.forEach((v) => {
        const li = document.createElement("li");
        li.textContent = v;
        list.append(li);
      });
      card.append(list);
      return;
    }

    const box = document.createElement("div");
    box.className = "chart-box";
    const canvas = document.createElement("canvas");
    box.append(canvas);
    card.append(box);

    if (q.type === "yesno" || q.type === "multiple" || q.type === "imagechoice") {
      const base = q.type === "yesno" ? ["Yes", "No"]
        : q.type === "imagechoice" ? (q.images || []).filter((im) => im.src).map((im, ix) => im.label || "Option " + (ix + 1))
        : (q.options || []);
      const labels = q.allowOther && q.type !== "imagechoice" ? [...base, "Other"] : [...base];
      const counts = countBy(values);
      const data = labels.map((l) => counts.get(l) || 0);
      // catch answers for options that were later removed
      for (const [k, v] of counts) if (!labels.includes(k)) { labels.push(k); data.push(v); }

      const doughnut = labels.length <= 3;
      charts.push(new Chart(canvas, {
        type: doughnut ? "doughnut" : "bar",
        data: {
          labels,
          datasets: [{
            data,
            backgroundColor: labels.map((_, j) => PALETTE[j % PALETTE.length]),
            borderColor: "#000000",
            borderWidth: 2,
          }],
        },
        options: {
          indexAxis: doughnut ? undefined : "y",
          maintainAspectRatio: false,
          plugins: { legend: { display: doughnut, position: "bottom" } },
          scales: doughnut ? {} : { x: { ticks: { precision: 0 }, grid: { color: "#e4e4e2" } }, y: { grid: { display: false } } },
        },
      }));
      if (q.type === "imagechoice") {
        const row = document.createElement("div");
        row.className = "thumb-row";
        (q.images || []).filter((im) => im.src).forEach((im, ix) => {
          const fig = document.createElement("figure");
          const t = document.createElement("img");
          t.src = im.src;
          t.alt = "";
          const cap = document.createElement("figcaption");
          cap.textContent = im.label || "Option " + (ix + 1);
          fig.append(t, cap);
          row.append(fig);
        });
        card.append(row);
      }
    } else if (q.type === "slider" || q.type === "number") {
      const nums = values.map(Number).filter((n) => !Number.isNaN(n));
      const min = q.min ?? (nums.length ? Math.min(...nums) : 0);
      const max = q.max ?? (nums.length ? Math.max(...nums) : 5);
      const labels = [];
      for (let v = min; v <= max; v++) labels.push(String(v));
      const counts = countBy(nums);
      const data = labels.map((l) => counts.get(l) || 0);
      const avg = nums.length ? (nums.reduce((a, b) => a + b, 0) / nums.length).toFixed(1) : "—";

      const meta = card.querySelector(".chart-meta");
      meta.textContent += ` · average: ${avg}`;
      if (q.type === "slider" && (q.minLabel || q.maxLabel)) {
        meta.textContent += ` · ${min} = ${q.minLabel || min}, ${max} = ${q.maxLabel || max}`;
      }

      charts.push(new Chart(canvas, {
        type: "bar",
        data: {
          labels,
          datasets: [{ data, backgroundColor: "#D7DF21", borderColor: "#000000", borderWidth: 2 }],
        },
        options: {
          maintainAspectRatio: false,
          plugins: { legend: { display: false } },
          scales: { y: { ticks: { precision: 0 }, grid: { color: "#e4e4e2" } }, x: { grid: { display: false } } },
        },
      }));
    }

    const others = otherTextsFor(q);
    if (others.length) {
      const details = document.createElement("details");
      details.className = "other-notes";
      details.innerHTML = `<summary>"Other" write-ins (${others.length})</summary>`;
      const ul = document.createElement("ul");
      ul.className = "answer-list";
      ul.style.marginTop = "8px";
      others.forEach((t) => {
        const li = document.createElement("li");
        li.textContent = t;
        ul.append(li);
      });
      details.append(ul);
      card.append(details);
    }
  });
}

// ---------- Individual responses ----------
$("#refreshRespBtn").addEventListener("click", refreshResults);

function responseName(r) {
  for (const q of QUESTIONS) {
    if (q.type === "short" && r.answers?.[q.id]) return r.answers[q.id];
  }
  return "Anonymous response";
}

function renderResponseList() {
  const holder = $("#respList");
  holder.innerHTML = "";
  $("#respStatus").textContent = RESPONSES.length ? "" : "No responses yet.";
  RESPONSES.forEach((r) => {
    const row = document.createElement("div");
    row.className = "card resp-row";

    const details = document.createElement("details");
    const summary = document.createElement("summary");
    const when = r.submittedAt ? new Date(r.submittedAt).toLocaleString() : "Unknown time";
    summary.append(when + " \u2014 ");
    const who = document.createElement("span");
    who.className = "hint";
    who.textContent = responseName(r);
    summary.append(who);
    details.append(summary);

    const ul = document.createElement("ul");
    ul.className = "resp-answers";
    QUESTIONS.forEach((q) => {
      const v = r.answers?.[q.id];
      if (v === undefined || v === null || v === "") return;
      const li = document.createElement("li");
      const b = document.createElement("b");
      b.textContent = q.title;
      li.append(b);
      let text = String(v);
      const other = r.answers?.[q.id + "_other"];
      if (v === "Other" && other) text += " \u2014 " + other;
      li.append(text);
      ul.append(li);
    });
    details.append(ul);
    row.append(details);

    const del = document.createElement("button");
    del.className = "icon-btn";
    del.title = "Delete this response";
    del.setAttribute("aria-label", "Delete this response");
    del.textContent = "\u2715";
    del.addEventListener("click", async () => {
      if (!confirm(`Delete the response from ${when}? This can't be undone.`)) return;
      del.disabled = true;
      try {
        await deleteResponse(r.id);
        await refreshResults();
      } catch (err) {
        console.error(err);
        del.disabled = false;
        alert("Couldn't delete \u2014 if you just added this feature, make sure the updated firestore.rules are published in the Firebase console.");
      }
    });
    row.append(del);

    holder.append(row);
  });
}

$("#deleteAllBtn").addEventListener("click", async () => {
  const n = RESPONSES.length;
  if (!n) { $("#respStatus").textContent = "There are no responses to delete."; return; }
  if (!confirm(`Delete ALL ${n} responses? This cannot be undone.`)) return;
  if (!confirm("Last chance \u2014 really delete every response? Consider downloading the CSV first.")) return;
  const btn = $("#deleteAllBtn");
  btn.disabled = true;
  btn.textContent = "Deleting...";
  try {
    await deleteAllResponses();
    await refreshResults();
    $("#respStatus").textContent = "All responses deleted.";
  } catch (err) {
    console.error(err);
    alert("Couldn't delete everything \u2014 make sure the updated firestore.rules are published in the Firebase console, then try again.");
  }
  btn.disabled = false;
  btn.textContent = "Delete ALL responses";
});

// ---------- CSV export ----------
$("#exportBtn").addEventListener("click", () => {
  const cols = ["submittedAt"];
  const headers = ["Submitted"];
  QUESTIONS.forEach((q) => {
    cols.push(q.id);
    headers.push(q.title);
    if (q.allowOther) { cols.push(q.id + "_other"); headers.push(q.title + " (Other write-in)"); }
  });
  const esc = (v) => `"${String(v ?? "").replace(/"/g, '""')}"`;
  const rows = [headers.map(esc).join(",")];
  RESPONSES.forEach((r) => {
    rows.push(cols.map((c) => esc(c === "submittedAt" ? r.submittedAt : r.answers?.[c])).join(","));
  });
  const blob = new Blob([rows.join("\n")], { type: "text/csv" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = "site-survey-responses.csv";
  a.click();
  URL.revokeObjectURL(a.href);
});

// ============================================================
// QUESTION BUILDER
// ============================================================
const TYPE_LABELS = {
  short: "Short answer",
  multiple: "Multiple choice",
  yesno: "Yes / No",
  slider: "Slider",
  number: "Numerical",
  imagechoice: "Image choice (pick one)",
};

// Client-side resize so photos stay small enough to live in the database.
function resizeImage(file, maxDim = 500, quality = 0.78) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const img = new Image();
      img.onload = () => {
        const scale = Math.min(1, maxDim / Math.max(img.width, img.height));
        const canvas = document.createElement("canvas");
        canvas.width = Math.max(1, Math.round(img.width * scale));
        canvas.height = Math.max(1, Math.round(img.height * scale));
        canvas.getContext("2d").drawImage(img, 0, 0, canvas.width, canvas.height);
        resolve(canvas.toDataURL("image/jpeg", quality));
      };
      img.onerror = () => reject(new Error("Couldn't read that image file."));
      img.src = reader.result;
    };
    reader.onerror = () => reject(new Error("Couldn't read that file."));
    reader.readAsDataURL(file);
  });
}

$("#addImageExampleBtn").addEventListener("click", () => {
  const copy = JSON.parse(JSON.stringify(EXAMPLE_IMAGE_QUESTION));
  copy.id = "q" + Date.now();
  copy.order = QUESTIONS.length + 1;
  QUESTIONS.push(copy);
  renderBuilder();
  const items = $$(".builder-item");
  items[items.length - 1]?.scrollIntoView({ behavior: "smooth", block: "center" });
});

$("#addQuestionBtn").addEventListener("click", () => {
  QUESTIONS.push({
    id: "q" + Date.now(),
    order: QUESTIONS.length + 1,
    type: "short",
    title: "",
    required: true,
  });
  renderBuilder();
  const items = $$(".builder-item");
  items[items.length - 1]?.scrollIntoView({ behavior: "smooth", block: "center" });
});

function renderBuilder() {
  const list = $("#builderList");
  list.innerHTML = "";
  QUESTIONS.sort((a, b) => a.order - b.order).forEach((q, i) => list.append(builderItem(q, i)));
}

function builderItem(q, i) {
  const card = document.createElement("div");
  card.className = "card builder-item";

  // header row: order controls + title + type
  const head = document.createElement("div");
  head.className = "builder-head";
  head.innerHTML = `
    <span class="q-num">${i + 1}</span>
    <span class="order-btns">
      <button class="icon-btn" data-act="up" title="Move up" aria-label="Move up">↑</button>
      <button class="icon-btn" data-act="down" title="Move down" aria-label="Move down">↓</button>
    </span>
    <span class="grow"><input type="text" data-field="title" placeholder="Type the question..." value=""></span>
    <select data-field="type" style="width:auto;">
      ${Object.entries(TYPE_LABELS).map(([v, l]) => `<option value="${v}">${l}</option>`).join("")}
    </select>
    <button class="icon-btn" data-act="delete" title="Delete question" aria-label="Delete question">✕</button>
  `;
  head.querySelector('[data-field="title"]').value = q.title || "";
  head.querySelector('[data-field="type"]').value = q.type;
  card.append(head);

  // type-specific options
  const opts = document.createElement("div");
  opts.className = "builder-grid";
  card.append(opts);

  const foot = document.createElement("label");
  foot.className = "check-inline";
  foot.innerHTML = `<input type="checkbox" data-field="required"> Required question`;
  foot.querySelector("input").checked = !!q.required;
  card.append(foot);

  function renderTypeFields() {
    opts.innerHTML = "";
    if (q.type === "multiple") {
      opts.innerHTML = `
        <div class="field" style="grid-column:1/-1;">
          <label>Choices (one per line)</label>
          <textarea data-field="options">${escapeHtml((q.options || []).join("\n"))}</textarea>
          <label class="check-inline"><input type="checkbox" data-field="allowOther" ${q.allowOther ? "checked" : ""}> Add an "Other" option with a write-in box</label>
        </div>`;
    } else if (q.type === "yesno") {
      opts.innerHTML = `
        <div class="field" style="grid-column:1/-1;">
          <label class="check-inline" style="margin-top:0;"><input type="checkbox" data-field="allowOther" ${q.allowOther ? "checked" : ""}> Add an "Other" option with a write-in box</label>
        </div>`;
    } else if (q.type === "slider") {
      opts.innerHTML = `
        <div class="field"><label>Low end number</label><input type="number" data-field="min" value="${q.min ?? 1}"></div>
        <div class="field"><label>High end number</label><input type="number" data-field="max" value="${q.max ?? 5}"></div>
        <div class="field"><label>Label at the low end</label><input type="text" data-field="minLabel" value="${escapeHtml(q.minLabel || "")}" placeholder="e.g. I am comfortable"></div>
        <div class="field"><label>Label at the high end</label><input type="text" data-field="maxLabel" value="${escapeHtml(q.maxLabel || "")}" placeholder="e.g. I am uncomfortable"></div>`;
    } else if (q.type === "number") {
      opts.innerHTML = `
        <div class="field"><label>Minimum (optional)</label><input type="number" data-field="min" value="${q.min ?? ""}"></div>
        <div class="field"><label>Maximum (optional)</label><input type="number" data-field="max" value="${q.max ?? ""}"></div>`;
    } else if (q.type === "short") {
      opts.innerHTML = `
        <div class="field" style="grid-column:1/-1;"><label>Placeholder text (optional)</label>
        <input type="text" data-field="placeholder" value="${escapeHtml(q.placeholder || "")}" placeholder="e.g. Your answer"></div>`;
    } else if (q.type === "imagechoice") {
      if (!q.images) q.images = [{ label: "", src: "" }, { label: "", src: "" }];
      const holder = document.createElement("div");
      holder.className = "field";
      holder.style.gridColumn = "1/-1";
      holder.innerHTML = `<label>Images (2–6) — upload from your computer; they're resized automatically</label>`;
      const list = document.createElement("div");
      list.className = "img-slots";
      holder.append(list);
      const addImg = document.createElement("button");
      addImg.type = "button";
      addImg.className = "btn btn--ghost btn--sm";
      addImg.style.marginTop = "10px";
      addImg.textContent = "+ Add an image slot";
      addImg.addEventListener("click", () => {
        if (q.images.length >= 6) return;
        q.images.push({ label: "", src: "" });
        drawSlots();
      });
      holder.append(addImg);
      opts.append(holder);

      function drawSlots() {
        list.innerHTML = "";
        addImg.style.display = q.images.length >= 6 ? "none" : "";
        q.images.forEach((im, idx) => {
          const slot = document.createElement("div");
          slot.className = "img-slot";

          if (im.src) {
            const th = document.createElement("img");
            th.className = "img-slot-thumb";
            th.src = im.src;
            th.alt = "";
            slot.append(th);
          } else {
            const ph = document.createElement("div");
            ph.className = "img-slot-empty";
            ph.textContent = "no image";
            slot.append(ph);
          }

          const label = document.createElement("input");
          label.type = "text";
          label.placeholder = "Label (shows in results)";
          label.value = im.label || "";
          label.addEventListener("input", () => (im.label = label.value));
          slot.append(label);

          const file = document.createElement("input");
          file.type = "file";
          file.accept = "image/*";
          file.hidden = true;
          file.addEventListener("change", async () => {
            if (!file.files[0]) return;
            try {
              im.src = await resizeImage(file.files[0]);
              drawSlots();
            } catch (err) { alert(err.message); }
          });
          slot.append(file);

          const up = document.createElement("button");
          up.type = "button";
          up.className = "btn btn--sun btn--sm";
          up.textContent = im.src ? "Replace" : "Upload";
          up.addEventListener("click", () => file.click());
          slot.append(up);

          const rm = document.createElement("button");
          rm.type = "button";
          rm.className = "icon-btn";
          rm.title = "Remove this image";
          rm.setAttribute("aria-label", "Remove this image");
          rm.textContent = "\u2715";
          rm.addEventListener("click", () => { q.images.splice(idx, 1); drawSlots(); });
          slot.append(rm);

          list.append(slot);
        });
      }
      drawSlots();
    }
  }
  renderTypeFields();

  // events
  card.addEventListener("input", (e) => {
    const f = e.target.dataset.field;
    if (!f) return;
    if (f === "options") q.options = e.target.value.split("\n").map((s) => s.trim()).filter(Boolean);
    else if (f === "required" || f === "allowOther") q[f] = e.target.checked;
    else if (f === "min" || f === "max") q[f] = e.target.value === "" ? null : Number(e.target.value);
    else q[f] = e.target.value;
  });
  head.querySelector('[data-field="type"]').addEventListener("change", (e) => {
    q.type = e.target.value;
    if (q.type === "multiple" && !q.options) q.options = ["Option 1", "Option 2"];
    if (q.type === "imagechoice" && !q.images) q.images = [{ label: "", src: "" }, { label: "", src: "" }];
    if (q.type === "slider") { q.min = q.min ?? 1; q.max = q.max ?? 5; }
    renderTypeFields();
  });
  card.addEventListener("click", (e) => {
    const act = e.target.dataset.act;
    if (!act) return;
    const idx = QUESTIONS.indexOf(q);
    if (act === "delete") {
      if (confirm(`Delete "${q.title || "this question"}"? Answers already collected for it stay in the CSV export but won't be charted.`)) {
        QUESTIONS.splice(idx, 1);
      }
    }
    if (act === "up" && idx > 0) [QUESTIONS[idx - 1], QUESTIONS[idx]] = [QUESTIONS[idx], QUESTIONS[idx - 1]];
    if (act === "down" && idx < QUESTIONS.length - 1) [QUESTIONS[idx + 1], QUESTIONS[idx]] = [QUESTIONS[idx], QUESTIONS[idx + 1]];
    QUESTIONS.forEach((qq, n) => (qq.order = n + 1));
    renderBuilder();
  });

  return card;
}

$("#saveQuestionsBtn").addEventListener("click", async () => {
  const status = $("#saveStatus");
  const missing = QUESTIONS.filter((q) => !q.title.trim());
  if (missing.length) {
    status.textContent = "Every question needs a title before saving.";
    return;
  }
  for (const q of QUESTIONS) {
    if (q.type === "imagechoice") {
      q.images = (q.images || []).filter((im) => im.src); // drop empty slots
      if (q.images.length < 2) {
        status.textContent = `"${q.title}" needs at least 2 uploaded images.`;
        return;
      }
      if (JSON.stringify(q).length > 900000) {
        status.textContent = `"${q.title}" has too much image data — remove an image or upload smaller ones.`;
        return;
      }
    }
  }
  QUESTIONS.forEach((q, n) => (q.order = n + 1));
  status.textContent = "Saving...";
  try {
    await saveQuestions(QUESTIONS);
    status.textContent = isDemo ? "Saved (demo only — not persisted)." : "Saved! The survey is updated.";
    renderCharts();
  } catch (err) {
    console.error(err);
    status.textContent = "Save failed — check the console and your Firestore rules.";
  }
});

// ============================================================
// SETTINGS — change password
// ============================================================
$("#changePwBtn").addEventListener("click", async () => {
  const msg = $("#pwMsg");
  const current = $("#currentPw").value;
  const a = $("#newPw").value;
  const b = $("#newPw2").value;
  if (a.length < 8) { msg.textContent = "New password needs at least 8 characters."; return; }
  if (a !== b) { msg.textContent = "The two new passwords don't match."; return; }
  try {
    const stored = await getPasswordHash();
    if ((await sha256(current)) !== stored) { msg.textContent = "Current password didn't match."; return; }
    await setPasswordHash(await sha256(a));
    msg.textContent = isDemo ? "Updated (demo only — resets on refresh)." : "Password updated. Share the new one with the team.";
    $("#currentPw").value = $("#newPw").value = $("#newPw2").value = "";
  } catch (err) {
    console.error(err);
    msg.textContent = "Couldn't update — check your connection.";
  }
});

// ============================================================
function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}

// boot
if (sessionStorage.getItem("pda_admin") === "1") {
  openDashboard();
} else {
  checkSetup();
}
