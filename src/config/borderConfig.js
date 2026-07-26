// Centralized border configuration for react-globe.gl
export const borderConfig = {
  enabled: true,
  color: 'rgba(170, 215, 225, 0.32)',
  altitude: 0.006,
  fillColor: 'rgba(0, 0, 0, 0)',
  transitionDuration: 0,
};

// Development/Lab overrides (can be modified via UI)
export const createBorderConfig = (overrides = {}) => ({
  ...borderConfig,
  ...overrides,
});
