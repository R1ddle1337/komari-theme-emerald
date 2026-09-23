# Emerald 2.0

Requires Komari 2.0. History uses only the unified metric RPC and `points_v1` transport. Removed retired REST/WebSocket clients, old record methods, tag aliases and unsupported-method fallbacks.

Node cards use server statistics over the whole requested interval, weighted by actual samples. Failed probes no longer bias successful latency averages, and all-loss tasks remain visible. Quantiles use the same merged distribution as the admin dashboard.

Validation: Bun lint, type checking and production ZIP build; production browser checks after coordinated server deployment.
