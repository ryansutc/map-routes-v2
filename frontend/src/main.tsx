import { createRoot } from "react-dom/client";
import "./index.css";
// Import the generated route tree
import App from "./App";

createRoot(document.getElementById("root")!).render(
  // TODO deal with later
  // <StrictMode> //ESRI Widgets won't work with React Strict Mode. We need to disable it.
  <App />
  // </StrictMode>
);
