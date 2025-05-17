import mapboxgl from 'https://cdn.jsdelivr.net/npm/mapbox-gl@2.15.0/+esm';
import * as d3 from 'https://cdn.jsdelivr.net/npm/d3@7.9.0/+esm';

mapboxgl.accessToken = 'pk.eyJ1IjoidmlraS1zaGkiLCJhIjoiY21hc203ODZqMGxyaTJzcHZlYTNldTZjdiJ9.Px2_WlK9ehu9DfQO-BaZCA';

const svg = d3.select('#map').select('svg');
let departuresByMinute = Array.from({ length: 1440 }, () => []);
let arrivalsByMinute = Array.from({ length: 1440 }, () => []);

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
  const min = (minute - 60 + 1440) % 1440;
  const max = (minute + 60) % 1440;
  return min > max
    ? tripsByMinute.slice(min).concat(tripsByMinute.slice(0, max)).flat()
    : tripsByMinute.slice(min, max).flat();
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
    const id = station.Number;
    station.departures = departures.get(id) ?? 0;
    station.arrivals = arrivals.get(id) ?? 0;
    station.totalTraffic = station.departures + station.arrivals;
    return station;
  });
}

function formatTime(minutes) {
  return new Date(0, 0, 0, 0, minutes).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
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
    .domain([0, d3.max(stations, s => s.totalTraffic || 500)])
    .range([0, 25]);

  const stationFlow = d3.scaleQuantize().domain([0, 1]).range([0, 0.5, 1]);

  let allStations = computeStationTraffic(stations);

  const circles = svg
    .selectAll('circle')
    .data(allStations, d => d.Number)
    .join('circle')
    .attr('r', d => radiusScale(d.totalTraffic))
    .attr('stroke', 'white')
    .attr('stroke-width', 1)
    .attr('opacity', 0.7)
    .style('--departure-ratio', d => stationFlow(d.departures / d.totalTraffic || 0.5))
    .append('title')
    .text(d => `${d.Name}\n${d.totalTraffic} trips\n(${d.departures} departures, ${d.arrivals} arrivals)`);

  updatePositions(svg.selectAll('circle'));
  map.on('move', () => updatePositions(svg.selectAll('circle')));
  map.on('zoom', () => updatePositions(svg.selectAll('circle')));
  map.on('resize', () => updatePositions(svg.selectAll('circle')));

  const slider = document.getElementById('time-slider');
  const selected = document.getElementById('selected-time');
  const any = document.getElementById('any-time');

  slider.addEventListener('input', () => {
    const minute = +slider.value;
    selected.textContent = minute === -1 ? '' : formatTime(minute);
    any.style.display = minute === -1 ? 'inline' : 'none';

    const updated = computeStationTraffic(stations, minute);
    svg
      .selectAll('circle')
      .data(updated, d => d.Number)
      .join('circle')
      .attr('r', d => radiusScale(d.totalTraffic))
      .style('--departure-ratio', d => stationFlow(d.departures / d.totalTraffic || 0.5))
      .attr('stroke', 'white')
      .attr('opacity', 0.7)
      .append('title')
      .text(d => `${d.Name}\n${d.totalTraffic} trips\n(${d.departures} departures, ${d.arrivals} arrivals)`);

    updatePositions(svg.selectAll('circle'));
  });
});
