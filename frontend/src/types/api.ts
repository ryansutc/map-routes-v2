import { schemas } from "@/generatedtypes/django_generated";
import { z } from "zod";

/**
 * TypeScript types extracted from auto-generated Zod schemas
 * These types are inferred from the schemas and will automatically
 * stay in sync when the schemas are regenerated.
 */

export type PhotoDto = z.infer<typeof schemas.Photo>;
export type PhotoUploadResponse = z.infer<typeof schemas.PhotoUploadResponse>;
export type ParseGpxResponse = z.infer<typeof schemas.ParseGpxResponse>;
export type RouteResponseDto = z.infer<typeof schemas.Route>;
export type RouteWriteDto = z.infer<typeof schemas.RouteWrite>;
export type LoginModel = z.infer<typeof schemas.LoginRequest>;
export type JwtAuthResponse = z.infer<typeof schemas.JwtAuthResponse>;
export type RegisterModel = z.infer<typeof schemas.RegisterRequest>;
export type AuthStatusResponse = z.infer<typeof schemas.AuthStatus>;
