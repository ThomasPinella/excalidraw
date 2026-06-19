import type { AppState } from "@excalidraw/excalidraw/types";

import { updateBoundElements } from "./binding";
import { getCommonBoundingBox } from "./bounds";
import { updateElbowArrowPoints } from "./elbowArrow";
import { getSelectedElementsByGroup } from "./groups";
import { isBindableElement, isElbowArrow, isLinearElement } from "./typeChecks";

import type { Scene } from "./Scene";

import type { BoundingBox } from "./bounds";
import type {
  ElementsMap,
  ExcalidrawBindableElement,
  ExcalidrawElement,
} from "./types";

export const TIDY_VERTICAL_OFFSET = 100;
export const TIDY_HORIZONTAL_OFFSET = 100;
export const TIDY_COMPONENT_GAP = 150;

export type TidyNode = {
  id: string;
  width: number;
  height: number;
  x: number;
  y: number;
};

export type TidyEdge = {
  from: string;
  to: string;
  arrowId: string;
};

export type TidyGraph = {
  nodes: Map<string, TidyNode>;
  edges: TidyEdge[];
  components: string[][];
};

const getBindableNodesFromSelection = (
  selectedElements: readonly ExcalidrawElement[],
): ExcalidrawBindableElement[] =>
  selectedElements.filter((element): element is ExcalidrawBindableElement =>
    isBindableElement(element),
  );

export const buildTidyGraph = (
  selectedElements: readonly ExcalidrawElement[],
  elementsMap: ElementsMap,
): TidyGraph => {
  const bindableNodes = getBindableNodesFromSelection(selectedElements);
  const bindableIds = new Set(bindableNodes.map((node) => node.id));

  const nodes = new Map<string, TidyNode>(
    bindableNodes.map((node) => [
      node.id,
      {
        id: node.id,
        width: node.width,
        height: node.height,
        x: node.x,
        y: node.y,
      },
    ]),
  );

  const edgeMap = new Map<string, TidyEdge>();

  for (const element of selectedElements) {
    if (!isLinearElement(element)) {
      continue;
    }

    const startId = element.startBinding?.elementId;
    const endId = element.endBinding?.elementId;

    if (
      !startId ||
      !endId ||
      !bindableIds.has(startId) ||
      !bindableIds.has(endId) ||
      startId === endId
    ) {
      continue;
    }

    const edgeKey = `${startId}->${endId}`;
    if (!edgeMap.has(edgeKey)) {
      edgeMap.set(edgeKey, {
        from: startId,
        to: endId,
        arrowId: element.id,
      });
    }
  }

  const edges = [...edgeMap.values()];
  const components = getConnectedComponents(nodes, edges);

  return { nodes, edges, components };
};

const getConnectedComponents = (
  nodes: Map<string, TidyNode>,
  edges: TidyEdge[],
): string[][] => {
  const adjacency = new Map<string, Set<string>>();

  for (const nodeId of nodes.keys()) {
    adjacency.set(nodeId, new Set());
  }

  for (const edge of edges) {
    adjacency.get(edge.from)?.add(edge.to);
    adjacency.get(edge.to)?.add(edge.from);
  }

  const visited = new Set<string>();
  const components: string[][] = [];

  for (const nodeId of nodes.keys()) {
    if (visited.has(nodeId)) {
      continue;
    }

    const component: string[] = [];
    const stack = [nodeId];

    while (stack.length > 0) {
      const current = stack.pop()!;
      if (visited.has(current)) {
        continue;
      }

      visited.add(current);
      component.push(current);

      for (const neighbor of adjacency.get(current) ?? []) {
        if (!visited.has(neighbor)) {
          stack.push(neighbor);
        }
      }
    }

    components.push(component);
  }

  return components;
};

const assignLayers = (
  componentNodeIds: string[],
  edges: TidyEdge[],
): Map<string, number> => {
  const componentSet = new Set(componentNodeIds);
  const componentEdges = edges.filter(
    (edge) => componentSet.has(edge.from) && componentSet.has(edge.to),
  );

  const layers = new Map<string, number>();

  for (const nodeId of componentNodeIds) {
    layers.set(nodeId, 0);
  }

  for (let iteration = 0; iteration < componentNodeIds.length; iteration++) {
    let changed = false;

    for (const edge of componentEdges) {
      const nextLayer = (layers.get(edge.from) ?? 0) + 1;

      if (nextLayer > (layers.get(edge.to) ?? 0)) {
        layers.set(edge.to, nextLayer);
        changed = true;
      }
    }

    if (!changed) {
      break;
    }
  }

  return layers;
};

const orderNodesInLayers = (
  layers: Map<string, number>,
  edges: TidyEdge[],
): Map<number, string[]> => {
  const layerNodes = new Map<number, string[]>();

  for (const [nodeId, layer] of layers.entries()) {
    if (!layerNodes.has(layer)) {
      layerNodes.set(layer, []);
    }
    layerNodes.get(layer)!.push(nodeId);
  }

  const maxLayer = Math.max(...layerNodes.keys(), 0);
  const nodeIndexInLayer = (layer: number, nodeId: string) =>
    layerNodes.get(layer)?.indexOf(nodeId) ?? 0;

  for (let sweep = 0; sweep < 2; sweep++) {
    for (let layer = 1; layer <= maxLayer; layer++) {
      const nodesInLayer = layerNodes.get(layer) ?? [];
      nodesInLayer.sort((a, b) => {
        const aPreds = edges
          .filter((edge) => edge.to === a)
          .map((edge) => nodeIndexInLayer(layer - 1, edge.from));
        const bPreds = edges
          .filter((edge) => edge.to === b)
          .map((edge) => nodeIndexInLayer(layer - 1, edge.from));

        const aScore =
          aPreds.length > 0
            ? aPreds.reduce((sum, index) => sum + index, 0) / aPreds.length
            : nodeIndexInLayer(layer, a);
        const bScore =
          bPreds.length > 0
            ? bPreds.reduce((sum, index) => sum + index, 0) / bPreds.length
            : nodeIndexInLayer(layer, b);

        return aScore - bScore;
      });
    }

    for (let layer = maxLayer - 1; layer >= 0; layer--) {
      const nodesInLayer = layerNodes.get(layer) ?? [];
      nodesInLayer.sort((a, b) => {
        const aSuccs = edges
          .filter((edge) => edge.from === a)
          .map((edge) => nodeIndexInLayer(layer + 1, edge.to));
        const bSuccs = edges
          .filter((edge) => edge.from === b)
          .map((edge) => nodeIndexInLayer(layer + 1, edge.to));

        const aScore =
          aSuccs.length > 0
            ? aSuccs.reduce((sum, index) => sum + index, 0) / aSuccs.length
            : nodeIndexInLayer(layer, a);
        const bScore =
          bSuccs.length > 0
            ? bSuccs.reduce((sum, index) => sum + index, 0) / bSuccs.length
            : nodeIndexInLayer(layer, b);

        return aScore - bScore;
      });
    }
  }

  return layerNodes;
};

const layoutComponent = (
  componentNodeIds: string[],
  edges: TidyEdge[],
  nodes: Map<string, TidyNode>,
): Map<string, { x: number; y: number }> => {
  const positions = new Map<string, { x: number; y: number }>();

  if (componentNodeIds.length === 1) {
    const node = nodes.get(componentNodeIds[0])!;
    positions.set(node.id, { x: 0, y: 0 });
    return positions;
  }

  const componentEdges = edges.filter(
    (edge) =>
      componentNodeIds.includes(edge.from) &&
      componentNodeIds.includes(edge.to),
  );

  if (componentEdges.length === 0) {
    const sortedNodes = componentNodeIds
      .map((nodeId) => nodes.get(nodeId)!)
      .sort((a, b) => a.x - b.x);

    let currentX = 0;
    const baseY = 0;

    for (const node of sortedNodes) {
      positions.set(node.id, { x: currentX, y: baseY });
      currentX += node.width + TIDY_HORIZONTAL_OFFSET;
    }

    return positions;
  }

  const layers = assignLayers(componentNodeIds, edges);
  const layerNodes = orderNodesInLayers(layers, componentEdges);
  const sortedLayers = [...layerNodes.keys()].sort((a, b) => a - b);

  let currentY = 0;

  for (const layer of sortedLayers) {
    const nodeIds = layerNodes.get(layer) ?? [];
    const layerNodesData = nodeIds.map((nodeId) => nodes.get(nodeId)!);
    const maxHeight = Math.max(...layerNodesData.map((node) => node.height), 0);
    const totalWidth =
      layerNodesData.reduce((sum, node) => sum + node.width, 0) +
      Math.max(0, layerNodesData.length - 1) * TIDY_HORIZONTAL_OFFSET;

    let currentX = -totalWidth / 2;

    for (const node of layerNodesData) {
      positions.set(node.id, { x: currentX, y: currentY });
      currentX += node.width + TIDY_HORIZONTAL_OFFSET;
    }

    currentY += maxHeight + TIDY_VERTICAL_OFFSET;
  }

  return positions;
};

export const computeLayeredLayout = (
  graph: TidyGraph,
  anchor: Pick<BoundingBox, "minX" | "minY">,
): Map<string, { x: number; y: number }> => {
  const positions = new Map<string, { x: number; y: number }>();

  if (graph.nodes.size === 0) {
    return positions;
  }

  if (graph.edges.length === 0) {
    const nodeIds = [...graph.nodes.keys()];
    const componentPositions = layoutComponent(
      nodeIds,
      graph.edges,
      graph.nodes,
    );
    componentPositions.forEach((position, nodeId) => {
      positions.set(nodeId, position);
    });
  } else {
    let componentOffsetX = 0;

    for (const componentNodeIds of graph.components) {
      const componentPositions = layoutComponent(
        componentNodeIds,
        graph.edges,
        graph.nodes,
      );

      const componentBounds = getLayoutBounds(componentPositions, graph.nodes);

      for (const [nodeId, position] of componentPositions.entries()) {
        positions.set(nodeId, {
          x: position.x + componentOffsetX - componentBounds.minX,
          y: position.y - componentBounds.minY,
        });
      }

      componentOffsetX += componentBounds.width + TIDY_COMPONENT_GAP;
    }
  }

  const layoutBounds = getLayoutBounds(positions, graph.nodes);

  for (const [nodeId, position] of positions.entries()) {
    positions.set(nodeId, {
      x: position.x + anchor.minX - layoutBounds.minX,
      y: position.y + anchor.minY - layoutBounds.minY,
    });
  }

  return positions;
};

const getLayoutBounds = (
  positions: Map<string, { x: number; y: number }>,
  nodes: Map<string, TidyNode>,
) => {
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;

  for (const [nodeId, position] of positions.entries()) {
    const node = nodes.get(nodeId)!;
    minX = Math.min(minX, position.x);
    minY = Math.min(minY, position.y);
    maxX = Math.max(maxX, position.x + node.width);
    maxY = Math.max(maxY, position.y + node.height);
  }

  return {
    minX,
    minY,
    maxX,
    maxY,
    width: maxX - minX,
    height: maxY - minY,
  };
};

export const nodesOverlap = (
  positions: Map<string, { x: number; y: number }>,
  nodes: Map<string, TidyNode>,
  padding = 0,
): boolean => {
  const nodeIds = [...positions.keys()];

  for (let i = 0; i < nodeIds.length; i++) {
    for (let j = i + 1; j < nodeIds.length; j++) {
      const a = positions.get(nodeIds[i])!;
      const b = positions.get(nodeIds[j])!;
      const aNode = nodes.get(nodeIds[i])!;
      const bNode = nodes.get(nodeIds[j])!;

      const overlapX =
        a.x + aNode.width + padding > b.x && b.x + bNode.width + padding > a.x;
      const overlapY =
        a.y + aNode.height + padding > b.y &&
        b.y + bNode.height + padding > a.y;

      if (overlapX && overlapY) {
        return true;
      }
    }
  }

  return false;
};

export const getNodeLayer = (nodeId: string, graph: TidyGraph): number => {
  const component = graph.components.find((componentNodeIds) =>
    componentNodeIds.includes(nodeId),
  );

  if (!component) {
    return 0;
  }

  const layers = assignLayers(component, graph.edges);
  return layers.get(nodeId) ?? 0;
};

const layoutUnconnectedBindableNodes = (
  bindableNodes: ExcalidrawBindableElement[],
  anchor: Pick<BoundingBox, "minX" | "minY">,
): Map<string, { x: number; y: number }> => {
  const positions = new Map<string, { x: number; y: number }>();
  const sortedNodes = [...bindableNodes].sort((a, b) => a.x - b.x);

  let currentX = anchor.minX;

  for (const node of sortedNodes) {
    positions.set(node.id, { x: currentX, y: anchor.minY });
    currentX += node.width + TIDY_HORIZONTAL_OFFSET;
  }

  return positions;
};

export const tidyElements = (
  selectedElements: ExcalidrawElement[],
  scene: Scene,
  appState: Readonly<AppState>,
): ExcalidrawElement[] => {
  const elementsMap = scene.getNonDeletedElementsMap();
  const bindableNodes = getBindableNodesFromSelection(selectedElements);
  const anchor = getCommonBoundingBox(bindableNodes);
  const graph = buildTidyGraph(selectedElements, elementsMap);

  const positions =
    graph.edges.length > 0
      ? computeLayeredLayout(graph, anchor)
      : layoutUnconnectedBindableNodes(bindableNodes, anchor);

  const groups = getSelectedElementsByGroup(
    selectedElements,
    elementsMap,
    appState,
  );

  const movedNodeIds = new Set(positions.keys());
  const updatedElements: ExcalidrawElement[] = [];

  for (const group of groups) {
    const rootElement = group.find((element) => movedNodeIds.has(element.id));

    if (!rootElement) {
      continue;
    }

    const newPosition = positions.get(rootElement.id);
    if (!newPosition) {
      continue;
    }

    const deltaX = newPosition.x - rootElement.x;
    const deltaY = newPosition.y - rootElement.y;

    for (const element of group) {
      const updatedElement = scene.mutateElement(element, {
        x: element.x + deltaX,
        y: element.y + deltaY,
      });

      updateBoundElements(element, scene, {
        simultaneouslyUpdated: group,
      });

      updatedElements.push(updatedElement);
    }
  }

  for (const element of selectedElements) {
    if (!isElbowArrow(element)) {
      continue;
    }

    const update = updateElbowArrowPoints(
      element,
      scene.getNonDeletedElementsMap(),
      {},
    );

    const updatedArrow = scene.mutateElement(element, update);
    updatedElements.push(updatedArrow);
  }

  return selectedElements.map(
    (element) => scene.getElement(element.id) ?? element,
  );
};
