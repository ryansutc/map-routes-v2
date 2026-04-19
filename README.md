# map-routes

An revised approach example app allowing users to share routes on a map
(based on experiments with [map-routes](https://github.com/ryansutc/map-routes)).
This version built on Django REST Framework backend.

## About

This is mainly an experiment building another ASP .NET backend app with a React frontend

This repo demonstrates:

- An ASP .NET Core MVC setup with an associated RESTFul API
- A Clientside routed React SPA frontend
- A mix of Backend for Frontend approach wherein both React and ASP .NET razor pages
  are used.

## Details

TODO: move this to a blog post.

The frontend, in this branch, is built hooked into the backend pages. We use an iFrame for the dev build.

Microsoft is supposed to have tools to allow us to develop a React-style SPA and keep it inside an ASP .NET app
but besides the Package here (https://www.nuget.org/packages/Microsoft.AspNetCore.SpaServices.Extensions#readme-body-tab)
I cannot find any decent documentation on how to set this up.

Although folks have documented it is possible to do with Vue.js (eg: [here](https://www.youtube.com/watch?v=NG3KAng2mAI)), it doesn't
seem possible for Vite-based React apps because of issues with the HMR process that vite runs.
