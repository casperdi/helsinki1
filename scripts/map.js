// Initialize and add the map
const {Map} = await google.maps.importLibrary('maps');
const wfsUrl = 'https://kartta.hsy.fi/geoserver/wfs?service=WFS&version=1.0.0&request=GetFeature&TypeName=JH_Keraysautojen_pysahtymispaikat_2023';
let xmlData = '';
const proxyUrl = 'https://corsproxy.io/?';
let transposedDataArray;
const googleMarkers = [];
let infoWindowOpen = false;

function fetchAndParseXml() {
  return new Promise((resolve, reject) => {
    fetch(proxyUrl + wfsUrl).
    then((response) => response.text()).
    then((xmlResponse) => {
      xmlData = xmlResponse;
      parseXmlToArray(xmlData);
      resolve(); // Resolve the promise once data is processed
    }).
    catch((error) => {
      console.error('Error fetching WFS data: ', error);
      reject(error); // Reject the promise if there's an error
    });
  });
}

function parseXmlToArray(xmlString) {
  const parser = new DOMParser();
  const xmlDoc = parser.parseFromString(xmlString, 'text/xml');

  const nsResolver = xmlDoc.createNSResolver(xmlDoc.ownerDocument == null ?
    xmlDoc.documentElement :
    xmlDoc.ownerDocument.documentElement);

  const dataArray = [];

  const elements = [
    'vko',
    'viikonpva',
    'pvm',
    'klo',
    'osoite',
    'postinro',
    'kunta',
    'adress_sv',
    'address_en',
    'leveyspiir',
    'pituuspiir',
    'geom',
  ];

  for (const elementName of elements) {
    const nodes = xmlDoc.evaluate(
      `//jatteet_ja_materiaalitehokkuus:${elementName}`, xmlDoc, nsResolver,
      XPathResult.ORDERED_NODE_SNAPSHOT_TYPE, null);
    const dataItems = [];

    for (let i = 0; i < nodes.snapshotLength; i++) {
      dataItems.push(nodes.snapshotItem(i).textContent);
    }

    dataArray.push(dataItems);
  }

  // Transpose the dataArray to have each property as an array
  transposedDataArray = dataArray[0].map(
    (_, colIndex) => dataArray.map(row => row[colIndex]));

}

//Placeholder variables for testing purposes
let map;
let myLat = 60.2704759;
let myLong = 24.847957;
let location = {lat: myLat, lng: myLong};
let currentInfoWindow = null;

/**
 * This function generates the map, locates users location and centers map over user
 * makes marker on users place, inside this code you can add new markers for stops
 * @returns {Promise<void>}
 */
async function initMap() {
  const location = {lat: myLat, lng: myLong};

  map = new google.maps.Map(document.getElementById('map'), {
    zoom: 11,
    center: location,
    mapTypeControl: false,
    styles: [
      {
        featureType: 'poi',
        stylers: [
          {visibility: 'off'},
        ],
      },
    ],
  });

  if (navigator.geolocation) {
    navigator.geolocation.getCurrentPosition(function(position) {
      let userLatLng = {
        lat: position.coords.latitude,
        lng: position.coords.longitude,
      };
      map.setCenter(userLatLng);

      addMarker(map, userLatLng, 'Your position', 'sad', 'Tee custom marker' +
        ' data käyttäjän sijainnille', 350);
    }, function(error) {
      handleLocationError(error);
    });
  } else {
    handleLocationError({code: 0, message: 'Geolocation is not supported'});
  }

  map.addListener('click', function() {
    if (currentInfoWindow) {
      currentInfoWindow.close();
      currentInfoWindow = null;
    }
  });

  await fetchAndParseXml();


  proj4.defs('EPSG:3879',
    '+proj=tmerc +lat_0=0 +lon_0=25 +k=1 +x_0=25500000 +y_0=0 +ellps=GRS80 +towgs84=0,0,0,0,0,0,0 +units=m +no_defs');
  proj4.defs('EPSG:4326', '+proj=longlat +datum=WGS84 +no_defs');

  for (let i = 0; i < transposedDataArray.length; i++) {

    let asd = transposedDataArray[i];
    const sourceCoords = asd[11];
    const separateCoords = sourceCoords.split(',');
    let separateSource = [];
    if (separateCoords.length === 2) {
      separateSource = [
        parseFloat(separateCoords[0]),
        parseFloat(separateCoords[1])];
    }

    console.log('Source Coordinates (EPSG:3879):', separateSource);

    const targetCoords = proj4('EPSG:3879', 'EPSG:4326', separateSource);
    asd[11] = targetCoords;
    console.log('Target Coordinates', targetCoords);

    const latitude = targetCoords[1];
    const longitude = targetCoords[0];

    let markerLatLng = {lat: latitude, lng: longitude};
    console.log(`Marker ${i}: Latitude ${latitude}, Longitude ${longitude}`);
    const marker = addMarker(map, markerLatLng, asd[2].toString(),
      'auto on paikalla ' + asd[3].toString(), asd, i);
    googleMarkers.push(marker);

  }
}

//console.log(googleMarkers[1].markerData[8], "ggg")

/**
 * With this function you can create markers to map and makes marker clickable
 * clicking the marker opens a message box.
 * @param map is always map, which is created with initMap() function
 * @param latLng Latitude and longitude to place marker somewhere
 * @param customTitle
 * @param customText
 * @param markerData
 * @param markerIndex
 */
function addMarker(
  map, latLng, customTitle, customText, markerData, markerIndex) {
  console.log('Adding marker with title:', customTitle);
  console.log('Marker Index', markerIndex);
  const navButtonId = `navigationButton_${markerIndex}`;

  // Create a new infoWindowContent for each marker
  const customInfoWindow = `
    <div class="custom-infoWindow">
        <h2 id="customInfoWindowTitle">${markerData[2]}</h2>
        <p id="customInfoWindowText">Auto on paikalla ${markerData[3]}</p>
        <p id="customInfoWindowText">${markerData[4]}</p>
        <p id="customInfoWindowText">${markerData[6] + ', ' + markerData[5]}</p>
        <button  id="${navButtonId}" type="button">Navigate</button>
    </div>`;

  let infoWindow = new google.maps.InfoWindow({
    content: customInfoWindow,
  });

  let marker = new google.maps.Marker({
    map: map,
    position: latLng,
    title: 'New Marker',
    icon: '',
  });

  marker.markerData = markerData || [];

  // Add click event listener for opening the info window
  marker.addListener('click', function() {
    if (currentInfoWindow) {
      currentInfoWindow.close();

    }
    infoWindow.open(map, marker);
    console.log('Marker Index', markerIndex);

    currentInfoWindow = infoWindow;
    infoWindowOpen = true;
    const zoomIn = 15;
    map.setZoom(zoomIn);
    map.setCenter(marker.getPosition());

    const sourceCoords = markerData[11];
    const separateCoords = sourceCoords.split(',');
    let separateSource = [];
    if (separateCoords.length === 2) {
      separateSource = [
        parseFloat(separateCoords[0]),
        parseFloat(separateCoords[1])];
    }

    console.log('Source Coordinates (EPSG:3879):', separateSource);
    //let markerButton = document.getElementById("navigationButton_15");


    const targetCoords = proj4('EPSG:3879', 'EPSG:4326', separateSource);

    console.log('Target Coordinates', targetCoords);
    console.log(navButtonId, 'Nav button ID');
  });

  if(markerData[6] === "Helsinki"){
    let helsinkiList = document.getElementById("actual-list-helsinki");
    let child = document.createElement("p")
    child.id = "helsinkiData1"
    child.textContent = markerData[2] + "  |  " + markerData[3] + "  |  " + markerData[4]
    helsinkiList.appendChild(child)
  }
  if(markerData[6] === "Vantaa"){
    let helsinkiList = document.getElementById("actual-list-vantaa");
    let child = document.createElement("p")
    child.id = "vantaaData1"
    child.textContent = markerData[2] + "  |  " + markerData[3] + "  |  " + markerData[4]
    helsinkiList.appendChild(child)
  }
  if(markerData[6] === "Kirkkonummi"){
    let helsinkiList = document.getElementById("actual-list-kirkkonummi");
    let child = document.createElement("p")
    child.id = "kirkkonummiData1"
    child.textContent = markerData[2] + "  |  " + markerData[3] + "  |  " + markerData[4]
    helsinkiList.appendChild(child)
  }
  if(markerData[6] === "Espoo"){
    let helsinkiList = document.getElementById("actual-list-espoo");
    let child = document.createElement("p")
    child.id = "espooData1"
    child.textContent = markerData[2] + "  |  " + markerData[3] + "  |  " + markerData[4]
    helsinkiList.appendChild(child)
  }

  return marker;
}

/**
 * Error handler
 * @param error
 */
function handleLocationError(error) {
  switch (error.code) {
    case 1:
      console.error('Permission to access location was denied by the user.');
      break;
    case 2:
      console.error('The user\'s location information is unavailable.');
      break;
    case 3:
      console.error('The request to get the user\'s location timed out.');
      break;
    default:
      console.error('An unknown error occurred.');
  }
}

/**
 * Filters markers to show only from certain date
 */

function filterMarkersByDate(targetDate) {
  if (event.cancelable) event.preventDefault();
  googleMarkers.forEach((marker) => {
    if (marker.markerData[2] === targetDate) {
      marker.setVisible(true);
    } else {
      marker.setVisible(false);
    }
  });
}

function testButtonClick() {
  const date = new Date();

  let day = date.getDate();
  let month = date.getMonth() + 1;
  let year = date.getFullYear();

  // Format the current date to match the date format in your marker data (e.g., '03.04.2023')
  let currentDate = `${day}.${month}.${year}`;
  let testDate = '10.05.2023';
  // Call the filterMarkersByDate function with the currentDate as the target date
  filterMarkersByDate(testDate);
}

/**
 * sets all markers visible
 */
function removeFilters() {
  googleMarkers.forEach((marker) => {
    marker.setVisible(true);
  });
}

/**
 * Calculates distance between two long and lat coordinates
 * Used for filtering of markers, to show only markers that are x-meters away from the users location
 * @param lat1
 * @param lon1
 * @param lat2
 * @param lon2
 * @returns {number}
 */
function calculateDistance(lat1, lon1, lat2, lon2) {
  const R = 6371; // Radius of the Earth in kilometers
  const dLat = (lat2 - lat1) * (Math.PI / 180);
  const dLon = (lon2 - lon1) * (Math.PI / 180);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * (Math.PI / 180)) *
    Math.cos(lat2 * (Math.PI / 180)) *
    Math.sin(dLon / 2) *
    Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  const distance = R * c; // Distance in kilometers
  return distance * 1000; // Convert to meters
}

//Testing purpose maxDistance for filtering markers
const maxDistance = 4000;

function filterMarkersByDistance() {
  if (event.cancelable) event.preventDefault();
  const userLatLng = new google.maps.LatLng(myLat, myLong); // Your current location
  googleMarkers.forEach((marker) => {
    const markerLatLng = marker.getPosition();
    const distance = google.maps.geometry.spherical.computeDistanceBetween(
      userLatLng,
      markerLatLng,
    );

    if (distance <= maxDistance) {
      marker.setVisible(true); // Show the marker
    } else {
      marker.setVisible(false); // Hide the marker
    }
  });
}

/**
 * Shows markers that have title of '10.05.2023' = targetdate variable
 * draws route from first to last stop through waypoints aka. all the markers between first and last
 */
function calcRoute() {
  const directionsService = new google.maps.DirectionsService();
  let directionsDisplay = new google.maps.DirectionsRenderer();
  const directionsRenderer = new google.maps.DirectionsRenderer({map: map});
  const markkerit = [];
  const targetDate = '10.05.2023';

  googleMarkers.forEach((marker) => {
    if (marker.markerData[2] === targetDate) {
      marker.setVisible(true);
      markkerit.push(marker);
    } else {
      marker.setVisible(false);
    }
  });
  console.log(markkerit[1].markerData[11][1], 'Markkerit');
  let endpoint = googleMarkers[150].markerData[11];
  console.log('Endpoint', endpoint[1]);
  const waypoints = [];

  // Add waypoints to the array
  for (let i = 1; i < markkerit.length - 1; i++) {
    waypoints.push({
      location: {
        lat: markkerit[i].markerData[11][1],
        lng: markkerit[i].markerData[11][0],
      },
      stopover: true, // Indicates that this waypoint is a stop
    });
  }

  const invisibleMarkers = []; // An array to store invisible markers

// Create invisible markers for waypoints
  for (let i = 1; i < markkerit.length - 1; i++) { // Exclude the first and last markers
    const waypoint = new google.maps.Marker({
      position: {
        lat: markkerit[i].markerData[11][1],
        lng: markkerit[i].markerData[11][0],
      },
      map: null, // Set the map property to null to hide the marker
      visible: false, // Hide the marker
    });
    invisibleMarkers.push(waypoint); // Add the marker to the array
  }

  directionsDisplay.setMap(map);
  const request = {
    origin: {
      lat: markkerit[0].markerData[11][1],
      lng: markkerit[0].markerData[11][0],
    }, // Replace with actual origin coordinates
    destination: {
      lat: markkerit[markkerit.length - 1].markerData[11][1],
      lng: markkerit[markkerit.length - 1].markerData[11][0],
    }, // Replace with actual destination coordinates
    waypoints: invisibleMarkers.map((marker) => ({
      location: marker.getPosition(),
      stopover: false,
    })),
    travelMode: google.maps.TravelMode.DRIVING, // You can also use 'WALKING', 'BICYCLING', or 'TRANSIT'
  };

  directionsService.route(request, function(result, status) {
    if (status === google.maps.DirectionsStatus.OK) {
      directionsDisplay.setDirections(result);
      directionsDisplay.setMap(map);
    } else {
      console.error('Directions request failed:', status);
    }
  });
}

function navigateToMarker(marker, map) {
  const directionsService = new google.maps.DirectionsService();
  const directionsRenderer = new google.maps.DirectionsRenderer();

  // Set the map for the DirectionsRenderer
  directionsRenderer.setMap(map);

  const userLocation = new google.maps.LatLng(myLat, myLong); // Replace with your current location

  const request = {
    origin: userLocation,
    destination: marker.getPosition(),
    travelMode: google.maps.TravelMode.DRIVING, // You can change this to other modes like walking or bicycling
  };

  directionsService.route(request, function(response, status) {
    if (status === 'OK') {
      // Display the route on the map
      directionsRenderer.setDirections(response);
      console.log('Directions request successful:', response);
    } else {
      console.error('Directions request failed:', status);
    }
  });
}

/**
 * Function and event listener for button that switch between map and list
 */
function hideMap() {
  let map = document.getElementById("map");
  let stops = document.getElementById("list-of-stops")
  let filterbut = document.getElementById('filter-map-button-container');
  let mapOrListBut = document.getElementById("map-or-list-button");
  if (mapOrListBut.style.bottom === "-2%"){
    mapOrListBut.style.bottom = "10%"
  } else {
    mapOrListBut.style.bottom = "-2%"
  }

  map.classList.toggle('hidden-element');
  stops.classList.toggle('hidden-element');
  filterbut.classList.toggle('hidden-element');
  console.log("map hidden/shown")
}

let switchBtwnListAndMap = document.getElementById("map-or-list-button");
switchBtwnListAndMap.addEventListener("click", hideMap);


let helsinkiShow = false
let vantaaShow = false
let kirkkonummiShow = false
let espooShow = false


function expandEspooList() {
  let espoo = document.getElementById("espoon-pysahdyspaikat")
  let espooicon = document.getElementById("icon-espoo")
  let espooiconminus = document.getElementById("icon-espoo-minus")
  let list = document.getElementById("actual-list-espoo")
  espooShow = true
  espooicon.classList.toggle('hidden-element')
  espooiconminus.classList.toggle('hidden-element')
  espoo.style.height = "300px";
  list.style.visibility = "visible"
  espoo.style.overflowY = "scroll"


}

function shrinkEspooList(){
  let espoo = document.getElementById("espoon-pysahdyspaikat")
  let espooicon = document.getElementById("icon-espoo")
  let espooiconminus = document.getElementById("icon-espoo-minus")
  let list = document.getElementById("actual-list-espoo")
  espooShow = false
  espooicon.classList.toggle('hidden-element')
  espooiconminus.classList.toggle('hidden-element')
  espoo.style.height = "11%"
  list.style.visibility = "hidden"
  espoo.style.overflowY = "hidden"

}





function expandHelsinkiList() {
  let espoo = document.getElementById("helsingin-pysahdyspaikat")
  let espooicon = document.getElementById("icon-helsinki")
  let espooiconminus = document.getElementById("icon-helsinki-minus")
  let list = document.getElementById("actual-list-helsinki")
  helsinkiShow = true
  espooicon.classList.toggle('hidden-element')
  espooiconminus.classList.toggle('hidden-element')
  espoo.style.height = "300px";
  list.style.visibility = "visible"
  espoo.style.overflowY = "scroll"


}

function shrinkHelsinkiList(){
  let espoo = document.getElementById("helsingin-pysahdyspaikat")
  let espooicon = document.getElementById("icon-helsinki")
  let espooiconminus = document.getElementById("icon-helsinki-minus")
  let list = document.getElementById("actual-list-helsinki")
  helsinkiShow = false
  espooicon.classList.toggle('hidden-element')
  espooiconminus.classList.toggle('hidden-element')
  espoo.style.height = "11%"
  list.style.visibility = "hidden"
  espoo.style.overflowY = "hidden"

}

function expandVantaaList() {
  let espoo = document.getElementById("vantaan-pysahdyspaikat")
  let espooicon = document.getElementById("icon-vantaa")
  let espooiconminus = document.getElementById("icon-vantaa-minus")
  let list = document.getElementById("actual-list-vantaa")
  vantaaShow = true
  espooicon.classList.toggle('hidden-element')
  espooiconminus.classList.toggle('hidden-element')
  espoo.style.height = "300px";
  espoo.style.overflowY = "scroll"
  list.style.visibility = "visible"
  espoo.style.overflowY = "scroll"

}

function shrinkVantaaList(){
  let espoo = document.getElementById("vantaan-pysahdyspaikat")
  let espooicon = document.getElementById("icon-vantaa")
  let espooiconminus = document.getElementById("icon-vantaa-minus")
  let list = document.getElementById("actual-list-vantaa")
  vantaaShow = false
  espooicon.classList.toggle('hidden-element')
  espooiconminus.classList.toggle('hidden-element')
  espoo.style.height = "11%"
  espoo.style.overflowY = "hidden"
  list.style.visibility = "hidden"

}

function expandKirkkonummiList() {
  let espoo = document.getElementById("kirkkonummen-pysahdyspaikat")
  let espooicon = document.getElementById("icon-kirkkonummi")
  let espooiconminus = document.getElementById("icon-kirkkonummi-minus")
  let list = document.getElementById("actual-list-kirkkonummi")
  kirkkonummiShow = true
  espooicon.classList.toggle('hidden-element')
  espooiconminus.classList.toggle('hidden-element')
  espoo.style.height = "300px"
  list.style.visibility = "visible"
  espoo.style.overflowY = "scroll"

}

function shrinkKirkkonummiList(){
  let espoo = document.getElementById("kirkkonummen-pysahdyspaikat")
  let espooicon = document.getElementById("icon-kirkkonummi")
  let espooiconminus = document.getElementById("icon-kirkkonummi-minus")
  let list = document.getElementById("actual-list-kirkkonummi")
  kirkkonummiShow = false
  espooicon.classList.toggle('hidden-element')
  espooiconminus.classList.toggle('hidden-element')
  espoo.style.height = "11%"
  list.style.visibility = "hidden"
  espoo.style.overflowY = "hidden"

}

function closeAllButKirkkonummi(){
  if(vantaaShow === true){
    shrinkVantaaList()
  }
  if(espooShow === true){
    shrinkEspooList()
  }
  if(helsinkiShow === true){
    shrinkHelsinkiList()
  }
  expandKirkkonummiList()
}

function closeAllButEspoo(){
  if(vantaaShow === true){
    shrinkVantaaList()
  }
  if(kirkkonummiShow === true){
    shrinkKirkkonummiList()
  }
  if(helsinkiShow === true){
    shrinkHelsinkiList()
  }
  expandEspooList()
}

function closeAllButVantaa(){
  if(kirkkonummiShow === true){
    shrinkKirkkonummiList()
  }
  if(espooShow === true){
    shrinkEspooList()
  }
  if(helsinkiShow === true){
    shrinkHelsinkiList()
  }
  expandVantaaList()
}

function closeAllButHelsinki(){
  if(vantaaShow === true){
    shrinkVantaaList()
  }
  if(espooShow === true){
    shrinkEspooList()
  }
  if(kirkkonummiShow === true){
    shrinkKirkkonummiList()
  }
  expandHelsinkiList()
}

let iconKirkkonummiButton = document.getElementById('icon-kirkkonummi')
iconKirkkonummiButton.addEventListener("click", closeAllButKirkkonummi)

let iconKirkkonummiMinusButton = document.getElementById('icon-kirkkonummi-minus')
iconKirkkonummiMinusButton.addEventListener("click", shrinkKirkkonummiList)

let iconVantaaButton = document.getElementById('icon-vantaa')
iconVantaaButton.addEventListener("click", closeAllButVantaa)

let iconVantaaMinusButton = document.getElementById('icon-vantaa-minus')
iconVantaaMinusButton.addEventListener("click", shrinkVantaaList)

let iconHelsinkiButton = document.getElementById("icon-helsinki")
iconHelsinkiButton.addEventListener("click", closeAllButHelsinki)

let iconHelsinkiMinusButton = document.getElementById('icon-helsinki-minus')
iconHelsinkiMinusButton.addEventListener("click", shrinkHelsinkiList)

let iconEspooMinusButton = document.getElementById('icon-espoo-minus')
iconEspooMinusButton.addEventListener("click", shrinkEspooList)

let iconEspooButton = document.getElementById("icon-espoo");
iconEspooButton.addEventListener("click", closeAllButEspoo)





initMap();
