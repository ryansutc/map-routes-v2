import type { RouteResponseDto } from "@/types/api";

export default function RouteInfoContainer({
  routeItem,
}: {
  routeItem: RouteResponseDto;
}) {
  return (
    <div>
      <h2>{routeItem.title}</h2>
      <p>{routeItem.notes}</p>
    </div>
  );
}
