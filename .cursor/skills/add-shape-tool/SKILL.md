---
name: add-shape-tool
description: Adds a new Excalidraw polygon-like shape tool such as hexagon as a first-class tool and element. Use when implementing new shape tools, polygon tools, toolbar shape entries, canvas element types, bindable shape geometry, restore/export support, or when the user asks to add a shape to the toolbar.
---

# Add Shape Tool

## Default Fast Path

For the default hexagon tool, do not manually edit files from prose instructions and do not launch subagents. The implementation is known and deterministic.

Run from the repository root:

```bash
node .cursor/skills/add-shape-tool/scripts/apply-hexagon-tool.mjs
yarn test:typecheck
```

If the script says hexagon is already implemented, stop and summarize. Do not re-apply edits.

If `git apply` reports an anchor conflict, inspect only the file named in the error, repair that anchor manually, then run:

```bash
yarn test:typecheck
```

Do not run broad tests, snapshots, or unrelated verification unless the user explicitly asks.

## Hexagon Defaults

- `shapeId`: `hexagon`
- `ShapePascal`: `Hexagon`
- `ElementType`: `ExcalidrawHexagonElement`
- Icon: `HexagonIcon`
- Shortcut: `KEYS.G`
- `numericKey`: `null`
- Fillable: yes
- Bindable: yes
- Bound text container: yes
- Flowchart node: yes
- Rounded corners: no
- Desktop toolbar: yes
- Mobile toolbar: yes

## Script Scope

The fast-path script applies the complete hexagon implementation patch across the known files:

```text
packages/common/src/constants.ts
packages/excalidraw/types.ts
packages/element/src/types.ts
packages/excalidraw/scene/types.ts
packages/excalidraw/components/icons.tsx
packages/excalidraw/components/shapes.tsx
packages/excalidraw/components/Actions.tsx
packages/excalidraw/components/MobileToolBar.tsx
packages/excalidraw/components/HelpDialog.tsx
packages/excalidraw/components/ConvertElementTypePopup.tsx
packages/excalidraw/locales/en.json
packages/element/src/bounds.ts
packages/element/src/utils.ts
packages/utils/src/shape.ts
packages/element/src/shape.ts
packages/element/src/renderElement.ts
packages/excalidraw/renderer/staticSvgScene.ts
packages/excalidraw/renderer/interactiveScene.ts
packages/element/src/collision.ts
packages/element/src/distance.ts
packages/element/src/typeChecks.ts
packages/element/src/comparisons.ts
packages/element/src/binding.ts
packages/element/src/textElement.ts
packages/element/src/transform.ts
packages/excalidraw/snapping.ts
packages/excalidraw/data/restore.ts
packages/excalidraw/components/App.tsx
packages/excalidraw/tests/helpers/api.ts
```

`KEYS.G` already exists in `packages/common/src/keys.ts`; do not edit `keys.ts` for hexagon.

## Non-Hexagon Shapes

If the user asks for a different shape, do not use the hexagon patch directly. Use the existing hexagon implementation as the reference pattern and keep the same scope discipline:

- Add the new element type and tool type.
- Add toolbar, mobile toolbar, help dialog, locale, and convert-type support.
- Add geometry, rendering, collision, distance, binding, text, snapping, restore, and app creation handling.
- Run `yarn test:typecheck`.

Avoid reusable polygon frameworks unless the user explicitly requests one.

## Stop

After the script and typecheck succeed, stop. Tell the user to hard refresh the dev server and use the new Hexagon tool or press `G`.
