/******************************************************************************
 ***** CONSTANTS
 ******************************************************************************/

// the big MAP object, the starting view
var MAP;
var BBOX_SOUTHWEST = L.latLng(41.11816, -82.08504);
var BBOX_NORTHEAST = L.latLng(41.70009, -81.28029);
var MAX_BOUNDS     = L.latLngBounds(BBOX_SOUTHWEST,BBOX_NORTHEAST);
var MIN_ZOOM       = 11;
var MAX_ZOOM       = 18;

// this is the same coordinates as above
// used for focusing Bing's geocoder, so we don't find so we don't find Cleveland, Oregon
// tip: this doesn't in fact work; a holdover from Gogole Geocoder, and wishful thinking for when Bing does support it
var GEOCODE_BIAS_BOX = "41.202048178648,-81.9627793163304,41.5885467839419,-81.386224018357";

// our Bing Maps API key, used for the basemap, geocoding, and directions
var BING_API_KEY = "AjBuYw8goYn_CWiqk65Rbf_Cm-j1QFPH-gGfOxjBipxuEB2N3n9yACKu5s8Dl18N";

// basemap choices
// the terrain map is the Cleveland awesomeness: ParkInfo styling, parks and trail rendering baked in, ...
var BASEMAPS = {};
BASEMAPS['terrain'] = new L.TileLayer("http://maps{s}.clemetparks.com/tilestache/tilestache.cgi/basemap/{z}/{x}/{y}.jpg", {subdomains:'123' });
BASEMAPS['photo']   = new L.TileLayer("http://{s}.tiles.mapbox.com/v3/greeninfo.map-zudfckcw/{z}/{x}/{y}.jpg");

// overlays: closures and labels are separate from the basemap
// these are simply added to the list in sequence
// tip: the name attribute is used by the OfflineTileCacher
var OVERLAYS  = {};
OVERLAYS['markers'] = L.tileLayer.wms("http://maps{s}.clemetparks.com/gwms", { name:'markers', layers:'cm:closures,cm:markers_other,cm:markers_swgh', format:'image/png', transparent:'TRUE', subdomains:'123' });
OVERLAYS['labels']  = L.tileLayer.wms("http://maps{s}.clemetparks.com/gwc", { name:'labels', layers:'group_overlays', format:'image/png', transparent:'TRUE', subdomains:'123' });

// a whole bunch of markers
var MARKER_TARGET = L.marker(L.latLng(0,0), {
    clickable:false,
    icon:L.icon({ iconUrl:'images/marker-target.png', iconSize:[25,41], iconAnchor:[13,41] })
});
var MARKER_GPS = L.marker(L.latLng(0,0), {
    clickable:false,
    icon:L.icon({ iconUrl:'images/marker-gps.png', iconSize:[25,41], iconAnchor:[13,41] })
});
var MARKER_FROM = L.marker(L.latLng(0,0), {
    clickable:false,
    icon:L.icon({ iconUrl:'images/marker-gps.png', iconSize:[20,34], iconAnchor:[10,34] })
});
var MARKER_TO = L.marker(L.latLng(0,0), {
    clickable:false,
    icon:L.icon({ iconUrl:'images/marker-gps.png', iconSize:[20,34], iconAnchor:[10,34] })
});

// this Circle is used to show your radar on the screen
// when radar is enabled, this updates to move with you and keep the selected radius
var RADAR_CIRCLE = new L.Circle(L.latLng(0,0), 1);

// bad hack
// the More Info buttons call zoomElementClick() to show the panel with place info
// if this flag is true, zoomElementClick() will then click for car directions after the place info is loaded
// this hack allows us to fetch info and then get directions, without a second click, in the event that the place was selected from a list
// not a very great solution, but one that addresses this unexpected requirement
var SKIP_TO_DIRECTIONS = false;

// elevation profile: a set of distance-and-elevation points so we can ask for a chart
// this is set to be the elevation profile of the last-fetched directions which took place over trails
var ELEVATION_PROFILE     = null;

// styles of lines and then the Linestring objects themselves
// used for drawing h'ighlight borders on things, and for drawing the path of directions onto the map
var DIRECTIONS_LINE       = null;
var DIRECTIONS_LINE_STYLE = { color:"#0000FF", weight:5, opacity:1.00, clickable:false, smoothFactor:0.25 };
var HIGHLIGHT_LINE       = null;
var HIGHLIGHT_LINE_STYLE = { color:"#FF00FF", weight:3, opacity:0.75, clickable:false, smoothFactor:0.25 };

// used by the radar: sound an alert only if the list has in fact changed
var LAST_BEEP_IDS = [];

// used by Near You Now and then later by Radar, a structure of all POIs
// we cannot render them all into the Radar page at the same time, but we can store them in memory
var ALL_POIS = [];

// other stuff pertaining to our last known location and auto-centering
var LAST_KNOWN_LOCATION = L.latLng(41.3953,-81.6730);
var AUTO_CENTER_ON_LOCATION = false;

// sorting by distance, isn't always by distance
// what type of sorting do they prefer?
var DEFAULT_SORT = 'distance';

// for tile caching, the name of a subdirectory where this app will store its content
// this is particularly important on Android where filesystem is not a sandbox but your SD card
var STORAGE_SUBDIR = "ClevelandMetroparks";


/******************************************************************************
 ***** LEAFLET EXTENSIONS
 ******************************************************************************/

// add to LatLng the ability to calculate the bearing to another LatLng
L.LatLng.prototype.bearingTo = function(other) {
    var d2r  = L.LatLng.DEG_TO_RAD;
    var r2d  = L.LatLng.RAD_TO_DEG;
    var lat1 = this.lat * d2r;
    var lat2 = other.lat * d2r;
    var dLon = (other.lng-this.lng) * d2r;
    var y    = Math.sin(dLon) * Math.cos(lat2);
    var x    = Math.cos(lat1)*Math.sin(lat2) - Math.sin(lat1)*Math.cos(lat2)*Math.cos(dLon);
    var brng = Math.atan2(y, x);
    brng = parseInt( brng * r2d );
    brng = (brng + 360) % 360;
    return brng;
};
L.LatLng.prototype.bearingWordTo = function(other) {
    var bearing = this.bearingTo(other);
    var bearingword = '';
     if (bearing >= 22  && bearing <= 67)  bearingword = 'NE';
    else if (bearing >= 67 && bearing <= 112)  bearingword = 'E';
    else if (bearing >= 112 && bearing <= 157) bearingword = 'SE';
    else if (bearing >= 157 && bearing <= 202) bearingword = 'S';
    else if (bearing >= 202 && bearing <= 247) bearingword = 'SW';
    else if (bearing >= 247 && bearing <= 292) bearingword = 'W';
    else if (bearing >= 292 && bearing <= 337) bearingword = 'NW';
    else if (bearing >= 337 || bearing <= 22)  bearingword = 'N';
    return bearingword;
};


/******************************************************************************
 ***** PAGE STARTUP and ORIENTATION CHANGES
 ******************************************************************************/

$(window).bind('orientationchange pageshow resize', function() {
    // scrolling the window is supposed to remove the address bar,
    // but it rarely works, often lags out the page as it slowly hides half of the address bar,
    // and creates bugs when we want to operate a picklist that's longer than a page (the page scrolls, THEN gets tapped)
    //window.scroll(0, 1);

    var page    = $(":jqmData(role='page'):visible");
    var header  = $(":jqmData(role='header'):visible");
    var content = $(":jqmData(role='content'):visible");
    var viewportHeight  = $(window).height();
    var contentHeight   = viewportHeight - header.outerHeight();
    page.height(contentHeight + 1);
    $(":jqmData(role='content')").first().height(contentHeight);

    if ( $("#map_canvas").is(':visible') ) {
        $("#map_canvas").height(contentHeight);
        if (MAP) MAP.invalidateSize();
    }
});

function init() {
    // pre-render the pages so we don't have that damnable lazy rendering thing messing with it
    $('div[data-role="page"]').page();

    // now the rest of event handlers, map setup, etc. in stages
    initCacheThenMap();
}

function initCacheThenMap() {
    // initialize the filesystem where we store cached tiles. when this is ready, proceed with the map
    CACHE = new OfflineTileCacher(STORAGE_SUBDIR);
    CACHE.init(function () {
        CACHE.registerLayer(BASEMAPS['terrain']);
        CACHE.registerLayer(BASEMAPS['photo']);
        for (var which in OVERLAYS) CACHE.registerLayer( OVERLAYS[which] );
        initMap();
    }, function () {
        alert('Could not load the local filesystem. Exiting.');
        return;
    });
}

function initMap() {
    // start the map, only the basemap for starters
    MAP = new L.Map('map_canvas', {
        attributionControl: false, zoomControl: true, dragging: true,
        closePopupOnClick: false,
        crs: L.CRS.EPSG3857,
        minZoom: MIN_ZOOM, maxZoom: MAX_ZOOM,
        layers : [ BASEMAPS['terrain'] ]
    }).fitBounds(MAX_BOUNDS);

    // add the overlay layers
    // once these are on the map, they stay there; there's no UI to turn them off
    for (var which in OVERLAYS) MAP.addLayer( OVERLAYS[which] );

    // additional Controls
    L.control.scale().addTo(MAP);

    // our version of a WMS GetFeatureInfo control: a map click calls query.php to get JSON info, and we construct a bubble
    // BUT, we only call this if a popup is not open: if one is open, we instead close it
    MAP.on('click', function (event) {
        if ($('.leaflet-popup').length) return MAP.closePopup();
        wmsGetFeatureInfoByPoint(event.latlng);
    });
}


/******************************************************************************
 ***** OTHER FUNCTIONS
 ******************************************************************************/

/*
 * Return true/false indicating whether we're running under Cordova/Phonegap
 * as well as specifically which platform
 * and other device-specific querying
 */
function is_cordova() {
    return (typeof(cordova) !== 'undefined' || typeof(phonegap) !== 'undefined');
};
function is_android() {
    if (! is_cordova() ) return false;
    return device.platform == 'Android';
}
function is_ios() {
    if (! is_cordova() ) return false;
    return device.platform == 'iOS';
}
function has_internet() {
    // NOTE: this requires permissions, see the Cordova docs for "connection"
    if ( is_cordova() ) {
        return navigator.connection.type != Connection.NONE;
    } else {
        return true;
    }
}



/*
 * The wmsGetFeatureInfoByLatLngBBOX() family of functions
 * wmsGetFeatureInfoByLatLngBBOX() is the actual target function, and performs the server-side query for a given bounding box
 * The other wrappers do things like take a latlng point and add a little padding to it, since a lot of the target content is points
 */
function wmsGetFeatureInfoByPoint(latlng) {
//gda
    alert(point);
}
