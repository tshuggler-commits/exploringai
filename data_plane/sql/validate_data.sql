-- Read-only regression checks for the Atlanta snapshot and four-table join.
-- Run from the repository root with:
-- bq query --location=US --use_legacy_sql=false < data_plane/sql/validate_data.sql

DECLARE expected_columns ARRAY<STRUCT<
  table_name STRING,
  column_name STRING,
  data_type STRING
>> DEFAULT [
  STRUCT('heat_observations', 'city', 'STRING'),
  STRUCT('heat_observations', 'latitude', 'FLOAT64'),
  STRUCT('heat_observations', 'longitude', 'FLOAT64'),
  STRUCT('heat_observations', 'temp_f', 'FLOAT64'),
  STRUCT('heat_observations', 'heat_index_f', 'FLOAT64'),
  STRUCT('heat_observations', 'humidity_pct', 'FLOAT64'),
  STRUCT('heat_observations', 'observed_at', 'TIMESTAMP'),
  STRUCT('tract_demographics', 'geo_id', 'STRING'),
  STRUCT('tract_demographics', 'tract_lat', 'FLOAT64'),
  STRUCT('tract_demographics', 'tract_lon', 'FLOAT64'),
  STRUCT('tract_demographics', 'total_pop', 'FLOAT64'),
  STRUCT('tract_demographics', 'median_age', 'FLOAT64'),
  STRUCT('tract_demographics', 'median_income', 'FLOAT64'),
  STRUCT('tract_demographics', 'housing_units', 'FLOAT64'),
  STRUCT('tract_demographics', 'median_year_structure_built', 'FLOAT64'),
  STRUCT('tract_demographics', 'no_cars', 'FLOAT64'),
  STRUCT('tract_demographics', 'households', 'FLOAT64'),
  STRUCT('tract_demographics', 'poverty_rate', 'FLOAT64'),
  STRUCT('tract_demographics', 'no_vehicle_rate', 'FLOAT64'),
  STRUCT('atlanta_daily_weather_clean', 'station_id', 'STRING'),
  STRUCT('atlanta_daily_weather_clean', 'station_name', 'STRING'),
  STRUCT('atlanta_daily_weather_clean', 'latitude', 'FLOAT64'),
  STRUCT('atlanta_daily_weather_clean', 'longitude', 'FLOAT64'),
  STRUCT('atlanta_daily_weather_clean', 'elevation_m', 'FLOAT64'),
  STRUCT('atlanta_daily_weather_clean', 'date', 'DATE'),
  STRUCT('atlanta_daily_weather_clean', 'year', 'INT64'),
  STRUCT('atlanta_daily_weather_clean', 'month', 'INT64'),
  STRUCT('atlanta_daily_weather_clean', 'tmax_f', 'FLOAT64'),
  STRUCT('atlanta_daily_weather_clean', 'tmin_f', 'FLOAT64'),
  STRUCT('atlanta_daily_weather_clean', 'tavg_f', 'FLOAT64'),
  STRUCT('atlanta_daily_weather_clean', 'diurnal_range_f', 'FLOAT64'),
  STRUCT('atlanta_daily_weather_clean', 'prcp_in', 'FLOAT64'),
  STRUCT('station_daily_temps', 'station_id', 'STRING'),
  STRUCT('station_daily_temps', 'station_name', 'STRING'),
  STRUCT('station_daily_temps', 'latitude', 'FLOAT64'),
  STRUCT('station_daily_temps', 'longitude', 'FLOAT64'),
  STRUCT('station_daily_temps', 'observation_date', 'DATE'),
  STRUCT('station_daily_temps', 'max_temp_f', 'FLOAT64')
];

DECLARE invalid_schema_columns INT64;

SET invalid_schema_columns = (
  SELECT COUNT(*)
  FROM UNNEST(expected_columns) AS expected
  LEFT JOIN `qwiklabs-gcp-03-1578f96a5a7a.a4i_climate.INFORMATION_SCHEMA.COLUMNS` AS actual
    USING (table_name, column_name)
  WHERE actual.column_name IS NULL
     OR actual.data_type != expected.data_type
     OR actual.is_nullable != 'YES'
);

ASSERT invalid_schema_columns = 0
  AS 'One or more expected table columns are missing or have changed type/mode.';

ASSERT (
  SELECT COUNT(*) = 23386
  FROM `qwiklabs-gcp-03-1578f96a5a7a.a4i_climate.heat_observations`
) AS 'Unexpected heat_observations row count.';

ASSERT (
  SELECT COUNT(*) = 353
  FROM `qwiklabs-gcp-03-1578f96a5a7a.a4i_climate.tract_demographics`
) AS 'Unexpected tract_demographics row count.';

ASSERT (
  SELECT COUNT(*) = 10878
  FROM `qwiklabs-gcp-03-1578f96a5a7a.a4i_climate.atlanta_daily_weather_clean`
) AS 'Unexpected atlanta_daily_weather_clean row count.';

ASSERT (
  SELECT COUNT(*) = 17452
  FROM `qwiklabs-gcp-03-1578f96a5a7a.a4i_climate.station_daily_temps`
) AS 'Unexpected station_daily_temps row count.';

ASSERT (
  SELECT COUNTIF(city IS NULL OR TRIM(city) = '') = 0
  FROM `qwiklabs-gcp-03-1578f96a5a7a.a4i_climate.heat_observations`
) AS 'heat_observations contains rows without a city label; run data_plane/sql/normalize_city_label.sql.';

ASSERT (
  SELECT COUNT(*) > 0
  FROM (
    WITH heat_point AS (
      SELECT
        latitude,
        longitude,
        temp_f,
        observed_at,
        DATE(observed_at) AS obs_date
      FROM `qwiklabs-gcp-03-1578f96a5a7a.a4i_climate.heat_observations`
      WHERE latitude IS NOT NULL
        AND longitude IS NOT NULL
        AND temp_f IS NOT NULL
        AND observed_at IS NOT NULL
      ORDER BY observed_at
      LIMIT 1
    ),
    nearest_tract AS (
      SELECT
        heat_point.*,
        tract.geo_id,
        tract.tract_lat,
        tract.tract_lon,
        tract.poverty_rate,
        tract.no_vehicle_rate,
        ROW_NUMBER() OVER (
          ORDER BY ST_DISTANCE(
            ST_GEOGPOINT(heat_point.longitude, heat_point.latitude),
            ST_GEOGPOINT(tract.tract_lon, tract.tract_lat)
          )
        ) AS tract_rank
      FROM heat_point
      CROSS JOIN `qwiklabs-gcp-03-1578f96a5a7a.a4i_climate.tract_demographics` AS tract
      WHERE tract.tract_lat IS NOT NULL
        AND tract.tract_lon IS NOT NULL
    ),
    nearest_daily_station AS (
      SELECT
        nearest_tract.*,
        weather.station_id,
        weather.station_name,
        weather.tavg_f,
        ROW_NUMBER() OVER (
          ORDER BY ST_DISTANCE(
            ST_GEOGPOINT(nearest_tract.longitude, nearest_tract.latitude),
            ST_GEOGPOINT(weather.longitude, weather.latitude)
          )
        ) AS station_rank
      FROM nearest_tract
      JOIN `qwiklabs-gcp-03-1578f96a5a7a.a4i_climate.atlanta_daily_weather_clean` AS weather
        ON weather.date = nearest_tract.obs_date
      WHERE nearest_tract.tract_rank = 1
        AND weather.latitude IS NOT NULL
        AND weather.longitude IS NOT NULL
        AND weather.tavg_f IS NOT NULL
    )
    SELECT 1
    FROM nearest_daily_station
    JOIN (
      SELECT
        station_id,
        COUNTIF(max_temp_f >= 90) AS days_over_90f
      FROM `qwiklabs-gcp-03-1578f96a5a7a.a4i_climate.station_daily_temps`
      GROUP BY station_id
    ) AS history
      USING (station_id)
    WHERE station_rank = 1
      AND history.days_over_90f > 0
  )
) AS 'The four-table spatial/temporal integration returned no rows.';

SELECT
  'heat_observations' AS table_name,
  COUNT(*) AS row_count,
  23386 AS expected_row_count
FROM `qwiklabs-gcp-03-1578f96a5a7a.a4i_climate.heat_observations`
UNION ALL
SELECT
  'tract_demographics',
  COUNT(*),
  353
FROM `qwiklabs-gcp-03-1578f96a5a7a.a4i_climate.tract_demographics`
UNION ALL
SELECT
  'atlanta_daily_weather_clean',
  COUNT(*),
  10878
FROM `qwiklabs-gcp-03-1578f96a5a7a.a4i_climate.atlanta_daily_weather_clean`
UNION ALL
SELECT
  'station_daily_temps',
  COUNT(*),
  17452
FROM `qwiklabs-gcp-03-1578f96a5a7a.a4i_climate.station_daily_temps`;

SELECT
  COUNTIF(city IS NULL OR TRIM(city) = '') AS observations_without_city_label,
  'Expected 0 after label normalization.'
    AS city_label_check
FROM `qwiklabs-gcp-03-1578f96a5a7a.a4i_climate.heat_observations`;

WITH heat_point AS (
  SELECT
    latitude,
    longitude,
    temp_f,
    observed_at,
    DATE(observed_at) AS obs_date
  FROM `qwiklabs-gcp-03-1578f96a5a7a.a4i_climate.heat_observations`
  WHERE latitude IS NOT NULL
    AND longitude IS NOT NULL
    AND temp_f IS NOT NULL
    AND observed_at IS NOT NULL
  ORDER BY observed_at
  LIMIT 1
),
nearest_tract AS (
  SELECT
    heat_point.*,
    tract.geo_id,
    tract.tract_lat,
    tract.tract_lon,
    tract.poverty_rate,
    tract.no_vehicle_rate,
    ROW_NUMBER() OVER (
      ORDER BY ST_DISTANCE(
        ST_GEOGPOINT(heat_point.longitude, heat_point.latitude),
        ST_GEOGPOINT(tract.tract_lon, tract.tract_lat)
      )
    ) AS tract_rank
  FROM heat_point
  CROSS JOIN `qwiklabs-gcp-03-1578f96a5a7a.a4i_climate.tract_demographics` AS tract
  WHERE tract.tract_lat IS NOT NULL
    AND tract.tract_lon IS NOT NULL
),
nearest_daily_station AS (
  SELECT
    nearest_tract.*,
    weather.station_id,
    weather.station_name,
    weather.tavg_f,
    ROW_NUMBER() OVER (
      ORDER BY ST_DISTANCE(
        ST_GEOGPOINT(nearest_tract.longitude, nearest_tract.latitude),
        ST_GEOGPOINT(weather.longitude, weather.latitude)
      )
    ) AS station_rank
  FROM nearest_tract
  JOIN `qwiklabs-gcp-03-1578f96a5a7a.a4i_climate.atlanta_daily_weather_clean` AS weather
    ON weather.date = nearest_tract.obs_date
  WHERE nearest_tract.tract_rank = 1
    AND weather.latitude IS NOT NULL
    AND weather.longitude IS NOT NULL
    AND weather.tavg_f IS NOT NULL
),
station_history AS (
  SELECT
    station_id,
    COUNTIF(max_temp_f >= 90) AS days_over_90f
  FROM `qwiklabs-gcp-03-1578f96a5a7a.a4i_climate.station_daily_temps`
  GROUP BY station_id
)
SELECT
  nearest_daily_station.observed_at,
  ROUND(nearest_daily_station.temp_f, 1) AS street_temp_f,
  ROUND(nearest_daily_station.tavg_f, 1) AS nearest_station_avg_f,
  ROUND(nearest_daily_station.temp_f - nearest_daily_station.tavg_f, 1) AS station_delta_f,
  nearest_daily_station.geo_id AS census_tract_id,
  ROUND(nearest_daily_station.poverty_rate * 100, 1) AS poverty_pct,
  ROUND(nearest_daily_station.no_vehicle_rate * 100, 1) AS no_vehicle_pct,
  nearest_daily_station.station_name,
  COALESCE(station_history.days_over_90f, 0) AS days_over_90f_historical
FROM nearest_daily_station
LEFT JOIN station_history
  USING (station_id)
WHERE nearest_daily_station.station_rank = 1;
