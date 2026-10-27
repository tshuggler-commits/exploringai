# Tree planting: ten-year relief per dollar

## Selected question and status

Where would planting deliver the most cumulative reduction of human heat exposure
per dollar over the **next ten years from planting**?

Status: **input audit and scenario design only**. No benefit estimate, investment
ranking, model promotion or agent integration is authorized by this document.
The [audit workflow](../pipelines/audit_tree_planting.py) explicitly emits null
cost-effectiveness and an empty recommendation list while required evidence is absent.

## Measurement proposal, not an accepted standard

Use person-degree-Celsius-hours of ambient heat exposure avoided. For a declared
temperature threshold H, calculate each scenario's burden:

`burden = sum(people_present * max(ambient_temperature_C - H, 0) * hours)`

Benefit is no-planting burden minus planting burden over ten years. Preserve negative
effects; do not clip them into benefits. Compare the same weather, population and
other conditions in both scenarios. Report the heat threshold and sensitivity to it.
If humidity matters, define a separate heat-index endpoint rather than mixing units.
This measure is an exposure proxy, not prevented deaths or clinically validated relief.

Divide expected cumulative avoided exposure by expected incremental lifecycle cost.
Report both quantities as well as the ratio; a ranking without its scale can be
misleading. Specify currency, price year, cost discount rate, whether benefits are
discounted, and the difference between ratio of expectations and expected ratio.
No rates or numerical cooling coefficients are selected here.

## Required evidence

| Component | Required contract |
|---|---|
| Current canopy and area | Source/license, measurement date, boundary vintage, extraction code, units, uncertainty |
| Plantable right-of-way | Verified meaning of `plantable_row_sqm`, site constraints, utilities, ownership and accessible planting locations |
| Marginal cost | Confirm USD/tree vs USD/m² or another denominator; identify included costs, price year and local applicability |
| Ten-year trajectory | Species, planting size, annual growth, mortality, replacement and maintenance assumptions |
| Cooling response | Defensible intervention-response evidence applicable to local climate, ambient temperature and planting scale |
| Exposure | Hourly ambient heat and people present in affected locations; resident tract population alone is insufficient |
| Counterfactual | Existing tree growth/loss, no-program trend and identical weather/exposure assumptions |
| Uncertainty | Joint distributions/correlations or explicitly bounded scenarios, not invented precision |

`lst_temp` is land-surface temperature by name only until its source/units are
confirmed. It must not be silently substituted for ambient heat. Likewise,
`marginal_planting_cost` must not be used as a divisor until its unit and inclusions
are established. Plausible ranges cannot identify whether values were simulated.

## Decision-support implementation after contracts are verified

1. Retain immutable source snapshots, evidence references, versioned assumptions and
   exact scenario code/configuration hashes. Every output must identify its inputs.
2. Compare no planting with feasible planting doses at actual sites. Account for
   survival and growth annually, not an immediate mature-tree benefit.
3. Use a defensible cooling response with documented external validity. Do not treat
   an observational canopy coefficient or ML attribution as a causal intervention.
4. Report benefit/cost distributions, downside cases and rank sensitivity. A
   probability of being in the top group is more honest than a single precise rank
   when uncertainty is large. Validate assumptions against observed local outcomes.
5. Account for overlapping shade/cooling footprints and diminishing returns.
   Independent tract scores are not automatically additive budget allocations.
6. Publish unweighted exposure efficiency separately from equity goals. Stakeholders
   must approve weights or budget constraints; a composite vulnerability index is
   not itself avoided exposure.
7. Agent output must distinguish observed evidence, assumptions, scenario estimates,
   missing support and unsupported geographies. Without required inputs, respond
   that cost-effectiveness is not yet estimable; a needs shortlist is a different task.

This design complements the [heat-ranking acceptance proposal](MODEL_ACCEPTANCE.md);
it does not change those draft gates into production approval.
