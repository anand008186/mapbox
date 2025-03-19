import React, { useEffect, useRef, useState } from "react";
import mapboxgl from "mapbox-gl";
import * as turf from "@turf/turf";
import {  Point } from "geojson";
import "mapbox-gl/dist/mapbox-gl.css";
import { Card, CardContent, CardHeader, CardTitle } from "./ui/Card";
import { MapPin, Satellite } from "lucide-react";
import { Button } from "./ui/Button";
import { Input } from "./ui/Input";
import { cn } from "./lib/utils";

mapboxgl.accessToken = import.meta.env.VITE_MAPBOX_ACCESS_TOKEN!;

interface SelectedSchool {
  name: string;
  coordinates: [number, number];
  suburb?: string; // optional, if available from catchment properties
}

const App: React.FC = () => {
  const mapContainerRef = useRef<HTMLDivElement | null>(null);
  const [map, setMap] = useState<mapboxgl.Map | null>(null);
  const mapRef = useRef<mapboxgl.Map | null>(null);

  const [destinationQuery, setDestinationQuery] = useState<string>("");
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [selectedDestination, setSelectedDestination] = useState<any | null>(null);
  const [routeDetails, setRouteDetails] = useState<{ duration: string; distance: string } | null>(null);
  const [selectedSchool, setSelectedSchool] = useState<SelectedSchool | null>(null);
  const [mapStyle, setMapStyle] = useState<string>("mapbox://styles/mapbox/streets-v12");
  const [urlSchoolName, setUrlSchoolName] = useState<string | null>(null);

  // Ref to store fetched catchments GeoJSON.
  const catchmentsRef = useRef<any>(null);
  // Ref to store POI markers so we can remove them when needed.
  const poiMarkersRef = useRef<mapboxgl.Marker[]>([]);
  // New ref: property markers (home icons)
  const propertyMarkersRef = useRef<mapboxgl.Marker[]>([]);

  // Function to fetch POIs using Mapbox Geocoding API.
  const fetchPOIs = async (lng: number, lat: number) => {
    const categories = ["other schools", "day care", "shops", "train stations", "beaches"];
    // Remove existing POI markers.
    poiMarkersRef.current.forEach(marker => marker.remove());
    poiMarkersRef.current = [];
    const newMarkers: mapboxgl.Marker[] = [];
    for (const cat of categories) {
      try {
        const res = await fetch(
          `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(cat)}.json?proximity=${lat},${lng}&access_token=${mapboxgl.accessToken}`
        );
        const data = await res.json();
        // Use the first 2 results for each category.
        console.log("data", data);
        const features = data.features.slice(0, 2);
        features.forEach((feature: any) => {
          const coords = feature.geometry.coordinates;
          const el = document.createElement("div");
          // el.style.background = "blue";
          el.style.backgroundImage = 'url("home.jpg")';
          el.style.width = "20px";
          el.style.height = "20px";
          el.style.borderRadius = "50%";
          el.style.display = "flex";
          el.style.alignItems = "center";
          el.style.justifyContent = "center";
          el.style.color = "white";
          el.style.fontSize = "10px";
          el.innerText = cat.charAt(0).toUpperCase();
          const marker = new mapboxgl.Marker(el).setLngLat(coords).addTo(mapRef.current!);
          newMarkers.push(marker);
        });
      } catch (err) {
        console.error("Error fetching POIs for category", cat, err);
      }
    }
    poiMarkersRef.current = newMarkers;
    // Adjust the map bounds to include the selected school and all POI markers.
    const bounds = new mapboxgl.LngLatBounds();
    bounds.extend([lng, lat]);
    newMarkers.forEach(marker => bounds.extend(marker.getLngLat()));
    map!.fitBounds(bounds, { padding: 50 });
  };

  // Function to fetch property listings for a given suburb.
  const fetchPropertiesForSuburb = async (suburb: string) => {
    // Remove existing property markers.
    propertyMarkersRef.current.forEach(marker => marker.remove());
    propertyMarkersRef.current = [];
    try {
      const url = `https://zylalabs.com/api/1476/australia+realty+api/1221/get+properties+list?channel=buy&searchLocation=${encodeURIComponent(
        suburb
      )}&searchLocationSubtext=Region&type=region`;
      // add auth headers
      const res = await fetch(url, {
        headers: {
          Authorization: `Bearer 7008|V7LWFcAdOjDeO8OhoW3JGX688HNT094h8we3J1Wo`,
        },
      }
      );
      const data = await res.json();
      console.log("suburb data", data);
      const  arr = data.tieredResults[0].results;
      // Assume the API returns an array of properties in data.properties.
      let i = 0;
      if (arr && Array.isArray(arr)) {
        arr.forEach((property: any) => {
          // Assuming each property has longitude and latitude fields.
          i++;
          const address = property.address
          const lng = address.location.longitude;
          const lat = address.location.latitude;
         
          console.log("property", lng, lat);
          
          if (lng && lat) {
          
          console.log("i", i);
            const el = document.createElement("div");
            // Set the element style to show a home icon (adjust the URL or icon as needed).
            el.style.backgroundImage = 'url("home.png")';
            el.style.width = "24px";
            el.style.height = "34px";
            el.style.backgroundSize = "contain";
            el.style.backgroundRepeat = "no-repeat";
            el.style.position = "relative"; // Allow positioning of title

            // Create a title element to show the address
            const titleEl = document.createElement("div");
            titleEl.innerText = address.streetAddress || "Property";
            titleEl.style.position = "absolute";
            titleEl.style.top = "20px"; // Position below the icon
            titleEl.style.left = "-20px"; // Center the title
            titleEl.style.whiteSpace = "nowrap"; // Ensure the title is in one line
            titleEl.style.padding = "2px 5px"; // Padding around the text
            titleEl.style.borderRadius = "3px"; // Rounded corners
            titleEl.style.fontSize = "8px"; // Font size
            titleEl.style.color = "black"; // Font color
            titleEl.style.fontWeight = "bold"; // Font weight
            el.appendChild(titleEl); // Add title to the marker element

            el.addEventListener("mouseenter", () => {
              new mapboxgl.Popup({ closeButton: true })
                .setLngLat([lng, lat])
                .setHTML(`<div style="padding:5px;">${address.streetAddress || "Property"}</div>`)
                .addTo(mapRef.current!);
            });
            el.addEventListener("mouseleave", () => {
              if ((el as any).currentPopup) {
                (el as any).currentPopup.remove();
                (el as any).currentPopup = null;
              }
            });
            console.log("address", lng, lat, address);
            const marker = new mapboxgl.Marker(el).setLngLat([lng, lat]).addTo(mapRef.current!);
            propertyMarkersRef.current.push(marker);
          }
        });
      }
    } catch (error) {
      console.error("Error fetching properties for suburb:", suburb, error);
    }
  };

  // Toggle map style and fly to the selected school.
  const toggleMapStyle = () => {
    if (!map || !selectedSchool) return;
    const newStyle =
      mapStyle === "mapbox://styles/mapbox/streets-v12"
        ? "mapbox://styles/mapbox/satellite-v9"
        : "mapbox://styles/mapbox/streets-v12";
    setMapStyle(newStyle);
    map.setStyle(newStyle);
    // Wait for the style to load, then fly to the selected school.
    map.once("styledata", () => {
      map.flyTo({ center: selectedSchool.coordinates, zoom: 15 });
      // Optionally, fetch POIs for the selected school.
      fetchPOIs(selectedSchool.coordinates[0], selectedSchool.coordinates[1]);
    });
  };
// first check the school name from the url
  useEffect(() => {
    const schoolName = window.location.pathname.split("/").pop();
    if (schoolName) {
      setUrlSchoolName(schoolName);
    }else{
      //add a default school
      setUrlSchoolName("lindfield_eps");
    }
  }, []);

  useEffect(() => {
    const mapInstance = new mapboxgl.Map({
      container: mapContainerRef.current!,
      style: mapStyle,
      center: [151.2099, -33.865143],
      zoom: 10,
    });

    mapInstance.on("load", () => {
      // Fetch catchments GeoJSON.
      fetch("/geojson/catchments_primary_fixed.geojson")
        .then((response) => response.json())
        .then((data) => {
          catchmentsRef.current = data;
          // Add catchments source.
          if (!mapInstance.getSource("catchments")) {
            mapInstance.addSource("catchments", { type: "geojson", data });
          }
          // Add catchment layer.
          if (!mapInstance.getLayer("catchment-layer")) {
            mapInstance.addLayer({
              id: "catchment-layer",
              type: "fill",
              source: "catchments",
              paint: { "fill-color": "#CCCCCC", "fill-opacity": 0.3 },
            });
          }
          // Add highlighted catchments layer.
          if (!mapInstance.getLayer("highlighted-catchments")) {
            mapInstance.addLayer({
              id: "highlighted-catchments",
              type: "fill",
              source: "catchments",
              paint: { "fill-color": "#4CAF50", "fill-opacity": 0.7 },
              filter: ["in", "USE_DESC", ""],
            });
          }

          // Find the matching school feature
          const matchingFeature = data.features.find((feature: any) => {
            const schoolName = feature.properties?.USE_DESC.replace(/\s+/g, '_').toLowerCase();
            return schoolName === urlSchoolName;
          });

          if (matchingFeature) {
            const centroid = turf.centroid(matchingFeature);
            const coordinates = (centroid.geometry as Point).coordinates as [number, number];
            const schoolName = matchingFeature.properties?.USE_DESC;
            const suburb = matchingFeature.properties?.suburb || schoolName.split(" PS")[0];

            // Create marker for the selected school
            const el = document.createElement("div");
            el.className = "school-marker";
            el.style.width = "30px";
            el.style.height = "30px";
            el.style.backgroundImage = 'url("map-pin.png")';
            el.style.backgroundSize = "contain";
            el.style.backgroundRepeat = "no-repeat";
            el.style.cursor = "pointer";

            // Show popup on hover
            el.addEventListener("mouseenter", () => {
              const popup = new mapboxgl.Popup({
                closeButton: false,
                closeOnClick: false,
              })
                .setLngLat(coordinates)
                .setHTML(`<div style="padding: 5px; font-size: 14px;">${schoolName}</div>`)
                .addTo(mapInstance);
              (el as any).currentPopup = popup;
            });
            el.addEventListener("mouseleave", () => {
              if ((el as any).currentPopup) {
                (el as any).currentPopup.remove();
                (el as any).currentPopup = null;
              }
            });

            // Add marker to map
            new mapboxgl.Marker(el).setLngLat(coordinates).addTo(mapInstance);

            // Set selected school and highlight catchment
            setSelectedSchool({ name: schoolName, coordinates, suburb });
            mapInstance.setFilter("highlighted-catchments", ["==", "USE_DESC", schoolName]);

            // Zoom to the catchment
            const bounds = new mapboxgl.LngLatBounds();
            if (matchingFeature.geometry.type === "Polygon") {
              matchingFeature.geometry.coordinates[0].forEach((coord: number[]) => {
                bounds.extend(coord as [number, number]);
              });
            } else if (matchingFeature.geometry.type === "MultiPolygon") {
              matchingFeature.geometry.coordinates[0][0].forEach((coord: number[]) => {
                bounds.extend(coord as [number, number]);
              });
            }
            mapInstance.fitBounds(bounds, { padding: 50 });

            // Show popup for the school
            new mapboxgl.Popup({ closeButton: true })
              .setLngLat(coordinates)
              .setHTML(`<div style="background-color: transparent; padding: 0px 0px; font-size: 12px; font-weight: bold; color: #000000;">${schoolName}</div>`)
              .addTo(mapInstance);

            // Fetch properties for the suburb
            if (suburb) {
              fetchPropertiesForSuburb(suburb);
            }
          }

        });

      // Add route source and layer.
      if (!mapInstance.getSource("route")) {
        mapInstance.addSource("route", {
          type: "geojson",
          data: { type: "FeatureCollection", features: [] },
        });
        mapInstance.addLayer({
          id: "route-layer",
          type: "line",
          source: "route",
          layout: { "line-cap": "round", "line-join": "round" },
          paint: { "line-color": "#4264fb", "line-width": 5 },
        });
      }
    });
    setMap(mapInstance);
    mapRef.current = mapInstance;

    return () => mapInstance.remove();
  }, [mapStyle, urlSchoolName]);

  const handleSearch = async () => {
    if (destinationQuery.length < 3) return;
    const response = await fetch(
      `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(destinationQuery)}.json?access_token=${mapboxgl.accessToken}`
    );
    const data = await response.json();
    setSearchResults(data.features);
  };

  const handlePlanJourney = async () => {
    if (!selectedDestination || !selectedDestination.center) {
      alert("Please select a destination first.");
      return;
    }
    const [destLng, destLat] = selectedDestination.center;
    if (!map) {
      alert("Map is not initialized yet.");
      return;
    }
    const { lng: originLng, lat: originLat } = map.getCenter();
    try {
      const directionsResponse = await fetch(
        `https://api.mapbox.com/directions/v5/mapbox/driving/${originLng},${originLat};${destLng},${destLat}?geometries=geojson&access_token=${mapboxgl.accessToken}`
      );
      if (!directionsResponse.ok) {
        alert("Could not calculate the route. Please try another location.");
        return;
      }
      const directionsData = await directionsResponse.json();
      const route = directionsData.routes?.[0];
      if (!route) {
        alert("No routes found for the selected destination.");
        return;
      }
      // const routeSource = map.getSource("route") as mapboxgl.GeoJSONSource;
      // if (routeSource) {
      //   routeSource.setData({
      //     type: "FeatureCollection",
      //     features: [{ type: "Feature", geometry: route.geometry, properties: {} }],
      //   });
      // }
      setRouteDetails({
        duration: `${Math.round(route.duration / 60)} minutes`,
        distance: `${(route.distance / 1000).toFixed(2)} km`,
      });
      // const bounds = new mapboxgl.LngLatBounds();
      // route.geometry.coordinates.forEach((coord: number[]) => {
      //   bounds.extend(coord as [number, number]);
      // });
      // map.fitBounds(bounds, { padding: 50 });
    } catch (error) {
      alert("An error occurred while calculating the route. Please try again.");
    }
  };

  return (
    <div className="max-h-screen bg-background py-8 px-4 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-5xl p-4">
          <div className="mb-8 rounded-xl">
            <div className="m-4">
              <h1 className="text-lg font-bold tracking-tight md:text-3xl">
                Plan School Journey
              </h1>
              <p className="mt-3 text-sm text-muted-foreground">
                Find out the travel time from this school to your important destinations including work, home, train stations, shops, and beaches.
              </p>
            </div>
          </div>
          <div className="grid sm:grid-cols-2 gap-8  p-4">
            <div
              ref={mapContainerRef}
              style={{
                width: "100%",
                aspectRatio:1,
                margin: "0 auto",
                border: "1px solid #ccc",
                borderRadius: "10px",
                overflow: "hidden",
                position: "relative",
              }}
            />
            <div className="space-y-6  max-h-[500px] overflow-y-auto hide-scrollbar">
                    <div className="flex flex-col gap-4">
                      <div className="relative flex-1">
                        <Input
                          type="text"
                          placeholder="Enter a school address"
                          value={selectedSchool?.name}
                          readOnly
                          className="pl-3"
                        />
                      </div>
                      <div className="relative flex-1">
                        <Input
                          type="text"
                          placeholder="Enter destination address"
                          value={destinationQuery}
                          onChange={(e) => {
                            setDestinationQuery(e.target.value);
                            handleSearch(); // Trigger search on state change
                          }}
                          className="pl-3"
                        />
                      </div>
                    </div>
                    {searchResults.length > 0 && (
                      <div className="mt-4">
                        <ul className="space-y-2">
                          {searchResults.map((result, index) => (
                            <li key={index}>
                              <Button
                                variant="outline"
                                className={cn(
                                  "w-full text-left justify-start h-auto py-3",
                                  {
                                    "border-2 border-blue-500": selectedDestination?.id === result.id,
                                  }
                                )}
                                onClick={() => setSelectedDestination(result)}
                              >
                                <MapPin className="mr-2 h-4 w-4" />
                                {result.place_name}
                              </Button>
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
               {
                selectedDestination && (
                  <Button onClick={handlePlanJourney} className="mt-4 w-full sm:w-auto bg-[#147781] hover:bg-[#147781]/90 text-white">
                    Show Distance and Time
                  </Button>
                )
               }
                {routeDetails && (
                    <div className="">
                    <div className=" space-x-2">
                      <span >Travel Time: </span>
                    </div>
                    <div className="mt-2">
                      <span className="font-semibold text-2xl ">{routeDetails.duration}, {routeDetails.distance}</span>
                    </div>
                  </div>
                )}
                {selectedSchool && (
                  <Card>
                    <CardHeader>
                      <CardTitle>Points of Interest in Catchment</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <p className="text-muted-foreground mb-4">
                        See nearby areas of interest such as other schools, day care, shops, train stations, and beaches.
                      </p>
                      <Button onClick={toggleMapStyle} variant="outline" className="w-full sm:w-auto">
                        <Satellite className="mr-2 h-4 w-4" />
                        Toggle Street / Satellite View
                      </Button>
                    </CardContent>
                  </Card>
                )}
              </div>
          </div>
      
      </div>
    </div>
  );
};

export default App;
