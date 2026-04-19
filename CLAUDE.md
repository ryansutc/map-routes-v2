# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is a map route sharing application built with:
- **Backend**: ASP.NET Core 8.0 MVC with Entity Framework, SQLite database, Google OAuth authentication, and RESTful API
- **Frontend**: React 19 + TypeScript with Vite, TanStack Router, Zustand state management, Material-UI, and ArcGIS mapping

The project uses a "Backend for Frontend" architecture where the ASP.NET backend serves both traditional MVC views and hosts the React SPA. In development, React runs on port 5173 with API proxying to the backend on port 5231. In production, the React build is served from the backend's wwwroot/react directory.

## Development Commands

### Frontend Development (from `/frontend/`)
- `pnpm install` - Install dependencies
- `pnpm run dev` - Start development server on port 5173 (requires backend running on 5231)
- `pnpm run build` - Build production React app and copy to backend wwwroot
- `pnpm run lint` - Run ESLint
- `pnpm run schema` - Generate TypeScript types from backend OpenAPI schema

### Backend Development (from `/Backend/`)
- `dotnet run` - Start development server on port 5231
- `dotnet ef database update` - Apply database migrations
- `ASPNETCORE_ENVIRONMENT=Production dotnet run --environment Production --urls "http://localhost:5231"` - Test production build

### Build Order
1. Build frontend: `cd frontend && pnpm run build` (copies files to Backend/wwwroot/react)
2. Run backend: `cd Backend && dotnet run`

## Architecture Details

### Frontend Structure
- **Routing**: TanStack Router with file-based routing in `/routes/`
- **State**: Zustand store in `/state/store.ts`
- **API**: Zodios client with generated types from backend OpenAPI schema
- **Components**: Organized by feature (map, navbar, login, routes)
- **Mapping**: ArcGIS API for JavaScript with 3D scene support

### Backend Structure
- **Controllers**: 
  - `RouteAPIController.cs` - RESTful API endpoints
  - `AuthController.cs` - Authentication endpoints
  - `HomeController.cs` - MVC views and React app hosting
- **Models**: Route, Photo entities with EF Core
- **Authentication**: ASP.NET Identity with Google OAuth and JWT support
- **Database**: SQLite with Entity Framework migrations in `/Data/Migrations/`

### Key Integration Points
- Vite proxy configuration routes `/api/*` requests to backend during development
- Backend serves React production build from `/react/` path in production
- OpenAPI schema generation for type-safe frontend API contracts
- CORS configured for cross-origin authentication between frontend/backend ports

### Type Generation Workflow
1. Backend generates OpenAPI schema at `/swagger/v1/swagger.json`
2. Frontend `schema-to-zod` script generates Zod schemas and TypeScript types
3. Generated types are used by Zodios API client for runtime validation

### Special Considerations
- ArcGIS library has special Vite configuration to handle large bundle size and circular dependencies
- Authentication uses both cookies (for MVC) and JWT (for API) depending on client
- Development uses iframe approach for seamless React/ASP.NET integration
- Production serves React through ASP.NET layout for consistent authentication state