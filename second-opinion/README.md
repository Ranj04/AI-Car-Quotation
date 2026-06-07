# Second Opinion

AI repair-quote analyzer. Paste (or photograph) a car repair quote and get a line-by-line
analysis graded against a fixed reference table, plus questions to ask the shop.
Backend uses Google Gemini (`gemini-2.5-flash`).

## Run (one terminal)

First time only — install deps and add your key:
```
cd second-opinion
npm install                       # installs the launcher (concurrently)
npm run setup                     # installs backend + frontend deps
cp backend/.env.example backend/.env   # then paste your GEMINI_API_KEY into it
```

Then, to start backend + frontend together:
```
npm run dev
```

- Frontend: http://localhost:5173
- Backend:  http://localhost:8000

Ctrl+C stops both.
