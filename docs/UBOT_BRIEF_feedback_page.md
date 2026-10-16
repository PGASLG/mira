# Brief for U-Bot: build `feedback.html` for Mira

Paste this whole file into U-Bot, and upload these files from `public/` for reference:
`faq.html` (page skeleton), `site.css`, `site.js`, `mira.css`, `loader.js`.

## What Mira is
Mira is a Thai investing app for first-job earners. Everything is **simulated (paper) money**. It is **research and education only, not investment advice**. Never promise profit, never use words like "guaranteed", "risk-free" or "will earn". Thai is the default language, English is a toggle.

## Task
Create ONE new static page: `public/feedback.html`. Plain HTML + CSS + a small inline `<script>`. No build step, no frameworks, no external libraries, no external fonts beyond what `faq.html` already loads. It must work when opened from the `public/` folder.

Copy the structure of `faq.html` exactly:
- same `<head>` (title "Mira — Feedback", description), `site.css`, `loader.js`
- same `<header class="s-head">` with the logo, `s-links` nav, language button and sign-in button (add a "Feedback / ข้อเสนอแนะ" link to the nav of the new page only; do not edit other pages)
- same `<footer class="s-foot">` as `faq.html`
- every visible text is a pair: `<span class="th">…</span><span class="en">…</span>` (the language switch in `site.js` shows one of them via `html[lang]`). Do not write text that exists in only one language.

## Design: "Editorial & calm" (see `mira.css`)
- Flat warm paper `#f7f6f2`, ink `#0e1b33`, brand blue `#1457d9`, yellow `#f2b01e` used sparingly, hairline rules `#d9d6cc`.
- 6px corners, no shadows, no glows, no gradients, no emoji.
- Serif headings, sans body, tabular numbers. Reuse existing classes from `site.css` (`s-wrap`, `s-btn`, etc.) instead of inventing a new system. Use CSS variables (`--ink`, `--line`, `--blue`, `--red`, `--green`), never hard-coded colours, so dark mode works.
- Mobile first: 375px wide must look right, 16px side gutters, no horizontal scroll, tap targets at least 44px.
- Accessible: real `<label>` for every field, visible focus ring, form errors announced with `aria-live="polite"`, works with keyboard only.

## Page content
1. Heading + one sentence: "Tell us what is confusing, broken or missing. We read every message."
2. Form:
   - **Type** (radio buttons): Bug / Idea / Something confusing / Praise.
   - **Which screen** (select): Home, Dashboard, Investment, Lending (borrow), Lender (earn interest), June chat, Settings, Other.
   - **How was it?** 1–5 rating (radio group styled as five buttons).
   - **Your message** (textarea, required, 10–1000 characters, live character counter).
   - **Contact (optional)**: email only. Helper text: "Only if you want a reply."
   - **Consent checkbox (required)**: "I agree that Mira may store this message to improve the app. I understand it is not a way to ask for investment advice." (TH + EN)
   - Submit button.
3. A short honesty note under the form: "Mira is a paper-money app. Do not write real bank, card, or ID numbers here."

## Behaviour (frontend only; there is no server yet)
- Validate on submit (message length, consent, email format if given). Show inline errors, keep what the user typed.
- Build this payload object and pass it to ONE function so the backend can be wired later:
  ```js
  // TODO(mira): replace body with a POST to Supabase when the table exists
  async function submitFeedback(p) { /* p = {type, screen, rating, message, contact, consent, lang, at} */ }
  ```
  For now `submitFeedback` stores the payload as JSON in `localStorage` under the key `mira_feedback` (an array, keep only the last 20) and resolves. Wrap storage access in try/catch.
- Language `lang` comes from `document.documentElement.lang` (`th` or `en`). `at` is `new Date().toISOString()`.
- After success: replace the form with a calm confirmation (Thai + English): "Thank you. Your message is saved on this device and will be sent when feedback is connected." Do NOT claim that the team has already received it. Add a "Send another" button.
- Prefill the "Which screen" select from the query string `?from=dashboard|investment|lending|lender|june|settings`.
- Never put any form content into the URL.

## Do not
- Do not change any other file. Output only the complete `feedback.html`.
- Do not add tracking, analytics, cookies, or third-party scripts.
- Do not use the words "advice", "guarantee", "returns", "profit" in a promising way.
- Do not ask for the user's name, phone number or any government ID.

## Done when
- Opens correctly in Thai and English, light and dark mode, at 375px and 1280px.
- Submitting a valid form stores one object in `localStorage.mira_feedback` and shows the confirmation.
- Invalid input shows an error next to the field and nothing is stored.
- No console errors.
