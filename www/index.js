/******************************************************************************
 ***** CONSTANTS
 ******************************************************************************/

// the base URL where all data endpoints reside: the CMP website
var BASE_URL = "http://maps.clevelandmetroparks.com/";

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
BASEMAPS['terrain'] = new L.TileLayer("http://maps{s}.clemetparks.com/tilestache/tilestache.cgi/basemap_mobilestack/{z}/{x}/{y}.jpg", { name:'terrain', subdomains:'123', updateWhenIdle:true });
BASEMAPS['photo']   = new L.TileLayer("http://maps{s}.clemetparks.com/tilestache/tilestache.cgi/satphoto_mobilestack/{z}/{x}/{y}.jpg", { name:'photo', subdomains:'123', updateWhenIdle:true });

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
var RADAR_CIRCLE = new L.Circle(L.latLng(0,0), 1, { color:'0000FF', weight:1.5, fill:false });

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
var DIRECTIONS_LINE_STYLE = { color:"#0000FF", weight:5, opacity:1.00, clickable:false, smoothFactor:0.25 };
var HIGHLIGHT_LINE       = null;
var HIGHLIGHT_LINE_STYLE = { color:"#FF00FF", weight:3, opacity:0.75, clickable:false, smoothFactor:0.25 };

// used by the radar: sound an alert only if the list has in fact changed
var LAST_BEEP_IDS = [];

// used by Near You Now and then later by Radar, a structure of all POIs
// we cannot render them all into the Radar page at the same time, but we can store them in memory
var ALL_POIS = [];

// should we auto-center the map on location updates? don't toggle this directly, see toggleGPS()
// when we zoom to our own location, to what zoom level?
var AUTO_CENTER_ON_LOCATION = false;
var AUTO_CENTER_ZOOMLEVEL   = 16;

//gda remove this
// sorting by distance, isn't always by distance
// what type of sorting do they prefer?
var DEFAULT_SORT = 'distance';

// for tile caching, the name of a subdirectory where this app will store its content
// this is particularly important on Android where filesystem is not a sandbox but your SD card
var STORAGE_SUBDIR = "ClevelandMetroparks";

// the list of Reservations (parks)
// used to build select elements and potentially listviews, e.g. filtering for Loops or Trails by reservation
// WARNING: these must exactly match the spellings as they appear in the Use Areas (POIs) DB table, as they are used for matching
//          if CMP changes the name of a reservation, they must update their Use Areas dataset as they expect, but also publish a new version of the mobile app!
//          tip: Why not have this automatically update when the app starts? Consumes data, not helpful offline, would 100% cripple the UI if it fails
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
    // disable page transitions for faster... transitions
    $.mobile.defaultPageTransition = 'none';

    // pre-render the pages so we don't have that damnable lazy rendering thing messing with it
    $('div[data-role="page"]').page();

    // now the rest of event handlers, map setup, etc. in stages
    initCacheThenMap();
    initWelcomePanel();
    initSettingsPanel();
    initNearbyPanel();

    // the various Find subtypes, which have surprisingly little in common
    // except that the results all go to a common results panel
    initFindPOIs();
    initFindTrails();
    initFindLoops();
    initFindKeyword();
    initResultsPanel();

    // ready!
    // look at the Skip Welcome setting and see whether we should go there, or to the map
    var welcome = window.localStorage.getItem('skip_welcome');
    if (welcome == 'show') $.mobile.changePage('#page-welcome');
}

function initCacheThenMap() {
    // initialize the filesystem where we store cached tiles. when this is ready, proceed with the map
    CACHE = new OfflineTileCacher(STORAGE_SUBDIR);
    CACHE.init(function () {
        for (var which in BASEMAPS) CACHE.registerLayer( BASEMAPS[which] );
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

    // additional Controls
    L.control.scale().addTo(MAP);

    // our version of a WMS GetFeatureInfo control: a map click calls query.php to get JSON info, and we construct a bubble
    // BUT, we only call this if a popup is not open: if one is open, we instead close it
    // normally we would use MAP's own closePopupOnClick but that doesn't in fact CANCEL the click-and-query event
    MAP.on('click', function (event) {
        if ( $('.leaflet-popup').length ) return MAP.closePopup();
        wmsGetFeatureInfoByPoint(event.layerPoint);
    });

    // whenever we get a location event, we have a lot of work to do: GPS readout, radar and perhaps playing an alert sound, updating the marker-and-circle on the map, ...
    // if we get a location error, it affirms that we do not have a location; we need to show certain "Uhm, FYI!" notes around the app, hide the marker-and-circle, ...
    MAP.on('locationfound', function(event) {
        handleLocationFound(event);
    }).on('locationerror', function(event) {
        handleLocationError(event);
    });

    // these buttons appear over the map, and are more complex than the simpler hyperlinks at the bottom of the map page
    //  $('#mapbutton_settings')
    $('#mapbutton_gps').click(function () {
        toggleGPS();
    });
    $('#mapbutton_settings').click(function (event) {
        event.stopPropagation();
    });

    // ready! set! action!
    // start constant geolocation, which triggers the 'locationfound' event handlers defined above
    MAP.locate({ watch: true, enableHighAccuracy: true });
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
    $('#page-seedcache a[name="seedcache"]').click(function () {
        beginSeedingCache();
        // cancel the button taking us back to the same page; that will happen in the progress() and error() handlers
        return false;
    });

    // enable the "Offline" checkbox to toggle all registered layers between offline & online mode
    $('#basemap_offline_checkbox').change(function () {
        var offline = $(this).is(':checked');
        var layers  = CACHE.registeredLayers();
        if (offline) {
            for (var layername in layers) CACHE.useLayerOffline(layername);
        } else {
            for (var layername in layers) CACHE.useLayerOnline(layername);
        }
    });

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

function initNearbyPanel() {
    // populate the Alert Activities listview, with a list of activities
    var target = $('#radar_config fieldset[data-role="controlgroup"][data-type="activities"]');
    for (var i=0, l=LIST_ACTIVITIES.length; i<l; i++) {
        var activity = LIST_ACTIVITIES[i];

        // add the checkbox to the DOM and decorate it
        var wrap     = $('<label></label>').appendTo(target);
        var checkbox = $('<input></input>').prop('type','checkbox').prop('name','activity').prop('value',activity).text(activity);
        checkbox.appendTo(wrap).checkboxradio('refresh')
    }
    target.listview('refresh',true);

    // when the Enable Radar checkbox is toggled, toggle the #radar_config items below it
    // and if we're turning it on, then perform a nearby search right now
    // tip: the checked status of #radar_enabled is used by the onLocationFound handler, to determine whether to call searchNearby()
    $('#radar_enabled').change(function () {
        var viz = $(this).is(':checked');
        if (viz) {
            $('#radar_config').show();
            $('#nearby_listing').show().listview('refresh');
            searchNearby();
        } else {
            $('#radar_config').hide();
            $('#nearby_listing').ty().hide();
        }
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
        var src = $(this).prop('src').replace('_off.png', '_on.png');
        $(this).attr('data-selected','true').prop('src', src);

        $(this).siblings('img[data-field="activity"]').each(function () {
            var src = $(this).prop('src').replace('_on.png', '_off.png');
            $(this).removeAttr('data-selected').prop('src',src);
        })
    }).first().click();

    // the Go button
    // collect the form elements and pass them to the searchificator-inator
    // but wait! there's not just form elements, but weirdness like icons with a data-selected= attribute
    $('#page-find-trails input[type="button"]').click(function () {
        var params = {};
        params.paved       = $('#page-find-trails select[name="paved"]').val();
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
        var src = $(this).prop('src').replace('_off.png', '_on.png');
        $(this).attr('data-selected','true').prop('src', src);

        $(this).siblings('img[data-field="activity"]').each(function () {
            var src = $(this).prop('src').replace('_on.png', '_off.png');
            $(this).removeAttr('data-selected').prop('src',src);
        })
    }).first().click();

    // distance filter: also tapping icons and also only one choice allowed, structurally identical to the use type filter above
    // again, select the first one, so it's highlighted and a value exists
    $('#page-find-loops img[data-field="length"]').click(function () {
        // tag this one AND ONLY THIS ONE as being the data-selected element
        //      this also means some URL swapping to switch out icons
        // data endpoint was specifically meant to accept multiple use types, but later they decided that they prefer to use only one
        var src = $(this).prop('src').replace('_off.png', '_on.png');
        $(this).attr('data-selected','true').prop('src', src);

        $(this).siblings('img[data-field="length"]').each(function () {
            var src = $(this).prop('src').replace('_on.png', '_off.png');
            $(this).removeAttr('data-selected').prop('src',src);
        })
    }).first().click();

    // the Go button
    // collect the form elements and pass them to the searchificator-inator
    // but wait! there's not just form elements, but weirdness like icons with a data-selected= attribute
    // and converting units: length & duration filters are in miles and minutes but endpoint wants feet and seconds
    $('#page-find-loops input[type="button"]').click(function () {
        var params = {};
        params.paved       = $('#page-find-loops select[name="paved"]').val();
        params.reservation = $('#page-find-loops select[name="reservation"]').val();
        params.filter_type = $('#page-find-loops img[data-field="activity"][data-selected]').attr('data-value');
        params.minfeet     = 5280 * $('#page-find-loops img[data-field="length"][data-selected]').attr('data-min');
        params.maxfeet     = 5280 * $('#page-find-loops img[data-field="length"][data-selected]').attr('data-max');
        params.minseconds  = 3600 * $('#page-find-loops input[name="duration_min"]').val();
        params.maxseconds  = 3600 * $('#page-find-loops input[name="duration_max"]').val();

        searchLoops(params);
    });
}

function initFindKeyword() {
    var form = $('#page-find fieldset[data-type="geocode"]');
    form.find('input[type="text"]').keydown(function (key) {
        if(key.keyCode != 13) return;
        $(this).closest('fieldset').find('input[type="button"]').click();
    });
    form.find('input[type="button"]').click(function () {
        var keyword = $(this).closest('fieldset').find('input[type="text"]').val().trim();
        if (! keyword ) return false;
        searchKeyword(keyword);
    });
}

function initResultsPanel() {
    // the Results can be sorted alphabetically, or by their distance from you
    // enable the buttons which switch this: they toggle which one is "active" and then do a sort immediately
    // see also the calculateDistancesAndSortSearchResultsList() function; it examines these sortpicker buttons to determine which one is active
    $('#page-find-results div.sortpicker a').click(function () {
        $(this).addClass('active').siblings().removeClass('active');
        calculateDistancesAndSortSearchResultsList();
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
    $('#mapbutton_gps img').prop('src','images/mapbutton_gps_ios_on.png');
}
function toggleGPSOff() {
    AUTO_CENTER_ON_LOCATION = false;
    $('#mapbutton_gps img').prop('src','images/mapbutton_gps_ios_off.png');
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
    within ? $('.location_outside').hide() : $('.location_outside').show();
    event.accuracy > 50 ? $('.location_fail').show() : $('.location_fail').hide();

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

    // sort any visible distance-sorted lists on the Results page
    calculateDistancesAndSortSearchResultsList();

    // adjust the Nearby listing aka Radar
    if ( $('#radar_enabled').is(':checked') ) {
        searchNearby();
    }

//gda
/*
    // check the Radar alerts to see if anything relevant is within range
    if ( $('#radar_enabled').is(':checked') ) {
        var meters = $('#radar_radius').val();
        var categories = [];
        $('input[name="radar_category"]:checked').each(function () { categories[categories.length] = $(this).val() });
        placeRADAR_CIRCLE(event.latlng.lat,event.latlng.lng,meters);
        checkRadar(event.latlng,meters,categories);
    }
*/

}

function handleLocationError(event) {
    // show the various "Location failed!" messages
    $('.location_fail').show();
}


/*
 * This provides a dialog panel for showing an error message, which has
 * some benefits over using alert() to report errors or acknowledgements.
 * First, it is more mobile-esque and less canned than alert()
 * Second, it does not block JavaScript processing. Sometimes you do want to block, but often not.
 */
function mobilealert(message,header) {
    if (typeof header == 'undefined') header = 'Error';

    $('#dialog-error div[data-role="content"]').text(message);
    $('#dialog-error div[data-role="header"] h1').text(header);
    $.mobile.changePage('#dialog-error');
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
 * Mostly for point debugging, the "start seeding" function in a separate, named function
 * figure out the zoom and center and list of layers, hand off to the cache seeder,
 * and keep a callback to show a progress dialog
 */

function beginSeedingCache() {
    // the lon, lat, and zooms for seeding
    var lon   = MAP.getCenter().lng;
    var lat   = MAP.getCenter().lat;
    var zmin  = MAP.getZoom();
    var zmax  = MAX_ZOOM;

    // fetch the assocarray of layername->layerobj from the Cache provider,
    // then figure out a list of the layernames too so we can seed them sequentially
    var layers_to_seed = CACHE.registeredLayers();
    var layernames = [];
    for (var l in layers_to_seed) layernames[layernames.length] = layers_to_seed[l].options.name;
    var last_layer_name = layernames[layernames.length-1];

    function seedLayerByIndex(index) {
        if (index >= layernames.length) {
            // past the end, we're done
            $.mobile.changePage("#page-settings");
            return;
        }
        var layername = layernames[index];

        var layer_complete = function(done,total) {
            // hide the spinner
            $.mobile.hidePageLoadingMsg();
            // go on to the next layer
            seedLayerByIndex(index+1);
        }
        var progress = function(done,total) {
            // show or update the spinner
            var percent = Math.round( 100 * parseFloat(done) / parseFloat(total) );
            var text    = layername + ': ' + done + '/' + total + ' ' + percent + '%';
            $.mobile.showPageLoadingMsg("a", text, true);
            // if we're now done, call the completion function to close the spinner
            if (done>=total) layer_complete();
        };
        var error = function() {
            $.mobile.hidePageLoadingMsg();
            alert('Download error!');
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
        options.maxHeight = parseInt( $('#map_canvas').height() - $('#toolbar').height() - 20 );
        options.maxWidth  = parseInt( $('#map_canvas').width() - 40 );

        var popup = new L.Popup(options).setLatLng(anchor).setContent(html);
        MAP.openPopup(popup);
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

    $.mobile.showPageLoadingMsg("a", "Loading", false);
    $.get( BASE_URL + '/ajax/browse_items', params, function (reply) {
        $.mobile.hidePageLoadingMsg();
          searchProcessResults(reply.results, reply.title, '#page-find-pois');
    },'json').error(function (error) {
        searchProcessError(error);
    });
}

function searchKeyword(keyword) {
    var params = { keyword:keyword, limit:100 };

    $.mobile.showPageLoadingMsg("a", "Loading", false);
    $.get( BASE_URL + '/ajax/keyword', params, function (results) {
        $.mobile.hidePageLoadingMsg();
          searchProcessResults(results, "Keyword: " + keyword , '#page-find');
    },'json').error(function (error) {
        searchProcessError(error);
    });
}

function searchTrails(options) {
    var params = options;

    $.mobile.showPageLoadingMsg("a", "Loading", false);
    $.get( BASE_URL + '/ajax/search_trails', params, function (results) {
        $.mobile.hidePageLoadingMsg();
        searchProcessResults(results, 'Trail Finder', '#page-find-trails');
    }, 'json').error(function (error) {
        searchProcessError(error);
    });
}

function searchLoops(options) {
    var params = options;

    $.mobile.showPageLoadingMsg("a", "Loading", false);
    $.get( BASE_URL + '/ajax/search_loops', params, function (results) {
        $.mobile.hidePageLoadingMsg();
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

//gda
function searchNearby() {
    var target = $('#nearby_listing').empty().listview('refresh');
}

function searchProcessError(error) {
    // hide any loading spinner, set the results title to clearly indicate a problem
    $.mobile.hidePageLoadingMsg();
    mobilealert("Check that you have data service, then try again.", "No connection?");
}

function searchProcessResults(resultlist,title,from) {
    // hide the spinner, if the caller forgot (or so we can funnel responsibility for it here)
    // then bail if there are 0 results, so the caller doesn't need that responsibility either
    $.mobile.hidePageLoadingMsg();
    if (! resultlist.length) return mobilealert("Try a different keyword, location, or other filters.", "No Results");

    // set the Results panel's Back button to go to the indicated search page, head over to the Results page
    // set the Results title to whatever title was given by the search endpoint (we can trust it)
    $.mobile.changePage('#page-find-results');
    $('#page-find-results div[data-role="header"] a[data-icon="back"]').prop('href',from);
    $('#page-find-results div[data-role="header"] h1').text(title);

    // empty the results list and repopulate it
    var target = $('#search_results').empty();
    for (var i=0, l=resultlist.length; i<l; i++) {
        var result = resultlist[i];

        // the result entry has a copy of the raw data in it, so it can do intelligent things when the need arises
        // it also has the distance in meters (well, a 0 for now), which is used for sorting the results list by distance
        // and has the title/name of the place as a datum, which is used for sorting the results list by name
        var li = $('<li></li>').addClass('zoom').appendTo(target).data('raw',result).data('title',result.name).data('meters',0);
        li.click(function () {
            var info = $(this).data('raw');
            showInfoPanel(info);
        });

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
}

// note: this is for Search Results, which is not the same as Near You Now aka Radar
function calculateDistancesAndSortSearchResultsList() {
    var sortby = $('#page-find-results div.sortpicker a.active').attr('data-sortby');
    var target = $('#search_results');
    var here   = MARKER_GPS.getLatLng();

    // step 1: recalculate the distance
    // seems wasteful if we're gonna sort by name anyway, but it's not: we still need to update distance readouts even if we're not sorting by distance
    target.children().each(function () {
        var raw     = $(this).data('raw');
        var point   = L.latLng(raw.lat,raw.lng);
        var meters  = Math.round( MARKER_GPS.getLatLng().distanceTo(point) );
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

//gda
function showInfoPanel(info) {
    alert(info);
}

