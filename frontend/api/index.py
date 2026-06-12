import sys
import os

# The backend Python files are deployed alongside this file in the api/backend/ directory.
# Vercel serverless functions can only access files within the project's deployed tree.
_here = os.path.dirname(os.path.abspath(__file__))
_backend = os.path.join(_here, "backend")

if _backend not in sys.path:
    sys.path.insert(0, _backend)

# Export the FastAPI app for Vercel
from main import app  # type: ignore  # noqa: E402
