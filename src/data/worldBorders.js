// Simplified world borders data for globe visualization
// Using a lightweight GeoJSON of country boundaries

export const worldBorders = {
  type: 'FeatureCollection',
  features: [
    // This is a simplified dataset - in production you'd use a full geojson
    // For now, we'll load from a CDN or create a minimal version
  ]
};

// Alternative: Use TopoJSON or external service for borders
export const getBordersGeoJSON = async () => {
  try {
    // Using a lightweight natural earth borders dataset
    const response = await fetch('https://cdn.jsdelivr.net/npm/world-atlas@2/countries-110m.json');
    const data = await response.json();
    return data;
  } catch (error) {
    console.error('Failed to load borders:', error);
    return null;
  }
};
