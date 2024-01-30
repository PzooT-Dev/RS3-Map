// L.DynamicIcons.js

// Import Leaflet if not already imported
import L from 'leaflet';

// Define L.DynamicIcons class
L.DynamicIcons = L.Layer.extend({
    options: {
        updateWhenIdle: L.Browser.mobile,
        updateWhenZooming: true,
        updateInterval: 200,
        zIndex: 1,
        bounds: null,
        minZoom: undefined,
        maxZoom: undefined,

        // @option nativeZoom: Number
        // The zoom level at which one tile corresponds to one unit of granularity of the icon data
        nativeZoom: 2,

        // @option nativeZoomTileSize: Number
        // Px size of one tile at nativeZoom. Use a number if width and height are equal, or `L.point(width, height)` otherwise.
        nativeTileSize: 256,

        className: "",
        keepBuffer: 2,

        // @option filterFn: Function
        // Function applied by .filter() on icon data
        filterFn: undefined,

        // @option mapFn: Function
        // Function applied by .map() on icon data
        mapFn: undefined,

        // @option show3d: boolean
        // If true, shows a greyed marker if the marker is on a different plane
        show3d: true,
    },

    initialize: function (options) {
        L.setOptions(this, options);
    },

    onAdd: function (map) {
        // eslint-disable-line no-unused-vars
        if (this.options.dataPath) {
            fetch(this.options.dataPath)
                .then((response) => response.json())
                .then((response) => {
                    if (this.options.filterFn) {
                        response = response.filter(this.options.filterFn);
                    }

                    if (this.options.mapFn) {
                        response = response.map(this.options.mapFn);
                    }

                    this._icon_data = this.parseData(response);
                    this._icons = {};
                    this._resetView();
                    this._update();
                })
                .catch(console.error);
        } else {
            throw new Error("No dataPath specified");
        }
    },

    parseData: function (data) {
        data.forEach(
            (item) =>
            (item.key = this._tileCoordsToKey({
                plane: item.p ?? item.plane,
                x: item.x >> 6,
                y: -(item.y >> 6),
            }))
        );

        let icon_data = {};
        data.forEach((item) => {
            if (!(item.key in icon_data)) {
                icon_data[item.key] = [];
            }
            icon_data[item.key].push(item);
        });

        console.info("Added", data.length, "items");
        return icon_data;
    },

    onRemove: function (map) {
        // eslint-disable-line
        this._removeAllIcons();

        this._tileZoom = undefined;
    },

    // @method setZIndex(zIndex: Number): this
    // Changes the [zIndex](#gridlayer-zindex) of the grid layer.
    setZIndex: function (zIndex) {
        return L.GridLayer.prototype.setZIndex.call(this, zIndex);
    },

    // @method isLoading: Boolean
    // Returns `true` if any tile in the grid layer has not finished loading.
    isLoading: function () {
        return this._loading;
    },

    // @method redraw: this
    // Causes the layer to clear all the tiles and request them again.
    redraw: function () {
        if (this._map) {
            this._removeAllIcons();
            this._update();
        }
        return this;
    },

    getEvents: function () {
        return L.GridLayer.prototype.getEvents.call(this);
    },

    // @section
    // @method getTileSize: Point
    // Normalizes the [tileSize option](#gridlayer-tilesize) into a point. Used by the `createTile()` method.
    getTileSize: function () {
        var s = this.options.nativeTileSize;
        return s instanceof L.Point ? s : new L.Point(s, s);
    },

    _updateZIndex: function () {
        if (this._container && this.options.zIndex !== undefined && this.options.zIndex !== null) {
            this._container.style.zIndex = this.options.zIndex;
        }
    },

    _setAutoZIndex: function (compare) {
        return L.GridLayer.prototype._setAutoZIndex.call(this, compare);
    },

    _pruneIcons: function () {
        if (!this._map) {
            return;
        }

        var key, icons;

        var zoom = this._map.getZoom();
        if (zoom > this.options.maxZoom || zoom < this.options.minZoom) {
            this._removeAllIcons();
            return;
        }

        for (key in this._icons) {
            icons = this._icons[key];
            icons.retain = icons.current;
        }

        for (key in this._icons) {
            let tile = this._icons[key];
            if (tile.current && !tile.active) {
                var coords = tile.coords;
                if (!this._retainParent(coords.x, coords.y, coords.z, coords.z - 5)) {
                    this._retainChildren(coords.x, coords.y, coords.z, coords.z + 2);
                }
            }
        }

        for (key in this._icons) {
            if (!this._icons[key].retain) {
                this._removeIcons(key);
            }
        }
    },

    _removeTilesAtZoom: function (zoom) {
        for (var key in this._icons) {
            if (this._icons[key].coords.z !== zoom) {
                continue;
            }
            this._removeIcons(key);
        }
    },

    _removeAllIcons: function () {
        for (var key in this._icons) {
            this._removeIcons(key);
        }
    },

    _invalidateAll: function () {
        this._removeAllIcons();

        this._tileZoom = undefined;
    },

    _retainParent: function (x, y, z, minZoom) {
        var x2 = Math.floor(x / 2),
            y2 = Math.floor(y / 2),
            z2 = z - 1,
            coords2 = new L.Point(+x2, +y2);
        coords2.z = +z2;

        var key = this._tileCoordsToKey(coords2),
            tile = this._icons[key];

        if (tile && tile.active) {
            tile.retain = true;
            return true;
        } else if (tile && tile.loaded) {
            tile.retain = true;
        }

        if (z2 > minZoom) {
            return this._retainParent(x2, y2, z2, minZoom);
        }

        return false;
    },

    _retainChildren: function (x, y, z, maxZoom) {
        for (var i = 2 * x; i < 2 * x + 2; i++) {
            for (var j = 2 * y; j < 2 * y + 2; j++) {
                var coords = new L.Point(i, j);
                coords.z = z + 1;

                var key = this._tileCoordsToKey(coords),
                    tile = this._icons[key];

                if (tile && tile.active) {
                    tile.retain = true;
                    continue;
                } else if (tile && tile.loaded) {
                    tile.retain = true;
                }

                if (z + 1 < maxZoom) {
                    this._retainChildren(i, j, z + 1, maxZoom);
                }
            }
        }
    },

    _resetView: function (e) {
        return L.GridLayer.prototype._resetView.call(this, e);
    },

    _animateZoom: function (e) {
        return L.GridLayer.prototype._resetView.call(this, e);
    },

    _setView: function (center, zoom, noPrune, noUpdate) {
        var tileZoom = this.options.nativeZoom;

        if ((this.options.maxZoom !== undefined && zoom > this.options.maxZoom) || (this.options.minZoom !== undefined && zoom < this.options.minZoom)) {
            tileZoom = undefined;
        }

        var tileZoomChanged = this.options.updateWhenZooming && tileZoom !== this._tileZoom;
        if (!noUpdate || tileZoomChanged) {
            this._tileZoom = tileZoom;

            if (this._abortLoading) {
                this._abortLoading();
            }

            this._resetGrid();

            if (tileZoom !== undefined) {
                this._update(center);
            }

            if (!noPrune) {
                this._pruneIcons();
            }

            this._noPrune = !!noPrune;
        }
    },
    _onMoveEnd: function () {
        return L.GridLayer.prototype._onMoveEnd.call(this);
    },

    _resetGrid: function () {
        return L.GridLayer.prototype._resetGrid.call(this);
    },

    _pxBoundsToTileRange: function (bounds) {
        var tileSize = this.getTileSize();
        return new L.Bounds(bounds.min.unscaleBy(tileSize).floor(), bounds.max.unscaleBy(tileSize).ceil());
    },

    _getTiledPixelBounds: function (center) {
        return L.GridLayer.prototype._getTiledPixelBounds.call(this, center);
    },

    // Private method to load icons in the grid's active zoom level according to map bounds
    _update: function (center) {
        var map = this._map;
        if (!map) {
            return;
        }
        var zoom = this.options.nativeZoom;

        if (center === undefined) {
            center = map.getCenter();
        }
        if (this._tileZoom === undefined) {
            return;
        } // if out of minzoom/maxzoom

        var pixelBounds = this._getTiledPixelBounds(center),
            tileRange = this._pxBoundsToTileRange(pixelBounds),
            tileCenter = tileRange.getCenter(),
            queue = [],
            margin = this.options.keepBuffer,
            noPruneRange = new L.Bounds(tileRange.getBottomLeft().subtract([margin, -margin]), tileRange.getTopRight().add([margin, -margin]));

        // Sanity check: panic if the tile range contains Infinity somewhere.
        if (!(isFinite(tileRange.min.x) && isFinite(tileRange.min.y) && isFinite(tileRange.max.x) && isFinite(tileRange.max.y))) {
            throw new Error("Attempted to load an infinite number of tiles");
        }

        for (var key in this._icons) {
            var c = this._icons[key].coords;

            if (c.z !== this._tileZoom || !noPruneRange.contains(new L.Point(c.x, c.y))) {
                this._icons[key].current = false;
                this._removeIcons(key);
            }
        }

        // _update just loads more tiles. If the tile zoom level differs too much
        // from the map's, let _setView reset levels and prune old tiles.
        if (Math.abs(zoom - this._tileZoom) > 1) {
            this._setView(center, zoom);
            return;
        }

        // create a queue of coordinates to load icons for
        for (var j = tileRange.min.y; j <= tileRange.max.y; j++) {
            for (var i = tileRange.min.x; i <= tileRange.max.x; i++) {
                var coords = new L.Point(i, j);
                coords.z = this._tileZoom;
                coords.plane = this._map.getPlane();

                if (!this._isValidTile(coords)) {
                    continue;
                }

                var tile = this._icons ? this._icons[this._tileCoordsToKey(coords)] : undefined;
                if (tile) {
                    tile.current = true;
                } else {
                    var dataKey = this._tileCoordsToKey(coords);

                    if (this._icon_data && dataKey in this._icon_data) {
                        queue.push(coords);
                    }
                }
            }
        }

        // Not really necessary for icons
        // sort tile queue to load tiles in order of their distance to center
        // queue.sort((a, b) => a.distanceTo(tileCenter) - b.distanceTo(tileCenter));

        if (queue.length !== 0) {
            // if it's the first batch of tiles to load
            if (!this._loading) {
                this._loading = true;
                // @event loading: Event
                // Fired when the grid layer starts loading tiles.
                this.fire("loading");
            }

            queue.forEach((coord) => this._addIcons(coord));
            this._loading = false;
        }
    },

    _isValidTile: function (coords) {
        return L.GridLayer.prototype._isValidTile.call(this, coords);
    },

    _keyToBounds: function (key) {
        return this._tileCoordsToBounds(this._keyToTileCoords(key));
    },

    _tileCoordsToNwSe: function (coords) {
        return L.GridLayer.prototype._tileCoordsToNwSe.call(this, coords);
    },

    // converts tile coordinates to its geographical bounds
    _tileCoordsToBounds: function (coords) {
        return L.GridLayer.prototype._tileCoordsToBounds.call(this, coords);
    },
    // converts tile coordinates to key for the tile cache
    _tileCoordsToKey: function (coords) {
        try {
            return (this.options.show3d ? 0 : coords.plane) + ":" + coords.x + ":" + coords.y;
        } catch {
            throw new Error("Error parsing " + JSON.stringify(coords));
        }
    },

    // converts tile cache key to coordinates
    _keyToTileCoords: function (key) {
        var k = key.split(":");

        return {
            plane: this.options.show3d ? 0 : +k[0],
            x: +k[1],
            y: +k[2],
        };
    },

    _removeIcons: function (key) {
        var icons = this._icons[key].icons;

        if (!icons) {
            return;
        }

        icons.forEach((item) => this._map.removeLayer(item));

        delete this._icons[key];

        // Fired when a group of icons is removed
        this.fire("iconunload", {
            coords: this._keyToTileCoords(key),
        });
    },

    _getTilePos: function (coords) {
        return L.GridLayer.prototype._getTilePos.call(this, coords);
    },

    getAverageLatLng: function (icons) {
        let latlngs = icons.map((icon) => icon.getLatLng());
        let lat = latlngs.map((latlng) => latlng.lat).reduce((a, b) => a + b, 0) / icons.length;
        let lng = latlngs.map((latlng) => latlng.lng).reduce((a, b) => a + b, 0) / icons.length;
        return new L.LatLng(lat, lng);
    },

    createIcon: function (item) {
        let icon = L.icon({
            iconUrl: "images/marker-icon.png",
            iconSize: [25, 41],
            iconAnchor: [12, 41],
            popupAnchor: [1, -34],
            tooltipAnchor: [16, -28],
            shadowSize: [41, 41],
        });
        let greyscaleIcon = L.icon({
            iconUrl: "images/marker-icon-greyscale.png",
            iconSize: [25, 41],
            iconAnchor: [12, 41],
            popupAnchor: [1, -34],
            tooltipAnchor: [16, -28],
            shadowSize: [41, 41],
        });

        let marker = L.marker([item.y + 0.5, item.x + 0.5], {
            icon: (item.p ?? item.plane) === this._map.getPlane() ? icon : greyscaleIcon,
        });

        this._map.on("planechange", function (e) {
            marker.setIcon((item.p ?? item.plane) === e.newPlane ? icon : greyscaleIcon);
        });

        let popUpText = Object.entries(item)
            .map((x) => x.map((i) => (typeof i !== "string" ? JSON.stringify(i) : i)).join(" = "))
            .join("<br>");
        marker.bindPopup(popUpText, {
            autoPan: false,
        });

        return marker;
    },

    createPopupBody: function (mode, map, item) {
        let wrapper = document.createElement("div");

        let nav = item.start && item.destination ? this.createNavigator(mode, map, item) : document.createElement("div");

        let info = document.createElement("div");
        info.innerHTML = Object.entries(item)
            .map((x) => x.map((i) => (typeof i !== "string" ? JSON.stringify(i) : i)).join(" = "))
            .join("<br>");

        wrapper.appendChild(nav);
        wrapper.appendChild(info);
        return wrapper;
    },

    _addIcons: function (coords) {
        //var tilePos = this._getTilePos(coords);
        var key = this._tileCoordsToKey(coords);
        var dataKey = this._tileCoordsToKey(coords);
        var data = this._icon_data[dataKey];
        var icons = [];

        data.forEach((item) => {
            var icon = this.createIcon(item);
            this._map.addLayer(icon);
            icons.push(icon);
        });
        this._icons[key] = {
            icons: icons,
            coords: coords,
            current: true,
        };
    },
});

// Export the L.DynamicIcons class
export default L.DynamicIcons;
