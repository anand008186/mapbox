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


interface Property {
  address: {
    streetAddress: string;
    suburb: string;
    state: string;
    postcode: string;
    location: {
      latitude: number;
      longitude: number;
    };
  };
  images: Array<{
    server: string;
    uri: string;
  }>;
  agency: {
    name: string;
    website: string;
  };
  prettyUrl: string;
  generalFeatures: {
    bedrooms: {
      value: number;
    };
    bathrooms: {
      value: number;
    };
    carSpaces: {
      value: number;
    };
  };
  price: {
    display: string;
  };
}

export const NearbyHouses: React.FC<NearbyHousesProps> = ({  urlSchoolName }) => {
  const mapContainerRef = useRef<HTMLDivElement | null>(null);
  const [_map, setMap] = useState<mapboxgl.Map | null>(null);
  const mapRef = useRef<mapboxgl.Map | null>(null);
  const propertyMarkersRef = useRef<mapboxgl.Marker[]>([]);
  const [mapStyle, _setMapStyle] = useState<string>('mapbox://styles/mapbox/standard')

  const catchmentsRef = useRef<GeoJSON.FeatureCollection | null>(null);

  // Add new state for properties
  const [properties, setProperties] = useState<Property[]>([]);

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

            // Create and show popup by default for school marker
            const schoolPopup = new mapboxgl.Popup({
              closeButton: true,
              closeOnClick: false, // Prevent closing when clicking outside
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
                    color: #000000;
                  ">${schoolName}</div>
                </div>
              `)
              .addTo(mapInstance);
            
            el.addEventListener("click", (e) => {
              e.stopPropagation();
              document.querySelectorAll('.mapboxgl-popup').forEach(popup => popup.remove());
              schoolPopup.setLngLat(coordinates).addTo(mapInstance);
            });

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
          }else {
            //create marker for the school
            const el = document.createElement("div");
            el.className = "school-marker";
            el.style.width = "30px";
            el.style.height = "30px";
            el.style.backgroundImage = 'url("map-pin.png")';
            el.style.backgroundSize = "contain";  
            el.style.backgroundRepeat = "no-repeat";
            el.style.cursor = "pointer";

            new mapboxgl.Marker(el).setLngLat([parseFloat(urlSchoolName?.lng || '0'), parseFloat(urlSchoolName?.lat || '0')]).addTo(mapInstance);

             const schoolPopup = new mapboxgl.Popup({
              closeButton: true,
              closeOnClick: false, // Prevent closing when clicking outside
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
                  color: #000000; 
                ">${urlSchoolName?.name}</div>
              </div>
            `)
            .addTo(mapInstance);

            el.addEventListener("click", (e) => { 
              e.stopPropagation();
              document.querySelectorAll('.mapboxgl-popup').forEach(popup => popup.remove());
              schoolPopup.setLngLat([parseFloat(urlSchoolName?.lng || '0'), parseFloat(urlSchoolName?.lat || '0')]).addTo(mapInstance);
            });

            //Zoom to the latitude and longitude of the school
            mapInstance.flyTo({center: [parseFloat(urlSchoolName?.lng || '0'), parseFloat(urlSchoolName?.lat || '0')], zoom: 10, speed: 0.7 }); // Smoothly transition to the specified zoom level

            setTimeout(() => {
              if (mapInstance) {
                mapInstance.resize();
              }
            }, 100); // 100ms delay, can be adjusted if needed

            //Fetch properties for the suburb
            
          // if(urlSchoolName?.suburb){
          //   console.log("suburb", urlSchoolName);
          //   fetchPropertiesForSuburb();
          // }
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
    // Remove existing property markers
    propertyMarkersRef.current.forEach(marker => marker.remove());
    propertyMarkersRef.current = [];

    try {
      // Create URLs for three pages
      const createUrl = (page: number) => `https://zylalabs.com/api/1476/australia+realty+api/1221/get+properties+list?channel=buy&searchLocation=${encodeURIComponent(
        urlSchoolName?.suburb || ''
      )}&searchLocationSubtext=Region&type=region&page=${page}&pageSize=30`;

      // Fetch all three pages in parallel
      const [ page2] = await Promise.all([
        fetch(createUrl(2), {
          headers: {
            Authorization: `Bearer 7008|V7LWFcAdOjDeO8OhoW3JGX688HNT094h8we3J1Wo`,
          },
        }).then(res => res.json())
      ]);

      // Combine results from all pages
      const arr = [
        ...page2.tieredResults[0].results,
      ];

      // Filter valid properties
      const validProperties = arr.filter((property: any) => {
        if (property.propertyType !== "house") return false;
        if (!property.address?.location?.latitude || !property.address?.location?.longitude) return false;
        if (!property.images?.[0]) return false;
        return true;
      });

      // Update state with valid properties
      setProperties(validProperties);
      console.log("validProperties", validProperties);
      console.log(`Total properties: ${arr.length}, Valid properties: ${validProperties.length}`);

    } catch (error) {
      console.error("Error fetching properties:", error);
      setProperties([]);
    }
  };

  // Add useEffect to handle markers when properties change
  useEffect(() => {
    if (!mapRef.current) return;

    // Clear existing markers
    propertyMarkersRef.current.forEach(marker => marker.remove());
    propertyMarkersRef.current = [];

    // Create markers for each property
    properties.forEach((property) => {
      const { longitude, latitude } = property.address.location;
      const image1 = property.images[0];
      const image1url = `${image1.server}${image1.uri}`;
      const websiteLink = `https://www.realestate.com.au/${property.prettyUrl}`;
      // const noOfBedrooms = property?.generalFeatures?.bedrooms?.value;
      // const noOfBathrooms = property?.generalFeatures?.bathrooms?.value;
      // const noOfCarSpaces = property?.generalFeatures?.carSpaces?.value;
      const price = property?.price?.display;

      const el = document.createElement("div");
      el.style.backgroundColor = 'green';
      el.style.borderRadius = '50%';
      el.style.width = "24px";
      el.style.height = "24px";
      el.style.backgroundSize = "contain";
      el.style.backgroundRepeat = "no-repeat";
      el.style.cursor = "pointer";
      el.title = property.address.streetAddress || "Property";

      // Add click handler
      el.addEventListener("click", (e) => {
        e.stopPropagation();
        document.querySelectorAll('.mapboxgl-popup').forEach(popup => popup.remove());
        
        new mapboxgl.Popup({ closeButton: true })
          .setLngLat([longitude, latitude])
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
                background-image: url('${image1url}');
              "></div>
              
              <div style="
                width: 60%;
                padding: 12px;
              ">
                <div style="
                  font-size: 12px;
                  color: #666;
                  font-weight: bold;
                  margin-bottom: 10px;
                ">${price}</div>
                
                <div style="
                  border-top: 1px solid #eee;
                  padding-top: 8px;
                  display: flex;
                  align-items: center;
                ">
                  
                  <a 
                    href="${websiteLink}"
                    target="_blank"
                    style="
                      font-size: 12px;
                      color: #000000;
                      text-decoration: underline;
                      font-weight: bold;
                    "
                  >${property.address.streetAddress}, ${property.address.suburb} ${property.address.state} ${property.address.postcode}</a>
                </div>
            </div>
          `)
          .addTo(mapRef.current!);
      });

      const marker = new mapboxgl.Marker(el)
        .setLngLat([longitude, latitude])
        .addTo(mapRef.current!);
      
      propertyMarkersRef.current.push(marker);
    });

  }, [properties]);

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