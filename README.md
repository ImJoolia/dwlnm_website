# SITE Survey 2026 — PDA Survey Site

A two-page survey website in the Public Design Agency style:

- **`index.html`** — the survey visitors fill out (this is the link you send clients)
- **`admin.html`** — the password-protected staff dashboard, reached via the little
  lock icon in the survey header. It has three tabs:
  - **Results** — response counts, a chart or answer list for every question, and a CSV download
  - **Questions** — add, edit, reorder, and delete questions (short answer, multiple
    choice, yes/no, slider, and numerical types), with an optional "Other" write-in
  - **Settings** — change the shared team password

**Default password: `yaypda`** (change it under Settings after setup).

## Try it right now (demo mode)

Open `index.html` in a browser — no setup needed. Until Firebase is connected the
site runs in demo mode: the survey shows the 15 starter questions, and the dashboard
(sign in with the default password) shows sample charts so you can judge the design.
Nothing is saved in demo mode.

> Tip: some browsers block JS modules on double-clicked files. If the page looks
> empty, serve the folder instead: `python3 -m http.server` then open
> http://localhost:8000 — or just push to GitHub Pages, which works fine.

## Connect Firebase (~5 minutes, free)

1. Go to [console.firebase.google.com](https://console.firebase.google.com) → **Add project**
   (name it anything, e.g. `pda-site-survey`; Analytics can stay off).
2. In the project, click the **`</>` (Web)** icon to register a web app. Firebase
   shows a `firebaseConfig` object — copy those values into **`js/firebase-config.js`**.
3. In the left menu: **Build → Firestore Database → Create database**. Pick a US
   location, start in production mode.
4. Open the **Rules** tab, replace everything with the contents of
   **`firestore.rules`** from this folder, and press **Publish**.
5. Open `admin.html` in your browser. You'll see a **first-time setup** button —
   click it once. It creates the team password (`yaypda`) and loads the 15
   SITE Survey 2026 questions into the database.
6. Sign in, go to **Settings**, and change the password.

## Deploy to GitHub Pages

1. Create a new GitHub repository and upload everything in this folder
   (keep the folder structure: `css/`, `js/`, the two HTML files).
2. Repo **Settings → Pages → Source: Deploy from a branch → main → / (root)** → Save.
3. Your survey link is `https://YOUR-USERNAME.github.io/YOUR-REPO/` — that's what
   you send to clients. Staff use the lock icon (or add `/admin.html`).


## Image-choice questions

The Questions tab includes an **Image choice (pick one)** type: visitors tap one
of 2–6 images. To build one, add a question (or press **+ Add the example image
question** for a pre-made starter), then for each slot press **Upload**, pick a
photo from your computer, and give it a short label — the label is what shows
up in the results charts. Photos are automatically resized and stored inside
the database itself, so there is nothing to host, link, or maintain. Results
appear as a bar chart with a thumbnail legend underneath.

## How data is stored

Everything lives in Firestore:

- `questions/` — one document per question (edited from the Questions tab)
- `responses/` — one document per submitted survey
- `meta/config` — a SHA-256 hash of the team password (the password itself is
  never stored or sent anywhere in plain text)

The dashboard's **Responses** tab lists every submitted survey, newest first —
open one to read it, delete it with the ✕ button, or use **Delete ALL responses**
(double-confirmed) to clear the slate, e.g. after testing. Deletions are
permanent, so grab the CSV from the Results tab first if in doubt.

Any number of staff can use the dashboard at once — they all share the one password.

## An honest note about security

The password protects the **interface**, which is the right level of protection for
a visitor-experience survey: it keeps clients and casual visitors out of the
dashboard. But because this is a static site with no server, the database rules
have to stay open enough for the pages to work — meaning a determined, technical
person could read responses or edit questions directly through the Firebase API.
Don't collect anything sensitive beyond emails, and if PDA ever needs real
lock-and-key security, the upgrade path is Firebase Authentication (staff Google
sign-ins) — happy to wire that up later.

Also worth knowing: Firebase's free tier limits are roughly 50,000 reads and
20,000 writes **per day**, which is far beyond what this survey will ever touch.
