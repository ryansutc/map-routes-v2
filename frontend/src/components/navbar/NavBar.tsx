import { Divider } from "@mui/material";
import Grid from "@mui/material/Grid";
import Typography from "@mui/material/Typography";

import useBootstrapWidth from "@/hooks/useBootstrapWidth";
import NavBarMenu from "./NavBarMenu";
import RouteButton from "./RouteButton";

export default function NavBar() {
  const maxwidth = useBootstrapWidth();

  return (
    <Grid
      container
      position="fixed"
      sx={{
        boxShadow: 0,
        backgroundImage: "none",
        textAlign: "left",
        alignItems: "center",
        position: "fixed",
        top: 0,
        left: 0,
        mx: "auto",
        width: "100%",
        justifyContent: "center",
        marginBottom: "16px",
        marginTop: "8px",
        py: "8px",
      }}
    >
      <Grid
        container
        sx={{
          justifyContent: "space-between",
          maxWidth: maxwidth,
          width: "100%",
          px: "0.75rem",
        }}
      >
        <Grid sx={{ flexGrow: 1 }}>
          <Typography variant="h6" color="black" component="span">
            Map Routes
          </Typography>
          <RouteButton />
        </Grid>

        <NavBarMenu />
      </Grid>
      <Grid container justifyContent="center">
        <Divider id="divider" style={{ width: "95%" }} />
      </Grid>
    </Grid>
  );
}
