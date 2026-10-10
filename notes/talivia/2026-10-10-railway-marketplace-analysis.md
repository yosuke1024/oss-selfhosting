# Railway templates as a business — the numbers, and the decision to stop

**Date:** 2026-10-10 · **Stage:** wind-down · **Author:** Claude Code, for the repository owner

A dated snapshot, and the last note in the Talivia sequence. It records why the
owner decided not to pursue "a Railway self-hosting interface for reviewed
open-source products" as a business, and then wound the catalog down. Nothing
in it is a check result; the product record is unchanged by it.

The question that was actually being asked, after the first apply
([`2026-10-10-railway-first-apply.md`](2026-10-10-railway-first-apply.md)),
was not whether a fork or a template could be made. It was whether publishing
Railway templates for reviewed products, and earning Railway's Template
Kickback on the usage they generate, holds up as a business. The marketplace
answers that directly.

---

## 1. The marketplace on 2026-10-10

Every published template was read through Railway's public API (`templates`
query, fields `activeProjects`, `projects`, `isVerified`, `category`); the raw
scan is not committed. 6,506 templates were published that day.

| Measure | Value |
| --- | --- |
| Active projects across all templates | 889,663 |
| Active projects per template, median | **1** |
| p75 / p90 / p95 / p99 | 7 / 34 / 92 / 772 |
| Templates with zero active projects | **2,781 (42.7%)** |
| Templates with ≥ 100 / ≥ 1,000 active projects | 304 (4.7%) / 55 |
| Share of all active projects held by the top 10 templates | **75.9%** (`postgres` 273,744; `mysql` 221,166; `n8n-with-workers` 81,053; `mongo` 28,911; `redis` 17,029 …) |
| Share held by the top 100 | 90.9% |
| Verified templates | 49, holding 24,225 active projects (median 35); the 6,457 unverified ones hold 865,438 (median 1) |

By category: Storage 557,640 active projects; Automation 124,724; AI/ML 55,477;
**Analytics 4,549 across 390 templates — 0.5% of the marketplace.** The
largest analytics template (`umami-analytics`) has 1,728; the largest Plausible
template 203; Talivia's one existing template, 0.

Within a product the distribution is winner-take-all: Umami's eleven templates
split 1,728 / 13 / 12 / 2 / …; Metabase's sixty-three have fifty-six at zero;
Strapi 2,813 against 299; n8n's 204 templates include 94 at zero.

## 2. What Kickback pays

From Railway's documentation and the marketing page, as read that day:
15% of the usage cost of services deployed from a published template, plus 10%
(25% total) while actively supporting users through the Template Queue; paid at
the end of the month once the deployer has paid their bill; Railway credits by
default, cash through Stripe Connect from $100; **published templates only**;
"verified" status requires the technology's own creator or maintainer to become
a Railway partner, and a partner earns commission on all templates that use
their technology, including ones they did not write.

## 3. Unit economics, with the assumptions written down

| Assumption | Value |
| --- | --- |
| Monthly Railway usage of a small application plus managed PostgreSQL | $5–10 (whether usage covered by the Hobby plan's included credit counts is not documented) |
| Kickback per active deployment per month | $0.75–2.50 |
| Human time per product per verification cycle (observed on Talivia) | about 2 hours, repeated at every re-pin |
| Break-even for one cycle at ¥5,000/hour | 50–80 active deployments sustained for a month |

The entire Analytics category would yield, at 15–25%, roughly $700–1,100 a
month if one owned all of it; the largest single analytics template, about
$260–430. Reaching $1,000 a month from one's own templates needs on the order of
700–1,300 active deployments, a level only 55 templates on the whole marketplace
reach, nearly all of them infrastructure primitives or automation and AI-agent
tooling with official or long-established templates.

## 4. Why the catalog's own rules make it worse

This repository prefers an official route, then a trusted community route, and
only then one maintained here (`deployments/README.md`). So a template of its
own is justified exactly where nobody else has made one — the long tail, where
demand is lowest. The products with volume are the ones whose routes the
catalog would defer to. And when an upstream later publishes its own template,
the catalog's route order retires the one maintained here.

Three structural points, independent of the numbers:

- Kickback is designed to pay maintainers for their own software. A catalog
  publishing templates of other people's products is the party the programme
  is not built for; "verified" is unattainable without the upstream, and an
  upstream that partners takes commission on the catalog's template.
- Discovery belongs to Railway's marketplace. The catalog's differentiator —
  editorial trust and a verification bound to an exact version — is real but
  is not what Kickback rewards.
- `README.md` promises that any economic relationship with a provider is
  disclosed where it applies. The contract has no field for it. Earning on
  recommended routes without that disclosure would contradict the editorial
  independence the review site claims.

## 5. What could still hold, and why it was not pursued

A catalog of human-verified deployment routes can work as a trust asset for a
review site: a cost paid for credibility, not a revenue line. It needs the
labour bounded — few products, official and community routes first, an IaC
file plus a guide as the route maintained here, every verification done by a
person and re-done per version. The owner judged that cost not worth carrying
for the return, and chose to wind the project down rather than run it as an
unpaid feature.

Forking or mirroring upstream repositories to publish templates — the question
that opened this line of enquiry — is moot once there is no revenue to justify
becoming a live build dependency for readers. The first-apply note's §6 records
the technical findings for anyone who reaches the same fork in the road.

## 6. What the wind-down leaves

- The Talivia record stays `work_state: verified`, `listing_state: unlisted`,
  naming the commit and image digest of the one deployment that was performed,
  with two required checks `not_tested`. It is a true record of one day and
  makes no current claim.
- The owner's Railway project was deleted the same day; nothing in this
  repository refers to it.
- The guides, notes and the IaC file are left as written. They describe
  upstream at the commits named in them and are not maintained.
- `README.md` carries a dated notice that the catalog is no longer maintained.

Two facts found along the way that would have needed fixing had the catalog
continued, recorded here so they are not lost: upstream Talivia published a
`v1.0.0` release on 2026-09-24 (commit `e7f7893`), so the repository's
statements that upstream has no tagged release are stale; and at the deployed
commit the application reports an installation identifier, website count and
tracked domains to `talivia.com` from each administrator session, which the
upstream README and privacy policy do not mention.
