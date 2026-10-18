# Visibility-driven route following (#86)

Follow along keeps the progress icon comfortably visible while allowing the
camera to rest. It no longer promises exact centering on every playback frame.

The map adapter projects the ground anchor into screen coordinates. Bounds
reserve space for view padding, the icon, its 3D lift, and playback controls.
Every 100 ms, the follow controller checks a safe area inset 20% from those
bounds. It moves if the current position or the predicted position at the end
of a transition leaves that area.

Transitions retain the tested 1,300 ms duration and ease-in-out easing. The
target looks ahead by that duration plus 500 ms of playback time. Eight samples
of the actual playback path limit the target so the current position and the
sampled prefix fit the destination safe area. This translation estimate is
approximate in tilted 3D; ongoing checks use the actual view projection. The
preview uses current playback settings, holds during pauses, and stops at
segment boundaries rather than anticipating a jump across a recording gap.

Ordinary camera operations finish without per-frame cancellation. Reaching a
5% emergency margin interrupts an ordinary move and recenters instantly. That
recovery is allowed to finish, including terrain preparation. Explicit playback
relocations, segment changes, and settings changes cause immediate reassessment.
Disabling follow, Stop, completion, hidden-document pauses, and unmount cancel
pending navigation via an abort signal and release the visibility timer.

## Automated coverage

Run from `frontend`:

```sh
pnpm exec vitest run src/components/map/routeFollowController.test.ts src/components/map/routeFollowCamera.test.ts src/components/routes/RouteAnimationController.test.tsx src/domain/routeAnimation.test.ts src/hooks/useRouteAnimation.test.tsx src/domain/timedPhotoPlayback.test.ts
pnpm run typecheck
```

## Visual verification

Repeat on desktop and mobile fullscreen, with both 2D and tilted 3D views:

1. Start with Follow along off. Confirm the camera does not follow.
2. Enable it and replay. Confirm overview/start sequencing, smooth occasional
   moves, and uninterrupted marker playback during camera movement.
3. Use straight routes and routes with hairpins at 10, 20, and 120 seconds.
   Confirm the icon stays visible, including during camera transitions. Watch
   for excessive recovery snaps, which indicate margins or timing need tuning.
4. Exercise recorded-time playback, skipped stops, distance playback, and
   legacy indexed playback. Change settings while paused and resume.
5. Use timed-photo groups and routes with recording gaps. Confirm relocations
   are followed immediately and previews do not pan across gaps prematurely.
6. Toggle Follow along repeatedly. Confirm zoom does not compound, disabling
   stops camera motion, and enabling centers the latest position.
7. Stop during a camera move; confirm the camera stays there. Replay and let
   playback complete; confirm the usual completion overview runs.
8. Enable reduced motion; confirm follow moves are instantaneous. Resize the
   view, enter/leave fullscreen, and hide/restore the browser tab.
9. Compare CPU usage and camera movement frequency with continuous following.

In tilted 3D, specifically check terrain changes and the lifted icon near the
top edge. Screen bounds are a visibility guard, not terrain-occlusion detection.
The non-interactive mobile preview continues to exclude playback.
