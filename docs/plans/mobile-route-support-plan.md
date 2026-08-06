## Plan: Mobile-first route detail experience

TL;DR: Refactor the route detail screen to support a responsive, mobile-first experience where the details view is the default on small screens, the map can be previewed as a non-interactive thumbnail, and a tap transitions into a fullscreen map view with a compact back header. The work will stay centered around the existing route detail route and the map/detail components so the change remains contained and easy to iterate on.

### Scope

- Update the route detail experience in [frontend/src/routes/routes/$routeId.tsx](frontend/src/routes/routes/$routeId.tsx)
- Adapt [frontend/src/components/map/RouteInfoContainer.tsx](frontend/src/components/map/RouteInfoContainer.tsx) and [frontend/src/components/map/MapContainer.tsx](frontend/src/components/map/MapContainer.tsx) for responsive layout behavior
- Reuse the animation state from [frontend/src/components/routes/RouteAnimationController.tsx](frontend/src/components/routes/RouteAnimationController.tsx) and [frontend/src/hooks/useRouteAnimation.ts](frontend/src/hooks/useRouteAnimation.ts) so the map becomes non-interactive during playback

### Proposed implementation

1. Introduce a responsive state model for the route detail page
   - Add a mobile breakpoint around 860px using the existing MUI media-query approach.
   - Track whether the user is in a details-first mobile state or a fullscreen map state.
   - Keep the current desktop experience as the default for larger screens, while switching to a mobile-first flow below the breakpoint.

2. Rework the mobile layout
   - On screens below the breakpoint, show the detail content first as the primary full-screen view.
   - Hide the map panel from the main flow in this mode and replace it with a compact route preview section placed below the photos and content.
   - Make that preview behave like a tappable surface rather than an interactive map. Tapping it opens the fullscreen map view.
   - When the fullscreen map is open, show a compact header bar with a back arrow and the route title that returns the user to the detail view.

3. Preserve desktop behavior while making the toggle explicit
   - For larger screens, keep the layout readable with the map and details content available in a structured panel arrangement.
   - Add an explicit switcher or tab-style control so the user can move between the map and the details view without relying on a hidden mobile-only interaction.
   - Keep the profile/details content arranged to match the new UX, including the profile block placement decision that will be confirmed below.

4. Make the map preview non-interactive until the user enters fullscreen
   - Disable map interaction for the preview state by preventing pointer-driven controls or click handling while the preview is displayed.
   - Keep the route visible and zoomed appropriately so the preview still gives context.
   - When the user taps the preview, transition into a fullscreen map view and enable the normal map interactions there.

5. Disable map interaction while the route animation is running
   - Reuse the animation state already exposed by the route animation controller.
   - When playback is active, prevent map interactions from changing the view or triggering the map preview behavior.
   - Keep the animation controls available and visually distinct so the user can still stop or replay the route.

6. Polish the mobile experience
   - Ensure the fullscreen map state has a clear header and a simple back affordance.
   - Preserve scroll behavior so the detail content remains accessible while the preview stays anchored in the content flow.
   - Make spacing and padding consistent with the existing cards and sections so the page still feels native to the app.

### Decision points

1. the fullscreen map should replace the current page content entirely. Not a modal overlay.
2. On desktop only, the profile/details section, the profile block should be moved beneath the map as a dedicated lower section.
3. The mobile map could be a static thumbnail snapshot instead of a a live, zoomed-to-route map that stays mounted unless we can recycle the instance when swithing views so that it makes toggling faster.
4. When the animation is playing the map should be fully disabled and buttons on it disabled visually. No interaction.

### Verification

1. Review the responsive behavior at widths above and below 860px.
2. Confirm that the mobile preview opens the fullscreen map and that the back action returns to the detail view.
3. Verify that the map is non-interactive during animation playback and that the animation controls still work.
4. Check that the desktop layout remains usable and the route content remains readable without introducing overlap or awkward spacing.
