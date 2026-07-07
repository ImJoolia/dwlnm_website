import { loadQuestions, submitResponse, isDemo } from "./db.js";

const $ = (sel, el = document) => el.querySelector(sel);

// ---------- marquee ----------
const phrases = "Yay for PDA! 〰️ SITE Survey 2026 〰️ Tell us everything 〰️ ";
$("#marqueeTrack").textContent = phrases.repeat(8);

if (isDemo) $("#demoBanner").hidden = false;

// ---------- render ----------
let QUESTIONS = [];

function el(tag, attrs = {}, ...children) {
  const node = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (k === "class") node.className = v;
    else if (k.startsWith("on")) node.addEventListener(k.slice(2), v);
    else if (v !== null && v !== undefined) node.setAttribute(k, v);
  }
  for (const c of children) node.append(c);
  return node;
}

function choiceRow(q, options, layoutClass) {
  const wrap = el("div", { class: layoutClass, role: "radiogroup", "aria-label": q.title });
  const other = q.allowOther
    ? el("input", { type: "text", class: "other-input", id: q.id + "_other", placeholder: "Tell us more...", "aria-label": "Other — please specify" })
    : null;

  const all = q.allowOther ? [...options, "Other"] : options;
  for (const opt of all) {
    const input = el("input", { type: "radio", name: q.id, value: opt });
    const label = el("label", { class: "choice" }, input, el("span", { class: "dot", "aria-hidden": "true" }), el("span", {}, opt));
    input.addEventListener("change", () => {
      wrap.querySelectorAll(".choice").forEach((c) => c.classList.remove("selected"));
      label.classList.add("selected");
      if (other) other.classList.toggle("visible", opt === "Other");
      label.closest(".q-card").classList.remove("q-error");
    });
    wrap.append(label);
  }
  const box = el("div", {});
  box.append(wrap);
  if (other) box.append(other);
  return box;
}

function renderQuestion(q, i) {
  const card = el("div", { class: "card q-card", id: "card_" + q.id });
  const title = el("h2", { class: "q-title" }, q.title);
  if (q.required) title.append(el("span", { class: "req-star", "aria-hidden": "true" }, " *"));
  card.append(el("div", { class: "q-top" }, el("span", { class: "q-num", "aria-hidden": "true" }, String(i + 1)), title));

  const body = el("div", { class: "q-body" });

  if (q.type === "short") {
    body.append(el("input", {
      type: q.title.toLowerCase().includes("email") ? "email" : "text",
      id: q.id, placeholder: q.placeholder || "Your answer",
      oninput: () => card.classList.remove("q-error"),
    }));
  } else if (q.type === "number") {
    body.append(el("input", {
      type: "number", id: q.id, placeholder: q.placeholder || "0",
      min: q.min ?? null, max: q.max ?? null, style: "max-width:180px",
      oninput: () => card.classList.remove("q-error"),
    }));
  } else if (q.type === "yesno") {
    body.append(choiceRow(q, ["Yes", "No"], "choice-row choices"));
  } else if (q.type === "multiple") {
    body.append(choiceRow(q, q.options || [], "choices"));
  } else if (q.type === "imagechoice") {
    const grid = el("div", { class: "img-choices", role: "radiogroup", "aria-label": q.title });
    (q.images || []).filter((im) => im.src).forEach((img, idx) => {
      const name = img.label || "Option " + (idx + 1);
      const btn = el("button", { type: "button", class: "img-choice", "aria-pressed": "false" },
        el("img", { src: img.src, alt: name }),
        el("span", { class: "img-choice-label" }, name));
      btn.addEventListener("click", () => {
        grid.querySelectorAll(".img-choice").forEach((b) => { b.classList.remove("selected"); b.setAttribute("aria-pressed", "false"); });
        btn.classList.add("selected");
        btn.setAttribute("aria-pressed", "true");
        grid.dataset.value = name;
        card.classList.remove("q-error");
      });
      grid.append(btn);
    });
    body.append(grid);
  } else if (q.type === "slider") {
    const min = q.min ?? 1, max = q.max ?? 5;
    const start = Math.round((min + max) / 2);
    const valueChip = el("span", { class: "slider-value", id: q.id + "_val" }, String(start));
    const range = el("input", { type: "range", id: q.id, min, max, step: 1, value: start, "aria-label": q.title });
    range.addEventListener("input", () => {
      valueChip.textContent = range.value;
      range.dataset.touched = "1";
      card.classList.remove("q-error");
    });
    const ticks = el("div", { class: "slider-ticks" });
    for (let t = min; t <= max; t++) ticks.append(el("span", {}, String(t)));
    body.append(el("div", { class: "slider-wrap" },
      el("div", { class: "slider-labels" }, el("span", {}, q.minLabel || String(min)), el("span", {}, q.maxLabel || String(max))),
      valueChip, range, ticks,
    ));
  }

  body.append(el("p", { class: "q-error-msg" }, "This one's required — give it an answer to continue."));
  card.append(body);
  return card;
}

async function init() {
  try {
    QUESTIONS = await loadQuestions();
  } catch (err) {
    console.error(err);
    $("#loadError").hidden = false;
    $("#submitBtn").disabled = true;
    return;
  }
  const holder = $("#questions");
  holder.innerHTML = "";
  QUESTIONS.forEach((q, i) => holder.append(renderQuestion(q, i)));
}

// ---------- collect + validate ----------
function collect() {
  const answers = {};
  let firstError = null;

  for (const q of QUESTIONS) {
    const card = $("#card_" + q.id);
    let value = null;

    if (q.type === "short" || q.type === "number") {
      value = $("#" + q.id).value.trim();
      if (q.type === "number" && value !== "") value = Number(value);
    } else if (q.type === "yesno" || q.type === "multiple") {
      const checked = card.querySelector(`input[name="${q.id}"]:checked`);
      value = checked ? checked.value : null;
      if (value === "Other") {
        const otherText = ($("#" + q.id + "_other")?.value || "").trim();
        answers[q.id + "_other"] = otherText;
      }
    } else if (q.type === "imagechoice") {
      value = card.querySelector(".img-choices")?.dataset.value ?? null;
    } else if (q.type === "slider") {
      const range = $("#" + q.id);
      value = range.dataset.touched ? Number(range.value) : Number(range.value);
    }

    const empty = value === null || value === "" || Number.isNaN(value);
    if (q.required && empty) {
      card.classList.add("q-error");
      if (!firstError) firstError = card;
    } else if (!empty) {
      answers[q.id] = value;
    }
  }
  return { answers, firstError };
}

async function submitSurvey() {
  const { answers, firstError } = collect();
  if (firstError) {
    firstError.scrollIntoView({ behavior: "smooth", block: "center" });
    return;
  }
  const btn = $("#submitBtn");
  btn.disabled = true;
  btn.textContent = "Sending...";
  try {
    const res = await submitResponse(answers);
    $("#surveyForm").hidden = true;
    $("#heroSection").hidden = true;
    $("#successView").hidden = false;
    if (res.demo) $("#successView").querySelector("p").textContent = "Demo mode — this answer wasn't saved, but the real thing will be.";
    window.scrollTo({ top: 0, behavior: "smooth" });
  } catch (err) {
    console.error(err);
    btn.disabled = false;
    btn.textContent = "Submit my answers";
    alert("Something went wrong sending your answers. Please try again.");
  }
}

$("#submitBtn").addEventListener("click", submitSurvey);
$("#surveyForm").addEventListener("submit", (e) => { e.preventDefault(); submitSurvey(); });

init();
