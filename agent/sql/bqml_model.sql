-- =============================================================================
-- A4I 2026 Challenge 1: Urban Heat Resilience
-- BigQuery ML Model Training, Evaluation, and ML.EXPLAIN_PREDICT Reference SQL
-- =============================================================================
-- Target (Label): `heat_offset_f` (degrees Fahrenheit above the citywide
--                 campaign average on the NOAA Heat Watch day).
-- Model Type:     `LINEAR_REG` (Free-tier eligible, fast training, native
--                 support for `ML.EXPLAIN_PREDICT` feature attributions).
-- Ethical AI:     Race and ethnicity columns are deliberately excluded from
--                 model training inputs. Socioeconomic equity is verified
--                 post-hoc via `audit_recommendations_equity`.
-- =============================================================================

-- 1. Train the Heat Offset Model
-- This model uses the single Atlanta Heat Watch campaign and Census features.
-- Station-history tables are kept separate for temporal-risk analysis.
CREATE MODEL IF NOT EXISTS `qwiklabs-gcp-03-1578f96a5a7a.a4i_climate.heat_planning_model`
OPTIONS(
  model_type = 'LINEAR_REG',
  input_label_cols = ['heat_offset_f'],
  optimize_strategy = 'NORMAL_EQUATION'
) AS
WITH city_stats AS (
  SELECT
    AVG(temp_f) AS avg_temp_f,
    AVG(latitude) AS center_lat,
    AVG(longitude) AS center_lon
    FROM `qwiklabs-gcp-03-1578f96a5a7a.a4i_climate.heat_observations`
  WHERE temp_f IS NOT NULL
      AND latitude IS NOT NULL
      AND longitude IS NOT NULL
),
grid_observations AS (
  -- Aggregate ~100m spatial cells to prevent stop-light GPS oversampling
  SELECT
    ROUND(latitude, 3) AS latitude,
    ROUND(longitude, 3) AS longitude,
    AVG(temp_f) AS local_temp_f,
    AVG(humidity_pct) AS humidity_pct
  FROM `qwiklabs-gcp-03-1578f96a5a7a.a4i_climate.heat_observations`
  WHERE temp_f IS NOT NULL
    AND latitude IS NOT NULL
    AND longitude IS NOT NULL
  GROUP BY 1, 2
),
matched_tracts AS (
  SELECT
    g.latitude,
    g.longitude,
    g.local_temp_f - c.avg_temp_f AS heat_offset_f,
    ST_DISTANCE(
      ST_GEOGPOINT(g.longitude, g.latitude),
      ST_GEOGPOINT(c.center_lon, c.center_lat)
    ) / 1000.0 AS dist_from_center_km,
    ARRAY_AGG(
      STRUCT(
      t.total_pop AS total_pop,
      NULLIF(t.median_age, -666666666.0) AS median_age,
      NULLIF(t.median_income, -666666666.0) AS median_income,
      t.housing_units AS housing_units,
      NULLIF(t.median_year_structure_built, -666666666.0) AS median_year_structure_built,
      t.no_cars AS no_cars,
      t.households AS households,
      t.poverty_rate AS poverty_rate,
      t.no_vehicle_rate AS no_vehicle_rate
      )
      ORDER BY ST_DISTANCE(
        ST_GEOGPOINT(g.longitude, g.latitude),
        ST_GEOGPOINT(t.tract_lon, t.tract_lat)
      ) ASC
      LIMIT 1
    )[OFFSET(0)] AS nearest_tract
  FROM grid_observations AS g
  CROSS JOIN city_stats AS c
  CROSS JOIN `qwiklabs-gcp-03-1578f96a5a7a.a4i_climate.tract_demographics` AS t
  WHERE t.tract_lat IS NOT NULL AND t.tract_lon IS NOT NULL
  GROUP BY g.latitude, g.longitude, g.local_temp_f, c.avg_temp_f, c.center_lon, c.center_lat
)
SELECT
  heat_offset_f,
  latitude,
  longitude,
  dist_from_center_km,
  COALESCE(nearest_tract.total_pop, 3500.0) AS total_pop,
  COALESCE(nearest_tract.median_age, 36.0) AS median_age,
  COALESCE(nearest_tract.median_income, 55000.0) AS median_income,
  COALESCE(nearest_tract.housing_units, 1500.0) AS housing_units,
  COALESCE(nearest_tract.median_year_structure_built, 1978.0) AS median_year_structure_built,
  GREATEST(0.0, 2026.0 - COALESCE(nearest_tract.median_year_structure_built, 1978.0)) AS structure_age_years,
  SAFE_DIVIDE(
    COALESCE(nearest_tract.housing_units, 1500.0),
    GREATEST(COALESCE(nearest_tract.total_pop, 3500.0), 100.0)
  ) AS housing_density_proxy,
  COALESCE(nearest_tract.no_cars, 120.0) AS no_cars,
  COALESCE(nearest_tract.households, 1300.0) AS households,
  COALESCE(nearest_tract.poverty_rate, 0.15) AS poverty_rate,
  COALESCE(nearest_tract.no_vehicle_rate, 0.08) AS no_vehicle_rate
FROM matched_tracts;

-- 2. Evaluate Model Performance (Check R^2 and MAE; guard against target leakage)
SELECT *
FROM ML.EVALUATE(MODEL `qwiklabs-gcp-03-1578f96a5a7a.a4i_climate.heat_planning_model`);

-- 3. Inspect Learned Feature Weights
SELECT *
FROM ML.WEIGHTS(MODEL `qwiklabs-gcp-03-1578f96a5a7a.a4i_climate.heat_planning_model`)
ORDER BY ABS(weight) DESC;
