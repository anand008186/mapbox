import React, { useRef, useEffect } from 'react';
import mapboxgl from 'mapbox-gl';
// import { NavigationControl } from 'mapbox-gl';

interface NearbyHousesProps {
  selectedSchool: any;
  urlSchoolName: any;
}

export const NearbyHouses: React.FC<NearbyHousesProps> = ({ selectedSchool, urlSchoolName }) => {
  const mapContainerRef = useRef<HTMLDivElement | null>(null);
//   const mapRef = useRef<mapboxgl.Map | null>(null);
  const propertyMarkersRef = useRef<mapboxgl.Marker[]>([]);

  useEffect(() => {
    const mapInstance = new mapboxgl.Map({
      container: mapContainerRef.current!,
      style: "mapbox://styles/mapbox/streets-v12",
      center: selectedSchool?.coordinates || [151.2099, -33.865143],
      zoom: 15,
      interactive: true // Enable map interactions for this view
    });

    // Add zoom controls
    const navigationControl = new mapboxgl.NavigationControl();
    mapInstance.addControl(navigationControl, 'bottom-right');

    mapInstance.on("load", () => {
      fetchPropertiesForSuburb(propertyMarkersRef.current, mapInstance, urlSchoolName);
    });

    return () => mapInstance.remove();
  }, [selectedSchool]);

  const fetchPropertiesForSuburb = async (markers: mapboxgl.Marker[], map: mapboxgl.Map, urlSchoolName: {name: string, suburb: string}) => {
    // Remove existing property markers.
    markers.forEach(marker => marker.remove());
    markers = [];
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
            el.style.backgroundImage = 'url("home.png")';
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
                padding: 16px;
                font-family: system-ui, -apple-system, sans-serif;
              ">
                <div style="
                  font-size: 10px;
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
                  <a style="
                    font-size: 10px;
                    color: ${'#000000'};
                    text-decoration: underline;
                    font-weight: semibold;
                    cursor: pointer;
                    outline: none;
                    border: none;
                    background: none;
                    padding: 0;
                    margin: 0;
                    font-family: system-ui, -apple-system, sans-serif;
                    

                  "
                  href="${websiteLink}"
                  target="_blank"
                  >${property.agency.name || 'Real Estate Agency'}</a>
                </div>
              </div>`)
                .addTo(map);
            });
            el.addEventListener("mouseleave", () => {
              if ((el as any).currentPopup) {
                (el as any).currentPopup.remove();
                (el as any).currentPopup = null;
              }
            });
            console.log("address", lng, lat, address);
            const marker = new mapboxgl.Marker(el).setLngLat([lng, lat]).addTo(map);
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
      
      <div className="mt-6 w-full" style={{ height: '600px' }}>
        <div
          ref={mapContainerRef}
          className="w-full h-full rounded-lg overflow-hidden border border-gray-200"
        />
      </div>
    </div>
  );
}; 