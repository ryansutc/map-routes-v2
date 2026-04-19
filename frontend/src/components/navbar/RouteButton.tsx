import { useStore } from "@/state/store";
import { Button, Fade, styled } from "@mui/material";

const StyledButton = styled(Button)(() => ({
  textTransform: "none",
}));

export default function RouteButton() {
  const { page, setPage } = useStore();
  return (
    <Fade in timeout={600}>
      <StyledButton
        variant="text"
        color="primary"
        sx={{
          color: page === "route" ? "primary.main" : "primary.dark",
        }}
        onClick={() => setPage("route")}
      >
        Route
      </StyledButton>
    </Fade>
  );
}
