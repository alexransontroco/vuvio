import * as THREE from 'three';
import maplibregl from 'maplibre-gl';

export const WATER_ACTIVITIES = ['surf', 'sailing', 'kayaking', 'diving', 'fishing', 'paddle', 'swimming', 'ferry', 'jetSki', 'boat'];

export const WATER_ICON_URLS = {
  surf: '/globe-test-2/water-icons/surf.svg',
  sailing: '/globe-test-2/water-icons/sailing.svg',
  kayaking: '/globe-test-2/water-icons/kayaking.svg',
  diving: '/globe-test-2/water-icons/diving.svg',
  fishing: '/globe-test-2/water-icons/fishing.svg',
  paddle: '/globe-test-2/water-icons/paddle.svg',
};

export const WATER_ICON_LIMITS = {
  mobile: { mid: 4, close: 8, max: 12 },
  desktop: { mid: 6, close: 12, max: 16 },
};

export const WATER_ICON_ZOOM = {
  min: 4.95,
  mid: 5.75,
  close: 6.45,
};

const textureCache = new Map();
const textureLoader = new THREE.TextureLoader();
let fallbackTexture = null;

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function wrapDelta(delta) {
  const value = ((delta + 540) % 360) - 180;
  return value;
}

function haversineLikeScore(liveCenter, cameraCenter) {
  const lngDistance = wrapDelta((liveCenter?.[0] ?? 0) - (cameraCenter?.[0] ?? 0));
  const latDistance = (liveCenter?.[1] ?? 0) - (cameraCenter?.[1] ?? 0);
  const distance = Math.sqrt(lngDistance * lngDistance + latDistance * latDistance);
  return clamp(1 - distance / 95, 0, 1);
}

function viewersNumber(live) {
  if (!live?.viewers) return 0;
  return Number.parseInt(String(live.viewers).replace(/\D/g, ''), 10) || 0;
}

function activityFromString(value) {
  const normalized = String(value ?? '').toLowerCase();
  if (normalized.includes('surf')) return 'surf';
  if (normalized.includes('sail')) return 'sailing';
  if (normalized.includes('kayak') || normalized.includes('paddle')) return normalized.includes('paddle') ? 'paddle' : 'kayaking';
  if (normalized.includes('div')) return 'diving';
  if (normalized.includes('fish')) return 'fishing';
  if (normalized.includes('boat') || normalized.includes('ferry')) return normalized.includes('ferry') ? 'ferry' : 'boat';
  if (normalized.includes('jet')) return 'jetSki';
  if (normalized.includes('swim')) return 'swimming';
  return 'boat';
}

export function inferWaterActivity(live) {
  if (!live) return 'boat';
  if (WATER_ICON_URLS[live.activity]) return live.activity;
  if (WATER_ACTIVITIES.includes(live.activity)) return live.activity;
  return activityFromString(live.activity ?? live.subcategory ?? live.title ?? live.experienceTitle ?? live.name ?? '');
}

export function isWaterOnlyFilters(activeFilters) {
  return Boolean(activeFilters?.families?.water) && !activeFilters?.families?.earth && !activeFilters?.families?.air;
}

function maxIconsForZoom(zoom, viewportWidth) {
  const desktop = viewportWidth >= 760;
  const limits = desktop ? WATER_ICON_LIMITS.desktop : WATER_ICON_LIMITS.mobile;
  if (zoom < WATER_ICON_ZOOM.mid) return 0;
  if (zoom < WATER_ICON_ZOOM.close) return limits.mid;
  return limits.max;
}

function estimateScreenPosition(live, cameraState, viewport) {
  const width = viewport?.width ?? 0;
  const height = viewport?.height ?? 0;
  const center = cameraState?.center ?? [0, 0];
  const zoom = cameraState?.zoom ?? 1;
  const lngDelta = wrapDelta((live.coordinates?.[0] ?? 0) - center[0]);
  const latDelta = (live.coordinates?.[1] ?? 0) - center[1];
  const scale = (Math.min(width, height) || 1) * (0.32 + Math.max(0, zoom - 4.8) * 0.11);

  return {
    x: width / 2 + lngDelta * scale * 0.62,
    y: height / 2 - latDelta * scale * 0.48,
  };
}

function scoreWaterLive(live, cameraState, selectedLiveId, activityCounts) {
  const viewers = Math.min(1, viewersNumber(live) / 2500);
  const proximity = haversineLikeScore(live.coordinates, cameraState?.center);
  const featuredBoost = live.featured ? 0.48 : 0;
  const selectedBoost = live.id === selectedLiveId ? 1.8 : 0;
  const activity = inferWaterActivity(live);
  const diversityBoost = activityCounts.get(activity) ? -0.22 * activityCounts.get(activity) : 0.22;
  const centerBias = proximity * 0.72;
  const densityBias = viewers * 0.44;
  return selectedBoost + featuredBoost + centerBias + densityBias + diversityBoost + (live.featured ? 0.08 : 0);
}

export function getVisibleWaterIconLives({
  lives,
  cameraState,
  viewport,
  selectedLiveId,
}) {
  if (!Array.isArray(lives) || lives.length === 0) return [];
  if ((cameraState?.zoom ?? 0) < WATER_ICON_ZOOM.min) return [];

  const maxIcons = maxIconsForZoom(cameraState.zoom, viewport?.width ?? 0);
  if (maxIcons <= 0) return [];

  const ranked = lives
    .map((live) => {
      const activity = inferWaterActivity(live);
      return {
        ...live,
        activity,
        screen: estimateScreenPosition(live, cameraState, viewport),
        score: 0,
      };
    })
    .sort((a, b) => viewersNumber(b) - viewersNumber(a) || Number(b.featured) - Number(a.featured) || String(a.id).localeCompare(String(b.id)));

  const activityCounts = new Map();
  const selected = [];
  const minSpacing = cameraState.zoom < WATER_ICON_ZOOM.close ? (viewport.width >= 760 ? 96 : 84) : (viewport.width >= 760 ? 72 : 62);

  ranked.forEach((item) => {
    item.score = scoreWaterLive(item, cameraState, selectedLiveId, activityCounts);
  });

  ranked.sort((a, b) => b.score - a.score);

  for (const item of ranked) {
    if (selected.length >= maxIcons) break;

    const collides = selected.some((picked) => {
      const dx = picked.screen.x - item.screen.x;
      const dy = picked.screen.y - item.screen.y;
      return Math.hypot(dx, dy) < minSpacing;
    });

    if (collides && item.id !== selectedLiveId && !item.featured) continue;

    selected.push(item);
    activityCounts.set(item.activity, (activityCounts.get(item.activity) ?? 0) + 1);
  }

  return selected.sort((a, b) => b.score - a.score);
}

export function preloadWaterIconTextures() {
  return Promise.all(
    Object.entries(WATER_ICON_URLS).map(async ([activity, url]) => {
      if (textureCache.has(activity)) return textureCache.get(activity);
      const texture = await textureLoader.loadAsync(url);
      texture.colorSpace = THREE.SRGBColorSpace;
      texture.minFilter = THREE.LinearFilter;
      texture.magFilter = THREE.LinearFilter;
      texture.generateMipmaps = false;
      textureCache.set(activity, texture);
      return texture;
    }),
  );
}

function createFallbackTexture() {
  if (fallbackTexture) return fallbackTexture;
  const canvas = document.createElement('canvas');
  canvas.width = 128;
  canvas.height = 128;
  const ctx = canvas.getContext('2d');
  if (ctx) {
    const gradient = ctx.createLinearGradient(24, 18, 96, 104);
    gradient.addColorStop(0, 'rgba(145, 244, 255, 0.98)');
    gradient.addColorStop(0.5, 'rgba(79, 231, 211, 0.96)');
    gradient.addColorStop(1, 'rgba(29, 143, 255, 0.96)');
    ctx.clearRect(0, 0, 128, 128);
    ctx.fillStyle = 'rgba(4, 18, 31, 0)';
    ctx.fillRect(0, 0, 128, 128);
    ctx.shadowColor = 'rgba(85, 226, 255, 0.22)';
    ctx.shadowBlur = 18;
    ctx.beginPath();
    ctx.arc(64, 64, 24, 0, Math.PI * 2);
    ctx.fillStyle = gradient;
    ctx.fill();
    ctx.shadowBlur = 0;
    ctx.fillStyle = 'rgba(255,255,255,0.85)';
    ctx.beginPath();
    ctx.arc(56, 54, 7, 0, Math.PI * 2);
    ctx.fill();
  }
  fallbackTexture = new THREE.CanvasTexture(canvas);
  fallbackTexture.colorSpace = THREE.SRGBColorSpace;
  fallbackTexture.minFilter = THREE.LinearFilter;
  fallbackTexture.magFilter = THREE.LinearFilter;
  fallbackTexture.generateMipmaps = false;
  return fallbackTexture;
}

function createIconMaterial(activity, texture) {
  const color = activity === 'diving' ? 0x8feeff : activity === 'fishing' ? 0x79dcff : activity === 'sailing' ? 0x62e9ff : 0x4fe7d3;
  return new THREE.SpriteMaterial({
    map: texture,
    color,
    transparent: true,
    depthWrite: false,
    depthTest: true,
    opacity: 0.98,
  });
}

function createLineMaterial() {
  return new THREE.MeshBasicMaterial({
    color: 0x77dcff,
    transparent: true,
    opacity: 0.54,
    depthWrite: false,
  });
}

function createSelectionMaterial() {
  return new THREE.MeshBasicMaterial({
    color: 0xff9a3a,
    transparent: true,
    opacity: 0.42,
    depthWrite: false,
    side: THREE.DoubleSide,
  });
}

class WaterIconsLayer {
  constructor() {
    this.id = 'vuvio-test2-water-icons';
    this.type = 'custom';
    this.renderingMode = '3d';
    this.enabled = false;
    this.items = [];
    this.groups = new Map();
    this.scene = null;
    this.camera = null;
    this.renderer = null;
    this.map = null;
    this.clock = 0;
  }

  onAdd(map, gl) {
    this.map = map;
    this.camera = new THREE.Camera();
    this.scene = new THREE.Scene();
    this.renderer = new THREE.WebGLRenderer({
      canvas: map.getCanvas(),
      context: gl,
      antialias: true,
      alpha: true,
    });
    this.renderer.autoClear = false;
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));
    preloadWaterIconTextures().catch(() => {});
  }

  setEnabled(enabled) {
    this.enabled = Boolean(enabled);
    if (!this.enabled) {
      this.groups.forEach((group) => {
        group.visible = false;
      });
    }
  }

  setClock(clock) {
    this.clock = clock;
  }

  setItems(items) {
    const nextIds = new Set(items.map((item) => item.id));

    this.groups.forEach((group, id) => {
      if (nextIds.has(id)) return;
      this.scene?.remove(group);
      group.traverse((object) => {
        if (object.geometry) object.geometry.dispose?.();
        if (object.material) {
          if (Array.isArray(object.material)) object.material.forEach((material) => material.dispose?.());
          else object.material.dispose?.();
        }
      });
      this.groups.delete(id);
    });

    items.forEach((item) => {
      let group = this.groups.get(item.id);
      if (!group) {
        group = this.createGroup(item);
        this.groups.set(item.id, group);
        this.scene?.add(group);
      }
      group.userData.item = item;
      group.visible = this.enabled;
    });

    this.items = items;
  }

  createGroup(item) {
    const group = new THREE.Group();
    group.userData.item = item;

    const baseLength = 1;
    const lineGeometry = new THREE.CylinderGeometry(0.012, 0.012, baseLength, 6, 1, false);
    lineGeometry.rotateX(Math.PI / 2);
    const line = new THREE.Mesh(lineGeometry, createLineMaterial());
    line.name = 'line';
    line.position.z = 0.03 + baseLength / 2;
    group.add(line);

    const selectionRingGeometry = new THREE.TorusGeometry(0.13, 0.022, 12, 24);
    const selectionRing = new THREE.Mesh(selectionRingGeometry, createSelectionMaterial());
    selectionRing.name = 'selectionRing';
    selectionRing.position.z = 0.004;
    selectionRing.visible = false;
    group.add(selectionRing);

    const placeholderTexture = textureCache.get(item.activity) ?? createFallbackTexture();
    const sprite = new THREE.Sprite(createIconMaterial(item.activity, placeholderTexture));
    sprite.name = 'icon';
    sprite.position.z = 0.12;
    group.add(sprite);

    return group;
  }

  render(gl, matrix) {
    if (!this.renderer || !this.camera || !this.scene || !this.map || !this.enabled || !this.items.length) return;
    const m = new THREE.Matrix4().fromArray(matrix);
    this.camera.projectionMatrix = m;
    const time = performance.now() * 0.001;
    this.groups.forEach((group) => {
      const item = group.userData.item;
      if (!item) return;
      const texture = textureCache.get(item.activity) ?? createFallbackTexture();
      const point = maplibregl.MercatorCoordinate.fromLngLat([item.coordinates[0], item.coordinates[1]], 0);
      const scale = point.meterInMercatorCoordinateUnits();
      const bobble = Math.sin(time * item.bobSpeed + item.phase) * item.bobAmplitude;
      const selectionLift = item.selected ? 4200 : 0;
      const lineHeightMeters = item.lineHeightMeters + bobble * 0.25 + selectionLift * 0.08;
      const lineHeight = lineHeightMeters * scale;
      const pointAltitude = item.pointAltitudeMeters * scale;
      const iconAltitude = (item.iconAltitudeMeters + bobble + selectionLift) * scale;
      const iconScale = item.iconScaleMeters * scale * (item.selected ? 1.12 : 1);

      group.position.set(point.x, point.y, point.z);

      const line = group.getObjectByName('line');
      if (line) {
        line.visible = item.mode === 'floating';
        line.material.opacity = item.selected ? 0.74 : item.featured ? 0.62 : 0.48;
        line.material.color.setHex(item.featured ? 0xaedcff : 0x77dcff);
        line.position.z = pointAltitude + lineHeight / 2;
        line.scale.set(item.selected ? 1.2 : 1, item.selected ? 1.2 : 1, Math.max(0.001, lineHeight));
      }

      const selectionRing = group.getObjectByName('selectionRing');
      if (selectionRing) {
        selectionRing.visible = Boolean(item.selected);
        selectionRing.material.opacity = item.featured ? 0.48 : 0.34;
        selectionRing.scale.setScalar(item.selected ? 1.14 : 1);
      }

      const icon = group.getObjectByName('icon');
      if (icon) {
        if (icon.material.map !== texture) {
          icon.material.map = texture;
          icon.material.needsUpdate = true;
        }
        icon.visible = item.mode === 'floating';
        icon.material.opacity = item.selected ? 1 : 0.94;
        icon.position.z = iconAltitude;
        icon.scale.set(iconScale, iconScale, 1);
      }

      group.visible = this.enabled && item.mode === 'floating';
    });

    this.renderer.resetState();
    this.renderer.render(this.scene, this.camera);
    this.map.triggerRepaint();
  }

  dispose() {
    this.groups.forEach((group) => {
      this.scene?.remove(group);
      group.traverse((object) => {
        if (object.geometry) object.geometry.dispose?.();
        if (object.material) {
          if (Array.isArray(object.material)) object.material.forEach((material) => material.dispose?.());
          else object.material.dispose?.();
        }
      });
    });
    this.groups.clear();
    this.scene = null;
    this.camera = null;
    this.renderer?.dispose?.();
    this.renderer = null;
  }
}

export function createWaterIconsLayer() {
  return new WaterIconsLayer();
}
