import type { Radians } from "@excalidraw/math";

import type {
  ExcalidrawBindableElement,
  ExcalidrawElement,
  ExcalidrawLinearElement,
} from "../../src/types";

const NODE_IDS = {
  start: "tidy-start",
  procA: "tidy-proc-a",
  decision: "tidy-decision",
  yes: "tidy-yes",
  no: "tidy-no",
  end: "tidy-end",
} as const;

const ARROW_IDS = {
  startToProcA: "tidy-arrow-start-proc-a",
  procAToDecision: "tidy-arrow-proc-a-decision",
  decisionToYes: "tidy-arrow-decision-yes",
  decisionToNo: "tidy-arrow-decision-no",
  yesToEnd: "tidy-arrow-yes-end",
  noToEnd: "tidy-arrow-no-end",
} as const;

const baseElementProps = {
  angle: 0 as Radians,
  strokeColor: "#000000",
  backgroundColor: "transparent",
  fillStyle: "hachure",
  strokeWidth: 1,
  strokeStyle: "solid",
  roughness: 1,
  opacity: 100,
  groupIds: [],
  frameId: null,
  roundness: null,
  seed: 1,
  version: 1,
  versionNonce: 1,
  isDeleted: false,
  updated: 1,
  link: null,
  locked: false,
  index: null,
} as const;

const createShape = (
  type: "rectangle" | "diamond",
  id: string,
  x: number,
  y: number,
  width: number,
  height: number,
): ExcalidrawBindableElement =>
  ({
    ...baseElementProps,
    id,
    type,
    x,
    y,
    width,
    height,
    boundElements: [],
  } as ExcalidrawBindableElement);

const createArrow = (
  id: string,
  startElement: ExcalidrawBindableElement,
  endElement: ExcalidrawBindableElement,
): ExcalidrawLinearElement =>
  ({
    ...baseElementProps,
    id,
    type: "arrow",
    x: startElement.x + startElement.width / 2,
    y: startElement.y + startElement.height,
    width: 100,
    height: 100,
    boundElements: null,
    points: [
      [0, 0],
      [100, 100],
    ],
    startBinding: {
      elementId: startElement.id,
      fixedPoint: [0.5, 1],
      mode: "orbit",
    },
    endBinding: {
      elementId: endElement.id,
      fixedPoint: [0.5, 0],
      mode: "orbit",
    },
    startArrowhead: null,
    endArrowhead: "arrow",
    elbowed: true,
  } as unknown as ExcalidrawLinearElement);

const buildMessyFlowchartElements = (): ExcalidrawElement[] => {
  const start = createShape("rectangle", NODE_IDS.start, 300, 50, 120, 60);
  const procA = createShape("rectangle", NODE_IDS.procA, 50, 200, 120, 60);
  const decision = createShape("diamond", NODE_IDS.decision, 40, 180, 140, 80);
  const yes = createShape("rectangle", NODE_IDS.yes, 280, 350, 100, 50);
  const no = createShape("rectangle", NODE_IDS.no, 20, 420, 100, 50);
  const end = createShape("rectangle", NODE_IDS.end, 50, 400, 120, 60);

  const arrows = [
    createArrow(ARROW_IDS.startToProcA, start, procA),
    createArrow(ARROW_IDS.procAToDecision, procA, decision),
    createArrow(ARROW_IDS.decisionToYes, decision, yes),
    createArrow(ARROW_IDS.decisionToNo, decision, no),
    createArrow(ARROW_IDS.yesToEnd, yes, end),
    createArrow(ARROW_IDS.noToEnd, no, end),
  ];

  const nodes: ExcalidrawBindableElement[] = [
    {
      ...start,
      boundElements: [{ id: ARROW_IDS.startToProcA, type: "arrow" }],
    },
    {
      ...procA,
      boundElements: [
        { id: ARROW_IDS.startToProcA, type: "arrow" },
        { id: ARROW_IDS.procAToDecision, type: "arrow" },
      ],
    },
    {
      ...decision,
      boundElements: [
        { id: ARROW_IDS.procAToDecision, type: "arrow" },
        { id: ARROW_IDS.decisionToYes, type: "arrow" },
        { id: ARROW_IDS.decisionToNo, type: "arrow" },
      ],
    },
    {
      ...yes,
      boundElements: [
        { id: ARROW_IDS.decisionToYes, type: "arrow" },
        { id: ARROW_IDS.yesToEnd, type: "arrow" },
      ],
    },
    {
      ...no,
      boundElements: [
        { id: ARROW_IDS.decisionToNo, type: "arrow" },
        { id: ARROW_IDS.noToEnd, type: "arrow" },
      ],
    },
    {
      ...end,
      boundElements: [
        { id: ARROW_IDS.yesToEnd, type: "arrow" },
        { id: ARROW_IDS.noToEnd, type: "arrow" },
      ],
    },
  ];

  return [...nodes, ...arrows];
};

export const createMessyFlowchartElements = (): ExcalidrawElement[] =>
  buildMessyFlowchartElements();

export const messyFlowchartElements: ExcalidrawElement[] =
  createMessyFlowchartElements();

export const messyFlowchartNodeIds = Object.values(NODE_IDS);

export const expectedLayerByNodeId: Record<string, number> = {
  [NODE_IDS.start]: 0,
  [NODE_IDS.procA]: 1,
  [NODE_IDS.decision]: 2,
  [NODE_IDS.yes]: 3,
  [NODE_IDS.no]: 3,
  [NODE_IDS.end]: 4,
};

export const messyFlowchartNodeIdMap = NODE_IDS;
export const messyFlowchartArrowIdMap = ARROW_IDS;

export const getMessyFlowchartBindableElements = () =>
  messyFlowchartElements.filter(
    (element) => element.type === "rectangle" || element.type === "diamond",
  );

export const getMessyFlowchartAnchor = () => {
  const bindableElements = getMessyFlowchartBindableElements();
  const minX = Math.min(...bindableElements.map((element) => element.x));
  const minY = Math.min(...bindableElements.map((element) => element.y));
  return { minX, minY };
};
