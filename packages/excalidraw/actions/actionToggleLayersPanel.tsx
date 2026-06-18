import { CaptureUpdateAction } from "@excalidraw/element";

import { layersIcon } from "../components/icons";

import { register } from "./register";

export const actionToggleLayersPanel = register({
  name: "layersPanel",
  label: "layersPanel.title",
  icon: layersIcon,
  viewMode: true,
  trackEvent: { category: "menu" },
  keywords: ["layers", "frames", "panel", "objects"],
  perform(elements, appState) {
    return {
      appState: {
        ...appState,
        layersPanelOpen: !this.checked!(appState),
      },
      captureUpdate: CaptureUpdateAction.EVENTUALLY,
    };
  },
  checked: (appState) => appState.layersPanelOpen,
});
