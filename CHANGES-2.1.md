# Emerald 2.1

Node cards and the list view show China Telecom, China Unicom and China Mobile latency separately. Choose a probe region on the homepage; the preference persists in this browser. The default follows configured probe order (Shanghai on this installation).

Readings use the successful-sample mean over the last five minutes, with loss shown per carrier. Tap or keyboard-open a card's latency panel to compare every configured region. Complete loss shows unreachable; missing samples and offline nodes never appear as zero latency. All cards share one statistics request and refresh once per minute while visible. Removed the superseded combined-latency/history-bar pipeline and its per-node persistent caches.

Validated with Bun lint/typecheck/build, browser comparisons against actual metric responses, mobile layout/region persistence, missing/all-loss fixtures and keyboard interaction.
