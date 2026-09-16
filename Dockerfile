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

# Expose default port (Koyeb standard is 8000)
EXPOSE 8000

# Set environment variables
ENV PYTHONUNBUFFERED=1
ENV PORT=8000

# Run uvicorn via app.py with dynamic PORT binding
CMD ["python", "app.py"]
