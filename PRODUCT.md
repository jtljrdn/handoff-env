# Product

## Register

product

Note: this project has a significant marketing/docs surface (`/`, `/pricing`, `/docs/*`) that should be treated with the **brand** register per-task, since design carries more identity weight there. The authed dashboard, settings, billing, and audit surfaces are **product** register. Default to product when a task doesn't specify a surface.

## Users

Small dev teams (roughly 2-10 engineers) who need to share `.env` secrets without pinging teammates or committing them to git. Primary touchpoint is the CLI (`handoff login/init/pull/push/run`), used inside a terminal during setup, CI configuration, or key rotation. The web dashboard is secondary: used to manage projects, review audit history, invite teammates, and handle billing. Users are engineers, often the one technical co-founder or lead who set up the team's infra — comfortable with dev tools, impatient with friction, and quietly anxious about secrets handling because a leak is their fault.

## Product Purpose

Handoff is a zero-knowledge secrets manager: every secret is encrypted client-side (XChaCha20-Poly1305 + X25519 sealed-box + Argon2id) before it touches the server, so Handoff itself cannot read customer data. It replaces `.env` files sitting on disk or getting pasted in Slack with `handoff run -- <cmd>`, which injects secrets into a process at runtime. Success looks like: a team never has a secret leak via git or chat, rotations are fast and auditable, and the CLI disappears into a team's existing workflow.

## Brand Personality

Stripe-like: confident, precise, trustworthy. Polished and generous with whitespace, not flashy. The product handles other people's secrets, so the interface should read as engineered and calm rather than playful or loud. Blue (from the new shadcn preset) is the signature accent and is allowed to carry real visual weight, not just a thin highlight.

## Anti-references

- Generic SaaS template: gradient-clip hero text, identical icon+heading feature card grids, stock illustrations, hero-metric-with-gradient-accent blocks. This is the primary thing to avoid.
- Corporate/enterprise brochure: navy-and-gold, heavy chrome, procurement-deck feel.
- Playful/consumer: rounded mascots, bright primary colors, casual copy tone. Wrong register for a security product.

## Design Principles

1. **Prove zero-knowledge, don't just claim it.** Where possible, show the encryption boundary and the CLI-first flow rather than asserting "we take security seriously" in prose.
2. **Confidence over cleverness.** This is a tool people trust with credentials. No gimmicks, no cute copy that undercuts trust.
3. **One signature visual moment, not decoration everywhere.** Shaders are committed (saturated, real visual weight) at a handful of key moments; the rest of the interface stays restrained so those moments read as intentional, not noisy.
4. **Respect the CLI-first workflow.** The dashboard is a companion to the CLI, not a replacement for it — dense, fast, keyboard-friendly, not a hand-holding wizard.
5. **Practice what you preach.** A product that stores other people's secrets should never look careless about its own craft.

## Accessibility & Inclusion

WCAG AA minimum. Respect `prefers-reduced-motion` for all shader/motion work (already honored in the existing hero shader; carry this convention forward). Dashboard surfaces (audit tables, command palette, forms) must stay fully keyboard-navigable with visible focus states.
