# Walkability and Heat Resilience Pipeline

This is an end-to-end map of how data becomes a recommendation in the Atlanta
Heat Resilience Advisor. The offline data and model lifecycle is separate from
the online agent and its deployment.

## At a glance

```text
Public/reference data
        |
        v
Load and explore in BigQuery
        |
        v
Prepare tract-linked heat-offset features
        |
        v
Train and evaluate a versioned candidate model
        |
        +---- optional: tune and run spatial residual audit
        |
        v
Human review -> promote candidate (backup active model) or rollback
        |
        v
ADK agent queries BigQuery and explains planning results
        |
        v
React dashboard or direct agent API
```

Separately, Cloud Build tests and deploys the **agent application** to Cloud Run.
It does not train or promote BigQuery models.

## 1. Load and explore data

The teaching notebook, [c1_01_load_explore.ipynb](../data_plane/notebooks/c1_01_load_explore.ipynb),
walks through sourcing, cleaning, loading, and exploring campaign readings and
tract context. The headless alternative is
[load.sh](../data_plane/scripts/load.sh):

```bash
bash data_plane/scripts/load.sh --list
bash data_plane/scripts/load.sh atlanta
```

The loader replaces three BigQuery tables: `heat_observations`,
`station_daily_temps`, and `tract_demographics`. It checks that tables contain
rows and fills missing campaign city labels. This seed loader is not the
complete serving dataset: training also checks for
`atlanta_daily_weather_clean`, and some Atlanta agent tools use contextual
canopy/heat/SVI data. Check the [dataset schema](../data_plane/docs/BIGQUERY_SCHEMA.md)
and agent requirements before running against a new project.

`c1_90_publish_snapshot.ipynb` is a maintainer-only notebook for publishing
pre-staged city snapshots to Cloud Storage; it is not part of a normal model
training run.

## 2. Build the model candidate

Run commands from the repository root. The workflows require Python 3.10+,
the `bq` CLI, Git, and authenticated Google Cloud credentials. Set
`GOOGLE_CLOUD_PROJECT`, `BQ_DATASET` (default `a4i_climate`), and
`BQ_LOCATION` (default `US`) first.

```bash
python3 -m data_plane.pipelines.train_candidate           # plan only
python3 -m data_plane.pipelines.train_candidate --execute
```

An executed run snapshots heat and tract source tables, joins each valid heat
reading to its nearest tract centroid, cleans/imputes tract values, and creates
a spatially held-out dataset. The target is each reading's temperature minus
the **training-only campaign mean**; the model predicts this offset, not a
forecast or a measured surface temperature. Training uses eight features:
latitude, longitude, income, poverty rate, no-vehicle rate, median age, housing
units, and structure vintage.

Each run creates a uniquely named feature table and BQML candidate model. It
checks data integrity, evaluates on the held-out spatial cells against a
zero-offset baseline, and verifies model explanations. Run details, SQL/job
metadata, code provenance, metrics, and errors are recorded in the append-only
`model_training_events` table. **Training never changes the active model.**

## 3. Optional model investigation

After a validated training run, you can test ridge regularization on inner
spatial folds, then audit residuals with a 500 m separation buffer:

```bash
python3 -m data_plane.pipelines.tune_candidate --parent-run <run_id> --execute
python3 -m data_plane.pipelines.audit_candidate --parent-run <tuned_run_id> --execute
```

These are investigation workflows, not automatic approvals. They preserve
run-specific artifacts and do not alter the active model. Scores from one
campaign or a reused holdout do not establish temporal generalization, causal
effects, or fairness certification.

## 4. Review, promote, or roll back

Review candidate metrics, quality warnings, spatial error slices, and run
lineage before promoting. Promotion and rollback default to plan-only; include
`--execute` to make changes:

```bash
python3 -m data_plane.pipelines.promote_candidate --candidate-run <run_id> --execute
python3 -m data_plane.pipelines.promote_candidate \
  --rollback <project.dataset.heat_offset_model_backup_run_id> --execute
```

Promotion backs up `heat_offset_model`, copies the candidate into that active
name, runs a prediction/explanation smoke test, and records the outcome.
Rollback similarly preserves the current active model before restoring a
backup. See the [data-plane guide](../data_plane/README.md) for options and
the exact review details.

## 5. Serve recommendations

The [ADK agent](../agent/) receives a question, selects a planning tool, and
queries BigQuery for predictions, explanations, tract context, or station
history. Its integration boundary with model training is BigQuery: the agent
reads the configured active model and does not train, approve, or promote
candidates. Training and serving must keep the feature and cleaning contracts
in sync.

The [frontend](../frontend/) calls the agent API for chat and can show
recommendations and supporting visualizations. It also contains local/mock
data behavior for offline demonstrations, so mock output should not be
confused with a live BigQuery result.

## 6. Test and deploy the agent

The root [cloudbuild.yaml](../cloudbuild.yaml) builds the agent container,
runs agent unit tests in that image, pushes it to Artifact Registry, and
deploys a no-traffic Cloud Run candidate revision. After readiness checks
(and a `/health` check when public access is enabled), it routes traffic to the
candidate. This releases application code only; BigQuery model promotion is a
separate reviewed operation. See [deployment setup](../scripts/README.md).

## Where to look next

- [Data-plane workflows and commands](../data_plane/README.md)
- [BigQuery tables and run artifacts](../data_plane/docs/BIGQUERY_SCHEMA.md)
- [Agent tools, configuration, and API](../agent/README.md)
- [Frontend setup](../frontend/README.md)
