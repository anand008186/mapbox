import React, { useEffect, useRef, useState } from "react";
import mapboxgl from "mapbox-gl";
import * as turf from "@turf/turf";
import { FeatureCollection, Geometry, Point } from "geojson";
import "mapbox-gl/dist/mapbox-gl.css";
import { Card, CardContent, CardHeader, CardTitle } from "./ui/Card";
import { MapPin, Navigation, Search, Satellite } from "lucide-react";
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
  const [urlSchoolId, setUrlSchoolId] = useState<string | null>(null);

  // Ref to store fetched catchments GeoJSON.
  const catchmentsRef = useRef<any>(null);
  // Ref to store POI markers so we can remove them when needed.
  const poiMarkersRef = useRef<mapboxgl.Marker[]>([]);
  // New ref: property markers (home icons)
  const propertyMarkersRef = useRef<mapboxgl.Marker[]>([]);
  // Ref to store school centroids
  const schoolCentroidsRef = useRef<{[key: string]: {coordinates: [number, number], name: string, suburb?: string}}>({}); 

  // Parse URL parameters on component mount
  useEffect(() => {
    const searchParams = new URLSearchParams(window.location.search);
    const schoolId = searchParams.get('school');
    if (schoolId) {
      setUrlSchoolId(schoolId);
    }
  }, []);

  // Function to handle highlighting a catchment and selecting a school
  const selectSchool = (schoolName: string, coordinates: [number, number], suburb?: string) => {
    setSelectedSchool({ name: schoolName, coordinates, suburb });
    
    if (mapRef.current) {
      // Update the highlighted catchment filter
      mapRef.current.setFilter("highlighted-catchments", ["==", "USE_DESC", schoolName]);
      
      // Look up matching catchment and zoom
      if (catchmentsRef.current) {
        const matchingFeature = catchmentsRef.current.features.find(
          (f: any) => f.properties?.USE_DESC === schoolName
        );
        
        if (matchingFeature) {
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
          mapRef.current.fitBounds(bounds, { padding: 50 });
        }
      }
      
      // Show popup
      new mapboxgl.Popup({ closeButton: true })
        .setLngLat(coordinates)
        .setHTML(`<div style="padding: 5px; font-size: 14px;">${schoolName}</div>`)
        .addTo(mapRef.current);
      
      // Fetch property listings using the suburb value
      if (suburb) {
        fetchPropertiesForSuburb(suburb);
      }
    }
  };

  // Effect to handle URL-based school selection once map and catchments are loaded
  useEffect(() => {
    if (urlSchoolId && map && catchmentsRef.current && Object.keys(schoolCentroidsRef.current).length > 0) {
      // Find matching school by ID
      const schoolInfo = schoolCentroidsRef.current[urlSchoolId];
      
      if (schoolInfo) {
        selectSchool(schoolInfo.name, schoolInfo.coordinates, schoolInfo.suburb);
        // Optionally fetch POIs
        fetchPOIs(schoolInfo.coordinates[0], schoolInfo.coordinates[1]);
      }
    }
  }, [urlSchoolId, map, catchmentsRef.current, schoolCentroidsRef.current]);

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
          `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(cat)}.json?proximity=${lng},${lat}&access_token=${mapboxgl.accessToken}`
        );
        const data = await res.json();
        // Use the first 2 results for each category.
        const features = data.features.slice(0, 2);
        features.forEach((feature: any) => {
          const coords = feature.geometry.coordinates;
          const el = document.createElement("div");
          // el.style.background = "blue";
          el.style.backgroundImage = 'url("home.png")';
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
      const  arr = data.tieredResults[0].results;
      // Assume the API returns an array of properties in data.properties.
      if (arr && Array.isArray(arr)) {
        arr.forEach((property: any) => {
          // Assuming each property has longitude and latitude fields.
          const address = property.address
          const lng = address.location.longitude;
          const lat = address.location.latitude;
          
          if (lng && lat) {
            
            const el = document.createElement("div");
            // Set the element style to show a home icon (adjust the URL or icon as needed).
            // el.style.backgroundImage = 'url("home-icon.png")';
            // el.style.background = "blue";
            el.style.backgroundImage = 'url("home.png")';
            // el.style.border = "2px solid white";
            el.style.width = "24px";
            el.style.height = "24px";
            el.style.backgroundSize = "contain";
            el.style.backgroundRepeat = "no-repeat";
            
            // Optionally, add a title or event listener.
            el.title = address.streetAddress || "Property";
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
          // Calculate school centroids using Turf.
          const schoolCentroids: FeatureCollection<Geometry> = {
            type: "FeatureCollection",
            features: data.features.map((feature: any) => {
              const centroid = turf.centroid(feature);
              return {
                type: "Feature",
                geometry: centroid.geometry,
                properties: { USE_DESC: feature.properties?.USE_DESC, suburb: feature.properties?.suburb },
              };
            }),
          };

          // Store school centroids in ref for URL-based selection
          const centroidsMap: {[key: string]: {coordinates: [number, number], name: string, suburb?: string}} = {};

          // For each school centroid, create a Marker with event listeners.
          schoolCentroids.features.forEach((feature) => {
            const coordinates = (feature.geometry as Point).coordinates as [number, number];
            const schoolName = feature.properties?.USE_DESC;
            // Assume the suburb is available in the feature properties; fallback to schoolName.
            const suburb = feature.properties?.suburb || schoolName.split(" PS")[0];
            if (!schoolName) return;

            // Store in centroids map using school name as key (sanitized for URL)
            const schoolId = schoolName.replace(/\s+/g, '_').toLowerCase();
            centroidsMap[schoolId] = {
              coordinates,
              name: schoolName,
              suburb
            };

            // Create a DOM element for the marker.
            const el = document.createElement("div");
            el.className = "school-marker";
            el.style.width = "30px";
            el.style.height = "30px";
            el.style.backgroundImage = 'url("map-pin.png")';
            el.style.backgroundSize = "contain";
            el.style.backgroundRepeat = "no-repeat";
            el.style.cursor = "pointer";

            // Show a hover popup.
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

            // On click, zoom to the catchment, set this school as selected, and fetch properties.
            el.addEventListener("click", () => {
              // Update URL with the school ID without refreshing the page
              const url = new URL(window.location.href);
              url.searchParams.set('school', schoolId);
              window.history.pushState({}, '', url.toString());
              
              // Select school using the common function
              selectSchool(schoolName, coordinates, suburb);
            });

            new mapboxgl.Marker(el).setLngLat(coordinates).addTo(mapInstance);
          });

          // Store the centroids map for later reference
          schoolCentroidsRef.current = centroidsMap;

          // Check if URL contains a school ID and handle it
          if (urlSchoolId && centroidsMap[urlSchoolId]) {
            const { name, coordinates, suburb } = centroidsMap[urlSchoolId];
            selectSchool(name, coordinates, suburb);
            fetchPOIs(coordinates[0], coordinates[1]);
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
  }, [mapStyle, urlSchoolId]);

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
      const routeSource = map.getSource("route") as mapboxgl.GeoJSONSource;
      if (routeSource) {
        routeSource.setData({
          type: "FeatureCollection",
          features: [{ type: "Feature", geometry: route.geometry, properties: {} }],
        });
      }
      setRouteDetails({
        duration: `${Math.round(route.duration / 60)} minutes`,
        distance: `${(route.distance / 1000).toFixed(2)} km`,
      });
      const bounds = new mapboxgl.LngLatBounds();
      route.geometry.coordinates.forEach((coord: number[]) => {
        bounds.extend(coord as [number, number]);
      });
      map.fitBounds(bounds, { padding: 50 });
    } catch (error) {
      alert("An error occurred while calculating the route. Please try again.");
    }
  };

  return (
    <div className="max-h-screen bg-background py-8 px-4 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-7xl">
        <Card className="mx-auto max-w-[1200px] rounded-2xl shadow-lg">
          <div className="mb-8 rounded-xl">
            <div className="m-4">
              <h1 className="text-xl font-bold tracking-tight md:text-3xl">
                Plan School Journey
              </h1>
              <p className="mt-3 text-lg text-muted-foreground">
                Find out the travel time from this school to your important destinations including work, home, train stations, shops, and beaches.
              </p>
            </div>
          </div>
          <div className="grid lg:grid-cols-2 min-h-[600px] p-4">
            <div
              ref={mapContainerRef}
              style={{
                width: "80%",
                aspectRatio: "1/1",
                margin: "0 auto",
                border: "1px solid #ccc",
                borderRadius: "10px",
                overflow: "hidden",
                position: "relative",
              }}
            />
            {selectedSchool && (
              <div className="space-y-6 max-w-[400px] max-h-[600px] overflow-y-auto hide-scrollbar">
                  <div className="flex flex-col gap-4">
                      <div className="relative flex-1">
                        {/* <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" /> */}
                        <Input
                          type="text"
                          placeholder="Enter a school address"
                          value={selectedSchool?.name}
                          readOnly
                          className="pl-3"
                        />
                      </div>
                      <div className="relative flex-1">
                        {/* <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" /> */}
                        <Input
                          type="text"
                          placeholder="Enter destination address"
                          value={destinationQuery}
                          onChange={(e) => setDestinationQuery(e.target.value)}
                          className="pl-3"
                        />
                      </div>
                      <Button onClick={handleSearch} className="w-full sm:w-auto bg-[#147781] hover:bg-[#147781]/90 text-white">
                        See Your Travel Time
                      </Button>
                    </div>
                    {searchResults.length > 0 && (
                      <div className="mt-4">
                        <ul className="space-y-2">
                          {searchResults.map((result, index) => (
                            <li key={index}>
                              <Button
                                variant="outline"
                                className={cn(
                                  "w-full text-left justify-start h-auto py-3 overflow-x-auto whitespace-nowrap",
                                  {
                                    "border-2 border-[#147781]": selectedDestination?.id === result.id,
                                  }
                                )}
                                onClick={() => setSelectedDestination(result)}
                              >
                                <div className="flex items-center">
                                  <MapPin className="mr-2 h-4 w-4 flex-shrink-0" />
                                  <span className="text-sm">{result.place_name}</span>
                                </div>
                              </Button>
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
               {
                selectedDestination && ( <Button onClick={handlePlanJourney} className="mt-4 w-full sm:w-auto bg-[#147781] hover:bg-[#147781]/90 text-white">
                  Show Distance and Time
                </Button>
               )
               }
                {routeDetails && (
                  <Card>
                    <CardHeader>
                      <CardTitle>Journey Details</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div className="flex items-center space-x-2">
                          <Navigation className="h-4 w-4 text-muted-foreground" />
                          <span>Duration: {routeDetails.duration}</span>
                        </div>
                        <div className="flex items-center space-x-2">
                          <MapPin className="h-4 w-4 text-muted-foreground" />
                          <span>Distance: {routeDetails.distance}</span>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
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
            )}
          </div>
        </Card>
      </div>
    </div>
  );
};

export default App;
