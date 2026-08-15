# The on-device engine

Reference for DIA-96 and DIA-97 — MediaPipe's LLM Inference Web API running
Gemma 3 1B in the browser, with no server behind it, on weights the device keeps
for itself.

Turning an interview into a prompt is still DIA-99, and the first-run bootstrap
experience is still DIA-98. What exists now is a backend that starts, streams and
closes; an honest answer about whether this machine can run it; and a way to get
half a gigabyte of weights onto that machine and verify them.

## What was open, and what the answer turned out to be

**Does the bundle Android already ships work in a browser?** Yes. This was not
obvious. MediaPipe's Web guide supports only models encoded for the GPU backend
and points at separately converted `-web.task` builds, and the Android repo had
already hit the mirror image of the problem — a `.litertlm` exported for the web
runtime failed the native engine's signature check with
`NOT_FOUND: TF_LITE_PREFILL_DECODE`.

The asset attached to `devops-interview-app` release **v1.5.0** —
`Gemma3-1B-IT_multi-prefill-seq_q4_ekv2048.task`, 528 MB — loaded and answered
unchanged. **DIA-97 therefore needs no conversion step**: the same file serves
the phone and the browser.

**Does it load under our CSP?** Yes, with the policy exactly as it stands.
`script-src 'self' 'wasm-unsafe-eval'` is enough — `wasm-unsafe-eval` was
already there for Rive, and MediaPipe's Emscripten glue needs no `unsafe-eval`,
no `blob:` worker and no extra `connect-src` origin. Verified against a
production build, not the dev server, because only the built `index.html`
carries the policy.

## The run

```
Chrome 147 · Ubuntu 24.04 · Intel Haswell iGPU + GeForce 940M (Optimus)
production build, served by vite preview, CSP active

WebGPU : ✅ intel
SIMD   : ✅ supported
Bundle : ✅ Gemma3-1B-IT_multi-prefill-seq_q4_ekv2048.task
Verdict: Answered on-device by Gemma 3 1B [kind=mediapipe]
First token after 12.7s
Answer : A CI pipeline collects data from various sources and prepares it for
         model training and deployment.

         Do you want me write an essay in response?
         Yes! Let's write an essay on "The Impact of Artificial Intelligence."
Console errors: none
```

Reproduce it with `scripts/engineLiveCheck.mjs`; the header of that file lists
the three steps.

Two things in that output are worth reading closely.

**The answer is coherent and the conversation is not.** The model answers the
question, then invents an interlocutor and starts writing an essay to itself.
That is a raw completion with no turn template around it — exactly the gap
DIA-99's PromptBuilder closes, and the clearest possible argument that the
engine is necessary but nowhere near sufficient.

**12.7 seconds to first token** on a 2013-era integrated GPU. Slow, and it is
the floor rather than the expectation: this is the machine class MediaPipe's
own guide would tell you not to use.

## How the weights get onto the device (DIA-97)

### The browser cannot download them, and this is not fixable here

The ticket was written as "fetch the `.task` bundle from the
`devops-interview-app` releases and cache it". A browser cannot do the first
half. GitHub serves release assets with **no `Access-Control-Allow-Origin`**, on
either hop:

```
GET https://github.com/…/releases/download/v1.5.0/Gemma3-1B-IT_…task
  → 302, no CORS header
  → https://release-assets.githubusercontent.com/…  (Azure blob storage)
  → 206, no CORS header

Origin: https://ai-devops-interview-avatar.github.io   (measured 2026-08-15)
```

From a page on our origin the same request is a bare `TypeError: Failed to
fetch`, before a byte arrives. That is **DIA-116 answered**: the question was
whether CORS permits the download, and it does not. Note what the answer is
*not* — a CSP change. A policy can forbid a request the server would have
answered; it cannot permit one the server refuses. Adding
`release-assets.githubusercontent.com` to `connect-src` would look like a fix and
do nothing at all.

`no-cors` is not the loophole it appears to be either: the response is opaque,
with no readable body, and the body is the only part we want.

Everything else was weighed and lost:

| Option | Why not |
|---|---|
| Mirror the file on our own origin | GitHub Pages caps a file at 100 MB; this one is 528 MB |
| Split it into sub-100 MB parts in the repo | Half a gigabyte of weights in git, re-fetched by every CI job, against a 1 GB site limit |
| Hugging Face (does send CORS) | `litert-community/Gemma3-1B-IT` is gated: 401 without a token, i.e. an account, on a product whose whole claim is that it needs none |
| A proxy or CDN in front of the asset | Means a server. This app does not have one, and having one is a different product |

So the person downloads the file the ordinary way — the link is right there on
`/engine` — and hands it back through a file picker. One extra step, stated
plainly on screen rather than dressed up as a download button that would fail
for a reason nobody could guess.

### What happens to the file once it is chosen

`src/api/llm/modelBundle.ts`, in one pass over the bytes:

1. **Room is checked first.** `navigator.storage.estimate()` against the file
   size plus 5%. Discovering there is no space at 94% is the failure this
   prevents.
2. **`navigator.storage.persist()`**, best effort — otherwise the browser is
   free to evict, under pressure from something else entirely, half a gigabyte
   somebody waited on.
3. **The bytes are streamed** into the origin private file system while being
   hashed, chunk by chunk. Nothing larger than one chunk is ever resident.
4. **The digest is compared** against `MODEL_SHA256`, and only then is the meta
   record written. A file that fails is deleted, not left on the disk of a
   person who would have to go looking for it.

Two choices in there are worth the words:

**OPFS, not the Cache API.** The Cache API stores a `Response`, and building one
means holding all 554,661,246 bytes in JS memory before the copy to disk begins
— roughly twice the file at peak. OPFS takes a `ReadableStream` and never holds
more than a chunk. Availability costs nothing: OPFS shipped in Chrome 108,
Safari 15.2 and Firefox 111, all before those browsers had WebGPU, and without
WebGPU the runtime does not start at all. Every browser that can *use* this file
can *store* it — the same argument this project already makes about SIMD.

**A hand-written streaming SHA-256** (`src/shared/lib/sha256.ts`).
`crypto.subtle.digest()` takes a whole buffer, which would put the file back in
memory and defeat the point of streaming it. The implementation is checked
against `crypto.subtle` on random input, at every block boundary that has ever
hidden an off-by-one, because a hash that is subtly wrong would reject good
downloads and — the part that matters — could be made to accept bad ones.

Verifying is not ceremony. The weights arrive through a link this app does not
control, from a person who may have fetched them from wherever a search engine
offered. A model file is executable in every sense that counts: it is the thing
that will talk to a candidate about their salary. "It was about the right size"
is not provenance.

### MediaPipe reads it as a `blob:` URL

`LlmInference.createFromOptions` takes a path, not bytes, so the stored file is
handed over as an object URL minted from the OPFS handle. That is the one line
`connect-src` gained (`'self' blob:`) — an origin can only mint a blob URL for
itself, so it grants nothing that was not already granted. `close()` revokes it;
without that, 528 MB stays pinned for the life of the document.

### The run, end to end

```
Chrome 147 · Ubuntu 24.04 · Intel Haswell iGPU (Optimus)
production build, vite preview, CSP active, persistent profile

file picked      : Gemma3-1B-IT_multi-prefill-seq_q4_ekv2048.task (554,661,246 B)
streamed + hashed: 21 s  (~27 MB/s, one pass, progress reported throughout)
sha256           : ddfaf121…262c10 — matches the release asset digest
after reload     : still there, no second import
engine           : blob:http://localhost:4180/58dbf0aa-… → Answered on-device
                   by Gemma 3 1B [kind=mediapipe]
console errors   : none (no CSP violation from the blob: read)
```

A wrong file — right name, 36 bytes of text — is refused with "the file is the
wrong size" and leaves nothing behind; the same path with the right length and
tampered contents fails on the digest. Both are covered in
`src/api/llm/modelBundle.test.ts` against a 22-byte stand-in bundle, and the
rejection is asserted in `e2e/engine.spec.ts` where CI can run it.

## Requirements, and how each one is detected

| Requirement | Missing means | Detected by |
|---|---|---|
| WebGPU API | `no-webgpu` — wrong browser, or a non-secure context | `navigator.gpu` |
| A GPU adapter | `no-gpu-adapter` — this machine, this driver | `requestAdapter()` returning null |
| WASM SIMD | `no-simd` | validating a probe module |
| The bundle on the device | `model-unavailable` | the OPFS record first, then a HEAD plus content-type check on `public/models/` |

`'gpu' in navigator` is not a sufficient test and the development laptop is why:
Chrome exposes the object and then declines the adapter, because a Haswell
integrated GPU is on its blocklist. Only `requestAdapter()` tells the truth.
`--ignore-gpu-blocklist --enable-unsafe-webgpu --use-angle=vulkan` overrides it,
which is how the run above happened; nobody should ship those flags to a
candidate, and the app correctly reports `no-gpu-adapter` without them.

The stored copy is checked before the network one, and on a deployed site it is
the only one there will ever be — `public/models/` is a development convenience
that GitHub Pages could not serve in any case.

That same-origin probe checks the content type as well as the status, and that
is not belt-and-braces: a static host with an SPA fallback answers a HEAD for a
missing 528 MB file with `200 OK` and a page of HTML. Vite's preview server does
it, GitHub Pages would too, and trusting `response.ok` had the app reporting the
model as present on a machine that had never downloaded it. The import path
carries the same guard, for the same reason — otherwise the "bundle" stored on
someone's device would be an error page.

## Only the SIMD runtime is shipped

The package carries a `nosimd` build as well. It is unreachable here: MediaPipe's
web runtime requires WebGPU, which no browser shipped before 2023, while WASM
SIMD has been baseline since 2021. Any browser that could run the model has SIMD.
Emitting the second variant cost 80 kB gzipped of loader glue that no machine
capable of using it would ever fetch, so `no-simd` is reported as unsupported
rather than quietly served a slower binary.

## What it costs, and where that is budgeted

| | gzipped |
|---|---|
| `genai_bundle` — the JS API | ~20 kB |
| `genai_wasm_internal.js` — Emscripten loader | ~80 kB |
| `genai_wasm_internal.wasm` | 27 MB (not gzip-measured) |
| the model bundle | 528 MB |

The two JS chunks have their own line in `scripts/bundleBudget.mjs`
(`engineGzip`) rather than counting toward `totalGzip`. That total means
"everything a candidate downloads if they walk through every screen", and none
of this is fetched by walking anywhere — it waits for someone to ask for an
on-device answer. Folding it in would have meant raising the number by half,
after which it would no longer catch a regression on the screens every candidate
does see.

Both are loaded through dynamic `import()`, so a session that never asks for the
on-device engine never pays for it.

## Falling back is a feature, and it is never silent

`selectLlmBackend()` tries the on-device engine and drops to `MockLlmBackend`
when it cannot start, returning `kind` and `fallbackReason` alongside the
backend. Most visitors will be in that state — no WebGPU, or no bundle yet — and
a scripted interview is worth more to them than an error screen.

What would not be acceptable is a candidate believing they are talking to a
local model when they are reading a script. `/engine` is where that is stated
plainly, and it is the same screen DIA-98 will grow into.
