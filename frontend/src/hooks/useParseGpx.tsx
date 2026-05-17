import { zodiosAPI } from "@/api/axiosClient";
import { useMutation } from "@tanstack/react-query";

export function useParseGpx() {
  return useMutation({
    mutationFn: (file: File) =>
      zodiosAPI.route_parse_gpx_create({ file }),
  });
}
