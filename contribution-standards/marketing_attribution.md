# Marketing Attribution

Tags: `#analytics #attribution #utm #marketing #dashboards`

## Rule: Treat attribution values as measurement contracts

Do not do this:

```text
https://cyclearena.io/play?utm_source=Reddit&utm_campaign=Cool Ad
https://cyclearena.io/play?utm_source=reddit&utm_campaign=test
https://cyclearena.io/play?utm_source=reddit&utm_campaign=test
```

Do this instead:

```text
https://cyclearena.io/play?utm_source=reddit&utm_medium=paid_social&utm_campaign=2026_06_reddit_acquisition_test_01&utm_content=clip_01
https://cyclearena.io/play?utm_source=reddit&utm_medium=paid_social&utm_campaign=2026_06_reddit_acquisition_test_01&utm_content=clip_02
https://cyclearena.io/play?utm_source=discord&utm_medium=community&utm_campaign=2026_06_armagetron_outreach_01&utm_content=server_post_01
```

Why:

- UTM values are dashboard dimensions. Inconsistent names make campaign results hard to compare.
- A campaign should be testable as a hypothesis, not just a traffic source.
- `utm_content` should distinguish creatives, placements, and copy variants.
- Attribution fields flow into PostHog as `first_touch_*`, `latest_touch_*`, and mirrored `$utm_*` fields.
- Production dashboards must be able to filter out staging, local, and QA traffic with `environment`.

## Naming

Use lowercase snake case for all UTM values:

```text
good: paid_social
bad: Paid Social
bad: paid-social
bad: paid social
```

Use these meanings:

- `utm_source`: platform, publisher, or origin, such as `reddit`, `tiktok`, `google`, `youtube`, `discord`, `newsletter`.
- `utm_medium`: acquisition mechanism, such as `paid_social`, `organic_social`, `community`, `search`, `creator`, `email`.
- `utm_campaign`: stable campaign identifier, usually `yyyy_mm_source_goal_test_nn`.
- `utm_content`: creative, placement, copy, or asset variant, such as `clip_01`, `text_02`, `sidebar_banner_01`.
- `utm_term`: keyword, audience, targeting group, or interest cluster when relevant.
- `ref`: partner, community, referral, or manual test code when useful.

Prefer campaign names like:

```text
2026_06_reddit_acquisition_test_01
2026_06_tiktok_clip_test_01
2026_06_discord_armagetron_outreach_01
```

Avoid:

```text
test
launch
summer
reddit
ad1
```

## First Touch And Latest Touch

Use `latest_touch_*` for active campaign optimization:

```text
latest_touch_utm_campaign
latest_touch_utm_source
latest_touch_utm_medium
```

Use `first_touch_*` for original acquisition and user-origin questions:

```text
first_touch_utm_campaign
first_touch_utm_source
first_touch_utm_medium
```

Do not mix first-touch and latest-touch attribution in the same chart unless the chart title explicitly says so.

PostHog's built-in UTM columns can be useful for scanning, but the source of truth is the explicit CycleArena fields:

```text
first_touch_utm_campaign
latest_touch_utm_campaign
environment
source
```

## Dashboard Filters

Every business dashboard must include:

```text
environment = production
```

Every QA dashboard must include:

```text
environment = staging
```

Use `source` to separate event producers when needed:

```text
source = client
source = next_api
source = nest
```

Use `credit_purchase_completed` as the source of truth for revenue. Client checkout events are intent signals, not fulfilled revenue.

Recommended campaign dashboard cuts:

```text
sum(revenue_usd) by latest_touch_utm_campaign
count(credit_purchase_completed) by latest_touch_utm_source
count(play_session_started) by latest_touch_utm_campaign
average(duration_ms) on play_session_ended by latest_touch_utm_source
```

## Campaign Process

Before launching an ad or marketing push, write down:

- Hypothesis: what audience, channel, or creative do we expect to work?
- Budget: how much spend or effort is allocated?
- Duration: when does the test start and stop?
- Primary metric: what decides success?
- Stop condition: what result means we do not continue?
- UTM URL: the exact link that will be used.

Keep tests narrow. Change one major variable at a time: channel, audience, creative, or landing path.

Before spending money, QA the link in staging or with a tiny production smoke test:

```text
utm_source=qa
utm_medium=test
utm_campaign=qa_attribution_smoke_yyyy_mm_dd
utm_content=manual_01
```

Confirm that the expected fields appear on:

```text
app_opened
enter_arena_clicked
join_game_succeeded
play_session_started
credit_purchase_completed
```

## Privacy

Never put PII in UTM parameters:

```text
bad: utm_content=user_email_example_com
bad: ref=supabase_user_id
bad: utm_term=real_person_name
```

Use campaign, creative, partner, and placement identifiers instead.

Review smells:

- A production dashboard has no `environment = production` filter.
- A revenue dashboard uses `stripe_checkout_started` instead of `credit_purchase_completed`.
- A campaign has multiple unrelated meanings under the same `utm_campaign`.
- Multiple creative variants share the same `utm_content`.
- Links use spaces, uppercase values, or inconsistent separators.
- A test changes campaign naming halfway through without creating a new campaign or content value.
- A report uses PostHog's visible UTM column but ignores `latest_touch_utm_campaign`.
