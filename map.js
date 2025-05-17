// Import Mapbox as an ESM module
import mapboxgl from 'https://cdn.jsdelivr.net/npm/mapbox-gl@2.15.0/+esm';

console.log('Mapbox GL JS Loaded:', mapboxgl);

// Set your Mapbox access token here
mapboxgl.accessToken = 'pk.eyJ1IjoidmlraS1zaGkiLCJhIjoiY21hc203ODZqMGxyaTJzcHZlYTNldTZjdiJ9.Px2_WlK9ehu9DfQO-BaZCA'; // replace with your token

// Initialize the map
const map = new mapboxgl.Map({
  container: 'map',
  style: 'mapbox://styles/mapbox/streets-v12',
  center: [-71.09415, 42.36027],
  zoom: 12,
  minZoom: 5,
  maxZoom: 18,
});
