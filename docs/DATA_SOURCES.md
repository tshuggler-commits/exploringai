# Data Sources: Atlanta Urban Heat, Social Vulnerability, & Resource Accessibility Analysis

## 1. Executive Summary & Analytical Synopsis
This standalone documentation outlines the analytical and strategic framework developed to measure extreme heat risks, social vulnerability, and resource accessibility deserts at the Census Tract level in Atlanta, Georgia (covering Fulton and DeKalb counties).

By integrating NOAA afternoon heat traverses, CDC Social Vulnerability Index (SVI) demographics, population density, and municipal facility/transit access points, we map out spatial resource mismatches. This framework translates microclimate temperature observations and demographic realities into mathematical priority indices for targeted interventions such as hydration fleet routing and permanent cooling center placements.

### Public Availability & Licensing Statement
All data sources utilized in this analysis are publicly available and contain no restrictive licensing requirements. The specific databases, APIs, and structures queried are in the public domain or distributed under open, royalty-free public access waivers (such as Creative Commons CC0 or Open Database Licenses without commercial restrictions), ensuring fully reproducible and open-source operations for municipal stakeholders.

---

## 2. Integrated Data Families, Dictionary & Schema Mappings
To assess vulnerability across multiple socio-environmental vectors, we integrated the following data elements at the Census Tract level:

### A. Data Dictionary & Core Metrics
* **`GEOID`** (String): Unique 11-digit Census Tract identifier (comprising State, County, and Tract codes).
* **`mean_hi`** (Float64): Average apparent temperature (Heat Index) in Fahrenheit derived from NOAA traverse points.
* **`RPL_THEMES`** (Float64): Overall Social Vulnerability Index percentile ranking (0.0 to 1.0; higher represents greater vulnerability).
* **`pop_density`** (Float64): Population density measured as residents per square mile of land area.
* **`tree_canopy_pct`** (Float64): Percentage of surface area covered by tree canopy.
* **`dist_to_facility`** (Float64): Vectorized distance (meters) from the tract centroid to the nearest public facility (library/community center/townhall).
* **`dist_to_transit`** (Float64): Vectorized distance (meters) from the tract centroid to the nearest MARTA transit station.
* **`lst_temp`** (Float64): Land Surface Temperature (LST) in Fahrenheit.
* **`marginal_planting_cost`** (Float64): Marginal cost to plant and establish one tree within the tract ($/tree).
* **`plantable_row_sqm`** (Float64): Total plantable right-of-way (ROW) area available in square meters.

### B. Detailed Data Sources & Physical Lineage
#### 1. Microclimate Exposure: NOAA Afternoon Heat Traverses
* **Source**: NOAA Urban Heat Island (UHI) Traverse Campaigns.
* **Role**: Provides mobile sensor points containing ambient dry-bulb temperature, relative humidity, and heat index.
* **Methodology**: Traverses map empirical heat exposure. Data points are aggregated spatially using Point-in-Polygon joins to capture tract-level averages (`mean_hi`).

#### 2. Social Vulnerability Index: CDC/ATSDR SVI 2020
* **Source**: CDC Agency for Toxic Substances and Disease Registry.
* **Role**: Pinpoints communities with socioeconomic, household, and transportation barriers.
* **Methodology**: Uses standard percentile ranking (`RPL_THEMES`) to measure structural sensitivity to heat shocks.

#### 3. Demographic Exposure: US Census Bureau (TIGERweb API)
* **Source**: US Census Decennial Dataset.
* **Role**: Establishes underlying population totals (`POP100`) and boundaries to calculate population density per square mile.

#### 4. Resource Accessibility: OpenStreetMap (OSM)
* **Source**: Overpass API Spatial Queries.
* **Role**: Identifies locations of public libraries, community centers, and transit terminals.

---

## 3. Mathematical Derivations of Physical, Cost, and Canopy Variables
To determine the optimal allocation of greening resources, three key physical and cost metrics were derived and mathematically modeled to simulate realistic urban streetscape and concrete-density constraints:

### A. Tree Canopy Percentage (`tree_canopy_pct`)
To capture the inverse relationship between built environment density and urban forestry, the canopy coverage is modeled as a function of the natural logarithm of population density, augmented by random localized noise modeling micro-level parks and terrain structures:

$$\text{Canopy Percentage}_i = \max\left(5.0, \min\left(75.0, 60.0 - 45.0 \times N(\log(1 + \text{pop\_density}_i)) + \epsilon_i\right)\right)$$

Where:
* $N(\cdot)$ is a min-max normalization operator scaling log population density to a standard $[0, 1]$ interval.
* $\epsilon_i \sim \mathcal{N}(0, 5)$ represents spatial Gaussian variance.

### B. Plantable Right-of-Way Area (`plantable_row_sqm`)
The physical space available for street-tree interventions is modeled based on the available non-impervious right-of-way. High-density urban environments present highly constrained concrete geometries, leaving limited plantable zones:

$$\text{ROW Area}_i = \max\left(500, 25000 \times (1 - N(\text{pop\_density}_i)) + U_i\right)$$

Where $U_i \sim \text{Uniform}(500, 2000)$ represents localized terrain easements.

### C. Marginal Planting Cost per Tree (`marginal_planting_cost`)
Planting street trees in dense commercial corridors requires concrete cutouts, utility line protections, and extensive traffic safety management, dramatically elevating costs compared to planting in open parkland or residential soft soils:

$$\text{Marginal Cost}_i = \max\left(300, \min\left(1500, 300 + 1200 \times N(\text{pop\_density}_i) + \eta_i\right)\right)$$

Where $\eta_i \sim \mathcal{N}(0, 50)$ captures micro-scale supply chain and labor fluctuations.

---

## 4. Multi-Departmental Cost-Sharing & Budget Matrix
To fund greening interventions across the 109 eligible tracts, we established three distinct departmental funding pools:

* **Office of Parks (\$40,000.00)**: Eligible if the tract's tree canopy percentage is below the median of our cohort (< 37.16%).
* **Department of Watershed Management (\$50,000.00)**: Eligible if population density is above the median (> 5,141.38 residents/sq mile), serving as a surrogate for high impervious runoff areas.
* **Office of Resilience (\$30,000.00)**: Eligible if the tract's CDC SVI percentile is high (> 0.50).

### Cost-Sharing Rule
A standard tract greening intervention costs \$1,500.00. This project cost is divided equally among the departments for which the tract is eligible. For example, if a tract is eligible for Parks and Resilience, each department contributes \$750.00 to fund that tract's greening project.

---

## 5. Mixed-Integer Linear Programming (MILP) Formulation
To maximize the spatial coverage of greening interventions under multi-budget constraints, we formulate the optimization problem as follows:

Let:
* $I$ be the set of eligible Census Tracts ($|I| = 109$).
* $y_i \in \{0, 1\}$ be the binary decision variable indicating whether a greening project is funded in tract $i$ ($y_i = 1$) or not ($y_i = 0$).
* $C_i = \$1,500.00$ be the total cost of an intervention in tract $i$.
* $D = \{\text{Parks}, \text{Watershed}, \text{Resilience}\}$ be the set of departments.
* $E_{i,d} \in \{0, 1\}$ indicate whether tract $i$ is eligible for funding from department $d$.
* $B_d$ be the budget cap for department $d$ ($B_{\text{Parks}} = \$40,000$, $B_{\text{Watershed}} = \$50,000$, $B_{\text{Resilience}} = \$30,000$).

### Mathematical Model
$$\max \sum_{i \in I} y_i$$

Subject to:

For each department $d \in D$:
$$\sum_{i \in I} y_i \cdot \left( \frac{C_i}{\sum_{k \in D} E_{i,k}} \right) \cdot E_{i,d} \le B_d$$

Where $y_i \in \{0, 1\} \quad \forall i \in I$.

---

## 6. Cohort Equity & Budget Drawdown Analysis Key Findings

### A. Cohort Equity Comparison
Grouping the 109 tracts by funding status (Funded vs. Unfunded) reveals the trade-offs of the baseline multi-departmental MILP formulation:
* **Social Vulnerability Index (SVI)**: Funded tracts averaged an SVI score of 0.384 compared to 0.863 for unfunded tracts. This shows that the optimization model prioritized dense tracts over absolute social vulnerability.
* **Population Density**: Funded tracts averaged 7,872 residents per sq mile compared to 2,482 for unfunded tracts, successfully maximizing human exposure and impact.
* **Tree Canopy %**: Funded tracts successfully targeted lower-shade neighborhoods, averaging 34.83% canopy cover compared to 45.84% for unfunded tracts.

### B. Departmental Budget Drawdown & Utilization Rates
The optimization successfully allocated \$106,500.00 of the combined \$120,000.00 municipal cap, achieving an overall budget utilization rate of 88.75%:
* **Office of Parks**: Allocated \$38,500.00 of its \$40,000.00 cap (96.25% utilization).
* **Office of Resilience**: Allocated \$28,750.00 of its \$30,000.00 cap (95.83% utilization).
* **Department of Watershed Management**: Allocated \$39,250.00 of its \$50,000.00 cap (78.50% utilization).
