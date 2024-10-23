const apiKey = "pCKjhiDCnrgyjAqbqaeEMeJYmenJGWz6";
const TRAFFIC_INCIDENTS_STYLE = "s0";
const TRAFFIC_FLOW_STYLE = "2/flow_relative-light";

var map = tt.map({
  key: apiKey,
  container: "map",
  center: [77.5946, 12.9999],
  zoom: 14,
  style:
    "https://api.tomtom.com/style/1/style/22.2.1-*?map=2/basic_street-light&traffic_incidents=incidents_" +
    TRAFFIC_INCIDENTS_STYLE +
    "&poi=2/poi_light&traffic_flow=" +
    TRAFFIC_FLOW_STYLE,
  stylesVisibility: {
    trafficIncidents: true,
    trafficFlow: true,
  },
});

const setLocation = (lat, lon, loc_name) => {
  map.setCenter([lon, lat]);
  document.getElementsByClassName("loc-btn")[0].innerHTML = loc_name;
};

map.on("load", function () {
  map.showTrafficFlow();
});

var markers = [];

const RemoveAllMarkers = () => {
  markers.forEach((marker) => {
    marker.remove();
  });
  markers = [];
};

const hideHeatmapLayer = () => {
  if (map.getLayer("heatmap")) {
    map.setLayoutProperty("heatmap", "visibility", "none");
  }
};

const showHeatmapLayer = () => {
  if (map.getLayer("heatmap")) {
    map.setLayoutProperty("heatmap", "visibility", "visible");
  }
};

const BlackSpotLocations = async () => {
  Papa.parse("AccidentsBig.csv", {
    download: true,
    header: false,
    dynamicTyping: true,
    complete: (results) => {
      results.data.shift();
      results.data.forEach((row) => {
        if (!isNaN(row[1]) && !isNaN(row[2])) {
          const data = `Lat: ${row[2]}, Lon: ${row[1]}
                      <br>Accident Severity: ${accident_severity[row[4]]}
                      <br>Number of Vehicles: ${row[5]}
                      <br>Number of Casualties: ${row[6]}
                      <br>Day of Week: ${row[7]}
                      <br>Date: ${row[29]}
                      <br>Time: ${row[8]}
                      <br>Speed Limit: ${row[14]}
                      <br>Weather Conditions: ${weatherConditions[row[22]]}
                      <br>Light Conditions: ${lightConditions[row[21]]}
                  `;
          const marker = new tt.Marker()
            .setLngLat([row[1], row[2]])
            .addTo(map)
            .setPopup(new tt.Popup().setHTML(data));
          markers.push(marker);
          marker._element.addEventListener("click", () => {
            document.getElementsByClassName("in-btn")[0].disabled = false;
            currentMarkerData = {
              severity: accident_severity[row[4]],
              vehicles: row[5],
              casualties: row[6],
              dayOfWeek: row[7],
              date: row[29],
              time: row[8],
              speedLimit: row[14],
              weatherConditions: weatherConditions[row[22]],
              lightConditions: lightConditions[row[21]],
            };
          });
        } else {
          console.error("Invalid data: ", row);
        }
      });
    },
  });
};

const weatherConditions = {
  0: "Sunny",
  1: "Partly Cloudy",
  2: "Cloudy",
  3: "Rainy",
  4: "Stormy",
};

const lightConditions = {
  0: "Bright",
  1: "Normal",
  2: "Dim",
  3: "Dark",
  4: "Very Dark",
};

const accident_severity = {
  1: "Slight",
  2: "Serious",
  3: "Fatal",
};

// Heatmap for blackspots
Papa.parse("AccidentsBig.csv", {
  download: true,
  header: true,
  complete: function (results) {
    var data = results.data;

    var heatmapData = {
      type: "FeatureCollection",
      features: data.map(function (point) {
        return {
          geometry: {
            type: "Point",
            coordinates: [point.longitude, point.latitude],
            intensity: point.accident_severity,
          },
          properties: {},
        };
      }),
    };

    map.on("load", function () {
      map.addLayer({
        id: "heatmap",
        type: "heatmap",
        source: {
          type: "geojson",
          data: heatmapData,
        },
        paint: {
          "heatmap-intensity": 3,
          "heatmap-radius": 20,
          "heatmap-opacity": 0.5,
        },
      });
    });
  },
});

//BlackSpotLocations();
showHeatmapLayer();
RemoveAllMarkers();

// Accident Data List
var displayedIncidentsData = [],
  formatters = Formatters;
var iconsMapping = {
  0: "danger",
  1: "accident",
  2: "fog",
  3: "danger",
  4: "rain",
  5: "ice",
  6: "incident",
  7: "laneclosed",
  8: "roadclosed",
  9: "roadworks",
  10: "wind",
  11: "flooding",
  14: "brokendownvehicle",
};
var incidentSeverity = {
  0: "unknown",
  1: "minor",
  2: "moderate",
  3: "major",
  4: "undefined",
};
var incidentsData = {};
var incidentsMarkers = null,
  results = document.querySelector(".js-results"),
  selectedClass = "-selected",
  selectedIncidentId = "",
  sortDirection,
  sortedByValue;
new SidePanel(".tt-side-panel", map).toggleSidePanel();
map.on("load", function () {
  new IncidentsDetailsManager(map, tt.services, {
    key: apiKey,
    incidentMarkerFactory: function () {
      return new IncidentMarker({
        iconsMapping: iconsMapping,
        incidentSeverity: incidentSeverity,
        onSelected: makeResultItemSelected,
      });
    },
    style: TRAFFIC_INCIDENTS_STYLE,
    onDetailsUpdated: function (data) {
      incidentsMarkers = data.markers;
      incidentsData = convertToGeoJson(data.trafficIncidents);
      createIncidentHeader();
      displayedIncidentsData = createDisplayedIncidentsData();
      createIncidentsList(false);
    },
  });
});
function compareIncidentCategory(a, b) {
  var firstValue = a.properties[sortedByValue],
    secondValue = b.properties[sortedByValue],
    modifier = sortDirection === "asc" ? 1 : -1;
  if (typeof firstValue === "string") {
    return modifier * firstValue.localeCompare(secondValue);
  }
  return modifier * (firstValue - secondValue);
}
function convertToGeoJson(data) {
  return data.incidents.reduce(function (result, feature) {
    var current = {};
    feature.geometry.type = "Point";
    feature.geometry.coordinates = feature.geometry.coordinates[0];
    current[feature.properties.id] = feature;
    return Object.assign(result, current);
  }, {});
}
function createDisplayedIncidentsData() {
  var array = [];
  for (var incidentId in incidentsData) {
    var incident = incidentsData[incidentId],
      properties = incident.properties;
    if (!properties.delay) {
      properties.delay = 0;
    }
    array.push(incident);
  }
  if (sortedByValue && sortDirection) {
    array.sort(compareIncidentCategory);
  }
  return array;
}
function createIncidentDetailsContent(properties) {
  var incidentDetailsElement = DomHelpers.elementFactory("div", "");
  incidentDetailsElement.innerHTML =
    '<div class="tt-incidents-details">' +
    '<div class="tt-traffic-icon -details">' +
    '<div class="tt-icon-circle-' +
    incidentSeverity[properties.magnitudeOfDelay] +
    ' -small">' +
    '<div class="tt-icon-' +
    iconsMapping[properties.iconCategory] +
    '"></div>' +
    "</div>" +
    "</div>" +
    "<div>" +
    (properties.roadNumbers
      ? "<b>" + separateRoadNumbers(properties.roadNumbers) + "</b>"
      : "") +
    "<div>" +
    properties.from +
    "</div>" +
    "<div>" +
    properties.to +
    "</div>" +
    "<div>" +
    "</div>";
  return incidentDetailsElement;
}
function separateRoadNumbers(roadNumbers) {
  return roadNumbers.length > 1 ? roadNumbers.join(" - ") : roadNumbers;
}
function createIncidentHeader() {
  var headerNames = [
      {
        text: "Incident",
        attribute: "from",
      },
      {
        text: "Delay",
        attribute: "delay",
      },
      {
        text: "Length",
        attribute: "length",
      },
    ],
    incidentHeader = document.querySelector(".tt-side-panel__header");
  incidentHeader.innerHTML = "";
  headerNames.forEach(function (headerName) {
    var headerElement = DomHelpers.elementFactory("div", ""),
      sortIcon =
        headerName.attribute === sortedByValue
          ? sortDirection === "asc"
            ? '<span class="tt-button -sortable">' +
              '<span class="tt-icon -sort -brown"></span>' +
              "</span>"
            : '<span class="tt-button -sortable">' +
              '<span class="tt-icon -sort -brown -desc"></span>' +
              "</span>"
          : '<span class="tt-button -sortable">' +
            '<span class="tt-icon -sort"></span>' +
            "</span>";
    headerElement.innerHTML = headerName.text + sortIcon;
    headerElement.setAttribute("data-sort", headerName.attribute);
    headerElement.addEventListener("click", handleIncidentsSort);
    incidentHeader.appendChild(headerElement);
  });
}
function createIncidentItemRow(markerData) {
  var properties = markerData.properties,
    delaySeconds = properties.delay,
    lengthMeters = properties.length;
  var incidentDelay = DomHelpers.elementFactory(
      "div",
      "",
      formatters.formatToDurationTimeString(delaySeconds)
    ),
    incidentLength = DomHelpers.elementFactory(
      "div",
      "",
      formatters.formatAsMetricDistance(lengthMeters)
    ),
    incidentDetailsContent = createIncidentDetailsContent(properties),
    incidentsListItem = DomHelpers.elementFactory(
      "div",
      "tt-incidents-list__item"
    );
  incidentsListItem.setAttribute("data-id", properties.id);
  incidentsListItem.appendChild(incidentDetailsContent);
  incidentsListItem.appendChild(incidentDelay);
  incidentsListItem.appendChild(incidentLength);
  return incidentsListItem;
}
function createIncidentsList(isSorted) {
  results.innerHTML = "";
  if (!displayedIncidentsData.length) {
    var placeholder = DomHelpers.elementFactory(
      "div",
      "tt-overflow__placeholder -small",
      "No data for this view, try to move or zoom..."
    );
    results.appendChild(placeholder);
    return;
  }
  var incidentsList = DomHelpers.elementFactory("div", "tt-incidents-list");
  displayedIncidentsData.forEach(function (markerData) {
    var incidentsItemRow = createIncidentItemRow(markerData);
    incidentsList.appendChild(incidentsItemRow);
  });
  incidentsList.addEventListener("click", handleResultItemClick);
  results.appendChild(incidentsList);
  var selectedIncidentElement = document.querySelector(
    'div[data-id="' + selectedIncidentId + '"]'
  );
  if (selectedIncidentId && selectedIncidentElement) {
    selectedIncidentElement.classList.add(selectedClass);
  } else {
    selectedIncidentId = "";
  }
  if (isSorted) {
    document.querySelector(".js-results").scrollTop = 0;
  }
}
function findParentNodeId(element, dataId) {
  if (element.getAttribute(dataId)) {
    return element.getAttribute(dataId);
  }
  while (element.parentNode) {
    element = element.parentNode;
    if (element.getAttribute(dataId)) {
      return element.getAttribute(dataId);
    }
  }
  return null;
}
function handleIncidentsSort(event) {
  var actualMarkersData = displayedIncidentsData,
    sortProperty = event.currentTarget.getAttribute("data-sort");
  sortDirection =
    sortedByValue === sortProperty
      ? !sortDirection || sortDirection === "desc"
        ? "asc"
        : "desc"
      : "asc";
  sortedByValue = sortProperty;
  displayedIncidentsData = actualMarkersData.sort(compareIncidentCategory);
  createIncidentHeader();
  createIncidentsList(true);
}
function handleResultItemClick(event) {
  var target = event.target,
    markerId = findParentNodeId(target, "data-id"),
    selectedIncidentElementClassList = document.querySelector(
      'div[data-id="' + markerId + '"]'
    ).classList;
  if (selectedIncidentElementClassList.contains(selectedClass)) {
    return;
  }
  for (var marker in incidentsMarkers) {
    var currentMarker = incidentsMarkers[marker];
    if (currentMarker.getPopup().isOpen()) {
      currentMarker.togglePopup();
    }
  }
  var selectedMarker = incidentsMarkers[markerId];
  if (!selectedMarker.getPopup().isOpen()) {
    selectedMarker.togglePopup();
  }
  selectedMarker.getPopup().once("close", function () {
    document
      .querySelector('div[data-id="' + markerId + '"]')
      .classList.remove(selectedClass);
    selectedIncidentId = "";
  });
}
function makeResultItemSelected(markerId) {
  var selectedIncidentElementClassList = document.querySelector(
      'div[data-id="' + markerId + '"]'
    ).classList,
    selectedMarker = incidentsMarkers[markerId],
    offsetY = Math.floor(
      selectedMarker.getPopup().getElement().getBoundingClientRect().height *
        0.5
    );
  selectedIncidentId = markerId;
  map.flyTo({
    center: incidentsMarkers[markerId].getLngLat(),
    offset: [0, offsetY],
    speed: 0.5,
  });
  [].slice
    .call(document.querySelectorAll(".tt-incidents-list__item"))
    .forEach(function (DOMElement) {
      DOMElement.classList.remove(selectedClass);
    });
  selectedIncidentElementClassList.add(selectedClass);
}
