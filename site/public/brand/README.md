# 3Notch · Brand Assets

Canonical SVG assets generated from the spec in `3notch-brand-system.html` Section 05.

## Files

| File | Use | Geometry |
| --- | --- | --- |
| `mark.svg` | Default mark — for use on dark / ink backgrounds at 28–72px display | `viewBox 0 0 80 80`, stroke 9, x=10→70 |
| `mark-16.svg` | Small contexts (favicon, ≤16px) — thicker strokes for legibility | `viewBox 0 0 80 80`, stroke 14, x=8→72 |
| `mark-inverse.svg` | For use on Mark-red backgrounds — Paper-colored strokes | Same as `mark.svg` with `#F4EFE5` stroke |
| `lockup-horizontal.svg` | **Primary lockup** — mark + wordmark on dark | Mark 36px + Geist 600 @ 28px |
| `lockup-stacked-onlight.svg` | Mark stacked above wordmark, for Paper backgrounds | Mark 28px + Geist 600 @ 22px |
| `wordmark.svg` | Type only, no mark — for tight contexts | Geist 600 @ 26px |

## Rules (from brand-system Section 05)

- **viewBox = `0 0 80 80`** for the mark
- **stroke = `#E04E2C`** (Mark red)
- **stroke-linecap = `round`**
- **stroke-width by display size:** 72px→7 · 44px→8 · 36px→9 · 28px→10 · 16px→14
- ✗ No container
- ✗ No shadow
- ✗ No gradient
- ✗ No second color
- ✗ Don't stretch, rotate, or skew

When embedding in HTML, reference these files directly:

```html
<img src="/brand/mark.svg" alt="3Notch" width="28" height="28">
```

Or inline the SVG when you need to color it via `currentColor` (e.g., hover states) — but copy the exact geometry from these files.
