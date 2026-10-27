# scripts/

Agent deployment scripts. Data loading and model workflows live separately in
[`data_plane/`](../data_plane/README.md); the loader is
[`data_plane/scripts/load.sh`](../data_plane/scripts/load.sh).

## Building and deploying the agent

[`../cloudbuild.yaml`](../cloudbuild.yaml) defines the CI/CD pipeline. It builds the existing
Cloud Run container, runs the agent's unit tests inside that exact image, pushes the image to
Artifact Registry, and deploys a digest-pinned candidate revision. It promotes that revision
only after Cloud Run reports it ready. When public access is explicitly enabled, it also checks
the candidate's `/health` endpoint before promotion.

### One-time project setup

Choose a Cloud Run runtime service account for the app and a separate Cloud Build service
account for CI/CD. Enable the required APIs and create the Artifact Registry repository:

```bash
PROJECT_ID="$(gcloud config get-value project)"
REGION="us-central1"
BUILD_SA="walkability-build@${PROJECT_ID}.iam.gserviceaccount.com"
RUN_SA="walkability-runtime@${PROJECT_ID}.iam.gserviceaccount.com"

gcloud services enable \
  artifactregistry.googleapis.com \
  aiplatform.googleapis.com \
  bigquery.googleapis.com \
  cloudbuild.googleapis.com \
  run.googleapis.com \
  --project="$PROJECT_ID"

gcloud iam service-accounts create walkability-build --project="$PROJECT_ID"
gcloud iam service-accounts create walkability-runtime --project="$PROJECT_ID"
gcloud artifacts repositories create walkability \
  --project="$PROJECT_ID" \
  --location="$REGION" \
  --repository-format=docker \
  --description="Walkability agent container images"
```

Grant the build identity only what the pipeline needs. Artifact Registry write access is scoped
to the image repository; Cloud Run administration and service-account impersonation are needed
to deploy the runtime:

```bash
gcloud artifacts repositories add-iam-policy-binding walkability \
  --project="$PROJECT_ID" --location="$REGION" \
  --member="serviceAccount:${BUILD_SA}" \
  --role="roles/artifactregistry.writer"
gcloud projects add-iam-policy-binding "$PROJECT_ID" \
  --member="serviceAccount:${BUILD_SA}" \
  --role="roles/run.admin"
gcloud projects add-iam-policy-binding "$PROJECT_ID" \
  --member="serviceAccount:${BUILD_SA}" \
  --role="roles/serviceusage.serviceUsageConsumer"
gcloud projects add-iam-policy-binding "$PROJECT_ID" \
  --member="serviceAccount:${BUILD_SA}" \
  --role="roles/logging.logWriter"
gcloud iam service-accounts add-iam-policy-binding "$RUN_SA" \
  --project="$PROJECT_ID" \
  --member="serviceAccount:${BUILD_SA}" \
  --role="roles/iam.serviceAccountUser"
```

Grant the runtime identity Vertex AI access, BigQuery job creation, and read access only to the
agent's dataset. The dataset must already exist and the configured BQML models must be trained:

```bash
gcloud projects add-iam-policy-binding "$PROJECT_ID" \
  --member="serviceAccount:${RUN_SA}" \
  --role="roles/aiplatform.user"
gcloud projects add-iam-policy-binding "$PROJECT_ID" \
  --member="serviceAccount:${RUN_SA}" \
  --role="roles/bigquery.jobUser"
bq add-iam-policy-binding "${PROJECT_ID}:a4i_climate" \
  --member="serviceAccount:${RUN_SA}" \
  --role="roles/bigquery.dataViewer"
```

The identity submitting a build also needs permission to create builds and act as `BUILD_SA`.
For repository triggers, configure the trigger to use the same dedicated build service account
and provide the substitutions used below.

### Run the pipeline

From the repository root, submit a build. The default service is private; Cloud Run callers need
`roles/run.invoker`. Use `--public` only for an intentionally unauthenticated demo endpoint.

```bash
bash scripts/deploy.sh \
  --project "$PROJECT_ID" \
  --region "$REGION" \
  --build-service-account "$BUILD_SA" \
  --runtime-service-account "$RUN_SA"

# Optional: publish the service to unauthenticated callers.
bash scripts/deploy.sh \
  --project "$PROJECT_ID" \
  --region "$REGION" \
  --build-service-account "$BUILD_SA" \
  --runtime-service-account "$RUN_SA" \
  --public
```

The pipeline pins deployment to the pushed Artifact Registry digest, disables runtime BQML
model bootstrapping, and keeps traffic on the current revision until the candidate is ready.
It registers only the Atlanta tool family by default. `--model-family planning` sets
the `_MODEL_FAMILY` substitution explicitly; use it only after validating the separate
planning model with `python -m agent.validate_models --family planning --execute`
under the runtime identity. Health/readiness alone does not validate BigQuery access.
Resource sizing and model/dataset values are configurable through the substitutions in
[`../cloudbuild.yaml`](../cloudbuild.yaml). Avoid passing credentials as substitutions or
environment variables; use Secret Manager references for any future secret configuration.
