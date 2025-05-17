
import mapboxgl from 'https://cdn.jsdelivr.net/npm/mapbox-gl@2.15.0/+esm';
import * as d3 from 'https://cdn.jsdelivr.net/npm/d3@7.9.0/+esm';

mapboxgl.accessToken = 'pk.eyJ1IjoidmlraS1zaGkiLCJhIjoiY21hc203ODZqMGxyaTJzcHZlYTNldTZjdiJ9.Px2_WlK9ehu9DfQO-BaZCA'; // replace with your actual token


const map = new mapboxgl.Map({
  container: 'map',
  style: 'mapbox://styles/mapbox/streets-v12',
  center: [-71.09415, 42.36027],
  zoom: 12,
  minZoom: 5,
  maxZoom: 18,
});

// Global variables to hold stations + circle selection
let stations = [];
let circles;

// Helper: Convert [lat, lon] → [x, y] on screen
function getCoords(station) {
  const point = new mapboxgl.LngLat(+station.Long, +station.Lat);
  const { x, y } = map.project(point);
  return { cx: x, cy: y };
}

// Load and render once map is ready
map.on('load', async () => {
  // Add bike lanes: Boston
  map.addSource('boston_route', {
    type: 'geojson',
    data: 'https://bostonopendata-boston.opendata.arcgis.com/datasets/boston::existing-bike-network-2022.geojson',
  });
  map.addLayer({
    id: 'bike-lanes',
    type: 'line',
    source: 'boston_route',
    paint: {
      'line-color': 'green',
      'line-width': 3,
      'line-opacity': 0.4,
    },
  });

  // Add bike lanes: Cambridge
  map.addSource('cambridge_route', {
    type: 'geojson',
    data: 'https://raw.githubusercontent.com/cambridgegis/cambridgegis_data/main/Recreation/Bike_Facilities/RECREATION_BikeFacilities.geojson',
  });
  map.addLayer({
    id: 'cambridge-bike-lanes',
    type: 'line',
    source: 'cambridge_route',
    paint: {
      'line-color': 'green',
      'line-width': 3,
      'line-opacity': 0.4,
    },
  });

  // Select <svg> inside #map
  const svg = d3.select('#map').select('svg');

  // Load bike station JSON
  const url = 'https://dsc106.com/labs/lab07/data/bluebikes-stations.json';
  try {
    const jsonData = await d3.json(url);
    stations = jsonData.data.stations;

    // Draw initial circle elements
    circles = svg.selectAll('circle')
      .data(stations)
      .enter()
      .append('circle')
      .attr('r', 5)
      .attr('fill', 'steelblue')
      .attr('stroke', 'white')
      .attr('stroke-width', 1)
      .attr('opacity', 0.8);

    // Initial placement
    updatePositions();

    // Keep circles synced on map move
    map.on('move', updatePositions);
    map.on('zoom', updatePositions);
    map.on('resize', updatePositions);
    map.on('moveend', updatePositions);

  } catch (err) {
    console.error('Failed to load station JSON', err);
  }
});

// Position update function
function updatePositions() {
  circles
    .attr('cx', (d) => getCoords(d).cx)
    .attr('cy', (d) => getCoords(d).cy);
}
