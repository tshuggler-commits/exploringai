FROM python:3.11-slim

WORKDIR /app

# Install dependencies first for layer caching
COPY agent/requirements.txt /app/agent/requirements.txt
RUN pip install --no-cache-dir -r /app/agent/requirements.txt

# Copy agent package
COPY agent /app/agent

ENV PORT=8080
ENV PYTHONUNBUFFERED=1

# Allow the deployed frontend and the documented local development origins.
CMD ["sh", "-c", "adk web --host 0.0.0.0 --port ${PORT} --allow_origins https://atlanta-heat-advisor-frontend-1004921377034.us-central1.run.app --allow_origins https://atlanta-heat-advisor-frontend-hxywpvumaq-uc.a.run.app --allow_origins http://127.0.0.1:5173 --allow_origins http://localhost:5173 --allow_origins http://127.0.0.1:8080 --allow_origins http://localhost:8080 /app"]
