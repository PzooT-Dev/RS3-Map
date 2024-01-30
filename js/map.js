'use strict';

import { Position } from './model/Position.js';

// Import controls
import { CollectionControl } from './controls/collection_control.js';
import { CoordinatesControl } from './controls/coordinates_control.js';
import { LocalCoordinatesControl } from './controls/local_coordinates_control.js';
import { RegionBaseCoordinatesControl } from './controls/region_base_coordinates_control.js';
import { GridControl } from './controls/grid_control.js';
import { PlaneControl } from './controls/plane_control.js';
import { RegionLabelsControl } from './controls/region_labels_control.js';
import { RegionLookupControl } from './controls/region_lookup_control.js';
import { TitleLabel } from './controls/title_label.js';

import './mejrs/L.DynamicIcons.js'; 

$(document).ready(function () {
    const map = L.map.gameMap('map', {
        maxBounds: [[-1000, -1000], [12800 + 1000, 12800 + 1000]],
        maxBoundsViscosity: 0.5,
        zoom: 2,
        zoomControl: false,
        minZoom: -4,
        maxZoom: 4,
        doubleClickZoom: false,
        showMapBorder: true,
    });

    // Load basemaps from JSON file
    $.getJSON('https://raw.githubusercontent.com/mejrs/data_rs3/master/basemaps.json', function (basemaps) {
        basemaps.forEach(function (basemap) {
            L.tileLayer(basemap.url, {
                minZoom: basemap.minZoom,
                maxZoom: basemap.maxZoom,
                attribution: basemap.attribution,
            }).addTo(map);
        });
    });

    // Create a layer group for the icon layer
    const iconLayerGroup = L.layerGroup();
    const areaLayerGroup = L.layerGroup();
    const zoneLayerGroup = L.layerGroup();
    const teleportLayerGroup = L.layerGroup();
    const transportLayerGroup = L.layerGroup();
    const labelLayerGroup = L.layerGroup();
    
    // Map squares layer
    L.tileLayer.main('https://raw.githubusercontent.com/mejrs/layers_rs3/master/mapsquares/{mapId}/{zoom}/{plane}_{x}_{y}.png', {
        minZoom: -4,
        maxNativeZoom: 3,
        maxZoom: 4,
    }).addTo(map);

    // Add the icon layer to the layer group and the map
    const iconLayer = L.tileLayer.main('https://raw.githubusercontent.com/mejrs/layers_rs3/master/icon_squares/{mapId}/{zoom}/{plane}_{x}_{y}.png', {
        minZoom: -4,
        maxNativeZoom: 3,
        maxZoom: 4,
    }).addTo(iconLayerGroup);

    const areasLayer = L.tileLayer.main("https://raw.githubusercontent.com/mejrs/layers_rs3/areas_squares/{mapId}/{zoom}/{plane}_{x}_{y}.png", {
        minZoom: -4,
        maxNativeZoom: 3,
        maxZoom: 4,
    }).addTo(areaLayerGroup);

    const zoneLayer = L.tileLayer.main("https://raw.githubusercontent.com/mejrs/layers_rs3/zonemap_squares/{mapId}/{zoom}_0_{x}_{y}.png", {
        minZoom: -4,
        maxNativeZoom: 3,
        maxZoom: 4,
    }).addTo(zoneLayerGroup);

    const teleportLayer = L.teleports({
        API_KEY: "AIzaSyBrYT0-aS9VpW2Aenm-pJ2UCUhih8cZ4g8",
        SHEET_ID: "1ZjKyAMUWa1qxFvBnmXwofNkRBkVfsizoGwp6rZylXXM",
        minZoom: -3,
        filterFn: (item) => item.type === "teleport",
    }).addTo(teleportLayerGroup);

    const transportLayer = L.teleports({
        API_KEY: "AIzaSyBrYT0-aS9VpW2Aenm-pJ2UCUhih8cZ4g8",
        SHEET_ID: "1ZjKyAMUWa1qxFvBnmXwofNkRBkVfsizoGwp6rZylXXM",
        minZoom: -3,
        filterFn: (item) => item.type !== "teleport",
    }).addTo(transportLayerGroup);

    const labelLayer = L.maplabelGroup({
        API_KEY: "AIzaSyBrYT0-aS9VpW2Aenm-pJ2UCUhih8cZ4g8",
        SHEET_ID: "1apnt91ud4GkWsfuxJTXdhrGjyGFL0hNz6jYDED3abX0",
    }).addTo(labelLayerGroup);

    // Overlay layers (toggleable layers)
    const overlayLayers = {
        'Labels': labelLayerGroup,
        'Icons': iconLayerGroup,
        'Areas': areaLayerGroup,
        'Zones': zoneLayerGroup,
        'Teleports': teleportLayerGroup,
        'Transports': transportLayerGroup,
    };

    // Add controls to the map
    L.control.layers(null, overlayLayers).addTo(map);

    map.getContainer().focus();

    map.addControl(new TitleLabel());
    map.addControl(new CoordinatesControl());
    map.addControl(new RegionBaseCoordinatesControl());
    map.addControl(new LocalCoordinatesControl());
    map.addControl(L.control.zoom());
    map.addControl(new PlaneControl());
    map.addControl(new CollectionControl({ position: 'topright' }));
    map.addControl(new RegionLookupControl());
    map.addControl(new GridControl());
    map.addControl(new RegionLabelsControl());

    let prevMouseRect, prevMousePos;
    map.on('mousemove', function (e) {
        const mousePos = Position.fromLatLng(e.latlng, map.getPlane());

        if (prevMousePos !== mousePos) {
            prevMousePos = mousePos;
            if (prevMouseRect !== undefined) {
                map.removeLayer(prevMouseRect);
            }

            prevMouseRect = mousePos.toLeaflet();
            prevMouseRect.addTo(map);
        }
    });
});
