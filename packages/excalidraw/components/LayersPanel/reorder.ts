import { arrayToMap } from "@excalidraw/common";

import {
  isFrameLikeElement,
  newElementWith,
  getBoundTextElementId,
} from "@excalidraw/element";

import type { ExcalidrawElement } from "@excalidraw/element/types";

/**
 * Where a dragged row is being dropped within the layers panel.
 *
 * - `into-frame`: drop onto a frame header, becoming a child placed at the top
 *   (front) of that frame.
 * - `relative`: drop adjacent to another row. `place` is expressed in display
 *   terms ("front" = above the target = higher z-index, "behind" = below).
 * - `root-top`: drop onto the panel's root drop zone, moving the element out of
 *   any frame to the front of the scene.
 */
export type LayerDropTarget =
  | { type: "into-frame"; frameId: string }
  | { type: "relative"; refId: string; place: "front" | "behind" }
  | { type: "root-top" };

/**
 * Rebuilds the elements array (bottom -> top) so that each frame's children are
 * contiguous and every bound-text element directly follows its container. This
 * makes drop handling tolerant of approximate insertion indices: only the
 * relative order of items by first appearance matters.
 */
const normalize = (
  ids: string[],
  elementsMap: Map<string, ExcalidrawElement>,
  frameIdOf: (id: string) => string | null,
): string[] => {
  const isFrame = (id: string) => {
    const el = elementsMap.get(id);
    return !!el && isFrameLikeElement(el);
  };
  const frameIds = new Set(ids.filter(isFrame));
  const parentOf = (id: string) => {
    if (isFrame(id)) {
      return null;
    }
    const frameId = frameIdOf(id);
    return frameId && frameIds.has(frameId) ? frameId : null;
  };

  const rootOrder = ids.filter((id) => !parentOf(id));
  const childrenOf = new Map<string, string[]>();
  for (const id of ids) {
    const parent = parentOf(id);
    if (parent) {
      if (!childrenOf.has(parent)) {
        childrenOf.set(parent, []);
      }
      childrenOf.get(parent)!.push(id);
    }
  }

  const out: string[] = [];
  for (const id of rootOrder) {
    out.push(id);
    if (isFrame(id)) {
      out.push(...(childrenOf.get(id) ?? []));
    }
  }

  // keep each bound text immediately after its container
  for (const id of [...out]) {
    const boundTextId = getBoundTextElementId(elementsMap.get(id) ?? null);
    if (boundTextId && elementsMap.has(boundTextId)) {
      const currentIndex = out.indexOf(boundTextId);
      if (currentIndex !== -1) {
        out.splice(currentIndex, 1);
      }
      out.splice(out.indexOf(id) + 1, 0, boundTextId);
    }
  }

  return out;
};

/**
 * Computes a new elements array (bottom -> top) reflecting a drag-and-drop
 * reorder/reparent operation initiated from the layers panel. Returns `null`
 * when the operation would be a no-op or is invalid (e.g. dropping a frame into
 * itself).
 */
export const reorderForDrop = (
  allElements: readonly ExcalidrawElement[],
  draggedId: string,
  target: LayerDropTarget,
): ExcalidrawElement[] | null => {
  const elementsMap = arrayToMap(allElements);
  const dragged = elementsMap.get(draggedId);
  if (!dragged) {
    return null;
  }

  const draggedIsFrame = isFrameLikeElement(dragged);

  let newFrameId: string | null = dragged.frameId ?? null;
  let refId: string | null = null;
  // placement in array terms: "front" -> higher index than ref (drawn on top)
  let place: "front" | "behind" = "front";
  let intoFrameTop: string | null = null;

  if (target.type === "root-top") {
    newFrameId = null;
  } else if (target.type === "into-frame") {
    if (draggedIsFrame || target.frameId === draggedId) {
      // frames can't be nested - place before the target frame at root instead
      newFrameId = null;
      refId = target.frameId;
      place = "front";
    } else {
      newFrameId = target.frameId;
      intoFrameTop = target.frameId;
    }
  } else {
    const ref = elementsMap.get(target.refId);
    if (!ref || target.refId === draggedId) {
      return null;
    }
    place = target.place;
    if (isFrameLikeElement(ref)) {
      // dropping next to a frame header positions at root, around its span
      newFrameId = null;
      refId = ref.id;
    } else if (draggedIsFrame) {
      // a frame can only live at root; anchor around the ref's frame if any
      newFrameId = null;
      refId = ref.frameId ?? ref.id;
    } else {
      newFrameId = ref.frameId ?? null;
      refId = ref.id;
    }
  }

  // build the id list without the dragged element, then re-insert it
  const ids = allElements.map((el) => el.id).filter((id) => id !== draggedId);

  const indexOf = (id: string) => ids.indexOf(id);
  const frameSpan = (frameId: string): [number, number] => {
    let start = indexOf(frameId);
    let end = start;
    ids.forEach((id, index) => {
      const el = elementsMap.get(id);
      if (id === frameId || el?.frameId === frameId) {
        if (start === -1 || index < start) {
          start = index;
        }
        if (index > end) {
          end = index;
        }
      }
    });
    return [start, end];
  };

  let insertIndex: number;
  if (target.type === "root-top") {
    insertIndex = ids.length;
  } else if (intoFrameTop) {
    const [, end] = frameSpan(intoFrameTop);
    insertIndex = end + 1;
  } else if (refId) {
    const ref = elementsMap.get(refId)!;
    if (isFrameLikeElement(ref)) {
      const [start, end] = frameSpan(refId);
      insertIndex = place === "front" ? end + 1 : start;
    } else {
      const refIndex = indexOf(refId);
      insertIndex = place === "front" ? refIndex + 1 : refIndex;
    }
  } else {
    return null;
  }

  insertIndex = Math.max(0, Math.min(insertIndex, ids.length));
  ids.splice(insertIndex, 0, draggedId);

  const boundTextId = getBoundTextElementId(dragged);
  const frameIdOverride = new Map<string, string | null>();
  frameIdOverride.set(draggedId, newFrameId);
  if (boundTextId) {
    frameIdOverride.set(boundTextId, newFrameId);
  }

  const frameIdOf = (id: string) =>
    frameIdOverride.has(id)
      ? frameIdOverride.get(id)!
      : elementsMap.get(id)?.frameId ?? null;

  const ordered = normalize(ids, elementsMap, frameIdOf);

  // detect no-op (same order, same frame membership)
  const original = allElements.map((el) => el.id);
  const sameOrder =
    ordered.length === original.length &&
    ordered.every((id, index) => id === original[index]);
  const sameFrame =
    (dragged.frameId ?? null) === newFrameId;
  if (sameOrder && sameFrame) {
    return null;
  }

  return ordered.map((id) => {
    const el = elementsMap.get(id)!;
    const nextFrameId = frameIdOverride.has(id)
      ? frameIdOverride.get(id)!
      : el.frameId ?? null;
    if ((el.frameId ?? null) !== nextFrameId) {
      return newElementWith(el, { frameId: nextFrameId });
    }
    return el;
  });
};
