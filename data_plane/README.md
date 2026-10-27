# Data plane

This directory owns the offline data lifecycle independently of the online
[agent](../agent/). Run all commands below from the repository root.

```text
data_plane/
  pipelines/    Importable Python workflows: train, tune, audit, promote/rollback
  sql/          Versioned preparation, validation, evaluation, and inference SQL
  tests/        Cloud-independent unit and structural regression tests
  notebooks/    Exploration and maintainer-only snapshot publication
  scripts/      Seed-data loading CLI
  docs/         Dataset schema and pipeline walkthrough
  data/         Small reference inputs only; no credentials or training exports
```

### Ownership and integration boundaries

- The data plane owns source quality, features, experiment lineage, evaluation and model release.
  The agent owns request validation, conversations, online tools and deployment.
- Neither runtime imports the other. The integration surface is BigQuery: versioned models,
  feature names/types, cleaning rules and the parameterized
  [explanation query](sql/explain_prediction.sql). Data-plane tests must not require ADK, Gemini,
  agent dependencies or Google Cloud credentials.
- Workflow modules use package-relative imports; invoke them with `python3 -m
  data_plane.pipelines.<workflow>`, not by executing their file paths. No `sys.path` modifications
  or dependency on the caller's working directory are needed for Python imports or SQL lookup.
- Candidate workflows are separate from explicit promotion/rollback. Directory organization
  does not add quality approvals or change serving models.
- Preserve executed source paths and hashes in historical registry events: old events describe
  the old layout and must not be rewritten. New runs capture this layout.
- Models, feature tables, snapshots and logs stay in BigQuery, not the repository. Credentials
  stay in the authenticated CLI environment. No training code belongs in the agent's image.

Reference: [dataset schema](docs/BIGQUERY_SCHEMA.md) and
[pipeline walkthrough](docs/PIPELINE_TRAINING_AGENTS.html).

### Supervised ranking pilot and physical features

The selected next use is a human-supervised heat-ranking pilot. The
[acceptance contract](docs/MODEL_ACCEPTANCE.md) proposes metrics, evaluation protocol
and gates **pending approval**; it does not authorize promotion or invent an agreed
error tolerance. Heat ranking and vulnerability-weighted policy priority are separate.

Audit existing canopy without training or BigQuery table/model writes:

```bash
python3 -m data_plane.pipelines.audit_physical_features \
  --project qwiklabs-gcp-03-1578f96a5a7a \
  --feature-run 20261027_163945_a1f7fcb70be3          # Plan only
python3 -m data_plane.pipelines.audit_physical_features \
  --project qwiklabs-gcp-03-1578f96a5a7a \
  --feature-run 20261027_163945_a1f7fcb70be3 \
  --execute --output canopy_audit.json
```

The optional output must be a new local file. Reports retain executed SQL/hash,
job statistics, source quality, duplicate-safe join coverage for training/evaluation
and agent-eligible tracts, plus unresolved provenance requirements. Execution submits
read-only BigQuery jobs (subject to query billing), not training or registry writes.
Canopy remains blocked pending source verification and coverage review; no automatic
unit conversion, imputation, model-contract change or agent integration occurs.

The [retained audit from 2026-10-27](docs/canopy_audit_20261027.json) found:

| Population | Valid unique canopy match | Coverage |
|---|---|---|
| Training observations | 16,957 / 20,168 | 84.1% |
| Evaluation observations | 2,983 / 3,218 | 92.7% |
| All demographic tract rows | 56 / 353 | 15.9% |
| Agent ranking-eligible tract rows | 56 / 264 | 21.2% |

All 109 source GEOIDs were unique and well formed; canopy had no null/non-finite/
out-of-range values under a provisional 0–100 check. No table description or labels
were present. This is not unit or source verification. High observation coverage
does not imply broad serving coverage: 208 eligible tract rows lack a usable match.
The report documents current source reads and query lineage, not immutable source
snapshots or an approved feature contract.

### Read-only ranking and spatial sensitivity audit

```bash
python3 -m data_plane.pipelines.audit_ranking \
  --project qwiklabs-gcp-03-1578f96a5a7a \
  --source-run 20261027_163945_a1f7fcb70be3 \
  --candidate-run 20261027_164544_b1e872144cc1 \
  --candidate-run 20261027_165503_b3dad3b996e2 \
  --execute --output ranking_audit.json
```

Omit `--execute` for a credential-free plan. The optional report path must be new.
The workflow validates completed model lineage, predicts on identical original
holdout readings, aligns fitting anchors, checks completeness/finite predictions
and model etags, and aggregates tract errors. Support rules are the draft 30 readings
per tract, at least 10 eligible tracts and top-5. Below those counts the ranking is
inconclusive. Shortlist ties use GEOID; Spearman uses average tied ranks.

The [retained 2026-10-27 report](docs/ranking_audit_20261027.json) evaluated 3,218
readings in 13 spatial cells, with 21 eligible tracts and seven excluded for low
reading counts:

| Metric on supported cohort | Tuned candidate | Buffered candidate |
|---|---|---|
| Measured top-5 recovered | 3 / 5 | 3 / 5 |
| Spearman | 0.568 | 0.581 |
| NDCG@5, linear ordinal relevance | 0.687 | 0.687 |
| Tract-mean absolute error | 1.031 F | 1.020 F |
| Observation MAE | 1.475 F | 1.462 F |
| Observation MSE | 3.367 F² | 3.173 F² |

Both use the same zero-offset baseline: MAE 1.597 F, MSE 3.356 F² on the supported
cohort. These numbers differ from earlier model evaluations because the cohort and,
for the buffered candidate, label anchor have been harmonized explicitly.

The two predicted top-5 lists are identical. Their first-ranked tract, `13121007900`,
has measured mean offset -1.260 F, versus predictions +1.663 F (tuned) and +1.364 F
(buffered). Its reading-level MAE is 2.923 F / 2.624 F, respectively. This is a
specific development error worth investigating, not evidence that the full city
ranking is reliable.

When each evaluation cell is omitted without refitting, supported tracts range
from 16 to 21. Spearman ranges from 0.425–0.665 (tuned) and 0.442–0.650 (buffered);
top-5 overlap with the measured shortlist ranges 2–3 and stays at 3, respectively.
The eligible cohort changes in these perturbations: these ranges are **not**
confidence intervals or spatial cross-validation. They evaluate sampling
sensitivity, not independent generalization.

No acceptance verdict or promotion is produced. This is a previously inspected
campaign holdout, ranks are based on observed-point means rather than serving
centroids, and no vulnerability-weighted policy score is validated.

### Ten-year tree-planting scenarios

The [scenario design](docs/TREE_PLANTING_SCENARIO.md) addresses cumulative avoided
human ambient-heat exposure per lifecycle dollar over ten years from planting.
It is a proposal, not an estimated cooling effect. Audit the new inputs read-only:

```bash
python3 -m data_plane.pipelines.audit_tree_planting \
  --project qwiklabs-gcp-03-1578f96a5a7a \
  --execute --output planting_audit.json
```

Omit `--execute` for plan only. Source provenance, marginal-cost units, site feasibility,
growth/survival, causal cooling response and hourly exposure remain unverified.
The report deliberately emits no relief-per-dollar value or recommendation.
Neither current canopy nor a heat-model attribution establishes the benefit of planting.

The [retained 2026-10-27 audit](docs/planting_audit_20261027.json) found 109 unique,
well-formed GEOIDs, no missing/non-finite values in the six profiled fields, and
56 matches among 264 agent-eligible tracts (21.2%). Declared marginal cost ranges
300–1,500 and declared plantable area 593.34–25,000, but units/methodology are not
verified; no table description or labels document them. These checks do not prove
the fields are measured rather than synthetic.

### Command migration

The previous top-level `scripts/`, `sql/`, `notebooks/` and `data/` directories have moved here.
Replace `python3 scripts/<workflow>.py` with `python3 -m
data_plane.pipelines.<workflow>`, `bash scripts/load.sh` with
`bash data_plane/scripts/load.sh`, and SQL/notebook paths with `data_plane/sql/` and
`data_plane/notebooks/`. There are intentionally no duplicate entrypoints at the old paths.

## Versioned BQML candidates and training history

The candidate runner requires Python 3.10+, `bq`, `git`, and an authenticated Cloud CLI. It uses
the standard library, so no additional Python packages or downloaded service-account keys are
needed. It reads environment variables, not dotenv files; export the settings first:

```bash
export GOOGLE_CLOUD_PROJECT=qwiklabs-gcp-03-1578f96a5a7a
export BQ_DATASET=a4i_climate
export BQ_LOCATION=US

python3 -m data_plane.pipelines.train_candidate            # Plan only; no BigQuery calls or writes.
python3 -m data_plane.pipelines.train_candidate --execute  # Creates and tests a versioned candidate.
```

This workflow is scoped to the Atlanta dataset. It never replaces `heat_offset_model`, updates
source tables, changes agent configuration, or promotes a candidate. Each execution gets a UTC
timestamp plus random suffix and creates:

- Read-only `heat_snapshot_<run_id>` and `tract_snapshot_<run_id>` at the same point in time.
- `training_data_<run_id>` with the cleaned features, raw temperatures, target, geographic
  assignments, imputation flags, baseline anchor, spatial cells, and evaluation split.
- `heat_offset_model_<run_id>`, using exactly the eight features expected by the agent.
- Append-only rows in `model_training_events`, partitioned by date and clustered by run/stage.
  These retain the Git commit and dirty status, the exact source files and their combined SHA-256,
  configuration, SQL and parameters, submitted job IDs, stage results, metrics, and errors.
  Successful stages also persist job timestamps, processed/billed bytes, slot time, and available
  BQML training statistics; model metadata is retained after training.
  A local dirty working tree is allowed because its actual training code is stored, not just HEAD.

The runner uses `CREATE`, never `CREATE OR REPLACE`, for run artifacts. Immutability is a workflow
convention except for the read-only source snapshots; use IAM if you need enforced restrictions.
Nothing expires automatically: snapshots and feature tables consume storage. Keep validated runs
and apply an explicit retention policy before running large experiments.

### Data and validation choices

Each reading is assigned to its nearest valid tract centroid with a stable GEOID tie-breaker.
That is an approximation, not polygon containment, and has no maximum-distance cutoff; the run
records the maximum matching distance. Invalid Census values receive documented fixed fallbacks
from [clean_tracts.sql](sql/clean_tracts.sql), reused by training and explain-prediction.

Cells of 0.02 degrees are assigned deterministically to a roughly 20% holdout using a normalized
hash modulo five. The realized fraction depends on where observations cluster. Cells never occur
on both sides, but no spatial buffer is enforced, so adjacent cells can still be correlated.
The offset is temperature minus the **training-only campaign mean**, also applied unchanged to
evaluation rows. This prevents evaluation temperatures from determining the baseline. Its anchor
can differ slightly from the full campaign mean; both are recorded. Temperature, identifiers,
imputation flags, and split metadata are explicitly excluded from the model feature list.

Checks require one feature row per source reading, nonempty training/evaluation splits, no shared
cells, clean income values, the exact feature contract, finite metrics, and a real
`ML.EXPLAIN_PREDICT` response with three finite feature attributions. A candidate must not have worse
holdout MAE than a zero-offset (training-mean) predictor. R2 >= 0.98 blocks acceptance for leakage
review, but a lower R2 does not prove there is no leakage. This single campaign cannot establish
temporal generalization or causal intervention effects.

The legacy active model is not used as a quality baseline: it may have seen the held-out readings,
and its income statistics contain a Census sentinel. Its metadata is recorded before the run and
its etag checked afterward to confirm it was not changed during training. Operational failures and
quality-gate failures are recorded as `FAILED`, with artifacts preserved for investigation. The
final `VALIDATED_CANDIDATE` status is not a production approval. Negative holdout R2 and worse
MSE than baseline are explicitly preserved as quality warnings, even if the MAE gate passes;
every candidate still requires promotion review.

Missing source city labels are reported and retained in raw snapshots, not silently rewritten;
the candidate uses the known Atlanta-only dataset without filtering this nullable field.
For explicitly authorized source repair, run `data_plane/sql/normalize_city_label.sql` before the strict
snapshot regression checks in `data_plane/sql/validate_data.sql`. Future loads through `data_plane/scripts/load.sh`
fill missing labels automatically. These are separate from candidate execution.

### Inspect training history

```sql
SELECT run_id, event_time, stage, state, candidate_model, payload
FROM `qwiklabs-gcp-03-1578f96a5a7a.a4i_climate.model_training_events`
WHERE event_time >= TIMESTAMP_SUB(CURRENT_TIMESTAMP(), INTERVAL 7 DAY)
ORDER BY event_time DESC
LIMIT 50;
```

For a compact experiment comparison (metrics from different snapshots/splits are not directly
comparable):

```sql
SELECT
  run_id,
  candidate_model,
  JSON_VALUE(payload, '$.metrics.mean_absolute_error') AS holdout_mae_f,
  JSON_VALUE(payload, '$.metrics.mean_squared_error') AS holdout_mse,
  JSON_VALUE(payload, '$.metrics.r2_score') AS holdout_r2,
  JSON_QUERY(payload, '$.quality_warnings') AS quality_warnings
FROM `qwiklabs-gcp-03-1578f96a5a7a.a4i_climate.model_training_events`
WHERE stage = 'run' AND state = 'VALIDATED_CANDIDATE'
ORDER BY event_time DESC;
```

All jobs carry a `training_run` label; submitted IDs also live in registry events for failed or
interrupted jobs. Inspect job details in BigQuery or `bq show --job` for processed/billed bytes,
slot time, errors, and training configuration. Key statistics are also copied into successful
stage events so the registry does not depend on BigQuery job-history retention.
`--maximum-bytes-billed` defaults to 1 GB per query;
this is not a total budget or a cap on separately priced BQML training/storage costs.
Interruption does not automatically cancel an already-submitted job; inspect its recorded ID.

### Agent-lane handoff

`data_plane/sql/train_model.sql`, `data_plane/sql/evaluate_model.sql`, `data_plane/sql/prepare_features.sql`, and
`data_plane/sql/explain_prediction.sql` are templates, not standalone `bq` commands. The runner resolves
their identifiers and records the exact executed SQL. The explain SQL and parameters are available
in the `explain` / `SUBMITTED` event; its successful result is in `explain` / `SUCCEEDED`.

For serving, the agent lane (`agent/tools.py`) is synchronized with the data-lane contract:
- **Atlanta coverage boundary:** Validates coordinates against the municipal/metro bounding box
  (latitude [33.55, 34.02], longitude [-84.60, -84.15]) before inference to reject out-of-boundary queries.
- **Demographics cleaning:** Matches `data_plane/sql/clean_tracts.sql` by mapping negative Census income sentinels
  and missing values to the documented City of Atlanta baseline ($65,000.00) and clamping poverty rates.
- **Attribution explanation:** `rank_cooling_center_sites` uses `ML.EXPLAIN_PREDICT` to return top feature
  attributions alongside vulnerability scores.
- **Target model selection:** Tools accept an explicit `model_name` parameter (defaulting to active
  `heat_offset_model` or environment variable `BQ_MODEL_NAME`) allowing shadow testing of candidates.

Run local tests without Cloud access:

```bash
python3 -m unittest discover -s data_plane/tests -p 'test_*.py' -v
python3 -m unittest discover -s agent/tests -p 'test_*.py' -v
```

## Improving a candidate without tuning on the holdout

Run a bounded ridge-regression experiment against the preserved features from a validated run:

```bash
python3 -m data_plane.pipelines.tune_candidate --parent-run 20261027_163945_a1f7fcb70be3
python3 -m data_plane.pipelines.tune_candidate --parent-run 20261027_163945_a1f7fcb70be3 --execute
```

This reuses the parent data/outer split, snapshots its prepared feature table, and trains nine
inner models: L2 strengths 0, 1000, and 10000 across three spatial folds drawn **only from outer
training rows**. Each fold's target anchor is computed solely from that fold's fitting rows.
The configuration with lowest equal-fold mean MSE is recorded before the selected model is fit
on all outer training rows and scored once against the original outer holdout. The eight-feature
agent contract remains unchanged; no heat aggregates, SVI indices, or risk scores become inputs.

The original holdout was already inspected during development, so its score is not a new,
independent certification. Adjacent spatial cells can still be correlated, and this experiment
does not add new physical environment signals. It can reduce coefficient variance, not invent
missing information. Results use `EXPERIMENT_COMPLETED`, not a validated/promoted production
status; even failed-quality experiments retain metrics, fold results, code, and job statistics.
Inspect that status as well as `VALIDATED_CANDIDATE` when comparing experiments. All intermediate
models/tables are retained and incur storage; the runner never changes the active model or agent.

The first ridge experiment (`20261027_164544_b1e872144cc1`) selected L2=1000. On the same
3,218-row outer holdout its MAE improved from 1.4984 to 1.4626 F and MSE from 3.6317 to 3.3254,
but R2 remained -0.0112 and MSE still exceeded the zero-offset baseline (3.2956). This is a
measured improvement, not evidence that the model is ready for production. The next meaningful
step is independently sourced physical-environment features (for example licensed canopy or
impervious-surface data) and new/buffered spatial validation, not repeated tuning on this holdout.

## Residual audit and a physical separation stress test

```bash
python3 -m data_plane.pipelines.audit_candidate --parent-run 20261027_164544_b1e872144cc1
python3 -m data_plane.pipelines.audit_candidate --parent-run 20261027_164544_b1e872144cc1 --execute
```

This snapshots the tuned experiment's features, retains the same holdout, and removes fitting
observations within **500 meters** of any holdout observation. It verifies there are no violating
pairs, recomputes the target anchor from retained fitting rows, and refits exactly the previously
selected regularization without another search. The buffered result is a stress test, not a
replacement score or a new independent test: fitting rows and baseline anchor have changed.

Both original and buffered candidates get persisted holdout residual tables. Aggregate reports
record row/tract counts, MAE, MSE, signed bias (prediction minus actual offset), approximate 90th
percentile absolute error, and zero-offset baseline MAE. Reports cover geographic cells, income
imputation, poverty/vehicle-rate bands, and tract-centroid matching distance; groups under 30
readings are omitted. These are aggregate error slices, not a fairness certification. Poverty and
vehicle slices use cleaned values, so missing values are assigned to their imputed bands.
The error quantile describes this holdout; it is **not** a calibrated prediction interval.
The result is recorded as `BUFFER_AUDIT_COMPLETED`; source data, active model, and agent remain
unchanged. No risk-score, SVI, or measured-temperature aggregate is introduced as a feature.

The first buffer experiment (`20261027_165503_b3dad3b996e2`) retained 18,018 of 20,168 fitting
readings, preserved all 3,218 evaluation readings, and found zero fitting/evaluation pairs within
500 m. Its MAE was 1.4496 F (baseline 1.5819 F), MSE 3.1382 (baseline 3.3064), and R2 0.0458.
This beats that stress test's baseline on both errors, but explains little of the holdout
variance. Some parent-model spatial cells had MAE near 3 F despite the aggregate improvement.
Use persisted residuals to identify those failures rather than hiding them behind average scores.

## Promoting or rolling back candidate models in production

Once a candidate model has been audited and approved through the review process, promote it safely
using `promote_candidate.py`:

```bash
# Plan only: prints the action without Cloud queries or writes.
python3 -m data_plane.pipelines.promote_candidate --candidate-run 20261027_164544_b1e872144cc1

# Execute promotion to production
python3 -m data_plane.pipelines.promote_candidate --candidate-run 20261027_164544_b1e872144cc1 --execute
```

### Safety and verification guarantees:
1. **Candidate Lookup:** Requires a completed candidate event and reads model metadata.
   Plan-only mode does not perform that lookup or validate quality.
2. **Active Model Backup:** Automatically copies the active `heat_offset_model` to a timestamped backup
   (`heat_offset_model_backup_<timestamp>_<suffix>`) before overwriting it.
3. **Atomic Promotion:** Copies the candidate model to `heat_offset_model`.
4. **Post-Promotion Verification:** Runs a smoke test on the newly promoted `heat_offset_model` to
   verify serving readiness.
5. **Auditable Lineage:** Logs a structured `PROMOTED` event into `model_training_events` containing
   the candidate run ID, model name, backup model name, smoke test attributions, and operator timestamp.

### Rollback:
If an operational anomaly or issue is observed after promotion, roll back immediately to a previous
backup or candidate model:

```bash
# Dry run rollback
python3 -m data_plane.pipelines.promote_candidate --rollback qwiklabs-gcp-03-1578f96a5a7a.a4i_climate.heat_offset_model_backup_20261027_170000_1234abcd

# Execute rollback
python3 -m data_plane.pipelines.promote_candidate --rollback qwiklabs-gcp-03-1578f96a5a7a.a4i_climate.heat_offset_model_backup_20261027_170000_1234abcd --execute
```

This creates a safety backup of the current model and logs a `ROLLED_BACK` event into `model_training_events`.

## Loading the seed data

Headless alternatives to the notebook, for when a Colab Enterprise runtime is slow or
unavailable.

`load.sh` reaches the same end state as `data_plane/notebooks/c1_01_load_explore.ipynb`—the same tables, in
the same dataset, in your project. Use the notebook if you can: it explains what it's doing and
why, and the explanations matter. Use this if you can't.

## Running it

From the **root of the repo**, in Cloud Shell:

```bash
bash data_plane/scripts/load.sh              # loads the default city
bash data_plane/scripts/load.sh --list       # show every available city
bash data_plane/scripts/load.sh --help       # usage
```

Invoke it with `bash` rather than `./data_plane/scripts/load.sh`. That way it works whether or not the
file's executable bit survived however your copy of this repo was created.

## It is safe to run more than once

Every table is fully replaced, never appended to. So if you cancel it halfway through, or you
aren't sure whether it finished, just run it again—the end state is the same either way.
