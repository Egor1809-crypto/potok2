# AI email constructor

The existing `/email-builder` is the editor and saved templates remain the source of truth. The new wizard replaces the old assistant entry point; it does not create a separate draft entity or raw-HTML editor.

## Pipeline

`POST /api/email-ai/generate` authenticates the workspace, parses a brief, calls the configured AI provider with the version 1.0 JSON schema, validates locally, checks factual numbers and links, resolves uploaded assets or generates visuals, maps the result to `EmailBuilderDocumentInput`, then reviews the final document. One automatic document repair is allowed for structure/facts. The invalid draft is supplied to repair so it can preserve the intended design. Editorial review downtime returns an explicit unavailable status while retaining deterministic checks and the draft.

- `types/email-ai.ts`: brief, semantic document, review and provenance types.
- `lib/email-ai/schema.ts`, `prompts.ts`, `facts.ts`: strict contracts and factual checks.
- `lib/server/email-ai-studio.ts`: provider orchestration, bounded repair and workspace asset resolution.
- `lib/email-ai/mapping.ts`: semantic blocks become normal editable builder blocks with stable IDs. Additional section headings are separately editable blocks with collision-free IDs.
- `lib/email-ai/render-variants.ts`: shared deterministic renderer for the canvas and final HTML compiler.

The AI JSON is transient. Template persistence stores normal builder blocks plus an optional brief/review/provenance record. Old templates still parse and render through their existing handlers.

## Editing, preview and delivery

`rewrite-block` updates only the selected block, preserving its ID and siblings. `rewrite` uses the current document; text-only commands retain manual spacing, typography and framing. Design/regeneration commands may change composition. Both changes use the existing history reducer, as do manual variants and subject/preheader edits. Undo and Redo restore the entire previous document.

`subject-variants` returns three subject/preheader pairs without regenerating the body. `review` can be rerun from the assistant. The preview modal calls the same HTML compiler as save/export, with desktop/mobile view, HTML source, copy and download. Output is a complete table-based document with escaped text and checked URLs. The footer uses the existing `{{UnsubscribeUrl}}` token. Uploaded and generated images are stored through the existing asset service; no invented image URLs are accepted.

`POST /api/email-ai/test-send` accepts one explicitly entered recipient and uses the workspace's configured UniSender integration. It does not launch a campaign. Provider acceptance is reported as acceptance, not a delivery guarantee. Test requests are never retried automatically. Preview/dev assets cannot be sent as localhost URLs.

## Runtime

No new secrets, database tables or migrations are required. Reuse `NAVYAI_API_KEY`, optional `NAVYAI_BASE_URL`, `NAVYAI_EMAIL_MODEL`, `NAVYAI_IMAGE_MODEL`, or the existing alternative `OPENAI_API_KEY`, `OPENAI_EMAIL_MODEL`. Keys remain server-side. D1 and R2 bindings remain `DB` and `MEDIA`. Real test delivery requires the existing configured UniSender key, confirmed sender and list ID.

Production media URLs must use HTTPS. Local `/api/assets/…` URLs are permitted only in a development build so local storage can be previewed. Production rendering never enables that exception.

## Validation and practical limits

`tests/email-ai-studio.test.mjs` exercises strict schema failures, safe links, numbers, uploaded/generated assets, all semantic types, content-preserving mapping, metadata persistence, HTML output, variants, bounded repair, review downtime, selected/full editing, independent subject variants, cancellation and shared Undo/Redo.

New semantic documents support up to 24 source blocks, up to 12 items per section and up to three generated visuals per request. Existing builder documents support up to 80 blocks. Imported raw HTML keeps its original import/export flow; AI block editing requires a block-based document. Complex designs still need a test in the recipient's email client because HTML/CSS support varies. Quality reviews are advisory, and users should verify campaign facts and links before sending.

## Art director and transparent ornaments (September 2026)

The score now comes only from versioned deterministic rules over the **final builder document**, after asset creation, mapping and preservation of manual styles. Eight visible criteria total 100 points; each failed criterion loses its displayed fixed weight once. Subject, preheader, configured primary action, contrast, minimum main-text size, horizontal padding, asset references/alt text and exact duplicate blocks are checked. This is a layout checklist, not an aesthetic/conversion rating. Client rendering, actual delivery and historical asset transparency are explicitly not verified. Review outages retain the measured checks.

The AI editor no longer supplies a score or triggers a redesign because of taste. It must cite an exact passage from an existing block (or subject/preheader) and propose a specific improvement. Unknown IDs and unsupported quotations are discarded. Reports include a content/brief fingerprint, persist with templates, are reused for an unchanged document and shown as stale after edits. Users can select the affected block or prepare an edit before applying it.

Ornaments use original AI-authored vector paths (bounded polylines, cubic curves and circles) and a Worker-compatible antialiased PNG rasterizer. The canvas begins with zero alpha; there is no solid background, preset motif substitution, SVG execution or colour-key removal. PNG bytes are validated for actual transparency, including holes within the artwork bounds, then transparent margins are trimmed. One bounded geometry repair is allowed. This avoids the configured image service returning JPEG with a painted checkerboard despite a transparency request. Photos retain the existing image service. Pattern rendering preserves proportions rather than cropping to a fixed height. Existing raster assets are not destructively changed; the selected pattern can be regenerated with «Пересоздать узор без фона».

New implementation: `lib/email-ai/review.ts`, `pattern-png.ts`, `pattern-vector.ts`, `lib/server/email-pattern-generation.ts`, `components/email-builder/EmailReviewReport.tsx`. Regression coverage is in `tests/email-art-director.test.mjs`, including actual PNG decoding using an independent library, invalid alpha/panel rejection, bounded retries, grounded comments, deterministic scoring, stale/persisted reports and unchanged-review reuse. No new dependencies, environment variables or migrations.
