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
    esriWorldImagery: L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', {
      attribution: 'Tiles &copy; Esri &mdash; Source: Esri, i-cubed, USDA, USGS, AEX, GeoEye, Getmapping, Aerogrid, IGN, IGP, UPR-EGP, and the GIS User Community'
    }),
    isInitialRender: true,
    layersSelected: [],
    locationPending: false,
    locationServiceStarted: false,
    map: null,
    mapCenter: {
      lat: 38.556,
      lng: -109.535
    },
    mapData: null,
    mapZoom: 12,
    openStreetMap_Mapnik: L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
    }),
    openTopoMap: L.tileLayer('https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png', {
      maxZoom: 17,
      attribution: 'Map data: &copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors, <a href="http://viewfinderpanoramas.org">SRTM</a> | Map style: &copy; <a href="https://opentopomap.org">OpenTopoMap</a> (<a href="https://creativecommons.org/licenses/by-sa/3.0/">CC-BY-SA</a>)'
    }),
    renderedLayers: {},
    showTileLayerList: false,
    userLat: null,
    userLng: null,
    userLocationMarker: null,
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
    //  register global functions that android will call
    console.log("USER LOCATION", this.userLat + " " + this.userLng)
    this.locationServiceStarted = true;
    
    window.loadUserLocation = (lat, lng) => {
      this.locationPending = false
      if(! this.userLocationMarker){
        console.log("creating marker . . .")
        this.userLat = lat
        this.userLng = lng
        
        this.userLocationMarker = new L.Marker([this.userLat, this.userLng]).addTo(this.map)
      } else {
        console.log("re creating marker . . . ")
        this.userLat = lat
        this.userLng = lng
        this.map.removeLayer(this.userLocationMarker)
        this.userLocationMarker = new L.Marker([this.userLat, this.userLng]).addTo(this.map)
      }
    }
  },
  mounted () {
    window.onresize = () => {
      this.handleResize()
    }
    this.handleResize()
    //  here we want to go to android and get the map data . .  
    /*
    api.map.getMap(this.mapId).then(response => {
      this.mapData = response.data
      //  set map center
      this.mapCenter.lat = response.data.centroid_json.coordinates[1]
      this.mapCenter.lng = response.data.centroid_json.coordinates[0]
      //  set layersSelectd to all layers
      this.layersSelected = response.data.layers
      this.renderMap()
    })
    */
    this.renderMap()
    //  let the android webview know we're loaded
    //  eslint-ignore-next-line
    MapClient.viewLoaded()

  },
  methods: {
    handleResize () {
      this.wHeight = window.innerHeight
      if (this.map) {
        this.map.invalidateSize()
      }
      var elem = document.querySelector('#map')
      elem.style.height = this.wHeight + 'px'
    },
    locate () {
      console.log('locate()')
      //  eslint-ignore-next-line
      if(this.locationServiceStarted){
        this.locationServiceStarted = false
        this.userLat = ""
        this.userLng = ""
        this.map.removeLayer(this.userLocationMarker)
        MapClient.stopGpsLocation()
      } else {
        this.locationServiceStarted = true
        this.locationPending = true
        MapClient.startGpsLocation()
      }
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
      this.currentTileLayer.addTo(this.map)
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
  

      this.map.on('moveend', event => {
        this.mapCenter = this.map.getCenter()
        this.mapBounds = this.map.getBounds()
        this.mapBBoxString = this.map.getBounds().toBBoxString()
      })
      this.map.on('zoomend', event => {
        this.mapZoom = this.map.getZoom()
      })
      if (this.isInitialRender === true) {
        this.isInitialRender = false
      }
    },
    tileServerOpenStreetMap () {
      this.map.removeLayer(this.currentTileLayer)
      this.currentTileLayer = this.openStreetMap_Mapnik
      this.map.addLayer(this.currentTileLayer)
    },
    tileServerEsriWorldImagery () {
      this.map.removeLayer(this.currentTileLayer)
      this.currentTileLayer = this.esriWorldImagery
      this.map.addLayer(this.currentTileLayer)
    },
    tileServerOpenTopo () {
      this.map.removeLayer(this.currentTileLayer)
      this.currentTileLayer = this.openTopoMap
      this.map.addLayer(this.currentTileLayer)
    },
    tileServerUsgs (tileServer) {
      this.map.removeLayer(this.currentTileLayer)
      this.currentTileLayer = this.usgsTopo
      this.map.addLayer(this.currentTileLayer)
    }
  }
})