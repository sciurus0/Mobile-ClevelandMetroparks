/******************************************************************************
 ***** CONSTANTS
 ******************************************************************************/

// the base URL where all data endpoints reside: the CMP website
var BASE_URL = "http://maps-dev.clevelandmetroparks.com/";

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
BASEMAPS['terrain'] = new L.TileLayer("http://maps{s}.clemetparks.com/tilestache/tilestache.cgi/basemap_mobilestack/{z}/{x}/{y}.jpg", { name:'terrain', subdomains:'123', updateWhenIdle:true, errorTileUrl:'images/nodata_tile.png' });
BASEMAPS['photo']   = new L.TileLayer("http://maps{s}.clemetparks.com/tilestache/tilestache.cgi/satphoto_mobilestack/{z}/{x}/{y}.jpg", { name:'photo', subdomains:'123', updateWhenIdle:true, errorTileUrl:'images/nodata_tile.png' });

// a whole bunch of markers for various purposes
// in initMap() they are created and are added to the MAP
// they are at 0,0 so are not visible until we use a setLatLng() on them to bring them into view
var MARKER_GPS;     // your current location, per handleLocationFound()
var MARKER_TARGET;  // a target location, notably a POI on which you clicked to show no map; see showDetailsPanel()
var MARKER_FROM;    // for directions, the markers on the endpoints of your route
var MARKER_TO;      // for directions, the markers on the endpoints of your route

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
// used for drawing highlight borders on things, and for drawing the path of directions onto the map
var DIRECTIONS_LINE       = null;
var DIRECTIONS_LINE_STYLE = { color:"#0000FF", weight:5, opacity:1.00, clickable:false, smoothFactor:5 };
var HIGHLIGHT_LINE       = null;
var HIGHLIGHT_LINE_STYLE = { color:"#FF00FF", weight:3, opacity:0.75, clickable:false, smoothFactor:5 };

// used by the Nearby Alert: sound an alert only if the list of Things Nearby has in fact changed
// so we don't nd up alerting multiple times as our location updates and we're seeing the exact same thing!
var NEARBY_LAST_ALERT_IDS = [];

// should we auto-center the map on location updates? don't toggle this directly, see toggleGPS()
// when we zoom to our own location, to what zoom level?
var AUTO_CENTER_ON_LOCATION = false;
var AUTO_CENTER_ZOOMLEVEL   = 16;

// for tile caching, the name of a subdirectory where this app will store its content
// this is particularly important on Android where filesystem is not a sandbox but your SD card
var STORAGE_SUBDIR = "Come Out And Play";
var MAX_CACHING_ZOOMLEVEL = 16;

// the list of Reservations (parks)
// used to build select elements and potentially listviews, e.g. filtering for Loops or Trails by reservation
// WARNING: these must exactly match the spellings as they appear in the Use Areas (POIs) DB table, as they are used for matching
//          if CMP changes the name of a reservation, they must update their Use Areas dataset as they expect, but also publish a new version of the mobile app!
//          tip: Why not have this automatically update when the app starts? Consumes data, not helpful offline, would 100% cripple the UI if it fails
// WARNING: these must exactly match the spellings of the JSON files under tile_cache_hints
//          a .json suffix will be added to the literal string to form the filename containing tile hints for that reservation
//          see also #page-seedreservation event handlers and beginSeedingCacheByReservation()
var LIST_RESERVATIONS = [
    "Acacia Reservation",
    "Bedford Reservation",
    "Big Creek Reservation",
    "Bradley Woods Reservation",
    "Brecksville Reservation",
    "Brookside Reservation",
    "Cleveland Metroparks Zoo",
    "Euclid Creek Reservation",
    "Garfield Park Reservation",
    "Hinckley Reservation",
    "Huntington Reservation",
    "Lakefront Reservation",
    "Mill Stream Run Reservation",
    "North Chagrin Reservation",
    "Ohio & Erie Canal Reservation",
    "Rocky River Reservation",
    "South Chagrin Reservation",
    "Washington Reservation (including Rivergate)",
    "West Creek Reservation"
];

// the set of Use Area categories, aka Activities
// used to build select elements and potentially listviews, e.g. find POIs which have *this* activity
// this has two parts: the sequential list so we can keep it sorted and efficient, and a mapping of Category->Icon PNG to provide an icon for one of the listviews
// WARNING: these must exactly match the spellings as they appear in the Use Areas (POIs) DB table, as they are used for matching
//          if CMP changes the name of a CATEGORY, ADDS/REMOVES A CATEGORY, they must publish a new version of the mobile app!
//          tip: Why not have this automatically update when the app starts? Consumes data, not helpful offline, would 100% cripple the UI if it fails
var ACTIVITY_ICONS = {
    'Archery' : 'archery.svg',
    'Beach' : 'beach.svg',
    'Boating' : 'boat.svg',
    'Drinking Fountain' : 'drinkingfountain.svg',
    'Exploring Culture & History' : 'history.svg',
    'Exploring Nature' : 'nature.svg',
    'Facilities' : 'reservable.svg',
    'Fishing & Ice Fishing' : 'fish.svg',
    'Food' : 'food.svg',
    'Geologic Feature' : 'geology.svg',
    'Golfing' : 'golf.svg',
    'Horseback Riding' : 'horse.svg',
    'Kayaking' : 'kayak.svg',
    'Picnicking' : 'picnic.svg',
    'Play Areas' : 'play.svg',
    'Restroom' : 'restroom.svg',
    'Sledding & Tobogganing' : 'sled.svg',
    'Swimming' : 'swim.svg',
    'Viewing Wildlife' : 'wildlife.svg'
};
var LIST_ACTIVITIES = [];
for (var i in ACTIVITY_ICONS) LIST_ACTIVITIES.push(i);
LIST_ACTIVITIES.sort();


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
    // part 1
    // resize the map to fit the screen, with no header, with the button bar across the bottom
    // then notify the map that its DIV has been resized
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

    // part 2
    // refresh any listviews on this pag
    // JQM is not reliable about refreshing their styling if they were not visible at the time they were refreshed,
    // and we need to do things like update search results, show/hide options in a anchor listview, ...
    page.find('ul[data-role="listview"]').listview('refresh');
});

$(document).ajaxStart(function() {
    $.mobile.showPageLoadingMsg("a", "Loading", false);
});
$(document).ajaxStop(function() {
    $.mobile.hidePageLoadingMsg();
});

function init() {
    // pre-render the pages so we don't have that damnable lazy rendering thing messing with it
    $('div[data-role="page"]').page();

    // now the rest of event handlers, map setup, etc. in stages
    initCacheThenMap();
    initWelcomePanel();
    initSettingsPanel();

    // the various Find subtypes, which have surprisingly little in common
    // except that the results all go to a common results panel
    initFindNearby();
    initFindPOIs();
    initFindTrails();
    initFindLoops();
    initFindKeyword();
    initResultsPanel();
    initDetailsAndDirectionsPanels();

    // start watching whether we have usable Internet; if it goes down, take action
    initTestConnectivity();

    // ready!
    // look at the Skip Welcome setting and see whether we should go there, or to the map
    var welcome = window.localStorage.getItem('skip_welcome');
    if (welcome == 'show') $.mobile.changePage('#page-welcome');
}

function initTestConnectivity() {
    // when we lose connection, having previously had it, make a popup and set the map to offline mode
    document.addEventListener("offline", function () {
        $('#basemap_offline_checkbox').prop('checked','checked').checkboxradio('refresh').trigger('change');
        navigator.notification.alert('Switching the map to offline mode.', null, 'Connection Lost');
    }, false);

    // when the connection comes back online
    // warning: known iOS quirk is that the device "comes online" about 1 second after startup, if it's going to
    // so it may not be wise to presume that the only reason we would be in offline mode is because we lost signal
    //document.addEventListener("online", function () {
    //}, false);
}

function initCacheThenMap() {
    // initialize the filesystem where we store cached tiles. when this is ready, proceed with the map
    // tip: we only cache the Terrain basemap; Satellite will not be cached, and extra UI work will blank out that option when offline is selected
    CACHE = new OfflineTileCacher(STORAGE_SUBDIR);
    CACHE.init(function () {
        CACHE.registerLayer( BASEMAPS['terrain'] );
        initMap();
        toggleGPSOn();
    }, function () {
        alert('Could not load the local filesystem. Exiting.');
        return;
    });
}

function initMap() {
    // start the map, only the basemap for starters
    MAP = new L.Map('map_canvas', {
        attributionControl:false, zoomControl:true,
        minZoom: MIN_ZOOM, maxZoom: MAX_ZOOM,
        layers : [ BASEMAPS['terrain'] ],
        dragging:true, scrollWheelZoom:false, tap:true, boxZoom:false, closePopupOnClick:false, keyboard:false
    }).fitBounds(MAX_BOUNDS);

    // our version of a WMS GetFeatureInfo control: a map click calls query.php to get JSON info, and we construct a bubble
    // BUT, we only call this if a popup is not open: if one is open, we instead close it
    // normally we would use MAP's own closePopupOnClick but that doesn't in fact CANCEL the click-and-query event
    MAP.on('click', function (event) {
        if ( $('.leaflet-popup').length ) return MAP.closePopup();
        wmsGetFeatureInfoByPoint(event.layerPoint);
    });

    // whenever we get a location event, we have a lot of work to do: GPS readout, Nearby upates, moving the marker on the map, ...
    // if we get a location error, it affirms that we do not have a location; we need to show certain "Uhm, FYI!" notes around the app, hide the marker-and-circle, ...
    // start by hiding the messages -- they will reappear as needed by the location found/error event handlers
    MAP.on('locationfound', function(event) {
        handleLocationFound(event);
    }).on('locationerror', function(event) {
        handleLocationError(event);
    });
    $('.location_fail').hide();
    $('.location_outside').hide();
    $('.location_poor').hide();

    // for the Terrain basemap only
    // every time we get a successful tile load, push this tile into the cache system
    // this is a specific hack for this client, but may prove an interesting development for cache.js generally if it proves flexible
    // most importantly, if this was already from the cache and not the network then don't event try (caching a tile from the selfsame cache, no)
    BASEMAPS['terrain'].on('tileload', function (event) {
        if (event.url.substr(0,4) != 'http') return;
        var xyz = event.url.match(/\/(\d+)\/(\d+)\/(\d+)\.(png|jpg)$/);
        CACHE.insertOrReplaceTileByUrl(event.url, 'terrain', xyz[2], xyz[3], xyz[1], false );
    });

    // when the user pans the map with their finger, turn off the auto-center GPS behavior
    MAP.on('dragstart', function (event) {
        toggleGPSOff();
    });

    // these buttons appear over the map, and are more complex than the simpler hyperlinks at the bottom of the map page
    //  $('#mapbutton_settings')
    $('#mapbutton_gps').click(function (event) {
        toggleGPS();
        event.stopPropagation();
    });
    $('#mapbutton_settings').click(function (event) {
        // no special action here; it is a hyperlink and will go to its indicated page
        event.stopPropagation();
    });

    // add the various markers for various purposes
    // being at 0,0 they aren't visible until something sets their LatLng
    MARKER_TARGET = L.marker(L.latLng(0,0), {
        clickable:false,
        icon:L.icon({ iconUrl:'images/marker-target.png', iconSize:[25,41], iconAnchor:[13,41] })
    }).addTo(MAP);
    MARKER_GPS = L.marker(L.latLng(0,0), {
        clickable:false,
        icon:L.icon({ iconUrl:'images/marker-gps.png', iconSize:[25,41], iconAnchor:[13,41] })
    }).addTo(MAP);
    MARKER_FROM = L.marker(L.latLng(0,0), {
        clickable:false,
        icon:L.icon({ iconUrl:'images/marker-start.png', iconSize:[20,34], iconAnchor:[10,34] })
    }).addTo(MAP);
    MARKER_TO = L.marker(L.latLng(0,0), {
        clickable:false,
        icon:L.icon({ iconUrl:'images/marker-end.png', iconSize:[20,34], iconAnchor:[10,34] })
    }).addTo(MAP);

    // ready! set! action!
    // start constant geolocation, which triggers the 'locationfound' event handlers defined above
    //      tip: getCurrentPosition() in a setInterval() gives us known-frequency response times,
    //      but also has a memory leak and consumes a few hundred MB in 15 minutes even if your location does not change
    //      So we don't use watchPosition() instead
    //      If you need instant responsiveness see getLocationRightNow()
    navigator.geolocation.watchPosition(function (position) {
        handleLocationFound({ accuracy:position.coords.accuracy, latlng:L.latLng(position.coords.latitude,position.coords.longitude) });
    }, null, { enableHighAccuracy:true });
    /*
    // tip: locate:watch doesn't give a promise as to how often it will update nor even ability to request a certain frequency
    //      if your location doesn't change dramatically you may just... never see it...
    //      this has implications for auto-centering and nearby, that you may turn on those features but since there's no location change
    //      that the phone feels worth communicating, ... nothing happens...
    // workaround: use an interval and ping our location every 3 seconds, period
    setInterval(function () {
        navigator.geolocation.getCurrentPosition(function (position) {
            handleLocationFound({ accuracy:position.coords.accuracy, latlng:L.latLng(position.coords.latitude,position.coords.longitude) });
        }, null, { enableHighAccuracy:true, maximumAge:3600 });
    }, 30 * 1000);
    */
}

function initWelcomePanel() {
    // the Welcome panel has a checkbox to skip the welcome panel when the app starts up
    // when the checkbox changes state, save that preference into LocalStorage
    // tip: don't try true and false, they get turned into strings and "false" ain't false!
    var checkbox = $('#page-welcome input[name="skip_welcome"]').change(function () {
        var skip_welcome = $(this).is(':checked') ? 'skip' : 'show';
        window.localStorage.setItem('skip_welcome', skip_welcome);
    });

    // load up the current checkbox setting, and express it visually
    var setting = window.localStorage.getItem('skip_welcome');
    switch (setting) {
        case 'skip':
            checkbox.prop('checked','checked').checkboxradio('refresh');
            break;
        default:
            checkbox.removeAttr('checked').checkboxradio('refresh');
            break;
    }
}

function initSettingsPanel() {
    // basemap picker
    $('input[type="radio"][name="basemap"]').change(function () {
        var which = $(this).val();
        selectBasemap(which);
    });

    // Prevent Phone From Sleeping button
    // simply toggles the Insomnia behavior that prevents the phone from sleeping
    // well, not simple at all -- save this setting to LocalStorage AND set the initial state of this checkbox from a previously-saved setting
    //                            so it "remembers" what your previous preference was
    $('#prevent_sleeping').change(function () {
        var prevent = $(this).is(':checked');
        if (prevent) {
            window.plugins.insomnia.keepAwake();
            window.localStorage.setItem('prevent_sleeping', 'prevent');
        } else {
            window.plugins.insomnia.allowSleepAgain();
            window.localStorage.setItem('prevent_sleeping', 'allow');
        }
    });

    // load their previous setting, if any
    var prevent = window.localStorage.getItem('prevent_sleeping');
    if (prevent == 'allow') {
        $('#prevent_sleeping').removeAttr('checked').trigger('change').checkboxradio('refresh');
    } else {
        $('#prevent_sleeping').prop('checked','checked').trigger('change').checkboxradio('refresh');
    }

    // enable the "Offline Mode" checkbox to toggle all registered layers between offline & online mode
    // for this specific client app, there's some UI work as well; see below
    // why do we switch over to the map? cuz we need to commit a zoom change as well (for switching to offline) and doing that
    //      when the map is not visible is a big no-no. This is not necessary when switching to online mode (we don't change zooms)
    //      but it's a more consistent experience if we do in both cases
    $('#basemap_offline_checkbox').change(function () {
        var offline = $(this).is(':checked');
        var layers  = CACHE.registeredLayers();
        if (offline) {
            switchToMap(function () {
                // zoom out to the max offline zoom level if we're zoomed in too far
                MAP.options.maxZoom = MAX_CACHING_ZOOMLEVEL;
                if (MAP.getZoom() > MAX_CACHING_ZOOMLEVEL) MAP.setZoom(MAX_CACHING_ZOOMLEVEL);

                // switch away from Sat basemap since we don't cache that for offline
                // then disable the non-Terrain options
                $('input[type="radio"][name="basemap"][value="terrain"]').prop('checked','checked').trigger('change');
                $('input[type="radio"][name="basemap"][value!="terrain"]').prop('disabled','disabled').checkboxradio('refresh');

                // now switch the map layers to offline mode
                for (var layername in layers) CACHE.useLayerOffline(layername);
            });
        } else {
            switchToMap(function () {
                // reinstate the max zoom of the map as being the MAX zoom
                MAP.options.maxZoom = MAX_ZOOM;

                // re-enable the Satellite basemap option (anything not Terrain)
                $('input[type="radio"][name="basemap"][value!="terrain"]').removeAttr('disabled').checkboxradio('refresh');

                // switch the map layers over to online mode
                for (var layername in layers) CACHE.useLayerOnline(layername);
            });
        }
    });

    // the seeding options to be shown when seeding is busy...
    // because right now it is not busy
    $('#page-settings div[data-seeding="busy"]').hide();

    // enable the Clear Cache and Seed Cache buttons in Settings, and set up the progress bar
    $('#page-cachestatus a[name="clearcache"]').click(function () {
        $.mobile.showPageLoadingMsg("a", "Clearing cache", true);
        CACHE.clearCache(function () {
            // on successful deletion, repopulate the disk usage boxes with what we know is 0
            $('#cachestatus_files').val('0 map tiles');
            $('#cachestatus_storage').val('0 MB');

            $.mobile.changePage("#page-cachestatus");
            $.mobile.hidePageLoadingMsg();
        });
        return false;
    });
    $('#page-settings a[href="#page-seedcache"]').click(function () {
        // do not allow them to seed nothing, e.g. by already being zoomed in beyond MAX_CACHING_ZOOMLEVEL
        // this duplicates a zoom-check on #page-seedcache a[name="seedcache"] so we can't get some goofy shenanigans
        // such as them switching to the seeding page, THEN altering the map too be too far in, and then trying
        if (MAP.getZoom() > MAX_CACHING_ZOOMLEVEL) {
            navigator.notification.alert("Offline tiles will not go down to this level of detail. Zoom the map out further.");
            return false;
        }
    });
    $('#page-seedcache a[name="seedcache"]').click(function () {
        // do not allow them to seed nothing, e.g. by already being zoomed in beyond MAX_CACHING_ZOOMLEVEL
        // this duplicates a zoom-check on #page-settings a[href="#page-seedcache"] so we can't get some goofy shenanigans
        // such as them switching to the seeding page, THEN altering the map too be too far in, and then trying
        if (MAP.getZoom() > MAX_CACHING_ZOOMLEVEL) {
            navigator.notification.alert("Offline tiles will not go down to this level of detail. Zoom the map out further.");
            return false;
        }

        // the download link-button has a HREF aiming at the download progress panel, so we'll be taken there automagically
        // if there's some error in getting started, e.g. out of range, that'll be handled by the seeding code
        beginSeedingCacheAtCurrentMapLocation();
    });

    // a page to cache a specific reservation, which is a XYZ position
    // start by populating that list, giving each button a click handler to look up the tile-hints file embedded into the app
    // NOTE: this is loading via AJAX, but is loading a local file form within the app and not a remote server
    // tip: use a settimeout so a failure of caching doesn't propagate back to become a failure in the AJAX fetch
    var target = $('#page-seedreservation ul[data-role="listview"]').empty();
    $.each(LIST_RESERVATIONS, function () {
        var link = $('<a></a>').text(this).prop('href','#page-seedcache-progress');
        var li   = $('<li></li>').append(link).appendTo(target);
        li.click(function () {
            var name = $(this).find('a').text().trim();
            var url  = './tile_cache_hints/' + name + '.json';
            $.getJSON(url, function(tilelist) {
                setTimeout(function () {
                    beginSeedingCacheByReservation(name,tilelist);
                }, 1);
            }).error(function (xhr) {
                navigator.notification.alert("Error: Missing or damaged reservation tile hint file: " + name + '.json' + "\n" + xhr.statusText);
            });
        });
    });
    target.listview('refresh');

    // offline tile download progress panel
    // a lot of moving parts:
    // - Cancel button, has a terminate_requested flag which is heeded by the beginSeeding functions
    // - progress text readout: "Done" or "Terrain 12 / 144 8%" or the like
    // - HTML5 progress element to visualize the percentage
    // the beginSeeding functions do some fussing with them, e.g. assigning a HREF to the cancel button,
    // resetting the progress bar and setting it on completion blocks, etc.
    $('#page-seedcache-progress a[data-role="button"]').click(function () {
        $(this).data('terminate_requested',true);
    });
    $('#page-seedcache-progress div[data-role="progress"] span').empty();
    $('#page-seedcache-progress div[data-role="progress"] progress').prop('value',0).prop('max',100);

    // enable the "Cache Status" checkbox to calculate the disk usage and write to to the dialog
    // allow the change to the dialog, and start the asynchronous disk usage calculation
    $('#page-settings a[href="#page-cachestatus"]').click(function () {
        $('#cachestatus_files').val('Calculating');
        $('#cachestatus_storage').val('Calculating');

        CACHE.getDiskUsage(function (filecount,totalbytes) {
            var megabytes = (totalbytes / 1048576).toFixed(1);
            $('#cachestatus_files').val(filecount + ' ' + 'map tiles');
            $('#cachestatus_storage').val(megabytes + ' ' + 'MB');
        });
    });
}

function initFindNearby() {
    // Nearby (formerly also called Radar) is a pretty odd critter
    //      the plain search has a caveat: there may be 0 results, which is unusual but which is handled by searchProcessResults()
    //      and there's an Alert capability: #nearby_enabled toggles checkboxes for alerts, and a clause in handleLocationFound() will examine these and make a beep if necessary
    // like most initFind functions this is setup for the UI, but see also handleLocationFound() and nearbyRefreshAndAlertIfAppropriate()
    //      for the alerting stuff

    // populate the Alert Activities listview, with a list of activities
    // but prepend to it, the Health Tips; they're not an activity but client wants them to show up anyway
    // why not hardcode it in HTML? cuz there're multiple places where The List Of Activities is used, so a global LIST_ACTIVITIES keeps it consistent
    var target = $('#page-find-nearby fieldset[data-role="controlgroup"][data-type="activities"]');
    for (var i=0, l=LIST_ACTIVITIES.length; i<l; i++) {
        var activity = LIST_ACTIVITIES[i];
        var icon     = 'images/pois/' + ACTIVITY_ICONS[activity];
        var image    = $('<img></img>').addClass('ui-li-icon').prop('src',icon);
        var wrap     = $('<label></label>');
        var checkbox = $('<input></input>').prop('type','checkbox').prop('name','activity').prop('value',activity).prop('checked',true);
        wrap.text(activity).prepend(image).prepend(checkbox).appendTo(target);
    }
    target.trigger('create');

    // the Enable Alerts button toggles the visibility of the checkboxes below
    // beyond that, its checked status is used as the go-to place to determine whether alerts are wanted at all, e.g. nearbyRefreshAndAlertIfAppropriate()
    $('#nearby_enabled').change(function () {
        var viz = $(this).is(':checked');
        if (viz) {
            $('#nearby_config').show();
            $('#nearby_config fieldset[data-type="activities"]').controlgroup('refresh');
        } else {
            $('#nearby_config').hide();
        }
    });

    // enable the Search Nearby button, which does what it sounds like it would do
    $('#page-find-nearby input[type="button"][data-icon="search"]').click(function () {
        searchNearby();
    });

    // when the alert-radius changes and/or the category checkboxes change, trigger a nearby pull immediately
    // we poll location every few seconds, but it's optimized to skip more-intensive steps unless location has changed significantly,
    // and this is one of those steps that is too expensive to run every time, but which we do want to run when filters have changed
    $('#nearby_enabled').change(function () {
        if (! $(this).is(':checked') ) return;
        setTimeout(nearbyRefreshAndAlertIfAppropriate,1);
    });
    $('#page-find-nearby fieldset[data-role="controlgroup"][data-type="activities"] input[type="checkbox"]').change(function () {
        setTimeout(nearbyRefreshAndAlertIfAppropriate,1);
    });
    $('#nearby_radius').change(function () {
        setTimeout(nearbyRefreshAndAlertIfAppropriate,1);
    });
}

function initFindPOIs() {
    // populate the Find POIs By Activity listview, with a list of activities
    var target = $('#page-find-pois ul[data-role="listview"]');
    for (var i=0, l=LIST_ACTIVITIES.length; i<l; i++) {
        var activity = LIST_ACTIVITIES[i];
        var icon     = 'images/pois/' + ACTIVITY_ICONS[activity];

        var link  = $('<a></a>').prop('href','javascript:void(0);').text(activity);
        var image = $('<img></img>').addClass('ui-li-icon').prop('src',icon).prependTo(link);
        var li    = $('<li></li>').append(link).attr('data-activity',activity).appendTo(target);
        li.click(function () {
            var activity = $(this).attr('data-activity');
            searchPOIs(activity);
        });
    }
    target.listview('refresh',true);
}

function initFindTrails() {
    // start by populating the selector for which Reservation they want (including a blank/ALL option)
    var target = $('#page-find-trails select[name="reservation"]').empty();
    $('<option></option>').text("(any reservation)").prop('value','').appendTo(target);
    for (var i=0, l=LIST_RESERVATIONS.length; i<l; i++) {
        $('<option></option>').text(LIST_RESERVATIONS[i]).prop('value',LIST_RESERVATIONS[i]).appendTo(target);
    }
    target.selectmenu('refresh',true);

    // the icons for selecting the trail use type; not as clean as using real stateful form elements, but it can work
    // especially not "clean" in that client wants to swap images, not a CSS highlight
    // then select the first one, so it's highlighted and a value exists
    // see also initFindLoops() for something quite similar (two of them!)
    $('#page-find-trails img[data-field="activity"]').click(function () {
        // tag this one AND ONLY THIS ONE as being the data-selected element
        //      this also means some URL swapping to switch out icons
        // data endpoint was specifically meant to accept multiple use types, but later they decided that they prefer to use only one
        var src = $(this).prop('src').replace('_off.svg', '_on.svg');
        $(this).attr('data-selected','true').prop('src', src);

        $(this).siblings('img[data-field="activity"]').each(function () {
            var src = $(this).prop('src').replace('_on.svg', '_off.svg');
            $(this).removeAttr('data-selected').prop('src',src);
        })
    }).first().click();

    // the Go button
    // collect the form elements and pass them to the searchificator-inator
    // but wait! there's not just form elements, but weirdness like icons with a data-selected= attribute
    $('#page-find-trails input[type="button"]').click(function () {
        var params = {};
        params.paved       = "";
        params.reservation = $('#page-find-trails select[name="reservation"]').val();
        params.uses        = $('#page-find-trails img[data-field="activity"][data-selected]').attr('data-value'); // should be commma-joined list, but only 1 option desired these days

        searchTrails(params);
    });
}

function initFindLoops() {
    // start by populating the selector for which Reservation they want (including a blank/ALL option)
    var target = $('#page-find-loops select[name="reservation"]').empty();
    $('<option></option>').text("(any reservation)").prop('value','').appendTo(target);
    for (var i=0, l=LIST_RESERVATIONS.length; i<l; i++) {
        $('<option></option>').text(LIST_RESERVATIONS[i]).prop('value',LIST_RESERVATIONS[i]).appendTo(target);
    }
    target.selectmenu('refresh',true);

    // the icons for selecting the loops' use type; not as clean as using real stateful form elements, but it can work
    // especially not "clean" in that client wants to swap images, not a CSS highlight
    // then select the first one, so it's highlighted and a value exists
    // see also initFindTrails() for something quite similar
    $('#page-find-loops img[data-field="activity"]').click(function () {
        // tag this one AND ONLY THIS ONE as being the data-selected element
        //      this also means some URL swapping to switch out icons
        // data endpoint was specifically meant to accept multiple use types, but later they decided that they prefer to use only one
        var src = $(this).prop('src').replace('_off.svg', '_on.svg');
        $(this).attr('data-selected','true').prop('src', src);

        $(this).siblings('img[data-field="activity"]').each(function () {
            var src = $(this).prop('src').replace('_on.svg', '_off.svg');
            $(this).removeAttr('data-selected').prop('src',src);
        })
    }).first().click();

    // distance filter: also tapping icons and also only one choice allowed, structurally identical to the use type filter above
    // again, select the first one, so it's highlighted and a value exists
    $('#page-find-loops img[data-field="length"]').click(function () {
        // tag this one AND ONLY THIS ONE as being the data-selected element
        //      this also means some URL swapping to switch out icons
        // data endpoint was specifically meant to accept multiple use types, but later they decided that they prefer to use only one
        var src = $(this).prop('src').replace('_off.svg', '_on.svg');
        $(this).attr('data-selected','true').prop('src', src);

       $(this).siblings('img[data-field="length"]').each(function () {
            var src = $(this).prop('src').replace('_on.svg', '_off.svg');
            $(this).removeAttr('data-selected').prop('src',src);
        })
    }).first().click();

    // the Go button
    // collect the form elements and pass them to the searchificator-inator
    // but wait! there's not just form elements, but weirdness like icons with a data-selected= attribute
    // and converting units: length & duration filters are in miles and minutes but endpoint wants feet and seconds
    // some of these are fields we no longer want to display to the user, but need them for the endpoint (duration filter) so hardcode some extreme numbers
    $('#page-find-loops input[type="button"]').click(function () {
        var params = {};
        params.paved       = "";
        params.reservation = $('#page-find-loops select[name="reservation"]').val();
        params.filter_type = $('#page-find-loops img[data-field="activity"][data-selected]').attr('data-value');
        params.minfeet     = 5280 * $('#page-find-loops img[data-field="length"][data-selected]').attr('data-min');
        params.maxfeet     = 5280 * $('#page-find-loops img[data-field="length"][data-selected]').attr('data-max');
        params.minseconds  = 0;
        params.maxseconds  = 3600 * 60 * 5;

        searchLoops(params);
    });
}

function initFindKeyword() {
    // not really related to the Keyword Search per se, but on the Find panel same as the keyword search
    var listview = $('#page-find ul[data-role="listview"]').eq(1);
    listview.find('li').first().hide();
    listview.listview('refresh');

    // set up the form: on submit, Enter, button, etc. submit a keyword search to the server
    // also some hacks to interact with the autocomplete listview defined next: we want the autocomplete listviw to be visible only when it's being used
    var form     = $('#page-find fieldset[data-type="keyword"]');
    var field    = form.find('input[type="text"]');
    var button   = form.find('input[type="button"]');
    var listview = form.find('ul[data-role="listview"][data-type="autocomplete"]');
    field.keydown(function (key) {
        if(key.keyCode == 13) {
            $(this).closest('fieldset').find('input[type="button"]').click();
        } else {
            if ( $(this).val() ) {
                listview.show();
            } else {
                listview.hide();
            }
        }
    });
    button.click(function () {
        listview.hide();
        var keyword = $(this).closest('fieldset').find('input[type="text"]').val().trim();
        searchKeyword(keyword);
    });

    // set up an autocomplete on the keyword search text field
    // getting back results, populates a listview
    listview.hide();
    $.get( BASE_URL + '/ajax/autocomplete_keywords', {}, function (words) {
        field.autocomplete({
            target: listview,
            source: words,
            callback: function(e) {
                // click handler on an autocomplete item
                // find the value of the selected item, stick it into the text box, hide the autocomplete
                // and click the button to perform the search, using the text that is now filled in
                var $a = $(e.currentTarget);
                field.val( $a.text() ).autocomplete('clear');
                button.click();
            },
            minLength: 3,
            matchFromStart: false
        });
    },'json');
}

function initResultsPanel() {
    // the Results can be sorted alphabetically, or by their distance from you
    // enable the buttons which switch this: they toggle which one is "active" and then do a sort immediately
    // see also the calculateDistancesAndSortSearchResultsList() function; it examines these sortpicker buttons to determine which one is active
    $('#page-find-results div.sortpicker a').click(function () {
        $(this).addClass('active').siblings().removeClass('active');
        calculateDistancesAndSortSearchResultsList();
    });

    // on the results listing, the individual LI items can be clicked to switch over to the details panel
    $('#page-find-results').on('click', 'li', function () {
        var info = $(this).data('raw');
        loadAndShowDetailsPanel(info);
    });
}

function initDetailsAndDirectionsPanels() {
    // related to Directions... the Directions button on the map should only show if we in fact have directions
    // and we do not at this time
    $('#page-map div.map_toolbar a[href="#page-directions"]').closest('td').hide();

    // likewise, the autocomplete for findig a Feature for your routing, should only show when needed
    // and it is not needed yet   see directionsParseAddressAndValidate()
    $('#directions_autocomplete').hide();

    // intercept a click on the Map button on the results panel
    // it should call switchToMap() to do the map changeover, since that introduces a delay to work around animation issues
    // what should it zoom to? whatever feature was assigned to its data('raw') which itself is populated by showDetailsPanel() when a feature is selected
    $('#page-details div[data-role="header"] a[href="#page-map"]').click(function () {
        var info = $('#page-details').data('raw');
        if (! info) { alert("No result loaded into the Map button. That should be impossible."); return false; }

        // turn off GPS auto-center if it's on, so we don't zoom to the specified area... then to our GPS a second later
        toggleGPSOff();

        switchToMap(function () {
            // zoom the the feature's bounding box
            var bbox = L.latLngBounds([[info.s,info.w],[info.n,info.e]]).pad(0.15);
            MAP.fitBounds(bbox);

            // clear any previous highlights
            highlightsClear();

            // lay down a marker and/or the trail's WKT-encoded geometry
            switch (info.type) {
                case 'poi':
                    // POIs have a simple latlng point location and no line
                    MARKER_TARGET.setLatLng([info.lat,info.lng]);
                    break;
                case 'trail':
                    // Trails have no point, but do have a linestring geometry
                    var parser = new Wkt.Wkt();
                    parser.read(info.wkt);
                    if (HIGHLIGHT_LINE) MAP.removeLayer(HIGHLIGHT_LINE);
                    HIGHLIGHT_LINE = parser.toObject(HIGHLIGHT_LINE_STYLE);
                    MAP.addLayer(HIGHLIGHT_LINE);
                    break;
                case 'loop':
                    // Loops have both a latlng starting point, and a linestring geometry
                    MARKER_TARGET.setLatLng([info.lat,info.lng]);

                    var parser = new Wkt.Wkt();
                    parser.read(info.wkt);
                    if (HIGHLIGHT_LINE) MAP.removeLayer(HIGHLIGHT_LINE);
                    HIGHLIGHT_LINE = parser.toObject(HIGHLIGHT_LINE_STYLE);
                    MAP.addLayer(HIGHLIGHT_LINE);
            }
        });
        return false;
    });

    // intercept clicks on the Directions buttons on the Details panel
    // to load the place name into that target page
    // again #page-details.data('raw') is THE go-to place to find out what we're focusing
    $('#page-details div.directions_floater').click(function () {
        // clear the existing directions
        directionsClear();

        // assign these details, then let it continue to take them to the panel
        var info = $('#page-details').data('raw');
        $('#page-directions h2.name').text(info.name);
    });

    // Directions panel
    // some changes cause elements to show and hide: address is only if navigating to/from an address or location name, for example
    $('#page-directions select[name="origin"]').change(function () {
        var show     = $(this).val() != 'gps';
        var fieldset = $(this).closest('fieldset');
        var target   = fieldset.find('input[name="address"]').closest('span.togglewrapper');
        show ? target.show() : target.hide();
        fieldset.trigger('create');
    }).trigger('change');

    // Directions panel
    // similarly to the Trail Finder and Features Loops finder, we do not use a SELECT element but rather
    // a set of images and one of them has a data-selected tag; this is examined by directionsParseAddressAndValidate() and directionsFetch()
    // to compose the AJAX request for directions
    $('#page-directions div.directions_buttons img').click(function () {
        // highlight this icon and only this icon
        var src = $(this).prop('src').replace('_off.svg', '_on.svg');
        $(this).attr('data-selected','true').prop('src', src);

        $(this).siblings('img').each(function () {
            var src = $(this).prop('src').replace('_on.svg', '_off.svg');
            $(this).removeAttr('data-selected').prop('src',src);
        })
    }).filter('[data-mode="car"]').click();

    // Directions panel
    // submit handler (sorta) to compile params and fetch directions
    $('#page-directions input[name="address"]').keydown(function (event) {
        if (event.keyCode != 13) return;
        $(this).blur();
        $('#page-directions input[type="button"]').trigger('click');
    });
    $('#page-directions input[type="button"]').click(function () {
        // clear current directions
        // parse the form to validate everything AND to populate the lat/lng coordinates of the endpoints as required
        directionsClear();
        directionsParseAddressAndValidate();
    });

    // Directions panel
    // the Map button will switch to the Map, then zoom to the extent of the directions
    $('#page-directions div[data-role="header"] a[href="#page-map"]').click(function () {
        switchToMap(function () {
            var directions = $('#page-directions').data('directions');
            var parser     = new Wkt.Wkt();
            parser.read(directions.wkt);
            if (DIRECTIONS_LINE) MAP.removeLayer(DIRECTIONS_LINE);
            DIRECTIONS_LINE = parser.toObject(DIRECTIONS_LINE_STYLE);
            MAP.addLayer(DIRECTIONS_LINE);

            MARKER_FROM.setLatLng([directions.start.lat,directions.start.lng]);
            MARKER_TO.setLatLng([directions.end.lat,directions.end.lng]);

            var bbox = DIRECTIONS_LINE.getBounds().pad(0.25);
            MAP.fitBounds(bbox);
        });
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
 * Turn auto-recentering off and on
 * Do not simply set the variable; this updates various states such as the location icon
 */

function toggleGPS() {
    AUTO_CENTER_ON_LOCATION ? toggleGPSOff() : toggleGPSOn();
}
function toggleGPSOn() {
    AUTO_CENTER_ON_LOCATION = true;
    var src = $('#mapbutton_gps img').prop('src').replace('_off.svg','_on.svg');
    $('#mapbutton_gps img').prop('src',src);

    // note: if you are using watchPosition() then turning on auto-centering isn't quite enough since your loation hasn't changed
    // some day this may become obsolete as they fix the memory leak in geolocation.getCurrentPosition()
    getLocationRightNow();
}
function toggleGPSOff() {
    AUTO_CENTER_ON_LOCATION = false;
    var src = $('#mapbutton_gps img').prop('src').replace('_on.svg','_off.svg');
    $('#mapbutton_gps img').prop('src',src);
}



// a wrapper to specifically query location right now and trigger "the usual" event handler for location updates
// this is appropriate when watchPosition() isn't responding quickly enough, e.g. when you turn on auto-center and the map won't
// re-center until your location changes enough to trigger a location-update event
// some day this may become obsolete as they fix the memory leak in geolocation.getCurrentPosition()
// see also initMap() where we use watchPositon() instead of getCurrentPosition()
// https://issues.apache.org/jira/browse/CB-8631
function getLocationRightNow() {
    navigator.geolocation.getCurrentPosition(function (position) {
        handleLocationFound({ accuracy:position.coords.accuracy, latlng:L.latLng(position.coords.latitude,position.coords.longitude) });
    }, null, { enableHighAccuracy:true });
}


/*
 * Given a L.Latlng object, return a string of the coordinates in standard GPS or geocaching.com format
 * That is:  N DD MM.MMM W DDD MM.MMM
 * This is useful if you're printing the coordinates to the screen for the end user, as it's the expected format for GPS enthusiasts.
 * The inverse operation is provided by gpsToLatLng()   Given a GPS string, return a L.LatLng object or else a null indicating falure
 */
function latLngToGPS(latlng) {
    var lat = latlng.lat;
    var lng = latlng.lng;
    var ns = lat < 0 ? 'S' : 'N';
    var ew = lng < 0 ? 'W' : 'E';
    var latdeg = Math.abs(parseInt(lat));
    var lngdeg = Math.abs(parseInt(lng));
    var latmin = ( 60 * (Math.abs(lat) - Math.abs(parseInt(lat))) ).toFixed(3);
    var lngmin = ( 60 * (Math.abs(lng) - Math.abs(parseInt(lng))) ).toFixed(3);
    var text = ns + ' ' + latdeg + ' ' + latmin + ' ' + ew + ' ' + lngdeg + ' ' + lngmin;
    return text;
}



// given a string, try to parse it as coordinates and return a L.LatLng instance
// currently supports these formats:
//      N 44 35.342 W 123 15.669
//      44.589033 -123.26115
function gpsToLatLng(text) {
    var text = text.replace(/\s+$/,'').replace(/^\s+/,'');

    // simplest format is decimal numbers and minus signs and that's about it
    // one of them must be negative, which means it's the longitude here in North America
    if (text.match(/^[\d\.\-\,\s]+$/)) {
        var dd = text.split(/[\s\,]+/);
        if (dd.length == 2) {
            dd[0] = parseFloat(dd[0]);
            dd[1] = parseFloat(dd[1]);
            if (dd[0] && dd[1]) {
                var lat,lng;
                if (dd[0] < 0) {
                    lat = dd[1];
                    lng = dd[0];
                } else {
                    lat = dd[0];
                    lng = dd[1];
                }
                return L.latLng([lat,lng]);
            }
        }
    }

    // okay, how about GPS/geocaching format:   N xx xx.xxx W xxx xx.xxx
    var gps = text.match(/^N\s*(\d\d)\s+(\d\d\.\d\d\d)\s+W\s*(\d\d\d)\s+(\d\d\.\d\d\d)$/i);
    if (gps) {
        var latd = parseInt(gps[1]);
        var latm = parseInt(gps[2]);
        var lond = parseInt(gps[3]);
        var lonm = parseInt(gps[4]);

        var lat = latd + (latm/60);
        var lng = -lond - (lonm/60);

        return L.latLng([lat,lng]);
    }

    //if we got here then nothing matched, so bail
    return null;
}


/*
 * The functions triggered when we get location events, both good and bad.
 * On error, we show various "Hey, bad location!" warnings around the app
 * On success, we update the GPS readout, maybe recenter the map, position the 
 */
function handleLocationFound(event) {
    // detect whether we're within the expected area and/or have poor accuracy
    // showing/hiding messages indicating that they may not like what they see
    var within = MAX_BOUNDS.contains(event.latlng);
    var poor   = event.accuracy > 100;
    $('.location_fail').hide();
    within ? $('.location_outside').hide() : $('.location_outside').show();
    poor   ? $('.location_poor').show()    : $('.location_poor').hide();

    // how far have we in fact moved since our last update?
    // we use this later, so we can skip on some of the more-intensive calculations if our loation has only changed by a few feet
    var moved_meters = MARKER_GPS.getLatLng().distanceTo(event.latlng);

    // update the GPS marker, the user's current location
    // if we're wanting to auto-center, do so
    MARKER_GPS.setLatLng(event.latlng).addTo(MAP);
    if (AUTO_CENTER_ON_LOCATION && within) {
        MAP.panTo(event.latlng);
        if (MAP.getZoom() < AUTO_CENTER_ZOOMLEVEL) MAP.setZoom(AUTO_CENTER_ZOOMLEVEL);
    }

    // update the GPS readout
    var gps = latLngToGPS(event.latlng);
    $('#gps_location').text(gps);

    // now that we're pinging location every 3 seconds whether we need it or not, we have better repsonse times
    // but the rest of the items below are somewhat CPU-intensive and maybe hitting them every 3 seconds can be skipped,
    // if our location hasn't changed. Particularly annoying is Nearby which will do an AJAX hit (show the spinner, eat your data plan)
    // so should really only happen if things have changed
    if (moved_meters < 50) return;

    // sort any visible distance-sorted lists on the Results page
    calculateDistancesAndSortSearchResultsList();

    // adjust the Nearby listing by performing a new search
    // this actually does more than the name implies: fetches results, sees if you have alerting enabled, sounds an alarm, ...
    if ( nearbyStatus() ) {
        nearbyRefreshAndAlertIfAppropriate();
    }
}

function handleLocationError(event) {
    // show the various "Location failed!" messages
    $('.location_fail').show();
    $('.location_outside').hide();
    $('.location_poor').hide();
}



/*
 * Play an MP3 file bundled into this app, using Cordova Media Plugin
 * Filenames are relative to the bundle's "www" folder, e.g. sounds/beep.mp3
 * This wrapper handles both iOS and Android, figuring out the platform and thus the pathnames to use.
 * Too bad Android desn't support HTML5 <AUDIO> tags reliably.
 */
function playSound(filename) {
    if (is_android()) {
        var media = new Media('file:///android_asset/www/' + filename, function () { true; });
        media.play();
    } else if (is_ios()) {
        var media = new Media(filename, function () { true; });
        media.play();
    } else {
        false;
    }
}



/*
 * Switch over to the given basemap
 * refactored from the original CMP website code, to use a proper structure
 */
function selectBasemap(which) {
    for (var i in BASEMAPS) {
        if (which != i) MAP.removeLayer(BASEMAPS[i]);
        else MAP.addLayer(BASEMAPS[i]);
    }
}


/*
 * Some wrapper functions regarding the nearby alerts
 * the "alerts enabled" checkbox is THE way to know whether alerting is enabled or disabled,
 * but let's make some wrappers to abstract that out a bit, in case we make changes
 */
function nearbyOn() {
    $('#nearby_enabled').prop('checked',true).checkboxradio('refresh').trigger('change');
}
function nearbyOff() {
    $('#nearby_enabled').removeAttr('checked').checkboxradio('refresh').trigger('change');
}
function nearbyStatus() {
    return $('#nearby_enabled').is(':checked');
}


/*
 * The tile-seeding family of functions: start caching at a given XYZ, start at current location, use a provided list of specific tile JPEG URIs, ...
 */

function beginSeedingCacheByReservation(name,xyzlist) {
    // a specific button provides a "terminate requested" flag when it is clicked,
    // indicating that the progress callback should return false, requesting that CACHE.seedCache should just stop
    // back when there was only 1 user interface for fetching all tiles, the button was unequivocal
    var cancelbutton = $('#page-seedcache-progress a[data-role="button"]');
    var progressbar  = $('#page-seedcache-progress div[data-role="progress"]');
    var titlebar     = $('#page-seedcache-progress h1');
    var title        = "Loading " + name;
    var backbutton   = $('#page-seedcache-progress div[data-role="header"] a');
    var donepage     = '#page-seedreservation';

    // startup
    // - figure out the list of layers we will be seeding
    // - and thus compose the list of all tile URLs to be downloaded
    // - reset the Cancel Requested flag since we've not even started yet
    // - fill in the Title
    // - fill in the Done button's target to be the Settings panel, until the completion handler sets it to "donepage"
    // - create references to the progress readout, both text and bar, and initialize them
    // - show/hide the Settings buttons allowing them to start a new seeding and/or to view progress
    var layers_to_seed   = CACHE.registeredLayers();
    var layernames = [];
    for (var l in layers_to_seed) layernames[layernames.length] = layers_to_seed[l].options.name;

    cancelbutton.data('terminate_requested',false);
    titlebar.text(title);
    backbutton.prop('href','#page-settings');
    var readout = progressbar.find('span').empty();
    var bar     = progressbar.find('progress').prop('value',0).prop('max',100);
    $('#page-settings div[data-seeding="allowed"]').hide();
    $('#page-settings div[data-seeding="busy"]').show();

    function seedLayerByIndex(index) {
        if (index >= layernames.length) {
            // past the end, we're done
            // it may be because we finished, or because we were asked to abort
            if ( cancelbutton.data('terminate_requested') ) {
                readout.text('Cancelled');

                // on the chance that they watched the download, make the Back button go where they anted t be: the place that started the download
                backbutton.prop('href',donepage);

                // head Back to whatever page they were on BUT ONLY IF THEY CANCELLED
                // doing this on a success condition, would pull them away from whatever they were doing and that's annoying
                backbutton.click();
            } else {
                // on the chance that they watched the download, make the Back button go where they wanted to be: the place that started the download
                backbutton.prop('href',donepage);

                // update the readout and show the popup
                readout.text('Downloads complete');
                navigator.notification.alert('Offline tiles are now available for use.', null, 'Downloads Complete');
            }

            // at any rate, show/hide the seeding buttons on the Settings page so they can start a new one
            $('#page-settings div[data-seeding="allowed"]').show();
            $('#page-settings div[data-seeding="busy"]').hide();

            return;
        }
        var layername = layernames[index];

        var layer_complete = function(done,total) {
            // done here, next!
            readout.text('Done');
            seedLayerByIndex(index+1);
        }
        var progress = function(done,total) {
            // show or update the spinner
            var percent = Math.round( 100 * parseFloat(done) / parseFloat(total) );
            var text    = layername + ': ' + done + '/' + total + ' ' + percent + '%';
            readout.text(text);
            bar.prop('max',total).prop('value',done);

            // if someone pressed the big Stop! button then just terminate as if we had finished
            if ( cancelbutton.data('terminate_requested') ) {
                layer_complete();
                return false;
            }

            // if we're now done, call the completion function to close the spinner
            if (done >= total) {
                layer_complete();
                return false;
            }

            // great, we had no cause to bail so return true so the looper in seedCache() knows it's clear to proceed
        };
        var error = function() {
            navigator.notification.alert('Could not download map tiles. Please try again.', null, 'Error');
        };

        CACHE.seedCacheByXYZListing(layername,xyzlist,progress,error);
    }

    // start it off!
    seedLayerByIndex(0);
}

function beginSeedingCacheAtXYZ(name,lon,lat,zoom) {
    if (zoom > MAX_CACHING_ZOOMLEVEL) {
        navigator.notification.alert("Offline tiles will not go down to this level of detail. Zoom the map out further.");
        return;
    }

    // a specific button provides a "terminate requested" flag when it is clicked,
    // indicating that the progress callback should return false, requesting that CACHE.seedCache should just stop
    // back when there was only 1 user interface for fetching all tiles, the button was unequivocal
    var cancelbutton = $('#page-seedcache-progress a[data-role="button"]');
    var progressbar  = $('#page-seedcache-progress div[data-role="progress"]');
    var titlebar     = $('#page-seedcache-progress h1');
    var title        = "Loading " + name;
    var backbutton   = $('#page-seedcache-progress div[data-role="header"] a');
    var donepage     = '#page-seedreservation';
    beginSeedingCache(lon,lat,zoom,MAX_CACHING_ZOOMLEVEL,title,donepage,titlebar,backbutton,cancelbutton,progressbar);
}

function beginSeedingCacheAtCurrentMapLocation() {
    // the lon, lat, and zooms for seeding
    var lon   = MAP.getCenter().lng;
    var lat   = MAP.getCenter().lat;
    var zmin  = MAP.getZoom();
    var zmax  = MAX_CACHING_ZOOMLEVEL;

    // a specific button provides a "terminate requested" flag when it is clicked,
    // indicating that the progress callback should return false, requesting that CACHE.seedCache should just stop
    // back when there was only 1 user interface for fetching all tiles, the button was unequivocal
    var cancelbutton = $('#page-seedcache-progress a[data-role="button"]');
    var progressbar  = $('#page-seedcache-progress div[data-role="progress"]');
    var titlebar     = $('#page-seedcache-progress h1');
    var title        = "Loading Your Location";
    var backbutton   = $('#page-seedcache-progress div[data-role="header"] a');
    var donepage     = '#page-seedcache';
    beginSeedingCache(lon,lat,zmin,zmax,title,donepage,titlebar,backbutton,cancelbutton,progressbar);
}

function beginSeedingCache(lon,lat,zmin,zmax,title,donepage,titlebar,backbutton,cancelbutton,progressbar) {
    // fetch the assocarray of layername->layerobj from the Cache provider,
    // then figure out a list of the layernames too so we can seed them sequentially
    var layers_to_seed = CACHE.registeredLayers();
    var layernames = [];
    for (var l in layers_to_seed) layernames[layernames.length] = layers_to_seed[l].options.name;

    // startup
    // - reset the Cancel Requested flag since we've not even started yet
    // - fill in the Title
    // - fill in the Done button's target to be the Settings panel, until the completion handler sets it to "donepage"
    // - create references to the progress readout, both text and bar, and initialize them
    // - show/hide the Settings buttons allowing them to start a new seeding and/or to view progress
    cancelbutton.data('terminate_requested',false);
    titlebar.text(title);
    backbutton.prop('href','#page-settings');
    var readout = progressbar.find('span').empty();
    var bar     = progressbar.find('progress').prop('value',0).prop('max',100);
    $('#page-settings div[data-seeding="allowed"]').hide();
    $('#page-settings div[data-seeding="busy"]').show();

    function seedLayerByIndex(index) {
        if (index >= layernames.length) {
            // past the end, we're done
            // it may be because we finished, or because we were asked to abort
            if ( cancelbutton.data('terminate_requested') ) {
                readout.text('Cancelled');

                // on the chance that they watched the download, make the Back button go where they anted t be: the place that started the download
                backbutton.prop('href',donepage);

                // head Back to whatever page they were on BUT ONLY IF THEY CANCELLED
                // doing this on a success condition, would pull them away from whatever they were doing and that's annoying
                backbutton.click();
            } else {
                // on the chance that they watched the download, make the Back button go where they wanted to be: the place that started the download
                backbutton.prop('href',donepage);

                // update the readout and show the popup
                readout.text('Downloads complete');
                navigator.notification.alert('Offline tiles are now available for use.', null, 'Downloads Complete');
            }

            // at any rate, show/hide the seeding buttons on the Settings page so they can start a new one
            $('#page-settings div[data-seeding="allowed"]').show();
            $('#page-settings div[data-seeding="busy"]').hide();

            return;
        }
        var layername = layernames[index];

        var layer_complete = function(done,total) {
            // done here, next!
            readout.text('Done');
            seedLayerByIndex(index+1);
        }
        var progress = function(done,total) {
            // show or update the spinner
            var percent = Math.round( 100 * parseFloat(done) / parseFloat(total) );
            var text    = layername + ': ' + done + '/' + total + ' ' + percent + '%';
            readout.text(text);
            bar.prop('max',total).prop('value',done);

            // if someone pressed the big Stop! button then just terminate as if we had finished
            if ( cancelbutton.data('terminate_requested') ) {
                layer_complete();
                return false;
            }

            // if we're now done, call the completion function to close the spinner
            if (done >= total) {
                layer_complete();
                return false;
            }

            // great, we had no cause to bail so return true so the looper in seedCache() knows it's clear to proceed
        };
        var error = function() {
            navigator.notification.alert('Could not download map tiles. Please try again.', null, 'Error');
        };

        CACHE.seedCache(layername,lat,lon,zmin,zmax,progress,error);
    }

    // start it off!
    seedLayerByIndex(0);
}


/*
 * The wmsGetFeatureInfoByLatLngBBOX() family of functions
 * wmsGetFeatureInfoByLatLngBBOX() is the actual target function, and performs the server-side query for a given bounding box
 * The other wrappers do things like take a latlng point and add a little padding to it, since a lot of the target content is points
 */
function wmsGetFeatureInfoByPoint(pixel) {
    var pixelbuffer = 20;
    var sw = MAP.layerPointToLatLng(new L.Point(pixel.x - pixelbuffer , pixel.y + pixelbuffer));
    var ne = MAP.layerPointToLatLng(new L.Point(pixel.x + pixelbuffer , pixel.y - pixelbuffer));
    var bbox   = { w:sw.lng, s: sw.lat, e:ne.lng , n:ne.lat };
    var anchor = MAP.layerPointToLatLng(new L.Point(pixel.x,pixel.y));
    wmsGetFeatureInfoByLatLngBBOX(bbox,anchor);
}
function wmsGetFeatureInfoByLatLng(latlng) {
    var bbox   = { w:latlng.lng, s: latlng.lat, e:latlng.lng , n:latlng.lat };
    var anchor = latlng;
    wmsGetFeatureInfoByLatLngBBOX(bbox,anchor);
}
function wmsGetFeatureInfoByLatLngBBOX(bbox,anchor) {
    // start with the bounding box as the params, then add the current zoom level
    // atypical, but means that the query endpoint can have knowledge of the map's zoom level and configure its behavior accordingly
    // makes for spiffy behaviors such as not being able to click buildings at the full zoom level, but preferring to click buildings over parks when close in
    var params = bbox;
    params.zoom = MAP.getZoom();

    $.get( BASE_URL + '/ajax/query', params, function (html) {
        if (!html) return;

        // set up the Popup and load its content
        // beware of very-lengthy content and force a max height on the bubble
        var options = {};
        options.maxHeight = parseInt( $('#map_canvas').height() - $('#page-map div.map_toolbar').height() - 20 );
        options.maxWidth  = parseInt( $('#map_canvas').width() - 40 );

        var popup = new L.Popup(options).setLatLng(anchor).setContent(html);
        MAP.openPopup(popup);

        // a hack to get around other hacks, themselves hacked in to handle contradictions in prior specs, ...
        // the Directions and More Info links need to be rewritten, not to have the onClick content,
        //     and to effectively fabricate a "feature" compatible with loadAndShowDetailsPanel()
        // the special Directions links are a real set of hacks, in that they bypass the Details panel and go straight to Directions
        // and for trailpiece objects there was never a feature to begin with, just arbitrary latlng
        setTimeout(function () {
            $('.leaflet-popup .fakelink').each(function () {
                // swap out this link with a shiny new one, containing a virtual Feature compatible with loadAndShowDetailsPanel()
                // add the link into the DOM and add an appropriate click handler to it, to show Details and/or to head over to Directions

                var oldlink = $(this);

                var text = oldlink.text();
                if (text == 'Details') text = 'More Info'; // standardize this deviant text

                var feature = {};
                feature.type = oldlink.attr('type');
                feature.gid  = oldlink.attr('gid');
                feature.name = oldlink.attr('title');
                feature.lat  = oldlink.attr('lat');
                feature.lng  = oldlink.attr('lng');
                feature.w    = oldlink.attr('w');
                feature.s    = oldlink.attr('s');
                feature.e    = oldlink.attr('e');
                feature.n    = oldlink.attr('n');
                feature.wkt  = "";

                var newlink = $('<span></span>').addClass('fakelink').text(text);
                newlink.data('feature',feature);

                if (feature.type == 'poi' && text == 'More Info') {
                    oldlink.replaceWith(newlink);

                    newlink.click(function () {
                        loadAndShowDetailsPanel( $(this).data('feature') );
                    });
                }
                if (feature.type == 'trail' && text == 'More Info') {
                    oldlink.replaceWith(newlink);

                    newlink.click(function () {
                        loadAndShowDetailsPanel( $(this).data('feature') );
                    });
                }
                if (feature.type == 'poi' && text == 'Directions') {
                    oldlink.replaceWith(newlink);

                    newlink.click(function () {
                        loadAndShowDetailsPanel( $(this).data('feature') , function () {
                            $('#page-details div.directions_floater a').click();
                        });
                    });
                }
                if (feature.type == 'trailpiece' && text == 'Directions here') {
                    oldlink.replaceWith(newlink);

                    newlink.click(function () {
                        loadAndShowDetailsPanel( $(this).data('feature') , function () {
                            $('#page-details div.directions_floater a').click();
                        });
                    });
                }
            });
        }, 150);

    }, 'html').error(function (error) {
        // no error handling
        // if they tapped on the map and lost signal or something, don't pester them with messages, just be quiet
    });
}


/*
 * The searchXXX() family of functions
 * have a surprising amount in common and different
 * they (mostly) have the same AJAX data endpoint, passing different params to hint the endpoint as to what we're looking for
 * and they all hand off to searchProcessResults() for rendering on the Results panel
 */
function searchPOIs(category) {
    var params = {};
    params.category = 'pois_usetype_' + category;

    $.get( BASE_URL + '/ajax/browse_items', params, function (reply) {
          searchProcessResults(reply.results, reply.title, '#page-find-pois');
    },'json').error(function (error) {
        searchProcessError(error);
    });
}

function searchKeyword(keyword) {
    // if there's no keyword given, bail loudly
    keyword = keyword.trim();
    if (! keyword) return navigator.notification.alert('Enter some search terms for the keyword search, e.g. picnic, hike, fishing. If you\'re not sure what to type, start typing anything and see what suggestions come up.', null, 'Search Terms');

    var params = { keyword:keyword, limit:25 };

    $.get( BASE_URL + '/ajax/keyword', params, function (results) {
        searchProcessResults(results, "Keyword: " + keyword , '#page-find');
    },'json').error(function (error) {
        searchProcessError(error);
    });
}

function searchTrails(options) {
    var params = options;

    $.get( BASE_URL + '/ajax/search_trails', params, function (results) {
        searchProcessResults(results, 'Trail Finder', '#page-find-trails');
    }, 'json').error(function (error) {
        searchProcessError(error);
    });
}

function searchLoops(options) {
    var params = options;

    $.get( BASE_URL + '/ajax/search_loops', params, function (results) {
          // this endpoint is a little unusual
          // we compose the note attribute from the duration and distance fields
          // and the 'name' field is misnamed 'title'
          var cookedresults = [];
          for (var q=0, p=results.length; q<p; q++) {
                  results[q].note = results[q].distance + ', ' + results[q].duration;
                  results[q].name = results[q].title;
                  cookedresults.push(results[q]);
          }
          searchProcessResults(cookedresults, 'Featured Trails', '#page-find-loops');
    }, 'json').error(function (error) {
        searchProcessError(error);
    });
}

function searchNearby() {
    // see also nearbyRefreshAndAlertIfAppropriate() for the non-interactive alert-beeping version of this
    // also note that nearbyRefreshAndAlertIfAppropriate() filters by categories, and only ALERTS on matching items
    // this interactive search is a more-thorough search and does not filter, and uses a fixed radius
    var latlng = MARKER_GPS.getLatLng();
    var meters = 1609 * 5;
    var categories = [];
    $('#page-find-nearby fieldset[data-type="activities"] input[type="checkbox"]').each(function () {
        categories.push( $(this).prop('value') );
    });
    categories = categories.join(';');
    var params = { lat: latlng.lat, lng: latlng.lng, meters: meters, categories: categories };

    // tip: use POST since 20+ checkboxes can get lengthy and potentially overflow GET limitations
    $.post( BASE_URL + '/ajax/search_nearby', params, function (results) {
        searchProcessResults(results,"Near You",'#page-find-nearby', { showerror:true, nearby:true });
    },'json').error(function (error) {
        searchProcessError(error);
    });
}

function searchProcessError(error) {
    // hide any loading spinner, set the results title to clearly indicate a problem
    navigator.notification.alert('Check that you have data service, then try again.', null, 'No connection?');
}

function searchProcessResults(resultlist,title,from,options) {
    // set up the default set of options, if none were given
    if (typeof options == 'undefined') options = {};
    if (typeof options.showerror   == 'undefined') options.showerror   = true;
    if (typeof options.showresults == 'undefined') options.showresults = true;
    if (typeof options.nearby      == 'undefined') options.nearby      = false;

    // hide the spinner, if the caller forgot (or so we can funnel responsibility for it here)
    // then bail if there are 0 results, so the caller doesn't need that responsibility either
    if (options.showerror && ! resultlist.length) return navigator.notification.alert('Try a different keyword, location, or other filters.', null, 'No Results');

    // pre-work cleanup
    // if the search was not a Nearby search, then turn off automatic Nearby searching right now
    // since it borgs the results panel, causing a confusing result when your search results vanish a few seconds later on location update
    if (! options.nearby) nearbyOff();

    // pre-work cleanup
    // remove the Target marker to 0,0 since we're no longer showing info for a specific place
    MARKER_TARGET.setLatLng([0,0]);

    // pre-work cleanup
    // any directions (both text listing, and the line on the map) need to be cleaned up
    directionsClear();

    // set the Results panel's Back button to go to the indicated search page, head over to the Results page
    // set the Results title to whatever title was given by the search endpoint (we can trust it)
    // tip: why not use data-role="back" ? cuz we want to override that, potentially send the user to someplace else
    if (options.showresults) $.mobile.changePage('#page-find-results');
    $('#page-find-results div[data-role="header"] a').first().prop('href',from);
    $('#page-find-results div[data-role="header"] h1').text(title);

    // empty the results list and repopulate it
    var target = $('#search_results').empty();
    for (var i=0, l=resultlist.length; i<l; i++) {
        var result = resultlist[i];

        // the result entry has a copy of the raw data in it, so it can do intelligent things when the need arises
        // it also has the distance in meters (well, a 0 for now), which is used for sorting the results list by distance
        // and has the title/name of the place as a datum, which is used for sorting the results list by name
        // it also has a click handler defined up in initResultsPanel()
        var li = $('<li></li>').appendTo(target).data('raw',result).data('title',result.name).data('meters',0);

        // the title and perhaps a footnote; that's really up to the very intelligent query endpoint
        var div = $('<div></div>').addClass('ui-btn-text').appendTo(li);
        $('<span></span>').addClass('ui-li-heading').text(result.name).appendTo(div);
        if (result.note) {
            $('<span></span>').addClass('ui-li-desc').html(result.note).appendTo(div);
        }

        // distance readout, to be sorted later by calculateDistancesAndSortSearchResultsList() (sorted, get it? ha ha)
        $('<span></span>').addClass('zoom_distance').addClass('ui-li-count').addClass('ui-btn-up-c').addClass('ui-btn-corner-all').text('0 mi').appendTo(div);
    }
    target.listview('refresh',true);
    calculateDistancesAndSortSearchResultsList();

    // afterthoughts
    // on the Find panel, show the Prior Results option since we now have results that can be prior
    var listview = $('#page-find ul[data-role="listview"]').eq(1);
    listview.find('li').first().show();
    listview.listview('refresh');
}

/*
 * Called by the handleLocationFound() event periodically, this sorts the Search Results list
 * by distance from your current GPS location
 */
function calculateDistancesAndSortSearchResultsList() {
    var sortby = $('#page-find-results div.sortpicker a.active').attr('data-sortby');
    var target = $('#search_results');
    var here   = MARKER_GPS.getLatLng();

    // step 1: recalculate the distance
    // seems wasteful if we're gonna sort by name anyway, but it's not: we still need to update distance readouts even if we're not sorting by distance
    target.children().each(function () {
        var raw     = $(this).data('raw');
        var point   = L.latLng(raw.lat,raw.lng);
        var meters  = Math.round( here.distanceTo(point) );
        var bearing = here.bearingWordTo(point);

        // save the distance in meters, for possible distance sorting
        $(this).data('meters',meters);

        // make up the text:  12.3 mi NE   then fill it in
        var miles = (meters / 1609.344).toFixed(1);
        var feet  = Math.round( meters * 3.2808399 );
        var text  = ( (feet > 900) ? miles + ' mi' : feet + ' ft' ) + ' ' + bearing;
        $(this).find('span.zoom_distance').text(text);
    });

    // step 2: perform the sort
    switch (sortby) {
        case 'distance':
            target.children('li').sort(_sortResultsByDistance);
            break;
        case 'alphabetical':
            target.children('li').sort(_sortResultsByName);
            break;
    }
    target.listview('refresh',true);
}
function _sortResultsByDistance(p,q) {
    return ( $(p).data('meters') > $(q).data('meters') ) ? 1 : -1;
}
function _sortResultsByName(p,q) {
    return ( $(p).data('title') > $(q).data('title') ) ? 1 : -1;
}

/*
 * Query for new Nearby results, and populate them into the Search Results list
 * do this so the results are instantly available as the Previous Results, since that's what they really are
 * but do it silently: don't complain if there's nothing, don't redirect to the results panel, ...
 * see also searchNearby() for the interactive version of this search which does not trigger alerting, and which does not use this filtering
 */
function nearbyRefreshAndAlertIfAppropriate() {
    // this is actually a search, so we can use the common renderer, Previous Results button, etc.
    // compose the params and query the service: lat, lng, meters, list of category IDs
    // tip: use POST so we don't overflow the max URL length: 20 checkboxes can get lengthy
    var latlng = MARKER_GPS.getLatLng();
    var meters = parseFloat( $('#nearby_radius').val() );
    var params = { lat: latlng.lat, lng: latlng.lng, meters: meters, categories: [] };
    $('#page-find-nearby fieldset[data-role="controlgroup"][data-type="activities"] input:checked').each(function () {
        params.categories.push( $(this).prop('value') );
    });
    params.categories = params.categories.join(';');

    $.post( BASE_URL + '/ajax/search_nearby', params, function (results) {
        searchProcessResults(results,"Near You",'#page-find-nearby', { showerror:false, showresults:false, nearby:true });

        // special handling for Nearby: if their list has changed at all, but is not empty, then we should make an alert
        // cuz they're now within range of something which wasn't there last time we alerted them
        // use a timeout so that an error in the alerting system doesn't block this AJAX callback, and result in a spinner that never goes away
        if (results.length) {
            setTimeout(function () {
                nearbyAlertFromResults(results);
            },1);
        }
    },'json').error(function (error) {
        searchProcessError(error);
    });
}
function nearbyAlertFromResults(results) {
    // sort the list of numeric ID#s since that's a nice quick comparison
    var ids = [];
    $.each(results, function () { ids.push(this.gid); });
    ids.sort();
    if (ids.toString() === NEARBY_LAST_ALERT_IDS.toString()) return; // exact same list as before, so they've seen it

    // if we got here then it's a change and we make an alert
    NEARBY_LAST_ALERT_IDS = ids;    // save the list as being the latest alert list
    playSound('sounds/alert.mp3');  // play the beep (why not navigator beep? platform variation, e.g. uses default ringtone on Android)
    navigator.vibrate(1000);        // vibrate

    // and a popup with the names of the first X results
    // ideally that dialog popup would be a push notification, but current state of those is in a bit of a ruckus: plugins not updated to iOS 8.1, docs outdated, plugins sending notifications hours later if at all, ...
    // and of course limited time left on these UI changes -- revisit this when things settle down a but
    var howmany = 5;
    var nearyoutext = [];
    for (var i=0; i<howmany && i<results.length; i++) {
        var name = results[i].name;
        nearyoutext.push(name);
    }
    if (results.length > howmany) nearyoutext.push('And ' + (results.length-howmany) + ' more');
    nearyoutext = nearyoutext.join("\n");

    navigator.notification.confirm(nearyoutext, function (buttonindex) {
        switch (buttonindex) {
            case 2:
                // Show Results
                // the Find Results panel already has the Nearby results
                $.mobile.changePage('#page-find-results');
                break;
            default:
                // either 0 (none) or 1 (dismiss)
                break;
        }
    }, 'Near You', ['Dismiss','Show Results']);
}

/*
 * Leaflet freaks out if you try to zoom the map and the map is not in fact visible, so you must switch to the map THEN perform those map changes
 * this wrapper will do that for you, and is the recommended way to switch to the map and then zoom in, adjust markers, add vectors, ...
 * tip: timeout needs to be long enough to account for transitions on slow devices, but fast enough not to be annoying
 */
function switchToMap(callback) {
    $.mobile.changePage('#page-map');
    setTimeout(callback,750);
}

/*
 * switch over to the Details panel and AJAX-load full info for the given feature
 * accepts an optional callback, to execute after switching page and loading info
 * this callback is ideal for loading Details and then massaging those details, e.g. altering hyperlinks or removing text,
 * or other actions after details are loaded, e.g. trigger a Directions click
 */
function loadAndShowDetailsPanel(feature,callback) {
    // hit up the endpoint and get the HTML description
    var latlng = MARKER_GPS.getLatLng();
    var params = { gid:feature.gid, type:feature.type, lat:latlng.lat, lng:latlng.lng };
    $.get(BASE_URL + '/ajax/moreinfo', params, function (html) {
        // grab and display the plain HTML into the info panel, and switch over to it
        // the HTML is already ready to display, including title, hyperlinks, etc. managed by Cleveland
        $.mobile.changePage('#page-details');

        // the HTML contains More Info links, Photo links, and perhaps other links e.g. to book reservations, visit home page, ...
        // strip out any hyperlinks from the HTML to kee things simple
        // hint: the link may ir may not be inside a LI element (a single-item list)
        html = html.replace(/<li><a .+?<\/a><\/li>/, '');
        html = html.replace(/<a .+?<\/a>/, '');

        // a hack for Loops specifically
        // inserting the UL into the document, causes the app to crash; not a clean exit, but all DOM changes cease to function
        // even $.mobile.changePage() and switchToMap() do absolutely nothing, and the Map and back buttons fail as well
        // the culprit is the UL element; somehow the LIs and DIVs in it cause jQuery Mobile to crash, though it's known JQM-compatible HTML...
        if (feature.type == 'loop') {
            var target = $('#page-details div.description').empty();
            var $html  = $(html);
            for (var i=0, l=$html.length; i<l; i++) {
                switch( $html[i].nodeName ) {
                    case 'P':
                    case 'DIV':
                    case 'H2':
                        var $element = $( $html[i] );
                        $element.appendTo(target);
                        break;
                    case 'UL':
                        var $listing = $('<ul></ul>').appendTo(target).addClass('ui-li').addClass('ui-li-static').addClass('ui-body-c');
                        $listing.css({ 'padding':'0' }); // no idea why, but need to force 0 padding to make it look right
                        var $element = $( $html[i] );
                        $element.children().each(function () {
                            var li  = $('<li></li>').appendTo($listing);
                            var div = $('<div></div>').addClass('ui-btn-text').appendTo(li);
                            var w1  = $(this).find('span').eq(0).text(); // name
                            var w2  = $(this).find('span').eq(1).text(); // distance
                            var w3  = $(this).find('span').eq(2).text(); // time

                            $('<span></span>').appendTo(div).addClass('ui-li-heading').text(w1);
                            $('<span></span>').appendTo(div).addClass('ui-li-desc').text(w2 + ', ' + w3);
                        });
                        $listing.listview().listview('refresh');
                        break;
                }
            }

            // second hack for loops
            // look for the directions along the loop
            // if there are <4 steps then delete the directions readout completely
            // this works around really goofy super-short directions such as "Start on trail. End."
            var directions = $('#page-details div.description ul');
            if (directions.children().length < 4) {
                directions.remove();
            }
        } else {
            // for all other content types, the HTML works as-is
            var target = $('#page-details div.description').html(html);
        }

        // WKT geometry is in a hidden DIV
        // kinda a hack since the change was a surprise after months of other development
        var wkt = $('#page-details div.wkt').text();
        feature.wkt = wkt;

        // intercept any hyperlinks in the HTML and force them through InAppBrowser so we can make them open in the system browser instead
        // this became necessary in Cordova 2.9 and I'm not sure why this isn't the default behavior...
        // this convolution below works on both iOS and Samsung, accounting for JQM silently replacing the A with a DIV
        // and inAppbrowser replacing the hyperlink's href with # which of course means it points nowhere
        $('#page-details div.description a').each(function () {
            var url = $(this).removeAttr('target').prop('href');
            $(this).data('url',url).click(function () {
                window.open( $(this).data('url') ,'_system');
                return false;
            });
        });

        // assign the raw feature to the Map button
        // see initDetailsAndDirectionsPanels() where the data('raw') is defined as a trigger for the map behavior
        $('#page-details').data('raw',feature);

        // and lastly: if we got a callback, go ahead and execute it
        if (callback) callback(feature);
    },'html').error(function (error) {
        navigator.notification.alert('Check that you have data service, then try again.', null, 'No connection?');
    });
}


/*
 * clear the markers, trail lines, loop lines, etc. from the map
 * great for clearing results, that sort of thing
 */
function highlightsClear() {
    if (HIGHLIGHT_LINE) MAP.removeLayer(HIGHLIGHT_LINE);
    MARKER_TARGET.setLatLng([0,0]);
}


/*
 * a set of functions to open up directions to a give latlng
 * thank you Viktor for the phonenavigator plugin
 */
function openDirections(sourcelat,sourcelng,targetlat,targetlng) {
    if ( is_ios() ) {
        _openDirections_iOS(sourcelat,sourcelng,targetlat,targetlng);
    } else if ( is_android() ) {
        _openDirections_Android(sourcelat,sourcelng,targetlat,targetlng);
    } else {
        _openDirections_Chrome(sourcelat,sourcelng,targetlat,targetlng);
    }
}
function _openDirections_iOS(sourcelat,sourcelng,targetlat,targetlng) {
    // iOS handles maps: as an URL protocol and automagically opens navigation
    var url = "maps://?" + "daddr="+targetlat+","+targetlng + "&saddr="+sourcelat+","+sourcelng;
    window.location = url;
}
function _openDirections_Android(sourcelat,sourcelng,targetlat,targetlng) {
    // Android needs a plugin to call the onboard Navigation app
    // aos, it doesn't handle the source location, only a destination
    cordova.require('cordova/plugin/phonenavigator').doNavigate(targetlat, targetlng, null, function () {
        navigator.notification.alert('Could not find a navigation app installed on your device.', null, 'Error');
    });
}
function _openDirections_Chrome(sourcelat,sourcelng,targetlat,targetlng) {
    // non-Cordova the best we can do for Directions is compose a pair of loc: for Google Maps
    var params = {};
    params.saddr = 'loc:' + sourcelat + ',' + sourcelng;
    params.daddr = 'loc:' + targetlat + ',' + targetlng;
    var url = 'http://maps.google.com/?' + $.param(params);
    window.open(url);
}


// erase all Directions-related components from the UI: map line, directions words, ...
function directionsClear() {
    // remove any highlighted trails, POIs, loops, etc. from the map
    highlightsClear();

    // remove the line from the map
    // and reposition the start and end markers to nowhere
    if (DIRECTIONS_LINE) MAP.removeLayer(DIRECTIONS_LINE);
    MARKER_FROM.setLatLng([0,0]);
    MARKER_TO.setLatLng([0,0]);

    // clear the directions text from the Directions panel
    // and clear/hide the elevation profile image
    $('#directions_list').empty().listview('refresh');
    $('#directions_elevationprofile').prop('src','about:blank').parent().hide();

    // on the map panel, hide the Directions button since there are none
    $('#page-map div.map_toolbar a[href="#page-directions"]').closest('td').hide();

    // on the Directions panel, show the Map button since we in fact have a line to show
    $('#page-directions div[data-role="header"] a[href="#page-map"]').hide();
}

// parse the Directions form and pass off to geocoders, Did You Mean autocompletes, etc.
//      in order to populate the sourcelat/sourcelng and destlat/destlng fields so it's ready for a routing request
// this is also validation, since that's quite intricate and tends to change and have deep interactions
//      e.g. address can be a geocode-able address, or GPS or DD coordinates
// ultimately this populates the fields as a side effect, then returns true/false indicating whether it's ready to proceed
//      other side effects would include opening mobile alerts
// a big question you'll likely be wondering: if this is a mobile app, why not use native routing?
// answer: cuz we want to route over our own trails network in 2 of the 4 cases, and to allow directions from park points,
//          AND to keep it branded as CMP in all 4 routing modes and all 4 target types
//          it would be neither consistent nor functional to, in 2 of 4 cases, send them to a mobile app which has no idea where the ABC Picnic Area is located
function directionsParseAddressAndValidate() {
    // part 0 - cleanup

    // clear the Feature identification, as they likely did not use a Feature search and will likely need to go through a Did You Mean autocomplete sorta thing
    // if they did mean it, this gets populated in the "features" switch case below
    var form = $('#page-directions');
    form.find('input[name="feature_gid"]').val('');
    form.find('input[name="feature_type"]').val('');

    // clear any prior directions text, map lines, etc.
    directionsClear();

    // part 1 - simple params we can extract now
    // we use these to fine-tune some of the routing params, e.g. re-geocoding opints to their nearest parking lot; see part 3
    // prior versions of this app and website, had selectors for some of these options; but we decided to simplify and hardcode the defaults
    // historical note: that's why Bike is called bike_advanced; prior versions had us select bicycle difficulty

    var via     = form.find('div.directions_buttons img[data-selected="true"]').attr('data-mode');
    var tofrom  = "to";
    var prefer  = "recommended";

    // part 2 - figure out the origin

    // can be any of address geocode, latlon already properly formatted, current GPS location, etc.
    // this must be done before the target is resolved (below) because resolving the target can mean weighting based on the starting point
    // e.g. directions to parks/reservations pick the closest gate or parking lot to our starting location
    // this also has our bail conditions, e.g. an address search that cannot be resolved, a feature name that is ambiguous, ... look for "return" statements below

    // we must do some AJAX for the target location and the origin location, but it must be done precisely in this sequence
    var sourcelat, sourcelng;
    var addresstype = form.find('select[name="origin"]').val();
    var address     = form.find('input[name="address"]').val();
    switch (addresstype) {
        // GPS origin: simplest possible case: lat and lng are already had
        case 'gps':
            sourcelat = MARKER_GPS.getLatLng().lat;
            sourcelng = MARKER_GPS.getLatLng().lng;
            break;
        // GEOCODE origin: but a hack (of course), that it can be either an address or else GPS coordinates in either of 2 formats
        case 'geocode':
            if (! address) return navigator.notification.alert('Please enter an address, city, or landmark.', null, 'Enter an Address');
            var is_decdeg = /^\s*(\d+\.\d+)\s*\,\s*(\-\d+\.\d+)\s*$/.exec(address); // regional assumption in this regular expression: negative lng, positive lat
            var is_gps    = /^\s*N\s+(\d+)\s+(\d+\.\d+)\s+W\s+(\d+)\s+(\d+\.\d+)\s*$/.exec(address); // again, regional assumption that we're North and West
            if (is_decdeg) {
                sourcelat = parseFloat( is_decdeg[1] );
                sourcelng = parseFloat( is_decdeg[2] );
            } else if (is_gps) {
                var latd = parseFloat( is_gps[1] );
                var latm = parseFloat( is_gps[2] );
                var lngd = parseFloat( is_gps[3] );
                var lngm = parseFloat( is_gps[4] );
                sourcelat = latd + (latm/60);   // regional assumption; lat increases as magnitude increases cuz we're North
                sourcelng = -lngd - (lngm/60);  // regional assumption; lng dereases as magnitude increases cuz we're West
            } else {
                var params = {};
                params.address  = address;
                params.bing_key = BING_API_KEY;
                params.bbox     = GEOCODE_BIAS_BOX;

                $.ajaxSetup({ async:false });
                $.get(BASE_URL + '/ajax/geocode', params, function (result) {
                    $.ajaxSetup({ async:true });

                    if (! result) return navigator.notification.alert('Could not find that address.', null, 'Address Not Found');
                    sourcelat = result.lat;
                    sourcelng = result.lng;
                },'json').error(function (error) {
                    $.ajaxSetup({ async:true });

                    return navigator.notification.alert('Could not find that address. Check the address, and that you have data service turned on and a good signal.', null, 'No connection?');
                });
            }
            break;
        // FEATURES origin: use a variant of the keyword autocomplete concept, to provide a list of names as they type
        // having exactly one result, or the first result matching your search exactly, fills in the Feature Type and GID for later, as well as grabbing its latlng
        // to clarify: submitting the form
        case 'features':
            var params = {};
            params.keyword = address;
            params.limit   = 25;
            params.lat     = MARKER_GPS.getLatLng().lat;
            params.lng     = MARKER_GPS.getLatLng().lng;
            params.via     = via;

            $.ajaxSetup({ async:false });
            $.get(BASE_URL + '/ajax/keyword', params, function (candidates) {
                $.ajaxSetup({ async:true });

                // we got back a list of autocomplete candidates
                // see if any of them are an exact match for what we typed, if so then truncate the list to that 1 perfect item
                // see if there's only 1 autocomplete candidate (perhaps the one we picked above), in which case we call that a match
                var matchme = address.replace(/\W/g,'').toLowerCase();
                for (var i=0, l=candidates.length; i<l; i++) {
                    var stripped = candidates[i].name.replace(/\W/g,'').toLowerCase();
                    if (stripped == matchme) { candidates = [ candidates[i] ]; break; }
                }

                if (candidates.length == 1) {
                    // only 1 autocomplete candidate
                    // save the lat/lng and the type/gid
                    // and fill in the name so it's all spelled nicely, instead of the user's presumably-partial wording
                    // then empty the autocomplete candidate listing, cuz we only had 1 and it's now in effect
                    form.find('input[name="feature_gid"]').val(candidates[0].gid);
                    form.find('input[name="feature_type"]').val(candidates[0].type);
                    sourcelat = candidates[0].lat;
                    sourcelng = candidates[0].lng;
                    form.find('input[name="address"]').val( candidates[0].name );
                    $('#directions_autocomplete').empty().hide();
                } else {
                    // okay, there's more than 1 candidate for this autocomplete, so fill in that listview of options
                    // each option has a click handler to basically do what the "length == 1" option did above: fill it in, empty listing, ...
                    // note: item 0 is not a result, but the words "Did you mean..." and has no click behavior
                    var listing = $('#directions_autocomplete').empty().show();
                    for (var i=0, l=candidates.length; i<l; i++) {
                            var name = candidates[i].name.replace(/^\s*/,'').replace(/\s*$/,'');
                            var item = $('<li></li>').data('raw',candidates[i]).appendTo(listing);
                            $('<span></span>').addClass('ui-li-heading').text(name).appendTo(item);
                            item.click(function () {
                                // click this item: fill in the name, gid and type, lat and lng, ... empty the listing cuz we made a choice
                                var info = $(this).data('raw');
                                form.find('input[name="feature_gid"]').val(info.gid);
                                form.find('input[name="feature_type"]').val(info.type);
                                sourcelat = info.lat;
                                sourcelng = info.lng;
                                form.find('input[name="address"]').val( info.name );
                                $('#directions_autocomplete').empty().hide();
                            });
                    }
                    listing.listview('refresh');
                }
            },'json').error(function (error) {
                $.ajaxSetup({ async:true });

                return navigator.notification.alert('Could fetch any locations. Check that you have data service turned on and a good signal.', null, 'No connection?');
            });
            break;
    }
    if (! sourcelat || ! sourcelng) return; // if this failed, do nothing; likely indicates that an AJAX call was used to do something other than bail or get coordinates, e.g. Features search
    // if we got here then we either loaded sourcelat and sourcelng, or else bailed with an error or some other task completed

    // part 3 - figure out the target location and perhaps re-figure-out the starting location as well
    // seems dead simple at first: we got here from the Details Panel and it has data('raw') with lat and lng
    // but some routing scenarios actually use alternate points e.g. the entrance gate or parking lot closest to each other
    // so we likely will do a re-geocode for target AND source to find their closest geocoding-target-points

    // 3a: start with the default points for the target location
    var targetlat  = $('#page-details').data('raw').lat;
    var targetlng  = $('#page-details').data('raw').lng;
    var targettype = $('#page-details').data('raw').type;
    var targetgid  = $('#page-details').data('raw').gid;

    var origtype = form.find('input[name="feature_type"]').val();
    var origgid  = form.find('input[name="feature_gid"]').val();

    // 3b: if the origin is a Feature AND it's a type that supports alternate destinations
    // then do some AJAX and replace sourcelat and sourcelng with the version that's closest to our target location
    if (origtype && origgid) {
        switch (origtype) {
            case 'poi':
            case 'reservation':
            case 'building':
            case 'trail':
                var params = {};
                params.type = origtype;
                params.gid  = origgid;
                params.lat  = targetlat;
                params.lng  = targetlng;
                params.via  = via;

                $.ajaxSetup({ async:false });
                $.get(BASE_URL + '/ajax/geocode_for_directions', params, function (reply) {
                    $.ajaxSetup({ async:true });
                    sourcelat = reply.lat;
                    sourcelng = reply.lng;
                }, 'json').error(function (error) {
                    $.ajaxSetup({ async:true });
                    // error handling here, would be simply to leave sourcelat and sourcelng alone
                    // rather than bug the uer that we couldn't find an even-better location than the ones they already picked
                });
                break;
        }
    }

    // 3c: if the target is a Feature and it's a type that supports alternate destinations
    // then do some AJAX and replace sourcelat and sourcelng with the version that's closest to our origin location
    // yes, we potentially revised the origin above; now we potentially adjust the target as well
    // hypothetically this could have a situation where we now route to a point further away, shuffling both points back and forth
    //      but that's not a realistic problem; parking lots aren't on the far side of town from their facility, for example
    if (targettype && targetgid) {
        switch (targettype) {
            case 'poi':
            case 'reservation':
            case 'building':
            case 'trail':
                var params = {};
                params.type = targettype;
                params.gid  = targetgid;
                params.lat  = sourcelat;
                params.lng  = sourcelng;
                params.via  = via;

                $.ajaxSetup({ async:false });
                $.get(BASE_URL + '/ajax/geocode_for_directions', params, function (reply) {
                    $.ajaxSetup({ async:true });
                    targetlat = reply.lat;
                    targetlng = reply.lng;
                }, 'json').error(function (error) {
                    $.ajaxSetup({ async:true });
                    // error handling here, would be simply to leave targetlat and targetlng alone
                    // rather than bug the uer that we couldn't find an even-better location than the ones they already picked
                });
                break;
        }
    }
    // if we got here then we successfully loaded targetlat and targetlng

    // part 99 - bail condition for a SUCCESSFUL set of lookups
    // if the starting location is outside our supported area, it wouldn't make sense to draw it onto the map
    // so we punt, and hand off to the native mapping app so they can figure it out themselves
    if (! MAX_BOUNDS.contains([sourcelat,sourcelng]) ) {
        navigator.notification.alert('That is outside the supported area, so we\'ll open your native routing app so you get better results.', null, 'Outside Area');
        openDirections(sourcelat,sourcelng,targetlat,targetlng);
        return false;
    }

    // part 100 - done and ready!
    // slot the numbers into the form, really for debugging
    // then do the directions-getting from all those params we fetched and calculated above

    form.find('input[name="origlat"]').val(sourcelat);
    form.find('input[name="origlng"]').val(sourcelng);
    form.find('input[name="destlat"]').val(targetlat);
    form.find('input[name="destlng"]').val(targetlng);

    directionsFetch(sourcelat,sourcelng,targetlat,targetlng,tofrom,via,prefer);
}

function directionsFetch(sourcelat,sourcelng,targetlat,targetlng,tofrom,via,prefer) {
    // clear any prior directions text, map lines, etc.
    directionsClear();

    // make up the request and run it
    var params = {
        sourcelat:sourcelat, sourcelng:sourcelng,
        targetlat:targetlat, targetlng:targetlng,
        tofrom:tofrom, via:via, prefer:prefer,
        bing_key: BING_API_KEY
    };

    $.get(BASE_URL + '/ajax/directions', params, function (reply) {
        if (! reply || ! reply.steps) return navigator.notification.alert('Could not find directions. Try a different travel mode.', null, 'No Route');
        directionsRender(reply);
    }, 'json').error(function (error) {
        navigator.notification.alert('Could not ask for directions. Check that you have data service turned on and a good signal.', null, 'No connection?');
    });
}

function directionsRender(directions) {
    // stow the raw result into the Directions panel metadata
    $('#page-directions').data('directions',directions);

    // on the Directions panel, show the Map button since we in fact have a line to show
    // on the Map panel, show the Directions button since there are directions to revisit
    $('#page-directions div[data-role="header"] a[href="#page-map"]').show();
    $('#page-map div.map_toolbar a[href="#page-directions"]').closest('td').show();

    // first entry in the listing: the total distance, time, etc.
    var listing = $('#directions_list').empty();
    var li = $('<li></li>').appendTo(listing);
    if (directions.retries && directions.retries > 3) {
        $('<span></span>').addClass('ui-li-desc').html("Route may be approximated.").appendTo(li);
    }
    $('<span></span>').addClass('ui-li-heading').html('<b>Total:</b> ' + directions.totals.distance + ', ' + directions.totals.duration).appendTo(li);

    // the listing of steps/instructions
    for (var i=0, l=directions.steps.length; i<l; i++) {
        var step     = directions.steps[i];
        var title    = step.stepnumber ? step.stepnumber + '. ' + ( step.turnword ? step.turnword : '') + ' ' + step.text : step.turnword + ' ' + step.text;
        var li       = $('<li></li>').appendTo(listing);

        $('<span></span>').addClass('ui-li-heading').text(title).appendTo(li);
        if (step.distance && step.duration && step.distance.substr(0,1)!='0') {
            var subtitle = step.distance + ', ' + step.duration;
            $('<span></span>').addClass('ui-li-desc').text(subtitle).appendTo(li);
        }
    }

    // and done wth the listing
    listing.listview('refresh');

    // elevation profile
    // it was already hidden and blanked by the directions-clearing process
    // submit the new EP to the server, and when it comes back that's the URL to use for the image
    if (directions.elevationprofile) {
        // the vertices have horizontal and vertical info (feet for both distance and elevation). make a pair of arrays
        var x = [];
        var y = [];
        for (var i=0, l=directions.elevationprofile.length; i<l; i++) {
            x[x.length] = directions.elevationprofile[i].x;
            y[y.length] = directions.elevationprofile[i].y;
        }

        var params = {};
        params.x = x.join(',');
        params.y = y.join(',');
        $.post(BASE_URL + '/ajax/elevationprofilebysegments', params, function (url) {
            if (url.indexOf('http') != 0) {
                // not an URL, so something went wrong; just quietly bail and let the EP image remain hidden and blanked
                return;
            }
            $('#directions_elevationprofile').prop('src',url).parent().show();
        });
    }
}

