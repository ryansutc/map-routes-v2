# Quick Start Guide - Django Backend

## Prerequisites
- Python 3.10+
- Node.js/npm (for frontend)
- Google OAuth credentials (optional, for Google login)

## Setup Django Backend

### 1. Create Virtual Environment (Optional but Recommended)
```bash
cd django_backend
python -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate
```

### 2. Install Dependencies
```bash
pip install -r requirements.txt
```

### 3. Configure Environment
```bash
cp .env.example .env
```

For development, defaults are fine. For Google OAuth, update:
```
GOOGLE_CLIENT_ID=your-google-client-id
GOOGLE_CLIENT_SECRET=your-google-client-secret
```

### 4. Run Migrations
```bash
python manage.py migrate
```

### 5. Create Admin User (Optional)
```bash
python manage.py createsuperuser
```

Then access Django admin at `http://localhost:8000/admin/`

### 6. Start Development Server
```bash
python manage.py runserver 0.0.0.0:8000
```

Server will be available at `http://localhost:8000`

## Setup Frontend

### 1. Install Dependencies
```bash
cd frontend
npm install  # or pnpm install
```

### 2. Start Development Server
```bash
npm run dev  # or pnpm run dev
```

Frontend will be available at `http://localhost:5173`

## API Testing

### Test Without Authentication
```bash
# List public routes
curl http://localhost:8000/api/route/

# Check auth status
curl http://localhost:8000/api/auth/status/
```

### Test User Registration
```bash
curl -X POST http://localhost:8000/api/auth/register-jwt/ \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@example.com",
    "password": "password123",
    "confirm_password": "password123"
  }'
```

Response includes JWT token:
```json
{
  "message": "Registration successful",
  "token": "eyJhbGc...",
  "user_id": 1,
  "email": "test@example.com"
}
```

### Test User Login
```bash
curl -X POST http://localhost:8000/api/auth/login-jwt/ \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@example.com",
    "password": "password123"
  }'
```

### Create Route (With Authentication)
```bash
TOKEN="your-jwt-token-from-above"

curl -X POST http://localhost:8000/api/route/ \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{
    "title": "Morning Hike",
    "activity_date": "2025-04-18T09:00:00Z",
    "activity_type": "hike",
    "distance": 5.2,
    "notes": "Great weather today",
    "is_public": true
  }'
```

## API Endpoints Reference

### Auth
- `POST /api/auth/login-jwt/` - Login with email/password
- `POST /api/auth/register-jwt/` - Register new user
- `POST /api/auth/logout/` - Logout (requires authentication)
- `GET /api/auth/status/` - Check authentication status
- `GET /api/auth/google/` - Initiate Google OAuth login

### Routes
- `GET /api/route/` - List routes (public or owned if authenticated)
- `POST /api/route/` - Create route (requires authentication)
- `GET /api/route/{id}/` - Get route details
- `PUT /api/route/{id}/` - Update route (requires ownership)
- `DELETE /api/route/{id}/` - Delete route (requires ownership)

### Utilities
- `GET /api/schema/` - OpenAPI schema (JSON)
- `GET /api/schema/swagger-ui/` - Interactive API documentation

## Login Flow

### Email/Password Login
1. User enters email/password in login form
2. Frontend calls `POST /api/auth/login-jwt/` with credentials
3. Backend returns JWT token
4. Frontend stores token in localStorage
5. Frontend sets Authorization header for subsequent requests

### Google OAuth Login
1. User clicks "Login" button
2. Frontend redirects to `GET /api/auth/google/`
3. Django redirects to Google's OAuth authorization page
4. User authorizes on Google
5. Google redirects back to `GET /api/auth/google/callback/` 
6. Django creates/updates user and generates JWT
7. Django redirects to `http://localhost:5173/auth/callback#token=...&email=...`
8. React callback route parses token from URL fragment
9. Frontend stores token and user in state/localStorage

## Troubleshooting

### Port Already in Use
If port 8000 is in use:
```bash
python manage.py runserver 0.0.0.0:8001
```
Update frontend proxy in `vite.config.ts` if needed.

### Database Errors
Reset the database:
```bash
rm app.db
python manage.py migrate
```

### CORS Issues
Check that frontend URL is in `CORS_ALLOWED_ORIGINS` in settings. For dev, it should be `http://localhost:5173`.

### Google OAuth Not Working
1. Verify client ID and secret in `.env`
2. Check authorized redirect URIs in Google Cloud Console include `http://localhost:8000/social/complete/google-oauth2/`
3. Check browser console for errors

## Development Tips

### Run Tests
```bash
python manage.py test
```

### Generate New Migrations
After changing models:
```bash
python manage.py makemigrations
python manage.py migrate
```

### Access Django Shell
```bash
python manage.py shell
```

### Clear All Data
```bash
python manage.py flush
```

### View Admin Interface
Navigate to `http://localhost:8000/admin/` (requires superuser account)

## Production Deployment

For production:

1. Update `django_backend/settings/production.py` with your settings
2. Set `ENVIRONMENT=production` in `.env`
3. Update `ALLOWED_HOSTS`, `CORS_ALLOWED_ORIGINS`, `SOCIAL_AUTH_ALLOWED_REDIRECT_HOSTS`
4. Set strong `DJANGO_SECRET_KEY`
5. Use production database (PostgreSQL recommended)
6. Use HTTPS
7. Collect static files: `python manage.py collectstatic`
8. Run with gunicorn or similar

Example with gunicorn:
```bash
gunicorn django_backend.wsgi:application --bind 0.0.0.0:8000
```

## Next Steps

1. Configure Google OAuth (optional but recommended)
2. Test email/password registration and login
3. Create some test routes via API
4. Test frontend integration
5. Deploy to production when ready

---

For more details, see [MIGRATION_COMPLETE.md](./MIGRATION_COMPLETE.md)
