import { useState } from "react";

const API_URL = "/api/analyze";

const SAMPLES = [
  {
    label: "Suspicious $1,420 quote",
    text: `Maaco Auto Service — Estimate
2022 Honda Civic, 31k miles
- Front brake pads + rotors ............ $480
- Synthetic oil change ................. $90
- Engine flush ......................... $150
- Fuel system flush .................... $160
- Cabin air filter replacement ......... $80
- Coolant flush ........................ $170
- Control arm replacement (bent) ....... $290
TOTAL .................................. $1420`,
  },
  {
    label: "Mostly fair quote",
    text: `- Front brake pads ..................... $180
- Synthetic oil change ................. $85
- Battery replacement .................. $210
TOTAL .................................. $475`,
  },
  {
    label: "Inspection-heavy quote",
    text: `- Struts and shocks, all four (worn) ... $1100
- Wheel alignment ...................... $120
- Tire rotation ........................ $40
TOTAL .................................. $1260`,
  },
];

const BUCKETS = {
  verified: { emoji: "✓", className: "badge verified", label: "Verified" },
  flagged: { emoji: "✕", className: "badge flagged", label: "Flagged" },
  inspection: { emoji: "‼", className: "badge inspection", label: "Inspection" },
};

export default function App() {
  const [text, setText] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState(null);

  function loadSample(sample) {
    setText(sample.text);
    setResult(null);
    setError("");
  }

  function onFileChange(e) {
    const file = e.target.files && e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const base64 = String(reader.result).split(",")[1];
      const isPdf = file.type === "application/pdf" || /\.pdf$/i.test(file.name);
      runAnalyze({ file_base64: base64, media_type: isPdf ? "application/pdf" : file.type || "image/jpeg" });
    };
    reader.readAsDataURL(file);
  }

  async function runAnalyze(payload) {
    setLoading(true);
    setError("");
    setResult(null);
    try {
      const res = await fetch(API_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const detail = await res.text();
        throw new Error(detail || `Request failed (${res.status})`);
      }
      const data = await res.json();
      setResult(data);
    } catch (err) {
      setError(err.message || "Something went wrong.");
    } finally {
      setLoading(false);
    }
  }

  function analyzeText() {
    if (!text.trim()) return;
    runAnalyze({ text });
  }

  return (
    <div className="app">
      <header className="header">
        <h1>Second Opinion</h1>
        <p className="tagline">Don't get fleeced at the repair shop — paste a quote, get the truth.</p>
      </header>

      <section className="input-card">
        <div className="samples">
          <span className="samples-label">Try a sample:</span>
          {SAMPLES.map((s) => (
            <button key={s.label} className="sample-btn" onClick={() => loadSample(s)}>
              {s.label}
            </button>
          ))}
        </div>

        <textarea
          className="quote-input"
          placeholder="Paste the repair shop's quote here…"
          value={text}
          onChange={(e) => setText(e.target.value)}
          rows={10}
        />

        <div className="actions">
          <button className="analyze-btn" onClick={analyzeText} disabled={loading || !text.trim()}>
            {loading ? <><span className="spinner" /> Analyzing…</> : "Analyze"}
          </button>
          <label className="file-label">
            📎 Upload a photo or PDF
            <input type="file" accept="image/*,application/pdf,.pdf" onChange={onFileChange} disabled={loading} hidden />
          </label>
        </div>

        {error && <div className="error">⚠️ {error}</div>}
      </section>

      {result && (
        <section className="results">
          <div className="verdict">
            <div className="verdict-col">
              <span className="verdict-label">Quoted total</span>
              <span className="verdict-quoted">${result.quoted_total}</span>
            </div>
            <div className="verdict-arrow">vs</div>
            <div className="verdict-col">
              <span className="verdict-label">Fair total</span>
              <span className="verdict-fair">{result.fair_total_range}</span>
            </div>
          </div>

          {result.summary && <p className="summary">{result.summary}</p>}

          <div className="line-items">
            {result.line_items.map((item, i) => {
              const b = BUCKETS[item.bucket] || BUCKETS.flagged;
              return (
                <div key={i} className={`line-item ${item.bucket}`}>
                  <div className="li-top">
                    <span className={b.className}>{b.emoji} {b.label}</span>
                    <span className="li-desc">{item.description}</span>
                    <span className="li-price">${item.quoted_price}</span>
                  </div>
                  <div className="li-meta">
                    <span className="li-fair">Fair range: {item.fair_range}</span>
                  </div>
                  <p className="li-reason">{item.reason}</p>
                </div>
              );
            })}
          </div>

          {result.questions_for_shop && result.questions_for_shop.length > 0 && (
            <div className="questions">
              <h3>Questions to ask the shop</h3>
              <ul>
                {result.questions_for_shop.map((q, i) => (
                  <li key={i}>{q}</li>
                ))}
              </ul>
            </div>
          )}
        </section>
      )}
    </div>
  );
}
