# DPE Project Documentation

Version: `v1.0`
Last updated: `March 25, 2026`
Project root: `/Users/pass1234/vsCode/priceengine`

## 1. Project Purpose
The project implements a Dynamic Pricing Engine (DPE) for hotels that:

1. Predicts booking probability for a given context and candidate price.
2. Optimizes expected revenue (`price * probability`) across candidate prices.
3. Applies business constraints before publishing final prices.
4. Supports rollout and fallback logic for safer deployment.
5. Supports CSV mode and DB-integrated mode.
6. Includes a minimal web UI and JSON API to simulate integration with a real product.

## 2. Business Objective
The system is built for demand-aware pricing, not direct price prediction.

1. Input: hotel context + candidate price.
2. Model output: booking probability.
3. Optimizer output: best revenue price.
4. Rules output: controlled final price to publish.

## 3. Implemented Architecture
Pipeline implemented:

`Data -> Feature Contract -> Model -> Optimizer -> Rules -> Publish -> Monitor`

Key components:

1. Data generation: `generate_synthetic_hotel_pricing.py`
2. Feature schema: `configs/feature_schema_v1.json`
3. Model training: `src/train_global_model.py`
4. Model comparison: `src/compare_booking_models.py`
5. Optimizer + rules: `src/price_engine.py`, `src/optimizer.py`, `src/rules.py`
6. Batch serving (CSV): `src/run_batch_pricing.py`
7. Batch serving (DB): `src/run_batch_pricing_db.py`
8. Monitoring: `src/monitor_pricing.py`
9. Backtesting: `src/backtest_pricing.py`
10. Local integration site/API: `src/minimal_site.py`

## 4. Data Layer
Synthetic dataset generated to bootstrap model development.

1. Scope:
- 4 hotels
- 3 room types
- 180 stay dates per hotel
- snapshots from lead time 60 to 0

2. Bundled bootstrap assets:
- SQLite seed DB: `data/dpe_demo.db`
- Lightweight SQLite variant: `data/dpe_quick.db`
- Legacy synthetic CSV remains a research artifact but is no longer required for the main integration seed flow.

3. Core integrity rules enforced:
- `available_rooms = total_inventory - booked_rooms`
- `occupancy_rate = booked_rooms / total_inventory`
- `final_price = offered_price when booking_made = 1, else null`
- `cancellation = 1 only if booking_made = 1`

## 5. Feature Contract and Preprocessing
Contract-driven feature handling is implemented to support heterogeneous hotels.

1. Feature contract:
- `configs/feature_schema_v1.json`

2. Required feature pipeline:
- `src/features.py`
- Validation of required columns.
- Date parsing.
- Optional-feature injection.
- Missing flags for optional features (`*_missing_flag`).

3. Preprocessing:
- `src/preprocessing.py`
- Categorical: impute most frequent + one-hot.
- Numeric: median imputation + standard scaling.

## 6. Modeling Strategy
Target and setup:

1. Target: `booking_made` (binary).
2. Split strategy: time-based by `stay_date` to reduce leakage.
3. Baseline model and challengers:
- Logistic Regression
- Random Forest
- Extra Trees
4. Comparison output:
- `outputs/model_comparison_overall_metrics.csv`
- `outputs/model_comparison_test_rankings.csv`
- `outputs/model_comparison_winner.json`

## 7. Model Selection Results
Champion selected by balanced rank across `log_loss`, `brier_score`, `roc_auc`.

Test results:

1. Logistic Regression:
- Log loss: `0.646879`
- Brier: `0.227863`
- ROC-AUC: `0.640224`

2. Random Forest:
- Log loss: `0.645273`
- Brier: `0.228771`
- ROC-AUC: `0.628129`

3. Extra Trees:
- Log loss: `0.648502`
- Brier: `0.229500`
- ROC-AUC: `0.628757`

Winner: `logistic_regression`

Champion alias created via:

- `src/promote_champion_model.py`
- `artifacts/champion_model.pkl`
- `artifacts/champion_model_metadata.json`

## 8. Pricing Decision Logic
Implemented decision flow:

1. Candidate generation:
- `src/candidates.py`
- Uses percentage grid from `configs/pricing_rules_v1.json`

2. Optimization:
- `src/optimizer.py`
- Computes probability and expected revenue per candidate.
- Selects max expected revenue candidate.

3. Rule application:
- `src/rules.py`
- Applies min and max bounds, max daily change, weekend and holiday floors, optional manual override.

4. Unified engine:
- `src/price_engine.py`

## 9. Serving Policy (Champion/Fallback/Rollout)
Serving behavior configured in:

- `configs/serving_config_v1.json`

Configured capabilities:

1. Champion model path + fallback model path.
2. Fallback strategy: previous price then base price.
3. Rollout controls: allowlists + traffic fraction + deterministic routing.

## 10. Batch Outputs
CSV outputs:

1. Decisions table:
- `outputs/price_decisions.csv`

2. Published prices:
- `outputs/published_prices.csv`

DB outputs (SQLite demo):

1. `inventory_snapshots`
2. `price_decisions`
3. `published_prices`

Schema management:

- `src/minimal_stack_db.py`

## 11. Monitoring and Evaluation
Monitoring outputs:

1. `outputs/monitoring_summary.json`
2. `outputs/monitoring_by_hotel.csv`
3. `outputs/monitoring_rule_usage.csv`
4. `outputs/monitoring_drift_numeric.csv`
5. `outputs/monitor_expected_revenue_by_hotel.png`
6. `outputs/monitor_rule_adjustments.png`

Current monitoring KPIs on full batch (`131,760` rows):

1. Model version used: `logistic_regression` for all rows.
2. Total expected revenue: `16,097,930.66`
3. Average expected revenue: `122.18`
4. Average predicted probability: `0.3781`
5. Average final price: `383.24`
6. Rollout coverage: `50.0%`
7. Rule-hit rate: `8.42%`
8. Fallback rate: `0.0%`
9. Observed booking rate: `38.01%`
10. Observed cancellation rate (on booked rows): `17.50%`
11. Drift status: all checked numeric features stable.

## 12. Backtesting
Backtest files:

1. `outputs/backtest_summary.json`
2. `outputs/backtest_by_hotel.csv`
3. `outputs/backtest_net_revenue_uplift_by_hotel.png`
4. `outputs/backtest_price_delta_distribution.png`
5. `outputs/backtest_row_level.csv`

Important context: this backtest run used `--max-rows 50000` and baseline source `base_price`.

Reported uplift on evaluated sample:

1. Expected revenue uplift: `+23.44%`
2. Net expected revenue uplift (after cancellation proxy): `+23.47%`
3. Expected bookings change: `-2.65%`
4. Average price delta: `+26.32%`

## 13. Minimal Integration Stack (DB + Site)
Documentation:

- `MINIMAL_STACK.md`

Local demo components:

1. DB init script: `src/init_minimal_stack_db.py`
2. Context load script: `src/load_contexts_to_db.py`
3. DB pricing job: `src/run_batch_pricing_db.py`
4. Minimal UI/API: `src/minimal_site.py`

Website/API behavior:

1. `/` shows published rows and links to decision details.
2. `/decision?...` shows why decision was made, decision outputs, and input context.
3. `/api/published-prices?...` returns published rows JSON.
4. `/api/decision-details?...` returns full detail JSON.

## 14. End-to-End Runbook (From Scratch)
```bash
cd /Users/pass1234/vsCode/priceengine
python3 -m pip install pandas numpy scikit-learn matplotlib

python3 generate_synthetic_hotel_pricing.py
python3 src/prepare_unified_dataset.py
python3 src/compare_booking_models.py
python3 src/promote_champion_model.py

python3 src/init_minimal_stack_db.py --db-path data/dpe_demo.db
python3 src/load_contexts_to_db.py --db-path data/dpe_demo.db --input-csv synthetic_hotel_pricing.csv --limit 30000 --replace
python3 src/run_batch_pricing_db.py --db-path data/dpe_demo.db --replace-output --limit 30000 --model-path artifacts/logistic_regression.pkl --metadata-path artifacts/logistic_regression_metadata.json

python3 src/minimal_site.py --db-path data/dpe_demo.db --host 127.0.0.1 --port 8090
```

For the integrated NextStay/Postgres bootstrap path, use:

```bash
python3 src/load_postgres_pricing_seed.py \
  --input-source sqlite \
  --input-sqlite-db data/dpe_demo.db \
  --replace
```

## 15. Known Limitations
1. Primary evaluation is still synthetic-data-based.
2. DB runner currently writes after full in-memory processing, so large runs can be slow.
3. Real production requires authentication and authorization on serving API.
4. Online experiment framework (A/B) is not yet integrated.
5. Retraining scheduler is manual/scripted, not orchestrated yet.

## 16. Production Integration Checklist
1. Connect engine to production DB (replace SQLite adapter).
2. Add scheduler for:
- price refresh job (daily/hourly)
- retraining + comparison job (weekly)
3. Expose production read API for latest published prices.
4. Add kill-switch and fallback operational controls.
5. Add alerting thresholds:
- fallback rate
- drift PSI
- conversion and cancellation anomalies
- rule-hit spikes
6. Run shadow mode before full rollout.
7. Expand rollout progressively by hotel/segment.

## 17. Project Status Assessment
1. ML maturity: strong MVP (objective, schema, comparison, championing, monitoring, backtest).
2. Software maturity: integration-ready MVP (modular services, DB mode, rollout/fallback, local UI/API).
3. Remaining work is mostly production hardening and real-data operations.
