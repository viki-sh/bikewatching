// map.js
import mapboxgl from 'https://cdn.jsdelivr.net/npm/mapbox-gl@2.15.0/+esm';
import * as d3 from 'https://cdn.jsdelivr.net/npm/d3@7.9.0/+esm';

mapboxgl.accessToken = 'pk.eyJ1IjoidmlraS1zaGkiLCJhIjoiY21hc203ODZqMGxyaTJzcHZlYTNldTZjdiJ9.Px2_WlK9ehu9DfQO-BaZCA';

const svg = d3.select('#map').select('svg');
let departuresByMinute = Array.from({ length: 1440 }, () => []);
let arrivalsByMinute = Array.from({ length: 1440 }, () => []);
let allStations = [];

function getCoords(station) {
  const pt = new mapboxgl.LngLat(+station.Long, +station.Lat);
  const { x, y } = map.project(pt);
  return { cx: x, cy: y };
}

function minutesSinceMidnight(date) {
  return date.getHours() * 60 + date.getMinutes();
}

function filterByMinute(tripsByMinute, minute) {
  if (minute === -1) return tripsByMinute.flat();
  const minMinute = (minute - 60 + 1440) % 1440;
  const maxMinute = (minute + 60) % 1440;
  return minMinute > maxMinute
    ? tripsByMinute.slice(minMinute).concat(tripsByMinute.slice(0, maxMinute)).flat()
    : tripsByMinute.slice(minMinute, maxMinute).flat();
}

function computeStationTraffic(stations, timeFilter = -1) {
  const departures = d3.rollup(
    filterByMinute(departuresByMinute, timeFilter),
    v => v.length,
    d => d.start_station_id
  );

  const arrivals = d3.rollup(
    filterByMinute(arrivalsByMinute, timeFilter),
    v => v.length,
    d => d.end_station_id
  );

  return stations.map(station => {
    let id = station.Number;
    station.departures = departures.get(id) ?? 0;
    station.arrivals = arrivals.get(id) ?? 0;
    station.totalTraffic = station.departures + station.arrivals;
    return station;
  });
}

function formatTime(minutes) {
  return new Date(0, 0, 0, 0, minutes).toLocaleString('en-US', { timeStyle: 'short' });
}

function updatePositions(circles) {
  circles.attr('cx', d => getCoords(d).cx).attr('cy', d => getCoords(d).cy);
}

const map = new mapboxgl.Map({
  container: 'map',
  style: 'mapbox://styles/mapbox/streets-v12',
  center: [-71.09415, 42.36027],
  zoom: 12,
  minZoom: 5,
  maxZoom: 18,
});

map.on('load', async () => {
  map.addSource('boston_route', {
    type: 'geojson',
    data: 'https://bostonopendata-boston.opendata.arcgis.com/datasets/boston::existing-bike-network-2022.geojson',
  });
  map.addLayer({
    id: 'boston-bike-lanes',
    type: 'line',
    source: 'boston_route',
    paint: { 'line-color': '#00ff00', 'line-width': 3, 'line-opacity': 0.6 },
  });

  map.addSource('cambridge_route', {
    type: 'geojson',
    data: 'https://raw.githubusercontent.com/cambridgegis/cambridgegis_data/main/Recreation/Bike_Facilities/RECREATION_BikeFacilities.geojson',
  });
  map.addLayer({
    id: 'cambridge-bike-lanes',
    type: 'line',
    source: 'cambridge_route',
    paint: { 'line-color': '#0000ff', 'line-width': 3, 'line-opacity': 0.6 },
  });

  const stations = await d3.json('https://dsc106.com/labs/lab07/data/bluebikes-stations.json');
  const trips = await d3.csv('https://dsc106.com/labs/lab07/data/bluebikes-traffic-2024-03.csv', d => {
    d.started_at = new Date(d.started_at);
    d.ended_at = new Date(d.ended_at);
    departuresByMinute[minutesSinceMidnight(d.started_at)].push(d);
    arrivalsByMinute[minutesSinceMidnight(d.ended_at)].push(d);
    return d;
  });

  const radiusScale = d3
    .scaleSqrt()
    .domain([0, d3.max(trips, d => d.totalTraffic)])
    .range([0, 25]);

  const stationFlow = d3.scaleQuantize().domain([0, 1]).range([0, 0.5, 1]);

  allStations = computeStationTraffic(stations);

  const circles = svg
    .selectAll('circle')
    .data(allStations, d => d.Number)
    .enter()
    .append('circle')
    .attr('r', d => radiusScale(d.totalTraffic))
    .attr('fill', 'steelblue')
    .attr('stroke', 'white')
    .attr('stroke-width', 1)
    .attr('opacity', 0.6)
    .attr('pointer-events', 'auto')
    .each(function (d) {
      d3.select(this)
        .append('title')
        .text(`${d.totalTraffic} trips (${d.departures} departures, ${d.arrivals} arrivals)`);
    });

  updatePositions(circles);
  map.on('move', () => updatePositions(circles));
  map.on('zoom', () => updatePositions(circles));
  map.on('resize', () => updatePositions(circles));
  map.on('moveend', () => updatePositions(circles));

  const timeSlider = document.getElementById('time-slider');
  const selectedTime = document.getElementById('selected-time');
  const anyTimeLabel = document.getElementById('any-time');

  function updateScatterPlot(timeFilter) {
    const filtered = computeStationTraffic(stations, timeFilter);
    radiusScale.range(timeFilter === -1 ? [0, 25] : [3, 50]);

    svg
      .selectAll('circle')
      .data(filtered, d => d.Number)
      .join('circle')
      .attr('r', d => radiusScale(d.totalTraffic))
      .style('--departure-ratio', d => stationFlow(d.departures / d.totalTraffic));

    updatePositions(svg.selectAll('circle'));
  }

  function updateTimeDisplay() {
    let timeFilter = +timeSlider.value;
    if (timeFilter === -1) {
      selectedTime.textContent = '';
      anyTimeLabel.style.display = 'block';
    } else {
      selectedTime.textContent = formatTime(timeFilter);
      anyTimeLabel.style.display = 'none';
    }
    updateScatterPlot(timeFilter);
  }

  timeSlider.addEventListener('input', updateTimeDisplay);
  updateTimeDisplay();
});