import { getContrastRatio } from "@mui/material/styles";
import { describe, expect, it } from "vitest";
import { createAppTheme } from "./muitheme";

describe("createAppTheme", () => {
  it("creates accessible light and dark global palettes", () => {
    for (const mode of ["light", "dark"] as const) {
      const theme = createAppTheme(mode);

      expect(theme.palette.mode).toBe(mode);
      expect(
        getContrastRatio(
          theme.palette.primary.main,
          theme.palette.primary.contrastText,
        ),
      ).toBeGreaterThanOrEqual(4.5);
    }
  });
});
