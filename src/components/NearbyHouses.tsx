import React, { useRef, useEffect, useState } from 'react';
import mapboxgl from 'mapbox-gl';
import * as turf from '@turf/turf';
import { Point } from 'geojson';
// import { NavigationControl } from 'mapbox-gl';

interface NearbyHousesProps {
  urlSchoolName: any;
}

// interface SelectedSchool {
//   name: string;
//   coordinates: [number, number];
//   suburb: string;
// }

export const NearbyHouses: React.FC<NearbyHousesProps> = ({  urlSchoolName }) => {
  const mapContainerRef = useRef<HTMLDivElement | null>(null);
  const [_map, setMap] = useState<mapboxgl.Map | null>(null);
  const mapRef = useRef<mapboxgl.Map | null>(null);
  const propertyMarkersRef = useRef<mapboxgl.Marker[]>([]);
  const [mapStyle, _setMapStyle] = useState<string>('mapbox://styles/mapbox/standard')

  const catchmentsRef = useRef<GeoJSON.FeatureCollection | null>(null);

  useEffect(() => {
    const mapInstance = new mapboxgl.Map({
      container: mapContainerRef.current!,
      style: mapStyle,
      center: [151.2099, -33.865143],
      zoom: 10,
      dragPan: true,
      scrollZoom: true,
      interactive: true
    });

    // Add zoom controls to bottom right
    const navigationControl = new mapboxgl.NavigationControl({
      showCompass: true, // Only show zoom controls, not compass
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

            // // Create and show popup by default for school marker
            // const schoolPopup = new mapboxgl.Popup({
            //   closeButton: true,
            //   closeOnClick: false, // Prevent closing when clicking outside
            //   offset: [0, -15],
            //   className: 'custom-popup'
            // })
            //   .setLngLat(coordinates)
            //   .setHTML(`
            //     <div style="
            //       padding: 12px 16px 8px 8px;
            //       font-family: system-ui, -apple-system, sans-serif;
            //     ">
            //       <div style="
            //         font-size: 14px;
            //         font-weight: semibold;
            //         color: #000000;
            //       ">${schoolName}</div>
            //     </div>
            //   `)
            //   .addTo(mapInstance);
            
            // el.addEventListener("click", (e) => {
            //   e.stopPropagation();
            //   schoolPopup.setLngLat(coordinates).addTo(mapInstance);
            // });

            // // Add marker to map
            new mapboxgl.Marker(el).setLngLat(coordinates).addTo(mapInstance);

            // Set selected school and highlight catchment
            // setSelectedSchool({ name: schoolName, coordinates, suburb });
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
            if (suburb) {
              fetchPropertiesForSuburb();
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


  const fetchPropertiesForSuburb = async () => {
    // Remove existing property markers.
    propertyMarkersRef.current.forEach(marker => marker.remove());
    propertyMarkersRef.current = [];
    try {
      const url = `https://zylalabs.com/api/1476/australia+realty+api/1221/get+properties+list?channel=buy&searchLocation=${encodeURIComponent(
        urlSchoolName?.suburb || ''
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
          const websiteLink = property.agency.website;

          
          const image1 = property.images[0];
          const image2 = property.images[1];
          const image3 = property.images[2];
          
          const image1url = image1.server + image1.uri;
          const image2url = image2.server + image2.uri;
          const image3url = image3.server + image3.uri;

          console.log("property", lng, lat);

          if (lng && lat) {
            
            const el = document.createElement("div");
            // Set the element style to show a home icon (adjust the URL or icon as needed).
            // el.style.backgroundImage = 'url("home-icon.png")';
            // el.style.background = "blue";
            el.style.backgroundColor = 'green';
            el.style.borderRadius = '50%'; // Make it a dot
            // el.style.border = "2px solid white";
            el.style.width = "24px";
            el.style.height = "24px";
            el.style.backgroundSize = "contain";
            el.style.backgroundRepeat = "no-repeat";
            el.style.cursor = "pointer";
            // Optionally, add a title or event listener.
            el.title = address.streetAddress || "Property";
            el.addEventListener("click", (e) => {
              e.stopPropagation();
              // Remove any existing popups
              document.querySelectorAll('.mapboxgl-popup').forEach(popup => {
                popup.remove();
              });
              new mapboxgl.Popup({ closeButton: true })
                .setLngLat([lng, lat])
                .setHTML(`
                  <div style="
                    padding: 0;
                    font-family: system-ui, -apple-system, sans-serif;
                    width: 320px;
                    background: white;
                    border-radius: 12px;
                    box-shadow: 0 8px 16px rgba(0,0,0,0.1), 0 2px 4px rgba(0,0,0,0.08);
                    overflow: hidden;
                    display: flex;
                  ">
                    <div style="
                      width: 40%;
                      position: relative;
                      background-size: cover;
                      background-position: center;
                      min-height: 140px;
                      background-image: url('${image1url || image2url || image3url}');
                    "></div>
                    
                    <div style="
                      width: 60%;
                      padding: 16px;
                    ">
                      <div style="
                        font-size: 10px;
                        color: #666;
                        margin-bottom: 10px;
                      ">${address.streetAddress}, ${address.suburb} ${address.state} ${address.postcode}</div>
                      
                      <div style="
                        border-top: 1px solid #eee;
                        padding-top: 8px;
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
                        <a 
                          href="${websiteLink}"
                          target="_blank"
                          style="
                            font-size: 10px;
                            color: #000000;
                            text-decoration: underline;
                            font-weight: semibold;
                          "
                        >${property.agency.name || 'Real Estate Agency'}</a>
                      </div>
                    </div>
                  </div>`)
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
      console.error("Error fetching properties for suburb:", urlSchoolName?.suburb, error);
    }
  };

  return (
    <div className="py-4">
      <h1 className="py-2 text-md font-bold tracking-tight md:text-3xl">
        Nearby Houses
      </h1>
      <p className="text-sm text-muted-foreground">
        Find out the travel time from this school to your important destinations including, work, home, train stations, shops, beaches
      </p>
      
      <div className="mt-6 w-full" style={{ height: '500px' }}>
        <div
          ref={mapContainerRef}
          className="w-full h-full rounded-lg overflow-hidden border border-gray-200"
        />
      </div>
    </div>
  );
}; 