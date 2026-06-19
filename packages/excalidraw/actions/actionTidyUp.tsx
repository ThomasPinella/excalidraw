import { getNonDeletedElements } from "@excalidraw/element";

import { isFrameLikeElement } from "@excalidraw/element";

import { updateFrameMembershipOfSelectedElements } from "@excalidraw/element";

import { KEYS, arrayToMap } from "@excalidraw/common";

import { tidyElements } from "@excalidraw/element";

import { CaptureUpdateAction } from "@excalidraw/element";

import { isBindableElement, isLinearElement } from "@excalidraw/element";

import type { ExcalidrawElement } from "@excalidraw/element/types";

import { ToolButton } from "../components/ToolButton";
import { TidyUpIcon } from "../components/icons";

import { t } from "../i18n";

import { isSomeElementSelected } from "../scene";

import { getShortcutKey } from "../shortcut";

import { register } from "./register";

import type { AppClassProperties, AppState, UIAppState } from "../types";

export const tidyActionsPredicate = (
  appState: UIAppState,
  app: AppClassProperties,
) => {
  const selectedElements = app.scene.getSelectedElements(appState);

  if (selectedElements.some((element) => isFrameLikeElement(element))) {
    return false;
  }

  const bindableNodes = selectedElements.filter((element) =>
    isBindableElement(element),
  );

  if (bindableNodes.length < 2) {
    return false;
  }

  const bindableIds = new Set(bindableNodes.map((node) => node.id));

  return selectedElements.some(
    (element) =>
      isLinearElement(element) &&
      element.startBinding?.elementId &&
      bindableIds.has(element.startBinding.elementId) &&
      element.endBinding?.elementId &&
      bindableIds.has(element.endBinding.elementId),
  );
};

const tidySelectedElements = (
  elements: readonly ExcalidrawElement[],
  appState: Readonly<AppState>,
  app: AppClassProperties,
) => {
  const selectedElements = app.scene.getSelectedElements(appState);

  const updatedElements = tidyElements(selectedElements, app.scene, appState);

  const updatedElementsMap = arrayToMap(updatedElements);

  return updateFrameMembershipOfSelectedElements(
    elements.map((element) => updatedElementsMap.get(element.id) || element),
    appState,
    app,
  );
};

export const actionTidyUp = register({
  name: "tidyUp",
  label: "labels.tidyUp",
  icon: TidyUpIcon,
  trackEvent: { category: "element" },
  predicate: (elements, appState, appProps, app) =>
    tidyActionsPredicate(appState, app),
  perform: (elements, appState, _, app) => {
    return {
      appState,
      elements: tidySelectedElements(elements, appState, app),
      captureUpdate: CaptureUpdateAction.IMMEDIATELY,
    };
  },
  keyTest: (event) =>
    event[KEYS.CTRL_OR_CMD] && event.altKey && event.key === KEYS.T,
  PanelComponent: ({ elements, appState, updateData, app }) => (
    <ToolButton
      hidden={!tidyActionsPredicate(appState, app)}
      type="button"
      icon={TidyUpIcon}
      onClick={() => updateData(null)}
      title={`${t("labels.tidyUp")} — ${getShortcutKey("CtrlOrCmd+Alt+T")}`}
      aria-label={t("labels.tidyUp")}
      visible={isSomeElementSelected(getNonDeletedElements(elements), appState)}
    />
  ),
});
