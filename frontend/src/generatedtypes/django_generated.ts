import { makeApi, Zodios, type ZodiosOptions } from "@zodios/core";
import { z } from "zod";

const LoginRequest = z
  .object({ email: z.string().min(1).email(), password: z.string().min(1) })
  ;
const JwtAuthResponse = z
  .object({
    message: z.string(),
    token: z.string(),
    user_id: z.number().int(),
    email: z.string().email(),
  })
  ;
const RegisterRequest = z
  .object({
    email: z.string().min(1).email(),
    password: z.string().min(6),
    confirm_password: z.string().min(1),
  })
  ;
const AuthStatus = z
  .object({ is_authenticated: z.boolean(), user_name: z.string().nullable() })
  ;
const ActivityTypeEnum = z.enum([
  "Hiking",
  "Running",
  "Cycling",
  "Backpacking",
  "Skiing",
  "Other",
]);
const BlankEnum = z.unknown();
const NullEnum = z.unknown();
const Photo = z
  .object({
    id: z.number().int(),
    title: z.string().max(255).nullish(),
    url: z.string().max(1000),
    latitude: z.number().nullish(),
    longitude: z.number().nullish(),
    route_id: z.number().int(),
    has_gps: z
      .boolean()
      .describe("Return True if the photo has GPS coordinates."),
  })
  ;
const Route = z
  .object({
    id: z.number().int(),
    title: z.string().max(255).nullish(),
    activity_date: z.string().datetime({ offset: true }),
    activity_type: z.union([ActivityTypeEnum, BlankEnum, NullEnum]).nullish(),
    distance: z.number(),
    duration: z
      .number()
      .int()
      .gte(-9223372036854776000)
      .lte(9223372036854776000)
      .nullish(),
    avg_pace: z
      .string()
      .regex(/^-?\d{0,4}(?:\.\d{0,2})?$/)
      .nullish(),
    elevation_gain: z
      .string()
      .regex(/^-?\d{0,6}(?:\.\d{0,2})?$/)
      .nullish(),
    arcgis_item_id: z.string().max(32).nullish(),
    geojson: z.unknown().nullish(),
    notes: z.string().nullish(),
    route_link: z.string().max(500).nullish(),
    owner: z.string().email(),
    is_public: z.boolean().optional(),
    photos: z.array(Photo),
  })
  ;
const RouteWriteRequest = z
  .object({
    title: z.string().max(255).nullish(),
    activity_date: z.string().datetime({ offset: true }),
    activity_type: z.union([ActivityTypeEnum, BlankEnum, NullEnum]).nullish(),
    distance: z.number(),
    duration: z
      .number()
      .int()
      .gte(-9223372036854776000)
      .lte(9223372036854776000)
      .nullish(),
    avg_pace: z
      .string()
      .regex(/^-?\d{0,4}(?:\.\d{0,2})?$/)
      .nullish(),
    elevation_gain: z
      .string()
      .regex(/^-?\d{0,6}(?:\.\d{0,2})?$/)
      .nullish(),
    arcgis_item_id: z.string().max(32).nullish(),
    geojson: z.unknown().nullish(),
    notes: z.string().nullish(),
    route_link: z.string().max(500).nullish(),
    is_public: z.boolean().optional(),
  })
  ;
const RouteWrite = z
  .object({
    id: z.number().int(),
    title: z.string().max(255).nullish(),
    activity_date: z.string().datetime({ offset: true }),
    activity_type: z.union([ActivityTypeEnum, BlankEnum, NullEnum]).nullish(),
    distance: z.number(),
    duration: z
      .number()
      .int()
      .gte(-9223372036854776000)
      .lte(9223372036854776000)
      .nullish(),
    avg_pace: z
      .string()
      .regex(/^-?\d{0,4}(?:\.\d{0,2})?$/)
      .nullish(),
    elevation_gain: z
      .string()
      .regex(/^-?\d{0,6}(?:\.\d{0,2})?$/)
      .nullish(),
    arcgis_item_id: z.string().max(32).nullish(),
    geojson: z.unknown().nullish(),
    notes: z.string().nullish(),
    route_link: z.string().max(500).nullish(),
    is_public: z.boolean().optional(),
  })
  ;
const PatchedRouteWriteRequest = z
  .object({
    title: z.string().max(255).nullable(),
    activity_date: z.string().datetime({ offset: true }),
    activity_type: z.union([ActivityTypeEnum, BlankEnum, NullEnum]).nullable(),
    distance: z.number(),
    duration: z
      .number()
      .int()
      .gte(-9223372036854776000)
      .lte(9223372036854776000)
      .nullable(),
    avg_pace: z
      .string()
      .regex(/^-?\d{0,4}(?:\.\d{0,2})?$/)
      .nullable(),
    elevation_gain: z
      .string()
      .regex(/^-?\d{0,6}(?:\.\d{0,2})?$/)
      .nullable(),
    arcgis_item_id: z.string().max(32).nullable(),
    geojson: z.unknown().nullable(),
    notes: z.string().nullable(),
    route_link: z.string().max(500).nullable(),
    is_public: z.boolean(),
  })
  .partial()
  ;

const PhotoUploadResponse = z.object({
  id: z.number().int(),
  url: z.string(),
  latitude: z.number().nullable(),
  longitude: z.number().nullable(),
  has_gps: z.boolean(),
});

export const schemas = {
  LoginRequest,
  JwtAuthResponse,
  RegisterRequest,
  AuthStatus,
  ActivityTypeEnum,
  BlankEnum,
  NullEnum,
  Photo,
  PhotoUploadResponse,
  Route,
  RouteWriteRequest,
  RouteWrite,
  PatchedRouteWriteRequest,
};

export const endpoints = makeApi([
  {
    method: "get",
    path: "/api/auth/google/",
    alias: "auth_google_retrieve",
    description: `Redirect to the Google OAuth2 login URL.`,
    requestFormat: "json",
    response: z.void(),
    errors: [
      {
        status: 302,
        schema: z.unknown(),
      },
    ],
  },
  {
    method: "post",
    path: "/api/auth/login-jwt/",
    alias: "auth_login_jwt_create",
    description: `Authenticate with email and password and return a JWT access token.`,
    requestFormat: "json",
    parameters: [
      {
        name: "body",
        type: "Body",
        schema: LoginRequest,
      },
    ],
    response: JwtAuthResponse,
  },
  {
    method: "post",
    path: "/api/auth/logout/",
    alias: "auth_logout_create",
    description: `Return a logout confirmation response.`,
    requestFormat: "json",
    response: z.unknown(),
  },
  {
    method: "post",
    path: "/api/auth/register-jwt/",
    alias: "auth_register_jwt_create",
    description: `Register a new user account and return a JWT access token.`,
    requestFormat: "json",
    parameters: [
      {
        name: "body",
        type: "Body",
        schema: RegisterRequest,
      },
    ],
    response: JwtAuthResponse,
  },
  {
    method: "get",
    path: "/api/auth/status/",
    alias: "auth_status_retrieve",
    description: `Return authentication status and email for the current user.`,
    requestFormat: "json",
    response: AuthStatus,
  },
  {
    method: "get",
    path: "/api/route/",
    alias: "route_list",
    description: `API view to list routes visible to the user or create a new route.`,
    requestFormat: "json",
    response: z.array(Route),
  },
  {
    method: "post",
    path: "/api/route/",
    alias: "route_create",
    description: `API view to list routes visible to the user or create a new route.`,
    requestFormat: "json",
    parameters: [
      {
        name: "body",
        type: "Body",
        schema: RouteWriteRequest,
      },
    ],
    response: RouteWrite,
  },
  {
    method: "get",
    path: "/api/route/:id/",
    alias: "route_retrieve",
    description: `API view to retrieve, update, or delete a single route.`,
    requestFormat: "json",
    parameters: [
      {
        name: "id",
        type: "Path",
        schema: z.number().int(),
      },
    ],
    response: Route,
  },
  {
    method: "put",
    path: "/api/route/:id/",
    alias: "route_update",
    description: `API view to retrieve, update, or delete a single route.`,
    requestFormat: "json",
    parameters: [
      {
        name: "body",
        type: "Body",
        schema: RouteWriteRequest,
      },
      {
        name: "id",
        type: "Path",
        schema: z.number().int(),
      },
    ],
    response: RouteWrite,
  },
  {
    method: "patch",
    path: "/api/route/:id/",
    alias: "route_partial_update",
    description: `API view to retrieve, update, or delete a single route.`,
    requestFormat: "json",
    parameters: [
      {
        name: "body",
        type: "Body",
        schema: PatchedRouteWriteRequest,
      },
      {
        name: "id",
        type: "Path",
        schema: z.number().int(),
      },
    ],
    response: RouteWrite,
  },
  {
    method: "delete",
    path: "/api/route/:id/",
    alias: "route_destroy",
    description: `API view to retrieve, update, or delete a single route.`,
    requestFormat: "json",
    parameters: [
      {
        name: "id",
        type: "Path",
        schema: z.number().int(),
      },
    ],
    response: z.void(),
  },
  {
    method: "post",
    path: "/api/route/:id/photos/",
    alias: "route_photos_create",
    description: `Accept an image file, extract GPS EXIF, upload to Cloudinary, save Photo record.`,
    requestFormat: "form-data",
    parameters: [
      {
        name: "id",
        type: "Path",
        schema: z.number().int(),
      },
      {
        name: "body",
        type: "Body",
        schema: z.object({ file: z.instanceof(File) }),
      },
    ],
    response: PhotoUploadResponse,
  },
  {
    method: "post",
    path: "/api/route/parse-gpx/",
    alias: "route_parse_gpx_create",
    description: `Accept a GPX file, parse it, upload to ArcGIS, and return metadata.`,
    requestFormat: "json",
    response: z.void(),
  },
]);

