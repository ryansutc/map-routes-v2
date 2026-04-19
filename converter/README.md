## gpx file conversion service

// TODO

This should be its own repo at some point. I'll make a service that runs GDAL/OGR on the server
and processes .gpx files to geojson for both the tracks and track points.

That way they can be easily loaded into web maps and AGOL.

For now:

```
 ogr2ogr -f GeoJSON Kennedy_falls_walk_pts.geojson Kennedy_falls_walk.gpx track_points
 ogr2ogr -f GeoJSON Kennedy_falls_walk.geojson Kennedy_falls_walk.gpx tracks
```

Steps:

1.  Create a Conda python environment in windows:
    a) install miniconda
    b) shortcut miniconda prompt

2.  Run miniconda
    `` conda env list```

3.  Create new GDAL env

```
conda create -n gdal_env python=3.11 gdal -c conda-forge
conda activate gdal_env

```

4.  Copy strava gpx files to folder and convert
