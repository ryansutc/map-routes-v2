/** ArcGIS-only hover and selection feedback for route photo markers. */
import type Graphic from "@arcgis/core/Graphic";
import type GraphicsLayer from "@arcgis/core/layers/GraphicsLayer";
import { debounce, isAbortError } from "@arcgis/core/core/promiseUtils";
import HighlightOptions from "@arcgis/core/views/support/HighlightOptions";
import type MapView from "@arcgis/core/views/MapView";
import type SceneView from "@arcgis/core/views/SceneView";

const HOVER_HIGHLIGHT_NAME = "route-photo-marker-hover";
const SELECTED_HIGHLIGHT_NAME = "route-photo-marker-selected";

export type ArcGisPhotoMarkerInteractions = {
  setOpenPhotoId: (photoId: number | null) => void;
  destroy: () => void;
};

export async function createArcGisPhotoMarkerInteractions(
  view: MapView | SceneView,
  layer: GraphicsLayer,
  graphicsByPhotoId: ReadonlyMap<number, Graphic>,
): Promise<ArcGisPhotoMarkerInteractions> {
  const layerView = (await view.whenLayerView(
    layer,
  )) as __esri.GraphicsLayerView;
  const container = view.container;
  const originalCursor =
    container instanceof HTMLElement ? container.style.cursor : "";
  let destroyed = false;
  let hoveredGraphic: Graphic | null = null;
  let hoverHighlight: __esri.Handle | null = null;
  let selectedHighlight: __esri.Handle | null = null;

  const hoverOptions = new HighlightOptions({
    name: HOVER_HIGHLIGHT_NAME,
    color: "#ffffff",
    haloColor: "#ffffff",
    fillOpacity: 0.12,
    haloOpacity: 0.8,
  });
  const selectedOptions = new HighlightOptions({
    name: SELECTED_HIGHLIGHT_NAME,
    color: "#00b8d9",
    haloColor: "#00e5ff",
    fillOpacity: 0.3,
    haloOpacity: 1,
  });
  view.highlights.addMany([hoverOptions, selectedOptions]);

  const setHoveredGraphic = (graphic: Graphic | null) => {
    if (hoveredGraphic === graphic) return;
    hoveredGraphic = graphic;
    hoverHighlight?.remove();
    hoverHighlight = graphic
      ? layerView.highlight(graphic, { name: HOVER_HIGHLIGHT_NAME })
      : null;
    if (container instanceof HTMLElement) {
      container.style.cursor = graphic ? "pointer" : originalCursor;
    }
  };

  const updateHover = debounce(async (event: __esri.ViewPointerMoveEvent) => {
    const response = await view.hitTest(event, { include: layer });
    if (destroyed) return;
    const result = response.results.find(
      (candidate) =>
        candidate.type === "graphic" &&
        "graphic" in candidate &&
        candidate.graphic.layer === layer,
    );
    setHoveredGraphic(result && "graphic" in result ? result.graphic : null);
  });

  const pointerMoveHandle = view.on("pointer-move", (event) => {
    void updateHover(event).catch((error: unknown) => {
      if (!(error instanceof Error && isAbortError(error as __esri.Error))) {
        setHoveredGraphic(null);
      }
    });
  });
  const pointerLeaveHandle = view.on("pointer-leave", () => {
    setHoveredGraphic(null);
  });

  return {
    setOpenPhotoId: (photoId) => {
      selectedHighlight?.remove();
      selectedHighlight = null;
      const graphic =
        photoId === null ? undefined : graphicsByPhotoId.get(photoId);
      if (graphic) {
        selectedHighlight = layerView.highlight(graphic, {
          name: SELECTED_HIGHLIGHT_NAME,
        });
      }
    },
    destroy: () => {
      destroyed = true;
      pointerMoveHandle.remove();
      pointerLeaveHandle.remove();
      hoverHighlight?.remove();
      selectedHighlight?.remove();
      view.highlights.remove(hoverOptions);
      view.highlights.remove(selectedOptions);
      if (container instanceof HTMLElement)
        container.style.cursor = originalCursor;
    },
  };
}
