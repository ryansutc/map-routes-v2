export const MAX_ROUTE_TITLE_LENGTH = 255;

export function normalizeRouteTitle(title: string): string {
  return title.trim();
}

export function getRouteTitleError(title: string): string | null {
  const normalizedTitle = normalizeRouteTitle(title);
  if (!normalizedTitle) return "Title is required";
  if (normalizedTitle.length > MAX_ROUTE_TITLE_LENGTH) {
    return `Title must be ${MAX_ROUTE_TITLE_LENGTH} characters or fewer`;
  }
  return null;
}
