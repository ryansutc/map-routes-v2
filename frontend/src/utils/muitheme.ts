import { alpha, createTheme } from "@mui/material/styles";

// My default color:
const primaryBase = "#273E72";
const secondaryBase = "#AB812E";

const primary = {
  main: primaryBase,
  light: alpha(primaryBase, 0.5),
  dark: alpha(primaryBase, 0.9),
  contrastText: "#fff",
};

const theme = createTheme({
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
    primary: primary,
    secondary: {
      main: alpha(secondaryBase, 0.7),
      light: alpha(secondaryBase, 0.5),
      dark: alpha(secondaryBase, 0.9),
      contrastText: alpha("#000", 0.7), // Black text for contrast
    },
    background: {
      default: "#f5f5f5", // Light gray background
      paper: "#fff", // White paper background
    },
  },
});

export default theme;
