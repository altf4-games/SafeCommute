var coordinatesD;
var coordinatesS;
var firstRide = true;

const getLocationCoordinates = async (locationName) => {
  const url = `https://api.tomtom.com/search/2/search/${encodeURIComponent(
    locationName
  )}.json?key=${apiKey}`;

  try {
    const response = await fetch(url);
    const data = await response.json();

    if (data.results && data.results.length > 0) {
      const { position } = data.results[0];
      const { lat, lon } = position;
      return { latitude: lat, longitude: lon };
    } else {
      throw new Error("Location not found");
    }
  } catch (error) {
    console.error("Error fetching location coordinates:", error);
    return null;
  }
};

let marker;

function fetchWeather(location) {
  // Replace the location with the destination (you can enhance this by geocoding later)
  const apiKey = "7d273806546e4e64aed52511242003";
  const apiUrl = `http://api.weatherapi.com/v1/current.json?key=${apiKey}&q=${location}&aqi=no`;

  fetch(apiUrl)
    .then((response) => response.json())
    .then((data) => {
      // Update the weather information in the 'weatherInfo' div
      const weatherDiv = document.getElementById("weatherInfo");
      const { location, current } = data;
      const weatherHTML = `
                <h5>Weather in ${location.name}, ${location.region}</h5>
                <p><strong>Condition:</strong> ${current.condition.text}</p>
                <p><strong>Temperature:</strong> ${current.temp_c}°C / ${current.temp_f}°F</p>
                <p><strong>Feels Like:</strong> ${current.feelslike_c}°C / ${current.feelslike_f}°F</p>
                <p><strong>Wind:</strong> ${current.wind_kph} kph (${current.wind_dir})</p>
                <p><strong>Humidity:</strong> ${current.humidity}%</p>
            `;
      weatherDiv.innerHTML = weatherHTML;
    })
    .catch((error) => {
      console.error("Error fetching weather:", error);
    });
}

async function Search() {
  if (!firstRide) {
    map.removeLayer("route");
    map.removeLayer("start");
    map.removeLayer("finish");
    map.removeSource("route");
  }
  const startLocationName = document.getElementById("fromLocation").value; // Get starting location
  const destinationLocationName = document.getElementById("toLocation").value; // Get destination location

  coordinatesS = await getLocationCoordinates(startLocationName); // Fetch coordinates for starting location
  coordinatesD = await getLocationCoordinates(destinationLocationName); // Fetch coordinates for destination location
  fetchWeather(destinationLocationName);
  if (coordinatesS && coordinatesD) {
    // Set the map center to the starting location
    map.setCenter([coordinatesS.longitude, coordinatesS.latitude]);

    // Place marker for the starting location
    new tt.Marker()
      .setLngLat([coordinatesS.longitude, coordinatesS.latitude])
      .addTo(map);

    // Place marker for the destination location
    if (marker) marker.remove();
    marker = new tt.Marker()
      .setLngLat([coordinatesD.longitude, coordinatesD.latitude])
      .addTo(map);

    showRoute(
      [coordinatesS.longitude, coordinatesS.latitude],
      [coordinatesD.longitude, coordinatesD.latitude]
    );
    firstRide = false;
  } else {
    console.log("Could not find coordinates for the specified locations.");
  }
}

map.addControl(new tt.FullscreenControl());
map.addControl(new tt.NavigationControl());

function createMarkerElement(type) {
  var element = document.createElement("div");
  var innerElement = document.createElement("div");

  element.className = "route-marker";
  innerElement.className = "icon tt-icon -white -" + type;
  element.appendChild(innerElement);
  return element;
}

function addMarkers(feature) {
  var startPoint, endPoint;
  if (feature.geometry.type === "MultiLineString") {
    startPoint = feature.geometry.coordinates[0][0];
    endPoint = feature.geometry.coordinates.slice(-1)[0].slice(-1)[0];
  } else {
    startPoint = feature.geometry.coordinates[0];
    endPoint = feature.geometry.coordinates.slice(-1)[0];
  }

  new tt.Marker({ element: createMarkerElement("start") })
    .setLngLat(startPoint)
    .addTo(map);
  new tt.Marker({ element: createMarkerElement("finish") })
    .setLngLat(endPoint)
    .addTo(map);
}

function findFirstBuildingLayerId() {
  var layers = map.getStyle().layers;
  for (var index in layers) {
    if (layers[index].type === "fill-extrusion") {
      return layers[index].id;
    }
  }

  throw new Error(
    "Map style does not contain any layer with fill-extrusion type."
  );
}

function showRoute(startCoords, endCoords) {
  if (!startCoords || !endCoords) {
    console.error("Coordinates not available.");
    return;
  }

  let loc = `${startCoords[0]},${startCoords[1]}:${endCoords[0]},${endCoords[1]}`;
  console.log(loc);
  tt.services
    .calculateRoute({
      key: apiKey,
      traffic: false,
      locations: loc,
    })
    .then(function (response) {
      var geojson = response.toGeoJson();
      console.log(geojson);
      map.addLayer(
        {
          id: "route",
          type: "line",
          source: {
            type: "geojson",
            data: geojson,
          },
          paint: {
            "line-color": "#4a90e2",
            "line-width": 8,
          },
        },
        findFirstBuildingLayerId()
      );

      addMarkers(geojson.features[0]);

      var bounds = new tt.LngLatBounds();
      geojson.features[0].geometry.coordinates.forEach(function (point) {
        bounds.extend(tt.LngLat.convert(point));
      });
      map.fitBounds(bounds, { duration: 0, padding: 50 });

      if (response.routes && response.routes[0] && response.routes[0].summary) {
        const summary = response.routes[0].summary;
        const distanceInMeters = summary.lengthInMeters;
        const distanceInKilometers = distanceInMeters / 1000;
        const travelTimeInMinutes = summary.travelTimeInSeconds / 60;
        const arrivalTime = summary.arrivalTime;

        const etaDiv = document.getElementById("etaDisplay");

        // Convert the arrival time to a more readable format using Date object
        const arrivalDate = new Date(arrivalTime);
        const arrivalHours = arrivalDate.getHours().toString().padStart(2, "0");
        const arrivalMinutes = arrivalDate
          .getMinutes()
          .toString()
          .padStart(2, "0");
        const formattedArrivalTime = `${arrivalHours}:${arrivalMinutes}`;

        // Update the ETA display div
        etaDiv.innerHTML = `
          <p><strong>Estimated Time of Arrival:</strong> ${formattedArrivalTime}</p>
          <p><strong>Total Travel Time:</strong> ${travelTimeInMinutes.toFixed(
            0
          )} minutes</p>
          <p><strong>Distance:</strong> ${distanceInKilometers.toFixed(
            2
          )} km</p>
        `;

        console.log(`Distance: ${distanceInKilometers.toFixed(2)} km`);
        console.log(
          `Time: ${response.routes[0].summary.travelTimeInSeconds} m`
        );
      } else {
        console.log("Could not calculate distance.");
      }
    });
}
