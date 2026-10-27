-- Read-only profile. Numeric plausibility does not establish units or provenance.
WITH canopy AS (
  SELECT GEOID, tree_canopy_pct
  FROM `{{namespace}}.atlanta_canopy_heat_svi_modeling`
),
unique_canopy AS (
  SELECT GEOID,
    COUNT(*) AS source_rows,
    COUNTIF(tree_canopy_pct IS NOT NULL AND NOT IS_NAN(tree_canopy_pct)
      AND NOT IS_INF(tree_canopy_pct) AND tree_canopy_pct BETWEEN 0 AND 100) AS valid_rows
  FROM canopy
  GROUP BY GEOID
),
tracts AS (
  SELECT geo_id,
    REGEXP_CONTAINS(geo_id, r'^[0-9]{11}$')
      AND total_pop > 400
      AND tract_lat BETWEEN 33.55 AND 34.02
      AND tract_lon BETWEEN -84.60 AND -84.15 AS ranking_eligible
  FROM `{{namespace}}.tract_demographics`
),
coverage AS (
  SELECT 'demographic_tract_rows' AS population, COUNT(*) AS total_rows,
    COUNTIF(c.source_rows = 1 AND c.valid_rows = 1) AS usable_rows
  FROM tracts AS t LEFT JOIN unique_canopy AS c ON t.geo_id = c.GEOID
  UNION ALL
  SELECT 'agent_ranking_eligible_tract_rows', COUNT(*),
    COUNTIF(c.source_rows = 1 AND c.valid_rows = 1)
  FROM tracts AS t LEFT JOIN unique_canopy AS c ON t.geo_id = c.GEOID
  WHERE t.ranking_eligible
  UNION ALL
  SELECT IF(f.is_eval, 'evaluation_observations', 'training_observations'), COUNT(*),
    COUNTIF(c.source_rows = 1 AND c.valid_rows = 1)
  FROM `{{feature_table}}` AS f LEFT JOIN unique_canopy AS c ON f.geo_id = c.GEOID
  GROUP BY f.is_eval
)
SELECT
  CURRENT_TIMESTAMP() AS audited_at,
  (SELECT AS STRUCT
    COUNT(*) AS source_rows,
    COUNT(DISTINCT GEOID) AS distinct_geoids,
    COUNTIF(GEOID IS NULL OR NOT REGEXP_CONTAINS(GEOID, r'^[0-9]{11}$')) AS invalid_geoids,
    COUNTIF(tree_canopy_pct IS NULL) AS null_canopy_rows,
    COUNTIF(IS_NAN(tree_canopy_pct) OR IS_INF(tree_canopy_pct)
      OR tree_canopy_pct < 0 OR tree_canopy_pct > 100) AS invalid_canopy_rows,
    MIN(IF(NOT IS_NAN(tree_canopy_pct) AND NOT IS_INF(tree_canopy_pct),
      tree_canopy_pct, NULL)) AS canopy_min,
    MAX(IF(NOT IS_NAN(tree_canopy_pct) AND NOT IS_INF(tree_canopy_pct),
      tree_canopy_pct, NULL)) AS canopy_max
   FROM canopy) AS quality,
  (SELECT COUNT(*) FROM unique_canopy WHERE source_rows > 1) AS duplicate_geoid_groups,
  ARRAY(SELECT AS STRUCT population, total_rows, usable_rows,
    SAFE_DIVIDE(usable_rows, total_rows) AS usable_fraction
    FROM coverage ORDER BY population) AS coverage,
  ARRAY(
    SELECT AS STRUCT option_name, option_value
    FROM `{{namespace}}.INFORMATION_SCHEMA.TABLE_OPTIONS`
    WHERE table_name = 'atlanta_canopy_heat_svi_modeling'
      AND option_name IN ('description', 'labels')
    ORDER BY option_name
  ) AS source_documentation
