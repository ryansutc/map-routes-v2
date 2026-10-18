import Color from "@arcgis/core/Color.js";
import IconSymbol3DLayer from "@arcgis/core/symbols/IconSymbol3DLayer.js";
import PointSymbol3D from "@arcgis/core/symbols/PointSymbol3D.js";
import LineCallout3D from "@arcgis/core/symbols/callouts/LineCallout3D.js";
import Symbol3DVerticalOffset from "@arcgis/core/symbols/support/Symbol3DVerticalOffset.js";
import sphereMarkerUrl from "./sphereMarker.svg";

import {
  BALL_DIAMETER_PX,
  BALL_MAX_WORLD_OFFSET_M,
  BALL_MIN_WORLD_OFFSET_M,
  BALL_VERTICAL_OFFSET_PX,
} from "../routeMarkerLayout";

export const ball3D = new PointSymbol3D({
  callout: new LineCallout3D({
    color: new Color([0, 0, 0, 1]),
    size: 6,
  }),
  symbolLayers: [
    new IconSymbol3DLayer({
      anchor: "center",
      resource: {
        href: sphereMarkerUrl,
      },
      size: `${BALL_DIAMETER_PX}px`,
    }),
  ],
  verticalOffset: new Symbol3DVerticalOffset({
    maxWorldLength: BALL_MAX_WORLD_OFFSET_M,
    minWorldLength: BALL_MIN_WORLD_OFFSET_M,
    // A CSS unit keeps the lift stable on screen as the camera scale changes.
    screenLength: `${BALL_VERTICAL_OFFSET_PX}px`,
  }),
});
