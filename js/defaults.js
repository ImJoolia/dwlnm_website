// The 15 starter questions, transcribed from SITE Survey 2026_Draft.
// Question types: "short" | "multiple" | "yesno" | "slider" | "number"

export const DEFAULT_PASSWORD = "yaypda";

// Tiny built-in placeholder images (SVG data URLs) for the example
// image-choice question. Staff replace these with real photos via the
// Upload button in the dashboard's Questions tab.
const tile = (bg, shape) =>
  "data:image/svg+xml," +
  encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 150"><rect width="200" height="150" fill="${bg}"/>${shape}</svg>`);

export const EXAMPLE_IMAGE_QUESTION = {
  id: "q16", order: 16, type: "imagechoice", required: false,
  title: "Which image feels closest to how your visit felt?",
  images: [
    { label: "Calm",       src: tile("#0F416F", '<circle cx="100" cy="75" r="42" fill="#25BEC0"/>') },
    { label: "Curious",    src: tile("#D7DF21", '<circle cx="66" cy="75" r="28" fill="none" stroke="#000000" stroke-width="7"/><circle cx="100" cy="75" r="28" fill="none" stroke="#000000" stroke-width="7"/><circle cx="134" cy="75" r="28" fill="none" stroke="#000000" stroke-width="7"/>') },
    { label: "Energized",  src: tile("#ED217C", '<path d="M20 110 L60 40 L100 110 L140 40 L180 110" fill="none" stroke="#ffffff" stroke-width="10" stroke-linecap="round" stroke-linejoin="round"/>') },
    { label: "Reflective", src: tile("#25BEC0", '<path d="M45 130 A55 55 0 0 1 155 130 Z" fill="#ffffff"/>') },
    { label: "Playful",    src: tile("#8685C0", '<g fill="#D7DF21"><circle cx="50" cy="45" r="12"/><circle cx="100" cy="45" r="12"/><circle cx="150" cy="45" r="12"/><circle cx="50" cy="105" r="12"/><circle cx="100" cy="105" r="12"/><circle cx="150" cy="105" r="12"/></g>') },
    { label: "Rushed",     src: tile("#000000", '<g stroke="#D7DF21" stroke-width="9" stroke-linecap="round"><line x1="30" y1="120" x2="90" y2="30"/><line x1="80" y1="120" x2="140" y2="30"/><line x1="130" y1="120" x2="190" y2="30"/></g>') },
  ],
};

export const DEFAULT_QUESTIONS = [
  {
    id: "q01", order: 1, type: "short", required: true,
    title: "Email",
    placeholder: "you@example.com",
  },
  {
    id: "q02", order: 2, type: "multiple", required: true,
    title: "How many times have you visited SITE Santa Fe?",
    options: ["0", "1", "2-4", "5-9", "10+"], allowOther: false,
  },
  {
    id: "q03", order: 3, type: "multiple", required: true,
    title: "How many museums do you visit in a typical year?",
    options: ["0", "1", "2-4", "5-9", "10+"], allowOther: false,
  },
  {
    id: "q04", order: 4, type: "multiple", required: true,
    title: "How far do you travel to visit SITE Santa Fe?",
    options: ["5 miles or less", "5-20 miles", "20-50 miles", "50+ miles"], allowOther: false,
  },
  {
    id: "q05", order: 5, type: "multiple", required: true,
    title: "What brings you to SITE Santa Fe...",
    options: ["Art", "An event", "Curiosity", "I just like to pass by", "Friends or Family", "It's Free!"],
    allowOther: true,
  },
  {
    id: "q06", order: 6, type: "yesno", required: true,
    title: "Are you a SITE Santa Fe member?", allowOther: false,
  },
  {
    id: "q07", order: 7, type: "multiple", required: true,
    title: "How many photos do you typically take during your visits?",
    options: ["0", "1-5", "6-15", "15+"], allowOther: false,
  },
  {
    id: "q08", order: 8, type: "yesno", required: true,
    title: "Do you typically leave your belongings at the front desk cubbies?", allowOther: false,
  },
  {
    id: "q09", order: 9, type: "yesno", required: true,
    title: "Do you typically visit the bathroom? If not, please specify", allowOther: true,
  },
  {
    id: "q10", order: 10, type: "yesno", required: true,
    title: "Do you typically attend with a specific exhibition in mind?", allowOther: false,
  },
  {
    id: "q11", order: 11, type: "multiple", required: true,
    title: "How many times do you typically ask someone for directions?",
    options: ["Once", "Twice", "More than twice"], allowOther: false,
  },
  {
    id: "q12", order: 12, type: "multiple", required: true,
    title: "How often do you visit SITE Santa Fe in a month?",
    options: ["Once", "Twice", "More than twice"], allowOther: true,
  },
  {
    id: "q13", order: 13, type: "multiple", required: true,
    title: "Are your visits often relaxed or rushed? If rushed, why?",
    options: ["Relaxed", "Rushed"], allowOther: true,
  },
  {
    id: "q14", order: 14, type: "slider", required: true,
    title: "How comfortable are you in the space? Lighting? Seating? Temperature?...",
    min: 1, max: 5, minLabel: "I am comfortable", maxLabel: "I am uncomfortable",
  },
  {
    id: "q15", order: 15, type: "short", required: false,
    title: "If uncomfortable, why?",
    placeholder: "Your answer",
  },
  EXAMPLE_IMAGE_QUESTION,
];
