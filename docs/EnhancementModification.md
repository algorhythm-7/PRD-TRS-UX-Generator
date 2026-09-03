# LLM Sourcing Options for Confidential PRD Generation — Analysis & Recommendation

Status: **Planning artifact only.** No code has been changed. This supersedes nothing yet — the
already-built OpenRouter integration (`app/server.mjs`, `app/vite.config.ts`,
`docs/EnhancementBuildPlan.md`) is still in place and working. This document exists to answer
"what else is possible" given a new concern, and to recommend a direction before any
implementation work starts.

## 1. Why this document exists

New concern raised (paraphrased): even with OpenRouter's privacy toggles set correctly (Data
Training off, Zero Data Retention on — see the settings review earlier in this session), a senior
developer flagged that **OpenRouter is still a third-party intermediary that a PRD's confidential
content passes through**, and that for company-confidential requirements documents, a stricter
posture may be warranted: keep inference **entirely inside the company's own infrastructure**, or
**entirely on a local machine with no network calls per-request**.

Two concrete directions were floated in the internal discussion (quoted/paraphrased from the
prompt):

- *"open source local (no wifi reqd) ... download offline ... shell script - run in pc? - llms
  will be downloaded and app ... Install and 2 options: 1) Make available in CLI 2) File in
  project space"* — this describes what section 3 below calls the **Local App** path: a
  developer/PM runs a script once, it downloads open-weight model files to disk, and all
  inference thereafter happens on that machine with zero network calls.
- **Cluster** — an internal, VPC-only LLM gateway already documented for XYZ apps (`docs/XYZCluster.md`).

**Direct answer to "does downloading offline mean downloading the weights?"** — yes. "Download
offline" = fetch the model's weight files (typically a multi-GB `.gguf` file) once, store them on
disk, and run inference locally from then on with an inference engine like `llama.cpp`/Ollama.
After that initial download, no further network access is required to generate a document.

## 2. Is Cluster confirmed safe for confidential PRD content? — Short answer: not fully confirmed by the docs alone

I reviewed both documents you attached (`docs/XYZCluster.md` and the Nexa chat transcript about
integrating Cluster into a React+Node+Mantine+OAuth app). Here is what is and isn't confirmed:

**CONFIRMED, from `docs/XYZCluster.md` itself:**

- The connection goes through a **private VPC endpoint** — *"no public internet traffic is
  involved."* This is a real, meaningful security property: the request never leaves Org's
  own network to reach a third-party company (unlike OpenRouter, which by design proxies to
  external model providers like DeepSeek/Alibaba/Meta's hosting infra).
- **No API key required — access is controlled at the network level**, i.e. by virtue of your app
  running inside the XYZ/VPC boundary, not by a secret that could leak.
- It uses an internal self-signed certificate (`apps.services.Cluster.intra.chrysler.com` is an
  internal-only DNS name, not publicly resolvable) — consistent with "internal-only service."
- The example model shown is `mistral:7b` — if this reflects what's actually hosted, Mistral 7B is
  Apache-2.0 licensed (genuinely open-source), which would satisfy your "open source only"
  requirement. However, the docs also reference an ATLAS dashboard that lists **all** available
  models, and I cannot fetch `intra.chrysler.com` from here (it's inside your corporate network) —
  **you'd need to check that dashboard yourself** to confirm every model actually hosted there is
  open-source, since "genllm" as an application name suggests it may serve more than one model,
  not all necessarily open-weight.

**NOT stated anywhere in the docs you gave me (this is the gap):**

- Whether Cluster **logs or retains** prompts/completions on the server side, and for how long.
- Whether anything sent to Cluster is ever used to **fine-tune, evaluate, or improve** any model
  (internal or otherwise).
- Whether Cluster is **officially approved/certified for confidential business data** specifically
  (e.g., PRDs containing competitive product plans), versus being an internal experimentation
  sandbox that happens to be network-isolated.
- Who (which internal teams) has access to Cluster's own logs/observability, if any exist.

None of this is a criticism of Cluster — it's simply that the documentation you were given is an
**integration guide** (how to call it), not a **data-handling/compliance statement**. Network
isolation (VPC-only, no public internet) is a strong signal, but it answers "can outsiders see my
data in transit," not "does anything internal retain/use my data afterward."

**My answer to your direct question: yes, confirm with a XYZ platform developer or your
info-sec contact before sending PRD-confidential content to Cluster.** Specifically ask:
(1) does Cluster log/retain prompts or completions, and for how long; (2) is any logged data used
for any training/fine-tuning, internal or external; (3) is Cluster approved for
"confidential"-classified internal documents by your data-classification policy, not just general
internal tooling. If the answers are "no retention, no training, yes approved," Cluster becomes
the **strongest option available** (see the recommendation in section 6) — it would be network-
isolated *and* require none of the RAM/storage/Dockerfile changes that self-hosting a model
yourself would need.

## 3. Option group A — Local App (runs entirely on a developer's/PM's own machine)

This is the "shell script downloads weights, then runs offline" idea. The app's inference never
leaves the machine it runs on. Three concrete implementations, from simplest to most capable:

### A1. Ollama (recommended if you go this route)

- **What it is**: a standalone, MIT-licensed server (Go binary, not an npm package) with an
  OpenAI-compatible REST API on `localhost:11434`. Install via a one-line shell script
  (`curl -fsSL https://ollama.com/install.sh | sh` on macOS/Linux, or a native installer on
  Windows), then `ollama pull <model>` downloads weights once to `~/.ollama/models`.
- **How your app would use it**: your existing `app/src/api/llmClient.ts` pattern barely
  changes — instead of `fetch("/_api/generate")` hitting OpenRouter, a local dev-only proxy route
  would hit `http://localhost:11434/api/chat` instead. The npm package `ollama` (official JS
  client) exists if you'd rather not hand-rop the REST calls.
- **Distribution options, matching what your senior dev described:**
  1. **CLI-available**: each user installs Ollama once (their own machine, outside this repo),
     runs `ollama pull qwen2.5:7b-instruct` once, and the app's dev server / local build talks to
     `localhost:11434`. Nothing about the model lives in the repo.
  2. **File in project space**: a `scripts/setup-local-llm.sh` (or `.ps1` for Windows) checked
     into this repo that installs Ollama if missing and pulls the chosen model into a
     project-local directory. More reproducible across teammates, but the model weights
     themselves (multi-GB) should **never** be committed to git — only the script that fetches
     them should be checked in.
- **Pros**: mature, most widely supported local-LLM runtime today (179k+ GitHub stars, active
  daily development), trivial Docker story if you ever *do* want to containerize it later, huge
  model library (Qwen, DeepSeek, Llama, Gemma, Mistral, Phi all published as pre-quantized
  Ollama models), simple REST API almost identical in shape to what you already built for
  OpenRouter (`callOpenRouter` → could become `callOllama` with very little logic change).
- **Cons**: it's a separate process the user must have running (`ollama serve`, usually
  auto-started as a background service) — not something that ships inside your app's own
  container/binary. Not zero-install for the end user.

### A2. `node-llama-cpp` (npm package, no separate server process)

- **What it is**: MIT-licensed Node.js bindings directly around `llama.cpp`. `npm install
  node-llama-cpp` gives you prebuilt native binaries for macOS/Linux/Windows; if no prebuilt
  binary matches the platform, it automatically falls back to compiling from source with `cmake`
  (needs a C++ toolchain present).
- **Pros**: no separate server/process to manage — the model loads in-process inside your own
  Node code (`getLlama()` → `loadModel()` → `LlamaChatSession`). It also has a built-in
  `createGrammarForJsonSchema()` feature that can **force** the model's output to match a JSON
  schema at the token-generation level — this is arguably a better fit than OpenRouter's
  best-effort `response_format: json_schema` for your PRD/TRS/UX section-by-section generation
  contract, since it's a hard constraint, not a request hint.
- **Cons**: heavier to embed inside `server.mjs` specifically (native compiled bindings, not pure
  JS) — this matters if you ever wanted this to run **inside the XYZ-deployed container**
  (see option C below) rather than only on a local dev machine, because the current production
  Docker image is Alpine-based with no C/C++ build toolchain installed (confirmed by reading
  `docker/node20.11/Dockerfile` — the production stage only runs
  `npm install --no-package-lock express@4 http-proxy-middleware@3`, nothing else). Prebuilt
  binaries for `node-llama-cpp` are commonly built against glibc-based Linux, not Alpine's musl
  libc, so there's a real risk of falling back to a from-source build that would fail without
  additional Alpine packages (`cmake`, `g++`, `make`, `python3`) added to the Dockerfile.
  **This is a pure local-dev-machine fit, not a drop-in for the existing XYZ container as-is.**

### A3. Plain `llama.cpp` server binary (`llama-server`), app just proxies to `localhost`

- **What it is**: the upstream C++ project itself ships a small OpenAI-compatible HTTP server
  binary. You'd download a prebuilt release (or compile once) and run
  `llama-server -m model.gguf --port 8080`, then your app calls `http://localhost:8080/v1/chat/completions`
  exactly like OpenRouter's shape, but fully local.
- **Pros**: smallest, most minimal-dependency option; well documented; same "OpenAI-compatible"
  request shape you've already built the client code around, so almost no frontend/orchestration
  changes needed vs. what exists today for OpenRouter.
- **Cons**: least polished packaging/installer story of the three — you'd be writing more of the
  "download the right release for the right OS/CPU" shell-script logic yourself, vs. Ollama which
  already has a one-line installer.

### Which model to actually download (open-source license check)

| Model family | License | Genuinely open-source? | Notes |
|---|---|---|---|
| **Qwen2.5 / Qwen3 (7B–8B Instruct)** | Apache-2.0 | ✅ Yes | Best license fit; strong instruction-following; matches the Qwen-preference already established for the OpenRouter model list in `docs/EnhancementBuildPlan.md` §5 |
| **Microsoft Phi-4-mini** | MIT | ✅ Yes | Smaller footprint, strong benchmark-for-size, good fit if RAM is the binding constraint |
| **DeepSeek-R1-Distill-Qwen-7B** | MIT (distilled checkpoint) | ✅ Yes (Qwen-based distill) | Stronger step-by-step reasoning — potentially good for the gap-analysis/clarifying-questions step specifically |
| Meta Llama 3.1/3.2 (7B/8B) | Meta Llama Community License | ⚠️ Open-weight, not OSI open-source | Has an acceptable-use policy and a 700M-MAU commercial clause (Org is far under that threshold, so *usable*, but doesn't meet a strict "genuinely open source" bar) |
| Google Gemma 3/4 | Gemma Terms of Use | ⚠️ Open-weight, not OSI open-source | Same category of caveat as Llama above |

**Recommendation for this axis**: prefer **Qwen2.5/Qwen3-7B-or-8B-Instruct**, quantized to
`Q4_K_M` GGUF (fits comfortably in 4-6GB RAM per `docs/XYZRAMOptions.md`'s own table), as the
primary model — it's the same license family your OpenRouter plan already preferred, keeping the
"genuinely open source only" rule consistent across both paths.

### Local App — overall pros / cons

| | |
|---|---|
| **Pros** | Zero data leaves the machine, ever, for any reason — the strongest possible confidentiality posture. No OpenRouter account, no Cluster approval needed, no cloud dependency at all once weights are downloaded. |
| **Cons** | **This is the wrong distribution model for your actual end users.** You told me this app is for **product managers**, not developers. A PM would need to run a shell script, install a multi-GB model, and keep a local server process running just to use a web form — that's a significant support/onboarding burden for a non-technical audience, and it means every PM's laptop needs enough free RAM (4-8GB) and disk space, with no central place to fix issues once. It also means the app can no longer be "just visit the XYZ URL" — it becomes "also install this other thing locally," which undermines the reason you migrated to XYZ in the first place. |

## 4. Option group B — XYZ-deployed app, but self-hosting the model on the pod itself

This is "download the weights once, but store/run them on the XYZ-hosted container instead of
a developer's laptop" — keeping the single-URL, no-local-install experience for PMs, while still
avoiding any third-party API.

### What would have to change (all confirmed by reading this repo's actual files)

1. **Resources** ([deployment/ee/sbx/values.yaml](../deployment/ee/sbx/values.yaml),
   [deployment/ee/dev/values.yaml](../deployment/ee/dev/values.yaml)): currently
   `requests: {memory: 256Mi, cpu: 256m}` / `limits: {memory: 256Mi, cpu: 512m}`. Per
   `docs/XYZRAMOptions.md`'s own analysis, a 7-8B Q4-quantized model needs **6-9GB RAM** to run
   at all — this would need to rise to the platform's max (you mentioned XYZ offers up to 8GB),
   plus meaningfully more CPU, since there is no GPU option shown in the XYZ app settings you
   shared.
2. **Persistent storage** ([docs/XYZPersistentStorage.md](XYZPersistentStorage.md)): add a
   `persistence: {enabled: true, size: <a few GiB>, mountPath: /data/app/, storageClassName:
   efs-retain, accessMode: ReadWriteMany}` block. Without this, every pod restart/redeploy would
   silently re-download the multi-GB model file from scratch, which is slow and wasteful — this
   matches exactly the caveat already raised in `docs/XYZRAMOptions.md`.
3. **Dockerfile changes** ([docker/node20.11/Dockerfile](../docker/node20.11/Dockerfile)): the
   production stage is `node:20-alpine` and currently installs nothing but `express`/
   `http-proxy-middleware`. To self-host a model in-process, you'd need one of:
   - Add `node-llama-cpp` + the Alpine build toolchain (`apk add cmake g++ make python3`) so it
     can compile its native bindings, **or**
   - Switch the production base image away from Alpine to a glibc-based image (e.g.
     `node:20-slim`, Debian-based) so `node-llama-cpp`'s prebuilt binaries are more likely to
     match, **or**
   - Install the `ollama` binary itself into the image and have the entrypoint script
     (`docker/node20.11/docker-entrypoint.sh`) start `ollama serve` in the background before
     `exec node server.mjs` — this is a bigger image and a two-process container, which is a
     meaningful step away from this template's current "one lightweight Node process" design.

   **All three are real, non-trivial Dockerfile/infra changes** — this is different from the
   OpenRouter work done earlier this session, which deliberately required *zero* Dockerfile
   changes because it only ever made outbound HTTPS calls.
4. **Network egress, unconfirmed**: downloading a model file means reaching an external host
   (Hugging Face, Ollama's registry, etc.) from inside the XYZ cluster at least once. Given this
   same project already hit corporate-proxy/certificate friction for plain `npm install` earlier
   in this session, **it is not yet confirmed whether the XYZ cluster's network policy even
   allows outbound access to model-hosting registries** — this needs to be confirmed with a XYZ
   platform engineer before committing to this path. If egress is blocked, the only way to get
   weights onto the pod would be baking them directly into the Docker image at build time (adding
   several GB to the image, and requiring a rebuild any time you change models).
5. **CPU-only inference performance**: with no GPU, expect noticeably slower generation than
   OpenRouter/Cluster (which run on real inference infrastructure), and — per
   `docs/XYZRAMOptions.md`'s own prior analysis — noticeably lower output quality than a
   frontier hosted model for the kind of large-context, multi-section reasoning a PRD/TRS/UX
   generation task requires.

### XYZ-deployed self-hosted model — overall pros / cons

| | |
|---|---|
| **Pros** | Single URL for PMs (no local install) *and* no data ever leaves Org-controlled infrastructure (once egress for the one-time download is resolved). Reuses the persistence pattern this platform already documents. |
| **Cons** | The most implementation-heavy option of everything discussed (Dockerfile, resource limits, persistence, and a real open question about registry network egress, all needing changes/confirmation). Meaningfully slower and lower-quality output than either Cluster or OpenRouter, being CPU-only. Increases the container's resource footprint/cost continuously (8GB reserved RAM around the clock), vs. Cluster/OpenRouter which cost nothing when idle. |

## 5. Comparison across every option (including what's already built)

| Option | Data leaves company network? | Setup effort from here | Ongoing cost when idle | Output quality (for PRD-length reasoning) | Fits "genuinely open-source only" rule |
|---|---|---|---|---|---|
| **OpenRouter (already built this session)** | Yes — to a third-party provider, even with privacy toggles set | None (already done) | $0 (free models) | Good, varies by model | Yes, by design (`:free` + Qwen/DeepSeek preference) |
| **Cluster** | No — internal VPC only | Low, *if* approved (mostly wiring, similar shape to the OpenRouter client already built) | Unknown (ask platform team) | Unknown — depends which model(s) are actually hosted; ask | Unconfirmed — check the ATLAS model list |
| **Local App** (Ollama / node-llama-cpp / llama-server) | No — never leaves the user's machine | Medium (per-user install), but **poor fit for a PM audience** | $0, but shifts RAM/CPU burden onto each user's laptop | Lower than cloud/frontier models (7-8B class) | Yes, if you pick Qwen/Phi-4/DeepSeek-distill |
| **XYZ-deployed self-hosted model** | No — internal infra only, after one-time download | High (Dockerfile, resources, persistence, egress question) | High — 8GB reserved continuously | Lower than cloud/frontier models, and slower (CPU-only) | Yes, if you pick Qwen/Phi-4/DeepSeek-distill |
| **Deterministic fallback generator (already built, always present)** | Never leaves the browser/server at all — no LLM involved | None (already exists, this is the safety net for every option above) | $0 | Template-based, not LLM-quality, but 100% predictable/safe | N/A — no model involved |

## 6. Recommendation

1. **First, get the Cluster questions in section 2 answered by a XYZ platform developer /
   info-sec contact.** If Cluster turns out to log/train on data, or isn't approved for
   confidential documents, it's disqualified regardless of how convenient it is. If it's cleared,
   **Cluster is very likely your best option**: it needs no new Dockerfile changes, no persistent
   storage, no extra RAM reservation, keeps the single-URL PM experience, and — being purpose-built
   internal infrastructure — is likely to be maintained/updated by people whose job is exactly
   this, unlike a model you self-host and babysit.
2. **In parallel, do not rely on the OpenRouter path for actual confidential PRD content** until
   the above is resolved — keep the already-built integration in place (it's a good demonstration
   of the pattern and a fine fallback for non-sensitive test runs), but treat it as "not yet
   cleared for real confidential input" given the training concern raised.
3. **If Cluster is ruled out**, the **XYZ-deployed self-hosted model** (section 4) is the more
   appropriate next choice over the **Local App** path (section 3) specifically *because your
   users are product managers, not developers* — a shell-script/CLI install is a real adoption
   barrier for that audience. Budget for the Dockerfile/persistence/RAM work described in section
   4, and get the network-egress question answered before committing engineering time to it.
4. **The Local App path (section 3) is still worth keeping in your back pocket** as a fast way for
   *you* (as the developer) to prototype/evaluate model quality locally with Ollama before
   investing in the XYZ-deployed version — install Ollama, pull `qwen2.5:7b-instruct`, and
   manually try a few real (anonymized/non-confidential test) PRD prompts to sanity-check output
   quality before committing to a specific model for whichever path you end up building.
5. **Regardless of which path wins**, the deterministic fallback generator that already exists in
   this app (`app/src/generation/{prdGen,trsGen,uxGen}.ts`) should remain the safety net exactly as
   it's wired today — every option above should degrade to it on failure, the same pattern already
   proven with the OpenRouter integration.

## 7. Open questions to resolve before writing any more code

- [ ] Does Cluster log or retain prompts/completions, and for how long? (ask XYZ platform team)
- [ ] Is anything sent to Cluster ever used for training/fine-tuning, internal or external?
- [ ] Is Cluster formally approved for confidential/internal-restricted business documents, per
      Org's own data classification policy — not just general internal tooling use?
- [ ] What models are actually listed on the Cluster ATLAS dashboard today, and are they all
      genuinely open-source (or does that even matter if Cluster itself is the trust boundary,
      not the model license)?
- [ ] If self-hosting on XYZ: does the XYZ cluster's network policy allow outbound egress to
      Hugging Face / Ollama's model registry, even just for a one-time download?
- [ ] If self-hosting on XYZ: confirm the actual max RAM/CPU ceiling available (you mentioned
      "up to 8GB" — confirm the exact number and whether CPU scales with it).
