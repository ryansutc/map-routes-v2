import { schemas } from "@/generatedtypes/django_generated";
import { z } from "zod";

/**
 * TypeScript types extracted from auto-generated Zod schemas
 * These types are inferred from the schemas and will automatically
 * stay in sync when the schemas are regenerated.
 */

export type PhotoDto = z.infer<typeof schemas.PhotoDto>;
export type RouteResponseDto = z.infer<typeof schemas.RouteResponseDto>;
export type LoginModel = z.infer<typeof schemas.LoginModel>;
export type AuthResponse = z.infer<typeof schemas.AuthResponse>;
export type ValidationProblemDetails = z.infer<
  typeof schemas.ValidationProblemDetails
>;
export type JwtAuthResponse = z.infer<typeof schemas.JwtAuthResponse>;
export type RegisterModel = z.infer<typeof schemas.RegisterModel>;
export type AuthStatusResponse = z.infer<typeof schemas.AuthStatusResponse>;
