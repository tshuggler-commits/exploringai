-- Read-only. Plausible values are not proof of measured data or verified units.
WITH planting AS (
  SELECT * FROM `{{namespace}}.atlanta_tree_planting_optimization`
),
keys AS (
  SELECT GEOID, COUNT(*) AS n FROM planting GROUP BY GEOID
),
tracts AS (
  SELECT *, REGEXP_CONTAINS(geo_id, r'^[0-9]{11}$') AND total_pop > 400
    AND tract_lat BETWEEN 33.55 AND 34.02
    AND tract_lon BETWEEN -84.60 AND -84.15 AS ranking_eligible
  FROM `{{namespace}}.tract_demographics`
),
quality AS (
  SELECT field, COUNT(*) AS n,
    COUNTIF(value IS NULL) AS null_rows,
    COUNTIF(IS_NAN(value) OR IS_INF(value)) AS nonfinite_rows,
    COUNTIF(value < 0 OR (field = 'marginal_planting_cost' AND value = 0)
      OR (field = 'tree_canopy_pct' AND value > 100)) AS out_of_range_rows,
    MIN(IF(NOT IS_NAN(value) AND NOT IS_INF(value), value, NULL)) AS minimum,
    MAX(IF(NOT IS_NAN(value) AND NOT IS_INF(value), value, NULL)) AS maximum
  FROM planting CROSS JOIN UNNEST([
    STRUCT('tree_canopy_pct' AS field, tree_canopy_pct AS value),
    STRUCT('plantable_row_sqm', plantable_row_sqm),
    STRUCT('marginal_planting_cost', marginal_planting_cost),
    STRUCT('lst_temp', lst_temp),
    STRUCT('dist_to_facility', dist_to_facility),
    STRUCT('dist_to_transit', dist_to_transit)
  ])
  GROUP BY field
)
SELECT
  CURRENT_TIMESTAMP() AS audited_at,
  (SELECT AS STRUCT COUNT(*) AS n, COUNT(DISTINCT GEOID) AS unique_geoids,
    COUNTIF(GEOID IS NULL OR NOT REGEXP_CONTAINS(GEOID, r'^[0-9]{11}$')) AS invalid_geoids
    FROM planting) AS key_quality,
  (SELECT COUNT(*) FROM keys WHERE n > 1) AS duplicate_geoid_groups,
  ARRAY(SELECT AS STRUCT * FROM quality ORDER BY field) AS numeric_quality,
  (SELECT AS STRUCT COUNT(*) AS demographic_rows,
    COUNTIF(k.n = 1) AS unique_planting_matches,
    COUNTIF(t.ranking_eligible) AS ranking_rows,
    COUNTIF(t.ranking_eligible AND k.n = 1) AS ranking_unique_planting_matches
    FROM tracts AS t LEFT JOIN keys AS k ON t.geo_id = k.GEOID) AS coverage,
  ARRAY(SELECT AS STRUCT option_name, option_value
    FROM `{{namespace}}.INFORMATION_SCHEMA.TABLE_OPTIONS`
    WHERE table_name = 'atlanta_tree_planting_optimization'
      AND option_name IN ('description', 'labels')
    ORDER BY option_name) AS source_documentation
