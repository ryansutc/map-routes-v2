import { basemap24 } from "@esri/calcite-ui-icons/js/basemap24";
import CheckIcon from "@mui/icons-material/Check";
import {
  Box,
  IconButton,
  Menu,
  MenuItem,
  SvgIcon,
  Tooltip,
  Typography,
} from "@mui/material";
import { useState, type MouseEvent } from "react";

export interface BasemapOption {
  id: string;
  label: string;
  thumbnailUrl: string;
}

interface BasemapSelectorProps {
  options: readonly BasemapOption[];
  selectedId: string;
  disabled?: boolean;
  onSelect: (id: string) => void;
}

function BasemapIcon() {
  return (
    <SvgIcon viewBox="0 0 24 24" aria-hidden="true">
      <path d={basemap24} />
    </SvgIcon>
  );
}

/**
 * Basemap Selector Component for Map
 * @param props
 * @returns
 */
export default function BasemapSelector({
  options,
  selectedId,
  disabled = false,
  onSelect,
}: BasemapSelectorProps) {
  const [anchorElement, setAnchorElement] = useState<HTMLElement | null>(null);
  const [failedThumbnails, setFailedThumbnails] = useState<Set<string>>(
    () => new Set(),
  );
  const open = Boolean(anchorElement);

  const handleOpen = (event: MouseEvent<HTMLElement>) => {
    setAnchorElement(event.currentTarget);
  };

  const handleClose = () => setAnchorElement(null);

  return (
    <Box
      sx={{
        position: "absolute",
        left: 16,
        bottom: 24,
        zIndex: 1000,
        width: 44,
        height: 44,
        backgroundColor: "white",
        borderRadius: "50%",
      }}
    >
      <Tooltip title="Choose basemap" placement="top">
        <span>
          <IconButton
            aria-label="Choose basemap"
            aria-haspopup="menu"
            aria-expanded={open ? "true" : undefined}
            disabled={disabled}
            onClick={handleOpen}
            sx={{
              width: 44,
              height: 44,
              bgcolor: "background.paper",
              boxShadow: 2,
              "&:hover": { bgcolor: "rgba(0,0,0,0.08)" },
            }}
          >
            <BasemapIcon />
          </IconButton>
        </span>
      </Tooltip>
      <Menu
        anchorEl={anchorElement}
        open={open && !disabled}
        onClose={handleClose}
        anchorOrigin={{ vertical: "top", horizontal: "left" }}
        transformOrigin={{ vertical: "bottom", horizontal: "left" }}
        slotProps={{
          list: { "aria-label": "Basemaps" },
          // The Popover pins the paper's bottom edge to the anchor's top edge.
          // A negative top margin offsets the absolutely positioned paper up.
          paper: { sx: { mt: -0.5, minWidth: 196 } },
          transition: {
            onExited: () => {
              if (disabled) handleClose();
            },
          },
        }}
      >
        {options.map((option) => {
          const selected = option.id === selectedId;
          return (
            <MenuItem
              key={option.id}
              role="menuitemradio"
              aria-checked={selected}
              selected={selected}
              onClick={() => {
                handleClose();
                if (!selected) onSelect(option.id);
              }}
              sx={{ gap: 1, py: 0.75 }}
            >
              <Box
                sx={{
                  width: 32,
                  height: 32,
                  flex: "0 0 32px",
                  display: "grid",
                  placeItems: "center",
                  overflow: "hidden",
                  borderRadius: 0.5,
                  bgcolor: "action.hover",
                }}
              >
                {failedThumbnails.has(option.id) ? (
                  <BasemapIcon />
                ) : (
                  <Box
                    component="img"
                    src={option.thumbnailUrl}
                    alt=""
                    sx={{ width: 32, height: 32, objectFit: "cover" }}
                    onError={() =>
                      setFailedThumbnails((current) => {
                        const next = new Set(current);
                        next.add(option.id);
                        return next;
                      })
                    }
                  />
                )}
              </Box>
              <Typography component="span" variant="body2" sx={{ flex: 1 }}>
                {option.label}
              </Typography>
              <Box sx={{ width: 24, height: 24 }}>
                {selected && <CheckIcon fontSize="small" />}
              </Box>
            </MenuItem>
          );
        })}
      </Menu>
    </Box>
  );
}
