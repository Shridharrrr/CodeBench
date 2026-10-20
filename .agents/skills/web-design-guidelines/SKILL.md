---
name: web-design-guidelines
description: Review UI code for Web Interface Guidelines compliance, modern aesthetics, typography, accessible contrast, and micro-interactions. Use when reviewing frontend UI, designing new views, and checking UX aesthetics.
---

# Web Interface Guidelines & Aesthetics

Review UI code and component implementations for compliance with modern web aesthetics and interface guidelines:

## Core Principles
1. **Typography & Hierarchy**:
   - Use modern, high-legibility typefaces (e.g. Inter, Outfit, JetBrains Mono, Fira Code).
   - Clear contrast between headers, body, metadata, and code spans.
   - Restrict heading sizes to a consistent scale with tight letter spacing (`tracking-tight`).

2. **Colors & Dark Mode Contrast**:
   - Provide high contrast obsidian backgrounds (`#06090e`, `#0d121d`) with elevated card borders (`#233047`).
   - Pure white `#ffffff` or near-white `#f8fafc` text for critical titles.
   - High-contrast badge backgrounds with clear semantic colors (emerald for solved, rose for error/fail, amber for warning/upcoming, blue for actions).

3. **Form Controls & Inputs**:
   - Consistent focus rings (`ring-2 ring-blue-500/30`), clear placeholder styles, and native dark select menu styling.
   - Descriptive validation feedback and loading indicators on submit buttons.

4. **Code & Syntax Display**:
   - Syntax-highlighted code panels with mono fonts and line numbers.
   - Instant copy buttons with visual feedback.
   - Distinct, readable diff blocks for test comparisons.
