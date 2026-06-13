import base64
import json
import os
from typing import Optional

from dotenv import load_dotenv
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from google import genai
from google.genai import types
from pydantic import BaseModel

load_dotenv()

MODEL = "gemini-2.5-flash"

app = FastAPI(title="Second Opinion")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

client = genai.Client(api_key=os.environ.get("GEMINI_API_KEY"))

# Assume regional labor rate $100-$180/hr.
REFERENCE_TABLE = [
    {"job": "Front brake pads (per axle)", "parts": "$40–$90", "labor_hrs": "1.0–1.5", "commonly_upsold": False, "needs_inspection": False},
    {"job": "Brake rotors (pair)", "parts": "$80–$200", "labor_hrs": "included with pads", "commonly_upsold": False, "needs_inspection": False},
    {"job": "Synthetic oil change", "parts": "—", "labor_hrs": "—", "fair_total": "$60–$100", "commonly_upsold": False, "needs_inspection": False},
    {"job": "Engine air filter", "parts": "$15–$40", "labor_hrs": "0.2", "commonly_upsold": True, "needs_inspection": False},
    {"job": "Cabin air filter", "parts": "$15–$35", "labor_hrs": "0.3", "commonly_upsold": True, "needs_inspection": False},
    {"job": "Engine flush", "parts": "—", "labor_hrs": "—", "fair_total": "$80–$150", "commonly_upsold": True, "needs_inspection": False},
    {"job": "Fuel system flush", "parts": "—", "labor_hrs": "—", "fair_total": "$80–$160", "commonly_upsold": True, "needs_inspection": False},
    {"job": "Coolant flush", "parts": "—", "labor_hrs": "—", "fair_total": "$100–$180", "commonly_upsold": True, "needs_inspection": False},
    {"job": "Transmission flush", "parts": "—", "labor_hrs": "—", "fair_total": "$150–$300", "commonly_upsold": True, "needs_inspection": False},
    {"job": "Battery replacement", "parts": "$120–$250", "labor_hrs": "0.3", "commonly_upsold": False, "needs_inspection": False},
    {"job": "Spark plugs (4-cyl)", "parts": "$30–$80", "labor_hrs": "1.0–2.0", "commonly_upsold": False, "needs_inspection": False},
    {"job": "Serpentine belt", "parts": "$25–$75", "labor_hrs": "0.8–1.2", "commonly_upsold": False, "needs_inspection": False},
    {"job": "Alternator", "parts": "$150–$400", "labor_hrs": "1.5–2.5", "commonly_upsold": False, "needs_inspection": False},
    {"job": "Wheel alignment", "parts": "—", "labor_hrs": "—", "fair_total": "$80–$150", "commonly_upsold": False, "needs_inspection": False},
    {"job": "Tire rotation", "parts": "—", "labor_hrs": "—", "fair_total": "$20–$50", "commonly_upsold": True, "needs_inspection": False},
    {"job": "Control arm replacement", "parts": "$80–$250", "labor_hrs": "1.5–3.0", "commonly_upsold": False, "needs_inspection": True},
    {"job": "Struts / shocks (pair)", "parts": "$150–$400", "labor_hrs": "2.0–4.0", "commonly_upsold": False, "needs_inspection": True},
]

SYSTEM_PROMPT = """You are a consumer-advocate auto-repair analyst. Your job is to protect \
a car owner from being overcharged on a repair quote.

CRITICAL RULES:
- You judge prices ONLY using the REFERENCE TABLE provided in the user message. \
Never invent prices or rely on prices from memory. If an item is not in the table, \
say so honestly and do not guess a fair range.
- Assume a regional labor rate of $100–$180/hr when reasoning about jobs that list labor hours.
- For any claim that cannot be confirmed from a written quote alone (e.g. "bent control arm", \
"worn struts") — i.e. table rows flagged needs_inspection — you must defer to a human mechanic \
and tell the user to get a physical second opinion before approving.

Classify EACH line item into exactly one bucket, applying these rules IN ORDER:
1. If the matching table row has needs_inspection = true (e.g. control arm, struts/shocks), \
the bucket is "inspection" — a quote alone cannot confirm the claim. Defer to a human mechanic. \
This overrides price considerations.
2. Else if the matching table row has commonly_upsold = true (e.g. flushes, air filters, tire \
rotation), the bucket is "flagged" — it is a known upsell. Tell the user to push back.
3. Else if the price is WELL above the fair range (roughly 20% or more over the top of the \
range), the bucket is "flagged" for overpricing.
4. Otherwise the bucket is "verified". IMPORTANT: "verified" means within OR NEAR the fair \
range. Treat a price up to ~10–15% above the computed ceiling as "near" — do NOT flag a small \
overage. A non-upsell item priced at or close to the top of its fair range is still "verified".

For fair_total_range, sum only the priceable, verifiable items; exclude items needing inspection \
and note that exclusion.

Return ONLY valid JSON. No markdown fences, no prose, no commentary. The JSON must match this \
shape EXACTLY:
{
  "quoted_total": <number>,
  "fair_total_range": "<string>",
  "line_items": [
    {
      "description": "<string>",
      "quoted_price": <number>,
      "bucket": "verified" | "flagged" | "inspection",
      "fair_range": "<string>",
      "reason": "<string>"
    }
  ],
  "questions_for_shop": ["<string>", ...],
  "summary": "<string>"
}"""


class AnalyzeRequest(BaseModel):
    text: Optional[str] = None
    # Base64 of an uploaded file (image OR PDF). `image_base64` kept for back-compat.
    file_base64: Optional[str] = None
    image_base64: Optional[str] = None
    media_type: Optional[str] = None


def strip_fences(raw: str) -> str:
    s = raw.strip()
    if s.startswith("```"):
        # remove opening fence (``` or ```json) and trailing fence
        s = s.split("\n", 1)[1] if "\n" in s else s
        if s.endswith("```"):
            s = s[: -3]
        # handle a leading "json" left after fence removal
        if s.lstrip().startswith("json"):
            s = s.lstrip()[4:]
    return s.strip()


def build_contents(req: AnalyzeRequest):
    table_str = json.dumps(REFERENCE_TABLE, indent=2, ensure_ascii=False)
    instructions = (
        "Analyze the following car repair quote against the reference table.\n\n"
        "REFERENCE TABLE (the ONLY source of truth for fair prices):\n"
        f"{table_str}\n\n"
    )

    blob = req.file_base64 or req.image_base64
    if blob:
        mime = req.media_type or "image/jpeg"
        kind = "PDF document" if mime == "application/pdf" else "image"
        file_part = types.Part.from_bytes(
            data=base64.b64decode(blob),
            mime_type=mime,
        )
        return [
            instructions + f"The quote is in the attached {kind}. Read/OCR it and analyze it.",
            file_part,
        ]

    return [instructions + "QUOTE TO ANALYZE:\n" + (req.text or "")]


@app.post("/api/analyze")
def analyze(req: AnalyzeRequest):
    if not req.text and not req.file_base64 and not req.image_base64:
        raise HTTPException(status_code=400, detail="Provide 'text', or a file via 'file_base64'.")

    response = client.models.generate_content(
        model=MODEL,
        contents=build_contents(req),
        config=types.GenerateContentConfig(
            system_instruction=SYSTEM_PROMPT,
            max_output_tokens=4096,
            response_mime_type="application/json",
            thinking_config=types.ThinkingConfig(thinking_budget=0),
        ),
    )

    raw = response.text or ""
    cleaned = strip_fences(raw)

    try:
        return json.loads(cleaned)
    except json.JSONDecodeError:
        raise HTTPException(status_code=500, detail=f"Model did not return valid JSON:\n{raw}")
