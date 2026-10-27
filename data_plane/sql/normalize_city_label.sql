-- Repairs missing city labels for the currently configured Atlanta snapshot.
-- This updates only NULL/blank values and is safe to run more than once.
-- Run only when the BigQuery dataset is authorized for writes:
-- bq query --location=US --use_legacy_sql=false < data_plane/sql/normalize_city_label.sql

UPDATE `qwiklabs-gcp-03-1578f96a5a7a.a4i_climate.heat_observations`
SET city = 'Atlanta'
WHERE city IS NULL
   OR TRIM(city) = '';
