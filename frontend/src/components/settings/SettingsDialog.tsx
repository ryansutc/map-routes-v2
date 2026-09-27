import { GeneralSettings } from "@/components/settings/GeneralSettings";
import {
  MapAnimationSettings,
  type MapAnimationRouteContext,
} from "@/components/settings/MapAnimationSettings";
import type { AnimationPauseReason } from "@/domain/routeAnimation";
import CloseIcon from "@mui/icons-material/Close";
import SettingsIcon from "@mui/icons-material/Settings";
import {
  Box,
  Dialog,
  DialogContent,
  DialogTitle,
  Divider,
  IconButton,
  List,
  ListItemButton,
  ListItemText,
  keyframes,
  useMediaQuery,
  useTheme,
} from "@mui/material";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type PropsWithChildren,
  type ReactNode,
} from "react";
export type SettingsSection = "general" | "map-animation";

export type RouteSettingsContext = MapAnimationRouteContext &
  Readonly<{
    acquirePause: (reason: AnimationPauseReason) => () => void;
  }>;

type SettingsDialogContextValue = {
  openSettings: (section: SettingsSection) => void;
  registerRouteContext: (context: RouteSettingsContext) => () => void;
};

const SettingsDialogContext = createContext<SettingsDialogContextValue | null>(
  null,
);

function SectionPanel({ children }: { children: ReactNode }) {
  return <Box sx={{ p: { xs: 2, sm: 3 }, my: "12px" }}>{children}</Box>;
}

const sectionHighlight = keyframes`
  from { background-color: rgba(33, 150, 243, 0.18); }
  to { background-color: transparent; }
`;

function SettingsDialog({
  open,
  initialSection,
  routeContext,
  onClose,
}: {
  open: boolean;
  initialSection: SettingsSection;
  routeContext: RouteSettingsContext | null;
  onClose: () => void;
}) {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down("sm"));
  const [highlightedSection, setHighlightedSection] =
    useState<SettingsSection | null>(null);
  const generalSectionRef = useRef<HTMLDivElement | null>(null);
  const animationSectionRef = useRef<HTMLDivElement | null>(null);
  const highlightTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(
    null,
  );
  const highlightFrameRef = useRef<number | null>(null);

  const getSectionElement = (section: SettingsSection) =>
    section === "general"
      ? generalSectionRef.current
      : animationSectionRef.current;

  useEffect(() => {
    if (!open) return;
    const animationFrameId = requestAnimationFrame(() => {
      getSectionElement(initialSection)?.scrollIntoView?.({
        behavior: "auto",
        block: "start",
      });
    });
    return () => cancelAnimationFrame(animationFrameId);
  }, [initialSection, open]);

  useEffect(
    () => () => {
      if (highlightTimeoutRef.current) {
        clearTimeout(highlightTimeoutRef.current);
      }
      if (highlightFrameRef.current !== null) {
        cancelAnimationFrame(highlightFrameRef.current);
      }
    },
    [],
  );

  const navigateToSection = (section: SettingsSection) => {
    getSectionElement(section)?.scrollIntoView?.({
      behavior: "smooth",
      block: "start",
    });

    if (highlightTimeoutRef.current) {
      clearTimeout(highlightTimeoutRef.current);
    }
    if (highlightFrameRef.current !== null) {
      cancelAnimationFrame(highlightFrameRef.current);
    }
    // Clear first so clicking the same link twice restarts the animation.
    setHighlightedSection(null);
    highlightFrameRef.current = requestAnimationFrame(() => {
      setHighlightedSection(section);
      highlightFrameRef.current = null;
    });
    highlightTimeoutRef.current = setTimeout(
      () => setHighlightedSection(null),
      1500,
    );
  };

  const sectionSx = (section: SettingsSection) => ({
    scrollMarginTop: 1,
    ...(highlightedSection === section && {
      animation: `${sectionHighlight} 1.5s ease-out`,
    }),
  });

  return (
    <Dialog
      open={open}
      onClose={onClose}
      fullScreen={isMobile}
      fullWidth
      maxWidth="md"
      aria-labelledby="settings-dialog-title"
      PaperProps={{
        sx: isMobile ? undefined : { height: "min(600px, 85vh)" },
      }}
    >
      <DialogTitle
        id="settings-dialog-title"
        sx={(theme) => ({
          ...theme.mixins.toolbar,
          display: "flex",
          alignItems: "center",
          flexShrink: 0,
          boxSizing: "border-box",
          px: { xs: 2, sm: 3 },
          py: 0,
          bgcolor: "primary.main",
          color: "primary.contrastText",
        })}
      >
        <SettingsIcon sx={{ paddingBottom: "4px" }} />{" "}
        <Box sx={{ marginLeft: "8px" }}> Settings </Box>
        <IconButton
          aria-label="Close settings"
          onClick={onClose}
          sx={{ ml: "auto", color: "inherit" }}
        >
          <CloseIcon />
        </IconButton>
      </DialogTitle>
      <Divider />
      <DialogContent sx={{ display: "flex", p: 0, minHeight: 0 }}>
        {!isMobile && (
          <List
            component="nav"
            aria-label="Settings sections"
            sx={{
              width: 200,
              flexShrink: 0,
              borderRight: 1,
              borderColor: "divider",
              py: 0,
            }}
          >
            <ListItemButton
              component="a"
              href="#settings-general"
              onClick={(event) => {
                event.preventDefault();
                navigateToSection("general");
              }}
            >
              <ListItemText
                primary="General"
                slotProps={{ primary: { variant: "button" } }}
              />
            </ListItemButton>
            <ListItemButton
              component="a"
              href="#settings-map-animation"
              onClick={(event) => {
                event.preventDefault();
                navigateToSection("map-animation");
              }}
            >
              <ListItemText
                primary="Map Animation"
                slotProps={{ primary: { variant: "button" } }}
              />
            </ListItemButton>
          </List>
        )}
        <Box sx={{ flex: 1, minWidth: 0, overflowY: "auto" }}>
          <Box
            id="settings-general"
            ref={generalSectionRef}
            data-highlighted={
              highlightedSection === "general" ? "true" : undefined
            }
            sx={sectionSx("general")}
          >
            <SectionPanel>
              <GeneralSettings />
            </SectionPanel>
          </Box>
          <Divider />
          <Box
            id="settings-map-animation"
            ref={animationSectionRef}
            data-highlighted={
              highlightedSection === "map-animation" ? "true" : undefined
            }
            sx={sectionSx("map-animation")}
          >
            <SectionPanel>
              <MapAnimationSettings routeContext={routeContext} />
            </SectionPanel>
            <Box
              data-testid="settings-bottom-padding"
              sx={{ height: "140px" }}
            ></Box>
          </Box>
        </Box>
      </DialogContent>
    </Dialog>
  );
}

export function SettingsDialogProvider({ children }: PropsWithChildren) {
  const [open, setOpen] = useState(false);
  const [initialSection, setInitialSection] =
    useState<SettingsSection>("general");
  const [routeContext, setRouteContext] = useState<RouteSettingsContext | null>(
    null,
  );

  const openSettings = useCallback((section: SettingsSection) => {
    setInitialSection(section);
    setOpen(true);
  }, []);
  const registerRouteContext = useCallback((context: RouteSettingsContext) => {
    setRouteContext(context);
    return () =>
      setRouteContext((current) => (current === context ? null : current));
  }, []);

  useEffect(() => {
    if (!open || !routeContext) return;
    return routeContext.acquirePause("settings-dialog");
  }, [open, routeContext]);

  const value = useMemo(
    () => ({ openSettings, registerRouteContext }),
    [openSettings, registerRouteContext],
  );

  return (
    <SettingsDialogContext.Provider value={value}>
      {children}
      <SettingsDialog
        open={open}
        initialSection={initialSection}
        routeContext={routeContext}
        onClose={() => setOpen(false)}
      />
    </SettingsDialogContext.Provider>
  );
}

// The provider and its hook intentionally share this module as one UI API.
// eslint-disable-next-line react-refresh/only-export-components
export function useSettingsDialog() {
  const context = useContext(SettingsDialogContext);
  if (!context) {
    throw new Error(
      "useSettingsDialog must be used within SettingsDialogProvider",
    );
  }
  return context;
}
