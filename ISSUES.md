# ISSUES.md — Second Opinion audit

Audited against a **real local run** (FastAPI backend on `:8000`, Vite build, and one
end-to-end analysis per built-in sample). The backend's analysis logic is correct: all
three sample quotes returned valid JSON with correct bucketing
(verified / flagged / inspection). The problems are all in the wiring needed to run in
production / on Vercel.

## How I reproduced behavior
- `python -m uvicorn main:app --port 8000` → booted clean (only unrelated Python-3.9
  EOL `FutureWarning`s, which won't appear on Vercel's Python 3.12).
- `POST /analyze` for all three built-in samples → correct buckets, valid JSON.
  - Sample 1 ("$1,420"): brakes/oil = verified, the four flushes/filter = flagged,
    bent control arm = inspection. ✅
  - Sample 2 ("mostly fair"): all three verified. ✅
  - Sample 3 ("inspection-heavy"): struts = inspection, alignment = verified,
    tire rotation = flagged. ✅
- `npm run build` (frontend) → built clean, no warnings.

---

## Issue 1 — Frontend hardcodes the localhost backend URL (functional; breaks in prod)
- **Broken:** `frontend/src/App.jsx` line 3: `const API_URL = "http://localhost:8000/analyze";`
  The deployed site would call `http://localhost:8000` *from the visitor's browser*, which
  has no such server → every analysis fails (connection refused / mixed-content).
- **Reproduced:** the value is a literal `localhost:8000`; it only works because a backend
  happens to run locally. Nothing points it at the production API.
- **Fix:** call the backend via a **relative** path `"/api/analyze"` (same-origin in prod),
  and add a Vite dev proxy so `npm run dev` still reaches the local backend.

## Issue 2 — No Vercel deployment wiring (blocks deploy)
- **Broken:** there is no serverless entrypoint, no `vercel.json`, and no `requirements.txt`
  in the location Vercel reads. Nothing is deployable as a Vercel project.
- **Reproduced:** repo has only `backend/` + `frontend/`; no `api/`, no `vercel.json`,
  no root `requirements.txt`.
- **Fix:** add `api/index.py` exposing the existing FastAPI `app`; add `vercel.json` that
  builds the frontend (static) and rewrites `/api/(.*)` to the function; add a root
  `requirements.txt` (the location Vercel's Python runtime reads). Default Vercel Python is
  3.12, which runs this code fine.

## Issue 3 — Backend route won't match the path Vercel delivers (coupled to 1 & 2)
- **Broken:** the route is `@app.post("/analyze")`. Per current Vercel docs the `/api`
  prefix is **passed through** to the ASGI app (their example registers
  `@app.get("/api/...")`). With the `/api/*` rewrite, FastAPI would receive `/api/analyze`
  and return 404.
- **Reproduced:** confirmed against Vercel's current FastAPI/Python runtime docs
  (last updated 2026-05-04).
- **Fix:** register the route as `@app.post("/api/analyze")`. The Vite dev proxy forwards
  `/api` unchanged, so local dev hits the same path.

---

## Not bugs (observed, left alone per scope)
- CORS middleware allows `http://localhost:5173`. In prod the frontend and API are
  same-origin, and the dev proxy is server-side, so CORS isn't exercised — harmless,
  pre-existing, untouched.
- `strip_fences()` is effectively redundant because the call sets
  `response_mime_type="application/json"`, but it's harmless. Left as-is.
- `image_base64` back-compat field in `AnalyzeRequest` is unused by the frontend but is
  intentional back-compat. Left as-is.
