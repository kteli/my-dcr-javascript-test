## Overview
- **Purpose:** Let users explore country/region metrics safely and quickly — balance clarity with performance.
- **Flow:** Load → validate/normalize → process (country/region metrics) → filter/paginate → visualize → present stats/table.
- **Separation of concerns:** Validation in `dataValidation.js`; rendering/logic in `script.js` — easier to maintain and test.

## Data Loading & Validation
- **Loading UI:** Show loading/error states — prevents “blank” or frozen screens during network/JSON parse.
- **Record validation:** Ensure each item has `name` and correct types — avoids downstream crashes in D3 and tooltips.
- **Normalization:** Coerce numbers, dedupe arrays, accept language formats `["en"]` or `[{name:"English"}]` — consistent internal shape.
- **Graceful degradation:** Skip invalid rows, log a brief summary, render the rest — users still get value even with imperfect data.
- **Security (data):** Escape strings before injecting into `innerHTML` — mitigates XSS from untrusted input.

## Pagination & Filtering
- **Why paginate the chart:** Large SVGs (hundreds of nodes) are CPU/memory heavy; paginating keeps interactions smooth.
- **Items per page:** 25/50/100/200/All — reasonable defaults with guardrails; “All” remains available for power users.
- **Search filter:** Filters by name/region and resets to page 1 — predictable results and easier navigation.
- **Table UX:** Scrollable table with sticky header — shows many rows without stretching the layout.

## Visualizations
- **Bubble (force-directed):** Circles sized by value; collision/force prevents overlap — engaging overview that’s readable.
- **Treemap:** Rectangles sized by value; fills space efficiently — better for dense data where labels must fit.
- **Consistent interactions:** Same tooltips/colors across chart types — switching views doesn’t change mental model.
- **Choice rationale:** Bubble is intuitive for comparisons; Treemap is superior when item count is high and space is limited.

## Tooltips & Table
- **Country tooltip:** Capital, region, population, area, borders, timezones, languages — quick context without leaving the chart.
- **Region tooltip:** Unique timezones, country count, sample countries — mirrors aggregate perspective.
- **Safety:** All tooltip strings are HTML-escaped — prevents markup injection.
- **Table columns:** Rank, Value, % of current slice — complements visuals with precise numbers.


## Error Handling & Edge Cases
- **Network/JSON errors:** Friendly message + console details — actionable for devs, clear for users.
- **Empty/zero data:** Render “No plottable values” — explicit state rather than silent failure.
- **Whitelists:** Only allow known `dataType`/`chartType` values — stable code paths and fewer surprises.
- **Items-per-page sanitization:** Accept `'all'` or a safe numeric range — prevents runaway rendering.

## Data Model (Normalized)
- **Country:** `{ name, capital, region, population, area, borders[], timezones[], languages[{name}] }` — predictable fields.
- **Region aggregates:** `{ label, value, type:'region', regionData:{ countries:Set, timezones:Set } }` — fast unique counts.
- **Chart items:** `{ label, value, type, country|regionData }` — unified shape for both chart types.

## Future Work
- **Mobile density:** Zoom/pan or detail view for small screens.
- **Caching:** Optional `localStorage` of validated data for faster revisits.
- **Testing:** Unit tests for validators and sample datasets; visual regression for charts.
