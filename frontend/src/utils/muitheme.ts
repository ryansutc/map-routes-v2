import { alpha, createTheme, type PaletteMode } from "@mui/material/styles";

// My default color:
const primaryBase = "#273E72";
const secondaryBase = "#FFEB3B";

const lightPrimary = {
  main: primaryBase,
  light: alpha(primaryBase, 0.5),
  dark: alpha(primaryBase, 0.9),
  contrastText: "#fff",
};

const darkPrimary = {
  main: "#B8C9FF",
  light: "#DEE6FF",
  dark: "#7D9CEB",
  contrastText: "#10234D",
};

const lightBackground = {
  default: "#f5f5f5", // Light gray background
  paper: "#fff", // White paper background
};

/** Creates the application's Material UI theme for the selected color mode. */
export function createAppTheme(mode: PaletteMode) {
  const primary = mode === "dark" ? darkPrimary : lightPrimary;
  const background = mode === "light" ? lightBackground : undefined;

  return createTheme({
    typography: {
      fontFamily: "var(--font-roboto)",
      /* Fluid typography */
      h3: {
        fontSize: "clamp(2rem, 4vw + 1rem, 4rem)",
      },
      h4: {
        fontSize: "clamp(1.5rem, 2vw + 1rem, 2.125rem)",
      },
      h5: {
        fontSize: "clamp(1.25rem, 1vw + 1rem, 1.5rem)",
      },
      h6: {
        fontSize: "clamp(1.1rem, 0.5vw + 1rem, 1.25rem)",
      },
    },
    palette: {
      mode,
      primary,
      secondary: {
        main: secondaryBase,
        light: "#FFF176",
        dark: "#FBC02D",
        contrastText: alpha("#000", 0.7), // Black text for contrast
      },
      ...(background && { background }),
    },
  });
}

export default createAppTheme;
