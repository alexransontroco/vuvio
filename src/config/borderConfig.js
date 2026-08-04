// Centralized border configuration for react-globe.gl
export const borderConfig = {
  enabled: true,
  color: 'rgba(185, 225, 235, 0.42)',
  altitude: 0.006,
  fillColor: 'rgba(0, 0, 0, 0)',
  transitionDuration: 0,
};

// Development/Lab overrides (can be modified via UI)
export const createBorderConfig = (overrides = {}) => ({
  ...borderConfig,
  ...overrides,
});
