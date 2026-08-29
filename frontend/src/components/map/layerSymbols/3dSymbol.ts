import Color from "@arcgis/core/Color.js";
import IconSymbol3DLayer from "@arcgis/core/symbols/IconSymbol3DLayer.js";
import PointSymbol3D from "@arcgis/core/symbols/PointSymbol3D.js";
import LineCallout3D from "@arcgis/core/symbols/callouts/LineCallout3D.js";
import Symbol3DVerticalOffset from "@arcgis/core/symbols/support/Symbol3DVerticalOffset.js";
import sphereMarkerUrl from "./sphereMarker.svg";

const BALL_DIAMETER_PX = 24;
const BALL_VERTICAL_OFFSET_PX = 24;

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
    maxWorldLength: 101,
    minWorldLength: 4,
    // A CSS unit keeps the lift stable on screen as the camera scale changes.
    screenLength: `${BALL_VERTICAL_OFFSET_PX}px`,
  }),
});
