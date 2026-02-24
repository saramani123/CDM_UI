FROM python:3.11-slim
WORKDIR /app

# Upgrade pip and install requirements
COPY requirements.txt ./
RUN pip install --no-cache-dir --upgrade pip && \
    pip install --no-cache-dir -r requirements.txt

# Copy application source
COPY . .

# Expose port 8000
EXPOSE 8000

# Start FastAPI exactly like in main.py but using uvicorn CLI for production
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000"]
