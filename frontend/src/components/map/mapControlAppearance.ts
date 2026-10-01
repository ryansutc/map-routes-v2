export const DISABLED_MAP_CONTROL_OPACITY = 0.7;

type WidgetWithContainer = {
  container?: HTMLElement | string | null;
};

export function setMapWidgetDisabledAppearance(
  widget: unknown,
  disabled: boolean,
): void {
  if (!widget || typeof widget !== "object") return;
  const container = (widget as WidgetWithContainer).container;
  if (!(container instanceof HTMLElement)) return;
  container.style.opacity = String(
    disabled ? DISABLED_MAP_CONTROL_OPACITY : 1,
  );
}
