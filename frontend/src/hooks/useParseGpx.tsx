import { zodiosAPI } from "@/api/axiosClient";
import { useMutation } from "@tanstack/react-query";

/**
 * Provides the GPX parsing mutation used by the route metadata form step.
 * The returned mutation accepts the uploaded `File` when invoked.
 */
export function useParseGpx() {
  return useMutation({
    mutationFn: (file: File) =>
      zodiosAPI.route_parse_gpx_create({ file }),
  });
}
