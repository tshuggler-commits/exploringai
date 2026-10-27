-- Agent-lane handoff: same cleaning SQL as training; coordinates are query parameters.
WITH tracts AS (
  {{clean_tracts_sql}}
),
nearest_tract AS (
  SELECT *
  FROM tracts
  ORDER BY ST_DISTANCE(
    ST_GEOGPOINT(@longitude, @latitude),
    ST_GEOGPOINT(tract_lon, tract_lat)
  ), geo_id
  LIMIT 1
)
SELECT
  prediction.predicted_offset_f,
  prediction.top_feature_attributions,
  tract.geo_id,
  tract.total_pop,
  tract.income_imputed
FROM ML.EXPLAIN_PREDICT(
  MODEL `{{candidate_model}}`,
  (
    SELECT
      @latitude AS latitude,
      @longitude AS longitude,
      median_income,
      poverty_rate,
      no_vehicle_rate,
      median_age,
      housing_units,
      median_year_structure_built
    FROM nearest_tract
  ),
  STRUCT(3 AS top_k_features)
) AS prediction
CROSS JOIN nearest_tract AS tract
