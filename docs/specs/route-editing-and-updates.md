# Route Editing Plan

## Goal

Allow the logged-in owner of a route to edit its user-managed information and photos without allowing changes to the original GPX file or any GPX-derived information.

Only real changes to route information update the route's `updated_at` value. Photo changes do not update it.

## Route Details Page

- Remove the Copy Link control completely.
- Determine ownership by comparing the logged-in user's email with `route.owner`.
- Show the following controls only to the route owner:
  - A pencil icon beside the route title linking to `/routes/:routeId/edit`.
  - An **Edit photos** button beside the Photos heading linking to `/routes/:routeId/photos/edit`.
- Always show the Photos section to the owner, including an empty state when the route has no photos.
- Continue hiding the empty Photos section from non-owners.
- Display `updated_at` as “updated [date]” when it is meaningfully later than `created_at`.
- Continue displaying the existing “uploaded [date]” value.

## Route Information Editor

Create a route at:

```text
/routes/:routeId/edit
```

### Editable fields

- Title
- Activity type
- Notes
- Public/private visibility

### Immutable fields

The owner cannot change:

- GPX file
- Activity date
- Distance
- Duration
- Average pace
- Elevation gain
- Track-point count
- GeoJSON
- ArcGIS item ID
- Owner

### Read-only GPX summary

Show a read-only summary containing:

- Activity date
- Distance
- Duration
- Average pace
- Elevation gain

Explain that this information was derived from the GPX file and cannot be changed. Do not expose GeoJSON, ArcGIS item ID, or track-point count in the UI.

### Validation

- Title is required after trimming whitespace.
- Title has a maximum length of 255 characters.
- Activity type must be one of the existing supported activity types.
- Notes may be empty and do not receive a new arbitrary frontend length limit.
- Visibility is represented by a boolean switch.
- Enforce the same validation on the backend.

### Save and navigation behavior

- Disable Save until the form contains a real change.
- Protect unsaved changes during:
  - In-app navigation
  - Browser refresh or close
  - Cancel
- If the form is unchanged, Cancel returns directly to route details.
- Send changes using the generated Zodios `PATCH` operation.
- After success:
  - Invalidate and refetch the affected route query.
  - Return to the route details page.
  - Show a brief “Route updated” message.
- After validation or network failure:
  - Remain on the editor.
  - Preserve the entered values.
  - Display the error in the form.
- Use last-successful-save-wins behavior if the same route is edited concurrently.

### Authorization

- If a non-owner directly visits the editor, redirect them to the route details page and show “Only the route owner can edit this route.”
- Backend authorization remains authoritative and returns `403` for unauthorized mutations.

## Route API

### Read serializer

- Add `updated_at` to the route read serializer.
- Regenerate the OpenAPI schema and Zodios client after the API changes.

### Update serializer

Create a dedicated route update serializer that accepts exactly:

- `title`
- `activity_type`
- `notes`
- `is_public`

The serializer must reject GPX-derived, system-managed, and unexpected fields with `400` instead of silently ignoring them.

### Update methods and timestamps

- Disable full `PUT` updates.
- Support route changes through `PATCH` only.
- Continue requiring that the requesting user owns the route.
- Detect no-op patches on the backend and avoid saving the model.
- Advance `updated_at` only when at least one of the four editable fields actually changes.
- Photo operations must not save the Route model or alter its `updated_at`.

## Photo Editor

Create a route at:

```text
/routes/:routeId/photos/edit
```

Use a responsive image grid or list without a map. Photo locations are view-only and cannot be manually changed.

### Existing photos

For each existing photo, show:

- The image
- Its optional editable title
- Whether GPS coordinates are available
- A **Save title** action
- A **Delete** action

Title changes happen immediately when **Save title** is selected.

### New photos

- Allow selection of multiple images.
- Allow an optional title to be entered for each queued image before upload.
- Do not upload immediately on selection; require an explicit **Upload** action.
- Upload files individually so that failures can be displayed and retried per photo.
- A failed upload does not consume route capacity.
- Provide a **Done** action that returns to route details.

### Photo-title rules

- Titles are optional.
- Trim surrounding whitespace.
- Limit titles to 255 characters.
- Saving an empty title clears the existing title.
- A title update cannot change GPS coordinates, EXIF timestamps, URL, route membership, or the route's `updated_at`.

### Photo limit

- Retain the existing maximum of 20 photos per route.
- Count existing photos plus successful new uploads.
- Limit file selection to the route's remaining capacity.
- Disable uploading when the route reaches 20 photos.
- Display the current capacity, such as “20 / 20 photos.”

### Deletion

- Require confirmation before deleting a photo.
- Delete the hosted Cloudinary asset as well as the database record.
- Perform deletions immediately after confirmation.
- If Cloudinary deletion fails, retain the database record and show an error so deletion can be retried.
- Treat a Cloudinary “asset already missing” response as success and remove the database record.

### Unsaved-work protection

Warn before leaving the photo editor when:

- Selected photos remain queued and unuploaded.
- An existing photo has an unsaved title change.

Completed uploads, saved titles, and confirmed deletions are immediate operations and require no additional page-level Save.

### Authorization

- If a non-owner directly visits the photo editor, redirect them to route details with the ownership message.
- Backend ownership checks remain authoritative.

## Photo API

Use nested photo endpoints:

```text
POST   /api/route/:routeId/photos/
PATCH  /api/route/:routeId/photos/:photoId/
DELETE /api/route/:routeId/photos/:photoId/
```

- `POST` uploads a new photo and accepts its optional title.
- `PATCH` accepts only `title`.
- `DELETE` removes the hosted asset and database record.
- Every operation must verify:
  - The route exists.
  - The requesting user owns the route.
  - The photo belongs to the route identified in the URL.

## Cloudinary Storage

- Change the upload helper to return both the secure URL and Cloudinary public ID.
- Populate the existing `Photo.cloudinary_public_id` field for every new upload.
- Add a Cloudinary deletion helper.
- For older photos that have no stored public ID:
  - Allow removal of the database record.
  - Accept that the old hosted asset may remain orphaned because it cannot be reliably identified.

## Frontend Structure

- Add the two TanStack Router routes for route-info and photo editing.
- Reuse or extract the existing route metadata controls where practical, while keeping GPX uploading exclusive to route creation.
- Reuse the existing photo upload behavior where practical, separating reusable queue/upload logic from route creation.
- Use generated Zodios operations for route and photo mutations after regenerating types.
- Invalidate the route detail and route-list query data after successful mutations where their displayed data changes.
- Ensure ownership-dependent controls do not flash for users while authentication state is unresolved.

## Backend Tests

Cover:

- Owners can patch the four editable route fields.
- Non-owners receive `403`.
- Anonymous users cannot mutate routes.
- `PUT` is disabled.
- Immutable and unexpected route fields receive `400`.
- Route validation matches the frontend rules.
- A real change advances `updated_at`.
- A no-op patch preserves `updated_at`.
- Route reads include `updated_at`.
- Photo changes do not alter route `updated_at`.
- Owners can upload photos.
- Non-owners cannot upload, rename, or delete photos.
- The 20-photo limit includes existing photos.
- Successful uploads persist the Cloudinary public ID.
- Photo `PATCH` accepts only a valid title.
- A photo cannot be mutated through a different route's nested URL.
- Successful Cloudinary deletion removes the database record.
- Failed Cloudinary deletion retains the database record.
- An already-missing Cloudinary asset is treated as a successful deletion.
- Legacy photos without public IDs can be removed from the database.

## Frontend Tests

Cover:

- Owner-only pencil and **Edit photos** controls.
- Complete removal of Copy Link.
- Owner empty-photo state and editor access.
- Non-owner edit-route redirects.
- The route form contains only the four editable controls.
- The GPX-derived summary is read-only.
- Route validation, dirty-state detection, and unsaved-change protection.
- The generated `PATCH` request contains only editable fields.
- Successful save navigation, notification, and query invalidation.
- Failed saves preserve form state.
- Photo capacity accounts for existing and successful new photos.
- New photo titles are included with uploads.
- Existing title changes require **Save title**.
- Photo deletion requires confirmation.
- Individual upload failures can be retried.
- Queued uploads and dirty titles trigger unsaved-work warnings.

## Completion Criteria

- Owners can edit exactly the four approved route fields.
- GPX and GPX-derived information cannot be changed through either the UI or API.
- `updated_at` changes only after a real route-information edit.
- Owners can add, rename, and delete photos without changing their locations.
- Hosted images are deleted when their photo records are deleted whenever a Cloudinary public ID is available.
- Non-owners cannot access or invoke edit functionality.
- OpenAPI schemas and generated Zodios types reflect the restricted APIs.
- Relevant backend and frontend tests pass.
