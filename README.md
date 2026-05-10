# map-routes

An revised approach example app allowing users to share routes on a map
(based on experiments with [map-routes](https://github.com/ryansutc/map-routes)).
This version built on Django REST Framework backend.

## About

This is mainly an experiment with Claude code and code planning.

## Details

## Running

### Backend Setup

1. Create Python virtual env & install dependencies

```
pipenv init
pipenv install
```

2. Create database and load fixtures (dummy data)

```
cd django_backend
python manage.py migrate
python manage.py loaddata apps/routes/fixtures/sample_routes.json
```

### Frontend Setup

```
pnpm run dev
```
