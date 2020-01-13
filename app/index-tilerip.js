var app = new Vue({
  el: '#app',
  vuetify: new Vuetify({
    icons: {
      iconfont: 'fa'
    }
  }),
  name: "TileRipWebview",
  data: {
    currentTileLayer: L.tileLayer('https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png', {
      maxZoom: 17,
      attribution: 'Map data: &copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors, <a href="http://viewfinderpanoramas.org">SRTM</a> | Map style: &copy; <a href="https://opentopomap.org">OpenTopoMap</a> (<a href="https://creativecommons.org/licenses/by-sa/3.0/">CC-BY-SA</a>)'
    }),
    currentTileLayerTitle: '',
    drawControlIsRendered: false,
    drawnItems: null,
    drawnItemsJson: {
      type: 'FeatureCollection',
      features: []
    },
    esriWorldImagery: L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', {
      attribution: 'Tiles &copy; Esri &mdash; Source: Esri, i-cubed, USDA, USGS, AEX, GeoEye, Getmapping, Aerogrid, IGN, IGP, UPR-EGP, and the GIS User Community'
    }),
    isInitialRender: true,
    layersSelected: [],
    map: null,
    mapCenter: {
      lat: 38,
      lng: -109
    },
    mapData: null,
    mapZoom: 10,
    openStreetMap_Mapnik: L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
    }),
    openTopoMap: L.tileLayer('https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png', {
      maxZoom: 17,
      attribution: 'Map data: &copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors, <a href="http://viewfinderpanoramas.org">SRTM</a> | Map style: &copy; <a href="https://opentopomap.org">OpenTopoMap</a> (<a href="https://creativecommons.org/licenses/by-sa/3.0/">CC-BY-SA</a>)'
    }),
    renderedLayers: {},
    selectMinZoom: 10,
    selectMinZoomItems: [9, 10, 11, 12, 13, 14, 15],
    selectMaxZoom: 15,
    selectMaxZoomItems: [11, 12, 13, 14, 15],
    showTileLayerList: false,
    tilesCalculated: false,
    tileLayerTitle: null,
    tilesRequired: [],
    usgsTopo: L.tileLayer('https://services.arcgisonline.com/ArcGIS/rest/services/USA_Topo_Maps/MapServer/tile/{z}/{y}/{x}.jpg', {
      attribution: 'attributes here'
    }),
    wHeight: 600
  },
  computed: {
    mapHeight: {
      get: function () {
        return String(this.wHeight - 48) + 'px'
      }
    }
  },
  created () {
    this.wHeight = window.innerHeight
  },
  mounted () {
    window.onresize = () => {
      this.handleResize()
    }
    this.handleResize()
    this.renderMap()
  },
  methods: {
    calculateTiles () {
      //  tilesArray holds a list for all tiles needed
      let tilesRequired = []
      let iTiles = []
      _.forEach(this.drawnItemsJson.features, drawnItem => {
        let featureBBox = turf.bbox(drawnItem)
        let neLat = featureBBox[3]
        let neLng = featureBBox[2]
        let swLat = featureBBox[1]
        let swLng = featureBBox[0]
        let minZoom = this.selectMinZoom
        let maxZoom = this.selectMaxZoom
        iTiles = this.jsRequestTiles(neLat, neLng, swLat, swLng, minZoom, maxZoom)
        //  now, only add the object to the tiles array if it's
        //  NOT already in there
        _.forEach(iTiles, tileObj => {
          let isInArray = _.find(tilesRequired, function (o) {
            return o.x === tileObj.x && o.y === tileObj.y && o.z === tileObj.z
          })
          if (!isInArray) {
            tilesRequired.push(tileObj)
          }
        })
      })
      this.tilesRequired = tilesRequired
      this.tilesCalculated = true;
    },
    handleResize () {
      this.wHeight = window.innerHeight
      if (this.map) {
        this.map.invalidateSize()
      }
      var elem = document.querySelector("#map")
      elem.style.height = this.wHeight + "px"
    },
    jsRequestTiles: (neLat, neLng, swLat, swLng, minZoom, maxZoom) => {
      function degreesToRadians (degrees) {
        var pi = Math.PI
        return degrees * (pi / 180)
      }
      let tiles = []
      let x, y, z
      for (z = minZoom; z <= maxZoom; z++) {
        let iNeY = Math.floor((1 - Math.log(Math.tan(degreesToRadians(neLat)) + 1 / Math.cos(degreesToRadians(neLat))) / Math.PI) / 2 * Math.pow(2, z))
        let iSwY = Math.floor((1 - Math.log(Math.tan(degreesToRadians(swLat)) + 1 / Math.cos(degreesToRadians(swLat))) / Math.PI) / 2 * Math.pow(2, z))
        for (y = iNeY; y <= iSwY; y++) {
          //  now we iterate through the x, which we need to generate
          let iNeX = Math.floor(((neLng + 180) / 360) * Math.pow(2, z))
          let iSwX = Math.floor(((swLng + 180) / 360) * Math.pow(2, z))
          for (x = iSwX; x <= iNeX; x++) {
            let iTile = {}
            iTile.z = z
            iTile.x = x
            iTile.y = y
            tiles.push(iTile)
          }
        }
      }
      return tiles
    },
    loadTiles () {
      //  get envelope and centroid of drawnItemsJson
      let env = JSON.stringify(turf.envelope(this.drawnItemsJson))
      let cent = JSON.stringify(turf.centroid(this.drawnItemsJson))
      TileripClient.loadTiles(JSON.stringify(this.tilesRequired), this.tileLayerTitle, JSON.stringify(this.drawnItemsJson), this.currentTileLayerTitle, env, cent)
    },
    renderMap () {
      let self = this
      //  eslint-disable-next-line
      const defaultMarker = L.ExtraMarkers.icon({
        icon: 'fa-dot-circle',
        iconColor: 'black',
        markerColor: 'blue',
        shape: 'circle',
        prefix: 'fas'
      })
      //  eslint-disable-next-line
      const highlightMarker = L.ExtraMarkers.icon({
        icon: 'fa-dot-circle',
        iconColor: 'black',
        markerColor: 'red',
        shape: 'circle',
        prefix: 'fas'
      })
      this.map = L.map('map').setView(this.mapCenter, this.mapZoom)
      let scaleOptions = {
        imperial: true,
        metric: true,
        position: 'bottomright'
      }
      L.control.scale(scaleOptions).addTo(this.map)
      //this.currentTileLayer.addTo(this.map)
      //  add tile layer
      this.tileServerOpenTopo()
      
      //  interate through the data object and render geoJson
      /*
      _.forEach(this.mapData.layers_json, (layer) => {
        let layerId = layer.id
        this.renderedLayers[layer.id] = L.geoJson(layer.layer_json, {
          onEachFeature: (feature, layer) => {
            //  this WORKS to bind a popup and create a click event on the popup
            //  note that the className will be applied to the parent 'leaflet-popup' element
            //  not the child '.leaflet-popup-content' element . . .could be important
            //  for styling
            layer.bindPopup('<p><b>' + feature.properties.title + '</b><br/>' + feature.properties.desc + '</p>', { closeButton: false, className: 'mto-popup' }).on('popupopen', () => {
              //  set data properties for the layer id and the feature
              self.clickedFeatureLayerId = parseInt(layerId)
              //  set local data properties
              self.clickedFeature = feature
              self.clickedLayer = layer
              //  since we can't pass a parameter to the the click function,
              //  it seems that when you click from one popup to another
              //  TWO popups remain in the Dom, so we need to iterate
              //  through them both and add events . . .
              //  note that class 'leaflet-popup-content-wrapper' is added by leaflet
              var x = document.getElementsByClassName('leaflet-popup-content-wrapper')
              _.forEach(x, element => {
                element.addEventListener('click', self.handlePopupClick)
              })
            //  if we don't remove the listener, we get zombies on multiple clicks!!
            //  this is why we need to reference a named function rather than using
            //  a generic function
            }).on('popupclose', () => {
              var x = document.getElementsByClassName('leaflet-popup-content-wrapper')
              _.forEach(x, element => {
                element.removeEventListener('click', self.handlePopupClick)
              })
            })
            layer.on('mouseover', function (event) {
            })
            layer.on('mouseout', function (event) {
            })
          },
          pointToLayer: (geoJsonPoing, latlng) => {
            return L.marker(latlng, { icon: defaultMarker })
          },
          style: (feature) => {
            return {
              color: 'blue',
              stroke: true,
              weight: this.lineWidth,
              opacity: 0.6
            }
          },
          filter: (feature) => {
            //  see if this layer is in the data propery layersSelected
            //  which is toggled by the user layer select
            if (self.layersSelected.indexOf(layerId) > -1) {
              return true
            } else { return false }
          },
          //  do not allow the actual map/layers to be edited here
          pmIgnore: true

        }).addTo(this.map)
      })
      */
      this.drawnItems = L.geoJSON(this.drawnItemsJson, {
        onEachFeature: function (feature, layer) {
          layer.on('click', function (event) {
            console.log('click', feature, layer)
            self.handleFeatureClick(feature, layer)
          })
        },
        pointToLayer: function (geoJsonPoint, latlng) {
          return L.marker(latlng, { icon: defaultMarker })
        },
        style: function (feature) {
          return {
            color: 'blue',
            weight: self.lineWidth,
            opacity: 0.6,
            stroke: true,
            fill: false
          }
        }
      })
      this.map.addLayer(this.drawnItems)
      // add leaflet-geoman controls with some options to the map
      this.map.pm.addControls({
        position: 'topleft',
        drawCircle: false,
        drawRectangle: true,
        drawMarker: false,
        drawPolygon: false,
        drawPolyline: false,
        drawCircleMarker: false,
        dragMode: true,
        cutPolygon: false
      })

      this.map.pm.setPathOptions({
        color: 'orange'
      })
      this.drawControlIsRendered = true
      this.map.on('moveend', event => {
        this.mapCenter = this.map.getCenter()
        this.mapBounds = this.map.getBounds()
        this.mapBBoxString = this.map.getBounds().toBBoxString()
      })
      this.map.on('zoomend', event => {
        this.mapZoom = this.map.getZoom()
      })
      this.map.on('pm:create', function (event) {
        var layer = event.layer
        // this is critical and weird shit
        // what we're doing is adding properties to the new layer/feature
        // see https://stackoverflow.com/questions/29736345/adding-properties-to-a-leaflet-layer-that-will-become-geojson-options
        const feature = layer.feature = layer.feature || {}
        feature.type = feature.type || 'Feature'
        var props = feature.properties = feature.properties || {}
        props.title = 'Title'
        props.bbox = layer.getBounds()
        props.desc = 'Description'
        self.drawnItems.addLayer(layer)
        self.drawnItemsJson = self.drawnItems.toGeoJSON()
        //  don't rerender . . .  it messes up rectangle editing
        //  self.map.remove()
        //  self.renderMap()
        self.layerIsChanged = true
        console.log('pm:create')
        //  layers have changed, so . . disable the download button
        self.tilesCalculated = false;
      })
      self.drawnItems.on('pm:edit', function (event) {
        self.drawnItemsJson = self.drawnItems.toGeoJSON()
        self.layerIsChanged = true
        console.log('pm:edit', event.sourceTarget._bounds)
        //  layers have changed, so . . disable the download button
        self.tilesCalculated = false;
      })
      this.map.on('pm:remove', function (event) {
        self.drawnItems.removeLayer(event.layer)
        self.drawnItemsJson = self.drawnItems.toGeoJSON()
        self.layerIsChanged = true
        console.log('pm:remove')
        //  layers have changed, so . . disable the download button
        self.tilesCalculated = false;
      })
      if (this.isInitialRender === true) {
        this.isInitialRender = false
      }
    },
    tileServerOpenStreetMap () {
      this.map.removeLayer(this.currentTileLayer)
      this.currentTileLayer = this.openStreetMap_Mapnik
      this.currentTileLayerTitle = 'openStreetMap'
      this.map.addLayer(this.currentTileLayer)
    },
    tileServerEsriWorldImagery () {
      this.map.removeLayer(this.currentTileLayer)
      this.currentTileLayer = this.esriWorldImagery
      this.currentTileLayerTitle = 'esriWorldImagery'
      this.map.addLayer(this.currentTileLayer)
    },
    tileServerOpenTopo () {
      this.map.removeLayer(this.currentTileLayer)
      this.currentTileLayer = this.openTopoMap
      this.currentTileLayerTitle = 'openTopo'
      this.map.addLayer(this.currentTileLayer)
    },
    tileServerUsgs (tileServer) {
      this.map.removeLayer(this.currentTileLayer)
      this.currentTileLayer = this.usgsTopo
      this.currentTileLayerTitle = 'usgsTopo'
      this.map.addLayer(this.currentTileLayer)
    }
  }
})