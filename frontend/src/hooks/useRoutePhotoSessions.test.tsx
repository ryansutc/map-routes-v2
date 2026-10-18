// @vitest-environment jsdom

import { act, renderHook } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { useRoutePhotoSessions } from "./useRoutePhotoSessions";

describe("useRoutePhotoSessions", () => {
  it("exposes the photo currently open in the lightbox", () => {
    const photos = [
      { id: 7, url: "/first.jpg" },
      { id: 8, url: "/second.jpg" },
    ];
    const { result } = renderHook(() => useRoutePhotoSessions(photos));

    expect(result.current.openPhotoId).toBeNull();

    act(() => result.current.onPhotoClick(0));
    expect(result.current.openPhotoId).toBe(7);

    act(() => result.current.lightbox.onIndexChange(1));
    expect(result.current.openPhotoId).toBe(8);

    act(() => result.current.lightbox.onClose());
    expect(result.current.openPhotoId).toBeNull();
  });
});
