# Official lightweight Python base image
FROM python:3.11-slim

# Install system dependencies: ffmpeg for audio transcoding/extraction & curl for health checks
RUN apt-get update && apt-get install -y --no-install-recommends \
    ffmpeg \
    curl \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Install Python requirements
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy application source code
COPY . .

# Create non-root system user and configure least-privilege permissions
RUN useradd -m -u 10001 appuser && \
    chown -R appuser:appuser /app

USER appuser

# Expose ports (8000 for standard hosts, 7860 for Hugging Face Spaces)
EXPOSE 8000
EXPOSE 7860

# Set environment variables
ENV PYTHONUNBUFFERED=1
ENV PORT=7860

# Run uvicorn via app.py with dynamic PORT binding
CMD ["python", "app.py"]
