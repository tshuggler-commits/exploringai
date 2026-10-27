# BigQuery dataset structure

## Dataset

| Setting | Value |
|---|---|
| Google Cloud project | `qwiklabs-gcp-03-1578f96a5a7a` |
| BigQuery dataset | `a4i_climate` |
| Location | `US` |
| Core data and analysis tables | 8 |

Fully qualified table names use this format:

```text
qwiklabs-gcp-03-1578f96a5a.a4i_climate.<table_name>
```

The eight core data and analysis table schemas below were read from the dataset's BigQuery
`INFORMATION_SCHEMA.COLUMNS`. The training workflows also create retained, run-specific artifacts,
so the dataset's total table count grows as experiments are run. BigQuery ML models are separate
resources and are not included in the table count. Column modes are omitted from the core-table
summaries; use the refresh query to inspect current nullability.

## Tables

### `atlanta_daily_weather_clean`

Cleaned daily weather observations from Atlanta-area stations.

| Column | Type |
|---|---|
| `station_id` | `STRING` |
| `station_name` | `STRING` |
| `latitude` | `FLOAT64` |
| `longitude` | `FLOAT64` |
| `elevation_m` | `FLOAT64` |
| `date` | `DATE` |
| `year` | `INT64` |
| `month` | `INT64` |
| `tmax_f` | `FLOAT64` |
| `tmin_f` | `FLOAT64` |
| `tavg_f` | `FLOAT64` |
| `diurnal_range_f` | `FLOAT64` |
| `prcp_in` | `FLOAT64` |

Partitioned by `date` (daily) and clustered by `station_id`.

### `atlanta_canopy_heat_svi_modeling`

Tract-level heat and social-vulnerability features with an additional tree-canopy measure.

| Column | Type |
|---|---|
| `GEOID` | `STRING` |
| `mean_temp` | `FLOAT64` |
| `max_temp` | `FLOAT64` |
| `mean_rh` | `FLOAT64` |
| `mean_hi` | `FLOAT64` |
| `total_observations` | `INT64` |
| `intense_heat_count` | `INT64` |
| `intense_heat_pct` | `FLOAT64` |
| `NAME` | `STRING` |
| `POP100` | `INT64` |
| `pop_density` | `FLOAT64` |
| `RPL_THEMES` | `FLOAT64` |
| `RPL_THEME1` | `FLOAT64` |
| `RPL_THEME2` | `FLOAT64` |
| `RPL_THEME3` | `FLOAT64` |
| `RPL_THEME4` | `FLOAT64` |
| `EP_POV150` | `FLOAT64` |
| `EP_AGE65` | `FLOAT64` |
| `EP_NOVEH` | `FLOAT64` |
| `norm_hi` | `FLOAT64` |
| `norm_svi` | `FLOAT64` |
| `norm_density` | `FLOAT64` |
| `integrated_risk_score` | `FLOAT64` |
| `tree_canopy_pct` | `FLOAT64` |

`tree_canopy_pct` is available in this analysis table; it is not part of the current eight-feature
BQML training/agent contract.

### `atlanta_tree_planting_optimization`

Schema inspected on 2026-10-27. Includes all 24 columns listed for
`atlanta_canopy_heat_svi_modeling` above, plus:

| Column | Type |
|---|---|
| `dist_to_facility` | `FLOAT64` |
| `dist_to_transit` | `FLOAT64` |
| `norm_dist_facility` | `FLOAT64` |
| `norm_dist_transit` | `FLOAT64` |
| `lst_temp` | `FLOAT64` |
| `plantable_row_sqm` | `FLOAT64` |
| `marginal_planting_cost` | `FLOAT64` |

109 unique GEOIDs; 56 match the 264 tracts eligible under the agent ranking filter.
Names do not establish units, provenance or whether fields are measured/estimated/
synthetic. Cost denominator, currency, price year, LST units and area methodology
remain unverified. No cooling benefit or cost-effectiveness is inferred from this
table. See the [audit evidence](planting_audit_20261027.json) and
[ten-year scenario design](TREE_PLANTING_SCENARIO.md).

### `atlanta_tract_heat_svi_full`

Full tract-level dataset combining measured heat, population, and social-vulnerability features.

| Column | Type |
|---|---|
| `GEOID` | `STRING` |
| `mean_temp` | `FLOAT64` |
| `max_temp` | `FLOAT64` |
| `mean_rh` | `FLOAT64` |
| `mean_hi` | `FLOAT64` |
| `total_observations` | `INT64` |
| `intense_heat_count` | `INT64` |
| `intense_heat_pct` | `FLOAT64` |
| `NAME` | `STRING` |
| `POP100` | `INT64` |
| `pop_density` | `FLOAT64` |
| `RPL_THEMES` | `FLOAT64` |
| `RPL_THEME1` | `FLOAT64` |
| `RPL_THEME2` | `FLOAT64` |
| `RPL_THEME3` | `FLOAT64` |
| `RPL_THEME4` | `FLOAT64` |
| `EP_POV150` | `FLOAT64` |
| `EP_AGE65` | `FLOAT64` |
| `EP_NOVEH` | `FLOAT64` |
| `norm_hi` | `FLOAT64` |
| `norm_svi` | `FLOAT64` |
| `norm_density` | `FLOAT64` |
| `integrated_risk_score` | `FLOAT64` |

### `heat_observations`

Street-level heat measurements for a city campaign.

| Column | Type |
|---|---|
| `city` | `STRING` |
| `longitude` | `FLOAT64` |
| `latitude` | `FLOAT64` |
| `temp_f` | `FLOAT64` |
| `heat_index_f` | `FLOAT64` |
| `humidity_pct` | `FLOAT64` |
| `observed_at` | `TIMESTAMP` |

### `station_daily_temps`

Daily maximum temperatures recorded by weather stations.

| Column | Type |
|---|---|
| `station_id` | `STRING` |
| `station_name` | `STRING` |
| `latitude` | `FLOAT64` |
| `longitude` | `FLOAT64` |
| `observation_date` | `DATE` |
| `max_temp_f` | `FLOAT64` |

### `top_heat_svi_vulnerable_tracts`

Tract-level heat and social-vulnerability results for the selected vulnerable tracts.

| Column | Type |
|---|---|
| `GEOID` | `STRING` |
| `mean_temp` | `FLOAT64` |
| `max_temp` | `FLOAT64` |
| `mean_rh` | `FLOAT64` |
| `mean_hi` | `FLOAT64` |
| `total_observations` | `INT64` |
| `intense_heat_count` | `INT64` |
| `intense_heat_pct` | `FLOAT64` |
| `NAME` | `STRING` |
| `POP100` | `INT64` |
| `pop_density` | `FLOAT64` |
| `RPL_THEMES` | `FLOAT64` |
| `RPL_THEME1` | `FLOAT64` |
| `RPL_THEME2` | `FLOAT64` |
| `RPL_THEME3` | `FLOAT64` |
| `RPL_THEME4` | `FLOAT64` |
| `EP_POV150` | `FLOAT64` |
| `EP_AGE65` | `FLOAT64` |
| `EP_NOVEH` | `FLOAT64` |
| `norm_hi` | `FLOAT64` |
| `norm_svi` | `FLOAT64` |
| `norm_density` | `FLOAT64` |
| `integrated_risk_score` | `FLOAT64` |

### `tract_demographics`

Census-tract population, demographic, housing, and vehicle-access measures.

| Column | Type |
|---|---|
| `geo_id` | `STRING` |
| `tract_lat` | `FLOAT64` |
| `tract_lon` | `FLOAT64` |
| `total_pop` | `FLOAT64` |
| `median_age` | `FLOAT64` |
| `median_income` | `FLOAT64` |
| `housing_units` | `FLOAT64` |
| `median_year_structure_built` | `FLOAT64` |
| `no_cars` | `FLOAT64` |
| `households` | `FLOAT64` |
| `poverty_rate` | `FLOAT64` |
| `no_vehicle_rate` | `FLOAT64` |

## Training, tuning, and audit artifacts

These run-specific tables are retained rather than automatically expired. Their names include
the run ID, so they add to the dataset inventory as workflows execute.

| Artifact | Naming pattern | Purpose |
|---|---|---|
| Heat source snapshot | `heat_snapshot_<run_id>` | Point-in-time copy of `heat_observations` |
| Tract source snapshot | `tract_snapshot_<run_id>` | Point-in-time copy of `tract_demographics` |
| Initial training features | `training_data_<run_id>` | Cleaned features, target, spatial split, and row-level metadata |
| Tuning feature snapshot | `tuning_features_<run_id>` | Preserved feature data for ridge tuning |
| Inner spatial folds | `inner_folds_<run_id>` | Outer-training rows assigned to tuning folds |
| Audit source snapshot | `audit_source_<run_id>` | Preserved feature rows for residual/buffer audit |
| Buffered features | `buffered_features_<run_id>` | Training data after the 500 m holdout exclusion |
| Parent residuals | `residuals_parent_<run_id>` | Holdout predictions and errors for the tuned parent |
| Buffered residuals | `residuals_buffered_<run_id>` | Holdout predictions and errors for the buffered candidate |

Candidate and fold models are BigQuery ML model resources rather than tables. They include
`heat_offset_model_<run_id>` and the fold-specific `ridge_<run_id>_l2_<value>_f<fold>` models.
None of these run artifacts automatically replaces the active `heat_offset_model`.

### `model_training_events`

Append-only run and stage audit registry. It is partitioned by `DATE(event_time)` and clustered by
`run_id, stage`.

| Column | Type | Mode |
|---|---|---|
| `event_id` | `STRING` | `REQUIRED` |
| `run_id` | `STRING` | `REQUIRED` |
| `event_time` | `TIMESTAMP` | `REQUIRED` |
| `stage` | `STRING` | `REQUIRED` |
| `state` | `STRING` | `REQUIRED` |
| `candidate_model` | `STRING` | `REQUIRED` |
| `payload` | `JSON` | `NULLABLE` |

## Refresh the schema listing

The original six-table inventory has changed. At the latest inspection on 2026-10-27, the dataset
contained seven core data/analysis tables plus 16 run-specific tables. This total changes as more
experiments are retained. Use these queries to check the current inventory and definitions:

```sql
SELECT table_name, table_type
FROM `qwiklabs-gcp-03-1578f96a5a7a.a4i_climate.INFORMATION_SCHEMA.TABLES`
ORDER BY table_name;
```

Run this query to inspect the current column names, data types, and nullability:

```sql
SELECT
  table_name,
  ordinal_position,
  column_name,
  data_type,
  is_nullable
FROM `qwiklabs-gcp-03-1578f96a5a7a.a4i_climate.INFORMATION_SCHEMA.COLUMNS`
ORDER BY table_name, ordinal_position;
```
