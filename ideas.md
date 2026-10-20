# Book Character Relationship Mapper — Design Ideas

## Three Stylistic Approaches

### 1. Literary Cartography
**Theme:** Aged parchment maps meet modern information design — nodes look like wax-sealed letters, edges like hand-drawn routes between locations.
**Probability:** 0.04

### 2. Dark Scholarly Codex
**Theme:** Deep midnight backgrounds, ink-and-gold typography, a sense of reading by candlelight. Nodes are illuminated manuscript medallions.
**Probability:** 0.07

### 3. Clean Editorial Intelligence
**Theme:** Crisp off-white canvas, editorial serif headings, precise geometric nodes with bold colour coding. Feels like a high-end magazine's data visualisation spread.
**Probability:** 0.03

---

## Chosen Approach: Dark Scholarly Codex

### Design Movement
Gothic editorial meets modern data visualisation — the aesthetic of an illuminated manuscript brought into the digital age.

### Core Principles
1. **Depth through darkness** — deep navy/charcoal backgrounds create a canvas that makes coloured nodes glow with importance
2. **Gold as hierarchy signal** — amber/gold accents mark primary actions, titles, and selected states
3. **Typographic gravitas** — serif display font for titles and labels, clean sans-serif for UI chrome
4. **Precision geometry** — nodes are crisp circles with coloured rings; edges are clean curves with clear arrowheads

### Color Philosophy
- Background: `#0f1117` (near-black with a blue undertone — like deep night)
- Canvas: `#141824` (slightly lighter, the "page")
- Node surfaces: `#1e2535`
- Gold accent: `#c9a84c` (warm amber — the candlelight)
- Relationship colours: distinct palette per type (family = warm amber, romance = rose, friendship = teal, rivalry = crimson, mentor = violet, step = orange)
- Text: `#e8e0d0` (warm off-white — aged paper)

### Layout Paradigm
Full-screen canvas occupies the right 75% of the screen. A collapsible left sidebar (25%) holds book metadata, character list, and relationship controls. The canvas is infinite and pannable with a minimap in the bottom-right corner.

### Signature Elements
1. Coloured glowing rings around character nodes (colour = group/family)
2. Animated dashed lines for "uncertain/rumoured" relationships
3. Relationship labels that appear on hover with a subtle fade

### Interaction Philosophy
Everything should feel deliberate and satisfying. Dragging nodes has gentle spring physics. Clicking a node highlights all its connections. Double-clicking opens the edit panel. Right-click shows a context menu.

### Animation
- Node entrance: scale from 0.85 + fade in, 200ms ease-out
- Edge draw: SVG stroke-dashoffset animation, 300ms
- Sidebar panels: slide in 250ms ease-out
- Hover states: 150ms transitions on all interactive elements
- Selected node: pulsing outer ring, 2s infinite

### Typography System
- Display/headings: `Playfair Display` (serif, weight 700) — book titles, character names on nodes
- UI chrome: `DM Sans` (geometric sans, weight 400/500) — labels, buttons, form fields
- Monospace accents: `JetBrains Mono` — relationship type badges

### Brand Essence
A scholar's tool for readers who take their stories seriously. For anyone who has ever lost track of who's related to whom.
Personality: **Precise. Atmospheric. Illuminating.**

### Brand Voice
Headlines sound like chapter titles. CTAs are invitations, not commands.
- Example: "Begin mapping your story" (not "Get started")
- Example: "Add a character to the web" (not "Add character")

### Wordmark & Logo
An open book whose pages form a network graph — two nodes connected by a curved line sitting above an open spine.

### Signature Brand Color
Amber gold `#c9a84c` — unmistakably this tool's.
