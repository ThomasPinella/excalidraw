import { CaptureUpdateAction } from "@excalidraw/excalidraw"
import {
  eyeClosedIcon,
  eyeIcon,
  TrashIcon,
} from "@excalidraw/excalidraw/components/icons"
import { arrayToMap } from "@excalidraw/common"
import {
  addElementsToFrame,
  getFrameChildren,
  getFrameLikeTitle,
  isFrameLikeElement,
  isTextElement,
  newElementWith,
  removeElementsFromFrame,
} from "@excalidraw/element"
import React, { useCallback, useEffect, useMemo, useState } from "react"

import type { ExcalidrawImperativeAPI } from "@excalidraw/excalidraw/types"
import type {
  ExcalidrawElement,
  ExcalidrawFrameLikeElement,
} from "@excalidraw/element/types"

import "./LayersPanel.scss"

type LayerItem =
  | {
      type: "frame"
      frame: ExcalidrawFrameLikeElement
      children: ExcalidrawElement[]
    }
  | { type: "element"; element: ExcalidrawElement }

const getElementLabel = (element: ExcalidrawElement): string => {
  if (isFrameLikeElement(element)) {
    return getFrameLikeTitle(element)
  }
  if (isTextElement(element) && element.text) {
    const text = element.text.replace(/\n/g, " ").trim()
    return text.length > 28 ? `${text.slice(0, 28)}…` : text
  }
  return `${element.type} (${element.id.slice(0, 6)})`
}

const isElementHidden = (element: ExcalidrawElement) => element.opacity === 0

const buildLayerItems = (
  elements: readonly ExcalidrawElement[],
): LayerItem[] => {
  const reversed = [...elements].reverse()
  const items: LayerItem[] = []
  const seenFrames = new Set<string>()

  for (const element of reversed) {
    if (isFrameLikeElement(element)) {
      if (!seenFrames.has(element.id)) {
        seenFrames.add(element.id)
        items.push({
          type: "frame",
          frame: element,
          children: getFrameChildren(elements, element.id).reverse(),
        })
      }
    } else if (!element.frameId) {
      items.push({ type: "element", element })
    }
  }

  return items
}

const ElementRow = ({
  element,
  isSelected,
  frames,
  onSelect,
  onToggleVisibility,
  onDelete,
  onChangeFrame,
  indent = false,
}: {
  element: ExcalidrawElement
  isSelected: boolean
  frames: ExcalidrawFrameLikeElement[]
  onSelect: (id: string) => void
  onToggleVisibility: (id: string) => void
  onDelete: (id: string) => void
  onChangeFrame: (elementId: string, frameId: string | null) => void
  indent?: boolean
}) => {
  const hidden = isElementHidden(element)

  return (
    <div
      className={`layers-panel__row${isSelected ? " layers-panel__row--selected" : ""}${hidden ? " layers-panel__row--hidden" : ""}`}
      style={indent ? { paddingLeft: "1.25rem" } : undefined}
      onClick={() => onSelect(element.id)}
      title={getElementLabel(element)}
    >
      <span className="layers-panel__row-label">{getElementLabel(element)}</span>
      {!isFrameLikeElement(element) && (
        <select
          className="layers-panel__frame-select"
          value={element.frameId ?? ""}
          onClick={(e) => e.stopPropagation()}
          onChange={(e) => {
            e.stopPropagation()
            onChangeFrame(element.id, e.target.value || null)
          }}
        >
          <option value="">No frame</option>
          {frames.map((frame) => (
            <option key={frame.id} value={frame.id}>
              {getFrameLikeTitle(frame)}
            </option>
          ))}
        </select>
      )}
      <div className="layers-panel__row-actions">
        <button
          type="button"
          className="layers-panel__action-btn"
          title={hidden ? "Show" : "Hide"}
          onClick={(e) => {
            e.stopPropagation()
            onToggleVisibility(element.id)
          }}
        >
          {hidden ? eyeClosedIcon : eyeIcon}
        </button>
        <button
          type="button"
          className="layers-panel__action-btn"
          title="Delete"
          onClick={(e) => {
            e.stopPropagation()
            onDelete(element.id)
          }}
        >
          {TrashIcon}
        </button>
      </div>
    </div>
  )
}

export const LayersPanel = ({
  excalidrawAPI,
}: {
  excalidrawAPI: ExcalidrawImperativeAPI
}) => {
  const [, setTick] = useState(0)
  const [panelOpen, setPanelOpen] = useState(true)
  const [collapsedFrames, setCollapsedFrames] = useState<Set<string>>(
    () => new Set(),
  )

  useEffect(() => {
    return excalidrawAPI.onChange(() => {
      setTick((t) => t + 1)
    })
  }, [excalidrawAPI])

  const elements = excalidrawAPI.getSceneElements()
  const { selectedElementIds } = excalidrawAPI.getAppState()

  const frames = useMemo(
    () => elements.filter(isFrameLikeElement) as ExcalidrawFrameLikeElement[],
    [elements],
  )

  const layerItems = useMemo(() => buildLayerItems(elements), [elements])

  const handleSelect = useCallback(
    (id: string) => {
      excalidrawAPI.updateScene({
        appState: {
          selectedElementIds: { [id]: true },
          selectedGroupIds: {},
        },
      })
      const element = elements.find((el) => el.id === id)
      if (element) {
        excalidrawAPI.scrollToContent(element, { animate: true })
      }
    },
    [excalidrawAPI, elements],
  )

  const handleToggleVisibility = useCallback(
    (elementId: string) => {
      const all = [...excalidrawAPI.getSceneElementsIncludingDeleted()]
      const nextElements = all.map((el) => {
        if (el.id !== elementId) {
          return el
        }
        const hidden = isElementHidden(el)
        return newElementWith(el, { opacity: hidden ? 100 : 0 })
      })
      excalidrawAPI.updateScene({
        elements: nextElements,
        captureUpdate: CaptureUpdateAction.IMMEDIATELY,
      })
    },
    [excalidrawAPI],
  )

  const handleDelete = useCallback(
    (elementId: string) => {
      const all = [...excalidrawAPI.getSceneElementsIncludingDeleted()]
      const target = all.find((el) => el.id === elementId)
      if (!target) {
        return
      }

      const isFrame = isFrameLikeElement(target)

      const nextElements = all.map((el) => {
        if (el.id === elementId) {
          return newElementWith(el, { isDeleted: true })
        }
        if (isFrame && el.frameId === elementId) {
          return newElementWith(el, { frameId: null })
        }
        return el
      })

      excalidrawAPI.updateScene({
        elements: nextElements,
        appState: {
          selectedElementIds: {},
          selectedGroupIds: {},
        },
        captureUpdate: CaptureUpdateAction.IMMEDIATELY,
      })
    },
    [excalidrawAPI],
  )

  const handleChangeFrame = useCallback(
    (elementId: string, frameId: string | null) => {
      const all = [...excalidrawAPI.getSceneElementsIncludingDeleted()]
      const element = all.find((el) => el.id === elementId)
      if (!element || isFrameLikeElement(element)) {
        return
      }

      if (frameId) {
        const frame = all.find(
          (el) => el.id === frameId && isFrameLikeElement(el),
        ) as ExcalidrawFrameLikeElement | undefined
        if (!frame) {
          return
        }
        const next = addElementsToFrame(all, [element], frame)
        excalidrawAPI.updateScene({
          elements: next,
          captureUpdate: CaptureUpdateAction.IMMEDIATELY,
        })
      } else {
        removeElementsFromFrame([element], arrayToMap(all))
        excalidrawAPI.updateScene({
          elements: all,
          captureUpdate: CaptureUpdateAction.IMMEDIATELY,
        })
      }
    },
    [excalidrawAPI],
  )

  const toggleFrameCollapsed = useCallback((frameId: string) => {
    setCollapsedFrames((prev) => {
      const next = new Set(prev)
      if (next.has(frameId)) {
        next.delete(frameId)
      } else {
        next.add(frameId)
      }
      return next
    })
  }, [])

  return (
    <div className="layers-panel">
      <div className="layers-panel__header">
        <span>Layers</span>
        <button
          type="button"
          className="layers-panel__toggle"
          onClick={() => setPanelOpen((open) => !open)}
          aria-expanded={panelOpen}
        >
          {panelOpen ? "−" : "+"}
        </button>
      </div>
      {panelOpen && (
        <div className="layers-panel__list">
          {layerItems.length === 0 ? (
            <div className="layers-panel__empty">No elements</div>
          ) : (
            layerItems.map((item) => {
              if (item.type === "element") {
                return (
                  <ElementRow
                    key={item.element.id}
                    element={item.element}
                    isSelected={!!selectedElementIds[item.element.id]}
                    frames={frames}
                    onSelect={handleSelect}
                    onToggleVisibility={handleToggleVisibility}
                    onDelete={handleDelete}
                    onChangeFrame={handleChangeFrame}
                  />
                )
              }

              const { frame, children } = item
              const isCollapsed = collapsedFrames.has(frame.id)
              const isFrameSelected = !!selectedElementIds[frame.id]
              const frameHidden = isElementHidden(frame)

              return (
                <div key={frame.id} className="layers-panel__frame">
                  <div
                    className={`layers-panel__frame-header${isFrameSelected ? " layers-panel__frame-header--selected" : ""}${frameHidden ? " layers-panel__row--hidden" : ""}`}
                  >
                    <span
                      className="layers-panel__frame-chevron"
                      onClick={(e) => {
                        e.stopPropagation()
                        toggleFrameCollapsed(frame.id)
                      }}
                    >
                      {isCollapsed ? "▸" : "▾"}
                    </span>
                    <span
                      className="layers-panel__frame-title"
                      onClick={() => handleSelect(frame.id)}
                      title={getFrameLikeTitle(frame)}
                    >
                      {getFrameLikeTitle(frame)}
                    </span>
                    <div className="layers-panel__frame-actions">
                      <button
                        type="button"
                        className="layers-panel__action-btn"
                        title={frameHidden ? "Show" : "Hide"}
                        onClick={(e) => {
                          e.stopPropagation()
                          handleToggleVisibility(frame.id)
                        }}
                      >
                        {frameHidden ? eyeClosedIcon : eyeIcon}
                      </button>
                      <button
                        type="button"
                        className="layers-panel__action-btn"
                        title="Delete"
                        onClick={(e) => {
                          e.stopPropagation()
                          handleDelete(frame.id)
                        }}
                      >
                        {TrashIcon}
                      </button>
                    </div>
                  </div>
                  {!isCollapsed && (
                    <div className="layers-panel__children">
                      {children.length === 0 ? (
                        <div
                          className="layers-panel__empty"
                          style={{ padding: "0.25rem 0.5rem" }}
                        >
                          Empty
                        </div>
                      ) : (
                        children.map((child) => (
                          <ElementRow
                            key={child.id}
                            element={child}
                            isSelected={!!selectedElementIds[child.id]}
                            frames={frames}
                            onSelect={handleSelect}
                            onToggleVisibility={handleToggleVisibility}
                            onDelete={handleDelete}
                            onChangeFrame={handleChangeFrame}
                            indent
                          />
                        ))
                      )}
                    </div>
                  )}
                </div>
              )
            })
          )}
        </div>
      )}
    </div>
  )
}
