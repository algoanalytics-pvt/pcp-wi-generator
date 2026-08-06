# Theme & Design System

Design language used by the PCP → Work Instruction Generator frontend (`frontend/`, React +
Tailwind CSS v4). Documented here so other internal apps can reuse the same look and stay
visually consistent. Source of truth is always `frontend/src/input.css` (the `@theme` block)
— if this doc and that file disagree, the file wins; update this doc to match.

Tailwind v4 needs no `tailwind.config.js`: every `--color-*` / `--font-*` / `--radius-*` /
`--shadow-*` token declared inside `@theme { }` automatically becomes a utility class
(`--color-accent` → `bg-accent`, `text-accent`, `border-accent`, `accent/10`, etc.). Add new
design tokens there, never in a JS config file.

**Build step**: `frontend/src/output.css` is a compiled, git-tracked artifact. After any edit
that touches `input.css` or adds a new Tailwind class, rebuild it from `frontend/`:
`npx @tailwindcss/cli -i ./src/input.css -o ./src/output.css` (omit `--watch` for one-off
rebuilds; the dev server also picks up `input.css` changes on its own via Vite).

## Philosophy

- Warm, espresso/sienna palette instead of generic SaaS blue/gray — brand-led, not
  framework-default.
- Single global accent (`--color-accent`, a burnt orange-red) used everywhere — CTAs, active
  states, links, focus rings, icon tints. This app doesn't do per-module accent theming; if a
  future sibling app needs a second module color, follow the same warm family (see "Applying
  this to a new app" below) rather than introducing a cool color.
- Flat, low-decoration UI. Decorative flourishes are limited to a soft blurred accent glow
  behind hero illustrations (`bg-accent/10 blur-3xl`) — don't add extra gradients or ornament
  beyond that.
- Status color is always paired with a soft tint background + matching border alpha (the
  "status formula" below) — reuse it everywhere instead of inventing new badge styles.
- Icons are line icons only (inline SVG, `stroke="currentColor" fill="none"`), never
  filled/solid icons (the one exception is the sparkle/star accent icon, which uses
  `fill="currentColor"` deliberately for a denser glyph).

## Fonts

```css
@import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800&family=JetBrains+Mono:wght@400;500;600&display=swap');
```

```css
font-family: 'Inter', system-ui, -apple-system, sans-serif;  /* set on html/body/#root */
--font-mono: "JetBrains Mono", "SFMono-Regular", Consolas, monospace; /* reserved, not yet used */
```

Inter for everything, headings included — no separate display font. `JetBrains Mono` is
declared as `--font-mono` for future numeric/tabular fields but nothing in the current UI
opts into it yet (no `font-mono` usage) — copy the token, don't skip declaring it just
because it's unused today.

Type scale actually in use (Tailwind sizes, not custom `h1`–`h4` element styles — every
heading is a styled `<p>`/`<h1>` with explicit classes):

| Role | Classes |
|---|---|
| Hero H1 | `text-4xl md:text-5xl lg:text-6xl font-extrabold leading-[1.1] tracking-tight` |
| Page/section title | `text-2xl font-extrabold leading-tight` |
| Card/step title | `text-base` / `text-xl font-bold` |
| Body | `text-sm` / `text-base`, default weight |
| Eyebrow / kicker labels | `text-xs font-bold uppercase tracking-widest` |
| Badges / pills | `text-xs` or `text-sm font-semibold` |

## Color tokens

```css
@theme {
  /* Warm espresso/sienna brand palette */
  --color-navy: #2c1a0e;         /* sidebar bg, "ink" twin — brand-dark */
  --color-navy-soft: #3d2717;    /* sidebar hover */
  --color-accent: #c84b1a;       /* brand red-orange — the one accent */
  --color-accent-strong: #a83e14;
  --color-success: #5c7a32;      /* warm moss, not a cool green */
  --color-danger: #c84b1a;       /* same value as accent — accent doubles as error/danger */
  --color-warning: #d4760a;      /* brand orange */
  --color-info: #8b5e3c;         /* brand brown */
  --color-canvas: #ffffff;       /* page background */
  --color-ink: #2c1a0e;          /* primary text — same hex as navy, different role */
  --color-muted: #7c6b5b;        /* secondary text */
  --color-surface: #ffffff;      /* card/panel background */
  --color-surface-2: #faf7f5;    /* hover tint, input background, subtle fills */
  --color-border: #e8ddd8;

  --font-mono: "JetBrains Mono", "SFMono-Regular", Consolas, monospace;
  --radius-card: 16px;           /* reserved token — components currently use rounded-2xl (Tailwind's 16px) directly */
  --shadow-soft: 0 2px 8px rgba(0, 0, 0, 0.06); /* reserved — components use Tailwind's own shadow-sm/md/lg/xl */
}
```

Rules for using color:

- Never hardcode a hex value in component classes — always use the token utility
  (`bg-accent`, `text-ink`, `border-border`, ...).
- `--color-danger` and `--color-accent` are the same hex on purpose: this app has no
  separate "error red" distinct from its brand accent. Keep it that way unless a real need
  for visual distinction between "primary action" and "error" emerges.
- No brand "success" color exists in the source logo/brand, so a warm moss (`--color-success`)
  was added to stay in the same warm family — don't introduce a cooler, more saturated green.
- `--color-ink` and `--color-navy` share a hex value but different intents: `ink` is text-on-light
  (headings, body copy), `navy` is a surface color (sidebar background). Keep both tokens even
  though they're numerically identical — they document different usage even if a future app
  wants to diverge their values.
- `--radius-card`, `--shadow-soft`, and `--font-mono` are declared but not consistently consumed
  by class names yet (components spell out `rounded-2xl` / `shadow-sm` directly instead). Copy
  them into a new app's `@theme` anyway for forward-compatibility, but don't block on wiring
  every component through them.

## Spacing & shape

Radius, in order of actual usage frequency:

| Utility | Px | Used for |
|---|---|---|
| `rounded-full` | pill | badges, pills, avatars, icon circles, step numbering circles |
| `rounded-xl` | 12px | buttons, drop-zones, stat pills, icon tiles |
| `rounded-2xl` | 16px | cards (`Card` component), step-tab cards, hero illustration cards |
| `rounded-lg` | 8px | small nested tiles (icon badges inside cards, stat icon squares) |
| `rounded-md` | 6px | rare, small inline elements |

Shadows — Tailwind's built-in scale, used directly (`shadow-sm`, `shadow-md`, `shadow-lg`,
`shadow-xl`), plus colored shadows for accent CTAs (`shadow-md shadow-accent/25`,
`shadow-lg shadow-accent/30`). Don't invent a third custom shadow tier beyond what Tailwind
already provides.

## Layout

- App shell (`AppShell.jsx`): fixed 80px (`w-20`) dark (`bg-navy`) icon-only sidebar rail +
  fluid content (`flex h-screen overflow-hidden`). Sidebar has no text nav items beyond a
  tiny uppercase label under the Home icon (`text-[9px] font-bold uppercase tracking-wider`).
- Header: single compact bar (`px-4 md:px-6 py-4 border-b border-border`) — logo + page
  title/subtitle on the left, action buttons (pill-shaped, bordered) + status badge + user
  avatar circle on the right. No redundant page title repeated below it.
- Step tabs (`StepTabs.jsx`): horizontal row of numbered step cards (`rounded-2xl border-2`),
  each with an icon circle (badge with step number overlaid top-right), title/subtitle, and a
  status pill (`Completed` / `Active` / `Waiting`) at the bottom. Dashed connector line between
  cards, filled solid + accent-dot once the previous step completes.
- Content area: `flex-1 overflow-y-auto`, `px-6 py-6`, wrapped in `animate-fade-in` so each
  step transition fades in.
- Landing page (`LandingPage.jsx`): full-height (`h-screen overflow-hidden`) single-viewport
  layout — compact nav header, centered two-column hero (copy + CTA on the left, an
  illustrative "Excel → AI → Work Instruction" card diagram on the right), and a dark
  (`bg-ink`) "how it works" strip pinned to the bottom.

## Status formula (dot + tint + border)

Reused for badges, pills, notices, stat tiles — the one pattern to copy for any new
status-like UI instead of inventing a new treatment:

```css
/* Badge (Badge.jsx) */
background: color-mix(in srgb, var(--status) 10%, transparent);  /* bg-{status}/10 */
border: 1px solid color-mix(in srgb, var(--status) 25%, transparent); /* border-{status}/25 */
color: var(--status);
```

```css
/* Icon circle / pill (StepTabs, StatPill) */
background: color-mix(in srgb, var(--status) 15%, transparent); /* bg-{status}/15 */
color: var(--status);
```

Statuses map to tokens: `success` → `--color-success`, `warning` → `--color-warning`,
`error`/`danger` → `--color-danger`, `info` → `--color-info`, `gray` → `--color-surface-2` +
`--color-muted` + `--color-border`. Optionally prefixed with a small solid dot
(`w-1.5 h-1.5 rounded-full bg-{status}`) for "active/in-progress" states instead of an icon.

## Core components

- **Card** (`ui/Card.jsx`): white surface, `rounded-2xl`, `shadow-sm`, 1px `border-border`,
  `p-6` by default (`padding={false}` to opt out). The base container for nearly everything —
  drop zones, side panels, step content.
- **Button** (`ui/Button.jsx`): variant + size props, not ad-hoc classes per call site.
  - `primary` — solid `bg-ink`, white text, `shadow-sm`, `hover:brightness-110`,
    `active:scale-[0.98] active:opacity-85`.
  - `accent` — solid `bg-accent`, white text, `shadow-md shadow-accent/25`, darkens to
    `accent-strong` on hover. The one primary CTA per screen (e.g. "Upload PCP Excel").
  - `secondary` — outlined, `border-accent text-accent`, fills `accent/5` on hover.
  - `ghost` — no border/background, `text-muted` → `text-ink` + `bg-surface-2` on hover.
  - `danger` / `success` — solid fills of those status tokens, same shadow/press pattern as
    `primary`.
  - All variants share `active:scale-[0.98]` press feedback and `focus-visible:ring-2` —
    keep that consistent on any new variant.
  - Sizes: `sm` / `md` / `lg` (inline padding scale) and `xl` (`w-full`, for full-width
    mobile/step CTAs).
- **Badge** (`ui/Badge.jsx`): pill (`rounded-full`), `text-xs font-semibold`, built directly
  from the status formula above. Variants: `success`, `warning`, `error`, `info`, `gray`.
- **Sidebar** (`layout/Sidebar.jsx`): 80px dark rail, single gradient-accent square "home"
  button (`bg-gradient-to-br from-accent to-accent-strong`) at the top — the only gradient
  used anywhere in the app, reserved for this one brand mark. Nav items below use
  `bg-accent/15 text-accent` for the active state.
- **StepTabs** (`layout/StepTabs.jsx`): see Layout above — the canonical "numbered progress"
  pattern; reuse instead of building a new stepper.
- **Icon badge**: circular tile, `bg-{tone}/10` background + `text-{tone}` icon color,
  `rounded-lg` (small, e.g. stat icons) or `rounded-xl` (larger, e.g. feature icons on the
  landing page).
- **Drop zone** (`UploadStep.jsx`): dashed border (`border-2 border-dashed border-border`),
  swaps to `border-accent bg-accent/5` on drag-over/hover — reuse this exact treatment for
  any other file-drop affordance instead of inventing new dashed-border styling.

## Icons

Inline SVG, line-style only, sized via `className` (`w-4 h-4` etc. — no fixed icon component
library):

```jsx
<svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
  <path strokeLinecap="round" strokeLinejoin="round" d="..." />
</svg>
```

`strokeWidth` ranges 1.5–2.5 depending on icon size/prominence (finer for large illustrative
icons, bolder for small 16px UI icons). Color always comes from the parent via `currentColor`
— never hardcode a `stroke`/`fill` color on the `<svg>` itself.

## Logo usage

Two logo assets, each cropped **visually via CSS, not by editing the source PNG**: wrap the
`<img>` in a fixed-size `overflow-hidden` div and absolutely-position an oversized `<img>`
inside it, so the original asset file stays untouched and re-croppable if the source image
changes.

```jsx
<div className="relative w-[151px] h-12 overflow-hidden shrink-0">
  <img src={logo} className="absolute -top-[35px] -left-[23px] w-[188px] h-[125px] max-w-none" />
</div>
```

- `assets/logo-icon.png` — tight icon-only crop, used at `w-12 h-12` in the in-app header
  (`AppShell.jsx`) next to a separately-coded title/subtitle.
- `assets/logo copy.png` — full wordmark lockup (icon + brand text baked into the image),
  used alone with no separate coded app-name text, on the marketing landing page header.
- Prefer a logo asset with a solid background matching `--color-canvas` (white) over a
  transparent/glow background — it can be dropped in directly without needing pixel-precise
  crop math, since the surrounding page background blends in seamlessly.

## Applying this to a new app

1. Copy the `@theme` token block and the Google Fonts import verbatim into the new app's
   Tailwind v4 entry CSS file — no `tailwind.config.js` needed, the utilities generate
   automatically from the tokens.
2. Reuse `Card`, `Button`, `Badge` as-is (copy the component files) rather than rebuilding
   equivalents — the goal is pixel-identical primitives across apps, not just "similar".
3. If the new app needs a second accent (a genuinely different module/product under the same
   suite), pick another color from the same warm espresso/sienna family — don't introduce a
   cool blue/gray/purple.
4. Keep the sidebar dark (`bg-navy`) regardless of the main content's light (`bg-canvas`)
   background, and keep icons line-style/`currentColor` throughout.
5. Rebuild `output.css` after copying (`npx @tailwindcss/cli -i ./src/input.css -o ./src/output.css`)
   — don't hand-edit the compiled file.
