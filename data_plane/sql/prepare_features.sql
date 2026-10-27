-- One row per source reading; nearest centroid is an approximation, not polygon containment.
CREATE TABLE `{{feature_table}}`
OPTIONS (
  description = 'Versioned Atlanta training features; no automatic expiration or replacement.'
) AS
WITH tracts AS (
  {{clean_tracts_sql}}
),
observations AS (
  SELECT
    ROW_NUMBER() OVER () AS observation_id,
    latitude,
    longitude,
    temp_f,
    FORMAT(
      '%d:%d',
      CAST(FLOOR(latitude * 50) AS INT64),
      CAST(FLOOR(longitude * 50) AS INT64)
    ) AS spatial_cell
  FROM `{{heat_source}}`
  WHERE latitude BETWEEN -90 AND 90
    AND longitude BETWEEN -180 AND 180
    AND temp_f BETWEEN 40 AND 140
),
matched AS (
  SELECT
    observation.*,
    tract.* EXCEPT (tract_lat, tract_lon),
    ST_DISTANCE(
      ST_GEOGPOINT(observation.longitude, observation.latitude),
      ST_GEOGPOINT(tract.tract_lon, tract.tract_lat)
    ) AS tract_distance_m
  FROM observations AS observation
  CROSS JOIN tracts AS tract
  QUALIFY ROW_NUMBER() OVER (
    PARTITION BY observation.observation_id
    ORDER BY ST_DISTANCE(
      ST_GEOGPOINT(observation.longitude, observation.latitude),
      ST_GEOGPOINT(tract.tract_lon, tract.tract_lat)
    ), tract.geo_id
  ) = 1
),
split AS (
  SELECT
    *,
    MOD(MOD(FARM_FINGERPRINT(spatial_cell), 5) + 5, 5) = 0 AS is_eval
  FROM matched
),
anchored AS (
  SELECT
    *,
    AVG(IF(NOT is_eval, temp_f, NULL)) OVER () AS training_mean_temp_f
  FROM split
)
SELECT
  *,
  temp_f - training_mean_temp_f AS offset_f
FROM anchored
