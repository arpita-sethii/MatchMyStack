# ================================
# MatchMyStack - Dockerfile (multi-stage, smaller final image)
# Uses Python 3.10 for better wheel support for spaCy/numpy/etc.
# ================================

### ---------- Builder stage ----------
FROM python:3.10-slim AS builder
ENV DEBIAN_FRONTEND=noninteractive

# Install build tools and libs required to compile wheels
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    gcc \
    g++ \
    libpq-dev \
    libssl-dev \
    libffi-dev \
    python3-dev \
    pkg-config \
    curl \
    ca-certificates \
  && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Copy requirements (adjust path if your Dockerfile is inside backend/)
COPY backend/requirements.txt ./requirements.txt

# Create a venv and install into it (keeps runtime clean)
RUN python -m venv /opt/venv
ENV PATH="/opt/venv/bin:$PATH"

# Upgrade pip tooling then install all requirements (builder only)
RUN pip install --no-cache-dir --upgrade pip setuptools wheel
RUN pip install --no-cache-dir -r requirements.txt

# Copy backend source into builder (so compiled extensions are available)
COPY backend/ ./

### ---------- Runtime stage (smaller) ----------
FROM python:3.10-slim
ENV DEBIAN_FRONTEND=noninteractive
ENV PATH="/opt/venv/bin:$PATH"
ENV PYTHONUNBUFFERED=1

# Only install small runtime packages (no compilers)
RUN apt-get update && apt-get install -y --no-install-recommends \
    libpq5 \
    ca-certificates \
  && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Copy venv and app from builder
COPY --from=builder /opt/venv /opt/venv
COPY --from=builder /app /app

# Ensure uploads directory exists (matches your app)
RUN mkdir -p /data/uploads && chown -R www-data:www-data /data/uploads || true

EXPOSE 8000

# Start command; Render sets $PORT at runtime — default to 8000 locally
CMD ["sh", "-c", "uvicorn main:app --host 0.0.0.0 --port ${PORT:-8000}"]
