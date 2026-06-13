import { useState } from "react";
import {
  ShieldCheck,
  ScanSearch,
  Paperclip,
  AlertTriangle,
  ArrowRight,
  Sparkles,
  HelpCircle,
  ChevronRight,
  BadgeCheck,
  Flag,
  Wrench,
} from "lucide-react";

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
  verified: { Icon: BadgeCheck, className: "verified", label: "Verified" },
  flagged: { Icon: Flag, className: "flagged", label: "Flagged" },
  inspection: { Icon: Wrench, className: "inspection", label: "Inspection" },
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
      <div className="ambient" aria-hidden="true" />

      <header className="header">
        <div className="brand">
          <span className="brand-mark">
            <ShieldCheck size={20} strokeWidth={2.2} />
          </span>
          <span className="brand-kicker">Repair-Quote Audit</span>
        </div>
        <h1 className="title">Second Opinion</h1>
        <p className="tagline">
          Paste a repair shop's quote and see what's fair, what's an upsell, and what needs a real
          mechanic — every price checked against a reference table, never guessed.
        </p>
      </header>

      <section className="panel input-card">
        <div className="samples">
          <span className="samples-label">Try a sample</span>
          <div className="sample-row">
            {SAMPLES.map((s) => (
              <button key={s.label} className="sample-btn" type="button" onClick={() => loadSample(s)}>
                {s.label}
              </button>
            ))}
          </div>
        </div>

        <textarea
          className="quote-input"
          placeholder="Paste the repair shop's quote here…"
          value={text}
          onChange={(e) => setText(e.target.value)}
          rows={9}
        />

        <div className="actions">
          <button className="analyze-btn" type="button" onClick={analyzeText} disabled={loading || !text.trim()}>
            {loading ? (
              <>
                <span className="spinner" /> Analyzing…
              </>
            ) : (
              <>
                <ScanSearch size={18} strokeWidth={2.2} /> Analyze quote
              </>
            )}
          </button>
          <label className="file-label">
            <Paperclip size={16} strokeWidth={2} />
            Upload photo or PDF
            <input type="file" accept="image/*,application/pdf,.pdf" onChange={onFileChange} disabled={loading} hidden />
          </label>
        </div>

        {error && (
          <div className="error">
            <AlertTriangle size={16} strokeWidth={2} />
            <span>{error}</span>
          </div>
        )}
      </section>

      {result && (
        <section className="results">
          <div className="panel verdict">
            <div className="verdict-col">
              <span className="verdict-label">Quoted total</span>
              <span className="verdict-quoted">${result.quoted_total}</span>
            </div>
            <span className="verdict-sep">
              <ArrowRight size={18} strokeWidth={2.4} />
            </span>
            <div className="verdict-col">
              <span className="verdict-label">Fair total</span>
              <span className="verdict-fair">{result.fair_total_range}</span>
            </div>
          </div>

          {result.summary && (
            <div className="panel summary">
              <span className="summary-tag">
                <Sparkles size={14} strokeWidth={2} /> Auditor's note
              </span>
              <p>{result.summary}</p>
            </div>
          )}

          <div className="line-items">
            {result.line_items.map((item, i) => {
              const b = BUCKETS[item.bucket] || BUCKETS.flagged;
              const Icon = b.Icon;
              return (
                <article key={i} className={`panel line-item ${item.bucket}`} style={{ "--i": i }}>
                  <div className="li-icon">
                    <Icon size={18} strokeWidth={2.2} />
                  </div>
                  <div className="li-body">
                    <div className="li-top">
                      <span className="li-desc">{item.description}</span>
                      <span className="li-price">${item.quoted_price}</span>
                    </div>
                    <div className="li-meta">
                      <span className={`badge ${b.className}`}>{b.label}</span>
                      <span className="li-fair">Fair range: {item.fair_range}</span>
                    </div>
                    <p className="li-reason">{item.reason}</p>
                  </div>
                </article>
              );
            })}
          </div>

          {result.questions_for_shop && result.questions_for_shop.length > 0 && (
            <div className="panel questions">
              <h3>
                <HelpCircle size={18} strokeWidth={2.2} /> Questions to ask the shop
              </h3>
              <ul>
                {result.questions_for_shop.map((q, i) => (
                  <li key={i}>
                    <ChevronRight size={15} strokeWidth={2.6} className="q-chev" />
                    <span>{q}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </section>
      )}

      <footer className="footer">
        Prices are judged against a fixed reference table — Second Opinion flags overcharges and
        upsells, but it isn't a substitute for a licensed mechanic's inspection.
      </footer>
    </div>
  );
}
