-- Evaluate explicitly on the persisted spatial holdout, never on training rows.
SELECT *
FROM ML.EVALUATE(
  MODEL `{{candidate_model}}`,
  (
    SELECT
      latitude,
      longitude,
      median_income,
      poverty_rate,
      no_vehicle_rate,
      median_age,
      housing_units,
      median_year_structure_built,
      offset_f
    FROM `{{feature_table}}`
    WHERE is_eval
  )
)
