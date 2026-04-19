import { createRoot } from "react-dom/client";
import "./index.css";
// Import the generated route tree
import App from "./App";

// Configure ArcGIS
import esriConfig from "@arcgis/core/config";

// Set up ArcGIS asset paths
if (import.meta.env.PROD) {
  esriConfig.assetsPath = "/react/assets/esri";
} else {
  esriConfig.assetsPath = "https://js.arcgis.com/4.33/@arcgis/core/assets";
}

createRoot(document.getElementById("root")!).render(
  // TODO deal with later
  // <StrictMode> //ESRI Widgets won't work with React Strict Mode. We need to disable it.
  <App />
  // </StrictMode>
);
