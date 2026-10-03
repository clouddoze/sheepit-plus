---
name: SheepIt Plus
description: A pure-front-end rebuild of the SheepIt Render Farm interface — dense, neutral, data-first, with the brand orange reserved for exactly three jobs.
colors:
  brand-orange: "#e06d58"
  accent-deep: "#b6472f"
  accent-weak: "rgba(224,109,88,.14)"
  field-ink: "#0f1218"
  ink-on-accent: "#ffffff"
  canvas: "#0b0d11"
  canvas-light: "#fbfbfc"
  surface: "#111419"
  surface-light: "#ffffff"
  surface-raised: "#161a21"
  surface-raised-light: "#f5f6f8"
  surface-sunken: "#1c2129"
  surface-sunken-light: "#eceef1"
  hairline: "#22272f"
  hairline-light: "#e4e6ea"
  hairline-strong: "#2f3640"
  hairline-strong-light: "#d0d4da"
  ink: "#e8eaed"
  ink-light: "#14171c"
  ink-secondary: "#a8b0bb"
  ink-secondary-light: "#4b5462"
  ink-tertiary: "#7c8695"
  ink-tertiary-light: "#656d79"
  positive: "#3fb950"
  positive-light: "#1a7f37"
typography:
  display:
    fontFamily: "-apple-system, BlinkMacSystemFont, \"Segoe UI\", \"PingFang SC\", \"Hiragino Sans GB\", \"Microsoft YaHei\", sans-serif"
    fontSize: "20px"
    fontWeight: 600
    lineHeight: 1.3
    letterSpacing: "-0.3px"
  headline:
    fontFamily: "inherit"
    fontSize: "16px"
    fontWeight: 600
    lineHeight: 1.35
  title:
    fontFamily: "inherit"
    fontSize: "15px"
    fontWeight: 550
    lineHeight: 1.4
  metric:
    fontFamily: "inherit"
    fontSize: "27px"
    fontWeight: 600
    lineHeight: 1.1
    letterSpacing: "-0.6px"
    fontFeature: "\"tnum\" 1"
  metric-narrow:
    fontFamily: "inherit"
    fontSize: "22px"
    fontWeight: 600
    letterSpacing: "-0.4px"
  metric-band:
    fontFamily: "inherit"
    fontSize: "18px"
    fontWeight: 600
    letterSpacing: "-0.3px"
  body:
    fontFamily: "inherit"
    fontSize: "14px"
    fontWeight: 400
    lineHeight: 1.5
  label:
    fontFamily: "inherit"
    fontSize: "12.5px"
    fontWeight: 400
    lineHeight: 1.45
  micro-label:
    fontFamily: "inherit"
    fontSize: "11.5px"
    fontWeight: 500
    lineHeight: 1.4
    letterSpacing: "0.2px"
rounded:
  xs: "2px"
  bar: "3px"
  pill: "4px"
  sm: "6px"
  md: "8px"
  lg: "10px"
  xl: "12px"
spacing:
  hair: "2px"
  tight: "4px"
  snug: "6px"
  sm: "8px"
  md: "12px"
  lg: "16px"
  xl: "20px"
  xxl: "24px"
  section: "28px"
components:
  button-primary:
    backgroundColor: "{colors.brand-orange}"
    textColor: "{colors.field-ink}"
    rounded: "{rounded.md}"
    padding: "8px 15px"
  button-primary-light:
    backgroundColor: "{colors.accent-deep}"
    textColor: "{colors.ink-on-accent}"
    rounded: "{rounded.md}"
    padding: "8px 15px"
  button-secondary:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.ink-secondary}"
    rounded: "{rounded.md}"
    padding: "8px 15px"
  button-secondary-light:
    backgroundColor: "{colors.surface-light}"
    textColor: "{colors.ink-secondary-light}"
    rounded: "{rounded.md}"
    padding: "8px 15px"
  button-icon:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.ink-secondary}"
    rounded: "{rounded.sm}"
    size: "30px"
  nav-item:
    textColor: "{colors.ink-secondary}"
    rounded: "{rounded.sm}"
    padding: "6px 11px"
  nav-item-current:
    backgroundColor: "{colors.surface-raised}"
    textColor: "{colors.ink}"
    typography: "{typography.body}"
    rounded: "{rounded.sm}"
    padding: "6px 11px"
  field-search:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.ink}"
    rounded: "{rounded.sm}"
    padding: "7px 11px"
    width: "min(340px, 100%)"
  segmented-control:
    backgroundColor: "{colors.surface}"
    rounded: "{rounded.md}"
    padding: "3px"
  segment-selected:
    backgroundColor: "{colors.accent-weak}"
    textColor: "{colors.brand-orange}"
    rounded: "{rounded.sm}"
    padding: "5px 11px"
  metric-band:
    backgroundColor: "{colors.surface}"
    rounded: "{rounded.lg}"
    padding: "18px 20px"
  card-panel:
    backgroundColor: "{colors.surface}"
    rounded: "{rounded.lg}"
    padding: "16px 20px 18px"
  data-row-current:
    backgroundColor: "{colors.accent-weak}"
  insight-heatmap-cell:
    backgroundColor: "{colors.brand-orange}"
    rounded: "{rounded.xs}"
  insight-progress-bar:
    backgroundColor: "{colors.surface-sunken}"
    height: "6px"
    size: "180px"
  mode-switch-button:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.ink-secondary}"
    rounded: "{rounded.sm}"
    height: "30px"
    padding: "0 10px"
  mode-restore-pill:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.ink}"
    rounded: "{rounded.md}"
    padding: "7px 12px"
  switch-track:
    backgroundColor: "{colors.surface-sunken}"
    rounded: "{rounded.lg}"
    width: "34px"
    height: "20px"
  switch-track-on:
    backgroundColor: "{colors.brand-orange}"
    rounded: "{rounded.lg}"
    width: "34px"
    height: "20px"
  switch-knob:
    backgroundColor: "{colors.ink-tertiary}"
    rounded: "50%"
    size: "14px"
  machine-tag:
    backgroundColor: "{colors.accent-weak}"
    textColor: "{colors.brand-orange}"
    rounded: "{rounded.pill}"
    padding: "2px 8px"
---

# Design System: SheepIt Plus

## Overview

**Creative North Star: "The Instrument Panel"**

This is a read-out, not a landing page. Every view exists so that a contributor can glance at it and be told the truth about their own labour: how much they have rendered, how the curve is bending, and where they sit among five hundred other people. The world that carries that job is deliberately the category-standard one — a neutral grey field, hairline rules, tabular numerals, one accent — executed without a single shortcut. Familiarity is the point: the structure should be invisible so the numbers are not.

The system has two temperatures and only one voice. Surfaces step through three neutral tiers by tint alone; separation comes from a 1px border, never from a line of colour or a glow. Type runs down a single sans stack in seven narrow steps, and anything that could be read as a quantity is tabular-aligned so columns of digits stay in vertical register. Into that grey field goes one warm colour, and it is spent with intent: brand orange marks what you can act on, what is currently selected, and the one series that represents you. Everything else — statuses, project names, machine counts, the entire ranking table — stays neutral, including the things that feel like they deserve a badge. The account page is the first surface that changes something rather than showing something, and it holds the same line: one accent-filled commit per panel, and every maintenance action behind it a quiet bordered button. The session page extends that line to a single machine: a neutral status chip instead of a coloured badge, the site's twenty raw fields laid out as one two-column grid, its record summarised by day with the raw log folded behind a button, and exactly one accent-filled button on the whole surface — the one that pauses the machine, because that is the only thing there that changes anything.

Depth is nearly flat. There are exactly two shadows in the system and both are ambient rather than structural: a two-part soft shadow that keeps a panel off the page by a millimetre, and a darker twin for the dark theme. Nothing floats, nothing glows, nothing is glass. Where the older interface it replaces failed, it failed by compression — labels truncated, progress numbers printed across a two-tone bar, six columns crushed into 620px while half the viewport sat empty. This system answers every one of those failures the same way: give the content the space it needs and let it be read.

**Key Characteristics:**
- Neutral grey tonal field, three surface tiers, 1px hairlines as the only separator.
- One warm accent with three permitted jobs; everything else is neutral by default, not by omission.
- Tabular numerals everywhere a number can appear.
- Near-flat depth: two ambient shadows, plus tone and border for layering.
- Data-density by subject: compact rows in tables and lists, breathing room around charts.
- Chinese-first type with the English base language as an equal-weight fallback, both on the system UI stack.
- A visible exit: the shell is a mode, the way out is a button in its own top bar, and the way back is a pill that renders while the rest of the system is switched off.

## Colors

The palette is a near-neutral cool grey field interrupted by exactly one warm signal, and it ships in two complete sets — dark and light — that are separately tuned rather than inverted.

### Primary
- **Brand Orange** (`#e06d58`, dark theme accent): the user-pinned SheepIt identity colour. It is load-bearing in exactly three places — actionable elements (primary buttons, the one commit button in each account panel, focus rings, the caret, the sheep mark), the current selection (an active nav item, a pressed segment, a switch that is on, the "you" row in a table), and the single element that stands for the viewer (the points curve, the monthly bars, the heat ramp, the sparklines, and the one accent-washed tag per machine or render-key row that says *this one is yours*). It also carries a narrow supporting role as the positive-metric colour on one derived KPI line.
- **Deep Ember** (`#b6472f`, light theme accent): the same hue driven down in lightness for the light theme. White-on-orange at the pinned brand value lands at 3.2:1 and fails the floor, so the light accent is deepened instead of weakening the label; the light theme also picks up a darker positive green for the same reason.
- **Ember Wash**: the accent at a fraction of its strength, used as a *fill behind* something rather than as a colour on something — pressed segments, selected chips, the current row, the machine tag, the in-use key badge, the browser text selection. It has a light-theme twin at the deeper accent's hue, carried in the sidecar.

### Neutral
- **Field Ink** (`#0f1218`): the label colour that sits on top of brand orange in the dark theme. Near-black, because white on that orange cannot clear the contrast floor and the brand colour is not permitted to move.
- **Ink on Accent** (`#ffffff`): the equivalent label in the light theme, where the deepened accent can carry white at 5.3:1.
- **Instrument Black** (`#0b0d11`) / **Paper White** (`#fbfbfc`): the page field. Deliberately not pure black and not pure white, so that raised surfaces have somewhere to go in both directions.
- **Panel** (`#111419`) / **Card White** (`#ffffff`): the default container surface — panels, tables, the metric band, buttons.
- **Raised Tier** (`#161a21`) / **Raised Tier Light** (`#f5f6f8`): the hover and inset fill — table row hover, nav hover, avatar fallback, and the shimmer midpoint of loading skeletons.
- **Sunken Tier** (`#1c2129`) / **Sunken Tier Light** (`#eceef1`): the recessed fill — empty heat cells, progress-bar tracks, tooltips, toasts.
- **Hairline** (`#22272f` / `#e4e6ea`): every border in the system, including the internal dividers of a multi-cell band and the table's row rules.
- **Hairline Strong** (`#2f3640` / `#d0d4da`): the same line one step up, for the things that must read as interactive — icon buttons, inputs, scrollbar thumbs, tooltip and toast outlines, the chart crosshair.
- **Primary Ink** (`#e8eaed` / `#14171c`): headings, values, and the body copy that carries meaning.
- **Secondary Ink** (`#a8b0bb` / `#4b5462`): supporting prose, table cell text, nav labels, inline metadata.
- **Tertiary Ink** (`#7c8695` / `#656d79`): the quiet layer — axis labels, column headers, KPI captions, units, hints, footers. It is the muted colour, and it is deliberately still readable; nothing in this system is set in a grey that requires effort.
- **Signal Green** (`#3fb950` / `#1a7f37`): one semantic value, used on a single derived delta inside a metric caption. There is no red, no amber, no warning ramp — errors are stated in words, not colour.

### Named Rules

**The One Voice Rule.** Brand orange is spent on exactly three jobs: actionable elements, the current selection, and the one series or element in data that represents "you". A fourth use is a defect. Status text stays neutral on purpose — painting "Rendering" orange turns the table into a wall of orange and dilutes what the colour means everywhere else.

**The Two Sets Rule.** The light theme is not the dark theme inverted. Surfaces get brighter, borders get fainter, and the accent deepens until white text clears the contrast floor on it. Every token has a light twin and both are normative.

**The No Decorative Colour Rule.** Hue never enters as decoration. There are no gradients used as ornament, no glass, no coloured status pills, no icon medallions. The only gradient in the product is the fade under the points curve, and it fades the accent to nothing.

## Typography

**Display Font:** the platform UI stack — `-apple-system`, `BlinkMacSystemFont`, `Segoe UI`, `PingFang SC`, `Hiragino Sans GB`, `Microsoft YaHei`, sans-serif (no webfont is loaded; the userscript has no CDN dependency)
**Body Font:** the same stack
**Numeric Font:** the same stack, with `font-variant-numeric: tabular-nums` and `font-feature-settings: "tnum" 1`

**Character:** One stack, one voice, and a size ramp that never exceeds 27px. Nothing here is trying to be editorial — the difference between a heading and a caption is weight and position, not a second typeface. Shipping the CJK and Latin faces from a single system stack is what makes the Chinese-first interface look native in both languages instead of translated, and it costs nothing to load.

### Hierarchy
- **Display** (600, 20px, 1.3, −0.3px): the account name in the identity strip. The largest non-numeric text in the product. The one other glyph at display scale is the initial that stands in for a missing avatar on the account page, set at 22px inside its 64px box — the step the metric values take at the narrow breakpoint, because it is doing the same job at the same size.
- **Headline** (600, 16px, 1.35): empty-state title, the monthly best/worst values. Reserved for statements, not labels.
- **Title** (550–600, 15px, 1.4): panel headers, section headers, the top-bar product mark, the error-state headline. Panels are titled rather than headed — a 15px line is enough to open a region.
- **Metric** (600, 27px, 1.1, −0.6px, tabular): the KPI values. This is the only place the ramp is allowed to be loud, and it is the only text in the product permitted to use negative tracking as display treatment. Falls to 22px at the narrow breakpoint and 18px inside the farm band.
- **Body** (400–550, 14px, 1.5): the page's root size and the table's baseline. Row names take 550 when they need to lead their row.
- **Label** (400–500, 12.5px, 1.45): navigation, segment buttons, table status text, identity metadata, hints, captions.
- **Micro-label** (500, 11.5px, 1.4, +0.2px): KPI captions, table column headers, legend text, the heatmap note. One step below it sits the floor: 11px for chart axis ticks, the heat map's weekday column and month labels, the month-bar labels, the PLUS badge, the CPU/GPU chips, the numbered step marker, the render key's in-use badge, and the tooltip's date line. Nothing in the product is set below 11px, and nothing set at 11px is asked to carry a sentence.

### Named Rules

**The Tabular Truth Rule.** Any string that could be read as a quantity carries tabular numerals — KPI values, table figures, axis ticks, the heatmap total and peak, the progress numerator, the "showing n / total" counters, the month labels, and the render keys, which are strings that still have to line up like numbers. This is applied through one utility class rather than repeated declarations, so a number that is not aligned is a missing class, not a judgement call.

**The One Face Rule.** One font stack for everything, including numerals and code-like strings. A second face has to earn its place, and nothing in this product needs one.

## Layout

A single centred column, capped at 1240px and padded 24px on the sides (16px below the narrow breakpoint), with a generous 72px floor beneath the last element. The reading order is fixed by the surface: sticky top bar, identity strip, the four-metric band, the main working area, then the full-width records and previews, and on the account page a stack of single-purpose panels closed by the footer's provenance line.

Two surfaces run narrower than that column on purpose: settings at 680px and the account page at 820px. A form is read one control per line, and a full-width input row is a longer reach than a target needs to be.

**Who owns the farm.** The site-wide status band — frames remaining, active projects, connected clients, frames in flight — opens the **projects** view and is deliberately absent from the overview. Those four numbers describe the farm, not the person reading it, and the overview is the one surface in the product that is about a single contributor; putting the queue's vitals at the top of a personal dashboard makes the page answer a question nobody opened it with. The projects view is where someone is deciding what to render, so the queue's state belongs directly above the list it explains. A band that opens a surface is set flush (no top margin) so it reads as the page's header rather than as a card that drifted in.

The metric band is four equal columns inside **one** bordered surface, separated by internal 1px rules rather than by gaps; it folds to 2×2 at 860px, and the internal rules are reassigned per position so the fold never shows a floating divider. An account that has published projects grows the band to five or six columns (projects created, frames ordered); that band folds 6 → 3×2 at 1200px and → 2×3 at 860px, and every fold re-derives which internal edges are drawn — a fold that leaves a divider floating at the left edge of a row is the failure mode to look for. The main working area is an 8/4 split with a 16px gutter — the growth curve at 216px tall on the wide side, monthly output at 132px on the narrow side — and it collapses to a single column at 1000px. Both of those panels depend on series the site inlines only on your own profile, so on anyone else's page they are **absent rather than empty** — a panel that exists only to say it has nothing to say is furniture — and when just one of the two has data it takes the full width instead of leaving half a grid standing empty. Bands that need horizontal room take the full width: the 53-week render heatmap sits in its own full-bleed panel and not in the side column, because a week squeezed into a 7px cell stops being a week and becomes noise.

Vertical rhythm is built from a 16px stack gap between regions, 20px horizontal interior padding for panels and metric cells, and 28px of separation above a section header. Table interiors are tighter on purpose — 11px vertical cell padding, with the panel supplying only 6px of breathing room — and the numeric columns collapse to their content width so that leftover space goes to the name column instead of being distributed across three figures. Below 760px the tables keep their shape and scroll horizontally rather than reflowing into cards.

The session page is the one surface built around a record rather than a set of readings, and it is ordered the way a technician reads a machine: state and hostname, the four numbers, the spec sheet, the controls, then the activity. That activity is 761 raw events, and printing them first was the wrong default: five columns of four short fields spread across the page column, an entire screen of height for something the reader scans in two seconds. The record is therefore **summarised before it is printed** — one row per day, or per month when the session is older than a month, carrying the four numbers that answer "was this machine working": time actually spent rendering, events, jobs, and send failures, with a bar drawn from the rendering time so the shape of the week is visible without reading a digit. The raw log sits behind one button. When it opens it gets its own scrollport — `min(58vh, 560px)` with the header stuck to the top of that box — because a log that sets the page's height buries everything under it, and a header that scrolls away leaves two adjacent date columns indistinguishable. Its columns run event, start, duration, then end and job: ordered by what survives a 390px viewport, because the essentials have to be the part that fits. The same principle governs the diagnostics below — thirty projects that the site prints as thirty repeated sentences become six headings with the project names under them.

## Elevation & Depth

The system is flat at rest and tonal in motion. Depth is carried almost entirely by the three-step neutral surface ramp plus 1px hairlines; a shadow exists, but only to separate a panel from the page field by the smallest perceivable amount. There is no hover lift, no glow, no focus bloom, and no stacking of two shadows on one element. The only two things that float over content instead of sitting in the column are the tooltip and the mode pill — the tooltip earns it by being transient and overlaying the curve, and the pill earns it by no longer having a column to sit in.

### Shadow Vocabulary
- **Ambient Panel, dark** (`box-shadow: 0 1px 2px rgba(0,0,0,.5), 0 4px 12px rgba(0,0,0,.28)`): the default elevation for the metric band, panels, the farm band, tooltips, toasts and the mode pill. A tight contact shadow plus a wide soft one; the pair reads as a panel sitting a millimetre above the field rather than as a drop shadow.
- **Ambient Panel, light** (`box-shadow: 0 1px 2px rgba(16,24,40,.06), 0 4px 12px rgba(16,24,40,.05)`): the same construction at the strength a light field can absorb. Tuned toward the neutral ink hue rather than pure black so the shadow stays cool.

### Named Rules

**The Flat-By-Default Rule.** One shadow token, two themes, one role. Shadows mark "this is a container"; they never mark hover, focus, selection, or importance. If an element needs to look more important, change its tone or its position, not its blur radius.

**The Hairline Rule.** A border is the separator. Cards are not nested inside cards, and a divider inside a group is the same colour as the border around it — never lighter, never dashed.

## Shapes

Geometry is quiet: modest radii, thin strokes, and no clipping tricks. Containers land on a 10px radius (panels, the metric band, the farm band, the switch track, the account page's 64px avatar), one step in at 8px sit primary buttons and the mode pill, and small controls and avatars sit on 6px (nav items, segment buttons, inputs, the mode button, icon buttons, tooltips, the 20px table avatar, the 22px list avatar and the 26px top-bar avatar), with media blocks on 12px (the identity avatar, which is the largest single corner in the product). The scale bottoms out with 2px on chart and heatmap cells, 3px on the progress bar so its fill and its track round together at a 6px height, and 4px on text badges (the PLUS mark, the CPU/GPU chips, the machine tag, the render key's in-use badge). Circles appear exactly three times: the 20px numbered step marker in the new-user empty state and the 26px loading spinner both mean something is happening — the spinner's ring is drawn from the hairline colour with a single accent-coloured arc — and the 14px switch knob is the one circular control in the product, travelling its own width inside a 34×20 track whose ends are rounded to half its height.

Strokes are always 1px and always solid; the only exception is the 1.8px stroke on the points curve and the 1.5px on the sparklines, which exist to survive anti-aliasing at small amplitudes. Nothing is dashed, nothing is outlined-only for emphasis, and no element relies on a shape the border does not describe.

### Named Rules

**The No Medallion Rule.** No icon is ever placed inside a coloured shape to give it weight. Icons are 14–15px of `currentColor` sitting next to their label at the same optical weight — the top bar's refresh control is a 30px boxed icon button, and that border is a hit target, not a decoration.

## Components

Every interactive element shares one idea: the border is the hit target and the state change is a colour change on that border, on the fill, or on the label — never a movement.

### Buttons
- **Shape:** gently rounded (8px), inline-flex with a 7px gap between icon and label, 13px label at the body size.
- **Primary:** brand orange fill with the near-black label in the dark theme and white on the deepened accent in the light theme; 600 weight; 8px/15px padding. The labels differ per theme because the accent has to clear the contrast floor, and the label moves instead of the brand colour.
- **Hover / Focus:** the ghost button's border and label step up one tier (hairline → hairline-strong, secondary ink → primary ink) over 120ms; the primary button brightens by 7% through a filter rather than re-declaring its fill, so the brand hex stays the single source of truth. Focus is never a shadow: `:focus-visible` draws a 2px accent outline at a 2px offset and takes the small radius.
- **Ghost / Secondary:** surface fill, hairline border, secondary-ink label. This is the default button and the only one that appears without a reason.
- **Small:** the same secondary button one size down (4px/10px padding, 12px label, small radius), used for the in-row maintenance actions — remove, delete. Size is a step, not a tier: it is still the secondary button, and there is still no third kind.
- **Icon button:** a 30px square on the small radius, hairline border, secondary-ink 14px glyph. Used for the top bar's refresh control.
- **Mode button:** the same 30px height as the icon button, but an icon+label control on the small radius with a 12px label and a 13px glyph, sitting between the timestamp and the refresh button. It is the exit from the system, so it is styled as a peer of the controls beside it and never as an accent: leaving is not the primary action of any page. Below 1000px the label drops and the icon stays.

### Chips
- **Style:** a segmented control rather than free-floating chips — a bordered container on the 8px radius with 3px of padding, holding 12.5px buttons on the small radius.
- **State:** the pressed segment takes the ember wash as a background (`aria-pressed="true"`, not a visual class) with brand-orange text at 600 weight. Unpressed segments are secondary ink and darken to primary ink on hover with no fill change. The same construct carries the status filter row and all four settings rows, which is why it is driven by `aria-pressed` and not by a modifier.

### Cards / Containers
- **Corner Style:** 10px, with `overflow: hidden` on the multi-cell bands so the internal dividers stop cleanly at the radius.
- **Background:** the panel surface; raised and sunken tiers are used for content inside a panel, not for the panel itself.
- **Shadow Strategy:** the single ambient panel shadow, identical in role everywhere (see Elevation & Depth).
- **Border:** 1px hairline on all sides, always.
- **Internal Padding:** 16px top and 20px sides for a titled panel; 18px/20px per cell in the metric band; 40px/28px in the empty state's inner block, easing to 32px/18px on narrow screens.

### Inputs / Fields
- **Style:** a 1px hairline box on the small radius with the panel surface behind it, 7px/11px of padding, a 14px muted icon inside at the leading edge, and a borderless transparent `<input>` filling the rest. The label is a wrapping `<label>` so the whole field is the hit target. The default width is 340px, collapsing to a 220px floor.
- **Focus:** the input itself draws no outline; the container shifts its border to the accent and draws the system's 2px accent focus ring around the whole control, so the field lights up as one unit instead of the text box growing a frame inside a frame. (The input must never carry `outline: none` on its own — its selector outranks the global `:focus-visible` rule and would silently remove keyboard focus from the control.)
- **Placeholder:** tertiary ink, 13px, used as a real hint (the projects search states what is searchable), never as a label.

### Switch (signature)
The account page's recurring control: a 34×20 track on the sunken tier with a 14px circular knob, a 13px label and a 12px hint line under it, three of them stacked in one panel. Each one is a checkbox with a visually hidden input inside a wrapping `<label>`, so the whole row toggles and `:focus-visible` lands on the track rather than on a control the user cannot see. At rest the knob is tertiary ink on the sunken tier; switched on, the track takes the accent fill and the knob takes `--btn-ink` — the same near-black-or-white rule as a button label, because a knob on the accent *is* a label on the accent, and it inherits the contrast decision instead of inventing a second one. The knob travels exactly its own width, 14px, so the off and on positions are symmetric inside the track's 2px inset. Hover only steps the border to the strong hairline; the state change itself is the fill plus one 140ms translation, and nothing changes size.

### Navigation
- **Style:** flat text buttons, 2px apart, 6px/11px padding on the small radius, 13.5px secondary ink. There is no underline, no pill, no indicator bar.
- **States:** default is secondary ink on nothing; hover adds the raised tier as a fill and moves the label to primary ink; the current page takes the raised tier fill plus a 550-weight primary-ink label, marked with `aria-current="page"` so the state is semantic before it is visual.
- **Mobile treatment:** the timestamp surrenders first at 860px and the username at 620px, because the refresh button already communicates that the page can be updated and the identity strip already carries the name. Labels then shorten rather than scroll or hide — 排行榜 becomes 排行, 账户设置 becomes 账户 — so all five items still fit and stay tappable at 390px. The nav list is explicitly prevented from shrinking — letting it flex is what produces overlapping labels.

### Mode Pill (signature)
The way back. The modern shell is a mode rather than a takeover: its top bar carries the button that hands the page to the original site untouched, and this pill is what the original site carries in return — a fixed button in the bottom-left corner, carrying a 15px sheep mark and one 13px/600 line, filled with the brand accent and fully opaque. Two things make it unlike everything else here. It renders **outside the system**: the main stylesheet is deliberately not loaded in that mode, so it hard-codes the dark panel surface, the primary ink, a white-alpha hairline and the ambient panel shadow instead of reading a token, and it keeps its own thirty-line stylesheet keyed to its own id. The accent fill reads on either theme, sitting on a page it does not own — which is right, because at that moment it is a guest. And it is the only element whose job is to describe a different mode of the product, so it must be findable: it was first built as a 12.5px chip at 62% opacity on the dark panel surface, on the theory that the way back should whisper, and that failed the only test that matters — a reader who had switched to the original interface could not find it and said so. The corner stays chosen to cover no content: bottom-left is the one corner the original site leaves empty, since the site's own "to top" control lives bottom-right.

### Insight Heatmap (signature)
A 53-week × 7-day render calendar drawn as one CSS grid with `grid-auto-flow: column`, one `<i>` per day, each carrying its own fill from a five-step accent ramp. Two decisions define it. First, the steps are **quantile** thresholds over the non-zero days rather than absolute frame counts: absolute banding collapsed a heavy user's 500–2000-frame days into the two lowest steps and turned the whole year into one flat block. Second, the cells size themselves from the panel width via an aspect ratio, so 53 weeks always fit at roughly 20px per cell — and below 760px they switch to a fixed 14px with horizontal scroll rather than shrinking into unreadable speckle. The legend renders the empty cell plus all five steps, so the key cannot disagree with the data. When every non-zero day is identical (a site that only records "rendered / did not render"), the ramp degrades to its middle step deliberately, which at least preserves the read of *when*, instead of painting one colour. That degraded mode is not hypothetical: the site inlines per-day frame counts only on your own profile, so every other user's page runs this component in its **binary** mode — and there it also drops the frame vocabulary entirely, because "295 days rendered" is a fact and "295 frames" would be a lie. The legend collapses to none / rendered and the note and total count days.

### Heatmap Date Axes (signature)
A 53-week grid with no dates on it is a texture, not a read-out, so the calendar grew axes that cannot drift. A fixed weekday column on the left labels 一/三/五 — every other row, because seven labels turn into a smudge — and it is aligned to the cell rows by a spacer block whose height is the month row's height plus its margin, not by a guessed padding: change the type and the two grids stay in register. The month labels share the grid's own column template, so a label is positioned by *column index* and ends exactly where its month ends, and they are allowed to overflow their span rather than truncate. Three rules keep the row readable: a month only one column wide is skipped because it would collide with its neighbour, a label starting fewer than two columns after the previous one is skipped for the same reason, and the year is printed only on the first label and again when the year changes — thirteen identical "September"s is not a date. The weekday column is dropped entirely below 760px, where the date is the tooltip's job instead. Hovering a day draws a 1px outline outside the cell and never a recolour, because on this component the fill *is* the datum; the day's frame count (or, in the calendar's binary mode, simply rendered / not rendered) and its full date arrive in the same tooltip the points curve uses.

### Insight Metric Band (signature)
Four KPIs — frames rendered, points, render time, current streak — inside a **single** bordered surface with internal 1px dividers, never as four separate cards. An account that has published projects adds two cells to that same surface rather than opening a second band: projects created and frames ordered, each only when it is non-zero, so a renderer who has never uploaded anything still sees the original four. Each cell carries a micro-label caption, a 27px tabular value, and a caption line that adds the second-order fact the site does not show: daily average and peak, site rank on a 30-day window, machine-days equivalent, best streak and 30-day activity. A value the site itself abbreviates ("342.6 M" for another user's points, whose exact figure it does not publish anywhere) is printed as the site wrote it — stripping the suffix turns 342 million into 342. The band is the first thing under the identity strip and the reason the page exists. Splitting it into cards is the single most common way to get this wrong.

### Data Table (signature)
Hairline-ruled rows with no vertical rules and no zebra striping; hover moves the whole row to the raised tier. The row representing the current user takes the ember wash — this is the accent's "you" job — and appends a small "you" marker in the owner cell. Numeric columns collapse to their content width and align right; every figure's header and its cells carry the tabular treatment together, because a nowrap header above wrapping cells was what pushed units onto second lines in the first place. Sortable headers expose `aria-sort` and take a caret only while active. Deep lists render progressively behind a "show more" button that states its own progress truthfully — "showing 100 / 500" — instead of silently truncating. Below 760px the table keeps its columns and scrolls sideways. The publisher cell may carry one labelled maintenance toggle whose text *is* the state — "prioritise" when the publisher is outside your render-priority list, "remove" when they are inside it — plus a 3-dot button that opens a small menu holding the two list actions that are not toggles: donate the points you earn to this publisher, or blacklist them so their projects are never sent to you. Each menu item leads with an icon naming the action — a heart for donating points, a prohibition sign for blacklisting — and the check that means "already on this list" sits at the trailing edge instead of sharing the leading slot, so "what this does" and "where you stand" never crowd one another; a checked item also flips its wording into the undo. The menu is a floating surface positioned by measurement, its **left edge aligned to the trigger** so it unfolds to the right of the button instead of hanging back across the row; it flips upward near the bottom of the viewport and slides left rather than overflow the right edge. It stays out of the way until the row is engaged: on a pointer device that can hover, the button is transparent until the row is hovered or focus lands inside it, and it is hidden by *opacity* rather than `display` so it never leaves the tab order. On a touch device, where there is no hover to reveal it, it is simply always visible. Membership itself is never hover-dependent — a publisher already in your list is marked with a persistent 12px accent star after their name, because "am I already prioritising this person" is a question the table should answer at a glance rather than on approach. The action is absent for your own rows (the scheduler switch already covers those) and absent entirely when the list could not be read, because a toggle whose state is unknown is a trap. The name itself — the publisher in a project row, the renderer in a ranking row — is a link to that person's profile, with the accent arriving only on hover: the one thing anyone wants from a name in a table is the person behind it, and colouring a whole column of names would turn the table into a wall of links.

### Machines Panel (signature)
One machine per row, and explicitly not a card grid: the count changes with the day, a grid of cards for a list that grows is dashboard wallpaper, and every card would have to repeat the same four facts. A row is a 11.5px accent-washed tag carrying the client name at 600 weight, the machine's specification in muted secondary ink on a single truncating line, and a tertiary 12px exit link to the session. The tag is the accent's "yours" job applied to a list of your own things — a wash at 14%, never a filled pill, and never more than one per row. Rows carry the same hairline as every other list and the last one drops it, so the panel reads as one surface rather than as a stack of cards. The header states the count. This list replaced a preview of in-progress projects, which was the projects view printed twice; when nothing is connected it says so in one tertiary line instead of vanishing.

### Progress Bar (signature)
A 6px fully rounded track on the sunken tier with an accent fill, and the fraction printed **outside** the bar, right-aligned in tertiary ink at 11.5px. The interface it replaces printed the numerator across a half-filled two-tone bar in white text, where it was unreadable over one half and truncated at the edges; moving the number out of the bar is the entire fix, and it is not negotiable for the sake of a more compact row.

### Status Page & Empty State (signature)
Three states, three registers, never interchangeable. **Loading** is a 26px ring drawn from the hairline colour with one accent arc, plus a 13px tertiary line. **Failure** is a 15px headline, a tertiary explanation, and a primary retry button — said in words, never in red. **New user** is not an absence: a 16px title, one paragraph explaining why the farm is built out of everyone's spare compute, three numbered steps (install, leave it running, earn points) laid out three-across on a 760px measure and stacking below 760px, then two exits — a primary download link and a ghost explainer. A parsed-but-empty account gets this state; an account whose stats could not be read at all gets a plain no-data line instead, because telling a returning user "you have not started" when the parser failed would be a lie.

### Account Settings (signature)
The first surface that writes rather than reads. It is an 820px column of single-purpose panels — scheduler, render priority, donating points (the site calls it *Sponsorship*), avatar, email, render keys, two blacklists. Seven panels in one column is a scroll, not a page, so they are grouped into three tabs by what the reader came to do: **Scheduler & lists** (the switches, render priority and both blacklists — everything about whose work you accept or refuse), **Donating points**, and **Account** (avatar, email, render keys). The tab strip is the same segmented control the settings page uses for theme and language, because it is the same job: one thing, several views. The chosen tab lives in memory and is not written into the address, exactly like the project table's filter and the ranking's page size — a refresh returns to the first tab. Each panel keeps a 15px title, a 12px tertiary hint at 1.65 line-height, and a body on a 14px/20px/18px rhythm so the content lines up under the header instead of under the panel edge. Every panel ends in exactly one accent-filled primary button, and an empty list keeps its frame and says *(empty)* in one tertiary line rather than disappearing into a mystery gap. A second heading can appear inside a panel (the owner blacklist, under the renderer one) and it is the same 15px title, not a smaller tier. The points-donation panel is the one that gives something away, so its hint states the consequence in the first clause — every frame you render sends that frame's points to a random person on the list instead of to your own account — and its two switches show whatever state the site reports, because a switch that guesses is worse than no switch.

**The One Commit Rule.** A panel ends in exactly one accent-filled primary button — the action that changes something on the server. Every other action in that panel, delete included, is a secondary button on the surface fill and the hairline border; there is no third button tier, and there is still no red one. A maintenance action is not painted, it is worded.

Four row species do the rest of the work:
- **The switch row** — label, hint, track; three of them stacked in the scheduler panel, which is why the control is a row and not a checkbox.
- **The list row** — a 22px avatar or initial, the name as a link that takes the accent underline on hover, and the secondary remove button pushed to the trailing edge. The list itself is a bordered group on the small radius with **no fill and no shadow**: that is a list, not a card, and its row hairlines are the same colour as the border around it.
- **The key row** — the render key in 12.5px tabular type with a little tracking so a column of keys stays in register, a truncating 12px comment capped at 180px, an in-use badge that is neutral until the key is actually authenticating something and then takes the accent wash, and the same secondary delete. A key is a string that has to line up like a number, and it is never given a monospace face the system does not have.
- **The add row** — the search-field idiom reused as an input: hairline box, leading 14px icon, borderless transparent input filling the rest, with the panel's commit button 8px away and the field widening to the available space instead of holding its 340px. Focus lights the field up as one unit, exactly as it does in the toolbar.

The avatar line is the one place the control is not a button: a 64px avatar at the container radius, then a file picker rendered as a bordered label wrapping a hidden `<input type="file">`, with the commit button underneath. The input is hidden because a native file input cannot be dressed to match a hairline control, so the label is the button and takes the same hover. The hiding is visual only — 1px, transparent, absolutely positioned — and never `display: none`, because that would drop the input out of the tab order and leave the product one control a keyboard cannot reach; the label takes the focus ring through `:focus-within` instead, exactly as the search field does.

### Session Facts Grid (signature)
The session page's spec sheet: the site's own label/value table re-set as a two-column grid inside one bordered surface with internal hairlines, folding to a single column at 720px. Three decisions hold it together. The labels are the site's labels passed through a vocabulary rather than rewritten — "RAM allowed" stays an allowance and does not become "available memory". A row the vocabulary does not recognise is still printed, with its raw label, because the site adds fields and a field we cannot name is not a field the reader should lose. And the render key arrives masked behind a secondary Show button, because the site also reveals it only when asked: a secret is not made more useful by being printed on load. The status chip above the grid is the page's only statement of state, and it stays neutral — the sunken tier at 11.5px, and the strong hairline rather than a colour when the machine is paused, because "paused" is a state and not an alarm.

**The Unknown Field Rule.** A parsed field with no entry in the vocabulary is displayed with its raw label rather than dropped. Silence about a field the site chose to show is a data loss, not tidiness.

### Activity Summary (signature)
The session page's default reading of 761 events: one row per day, or per month once the session is older than a month, newest first, capped at fourteen rows with a tertiary line naming how many earlier periods are not listed. Four numbers per row — render time, events, jobs, send failures — plus a 6px accent bar at 55% drawn from the rendering time, so a week's shape is readable without reading a digit. Two things are deliberately absent. There is no event-type colour coding: this system has one accent and a five-hue status ramp is exactly the wall of colour the One Voice Rule exists to prevent. And there is no per-row date formatting beyond `MM-DD` (`YYYY-MM` in month mode, and a year on every key once the record crosses one): the panel header carries the full range, and a table of long dates is a table nobody scans. The bar has one meaning and keeps it — it is render time, and a machine that has never rendered anything simply gets unfilled tracks rather than a bar quietly counting events under a column still labelled render time. The gutter that holds it is never removed, because that flex column is what keeps the header labels over their own numbers.

**The Summarise Before Printing Rule.** A record is summarised by its own natural period before it is printed. A day is the unit a person actually asks about a machine, so a day is the row; the raw events are one click away and never the default.

**The One Clock Rule.** Every timestamp this system renders is the reader's local time, and the surface says so once ("your local time") instead of leaving two clocks on one screen. The site's own raw strings — a creation time printed on the server's clock — stay where they belong, inside the facts grid, under a header that already states the values are unconverted. A derived figure that can be expressed on the reader's clock is: the machine's "since" line is the local reading of its first logged event, not the site's string, because those two differ by the server's offset and reading them side by side looks like six lost hours.

### Event Log (signature, folded)
The full record, behind one button, in a bordered scrollport with its header stuck to the top. The doorway states what it costs — "show the full log (761 events)" — and the button is a secondary one, because looking is not an action. Inside, the counted type filter is the segmented control with a count on every option (rendering 298, validate 261, request 192, send-error 9, login 1), and the counts come from the same array the rows are drawn from, so the key cannot disagree with the data, exactly as with the heat legend. Rows are 12.5px with 7px of vertical padding — this is a log, and its density is the point — and its columns run event, start, duration, end, job, ordered so that what survives a 390px viewport is what a reader needs first.

### Reason Groups (signature)
The site prints "Renderable projects" as thirty-odd rows, each repeating one of six sentences, in no useful order — and with no publisher attached, although every one of those projects is on the site's own project list with its owner on it. The remake does both jobs: the reason is the grouping, and the publisher is joined back on by project name. The panel reads "no big-archive download on this machine · 12", "requires a GPU · 10", "owner is rate-limited · 3", and under each heading the projects are chips whose trailing half is the publisher as a link to their profile, separated from the name by the same hairline that separates every other pair in this system. A name the join cannot resolve keeps its chip and shows no publisher: a missing fact is left missing, never guessed.

## Do's and Don'ts

### Do:
- **Do** keep brand orange to its three jobs, and audit for the fourth: a rendered run of the projects table should show orange only on the progress fills, the selected CPU/GPU markers, the "you" marker, and the primary button.
- **Do** use one bordered surface with internal hairlines for any band of peer metrics (the KPI band, the farm band); reassign which internal edge is drawn when the band folds to 2×2.
- **Do** put `tabular-nums` on every quantity, including axis ticks, legend totals, month labels, render keys, and the "showing n / total" counters.
- **Do** size data visualisations so a single unit is readable — 53 weeks at ~20px per cell full-bleed, 14px plus horizontal scroll on narrow screens — and prefer moving a visualisation to full width over shrinking it into a side column.
- **Do** move a label out of a bar, out of a truncated `<dl>`, or onto its own line rather than shrinking its type or letting it be cut off; the previous interface's defects were all compression defects.
- **Do** state failures in words with a retry action, and degrade a failed parse to a local "no data" instead of an empty-state story or a thrown error.
- **Do** theme the browser surfaces from the palette — selection wash, accent caret, thin scrollbar on the strong hairline, and a 2px accent focus ring at a 2px offset — and keep `text-underline-offset` at 3px with a 1px thickness on links.
- **Do** keep hover a colour change and reserve motion for the one-time entrance: a 500–700ms rise from 4px with `cubic-bezier(.16, 1, .3, 1)`, and state transitions at 100–120ms.
- **Do** keep the way out of a mode visible from inside it, and let the pill that brings the user back carry its own styles: it renders while the stylesheet is deliberately not loaded, so it reads no tokens and is allowed to read none. Word it as the action rather than the state, and make it opaque — a subdued chip is not "quiet", it is missing.
- **Do** hide a control visually instead of removing it: `display: none` deletes it from the tab order, so a 1px transparent input that still takes focus — with the ring drawn on the label through `:focus-within` — is the pattern for anything a platform will not let you style.
- **Do** summarise a long record by its own natural period before printing it, and put the raw rows behind one button that states how many there are.
- **Do** give a long record its own scrollport with a stuck header when it is opened, and order its columns so the ones that survive a 390px viewport are the ones a reader needs first.
- **Do** print a field the vocabulary does not recognise, with its raw label, and keep a secret behind the click that asks for it.
- **Do** keep a row-level action out of the way until the row is engaged — hidden by opacity behind `:hover` **and** `:focus-within`, never by `display: none`, and always visible where there is no hover to reveal it.
- **Do** state membership with a persistent mark rather than a hover-dependent one, and make a row-level toggle say its own state in the label (Prioritise / Remove) — dropping it entirely when the membership is unknown.

### Don't:
- **Don't** colour status text or add semantic pills. "Rendering", "Waiting" and "Paused" stay neutral secondary ink — a wall of orange statuses destroys the accent's meaning and its usefulness.
- **Don't** split a peer-metric band into four cards, and never nest a card inside a card.
- **Don't** use decorative gradients, glassmorphism, blurred backdrops, coloured icon medallions, or hover lift. The one gradient in the product is the accent fading to transparent under the points curve, and the one backdrop filter is the shell's sticky top bar, filled with the page field mixed to 86% and blurred.
- **Don't** paint a maintenance action or hide it behind an icon. Remove and delete are secondary buttons that word what they remove; the accent belongs to the commit, and there is still no red.
- **Don't** reach for a smaller, fainter grey as a substitute for restraint. The muted ink is readable at 11px, which is the floor, and 11px is spent on axis ticks and badges — never on a sentence. Small-and-faint is not the same thing as disciplined.
- **Don't** use white text on the pinned brand orange, or lighten the brand orange to make white work — move the label to the near-black ink instead. The brand hex is a hard constraint; the label is not.
- **Don't** reflow tables into stacked cards on narrow screens. Keep the columns, let the table scroll, and keep "show more" stating how many of how many.
- **Don't** add a second typeface, a webfont, a second accent hue, or a red. One face, one voice, and errors said in words.
- **Don't** repeat a grouped reason on every row. When thirty rows carry six sentences, the reason is the grouping — print it once, above the names it explains.
- **Don't** print a raw record as the default reading of a page, and don't print a render key on load. Both make the record louder than the machine it describes.
- **Don't** colour-code event types or invent a status ramp to make a log look informative. The accent bar carries one measure; everything else is text.
