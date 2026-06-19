---
name: draggable-top-toolbar
description: Adds a movable Excalidraw desktop top toolbar/top nav bar. Use when making the Excalidraw top toolbar, shapes toolbar, main toolbar, or top nav draggable, repositionable, or movable around the canvas.
---

# Draggable Top Toolbar

## Execute Directly

Trust this recipe and implement it directly. Do not spend time exploring alternative approaches. Do not add tests, snapshots, persistence, reset controls, keyboard movement, or mobile toolbar changes unless the user explicitly asks.

This feature is exactly two files:

- `packages/excalidraw/components/LayerUI.tsx`
- `packages/excalidraw/components/Toolbar.scss`

Do not edit `LayerUI.scss`, `Actions.tsx`, `Island.tsx`, `Stack.tsx`, mobile toolbar files, scene data, `appState`, or localStorage.

The final behavior: desktop top shapes toolbar gets a visible three-dot grip as the first item in the toolbar row. Dragging the grip moves the whole `.App-toolbar-container`, including the collaboration laser button if present. Dragging shape/tool buttons does nothing special. Position is local React state only and resets on reload.

## 1. `LayerUI.tsx`: Add Helpers

Find this exact anchor near the imports and type imports:

```ts
import type {
  AppProps,
  AppState,
  ExcalidrawProps,
  BinaryFiles,
  UIAppState,
  AppClassProperties,
} from "../types";

interface LayerUIProps {
```

Replace it with:

```ts
import type {
  AppProps,
  AppState,
  ExcalidrawProps,
  BinaryFiles,
  UIAppState,
  AppClassProperties,
} from "../types";

const TOOLBAR_DRAG_HANDLE_LABEL = "Drag toolbar";

const clamp = (value: number, min: number, max: number) => {
  if (min > max) {
    return (min + max) / 2;
  }

  return Math.min(Math.max(value, min), max);
};

interface LayerUIProps {
```

## 2. `LayerUI.tsx`: Add Local Drag State And Handlers

Find this exact line inside `const LayerUI = (...) => {`:

```ts
const [eyeDropperState, setEyeDropperState] = useAtom(activeEyeDropperAtom);
```

Immediately after it, add this exact block:

```ts
const toolbarContainerRef = React.useRef<HTMLDivElement | null>(null);
const toolbarOffsetRef = React.useRef({ x: 0, y: 0 });
const toolbarDragStateRef = React.useRef<{
  pointerId: number;
  startClientX: number;
  startClientY: number;
  startOffsetX: number;
  startOffsetY: number;
} | null>(null);
const [toolbarOffset, setToolbarOffset] = React.useState({ x: 0, y: 0 });
const [isToolbarDragging, setIsToolbarDragging] = React.useState(false);

const clampToolbarOffset = React.useCallback(
  (nextOffset: { x: number; y: number }) => {
    const toolbarContainer = toolbarContainerRef.current;

    if (!toolbarContainer) {
      return nextOffset;
    }

    const canvasRect = canvas.getBoundingClientRect();
    const toolbarRect = toolbarContainer.getBoundingClientRect();
    const currentOffset = toolbarOffsetRef.current;

    const minX = currentOffset.x + canvasRect.left - toolbarRect.left;
    const maxX = currentOffset.x + canvasRect.right - toolbarRect.right;
    const minY = currentOffset.y + canvasRect.top - toolbarRect.top;
    const maxY = currentOffset.y + canvasRect.bottom - toolbarRect.bottom;

    return {
      x: clamp(nextOffset.x, minX, maxX),
      y: clamp(nextOffset.y, minY, maxY),
    };
  },
  [canvas],
);

const updateToolbarOffset = React.useCallback(
  (nextOffset: { x: number; y: number }) => {
    const clampedOffset = clampToolbarOffset(nextOffset);
    const currentOffset = toolbarOffsetRef.current;

    if (
      currentOffset.x === clampedOffset.x &&
      currentOffset.y === clampedOffset.y
    ) {
      return;
    }

    toolbarOffsetRef.current = clampedOffset;
    setToolbarOffset(clampedOffset);
  },
  [clampToolbarOffset],
);

const handleToolbarDragPointerDown = React.useCallback(
  (event: React.PointerEvent<HTMLButtonElement>) => {
    if (
      appState.zenModeEnabled ||
      (event.button !== 0 && event.pointerType !== "touch")
    ) {
      return;
    }

    event.preventDefault();
    event.stopPropagation();

    const currentOffset = toolbarOffsetRef.current;
    toolbarDragStateRef.current = {
      pointerId: event.pointerId,
      startClientX: event.clientX,
      startClientY: event.clientY,
      startOffsetX: currentOffset.x,
      startOffsetY: currentOffset.y,
    };

    if (event.currentTarget.setPointerCapture) {
      event.currentTarget.setPointerCapture(event.pointerId);
    }
    setIsToolbarDragging(true);
  },
  [appState.zenModeEnabled],
);

const handleToolbarDragPointerMove = React.useCallback(
  (event: React.PointerEvent<HTMLButtonElement>) => {
    const dragState = toolbarDragStateRef.current;

    if (!dragState || dragState.pointerId !== event.pointerId) {
      return;
    }

    event.preventDefault();
    event.stopPropagation();

    updateToolbarOffset({
      x: dragState.startOffsetX + event.clientX - dragState.startClientX,
      y: dragState.startOffsetY + event.clientY - dragState.startClientY,
    });
  },
  [updateToolbarOffset],
);

const handleToolbarDragPointerEnd = React.useCallback(
  (event: React.PointerEvent<HTMLButtonElement>) => {
    const dragState = toolbarDragStateRef.current;

    if (!dragState || dragState.pointerId !== event.pointerId) {
      return;
    }

    event.preventDefault();
    event.stopPropagation();

    toolbarDragStateRef.current = null;
    setIsToolbarDragging(false);

    if (
      event.currentTarget.hasPointerCapture?.(event.pointerId) &&
      event.currentTarget.releasePointerCapture
    ) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
  },
  [],
);

React.useEffect(() => {
  updateToolbarOffset(toolbarOffsetRef.current);
}, [
  appState.height,
  appState.openSidebar,
  appState.width,
  appState.zenModeEnabled,
  editorInterface.canFitSidebar,
  isCompactStylesPanel,
  updateToolbarOffset,
]);
```

## 3. `LayerUI.tsx`: Replace Toolbar JSX

In `renderFixedSideContainer()`, find the `Section` with `className="shapes-section"`, then find this exact toolbar block:

```tsx
                      <Stack.Row
                        gap={spacing.toolbarRowGap}
                        className={clsx("App-toolbar-container", {
                          "zen-mode": appState.zenModeEnabled,
                        })}
                      >
                        <Island
                          padding={spacing.islandPadding}
                          className={clsx("App-toolbar", {
                            "zen-mode": appState.zenModeEnabled,
                            "App-toolbar--compact": isCompactStylesPanel,
                          })}
                        >
                          <HintViewer
                            appState={appState}
                            isMobile={editorInterface.formFactor === "phone"}
                            editorInterface={editorInterface}
                            app={app}
                          />
                          {heading}
                          <Stack.Row gap={spacing.toolbarInnerRowGap}>
                            <PenModeButton
```

Replace it with this exact block:

```tsx
                      <Stack.Row
                        ref={toolbarContainerRef}
                        gap={spacing.toolbarRowGap}
                        className={clsx("App-toolbar-container", {
                          "zen-mode": appState.zenModeEnabled,
                          "App-toolbar-container--dragging": isToolbarDragging,
                        })}
                        style={{
                          transform: `translate(${toolbarOffset.x}px, ${toolbarOffset.y}px)`,
                        }}
                      >
                        <Island
                          padding={spacing.islandPadding}
                          className={clsx("App-toolbar", {
                            "zen-mode": appState.zenModeEnabled,
                            "App-toolbar--compact": isCompactStylesPanel,
                          })}
                        >
                          <HintViewer
                            appState={appState}
                            isMobile={editorInterface.formFactor === "phone"}
                            editorInterface={editorInterface}
                            app={app}
                          />
                          {heading}
                          <Stack.Row
                            className="App-toolbar__content"
                            gap={spacing.toolbarInnerRowGap}
                          >
                            <button
                              type="button"
                              className="App-toolbar__drag-handle"
                              aria-label={TOOLBAR_DRAG_HANDLE_LABEL}
                              title={TOOLBAR_DRAG_HANDLE_LABEL}
                              tabIndex={-1}
                              disabled={appState.zenModeEnabled}
                              onPointerDown={handleToolbarDragPointerDown}
                              onPointerMove={handleToolbarDragPointerMove}
                              onPointerUp={handleToolbarDragPointerEnd}
                              onPointerCancel={handleToolbarDragPointerEnd}
                            />
                            <PenModeButton
```

Do not move the collaboration laser `Island`; it remains after the toolbar `Island` as a sibling inside `.App-toolbar-container`.

## 4. `Toolbar.scss`: Add Styles

Open `packages/excalidraw/components/Toolbar.scss`.

Find this exact beginning:

```scss
@use "../css/variables.module" as *;

.excalidraw {
  .App-toolbar {
```

Replace it with:

```scss
@use "../css/variables.module" as *;

.excalidraw {
  .App-toolbar-container {
    will-change: transform;

    &--dragging {
      .App-toolbar__drag-handle {
        cursor: grabbing;
      }
    }
  }

  .App-toolbar {
    &__content {
      align-items: center;
    }

    &__drag-handle {
      align-items: center;
      align-self: stretch;
      background: transparent;
      border: 0;
      border-radius: var(--border-radius-md);
      color: var(--icon-fill-color);
      cursor: grab;
      display: flex;
      flex-shrink: 0;
      justify-content: center;
      margin-inline-end: 0.125rem;
      min-height: 1.5rem;
      padding: 0;
      touch-action: none;
      user-select: none;
      width: 1rem;

      &::before {
        background: currentColor;
        border-radius: 2px;
        box-shadow: 3px 0 0 currentColor, 6px 0 0 currentColor;
        content: "";
        height: 1rem;
        opacity: 0.6;
        width: 2px;
      }

      &:hover,
      &:focus-visible {
        background: var(--button-hover-bg);

        &::before {
          opacity: 0.85;
        }
      }

      &:disabled {
        cursor: default;
        opacity: 0.35;
      }
    }
```

Leave the rest of `Toolbar.scss` unchanged.

## 5. Stop

Do not add tests. Do not run broad verification. Do not refactor. If the user asks whether it works, tell them to hard refresh the dev server page and drag the three-dot grip on the left side of the top shapes toolbar.

If an exact anchor is missing, do the smallest local read needed around the closest matching `LayerUI.tsx` toolbar block, then adapt only that insertion point. Do not broaden scope.
