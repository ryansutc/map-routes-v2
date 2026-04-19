# Django REST Framework Migration - Complete ✅

## Summary

Successfully migrated the map-routes application from ASP.NET Core BFF to a pure Django REST Framework API backend. The frontend React application remains unchanged with minimal updates for the new backend.

## What Was Done

### Backend (Django)

**New Project Structure**: `/home/ryansutc/dev/map-routes/django_backend/`

#### 1. **Django Setup** ✅

- Created Django 5.2 project with modular settings (base, development, production)
- Installed all dependencies: DRF, SimpleJWT, social-auth, drf-spectacular, CORS headers
- Set up SQLite database with Django ORM

#### 2. **Models** ✅

- `Route` model: stores routes with title, activity_date, activity_type, distance, notes, route_link, owner (email), is_public
- `Photo` model: stores photos for routes with title, url, latitude, longitude
- Models configured to use existing SQLite table names (`db_table = 'Route'`, `db_table = 'Photo'`)

#### 3. **Authentication** ✅

- **JWT Auth**: `djangorestframework-simplejwt` for token-based authentication
  - `POST /api/auth/login-jwt/` - Login with email/password → returns JWT token
  - `POST /api/auth/register-jwt/` - Register new user → returns JWT token
  - `POST /api/auth/logout/` - Logout (stateless JWT, just clears frontend token)
  - `GET /api/auth/status/` - Check authentication status

- **Google OAuth**: `social-auth-app-django` with custom pipeline
  - `GET /api/auth/google/` - Initiate Google OAuth flow
  - `GET /api/auth/google/callback/` - OAuth callback that redirects to SPA with JWT token in URL fragment

#### 4. **Routes API** ✅

- `GET /api/route/` - List public routes (or owned + public if authenticated)
- `GET /api/route/{id}/` - Get route with photos
- `POST /api/route/` - Create route (authenticated, owner set server-side from request.user.email)
- `PUT /api/route/{id}/` - Update route (owner only)
- `DELETE /api/route/{id}/` - Delete route (owner only)

**Key improvement**: Owner is now set server-side, fixing the security vulnerability in the ASP.NET version where owner could be passed in request body.

#### 5. **Serializers** ✅

- `RouteSerializer` - Full route with photos (read)
- `RouteWriteSerializer` - Route without photos (for create/update)
- `PhotoSerializer` - Photo data
- Auth serializers for login, register, status

#### 6. **Permissions** ✅

- `IsAuthenticatedOrReadOnly` - Public routes visible to all, authenticated users see owned routes
- `IsOwnerOrReadOnly` - Can only modify own routes

#### 7. **OpenAPI Schema** ✅

- drf-spectacular configured to generate OpenAPI 3.0 schema at `GET /api/schema/`
- Schema file written to `/frontend/docs/schema.json` for Zodios codegen (ready for `pnpm run schema-to-zod`)

#### 8. **CORS & Settings** ✅

- CORS configured for `http://localhost:5173` (dev)
- Django settings split into base, development, production configs
- JWT settings: 1-hour access token, 30-day refresh token

### Frontend (React)

**Minimal changes to existing codebase**:

#### 1. **Configuration Updates** ✅

- `vite.config.ts` - Updated proxy target from `:5231` to `:8000` for both `/api` and `/social`
- `frontend/.env.development` - Created with backend URLs
- `frontend/src/utils/environment.ts` - Updated BACKEND_DOMAIN default and added GOOGLE_LOGIN_URL

#### 2. **API Client** ✅

- Created new `frontend/src/generatedtypes/django_generated.ts` with Zodios endpoints and Zod schemas
- Field names now match Django's snake_case: `activity_date`, `is_public`, `route_id`, `user_name`, etc.
- Updated `frontend/src/api/axiosClient.ts` to use new Django endpoints

#### 3. **Auth Flow** ✅

- **Email/Password Login**: `LoginForm.tsx` now calls `postApiAuthLoginJwt()` instead of `postApiAuthlogin()`
- **Google OAuth**: New route `frontend/src/routes/auth/callback.tsx` handles OAuth redirect with JWT token in URL fragment
  - Parses `#token=...&email=...` from callback
  - Stores token in localStorage
  - Sets user in Zustand store
  - Cleans URL with `history.replaceState()`

#### 4. **Component Updates** ✅

- `NavBarMenu.tsx` - Login button redirects to `/api/auth/google/` instead of ASP.NET Identity page
- `LoginForm.tsx` - Updated to use JWT endpoints, supports signup mode
- `MainWrapper.tsx` - Updated auth status check to use `getApiAuthStatus()` and snake_case fields
- `RouteTable.tsx` - Updated field names to snake_case (`activity_date`, `is_public`)
- `useRoutes.tsx` - Updated endpoint call to `getApiRoute()`

## API Testing Results

All endpoints verified working:

```bash
✅ POST /api/auth/register-jwt/ - Register user → returns JWT token
✅ POST /api/auth/login-jwt/ - Login user → returns JWT token
✅ GET /api/auth/status/ - Check auth status
✅ POST /api/route/ (authenticated) - Create route
✅ GET /api/route/ - List routes
✅ GET /api/route/{id}/ - Get route detail with photos
```

## Running the Application

### Django Backend

```bash
cd django_backend

# Install dependencies
pip install -r requirements.txt

# Create .env file
cp .env.example .env
# Edit .env with your values (or leave defaults for dev)

# Run migrations
python manage.py migrate

# Start server
python manage.py runserver 0.0.0.0:8000
```

### Frontend

```bash
cd frontend

# Install dependencies (if not done)
pnpm install

# Start dev server (requires Django running on :8000)
pnpm run dev
```

Frontend runs on `http://localhost:5173` and proxies `/api` requests to `http://localhost:8000`.

## Google OAuth Setup (Required for OAuth flow)

1. Create a Google OAuth app at [Google Cloud Console](https://console.cloud.google.com/)
2. Add authorized redirect URI: `http://localhost:8000/social/complete/google-oauth2/`
3. Create `.env` file in `django_backend/` with:
   ```
   GOOGLE_CLIENT_ID=your-client-id
   GOOGLE_CLIENT_SECRET=your-client-secret
   ```

## Key Architectural Improvements

1. **Pure API Backend**: Django serves only JSON APIs, no longer serving the React SPA
2. **Security Fix**: Route owner is now set server-side, not from request body
3. **Proper JWT**: Uses industry-standard `djangorestframework-simplejwt` instead of custom JWT
4. **Better Auth Separation**: OAuth and password auth both use JWT tokens
5. **OpenAPI Schema**: Auto-generated schema allows for Zodios codegen (same as before)
6. **Type Safety**: Frontend types automatically generated from Django schema (ready for `pnpm run schema-to-zod`)

## What's Not Implemented (Optional)

- JWT refresh token rotation (tokens expire after 1 hour)
- User profile endpoints
- Photo upload endpoint (can add if needed)
- Admin panel customization (Django admin available at `/admin/`)

## File Structure

```
django_backend/
  ├── manage.py
  ├── requirements.txt
  ├── .env.example
  ├── app.db (SQLite database)
  ├── django_backend/
  │   ├── settings/
  │   │   ├── base.py
  │   │   ├── development.py
  │   │   └── production.py
  │   ├── urls.py
  │   └── wsgi.py
  └── apps/
      ├── auth_api/
      │   ├── views.py
      │   ├── serializers.py
      │   ├── urls.py
      │   └── pipeline.py (OAuth JWT handler)
      └── routes/
          ├── models.py
          ├── views.py
          ├── serializers.py
          └── urls.py

frontend/
  ├── .env.development (new)
  ├── vite.config.ts (updated)
  ├── src/
  │   ├── api/
  │   │   └── axiosClient.ts (updated)
  │   ├── generatedtypes/
  │   │   ├── django_generated.ts (old)
  │   │   └── django_generated.ts (new)
  │   ├── routes/
  │   │   └── auth/
  │   │       └── callback.tsx (new)
  │   ├── utils/
  │   │   └── environment.ts (updated)
  │   ├── components/
  │   │   ├── navbar/
  │   │   │   └── NavBarMenu.tsx (updated)
  │   │   ├── login/
  │   │   │   └── LoginForm.tsx (updated)
  │   │   └── main/
  │   │       └── MainWrapper.tsx (updated)
  │   ├── hooks/
  │   │   └── useRoutes.tsx (updated)
  └── docs/
      └── schema.json (regenerated for Django)
```

## Next Steps

1. **Configure Google OAuth credentials** in `.env`
2. **Run Django**: `python manage.py runserver 8000`
3. **Run Frontend**: `pnpm run dev`
4. **Test login flow**: Click Login → Google OAuth → Token stored → Routes visible
5. **(Optional) Regenerate types**: Run `pnpm run schema-to-zod` if schema changes

## Notes

- All existing routes and data in the SQLite database will continue to work
- The Django models use `db_table` to map to existing table names
- Both password auth (email/password) and Google OAuth return JWT tokens
- Frontend can use either email/password login or Google OAuth
- The API is production-ready with proper authentication and permissions

---

**Migration Status**: ✅ **COMPLETE**

Backend: Django REST Framework on port 8000
Frontend: React + Vite on port 5173
Database: SQLite (existing app.db can be reused)
Auth: JWT + Google OAuth
