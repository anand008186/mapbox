import React, { useEffect, useRef, useState } from "react";
import mapboxgl from "mapbox-gl";
import * as turf from "@turf/turf";
import { Point } from "geojson";
import "mapbox-gl/dist/mapbox-gl.css";
import { MapPin } from "lucide-react";
import { Button } from "../ui/Button";
import { Input } from "../ui/Input";
import { cn } from "../lib/utils";

// Add custom styles for popups
const popupStyles = `
  .mapboxgl-popup {
    max-width: 300px !important;
  }
  
  .mapboxgl-popup-content {
    padding: 0 !important;
    border-radius: 8px !important;
    box-shadow: 0 2px 4px rgba(0,0,0,0.1) !important;
  }
  
  .mapboxgl-popup-close-button {
    padding: 2px 4px !important;
    font-size: 16px !important;
    color: #666 !important;
    background: transparent !important;
    border: none !important;
    cursor: pointer !important;
    transition: color 0.2s !important;
    outline: none !important;
  }
  
  .mapboxgl-popup-close-button:hover {
    color: #000 !important;
  }
  
  .custom-popup .mapboxgl-popup-tip {
    display: none !important;
  }
`;

// Add the styles to the document
const styleSheet = document.createElement("style");
styleSheet.textContent = popupStyles;
document.head.appendChild(styleSheet);

mapboxgl.accessToken = import.meta.env.VITE_MAPBOX_ACCESS_TOKEN!;

interface SelectedSchool {
  name: string;
  coordinates: [number, number];
  suburb?: string; // optional, if available from catchment properties
}

// interface RouteDetails {
//   duration: string;
//   distance: string;
// }

interface PlanJourneyProps {
    urlSchoolName: {name: string, suburb: string, lat: string, lng: string} | null;
}

const PlanJourney: React.FC<PlanJourneyProps> = ({urlSchoolName}) => {
  const mapContainerRef = useRef<HTMLDivElement | null>(null);
  const [map, setMap] = useState<mapboxgl.Map | null>(null);
  const mapRef = useRef<mapboxgl.Map | null>(null);

  const [destinationQuery, setDestinationQuery] = useState<string>("");
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [selectedDestination, setSelectedDestination] = useState<any | null>(null);
  const [routeDetails, setRouteDetails] = useState<{ duration: string; distance: string } | null>(null);
  const [selectedSchool, setSelectedSchool] = useState<SelectedSchool | null>(null);
  const [mapStyle, _setMapStyle] = useState<string>("mapbox://styles/mapbox/streets-v12");
//   const [urlSchoolName, setUrlSchoolName] = useState<{name: string, suburb: string} | null>(null);
const existingMarkerRef = useRef<mapboxgl.Marker | null>(null); // Ref to store the existing marker
  // Ref to store fetched catchments GeoJSON.
  const catchmentsRef = useRef<any>(null);

  //console.log("urlSchoolName", urlSchoolName);
  // Ref to store POI markers so we can remove them when needed.
  // const poiMarkersRef = useRef<mapboxgl.Marker[]>([]);
  // New ref: property markers (home icons)
//   const propertyMarkersRef = useRef<mapboxgl.Marker[]>([]);


  // Separate the URL parameter handling and fullscreen detection into two different effects
//   useEffect(() => {
//     try {
//       const urlParams = new URLSearchParams(window.location.search);
//       const schoolParam = urlParams.get('school');
//       const suburbParam = urlParams.get('suburb');

//       if (schoolParam) {
//         const formattedSchoolName = schoolParam
//           .toLowerCase()
//           .replace('public-school', 'ps')
//           .replace(/-/g, '_');

//         setUrlSchoolName({
//           name: formattedSchoolName,
//           suburb: suburbParam || ''
//         });
//       } else {
//         setUrlSchoolName({
//           name: 'oakville_ps',
//           suburb: '2765'
//         });
//       }
//     } catch (error) {
//       console.error("Error parsing URL parameters:", error);
//       setUrlSchoolName({
//         name: 'oakville_ps',
//         suburb: '2765'
//       });
//     }
//   }, []); // Empty dependency array as this should only run once on mount

  // Function to fetch POIs using Mapbox Geocoding API.
  // const fetchPOIs = async (lng: number, lat: number) => {
  //   const categories = ["other schools", "day care", "shops", "train stations", "beaches"];
  //   // Remove existing POI markers.
  //   poiMarkersRef.current.forEach(marker => marker.remove());
  //   poiMarkersRef.current = [];
  //   const newMarkers: mapboxgl.Marker[] = [];
  //   for (const cat of categories) {
  //     try {
  //       const res = await fetch(
  //         `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(cat)}.json?proximity=${lat},${lng}&access_token=${mapboxgl.accessToken}`
  //       );
  //       const data = await res.json();
  //       // Use the first 2 results for each category.
  //       console.log("data", data);
  //       const features = data.features.slice(0, 2);
  //       features.forEach((feature: any) => {
  //         const coords = feature.geometry.coordinates;
  //         const el = document.createElement("div");
  //         // el.style.background = "blue";
  //         el.style.backgroundImage = 'url("home.png")';
  //         el.style.width = "20px";
  //         el.style.height = "20px";
  //         el.style.borderRadius = "50%";
  //         el.style.display = "flex";
  //         el.style.alignItems = "center";
  //         el.style.justifyContent = "center";
  //         el.style.color = "white";
  //         el.style.fontSize = "10px";
  //         el.innerText = cat.charAt(0).toUpperCase();
  //         const marker = new mapboxgl.Marker(el).setLngLat(coords).addTo(mapRef.current!);
  //         newMarkers.push(marker);
  //       });
  //     } catch (err) {
  //       console.error("Error fetching POIs for category", cat, err);
  //     }
  //   }
  //   poiMarkersRef.current = newMarkers;
  //   // Adjust the map bounds to include the selected school and all POI markers.
  //   const bounds = new mapboxgl.LngLatBounds();
  //   bounds.extend([lng, lat]);
  //   newMarkers.forEach(marker => bounds.extend(marker.getLngLat()));
  //   map!.fitBounds(bounds, { padding: 50 });
  // };

  // Function to fetch property listings for a given suburb.
  // Function to fetch property listings for a given suburb.
 

  // Toggle map style and fly to the selected school.
  // const toggleMapStyle = () => {
  //   if (!map || !selectedSchool) return;
  //   const newStyle =
  //     mapStyle === "mapbox://styles/mapbox/streets-v12"
  //       ? "mapbox://styles/mapbox/satellite-v9"
  //       : "mapbox://styles/mapbox/streets-v12";
  //   setMapStyle(newStyle);
  //   map.setStyle(newStyle);
  //   // Wait for the style to load, then fly to the selected school.
  //   map.once("styledata", () => {
  //     map.flyTo({ center: selectedSchool.coordinates, zoom: 15 });
  //     // Optionally, fetch POIs for the selected school.
  //     fetchPOIs(selectedSchool.coordinates[0], selectedSchool.coordinates[1]);
  //   });
  // };

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

    // // Add zoom controls to bottom right
    // const navigationControl = new mapboxgl.NavigationControl({
    //   showCompass: false, // Only show zoom controls, not compass
    //   visualizePitch: false
    // });
    
    // mapInstance.addControl(navigationControl, 'bottom-right');

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
            // Add fill layer first
            mapInstance.addLayer({
              id: "catchment-layer-fill",
              type: "fill",
              source: "catchments",
              paint: { 
                "fill-color": "#CCCCCC",
                "fill-opacity": 0.05
              },
            });
            // Add line layer on top
            mapInstance.addLayer({
              id: "catchment-layer-line",
              type: "line",
              source: "catchments",
              paint: { 
                "line-color": "#CCCCCC",
                "line-width": 1,
                "line-opacity": 0.8
              },
            });
          }
          // Add highlighted catchments layer.
          if (!mapInstance.getLayer("highlighted-catchments")) {
            // Add fill layer first
            mapInstance.addLayer({
              id: "highlighted-catchments-fill",
              type: "fill",
              source: "catchments",
              paint: { 
                "fill-color": "#137780",
                "fill-opacity": 0.1
              },
              filter: ["in", "USE_DESC", ""],
            });
            // Add line layer on top
            mapInstance.addLayer({
              id: "highlighted-catchments-line",
              type: "line",
              source: "catchments",
              paint: { 
                "line-color": "#137780",
                "line-width": 3,
                "line-opacity": 1
              },
              filter: ["in", "USE_DESC", ""],
            });
          }

          // Find the matching school feature
          const matchingFeature = data.features.find((feature: any) => {
            const schoolName = feature.properties?.USE_DESC.replace(/\s+/g, '_').toLowerCase();
            return schoolName === urlSchoolName?.name;
          });
          if (matchingFeature) {
            const centroid = turf.centroid(matchingFeature);
            const coordinates = (centroid.geometry as Point).coordinates as [number, number];
            const schoolName = matchingFeature.properties?.USE_DESC;
            const suburb = urlSchoolName?.suburb || matchingFeature.properties?.suburb || schoolName.split(" PS")[0];

            // Create marker for the selected school
            const el = document.createElement("div");
            el.className = "school-marker";
            el.style.width = "30px";
            el.style.height = "30px";
            el.style.backgroundImage = 'url("map-pin.png")';
            el.style.backgroundSize = "contain";
            el.style.backgroundRepeat = "no-repeat";
            el.style.cursor = "pointer";

            // Create and show popup by default for school marker
            const schoolPopup = new mapboxgl.Popup({
              offset: [20, -25],
              className: 'custom-popup'
            })
              .setLngLat(coordinates)
              .setHTML(`
                <div style="
                 padding: 8px 20px 8px 8px;
                  font-family: system-ui, -apple-system, sans-serif;
                  border-radius: 5px;
                ">
                  <div style="
                    font-size: 14px;
                    font-weight: semibold;
                    max-width: 180px;
                    text-transform: capitalize;
                    color: #000000;
                  ">${schoolName.replace(/_/g, ' ').replace(/-/g, ' ')}</div>
                </div>
              `)
              // .addTo(mapInstance);
            
            el.addEventListener("click", (e) => {
              e.stopPropagation();
              schoolPopup.setLngLat(coordinates).addTo(mapInstance);

            });

            // // Add marker to map
            new mapboxgl.Marker(el).setLngLat(coordinates).addTo(mapInstance);

            
        //  console.log("urlSchoolName", urlSchoolName);
            // Set selected school and highlight catchment
            setSelectedSchool({ name: urlSchoolName?.name.replace(/_/g, " ").replace( 'ps','public school').toLocaleUpperCase() || schoolName, coordinates, suburb });
            mapInstance.setFilter("highlighted-catchments-fill", ["==", "USE_DESC", schoolName]);
            mapInstance.setFilter("highlighted-catchments-line", ["==", "USE_DESC", schoolName]);

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

            // Fetch properties for the suburb
            // if (suburb) {
            //   fetchPropertiesForSuburb();
            // }
          }else{

            //create marker for the school
            const el = document.createElement("div");
            el.className = "school-marker";
            el.style.width = "30px";
            el.style.height = "30px";
            el.style.backgroundImage = 'url("map-pin.png")';
            el.style.backgroundSize = "contain";
            // el.style.zIndex = "1000";
            el.style.backgroundRepeat = "no-repeat";
            el.style.cursor = "pointer";

            //create and show popup by default for school marker
            const schoolPopup = new mapboxgl.Popup({
              offset: [20, -25],
              className: 'custom-popup'
            })
              .setLngLat([parseFloat(urlSchoolName?.lng || '0'), parseFloat(urlSchoolName?.lat || '0')])
              .setHTML(`
                <div style="
                  padding: 8px 20px 8px 8px;
                  font-family: system-ui, -apple-system, sans-serif;
                  border-radius: 5px;
                ">
                  <div style="
                    font-size: 14px;
                    font-weight: semibold;
                    max-width: 180px;
                    text-transform: capitalize;
                    color: #000000;
                  ">${urlSchoolName?.name.replace(/_/g, ' ').replace(/-/g, ' ')}</div>
                </div>
              `)
              // .addTo(mapInstance);
            
            el.addEventListener("click", (e) => {
              e.stopPropagation();
              schoolPopup.setLngLat([parseFloat(urlSchoolName?.lng || '0'), parseFloat(urlSchoolName?.lat || '0')]).addTo(mapInstance);
            });

            new mapboxgl.Marker(el).setLngLat([parseFloat(urlSchoolName?.lng || '0'), parseFloat(urlSchoolName?.lat || '0')]).addTo(mapInstance);
 
            setSelectedSchool({ name: urlSchoolName?.name.replace(/_/g, " ").replace( 'ps','public school').toLocaleUpperCase() || '', coordinates: [parseFloat(urlSchoolName?.lng || '0'), parseFloat(urlSchoolName?.lat || '0')], suburb: urlSchoolName?.suburb || '' });

            mapInstance.flyTo({center: [parseFloat(urlSchoolName?.lng || '0'), parseFloat(urlSchoolName?.lat || '0')], zoom: 12, speed: 0.5 }); // Smoothly transition to the specified zoom level
            mapInstance.setCenter([parseFloat(urlSchoolName?.lng || '0'), parseFloat(urlSchoolName?.lat || '0')]);

          //  console.log("No matching feature found");
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
  }, [mapStyle, urlSchoolName, ]);

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
    setSearchResults(data.features.slice(0, 3));
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
    const { lng: originLng, lat: originLat } = {lng:selectedSchool?.coordinates[0], lat:selectedSchool?.coordinates[1]};
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
      // Remove existing destination markers from the map

      if (existingMarkerRef.current) {
        existingMarkerRef.current.remove();
        existingMarkerRef.current = null;
      }

      const startPoint = route.geometry.coordinates[route.geometry.coordinates.length - 1]; // Get the destination coordinates

      // Create a small font text element
      const labelEl = document.createElement("div");
      labelEl.textContent = selectedDestination.place_name; // Use the place name from the selected destination
      labelEl.style.fontWeight = "bold"; // Make the text bold
      labelEl.style.color = "black"; // Set the text color
      labelEl.style.backgroundColor = "white"; // Optional: background color for better visibility
      labelEl.style.padding = "2px 5px"; // Optional: padding for the label
      labelEl.style.fontSize = "12px"; // Set the font size to small
      labelEl.style.position = "absolute"; // Position it absolutely
      labelEl.style.transform = "translate(-50%, -150%)"; // Center the text above the point
      const labelMarker = new mapboxgl.Marker(labelEl) // Create a marker for the label
          .setLngLat(startPoint) // Set the position to the same as the black dot marker
          .addTo(map); // Add the label marker to the map
      existingMarkerRef.current = labelMarker;
      map.fitBounds(bounds, { padding: 50 });
    } catch (error) {
      alert("An error occurred while calculating the route. Please try again.");
    }
  };

  // Add this function after your existing state declarations
  const focusOnCatchment = () => {
    if (!mapRef.current || !catchmentsRef.current) return;

    const matchingFeature = catchmentsRef.current.features.find((feature: any) => {
      const schoolName = feature.properties?.USE_DESC.replace(/\s+/g, '_').toLowerCase();
      return schoolName === urlSchoolName?.name;
    });

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
    }else{
      mapRef.current.flyTo({center: [parseFloat(urlSchoolName?.lng || '0'), parseFloat(urlSchoolName?.lat || '0')], zoom: 12, speed: 0.5 }); // Smoothly transition to the specified zoom level
    }
  };

  // Add a useEffect to watch for routeDetails changes
  useEffect(() => {
    if (!routeDetails) {
      focusOnCatchment();
    }
  }, [routeDetails]);

  // Add this useEffect to watch for destination changes
  useEffect(() => {
    if (!selectedDestination && mapRef.current) {
      // Clear the route from the map
      const routeSource = mapRef.current.getSource("route") as mapboxgl.GeoJSONSource;
      if (routeSource) {
        routeSource.setData({
          type: "FeatureCollection",
          features: []
        });
      }
      // Clear route details
      setRouteDetails(null);
      // Refocus on catchment
      focusOnCatchment();
    }
  }, [selectedDestination]);

  return (
    <div className="h-screen bg-background">
      <div className="mx-auto max-w-5xl ">
        <div className=" rounded-xl">
          {/* <div className="m-2">
            <h1 className="text-[20px] font-[600] tracking-tight md:text-3xl">
              Plan School Journey
            </h1>
            <p className="mt-3 text-sm text-muted-foreground">
              Find out the travel time from this school to your important destinations including work, home, train stations, shops, and beaches.
            </p>
          </div> */}
        </div>
        <div className="grid grid-cols-1 gap-6 px-4">
          <div className="relative w-full h-[300px] " style={{ aspectRatio: '1/1' }}>
            <div
              ref={mapContainerRef}
              className="absolute inset-0 w-full h-full rounded-lg overflow-hidden border border-gray-200"
            />
          </div>
          <div className="space-y-6  max-h-[500px] w-full overflow-x-hidden overflow-y-auto hide-scrollbar">
            <div className="w-full flex  flex-col gap-2">
              <div className="relative flex-1">
                <Input
                  type="text"
                  placeholder="Enter a school address"
                  value={selectedSchool?.name || ""}
                  readOnly
                  className="pl-3"
                />
              </div>
              <div className=" relative flex-1">
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
              <div className="mt-4 ">
                <ul className="space-y-2 1">
                  {searchResults.map((result, index) => (
                    <li key={index} className="relative flex-1">
                      <Button
                        variant="outline"
                        className={cn(
                          "w-full text-xs flex justify-start overflow-auto hide-scrollbar h-auto py-2  relative",
                          {
                            "border-2 border-blue-500": selectedDestination?.id === result.id,
                          }


                        )}
                        onClick={() => {
                          setDestinationQuery(result.place_name);
                          setSearchResults([]);
                          setSelectedDestination(result);
                        }}
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
            {/* {selectedSchool && (
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
            )} */}
          </div>
        </div>

      </div>
    </div>
  );
};

export default PlanJourney;
