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
const Photo = z
  .object({
    id: z.number().int(),
    title: z.string().max(255).nullish(),
    url: z.string().max(1000),
    latitude: z.number().optional(),
    longitude: z.number().optional(),
    route_id: z.number().int(),
  })
  ;
const Route = z
  .object({
    id: z.number().int(),
    title: z.string().max(255).nullish(),
    activity_date: z.string().datetime({ offset: true }),
    activity_type: z.string().max(100),
    distance: z
      .string()
      .regex(/^-?\d{0,8}(?:\.\d{0,2})?$/)
      .optional(),
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
    activity_type: z.string().min(1).max(100),
    distance: z
      .string()
      .regex(/^-?\d{0,8}(?:\.\d{0,2})?$/)
      .optional(),
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
    activity_type: z.string().max(100),
    distance: z
      .string()
      .regex(/^-?\d{0,8}(?:\.\d{0,2})?$/)
      .optional(),
    notes: z.string().nullish(),
    route_link: z.string().max(500).nullish(),
    is_public: z.boolean().optional(),
  })
  ;
const PatchedRouteWriteRequest = z
  .object({
    title: z.string().max(255).nullable(),
    activity_date: z.string().datetime({ offset: true }),
    activity_type: z.string().min(1).max(100),
    distance: z.string().regex(/^-?\d{0,8}(?:\.\d{0,2})?$/),
    notes: z.string().nullable(),
    route_link: z.string().max(500).nullable(),
    is_public: z.boolean(),
  })
  .partial()
  ;

export const schemas = {
  LoginRequest,
  JwtAuthResponse,
  RegisterRequest,
  AuthStatus,
  Photo,
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
    requestFormat: "json",
    response: z.unknown(),
  },
  {
    method: "post",
    path: "/api/auth/register-jwt/",
    alias: "auth_register_jwt_create",
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
    requestFormat: "json",
    response: AuthStatus,
  },
  {
    method: "get",
    path: "/api/route/",
    alias: "route_list",
    requestFormat: "json",
    response: z.array(Route),
  },
  {
    method: "post",
    path: "/api/route/",
    alias: "route_create",
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
]);

