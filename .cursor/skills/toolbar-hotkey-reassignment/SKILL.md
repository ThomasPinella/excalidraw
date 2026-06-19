---
name: toolbar-hotkey-reassignment
description: Adds right-click reassignment of numeric hotkeys for Excalidraw top toolbar tools. Use when implementing toolbar tool numeric key customization, right-click tool menus, or changing number-key assignments for shape tools.
---

# Toolbar Hotkey Reassignment

## Execute Directly

Trust this recipe and implement it directly. Do not launch subagents, redesign keyboard handling, add a settings screen, or touch unrelated toolbar behavior.

The final behavior: right-click any top toolbar tool that has a numeric shortcut, open a small menu of `1 2 3 4 5 6 7 8 9 0`, and choose a digit. The selected tool receives that digit and the previously assigned tool gets the selected tool's old digit. The assignment persists in browser app state, updates toolbar labels, updates command palette shortcuts, and changes number-key tool selection.

Edit exactly these files: `packages/excalidraw/types.ts`, `packages/excalidraw/appState.ts`, `packages/excalidraw/components/shapes.tsx`, `packages/excalidraw/components/ToolButton.tsx`, `packages/excalidraw/components/Actions.tsx`, `packages/excalidraw/components/Actions.scss`, `packages/excalidraw/components/CommandPalette/CommandPalette.tsx`, `packages/excalidraw/locales/en.json`, and `packages/excalidraw/tests/tool.test.tsx`.

Do not edit `App.tsx`, mobile toolbar files, context menu files, key constants, scene data, exports, or snapshots for this feature.

## 1. Add App State

In `packages/excalidraw/types.ts`, inside `interface AppState`, find:

```ts
preferredSelectionTool: {
  type: "selection" | "lasso";
  initialized: boolean;
}
```

Immediately after it, add:

```ts
  numericHotkeyAssignments: Record<string, string>;
```

In `packages/excalidraw/appState.ts`, inside `getDefaultAppState()`, find the `preferredSelectionTool` default and add this field immediately after it:

```ts
    numericHotkeyAssignments: {},
```

In the same file, inside `APP_STATE_STORAGE_CONF`, find:

```ts
  preferredSelectionTool: { browser: true, export: false, server: false },
```

Immediately after it, add:

```ts
  numericHotkeyAssignments: { browser: true, export: false, server: false },
```

## 2. Add Numeric Hotkey Helpers

In `packages/excalidraw/components/shapes.tsx`, replace:

```ts
import type { AppClassProperties } from "../types";
```

with:

```ts
import type { AppClassProperties, AppState } from "../types";
```

Find the end of `getToolbarTools()`:

```ts
export const getToolbarTools = (app: AppClassProperties) => {
  return app.state.preferredSelectionTool.type === "lasso"
    ? ([
        SHAPES[0],
        {
          ...SHAPES[1],
          value: "lasso",
        },
        ...SHAPES.slice(2),
      ] as const)
    : SHAPES;
};
```

Immediately after it, add:

```ts
const getDefaultNumericHotkeys = (): Record<string, string> => {
  const defaults: Record<string, string> = {};
  for (const shape of SHAPES) {
    if (shape.numericKey != null) {
      defaults[shape.value] = shape.numericKey.toString();
    }
  }
  return defaults;
};

export const getEffectiveNumericHotkeys = (
  state: Pick<AppState, "numericHotkeyAssignments">,
): { byTool: Record<string, string>; byKey: Record<string, string> } => {
  const byTool: Record<string, string> = {
    ...getDefaultNumericHotkeys(),
    ...(state.numericHotkeyAssignments ?? {}),
  };
  const byKey: Record<string, string> = {};
  for (const [toolValue, numericKey] of Object.entries(byTool)) {
    byKey[numericKey] = toolValue;
  }
  return { byTool, byKey };
};

export const swapNumericHotkey = (
  byTool: Record<string, string>,
  toolValue: string,
  targetKey: string,
): Record<string, string> => {
  const oldKey = byTool[toolValue];
  const otherTool = Object.keys(byTool).find(
    (value) => byTool[value] === targetKey,
  );
  const next = { ...byTool, [toolValue]: targetKey };
  if (otherTool && otherTool !== toolValue && oldKey != null) {
    next[otherTool] = oldKey;
  }
  return next;
};

export const getNumericHotkeyForTool = (
  byTool: Record<string, string>,
  toolValue: string,
): string | null => {
  // the lasso tool aliases the selection slot in the toolbar
  const lookupValue = toolValue === "lasso" ? "selection" : toolValue;
  return byTool[lookupValue] ?? null;
};
```

Then update `findShapeByKey()` so it starts by reading effective assignments and compares `key` against `getNumericHotkeyForTool()`:

```ts
export const findShapeByKey = (key: string, app: AppClassProperties) => {
  const { byTool } = getEffectiveNumericHotkeys(app.state);
  const shape = getToolbarTools(app).find((shape, index) => {
    const numericKey = getNumericHotkeyForTool(byTool, shape.value);
    return (
      (numericKey != null && key === numericKey) ||
      (shape.key &&
        (typeof shape.key === "string"
          ? shape.key === key
          : shape.key.includes(key)))
    );
  });
  return shape?.value || null;
};
```

If the local `findShapeByKey()` has extra logic after the `find()`, preserve it. Only replace the numeric-key comparison.

## 3. Allow Right-Click On ToolButton

In `packages/excalidraw/components/ToolButton.tsx`, add this prop to `ToolButtonBaseProps`:

```ts
  onContextMenu?(event: React.MouseEvent): void;
```

In the rendered `<button>`, add:

```tsx
          onContextMenu={props.onContextMenu}
```

In the rendered radio `<label>`, add:

```tsx
        onContextMenu={props.onContextMenu}
```

Do not change click, pointer, loading, or radio behavior.

## 4. Add Toolbar Menu

In `packages/excalidraw/components/Actions.tsx`, replace:

```ts
import { getToolbarTools } from "./shapes";
```

with:

```ts
import {
  SHAPES,
  getToolbarTools,
  getEffectiveNumericHotkeys,
  getNumericHotkeyForTool,
  swapNumericHotkey,
} from "./shapes";
import { Popover as HotkeyPopover } from "./Popover";
```

Inside `ShapesSwitcher`, immediately after:

```ts
const [isExtraToolsMenuOpen, setIsExtraToolsMenuOpen] = useState(false);
```

add:

```ts
const [hotkeyMenu, setHotkeyMenu] = useState<{
  toolValue: string;
  x: number;
  y: number;
} | null>(null);
```

Inside the `getToolbarTools(app).map(...)` callback, after `letter`, add:

```ts
const effectiveNumericKey = getNumericHotkeyForTool(
  getEffectiveNumericHotkeys(app.state).byTool,
  value,
);
```

Then change shortcut and label calculation to use the effective digit:

```ts
const shortcut = letter
  ? `${letter} ${t("helpDialog.or")} ${effectiveNumericKey}`
  : `${effectiveNumericKey}`;
const keybindingLabel =
  value === "hand" ? undefined : effectiveNumericKey || letter;
```

On the top toolbar `ToolButton`, add this prop before `onPointerDown`:

```tsx
              onContextMenu={
                effectiveNumericKey != null
                  ? (event) => {
                      event.preventDefault();
                      setAppState({ openMenu: null, openPopup: null });
                      setHotkeyMenu({
                        toolValue: value,
                        x: event.clientX + 4,
                        y: event.clientY + 4,
                      });
                    }
                  : undefined
              }
```

At the end of `ShapesSwitcher` JSX, immediately after `</DropdownMenu>`, add:

```tsx
{
  hotkeyMenu &&
    (() => {
      const { byKey } = getEffectiveNumericHotkeys(app.state);
      const digits = ["1", "2", "3", "4", "5", "6", "7", "8", "9", "0"];
      const currentKey = getNumericHotkeyForTool(
        getEffectiveNumericHotkeys(app.state).byTool,
        hotkeyMenu.toolValue,
      );
      return (
        <HotkeyPopover
          top={hotkeyMenu.y}
          left={hotkeyMenu.x}
          fitInViewport
          offsetLeft={0}
          offsetTop={0}
          viewportWidth={window.innerWidth}
          viewportHeight={window.innerHeight}
          onCloseRequest={() => setHotkeyMenu(null)}
          className="App-toolbar__hotkey-popover"
        >
          <div className="App-toolbar__hotkey-popover-title">
            {t("toolBar.reassignHotkey")}
          </div>
          <div className="App-toolbar__hotkey-popover-grid">
            {digits.map((digit) => {
              const assignedTool = byKey[digit];
              const assignedShape = SHAPES.find(
                (shape) => shape.value === assignedTool,
              );
              return (
                <button
                  key={digit}
                  type="button"
                  className={clsx("App-toolbar__hotkey-option", {
                    "App-toolbar__hotkey-option--current": digit === currentKey,
                  })}
                  title={
                    assignedShape
                      ? capitalizeString(t(`toolBar.${assignedShape.value}`))
                      : undefined
                  }
                  onClick={() => {
                    const nextByTool = swapNumericHotkey(
                      getEffectiveNumericHotkeys(app.state).byTool,
                      hotkeyMenu.toolValue,
                      digit,
                    );
                    setAppState({ numericHotkeyAssignments: nextByTool });
                    setHotkeyMenu(null);
                  }}
                >
                  <span className="App-toolbar__hotkey-option-digit">
                    {digit}
                  </span>
                  {assignedShape && (
                    <span className="App-toolbar__hotkey-option-icon">
                      {assignedShape.icon}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </HotkeyPopover>
      );
    })();
}
```

Keep this popover outside the mapped toolbar tools and outside the extra-tools dropdown content.

## 5. Add Styles

Append this to `packages/excalidraw/components/Actions.scss`:

```scss
.excalidraw {
  .popover.App-toolbar__hotkey-popover {
    position: fixed;
    padding: 0.75rem;
    background-color: var(--island-bg-color);
    border-radius: var(--border-radius-lg);
    box-shadow: var(--shadow-island);
    z-index: var(--zIndex-popup);

    .App-toolbar__hotkey-popover-title {
      font-size: 0.75rem;
      font-weight: 600;
      color: var(--color-on-surface);
      margin-bottom: 0.625rem;
      padding: 0 0.125rem;
    }

    .App-toolbar__hotkey-popover-grid {
      display: grid;
      grid-template-columns: repeat(5, 1fr);
      gap: 0.375rem;
      padding: 0 0.125rem;
    }

    .App-toolbar__hotkey-option {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      gap: 0.125rem;
      width: 2.5rem;
      height: 2.5rem;
      border: 1px solid var(--default-border-color);
      border-radius: var(--border-radius-md);
      background-color: var(--island-bg-color);
      cursor: pointer;
      color: var(--color-on-surface);

      &:hover {
        background-color: var(--button-hover-bg, var(--color-surface-high));
      }

      &--current {
        border-color: var(--color-primary);
        background-color: var(--color-primary-light);
      }

      .App-toolbar__hotkey-option-digit {
        font-size: 0.875rem;
        font-weight: 600;
        line-height: 1;
      }

      .App-toolbar__hotkey-option-icon svg {
        width: 0.875rem;
        height: 0.875rem;
      }
    }
  }
}
```

## 6. Update Command Palette

In `packages/excalidraw/components/CommandPalette/CommandPalette.tsx`, replace the `SHAPES` import with:

```ts
import {
  SHAPES,
  getEffectiveNumericHotkeys,
  getNumericHotkeyForTool,
} from "../shapes";
```

In the shape command creation loop, replace:

```ts
const shortcut = letter || numericKey;
```

with:

```ts
const effectiveNumericKey = getNumericHotkeyForTool(
  getEffectiveNumericHotkeys(uiAppState).byTool,
  value,
);
const shortcut = letter || effectiveNumericKey || numericKey;
```

## 7. Add Locale

In `packages/excalidraw/locales/en.json`, inside `"toolBar"`, add:

```json
    "reassignHotkey": "Reassign number key"
```

Keep JSON commas valid.

## 8. Add Focused Tests

In `packages/excalidraw/tests/tool.test.tsx`, extend the shapes import to include:

```ts
  getEffectiveNumericHotkeys,
  swapNumericHotkey,
  findShapeByKey,
```

Append:

```ts
describe("numeric hotkey reassignment", () => {
  it("uses SHAPES defaults when no overrides are set", () => {
    const { byTool, byKey } = getEffectiveNumericHotkeys({
      numericHotkeyAssignments: {},
    });

    expect(byTool.selection).toBe("1");
    expect(byTool.rectangle).toBe("2");
    expect(byKey["1"]).toBe("selection");
    expect(byKey["2"]).toBe("rectangle");
  });

  it("swaps numeric hotkeys between two tools", () => {
    const { byTool } = getEffectiveNumericHotkeys({
      numericHotkeyAssignments: {},
    });

    const next = swapNumericHotkey(byTool, "rectangle", "1");

    expect(next.rectangle).toBe("1");
    expect(next.selection).toBe("2");
  });

  it("resolves tools via reassigned numeric hotkeys", () => {
    const app = {
      state: {
        numericHotkeyAssignments: { rectangle: "1", selection: "2" },
        preferredSelectionTool: { type: "selection" },
      },
    } as unknown as AppClassProperties;

    expect(findShapeByKey("1", app)).toBe("rectangle");
    expect(findShapeByKey("2", app)).toBe("selection");
  });
});
```

If `AppClassProperties` is not already imported in this test file, import it as a type from `../types`.

## Verify

```bash
yarn test:typecheck
```

## Stop

After typecheck passes, stop. Tell the user to hard refresh the dev server, right-click a numbered top-toolbar tool, choose another digit, and then press that digit to confirm the tool selection changed.
