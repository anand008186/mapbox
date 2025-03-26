import React, { useEffect, useRef, useState } from "react";
import mapboxgl from "mapbox-gl";
import * as turf from "@turf/turf";
import { Point } from "geojson";
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

  // First, add a new state for fullscreen mode
  const [isFullscreen, setIsFullscreen] = useState(false);

  // Add this new ref to store initial map bounds
  const initialBoundsRef = useRef<mapboxgl.LngLatBounds | null>(null);

  useEffect(() => {
    // Check if we're on the home route
    if (window.location.pathname === '/') {
      // Redirect to the school page
      window.location.href = '/schools/oakville-public-school/';
    }
  }, []);
  
  // Completely replace the toggleFullscreen function
  const toggleFullscreen = () => {
    const newState = !isFullscreen;
    setIsFullscreen(newState);
    
    // Use setTimeout to ensure state has updated before we manipulate the DOM
    setTimeout(() => {
      if (map) {
        if (newState) {
          // Entering fullscreen
          map.dragPan.enable();
          map.scrollZoom.enable();
        } else {
          // Exiting fullscreen
          map.dragPan.disable();
          map.scrollZoom.disable();
          
          // Force the map to resize and fit properly
          if (initialBoundsRef.current) {
            map.fitBounds(initialBoundsRef.current, { padding: 50 });
          }
        }
        
        // Always resize the map after toggling fullscreen state
        map.resize();
      }
    }, 10);
  };

  // Add this useEffect to handle container size changes when fullscreen state changes
  useEffect(() => {
    if (!map) return;
    
    // Force resize and bounds reset after animation completes
    const timer = setTimeout(() => {
      map.resize();
      if (!isFullscreen && initialBoundsRef.current) {
        map.fitBounds(initialBoundsRef.current, { padding: 50 });
      }
    }, 310); // Just after the 300ms transition completes
    
    return () => clearTimeout(timer);
  }, [isFullscreen, map]);

  // first check the school name from the url
  useEffect(() => {
    console.log("window.location.pathname", window.location.pathname);
    const schoolName = window.location.pathname.split("/")[2].replace("public-school", "ps").replace(/-/g, "_");
    if (schoolName) {
      setUrlSchoolName(schoolName);
      console.log("urlschoolName", schoolName);
    } else {
      //add a default school
      setUrlSchoolName("lindfield_eps");
    }
  }, []);

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
      console.log("suburb data", data);
      const arr = data.tieredResults[0].results;
      // Assume the API returns an array of properties in data.properties.
      let i = 0;
      if (arr && Array.isArray(arr)) {
        arr.forEach((property: any) => {
          // Assuming each property has longitude and latitude fields.
          i++;
          const address = property.address
          const lng = address.location.longitude;
          const lat = address.location.latitude;
          
          const image1 = property.images[0];
          const image2 = property.images[1];
          const image3 = property.images[2];
          
          const image1url = image1.server + image1.uri;
          const image2url = image2.server + image2.uri;
          const image3url = image3.server + image3.uri;

          console.log("property", lng, lat);

          if (lng && lat) {
            const el = document.createElement("div");
            
            // Fix image path and make sure it's in the public folder
            el.style.backgroundImage = 'url("/home.png")'; // Make sure this path matches your image location
            el.style.width = "34px";
            el.style.height = "34px";
            el.style.backgroundSize = "contain";
            el.style.backgroundRepeat = "no-repeat";
            el.style.position = "relative";
            el.style.cursor = "pointer";

            // Create the marker first
            const marker = new mapboxgl.Marker(el).setLngLat([lng, lat]);

            // Create a popup but don't add it to the map yet
            const popup = new mapboxgl.Popup({
              closeButton: true,
              closeOnClick: true,
              offset: [0, -15], // Offset to position popup above the marker
              maxWidth: '300px' // Set maximum width for the popup
            })
            .setHTML(`
              <div style="
                padding: 12px;
                font-family: system-ui, -apple-system, sans-serif;
              ">
                <div style="
                  font-size: 14px;
                  margin-bottom: 12px;
                ">${address.streetAddress}, ${address.suburb} ${address.state} ${address.postcode}</div>
                
                <div style="
                  border-top: 1px solid #eee;
                  padding-top: 12px;
                  display: flex;
                  align-items: center;
                ">
                  <img 
                    src="${image1url || image2url || image3url}"
                    style="
                      height: 30px;
                      margin-right: 8px;
                      object-fit: contain;
                    "
                    alt="${property.agency.name}"
                  />
                  <div style="
                    font-size: 12px;
                    color: ${'#000000'};
                  ">${property.agency.name || 'Real Estate Agency'}</div>
                </div>
              </div>
            `);

            // Update the click handler to ensure popups are properly managed
            el.addEventListener("click", (e) => {
              e.stopPropagation();
              
              // Remove all existing popups
              document.querySelectorAll('.mapboxgl-popup').forEach(popup => popup.remove());
              
              // Add the new popup
              popup.setLngLat([lng, lat]).addTo(mapRef.current!);
            });

            // Add marker to map
            marker.addTo(mapRef.current!);
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
      dragPan: false,
      scrollZoom: false,
      interactive: false
    });

    // Add zoom controls to bottom right
    const navigationControl = new mapboxgl.NavigationControl({
      showCompass: false, // Only show zoom controls, not compass
      visualizePitch: false
    });
    
    mapInstance.addControl(navigationControl, 'bottom-right');

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
            console.log("schoolName", schoolName, urlSchoolName);
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

          // After the catchment is loaded and the bounds are set for the first time
          // Store these bounds as the initial bounds
          mapInstance.once('moveend', () => {
            initialBoundsRef.current = mapInstance.getBounds();
          });
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
    if (destinationQuery.length < 3) {
      setSearchResults([]);
      setSelectedDestination(null);
      setRouteDetails(null);
      return;
    }
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

  // Add useEffect to handle body scroll when in fullscreen
  useEffect(() => {
    if (isFullscreen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = 'auto';
    }
    return () => {
      document.body.style.overflow = 'auto';
    };
  }, [isFullscreen]);

  return (
    <div className="h-screen bg-background py-8 px-4 sm:px-6 lg:px-8">
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
        <div className="grid grid-cols-2 gap-8 p-4">
          <div className="relative w-full" style={{ aspectRatio: '1/1' }}>
            <div
              ref={mapContainerRef}
              className={cn(
                "transition-all duration-300 rounded-lg overflow-hidden border border-gray-200",
                isFullscreen 
                  ? "fixed left-0 top-0 right-0 bottom-0 z-[9999] w-screen h-screen rounded-none border-0"
                  : "absolute inset-0 w-full h-full"
              )}
              onClick={!isFullscreen ? toggleFullscreen : undefined}
            />
            {!isFullscreen && (
              <div 
                className="absolute inset-0 flex items-center justify-center bg-black/20 opacity-0 hover:opacity-100 transition-opacity duration-200 rounded-lg cursor-pointer"
                onClick={toggleFullscreen}
              >
                <div className="bg-white/90 px-4 py-2 rounded-md text-sm font-medium">
                  Click to View Fullscreen
                </div>
              </div>
            )}
            {isFullscreen && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  toggleFullscreen();
                }}
                className="fixed top-4 right-4 z-[10000] bg-white rounded-md p-2 shadow-lg hover:bg-gray-100"
              >
                <span className="sr-only">Close fullscreen</span>
                ✕
              </button>
            )}
          </div>
          <div className="space-y-6  max-h-[500px] overflow-y-auto hide-scrollbar">
            <div className="flex flex-col gap-2">
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
                          "w-full text-xs justify-start h-auto py-2 overflow-hidden relative",
                          {
                            "border-2 border-blue-500": selectedDestination?.id === result.id,
                          }
                        )}
                        onClick={() => setSelectedDestination(result)}
                      >
                        <MapPin className="absolute left-2 top-1/2 -translate-y-1/2 h-4 w-4" />
                        <span className="ml-4">{result.place_name}</span>
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
                  <CardTitle className="text-sm p-0">Points of Interest in Catchment</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-muted-foreground text-xs mb-4">
                    See nearby areas of interest such as other schools, day care, shops, train stations, and beaches.
                  </p>
                  <Button onClick={toggleMapStyle} variant="outline" className="w-full sm:w-auto">
                    <Satellite className="mr-2 h-4 w-4" />
                    <span className="text-xs">Toggle Street / Satellite View</span>
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
