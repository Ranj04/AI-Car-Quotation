import os
import sys

# The FastAPI app lives in ../backend/main.py; make it importable as the
# Vercel serverless entrypoint. Vercel loads the `app` symbol from this file.
sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "backend"))

from main import app  # noqa: E402  (re-exported as the Vercel function)
