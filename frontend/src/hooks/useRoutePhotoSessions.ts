import type {
  AutomaticPhotoPresentation,
  ManualPhotoPresentation,
  PhotoSessionController,
  TimedPhotoPresenter,
} from "@/domain/timedPhotoPlayback";
import { resolvePhotoUrl } from "@/utils/dropboxImgHelpers";
import { useCallback, useMemo, useRef, useState } from "react";

type RoutePhoto = {
  id: number;
  url: string;
};

/**
 * Coordinates manual and timed photo lightbox sessions for the route detail page.
 *
 * @param photos - Ordered route photos available to the lightbox and animation.
 */
export function useRoutePhotoSessions(photos: readonly RoutePhoto[]) {
  const [selectedPhotoIndex, setSelectedPhotoIndex] = useState<number | null>(
    null,
  );
  const [automaticPhoto, setAutomaticPhoto] =
    useState<AutomaticPhotoPresentation | null>(null);
  const [manualAnimationPhoto, setManualAnimationPhoto] =
    useState<ManualPhotoPresentation | null>(null);
  const controllerRef = useRef<PhotoSessionController | null>(null);
  const photoUrls = useMemo(
    () =>
      new Map(
        photos.map((photo) => [photo.id, resolvePhotoUrl(photo.url)]),
      ),
    [photos],
  );
  const presenter = useMemo<TimedPhotoPresenter>(
    () => ({
      open: (presentation) => {
        if (presentation.kind === "automatic") {
          setAutomaticPhoto(presentation);
          return;
        }
        setAutomaticPhoto(null);
        setManualAnimationPhoto(presentation);
      },
      close: (sessionId) => {
        setAutomaticPhoto((current) =>
          current?.sessionId === sessionId ? null : current,
        );
        setManualAnimationPhoto((current) =>
          current?.sessionId === sessionId ? null : current,
        );
      },
      preload: (photoIds) => {
        for (const photoId of photoIds) {
          const url = photoUrls.get(photoId);
          if (!url) continue;
          const image = new Image();
          image.src = url;
        }
      },
    }),
    [photoUrls],
  );

  const onControllerChange = useCallback(
    (controller: PhotoSessionController | null) => {
      controllerRef.current = controller;
    },
    [],
  );
  const onPhotoClick = useCallback(
    (index: number) => {
      const photo = photos[index];
      if (photo && controllerRef.current?.openManualPhoto(photo.id)) return;
      setSelectedPhotoIndex(index);
    },
    [photos],
  );
  const onIndexChange = useCallback(
    (index: number) => {
      if (!manualAnimationPhoto) {
        setSelectedPhotoIndex(index);
        return;
      }
      const photo = photos[index];
      if (!photo) return;
      setManualAnimationPhoto((current) =>
        current?.sessionId === manualAnimationPhoto.sessionId
          ? { ...current, photoId: photo.id }
          : current,
      );
    },
    [manualAnimationPhoto, photos],
  );

  return {
    presenter,
    onControllerChange,
    onPhotoClick,
    automaticPhoto,
    lightbox: {
      index: manualAnimationPhoto
        ? photos.findIndex((photo) => photo.id === manualAnimationPhoto.photoId)
        : selectedPhotoIndex,
      onIndexChange,
      onClose: manualAnimationPhoto
        ? manualAnimationPhoto.onDismiss
        : () => setSelectedPhotoIndex(null),
      onStopPlayback: manualAnimationPhoto?.onStop,
    },
  };
}
