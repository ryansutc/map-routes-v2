import { BACKEND_DOMAIN } from "@/utils/environment";
import { Zodios } from "@zodios/core";
import { axiosInstance } from "@/api/axiosInstance";
import { endpoints } from "@/generatedtypes/django_generated";

export const zodiosAPI = new Zodios(BACKEND_DOMAIN, endpoints, {
  axiosInstance,
});
