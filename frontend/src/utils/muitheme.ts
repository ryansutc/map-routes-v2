import { alpha, createTheme } from "@mui/material/styles";

// My default color:
const primaryBase = "#273E72";
const secondaryBase = "#AB812E";

const primary = {
  main: alpha(primaryBase, 0.7),
  light: alpha(primaryBase, 0.5),
  dark: alpha(primaryBase, 0.9),
  contrastText: "#fff",
};

const theme = createTheme({
  typography: {
    fontFamily: "var(--font-roboto)",
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
