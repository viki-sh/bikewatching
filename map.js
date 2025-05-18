import mapboxgl from 'https://cdn.jsdelivr.net/npm/mapbox-gl@2.15.0/+esm';
import * as d3 from 'https://cdn.jsdelivr.net/npm/d3@7/+esm';

mapboxgl.accessToken = 'pk.eyJ1IjoidmlraS1zaGkiLCJhIjoiY21hc203ODZqMGxyaTJzcHZlYTNldTZjdiJ9.Px2_WlK9ehu9DfQO-BaZCA';

const map = new mapboxgl.Map({
  container: 'map',
  style: 'mapbox://styles/mapbox/streets-v12',
  center: [-71.09415, 42.36027],
  zoom: 12,
  minZoom: 5,
  maxZoom: 18,
});

const svg = d3.select('#map').select('svg');

function getCoords(station) {
  const point = new mapboxgl.LngLat(+station.Long, +station.Lat);
  const { x, y } = map.project(point);
  return { cx: x, cy: y };
}

function minutesSinceMidnight(date) {
  return date.getHours() * 60 + date.getMinutes();
}

let departuresByMinute = Array.from({ length: 1440 }, () => []);
let arrivalsByMinute = Array.from({ length: 1440 }, () => []);
let stationFlow = d3.scaleQuantize().domain([0, 1]).range([0, 0.5, 1]);
let radiusScale = d3.scaleSqrt().range([0, 25]);

function filterByMinute(tripsByMinute, minute) {
  if (minute === -1) return tripsByMinute.flat();
  let min = (minute - 60 + 1440) % 1440;
  let max = (minute + 60) % 1440;
  if (min > max) return tripsByMinute.slice(min).concat(tripsByMinute.slice(0, max)).flat();
  return tripsByMinute.slice(min, max).flat();
}

function computeStationTraffic(stations, timeFilter = -1) {
  const deps = d3.rollup(
    filterByMinute(departuresByMinute, timeFilter),
    v => v.length,
    d => d.start_station_id
  );
  const arrs = d3.rollup(
    filterByMinute(arrivalsByMinute, timeFilter),
    v => v.length,
    d => d.end_station_id
  );

  return stations.map(station => {
    let id = station.short_name;
    station.departures = deps.get(id) ?? 0;
    station.arrivals = arrs.get(id) ?? 0;
    station.totalTraffic = station.arrivals + station.departures;
    return station;
  });
}

map.on('load', async () => {
  map.addSource('boston_route', {
    type: 'geojson',
    data: 'https://bostonopendata-boston.opendata.arcgis.com/datasets/boston::existing-bike-network-2022.geojson',
  });
  map.addLayer({
    id: 'bike-lanes-boston',
    type: 'line',
    source: 'boston_route',
    paint: {
      'line-color': 'green',
      'line-width': 3,
      'line-opacity': 0.4,
    },
  });

  map.addSource('cambridge_route', {
    type: 'geojson',
    data: 'https://raw.githubusercontent.com/cambridgegis/cambridgegis_data/main/Recreation/Bike_Facilities/RECREATION_BikeFacilities.geojson',
  });
  map.addLayer({
    id: 'bike-lanes-cambridge',
    type: 'line',
    source: 'cambridge_route',
    paint: {
      'line-color': 'green',
      'line-width': 3,
      'line-opacity': 0.4,
    },
  });

  let stationData = await d3.json('https://dsc106.com/labs/lab07/data/bluebikes-stations.json');
  let trips = await d3.csv('https://dsc106.com/labs/lab07/data/bluebikes-traffic-2024-03.csv', trip => {
    trip.started_at = new Date(trip.started_at);
    trip.ended_at = new Date(trip.ended_at);
    departuresByMinute[minutesSinceMidnight(trip.started_at)].push(trip);
    arrivalsByMinute[minutesSinceMidnight(trip.ended_at)].push(trip);
    return trip;
  });

  let stations = computeStationTraffic(stationData.data.stations);
  radiusScale.domain([0, d3.max(stations, d => d.totalTraffic)]);

  let circles = svg.selectAll('circle')
    .data(stations, d => d.short_name)
    .join('circle')
    .attr('r', d => radiusScale(d.totalTraffic))
    .style('--departure-ratio', d => stationFlow(d.departures / d.totalTraffic || 0))
    .each(function (d) {
      d3.select(this).append('title').text(`${d.totalTraffic} trips (${d.departures} departures, ${d.arrivals} arrivals)`);
    });

  function updatePositions() {
    circles.attr('cx', d => getCoords(d).cx).attr('cy', d => getCoords(d).cy);
  }

  function updateScatterPlot(timeFilter) {
    let updated = computeStationTraffic(stations, timeFilter);
    if (timeFilter === -1) radiusScale.range([0, 25]);
    else radiusScale.range([3, 50]);

    circles = svg.selectAll('circle')
      .data(updated, d => d.short_name)
      .join('circle')
      .attr('r', d => radiusScale(d.totalTraffic))
      .style('--departure-ratio', d => stationFlow(d.departures / d.totalTraffic || 0));
    updatePositions();
  }

  map.on('move', updatePositions);
  map.on('zoom', updatePositions);
  map.on('resize', updatePositions);
  map.on('moveend', updatePositions);
  updatePositions();

  const timeSlider = document.querySelector('#time-slider');
  const selectedTime = document.querySelector('#selected-time');
  const anyTimeLabel = document.querySelector('#any-time');

  function formatTime(minutes) {
    const date = new Date(0, 0, 0, 0, minutes);
    return date.toLocaleString('en-US', { timeStyle: 'short' });
  }

  function updateTimeDisplay() {
    const val = Number(timeSlider.value);
    if (val === -1) {
      selectedTime.textContent = '';
      anyTimeLabel.style.display = 'block';
    } else {
      selectedTime.textContent = formatTime(val);
      anyTimeLabel.style.display = 'none';
    }
    updateScatterPlot(val);
  }

  timeSlider.addEventListener('input', updateTimeDisplay);
  updateTimeDisplay();
});
