#!/usr/bin/env bash
set -euo pipefail

FRONTEND_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ID="${GOOGLE_CLOUD_PROJECT:-$(gcloud config get-value project 2>/dev/null || true)}"
REGION="${REGION:-us-central1}"
SERVICE="${SERVICE:-atlanta-heat-advisor-frontend}"
AGENT_API_URL="${AGENT_API_URL:-}"

fail() {
  printf 'ERROR: %s\n' "$*" >&2
  exit 1
}

command -v gcloud >/dev/null 2>&1 || fail "gcloud CLI is required."
[[ -n "${PROJECT_ID}" && "${PROJECT_ID}" != "(unset)" ]] \
  || fail "Set GOOGLE_CLOUD_PROJECT or run 'gcloud config set project PROJECT_ID'."
[[ -n "${AGENT_API_URL}" ]] \
  || fail "Set AGENT_API_URL to the base URL of the ADK agent service."
[[ "${AGENT_API_URL}" =~ ^https://[a-zA-Z0-9.-]+(:[0-9]+)?/?$ ]] \
  || fail "AGENT_API_URL must be an HTTPS service URL, for example https://agent-xxxxx.run.app."

AGENT_API_URL="${AGENT_API_URL%/}"

printf 'Deploying %s to Cloud Run in %s (%s)\n' "${SERVICE}" "${REGION}" "${PROJECT_ID}"
printf 'Agent service: %s\n' "${AGENT_API_URL}"

gcloud run deploy "${SERVICE}" \
  --source "${FRONTEND_DIR}" \
  --project "${PROJECT_ID}" \
  --region "${REGION}" \
  --platform managed \
  --allow-unauthenticated \
  --quiet \
  --set-env-vars "AGENT_API_URL=${AGENT_API_URL}"

gcloud run services describe "${SERVICE}" \
  --project "${PROJECT_ID}" \
  --region "${REGION}" \
  --format='value(status.url)'
