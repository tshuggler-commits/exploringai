#!/usr/bin/env bash
set -euo pipefail

usage() {
  cat <<'EOF'
Submit the repository's Cloud Build test/build/deploy pipeline.

Usage:
  bash scripts/deploy.sh \
    --build-service-account BUILD_SA_EMAIL \
    --runtime-service-account RUN_SA_EMAIL \
    [--project PROJECT_ID] [--region REGION] [--repository REPOSITORY] \
    [--service SERVICE_NAME] [--model-family atlanta|planning] [--public]

Defaults:
  project     gcloud's configured project (or GOOGLE_CLOUD_PROJECT)
  region      us-central1
  repository  walkability
  service     atlanta-heat-advisor
  model-family atlanta; planning requires its separately validated model
  access      private; pass --public only when unauthenticated access is intended
EOF
}

if ! command -v gcloud >/dev/null 2>&1; then
  printf 'ERROR: gcloud is required. Install the Google Cloud CLI first.\n' >&2
  exit 1
fi

PROJECT_ID="${GOOGLE_CLOUD_PROJECT:-$(gcloud config get-value project 2>/dev/null || true)}"
REGION="us-central1"
REPOSITORY="walkability"
SERVICE_NAME="atlanta-heat-advisor"
BUILD_SERVICE_ACCOUNT=""
RUN_SERVICE_ACCOUNT=""
ALLOW_UNAUTHENTICATED="false"
MODEL_FAMILY="atlanta"

while (($#)); do
  case "$1" in
    --project)
      (($# >= 2)) || { usage >&2; exit 2; }
      PROJECT_ID="$2"
      shift 2
      ;;
    --region)
      (($# >= 2)) || { usage >&2; exit 2; }
      REGION="$2"
      shift 2
      ;;
    --repository)
      (($# >= 2)) || { usage >&2; exit 2; }
      REPOSITORY="$2"
      shift 2
      ;;
    --service)
      (($# >= 2)) || { usage >&2; exit 2; }
      SERVICE_NAME="$2"
      shift 2
      ;;
    --build-service-account)
      (($# >= 2)) || { usage >&2; exit 2; }
      BUILD_SERVICE_ACCOUNT="$2"
      shift 2
      ;;
    --runtime-service-account)
      (($# >= 2)) || { usage >&2; exit 2; }
      RUN_SERVICE_ACCOUNT="$2"
      shift 2
      ;;
    --public)
      ALLOW_UNAUTHENTICATED="true"
      shift
      ;;
    --model-family)
      (($# >= 2)) || { usage >&2; exit 2; }
      MODEL_FAMILY="$2"
      shift 2
      ;;
    --help|-h)
      usage
      exit 0
      ;;
    *)
      printf 'ERROR: Unknown argument: %s\n\n' "$1" >&2
      usage >&2
      exit 2
      ;;
  esac
done

if [[ "$MODEL_FAMILY" != "atlanta" && "$MODEL_FAMILY" != "planning" ]]; then
  printf 'ERROR: model family must be atlanta or planning.\n' >&2
  exit 2
fi

if [[ -z "$PROJECT_ID" || "$PROJECT_ID" == "(unset)" \
  || -z "$BUILD_SERVICE_ACCOUNT" || -z "$RUN_SERVICE_ACCOUNT" ]]; then
  printf 'ERROR: project, build service account, and runtime service account are required.\n\n' >&2
  usage >&2
  exit 2
fi

printf 'Submitting Cloud Build pipeline for %s/%s in %s\n' "$PROJECT_ID" "$SERVICE_NAME" "$REGION"
printf 'Cloud Run access: %s\n' \
  "$([[ "$ALLOW_UNAUTHENTICATED" == "true" ]] && printf 'public' || printf 'authenticated callers only')"

gcloud builds submit . \
  --project="$PROJECT_ID" \
  --region="$REGION" \
  --service-account="projects/$PROJECT_ID/serviceAccounts/$BUILD_SERVICE_ACCOUNT" \
  --config=cloudbuild.yaml \
  --substitutions="_REGION=$REGION,_AR_REPOSITORY=$REPOSITORY,_SERVICE_NAME=$SERVICE_NAME,_RUN_SERVICE_ACCOUNT=$RUN_SERVICE_ACCOUNT,_ALLOW_UNAUTHENTICATED=$ALLOW_UNAUTHENTICATED,_MODEL_FAMILY=$MODEL_FAMILY"
