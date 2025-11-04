# ================================
# MatchMyStack Backend - Dockerfile
# ================================

FROM python:3.11-slim

ENV DEBIAN_FRONTEND=noninteractive

# Install build tools and libraries
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    gcc \
    g++ \
    libpq-dev \
    libssl-dev \
    libffi-dev \
    python3-dev \
    pkg-config \
    libatlas-base-dev \
    liblapack-dev \
    libblas-dev \
    gfortran \
    curl \
    ca-certificates \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Upgrade pip tools
RUN pip install --no-cache-dir --upgrade pip setuptools wheel

# Copy requirements and install
COPY requirements.txt /app/requirements.txt
RUN pip install --no-cache-dir -r /app/requirements.txt

# Copy backend code (current context is the backend folder)
COPY . /app

# Create uploads folder
RUN mkdir -p /data/uploads && chown -R www-data:www-data /data/uploads || true

EXPOSE 8000

# Start FastAPI server (Render will set $PORT at runtime)
CMD ["sh", "-c", "uvicorn main:app --host 0.0.0.0 --port ${PORT:-8000}"]
