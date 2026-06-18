import { API } from "../../tests/helpers/api";

import { reorderForDrop } from "./reorder";

const ids = (elements: { id: string }[] | null) =>
  (elements ?? []).map((element) => element.id);

const frameIdOf = (
  elements: { id: string; frameId: string | null }[],
  id: string,
) => elements.find((element) => element.id === id)?.frameId ?? null;

describe("LayersPanel reorderForDrop", () => {
  it("moves an element to the front via root-top", () => {
    const a = API.createElement({ id: "a" });
    const b = API.createElement({ id: "b" });
    const c = API.createElement({ id: "c" });
    // array order is bottom -> top
    const result = reorderForDrop([a, b, c], "a", { type: "root-top" });
    expect(ids(result)).toEqual(["b", "c", "a"]);
  });

  it("reorders relative to another root element (place behind)", () => {
    const a = API.createElement({ id: "a" });
    const b = API.createElement({ id: "b" });
    const c = API.createElement({ id: "c" });
    // move c behind a -> c ends up below a in array order
    const result = reorderForDrop([a, b, c], "c", {
      type: "relative",
      refId: "a",
      place: "behind",
    });
    expect(ids(result)).toEqual(["c", "a", "b"]);
  });

  it("moves a loose element into a frame", () => {
    const frame = API.createElement({ type: "frame", id: "f" });
    const r = API.createElement({ id: "r" });
    const result = reorderForDrop([frame, r], "r", {
      type: "into-frame",
      frameId: "f",
    });
    expect(result).not.toBeNull();
    expect(frameIdOf(result!, "r")).toBe("f");
    // frame child must be contiguous right after the frame element
    expect(ids(result)).toEqual(["f", "r"]);
  });

  it("moves a frame child out of the frame onto a root element", () => {
    const frame = API.createElement({ type: "frame", id: "f" });
    const child = API.createElement({ id: "child", frameId: "f" });
    const r = API.createElement({ id: "r" });
    const result = reorderForDrop([frame, child, r], "child", {
      type: "relative",
      refId: "r",
      place: "front",
    });
    expect(result).not.toBeNull();
    expect(frameIdOf(result!, "child")).toBeNull();
    // child should now sit at root, in front of r
    expect(ids(result)).toEqual(["f", "r", "child"]);
  });

  it("does not nest a frame inside another frame", () => {
    const f1 = API.createElement({ type: "frame", id: "f1" });
    const f2 = API.createElement({ type: "frame", id: "f2" });
    const result = reorderForDrop([f1, f2], "f2", {
      type: "into-frame",
      frameId: "f1",
    });
    // f2 stays a root frame (frameId null), never becomes a child of f1
    if (result) {
      expect(frameIdOf(result, "f2")).toBeNull();
    }
  });

  it("keeps a frame's children contiguous after reordering the frame", () => {
    const f = API.createElement({ type: "frame", id: "f" });
    const c1 = API.createElement({ id: "c1", frameId: "f" });
    const c2 = API.createElement({ id: "c2", frameId: "f" });
    const r = API.createElement({ id: "r" });
    // start: [f, c1, c2, r]; move frame f to the front (root-top)
    const result = reorderForDrop([f, c1, c2, r], "f", { type: "root-top" });
    expect(result).not.toBeNull();
    // r stays at back; frame and its children move together to the front
    expect(ids(result)).toEqual(["r", "f", "c1", "c2"]);
  });
});
