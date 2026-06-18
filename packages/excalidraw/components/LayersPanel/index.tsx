import clsx from "clsx";
import { useMemo, useState } from "react";

import {
  getRootElements,
  getFrameChildren,
  getFrameLikeTitle,
  isFrameLikeElement,
  isTextElement,
  newElementWith,
  getBoundTextElementId,
  selectGroupsForSelectedElements,
  CaptureUpdateAction,
} from "@excalidraw/element";

import type {
  ExcalidrawElement,
  ExcalidrawFrameLikeElement,
  NonDeletedExcalidrawElement,
} from "@excalidraw/element/types";

import { t } from "../../i18n";
import { Island } from "../Island";
import {
  CloseIcon,
  TrashIcon,
  eyeIcon,
  eyeClosedIcon,
  layersIcon,
  collapseDownIcon,
  collapseUpIcon,
  frameToolIcon,
} from "../icons";

import { reorderForDrop } from "./reorder";

import "./LayersPanel.scss";

import type { LayerDropTarget } from "./reorder";
import type { AppClassProperties, AppState, UIAppState } from "../../types";

interface LayersPanelProps {
  app: AppClassProperties;
  appState: UIAppState;
  setAppState: React.Component<any, AppState>["setState"];
  elements: readonly NonDeletedExcalidrawElement[];
  onClose: () => void;
}

const getElementLabel = (element: ExcalidrawElement): string => {
  if (isFrameLikeElement(element)) {
    return getFrameLikeTitle(element as ExcalidrawFrameLikeElement);
  }
  if (isTextElement(element)) {
    const text = element.text.trim().replace(/\s+/g, " ");
    if (text) {
      return text.length > 24 ? `${text.slice(0, 24)}…` : text;
    }
  }
  return element.type.charAt(0).toUpperCase() + element.type.slice(1);
};

export const LayersPanel = ({
  app,
  appState,
  setAppState,
  elements,
  onClose,
}: LayersPanelProps) => {
  const [collapsed, setCollapsed] = useState(false);
  const [collapsedFrames, setCollapsedFrames] = useState<
    Record<string, boolean>
  >({});
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [dropIndicator, setDropIndicator] = useState<LayerDropTarget | null>(
    null,
  );

  const elementsMap = useMemo(() => {
    const map = new Map<string, ExcalidrawElement>();
    for (const element of elements) {
      map.set(element.id, element);
    }
    return map;
  }, [elements]);

  const { displayRoots, childrenByFrame, hiddenFrameIds } = useMemo(() => {
    // bound text is shown as part of its container, not as its own row
    const rowElements = elements.filter(
      (element) => !(isTextElement(element) && element.containerId),
    );
    const roots = getRootElements(rowElements);
    const childrenByFrame = new Map<string, ExcalidrawElement[]>();
    const hiddenFrameIds = new Set<string>();
    for (const element of rowElements) {
      if (isFrameLikeElement(element)) {
        childrenByFrame.set(
          element.id,
          [...getFrameChildren(rowElements, element.id)].reverse(),
        );
        if (element.hidden) {
          hiddenFrameIds.add(element.id);
        }
      }
    }
    return {
      displayRoots: [...roots].reverse(),
      childrenByFrame,
      hiddenFrameIds,
    };
  }, [elements]);

  const cleanupDrag = () => {
    setDraggingId(null);
    setDropIndicator(null);
  };

  const applyDrop = (target: LayerDropTarget | null) => {
    if (!draggingId || !target) {
      cleanupDrag();
      return;
    }
    const next = reorderForDrop(
      app.scene.getElementsIncludingDeleted(),
      draggingId,
      target,
    );
    if (next) {
      app.syncActionResult({
        elements: next,
        captureUpdate: CaptureUpdateAction.IMMEDIATELY,
      });
    }
    cleanupDrag();
  };

  const computeRowDropTarget = (
    event: React.DragEvent,
    element: ExcalidrawElement,
  ): LayerDropTarget => {
    const rect = event.currentTarget.getBoundingClientRect();
    const ratio = (event.clientY - rect.top) / rect.height;
    const draggedIsFrame =
      !!draggingId && isFrameLikeElement(elementsMap.get(draggingId)!);

    if (isFrameLikeElement(element) && !draggedIsFrame) {
      if (ratio < 0.25) {
        return { type: "relative", refId: element.id, place: "front" };
      }
      if (ratio > 0.75) {
        return { type: "relative", refId: element.id, place: "behind" };
      }
      return { type: "into-frame", frameId: element.id };
    }

    return {
      type: "relative",
      refId: element.id,
      place: ratio < 0.5 ? "front" : "behind",
    };
  };

  const selectElement = (
    element: ExcalidrawElement,
    event: React.MouseEvent,
  ) => {
    event.stopPropagation();
    const additive = event.shiftKey || event.metaKey || event.ctrlKey;
    setAppState((prevState) => {
      const selectedElementIds = additive
        ? { ...prevState.selectedElementIds, [element.id]: true as const }
        : { [element.id]: true as const };
      return selectGroupsForSelectedElements(
        {
          editingGroupId: prevState.editingGroupId,
          selectedElementIds,
        },
        app.scene.getNonDeletedElements(),
        prevState,
        app,
      );
    });
  };

  const toggleVisibility = (
    element: ExcalidrawElement,
    event: React.MouseEvent,
  ) => {
    event.stopPropagation();
    const allElements = app.scene.getElementsIncludingDeleted();
    const nextHidden = !element.hidden;
    const next = allElements.map((el) =>
      el.id === element.id ? newElementWith(el, { hidden: nextHidden }) : el,
    );
    app.syncActionResult({
      elements: next,
      captureUpdate: CaptureUpdateAction.IMMEDIATELY,
    });
  };

  const deleteElement = (
    element: ExcalidrawElement,
    event: React.MouseEvent,
  ) => {
    event.stopPropagation();
    const allElements = app.scene.getElementsIncludingDeleted();
    const isFrame = isFrameLikeElement(element);
    const deletedIds = new Set<string>([element.id]);
    const boundTextId = getBoundTextElementId(element);
    if (boundTextId) {
      deletedIds.add(boundTextId);
    }
    const next = allElements.map((el) => {
      if (deletedIds.has(el.id)) {
        return newElementWith(el, { isDeleted: true });
      }
      // deleting a frame unframes its children rather than deleting them
      if (isFrame && el.frameId === element.id) {
        return newElementWith(el, { frameId: null });
      }
      return el;
    });
    const nextSelectedElementIds = { ...appState.selectedElementIds };
    delete nextSelectedElementIds[element.id];
    app.syncActionResult({
      elements: next,
      appState: { selectedElementIds: nextSelectedElementIds },
      captureUpdate: CaptureUpdateAction.IMMEDIATELY,
    });
  };

  const renderRow = (element: ExcalidrawElement, depth: number) => {
    const isFrame = isFrameLikeElement(element);
    const isSelected = !!appState.selectedElementIds[element.id];
    const frameCollapsed = !!collapsedFrames[element.id];
    const inheritedHidden =
      !!element.frameId && hiddenFrameIds.has(element.frameId);

    const relativeFront =
      dropIndicator?.type === "relative" &&
      dropIndicator.refId === element.id &&
      dropIndicator.place === "front";
    const relativeBehind =
      dropIndicator?.type === "relative" &&
      dropIndicator.refId === element.id &&
      dropIndicator.place === "behind";
    const dropInto =
      dropIndicator?.type === "into-frame" &&
      dropIndicator.frameId === element.id;

    return (
      <div
        key={element.id}
        className={clsx("layers-panel__row", {
          "layers-panel__row--selected": isSelected,
          "layers-panel__row--dragging": draggingId === element.id,
          "layers-panel__row--hidden": element.hidden || inheritedHidden,
          "layers-panel__row--drop-front": relativeFront,
          "layers-panel__row--drop-behind": relativeBehind,
          "layers-panel__row--drop-into": dropInto,
        })}
        style={{ paddingLeft: `${8 + depth * 16}px` }}
        draggable
        onClick={(event) => selectElement(element, event)}
        onDragStart={(event) => {
          setDraggingId(element.id);
          event.dataTransfer.effectAllowed = "move";
          event.dataTransfer.setData("text/plain", element.id);
        }}
        onDragEnd={cleanupDrag}
        onDragOver={(event) => {
          if (!draggingId) {
            return;
          }
          event.preventDefault();
          event.stopPropagation();
          setDropIndicator(computeRowDropTarget(event, element));
        }}
        onDrop={(event) => {
          event.preventDefault();
          event.stopPropagation();
          applyDrop(computeRowDropTarget(event, element));
        }}
      >
        {isFrame ? (
          <button
            type="button"
            className="layers-panel__caret"
            onClick={(event) => {
              event.stopPropagation();
              setCollapsedFrames((prev) => ({
                ...prev,
                [element.id]: !prev[element.id],
              }));
            }}
          >
            {frameCollapsed ? collapseDownIcon : collapseUpIcon}
          </button>
        ) : (
          <span className="layers-panel__caret-spacer" />
        )}
        <span className="layers-panel__icon">
          {isFrame ? frameToolIcon : null}
        </span>
        <span className="layers-panel__label" title={getElementLabel(element)}>
          {getElementLabel(element)}
        </span>
        <button
          type="button"
          className="layers-panel__action"
          title={element.hidden ? t("layersPanel.show") : t("layersPanel.hide")}
          onClick={(event) => toggleVisibility(element, event)}
        >
          {element.hidden ? eyeClosedIcon : eyeIcon}
        </button>
        <button
          type="button"
          className="layers-panel__action layers-panel__action--delete"
          title={t("layersPanel.delete")}
          onClick={(event) => deleteElement(element, event)}
        >
          {TrashIcon}
        </button>
      </div>
    );
  };

  const renderNode = (element: ExcalidrawElement, depth: number) => {
    if (!isFrameLikeElement(element)) {
      return renderRow(element, depth);
    }
    const children = childrenByFrame.get(element.id) ?? [];
    const frameCollapsed = !!collapsedFrames[element.id];
    return (
      <div key={element.id} className="layers-panel__frame">
        {renderRow(element, depth)}
        {!frameCollapsed &&
          children.map((child) => renderRow(child, depth + 1))}
      </div>
    );
  };

  return (
    <div className="layers-panel">
      <Island className="layers-panel__island" padding={0}>
        <div className="layers-panel__header">
        <button
          type="button"
          className="layers-panel__title"
          onClick={() => setCollapsed((value) => !value)}
        >
          <span className="layers-panel__icon">{layersIcon}</span>
          {t("layersPanel.title")}
          <span className="layers-panel__icon">
            {collapsed ? collapseDownIcon : collapseUpIcon}
          </span>
        </button>
        <button
          type="button"
          className="layers-panel__close"
          title={t("buttons.close")}
          onClick={onClose}
        >
          {CloseIcon}
        </button>
      </div>
      {!collapsed && (
        <div
          className={clsx("layers-panel__list", {
            "layers-panel__list--drop-root": dropIndicator?.type === "root-top",
          })}
          onDragOver={(event) => {
            if (!draggingId) {
              return;
            }
            event.preventDefault();
            setDropIndicator({ type: "root-top" });
          }}
          onDrop={(event) => {
            event.preventDefault();
            applyDrop({ type: "root-top" });
          }}
        >
          {displayRoots.length === 0 ? (
            <div className="layers-panel__empty">{t("layersPanel.empty")}</div>
          ) : (
            displayRoots.map((element) => renderNode(element, 0))
          )}
        </div>
      )}
      </Island>
    </div>
  );
};
