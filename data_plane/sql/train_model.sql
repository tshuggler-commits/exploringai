-- Rendered only by data_plane.pipelines.train_candidate. Never replaces the active model.
CREATE MODEL `{{candidate_model}}`
OPTIONS (
  MODEL_TYPE = 'LINEAR_REG',
  INPUT_LABEL_COLS = ['offset_f'],
  DATA_SPLIT_METHOD = 'CUSTOM',
  DATA_SPLIT_COL = 'is_eval',
  ENABLE_GLOBAL_EXPLAIN = TRUE
) AS
SELECT
  latitude,
  longitude,
  median_income,
  poverty_rate,
  no_vehicle_rate,
  median_age,
  housing_units,
  median_year_structure_built,
  offset_f,
  is_eval
FROM `{{feature_table}}`
