-- Shared training/inference preprocessing. Rendered by data_plane.pipelines.train_candidate.
SELECT
  geo_id,
  tract_lat,
  tract_lon,
  total_pop,
  CASE WHEN median_income >= 0 THEN median_income ELSE 65000.0 END AS median_income,
  CASE WHEN poverty_rate BETWEEN 0 AND 1 THEN poverty_rate ELSE 0.15 END AS poverty_rate,
  CASE WHEN no_vehicle_rate BETWEEN 0 AND 1 THEN no_vehicle_rate ELSE 0.10 END AS no_vehicle_rate,
  CASE WHEN median_age BETWEEN 0 AND 120 THEN median_age ELSE 36.0 END AS median_age,
  CASE WHEN housing_units >= 0 THEN housing_units ELSE 1500.0 END AS housing_units,
  CASE
    WHEN median_year_structure_built > 1800
      AND median_year_structure_built <= EXTRACT(YEAR FROM @reference_time)
      THEN median_year_structure_built
    ELSE 1975.0
  END AS median_year_structure_built,
  median_income IS NULL OR median_income < 0 AS income_imputed
FROM `{{tract_source}}`
WHERE REGEXP_CONTAINS(geo_id, r'^[0-9]{11}$')
  AND tract_lat BETWEEN -90 AND 90
  AND tract_lon BETWEEN -180 AND 180
