import { Grid, Typography } from "@mui/material";
import type { PropsWithChildren } from "react";

export default function RouteWrapper({ children }: PropsWithChildren) {
  return (
    <>
      <Grid>
        <Typography></Typography>
      </Grid>
      <Grid>{children}</Grid>
    </>
  );
}
