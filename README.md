# Pulse UI — Claude Code Handoff

Drop-in replacement files for the 8x8 Dashboard repo.
Keeps the existing stack (React 18, Vite, Tailwind, react-grid-layout, lucide-react, your existing `/api/realtime` + `/api/daily` endpoints) — only the UI layer changes.

## What's new

1. **Calmer, denser ops-console aesthetic** — slate neutrals + a single accent color + JetBrains Mono for numerics. No rainbow-per-card color treatment; status colors are reserved for warn/critical only.
2. **Hero strip** above the grids — service-level %, agent-state breakdown, and a 30-minute queue-depth sparkline.
3. **Sparklines on every live card** (rolling 20 samples, kept in `App.jsx`).
4. **Threshold bars** on cards that have thresholds.
5. **Tweaks panel** (bottom-right, toggle with `T`) — theme, density, card style, accent hue, sparklines on/off, threshold bars on/off.
6. **Keyboard shortcuts** — `E` edit, `R` refresh, `W` widgets, `T` tweaks, `?` help, `1-5` queues, `Esc` close.
7. **Agent rail** has been left out of this handoff (it needs backend work — roster endpoint). Add when ready.

## Files to replace

```
src/index.css                         ← new tokens + RGL overrides
src/App.jsx                           ← new orchestrator (hero strip, tweaks, sparkline history)
src/components/Toolbar.jsx            ← cleaner, status pill + shortcuts
src/components/StatCard.jsx           ← new card (sparkline, threshold bar, status-only colors)
src/components/SettingsDrawer.jsx     ← toggles + reset
src/components/PeriodSelector.jsx     ← segmented presets, tight time range row
src/components/HeroStrip.jsx          ← NEW — SLA + agent breakdown + timeline
src/components/Sparkline.jsx          ← NEW — inline SVG sparkline
src/components/TweaksPanel.jsx        ← NEW — runtime appearance controls
src/components/ThresholdBar.jsx       ← NEW
tailwind.config.js                    ← new tokens
```

No new npm deps required. `metrics.js`, `export.js`, server code, and `SessionSetup.jsx` / `ExportModal.jsx` are **unchanged** — you can leave them as-is.

## CSS variables / theming

Colors, rules, and density are driven by CSS variables set on `<html data-theme="…" data-card-style="…">` from `TweaksPanel`. Tailwind stays — we just added a handful of utility classes that map to the tokens (see `tailwind.config.js`).

## Migration notes

- `App.jsx` now maintains a `historiesRef` map keyed by `metricKey` (last 20 samples) and passes a `history` prop into `StatCard` so cards render sparklines. If a widget has `daily: true`, history is skipped.
- The Toolbar's "queue dropdown" has been replaced with a segmented pill list. If you have more than ~6 queues, swap back to a dropdown.
- `SessionSetup.jsx` and `ExportModal.jsx` should continue to work without changes; they already theme via Tailwind grays.
