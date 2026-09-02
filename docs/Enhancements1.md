# Enhancements 1 - Answers, Confirmations, and Remaining Questions

## Status

This is the direct follow-up to `docs/Enhancements0.md`, answering your questions and recording
your decisions. Still a **planning document only** - no code changed. Once you confirm the two
items in section 5, the next document will be a real implementation plan.

---

## 0. Your note about the XYZ template - confirmed already satisfied

> "I hope the current template supports backend APIs but we just made that decision in the past
> that its gonna be fully deterministic/static... I hope the template and all the XYZ specific
> repo info will remain the same. I don't want to go against the XYZ structure."

Confirmed, and this was already the design in `Enhancements0.md` section 4-5: the plan does
**not** touch `app/server.mjs`, `docker/`, `deployment/`, `docker-bake.hcl`, or
`app/vite.config.ts`'s proxy - all XYZ-owned infra stays exactly as-is. The only new thing is a
**second, separate XYZ service** (its own deployment, its own secrets) that this frontend talks
to through the `/_api` proxy that already exists and was simply unused until now. Nothing about
"going against the XYZ structure" is required - this is literally the structure's own intended
extension point (per `AGENTS.md`).

## 1. Decision confirmed: determinism is deliberately superseded

Confirmed. The deterministic `prdGen`/`trsGen`/`uxGen` template generators are being superseded by
LLM-based generation as the primary path. One thing needs your explicit call before I plan the
implementation (not asking you to re-decide #1 - just to finish it):

**Do the deterministic generators get deleted outright, or kept internally as a silent fallback
if the LLM call fails/times out/is rate-limited?** I recommend keeping them internally (not as a
user-facing "mode" toggle - you're moving away from that model - just as the thing that runs if
the LLM request errors, so a flaky network/provider doesn't mean the user gets nothing). This is
a reliability decision, not a product-surface one. Confirm in section 5.

## 2. OpenRouter free tier + data-training filtering - researched, answer below

**Yes, the filter mechanism is real and it stacks with free models.** OpenRouter's request-level
`provider.data_collection` field (`"deny"` excludes any provider that stores/trains on your data)
and `provider.zdr` field (restricts to Zero-Data-Retention endpoints only) both work regardless of
whether you're calling a `:free`-suffixed model or a paid one. Setting `data_collection: "deny"`
on every request is a real, enforceable technical control - if no compliant provider is available
for that request, OpenRouter returns an error instead of silently routing to a training provider.
This should be set on every request regardless of which model you pick, as a standing safety net.

**The honest caveat, found while checking this:** many individual `:free` models' own listings
explicitly state their prompts/outputs *may* be retained/used for training as the stated cost of
being free (this varies model-by-model, not universally). So "free" and "strictly no training" are
not automatically the same set - you have to check each candidate free model's own data-policy tag
on its OpenRouter model page, and/or rely on `data_collection: "deny"` to enforce it and simply
accept fewer/no candidates if none qualify for a given request. I did not find a way to guarantee
in advance that a specific free, open-weight model will always have a compliant free-tier provider
- this needs a quick check against the live model list at implementation time, not something I can
promise today given how frequently the free-model catalog rotates (I observed models with
different capabilities and dates as recently as `Aug 2026` during this research).

## 2a. Platform comparison - researched properly, not assumed

You asked me to check other platforms honestly rather than assume. Here is exactly what each
platform's own current pricing/docs pages say (all fetched live for this document; anything I
could not confirm is marked as such, not guessed):

| Platform | Is there a genuinely free, recurring tier? | Evidence | Verdict |
| --- | --- | --- | --- |
| **OpenRouter** | **Yes.** `:free`-suffixed models, no payment method required to start. Documented rate limit: 50 requests/day account-wide if you've never purchased credits, rising to 1000/day after a one-time purchase of ≥10 credits (~$10) | OpenRouter's own FAQ page, fetched directly | **Confirmed usable now** |
| **Cerebras** | **No.** Their "Free Trial" is `$5 in credits that expire 30 days after being granted` - explicitly *not* an auto-renewing free tier ("Cerebras doesn't currently offer a no-cost tier that renews automatically"). Also only hosts 2 models on shared public endpoints (`gpt-oss-120b`, `gemma-4-31b`), with very low free-trial limits (5 requests/min, 30K tokens/min) | Cerebras's own rate-limits and pricing docs, fetched directly | **Disqualified** - time-bounded trial, not an ongoing free tier |
| **SambaNova Cloud** | **No.** Their own "Free" plan tile literally says "Add a payment method and purchase credits to run your first requests" - it requires payment info and purchased credits before any request works at all | SambaNova's own plans page, fetched directly | **Disqualified** - not actually free-to-start |
| **Together.ai** | **Unclear/likely no.** Their current docs describe only dynamic, usage-based rate limits with no published no-cost allowance on the page I could access | Together.ai's own rate-limits docs, fetched directly | **Not confirmed as free** - would need to verify at their signup flow directly, not assumed here |
| **Hugging Face Inference Providers** | **Technically yes, but trivial.** Free (non-PRO) accounts get **$0.10/month** in credits, explicitly "subject to change." That's roughly one or two real generation calls, not a usable allowance for actual PRD/TRS/UX generation traffic | Hugging Face's own pricing/billing docs, fetched directly | **Disqualified as a primary option** - the free amount is too small to be a real tier; their own data-privacy page also failed to load for me, so their training policy is unverified here |
| **Groq** | **Could not verify in this session.** Groq's rate-limit and Data Processing Addendum pages are blocked from automated fetching (`ERR_BLOCKED_BY_CSP`) - I am not going to state a rate limit or training policy for Groq because I could not read their current terms directly, and I won't rely on possibly-outdated general knowledge for a decision this important | Attempted direct fetch of `console.groq.com/docs/rate-limits` and the Customer DPA; both blocked | **Unverified** - if you want Groq considered, someone needs to open those pages manually (they may require a logged-in session) and report back what they say |

**Conclusion: OpenRouter is not just "the one I researched first" - it is the only option in this
comparison that is confirmed, from each platform's own current documentation, to be both genuinely
free-to-start and to offer an explicit, request-level, enforceable no-training control.** Every
other "free" alternative either turned out to require payment details up front, to be a
time-limited trial rather than a real tier, to offer a functionally negligible free allowance, or
could not be checked at all. This isn't a preference - it's what their own pages say today.

**My recommendation stands, now on stronger evidence:** build against OpenRouter, with
`data_collection: "deny"` set on every request as described above.

## 3. Model choice - full analysis, not a guess

I looked for a specific, currently-live, free, chat/instruct-capable, strictly-open-source model
slug on OpenRouter to name here, and I want to be precise about what I actually confirmed versus
what I did not:

**What I directly observed** on OpenRouter's own free-models listing
(`openrouter.ai/models?max_price=0`) during this session: the visible free-tier catalog at the
time included mostly image/video/audio models, a reranker, a couple of small embedding models
(LiquidAI - whose own listing explicitly says prompts/outputs may be used to train Liquid's
models, which fails your "no training" requirement), and one open-weight MoE chat model
(`dots-studio/dots-3-note-preview:free`) explicitly labeled "going away September 30, 2026" - i.e.
a temporary listing, not something to build a stable feature on. **I did not see a Qwen3 or
DeepSeek chat/instruct model on the free list in the specific results this session's fetch
returned.** The free-model catalog is a live, frequently-rotating listing (confirmed by the dated
entries I saw), and my fetch only captured one page of it - a Qwen or DeepSeek free variant may
exist further down the list or appear/disappear day to day. I am not going to claim a specific
model slug is available right now when I only have partial, time-stamped evidence - that would be
exactly the kind of assumption you asked me not to make.

**The honest, implementable answer:** don't hardcode a model slug in the plan at all. Instead,
the implementation should select a model at request time (or at deploy-time config, refreshed
periodically) using this rule, in priority order:

1. Query `GET https://openrouter.ai/api/v1/models` (or check `openrouter.ai/models?max_price=0`)
   for models with a `:free` variant.
2. Filter to models whose underlying license is genuinely open-source (Apache 2.0 or MIT-class) -
   in practice this currently favors the **Qwen** and **DeepSeek** model families over Meta's
   Llama (community license, not OSI-approved) or Google's Gemma (custom license) when multiple
   candidates are available. Prefer whichever specific Qwen or DeepSeek chat/instruct model
   currently has a `:free` variant at implementation time.
3. Confirm the chosen model/endpoint supports `response_format: {type: "json_schema"}` (check
   `supported_parameters` on the model's OpenRouter page) - this is required for section 6's
   schema-constrained generation approach.
4. Set `data_collection: "deny"` on every request regardless of which model passed the above
   filters, as the enforced safety net.
5. If no model satisfies 1-3 at all (the free catalog is that volatile), the fallback is a paid
   OpenRouter model at the lowest available price for a still-open-source model (e.g. a
   low-cost Qwen or DeepSeek paid endpoint) rather than silently degrading to a closed-source
   model - this would need your explicit sign-off first, since it breaks the "free" requirement,
   and should not happen silently.

This is intentionally a *rule*, not a hardcoded slug, because I can only responsibly recommend
what I directly confirmed still exists, and the free catalog is confirmed (by direct observation)
to change over time. Whoever implements this should run step 1 themselves right before building
and record the exact slug chosen in the implementation plan at that time.


## 4. Deployment ownership - confirmed, no action needed from me

Confirmed: your manager generates the OAuth keys, you have admin access to update secrets, and
your frontend is already deployed and working in XYZ. This matches `AGENTS.md`'s documented
setup flow exactly (deploy the new API-category service -> get its slug -> create OAuth
credentials -> put all six variables in this frontend's Secrets). Nothing further needed from
this document.

## 5. Confirm these two things, then I'll write the implementation plan

1. **Fallback behavior** (from section 1): keep the deterministic generators as a silent
   reliability fallback if the LLM call fails, or remove them entirely? (My recommendation: keep
   them, invisible to the user unless the LLM path errors.)
2. **New service name**: any preference for what the new XYZ API service should be called (e.g.
   `specpilot-llm-api`), or should I just pick a reasonable name when writing the implementation
   plan?

Everything else from `Enhancements0.md`'s decision list is now settled:

| # | Topic | Settled as |
| --- | --- | --- |
| 1 | Determinism non-goal | Superseded - LLM is now the primary generation path |
| 2 | Provider | OpenRouter - the only platform in section 2a whose free tier and no-training controls I could directly confirm; `data_collection: "deny"` enforced on every request |
| 3 | Model | Not a fixed slug (section 3's platform evidence showed the free catalog rotates too fast to hardcode one) - selected at implementation time via the Qwen/DeepSeek-first, `:free`, schema-capable rule in section 3 |
| 4 | Ownership/secrets | Manager generates keys; you hold admin/secrets access; existing XYZ deployment untouched |
| 5 | Budget | Free tier only |
| 6 | Scope | Steps 0-4 only (mode/questionnaire -> gap analysis -> follow-ups -> generation). Review pass (step 5) and RAG are deferred, pending your manager |

Once you answer the two questions above, the next document will lay out the concrete
implementation plan (new service structure, `/_api` client, contract changes, prompt/schema
design, UI changes) - still planning, not code, per your original instruction, unless you tell me
to start building at that point.
