import { arrayToMap } from "@excalidraw/common";

import {
  buildTidyGraph,
  computeLayeredLayout,
  getNodeLayer,
  nodesOverlap,
} from "../src/tidy";

import {
  expectedLayerByNodeId,
  getMessyFlowchartAnchor,
  messyFlowchartElements,
} from "./fixtures/messyFlowchartFixture";

describe("tidy layout", () => {
  it("buildTidyGraph extracts correct nodes and edges from messy fixture", () => {
    const graph = buildTidyGraph(
      messyFlowchartElements,
      arrayToMap(messyFlowchartElements),
    );

    expect(graph.nodes.size).toBe(6);
    expect(graph.edges.length).toBe(6);
    expect(graph.components.length).toBe(1);
  });

  it("computeLayeredLayout assigns expected layers", () => {
    const graph = buildTidyGraph(
      messyFlowchartElements,
      arrayToMap(messyFlowchartElements),
    );
    const positions = computeLayeredLayout(graph, getMessyFlowchartAnchor());

    for (const [nodeId, expectedLayer] of Object.entries(
      expectedLayerByNodeId,
    )) {
      expect(getNodeLayer(nodeId, graph)).toBe(expectedLayer);
      expect(positions.has(nodeId)).toBe(true);
    }
  });

  it("does not produce overlapping node bounds after layout", () => {
    const graph = buildTidyGraph(
      messyFlowchartElements,
      arrayToMap(messyFlowchartElements),
    );

    expect(
      nodesOverlap(
        computeLayeredLayout(graph, getMessyFlowchartAnchor()),
        graph.nodes,
      ),
    ).toBe(false);
  });

  it("preserves the selection anchor", () => {
    const graph = buildTidyGraph(
      messyFlowchartElements,
      arrayToMap(messyFlowchartElements),
    );
    const anchor = getMessyFlowchartAnchor();
    const positions = computeLayeredLayout(graph, anchor);

    let minX = Infinity;
    let minY = Infinity;

    for (const [nodeId, position] of positions.entries()) {
      minX = Math.min(minX, position.x);
      minY = Math.min(minY, position.y);
      expect(graph.nodes.get(nodeId)).toBeTruthy();
    }

    expect(minX).toBeCloseTo(anchor.minX, 5);
    expect(minY).toBeCloseTo(anchor.minY, 5);
  });

  it("lays out disconnected components without overlap", () => {
    const graph = buildTidyGraph(
      messyFlowchartElements,
      arrayToMap(messyFlowchartElements),
    );
    const selectedElements = [
      messyFlowchartElements[0],
      messyFlowchartElements[1],
      messyFlowchartElements[3],
      messyFlowchartElements[4],
    ];
    const disconnectedGraph = {
      ...graph,
      components: [
        [messyFlowchartElements[0].id, messyFlowchartElements[1].id],
        [messyFlowchartElements[3].id, messyFlowchartElements[4].id],
      ],
      edges: [graph.edges[0], graph.edges[3]],
      nodes: new Map(
        selectedElements.map((element) => [
          element.id,
          {
            id: element.id,
            width: element.width,
            height: element.height,
            x: element.x,
            y: element.y,
          },
        ]),
      ),
    };

    expect(
      nodesOverlap(
        computeLayeredLayout(disconnectedGraph, { minX: 20, minY: 50 }),
        disconnectedGraph.nodes,
      ),
    ).toBe(false);
  });

  it("handles cycles without throwing", () => {
    const graph = {
      nodes: new Map([
        ["a", { id: "a", width: 100, height: 60, x: 10, y: 10 }],
        ["b", { id: "b", width: 100, height: 60, x: 200, y: 50 }],
        ["c", { id: "c", width: 100, height: 60, x: 120, y: 180 }],
      ]),
      edges: [
        { from: "a", to: "b", arrowId: "ab" },
        { from: "b", to: "c", arrowId: "bc" },
        { from: "c", to: "a", arrowId: "ca" },
      ],
      components: [["a", "b", "c"]],
    };

    const positions = computeLayeredLayout(graph, { minX: 10, minY: 10 });
    expect(positions.size).toBe(3);
    expect(nodesOverlap(positions, graph.nodes)).toBe(false);
  });
});
