import React, { useEffect, useState } from 'react';
//import { cn } from './lib/utils';
import PlanJourney from './components/PlanJourney';

const App: React.FC = () => {
  //const [activeTab, setActiveTab] = useState<'journey' | 'houses'>('journey');
  // Keep the shared state here (selectedSchool, urlSchoolName)
  const [urlSchoolName, setUrlSchoolName] = useState<{name: string, suburb: string, lat: string, lng: string, postcode: string, state: string}>({
    name: '',
    suburb: '',
    lat: '',
    lng: '',
    postcode: '',
    state: ''
  });

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

// mapboxgl.accessToken = import.meta.env.VITE_MAPBOX_ACCESS_TOKEN!;

  useEffect(() => {
    try {
      const urlParams = new URLSearchParams(window.location.search);
      const schoolParam = urlParams.get('school');
      const suburbParam = urlParams.get('suburb');
      const latParam = urlParams.get('latitude');
      const lngParam = urlParams.get('longitude');
      const postcodeParam = urlParams.get('postcode');
      const stateParam = urlParams.get('state');

      if (schoolParam && latParam && lngParam) {
        const formattedSchoolName = schoolParam
          .toLowerCase()
          .replace(/-/g, '_');

        setUrlSchoolName({
          name: formattedSchoolName || 'oakville_public_school',
          suburb: suburbParam || '2765',
          lat: latParam || '-33.620111',
          lng: lngParam || '150.8504',
          postcode: postcodeParam || '2765',
          state: stateParam || 'nsw'
        });
      } 
      
    } catch (error) {
      console.error("Error parsing URL parameters:", error);
      setUrlSchoolName({
        name: 'oakville_ps',
        suburb: '2765',
        lat: '-33.620111',
        lng: '150.8504',
        postcode: '2765',
        state: 'nsw'
      });
    }
  }, []); // Empty dependency array as this should only run once on mount

  return (
    <div className="h-screen bg-background p-2">
      <div className="mx-auto max-w-5xl">

        <PlanJourney
               urlSchoolName={urlSchoolName}
            />
      </div>
    </div>
  );
};

export default App;