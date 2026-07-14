# Staynex AI desktop companion design QA

## Comparison target

- Source visual truth path: user-supplied conversation attachments showing Ask Gemini in Chrome in docked and floating states on a Staynex host dashboard. The attachments are conversation assets and do not have a workspace filesystem path.
- Supporting behavior source: Google Gemini in Chrome help documentation for dock/pop-out, new chat, and recent chat behavior.
- Implementation URL: `http://127.0.0.1:3010/`
- Implementation screenshots:
  - `artifacts/assistant-design-qa/desktop-docked.png`
  - `artifacts/assistant-design-qa/desktop-floating.png`
  - `artifacts/assistant-design-qa/desktop-expanded.png`
  - `artifacts/assistant-design-qa/desktop-history.png`
  - `artifacts/assistant-design-qa/desktop-floating-dragged.png`
  - `artifacts/assistant-design-qa/mobile-open.png`
  - `artifacts/assistant-design-qa/mobile-history.png`
- Desktop viewport: 1365 x 768, device scale factor 1.
- Mobile viewport: 390 x 844, device scale factor 1.
- Browser: Google Chrome, headless rendering through the Chrome DevTools Protocol.
- State: light theme; unauthenticated home route; empty assistant conversation. The source background is an authenticated host dashboard, so the comparison is limited to the globally mounted assistant shell and its effect on the surrounding workspace.

## Full-view comparison evidence

The source attachments and implementation renders were reviewed together in the same multimodal task context. The implementation preserves the source composition: a clean white right-side companion that reduces the workspace without blocking it, plus a rounded floating window over the page. Both use a compact utility toolbar, large greeting, suggestion pills, restrained supporting copy, and a bottom composer. The implementation intentionally retains Staynex purple tokens and product typography instead of copying Google branding.

The docked render leaves the primary page interactive and visible, and the floating render restores the full page width. The expanded render remains within the viewport after the second QA pass. Mobile uses a fullscreen sheet, with Chats and Close visible in the persistent header.

## Focused region comparison evidence

Separate crops were not needed because the original 1365 x 768 captures render the 420/440 px assistant at readable pixel density. The header controls, suggestion copy, safety copy, borders, radii, scrollbar, and composer were inspected at original resolution. Material icons from `react-icons/md` replace handwritten icon approximations and stay optically consistent across all controls.

## Fidelity surfaces

- Fonts and typography: hierarchy matches the source intent with a compact utility header, prominent two-line greeting, readable suggestion labels, and small supporting copy. Staynex font tokens are retained intentionally; wrapping is clean at 420 px, 440 px, 760 px, and 390 px.
- Spacing and layout rhythm: docked width is 420 px, compact floating width is 440 px, expanded width is up to 760 px, and the mobile panel fills the viewport. Header, content, and composer spacing remain distinct without unnecessary nested cards. Floating radii and shadow match the lightweight Chrome-companion treatment.
- Colors and visual tokens: white surfaces, subtle neutral borders, muted suggestion fills, and low-elevation shadow follow the source structure. Staynex primary purple replaces Gemini blue intentionally for product consistency and maintains readable contrast.
- Image quality and asset fidelity: the assistant needs no raster imagery. Existing Staynex brand artwork is reused; Material icons come from one icon family. No emoji, CSS drawings, placeholder avatars, handcrafted SVGs, or fake shared-tab assets were introduced.
- Copy and content: suggestions and capability copy are Staynex-specific. The UI does not claim current-tab sharing, payment authority, refund authority, or availability certainty that the backend does not have.
- Responsiveness and accessibility: Chrome measurements confirm Chats and Close are visible at desktop and mobile viewports. Buttons have accessible labels and focus rings. Escape closes history first, then the assistant.

## Findings

No actionable P0, P1, or P2 findings remain.

### Follow-up polish

- [P3] A signed-in host screenshot would allow a final whole-page density comparison against the supplied dashboard reference. This does not block the assistant comparison because the widget is mounted at the root layout and the host route is included in the successful production build.

## Comparison history

### Pass 1 - blocked

- [P2] Expanded floating panel left the viewport.
  - Evidence: the initial 1365 px capture placed a 760 px panel at x=845, producing a right edge at 1605 px and hiding toolbar/composer content.
  - Fix: extracted viewport-aware floating dimensions and clamped the panel position whenever it expands, resizes, restores from storage, or switches from docked to floating.
- [P2] Compact floating frame was clipped at the bottom.
  - Evidence: the initial 625 px panel started at y=88 in a 673 px content viewport, so the bottom edge and rounded corners were not visible.
  - Fix: capped compact height at 600 px and clamped both axes with a 16 px viewport inset.

### Pass 2 - passed

- Post-fix evidence: `desktop-floating.png` shows a complete 440 x 600 frame at x=861, y=72; `desktop-expanded.png` shows a complete 760 x 736 frame at x=589, y=16 in a 1365 x 768 viewport.
- Chrome interaction evidence: pop-out, drag, dock, expand/restore, close/reopen, history, and mobile history were exercised. No runtime console errors were recorded.
- Automated regression evidence: `floating panel stays fully on-screen when expanded` passes in `test/assistant-transport-ui.test.mjs`.

## Implementation checklist

- [x] Mount the assistant once at the application root.
- [x] Keep Chats and Close visible at desktop and mobile widths.
- [x] Support docked, floating, draggable, expanded, and restored states.
- [x] Keep floating geometry inside the viewport.
- [x] Preserve existing assistant transport, grounding, persistence, and safety behavior.
- [x] Verify focused tests, TypeScript, production build, Chrome interactions, and console output.

final result: passed
