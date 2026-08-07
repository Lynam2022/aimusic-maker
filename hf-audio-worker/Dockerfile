FROM python:3.10-slim-bullseye

# Install FFmpeg, Rubberband, and dependencies
RUN apt-get update && apt-get install -y \
    ffmpeg \
    rubberband-cli \
    librubberband2 \
    curl \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Install Python packages
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy application code
COPY . .

# Hugging Face Spaces uses port 7860 by default
EXPOSE 7860

CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "7860"]
