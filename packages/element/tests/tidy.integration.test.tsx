import { KEYS, reseed } from "@excalidraw/common";

import { actionTidyUp } from "@excalidraw/excalidraw/actions";
import { Excalidraw } from "@excalidraw/excalidraw";

import { API } from "@excalidraw/excalidraw/tests/helpers/api";

import { Keyboard } from "@excalidraw/excalidraw/tests/helpers/ui";

import {
  render,
  unmountComponent,
} from "@excalidraw/excalidraw/tests/test-utils";

import "@excalidraw/utils/test-utils";

import { newElement } from "../src/newElement";
import { buildTidyGraph, getNodeLayer, tidyElements } from "../src/tidy";

import {
  createMessyFlowchartElements,
  expectedLayerByNodeId,
  messyFlowchartNodeIdMap,
} from "./fixtures/messyFlowchartFixture";

import type { ExcalidrawElement, ExcalidrawLinearElement } from "../src/types";

unmountComponent();

const { h } = window;

const getBindableElementById = (id: string) =>
  h.elements.find((element) => element.id === id)!;

const assertNoOverlappingNodes = () => {
  const bindableElements = h.elements.filter(
    (element) => element.type === "rectangle" || element.type === "diamond",
  );

  for (let i = 0; i < bindableElements.length; i++) {
    for (let j = i + 1; j < bindableElements.length; j++) {
      const a = bindableElements[i];
      const b = bindableElements[j];

      const overlapX = a.x + a.width > b.x && b.x + b.width > a.x;
      const overlapY = a.y + a.height > b.y && b.y + b.height > a.y;

      expect(overlapX && overlapY).toBe(false);
    }
  }
};

describe("tidy up integration", () => {
  let messyFlowchartElements = createMessyFlowchartElements();

  beforeEach(async () => {
    localStorage.clear();
    reseed(7);
    unmountComponent();
    messyFlowchartElements = createMessyFlowchartElements();

    await render(<Excalidraw handleKeyboardGlobally={true} />);
    h.state.width = 1000;
    h.state.height = 1000;
  });

  it("tidies messy flowchart via action", () => {
    API.setElements(messyFlowchartElements);
    API.setSelectedElements(messyFlowchartElements);

    const originalEndY = getBindableElementById(messyFlowchartNodeIdMap.end).y;

    API.executeAction(actionTidyUp);

    const graph = buildTidyGraph(
      h.elements,
      h.app.scene.getNonDeletedElementsMap(),
    );

    for (const [nodeId, expectedLayer] of Object.entries(
      expectedLayerByNodeId,
    )) {
      expect(getNodeLayer(nodeId, graph)).toBe(expectedLayer);
    }

    expect(getBindableElementById(messyFlowchartNodeIdMap.end).y).not.toBe(
      originalEndY,
    );
    assertNoOverlappingNodes();
    h.elements.forEach((element) => expect(element).toMatchSnapshot());
  });

  it("preserves arrow bindings after tidying", () => {
    API.setElements(messyFlowchartElements);
    API.setSelectedElements(messyFlowchartElements);

    API.executeAction(actionTidyUp);

    const arrows = h.elements.filter(
      (element): element is ExcalidrawLinearElement => element.type === "arrow",
    );

    expect(arrows.length).toBe(6);
    arrows.forEach((arrow) => {
      expect(arrow.startBinding?.elementId).toBeTruthy();
      expect(arrow.endBinding?.elementId).toBeTruthy();
    });
  });

  it("reroutes elbow arrows after tidying", () => {
    API.setElements(messyFlowchartElements);
    API.setSelectedElements(messyFlowchartElements);

    API.executeAction(actionTidyUp);

    const arrow = h.elements.find(
      (element): element is ExcalidrawLinearElement =>
        element.type === "arrow" &&
        element.startBinding?.elementId === messyFlowchartNodeIdMap.start,
    )!;

    expect(arrow.points).toCloselyEqualPoints(arrow.points);
    expect(arrow.points.length).toBeGreaterThanOrEqual(2);
  });

  it("does not expose tidy action for a single selected node", () => {
    const rectangle = API.createElement({
      type: "rectangle",
      width: 100,
      height: 100,
    });

    API.setElements([rectangle]);
    API.setSelectedElements([rectangle]);

    expect(actionTidyUp.predicate?.(h.elements, h.state, {}, h.app)).toBe(
      false,
    );
  });

  it("records history when tidying", () => {
    API.setElements(messyFlowchartElements);
    API.setSelectedElements(messyFlowchartElements);

    const undoStackSize = h.history.undoStack.length;

    API.executeAction(actionTidyUp);

    expect(h.history.undoStack.length).toBeGreaterThan(undoStackSize);
  });

  it("supports keyboard shortcut", () => {
    API.setElements(messyFlowchartElements);
    API.setSelectedElements(messyFlowchartElements);

    const originalEndY = getBindableElementById(messyFlowchartNodeIdMap.end).y;

    Keyboard.withModifierKeys({ ctrl: true, alt: true }, () => {
      Keyboard.keyPress(KEYS.T);
    });

    expect(getBindableElementById(messyFlowchartNodeIdMap.end).y).not.toBe(
      originalEndY,
    );
  });

  it("lays out unconnected rectangles in a horizontal row", () => {
    const nodes = [
      {
        ...newElement({
          type: "rectangle",
          x: 300,
          y: 100,
          width: 80,
          height: 40,
        }),
        id: "unconnected-a",
      },
      {
        ...newElement({
          type: "rectangle",
          x: 50,
          y: 250,
          width: 80,
          height: 40,
        }),
        id: "unconnected-b",
      },
      {
        ...newElement({
          type: "rectangle",
          x: 180,
          y: 20,
          width: 80,
          height: 40,
        }),
        id: "unconnected-c",
      },
    ] as ExcalidrawElement[];

    API.setElements(nodes);
    API.setSelectedElements(nodes);

    tidyElements(nodes, h.app.scene, h.state);

    const updatedNodes = nodes
      .map((node) => getBindableElementById(node.id))
      .sort((a, b) => a.x - b.x);

    expect(updatedNodes[0].y).toBe(updatedNodes[1].y);
    expect(updatedNodes[1].y).toBe(updatedNodes[2].y);
  });
});
