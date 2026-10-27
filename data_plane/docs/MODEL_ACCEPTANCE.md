# Heat-ranking pilot: proposed acceptance contract

Status: **DRAFT, NOT APPROVED**. Intended use selected by the project owner:
ranking Atlanta zones for a supervised pilot. Numerical thresholds below are
proposals for review, not external standards, observed achievements, or production
authorization. Neither this document nor a completed experiment changes the
[promotion workflow](../pipelines/promote_candidate.py).

## Decision and limits

Help a human shortlist zones for further investigation. Do not autonomously allocate
funding, claim causal benefits of interventions, forecast another campaign/day, or
present campaign ambient-temperature offsets as surface temperatures.

Separate two outputs:

- **Heat ranking:** predicted offset, evaluated against held-out measured heat.
- **Policy priority:** heat plus vulnerability. Poverty/vehicle weights are policy
  choices; this score is not a measured heat label and cannot be validated as such.
  Keep the components visible and require stakeholder review of the weights.

## Evaluation protocol to freeze before the next experiment

1. Register the source snapshots, target anchor, cleaning, spatial folds, buffer,
   feature list, baseline, shortlist size and scoring code before fitting.
2. Tune only within training folds. Compare baseline and candidate on identical
   held-out observations, labels, tract aggregation and geographic support.
3. Rank tracts by mean held-out prediction and compare with mean held-out measured
   offset. Give each tract equal weight; a densely sampled road must not dominate.
   Report reading counts and spatial-cell counts per tract.
4. Provisional eligibility: at least 30 held-out readings per tract, at least
   10 eligible tracts per evaluation fold, top-k = 5. If support is insufficient,
   mark the ranking evaluation **INCONCLUSIVE**, not passed. These count thresholds
   require review; correlated readings are not independent samples.
5. Report Spearman rank correlation, top-5 overlap (precision@5), NDCG@5 using
   nonnegative ordinal measured-heat relevance, tract-level MAE, observation-level
   MAE/MSE, signed bias, and p90 absolute error. Resolve ties by GEOID.
6. Baselines: training-mean offset for error metrics; current eight-feature model
   for ranking, evaluated without training on the evaluation data. Do not compare
   against a production model that already saw those labels. Constant predictions
   do not provide a meaningful Spearman ranking baseline.
7. Report fold variation and uncertainty by spatial block, not a row-wise bootstrap.
   Report poverty, vehicle-access, imputation and coverage slices without treating
   those indicators as causes of heat.
8. The existing outer holdout has already been inspected. It is development evidence,
   not an untouched certification set. New predeclared spatial CV supports internal
   comparison only; reserve a genuinely uninspected campaign/area for confirmation.

## Proposed gates for review

| Area | Proposed pilot gate | Rationale / open decision |
|---|---|---|
| Heat shortlist | At least 3 of the measured hottest 5 tracts recovered; Spearman >= 0.5 | Product proposal, not a universal statistical rule; confirm whether five sites is the real decision size |
| Added feature value | Positive paired mean NDCG@5 improvement over the eight-feature baseline, with spatial-block 95% interval excluding zero | Reject gains explained only by dense sampling; inconclusive if too few independent blocks |
| Error guardrail | MAE and MSE no worse than the training-mean baseline on the same labels | Proposed safeguard, not an already agreed tolerance in degrees |
| Segment review | Publish all sufficiently supported slices; review regressions before approval | No defensible disparity/error tolerance has yet been agreed |
| Feature admission | Verified source contract, valid unique join keys and documented missingness treatment | Plausible numerical values are not proof of provenance |
| Serving support | Every pilot recommendation has verified feature availability and an explicit support flag | No silent extrapolation, silent unit guessing or missing-canopy substitution |
| Operations | Deployed end-to-end tool test, model/version lineage, rollback test, monitoring owner | Required independently of aggregate model scores |

Approval record still needed: approver, date, accepted scope, final thresholds,
evaluation/data version, exceptions, monitoring owner and rollback trigger. Until
then, acceptance remains **PENDING**, not automatically failed or passed by R2.

## Physical-feature admission plan

Current candidate source: `atlanta_canopy_heat_svi_modeling.tree_canopy_pct`.
Only audit it for now. Publisher, license, vintage, units, boundary version and
reproducible derivation remain unverified. Do not infer units from values <= 1,
replace missing values with zero, or silently restrict comparisons to matched rows.

After verification:

1. Snapshot the source, retain its contract and extraction hashes, validate unique
   GEOIDs and reconcile boundary vintages before joining.
2. Predeclare a geographic cohort where canopy is available at both training and
   serving. Compare the eight-feature baseline and canopy candidate on the **same**
   cohort/splits; report exclusions for the full agent population.
3. Keep the existing eight-feature serving contract unchanged. A canopy model needs
   a versioned contract and explicit feature lookup before an agent can use it.
4. Exclude `mean_temp`, `max_temp`, `mean_hi`, heat counts, normalized heat and
   integrated risk scores from predictors: their relationship to the target risks
   leakage. Do not automatically import SVI composites or population density with
   unknown units. No verified impervious-surface or land-use source is identified yet.
5. Only then authorize a candidate-only ablation. Neither a correlation nor a feature
   attribution establishes the cooling effect of planting trees.

Use the [read-only audit workflow](../pipelines/audit_physical_features.py) to
refresh quality and join coverage. Its report cannot approve feature admission.

## Current development audit

The [ranking audit](../pipelines/audit_ranking.py) implements the draft minimum
support rules, tied-rank Spearman, top-5 overlap and NDCG with linear nonnegative
ordinal relevance (average measured rank minus one). Shortlist ties use GEOID.
It reports per-tract errors and approximate p90, plus evaluation sensitivity when
each spatial cell is omitted in turn. Constant observed/predicted tract means make
the ranking inconclusive; insufficient support never silently reduces top-k.

This is **not** refitted spatial CV, a bootstrap confidence interval, an approved
gate or a test of the vulnerability-weighted policy score. Cohort membership can
change after omitting a cell; counts and shortlist IDs are retained for review.
Models must have completed registry lineage to the same original feature run.
Predictions are shifted by their recorded fitting anchor to the original evaluation
anchor, so buffered and unbuffered errors use identical labels. Do not compare their
previous ML.EVALUATE metrics as though their anchors were identical.
