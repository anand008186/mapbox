import React, { useEffect, useState } from 'react';
import { cn } from './lib/utils';
import PlanJourney from './components/PlanJourney';
import { NearbyHouses } from './components/NearbyHouses';

const App: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'journey' | 'houses'>('journey');
  // Keep the shared state here (selectedSchool, urlSchoolName)
  const [urlSchoolName, setUrlSchoolName] = useState<{name: string, suburb: string} | null>(null);
  const [selectedSchool, _setSelectedSchool] = useState<{name: string, suburb: string} | null>(null);

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

      if (schoolParam) {
        const formattedSchoolName = schoolParam
          .toLowerCase()
          .replace('public-school', 'ps')
          .replace(/-/g, '_');

        setUrlSchoolName({
          name: formattedSchoolName,
          suburb: suburbParam || ''
        });
      } else {
        setUrlSchoolName({
          name: 'oakville_ps',
          suburb: '2765'
        });
      }
    } catch (error) {
      console.error("Error parsing URL parameters:", error);
      setUrlSchoolName({
        name: 'oakville_ps',
        suburb: '2765'
      });
    }
  }, []); // Empty dependency array as this should only run once on mount

  return (
    <div className="h-screen bg-background py-2">
      <div className="mx-auto max-w-5xl">
        {/* Tab Navigation */}
        <div className="border-b border-gray-200">
          <nav className="-mb-px flex space-x-8">
            <button
              onClick={() => setActiveTab('journey')}
              className={cn(
                ' border-b-2 font-medium text-sm',
                activeTab === 'journey' 
                  ? 'border-[#137780]  '
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              )}
            >
              Plan School Journey
            </button>
            <button
              onClick={() => setActiveTab('houses')}
              className={cn(
                'py-2 px-1 border-b-2 font-medium text-sm',
                activeTab === 'houses'
                  ? 'border-[#137780] '
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              )}
            >
              Nearby Houses
            </button>
          </nav>
        </div>

        {/* Content */}
        <div className="mt-2">
          {activeTab === 'journey' ? (
            <PlanJourney
               urlSchoolName={urlSchoolName}
            />
          ) : (
            <NearbyHouses
              selectedSchool={selectedSchool}
              urlSchoolName={urlSchoolName}
            />
          )}
        </div>
      </div>
    </div>
  );
};

export default App;