FROM python:3.10-slim

# Install system dependencies required by OpenCV
RUN apt-get update && apt-get install -y --no-install-recommends \
    libgl1 \
    libglib2.0-0 \
    && rm -rf /var/lib/apt/lists/*

# Hugging Face Spaces requires running as non-root user (UID 1000)
RUN useradd -m -u 1000 user
ENV HOME=/home/user \
    PATH=/home/user/.local/bin:$PATH

WORKDIR $HOME/app

# Copy requirements and install dependencies
COPY --chown=user:user requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy source code and model files
COPY --chown=user:user . .

# Ensure uploads directory is writable
RUN mkdir -p uploads && chown -R user:user uploads

USER user

EXPOSE 7860
ENV PORT=7860

CMD ["python", "app.py"]
