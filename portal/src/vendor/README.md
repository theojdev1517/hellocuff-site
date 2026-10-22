# HEIF decoder provenance

Unmodified CSP-compatible pure-JavaScript libheif build from heic-to.

- Upstream: https://github.com/hoppergee/heic-to
- Pinned revision: `4045b8d7607e326c2b479cc424c7a60519b42dae`
- libheif1.23.6; libde2651.0.16; USE_UNSAFE_EVAL=0, USE_WASM=0.
- Decoder SHA256: `d6ad000a632567ef3b8ff13063fdaa0d6b9fa3a51f49f2e91aa15c994965ade8`
- License: LGPL3.0-or-later; see LICENSE.heic-to.txt and COPYING.GPL3.txt.
- Exact decoder/build source: https://raw.githubusercontent.com/hoppergee/heic-to/4045b8d7607e326c2b479cc424c7a60519b42dae/src/lib/libheif-without-unsafe-eval.js
- Build instructions: https://github.com/hoppergee/heic-to/tree/4045b8d7607e326c2b479cc424c7a60519b42dae
- Codec sources: https://github.com/strukturag/libheif/tree/v1.23.6 and https://github.com/strukturag/libde265/tree/v1.0.16

The library remains a separate replaceable lazy module. To rebuild/replace it, use the linked upstream no-eval build, preserve its export/API, replace libheif-no-eval.js, and run heif-codec.test.mjs plus font/HEIF browser tests. The adapter uses the exact pinned Emscripten wrapper's validated $$.ptr to call the unwrapped pixel-limit setter; it never hardcodes security-struct offsets. Upgrades require revisiting this boundary.

A same-origin dedicated worker is terminated after success/error/abort or20seconds. Native decoding is tried first. The fallback tightens the codec pixel-area limit before parsing, checks actual RGBA plane extents and applies container transformations once. Source cap32MiB and64MP remain; these and worker cancellation do not guarantee a hard browser-process memory ceiling. No source photo or decoder diagnostic is sent to a conversion service.
