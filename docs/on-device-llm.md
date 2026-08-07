# The on-device engine

Reference for DIA-96 — MediaPipe's LLM Inference Web API running Gemma 3 1B in
the browser, with no server behind it.

The engine only. Turning an interview into a prompt is DIA-99, getting the
weights onto the device is DIA-97, and the screen that does it with a progress
bar is DIA-98. What landed here is the part all three need: a backend that
starts, streams and closes, and an honest answer about whether this machine can
run it at all.

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

## Requirements, and how each one is detected

| Requirement | Missing means | Detected by |
|---|---|---|
| WebGPU API | `no-webgpu` — wrong browser, or a non-secure context | `navigator.gpu` |
| A GPU adapter | `no-gpu-adapter` — this machine, this driver | `requestAdapter()` returning null |
| WASM SIMD | `no-simd` | validating a probe module |
| The bundle on the device | `model-unavailable` | HEAD, plus a content-type check |

`'gpu' in navigator` is not a sufficient test and the development laptop is why:
Chrome exposes the object and then declines the adapter, because a Haswell
integrated GPU is on its blocklist. Only `requestAdapter()` tells the truth.
`--ignore-gpu-blocklist --enable-unsafe-webgpu --use-angle=vulkan` overrides it,
which is how the run above happened; nobody should ship those flags to a
candidate, and the app correctly reports `no-gpu-adapter` without them.

The bundle probe checks the content type as well as the status, and that is not
belt-and-braces: a static host with an SPA fallback answers a HEAD for a missing
528 MB file with `200 OK` and a page of HTML. Vite's preview server does it,
GitHub Pages would too, and trusting `response.ok` had the app reporting the
model as present on a machine that had never downloaded it.

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
