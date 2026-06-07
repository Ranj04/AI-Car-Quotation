# Second Opinion 🔧

An AI repair-quote analyzer. Paste, photograph, or upload a PDF of a car repair shop's
quote and get a **line-by-line analysis** graded against a fixed reference price table,
plus a script of questions to ask the shop.

The AI never invents prices — it reasons *only* against a hardcoded reference table that
is injected into every prompt. Anything it can't price or that needs a physical inspection,
it says so honestly.

## What it does

Each line item is sorted into one of three buckets:

| Badge | Bucket | Meaning |
|-------|--------|---------|
| ✅ | **verified** | Priced within or near the table's fair range. |
| 🚩 | **flagged** | A known upsell, unnecessary bundle, or priced well above fair range — push back. |
| ⚠️ | **inspection** | A claim a quote alone can't confirm (e.g. "bent control arm"). Get a physical second opinion. |

You also get a verdict banner (quoted total vs. fair range) and a list of questions to ask
the shop.

## Stack

- **Backend:** FastAPI + Google Gemini (`gemini-2.5-flash`) via the `google-genai` SDK.
- **Frontend:** Vite + React (plain JS), plain CSS.
- **Input:** pasted text, a photo (image OCR), or a **PDF** — all handled by one `/analyze` endpoint.

## Project structure

```
second-opinion/
  package.json         # root launcher — runs backend + frontend together
  backend/
    main.py            # FastAPI app, reference table, prompt, /analyze endpoint
    requirements.txt
    .env.example       # GEMINI_API_KEY=
  frontend/
    src/App.jsx        # the entire UI
    src/App.css
```

## Setup (first time)

```bash
cd second-opinion
npm install                              # installs the launcher (concurrently)
npm run setup                            # installs backend + frontend deps
cp backend/.env.example backend/.env     # then paste your GEMINI_API_KEY into it
```

Get a free Gemini API key at https://aistudio.google.com → "Get API key".

## Run (one terminal)

```bash
npm run dev
```

- Frontend → http://localhost:5173
- Backend  → http://localhost:8000

Ctrl+C stops both. Open the frontend, click a sample quote (or upload a photo/PDF), and
hit **Analyze**.

## API

`POST /analyze` accepts JSON with any one of:

```jsonc
{ "text": "<quote text>" }
{ "file_base64": "<base64>", "media_type": "image/jpeg" }      // photo
{ "file_base64": "<base64>", "media_type": "application/pdf" } // PDF
```

Returns:

```jsonc
{
  "quoted_total": 1420,
  "fair_total_range": "$520–$660 (excluding items needing inspection)",
  "line_items": [
    {
      "description": "Front brake pads + rotors",
      "quoted_price": 480,
      "bucket": "verified",
      "fair_range": "$350–$450",
      "reason": "Within fair range for pads + rotors with labor."
    }
  ],
  "questions_for_shop": ["..."],
  "summary": "One or two sentences the user can act on."
}
```

## Notes

- The reference table and labor-rate assumption ($100–$180/hr) live in `backend/main.py`.
  Edit the table there to tune the analysis.
- `backend/.env` is gitignored — your API key never gets committed.
