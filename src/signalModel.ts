export type NetworkProfile = {
  id: '2g' | '3g' | '4g' | '5g';
  label: string;
  frequencyMHz: number;
  reachKm: number;
  clutterPenalty: number;
  baseStrength: number;
};

export type Coordinates = {
  latitude: number;
  longitude: number;
};

export const NETWORK_PROFILES: NetworkProfile[] = [
  { id: '2g', label: '2G', frequencyMHz: 900, reachKm: 34, clutterPenalty: 0.7, baseStrength: -67 },
  { id: '3g', label: '3G', frequencyMHz: 1900, reachKm: 22, clutterPenalty: 1.0, baseStrength: -70 },
  { id: '4g', label: '4G', frequencyMHz: 2600, reachKm: 16, clutterPenalty: 1.2, baseStrength: -72 },
  { id: '5g', label: '5G', frequencyMHz: 3500, reachKm: 9, clutterPenalty: 1.45, baseStrength: -75 }
];

export type SignalResult = {
  strengthDbm: number;
  bars: number;
  quality: 'Excellent' | 'Strong' | 'Fair' | 'Weak' | 'No service';
  throughputMbps: number;
  latencyMs: number;
  coverageScore: number;
  fade: number;
  distanceKm: number;
};

export function haversineKm(a: Coordinates, b: Coordinates) {
  const earthRadiusKm = 6371;
  const toRadians = (value: number) => (value * Math.PI) / 180;
  const deltaLat = toRadians(b.latitude - a.latitude);
  const deltaLon = toRadians(b.longitude - a.longitude);
  const lat1 = toRadians(a.latitude);
  const lat2 = toRadians(b.latitude);

  const arc =
    Math.sin(deltaLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(deltaLon / 2) ** 2;

  return 2 * earthRadiusKm * Math.asin(Math.min(1, Math.sqrt(arc)));
}

function locationNoise(latitude: number, longitude: number) {
  const seed = Math.sin(latitude * 12.9898 + longitude * 78.233) * 43758.5453;
  return seed - Math.floor(seed);
}

export function simulateSignal(
  location: Coordinates,
  tower: Coordinates,
  profile: NetworkProfile
): SignalResult {
  const distanceKm = Math.max(0.05, haversineKm(location, tower));
  const terrain = locationNoise(location.latitude, location.longitude);
  const shadow = locationNoise(tower.latitude, tower.longitude);
  const congestion = 0.5 + locationNoise(location.longitude, tower.latitude) * 0.9;

  const distancePenalty = Math.log1p(distanceKm / profile.reachKm) * 38;
  const frequencyPenalty = Math.log10(profile.frequencyMHz / 700) * 11;
  const clutterPenalty = (terrain * 9 + shadow * 6 + congestion * 3) * profile.clutterPenalty;
  const fade = terrain * 2.5 + shadow * 1.8;

  const strengthDbm = Math.round(profile.baseStrength - distancePenalty - frequencyPenalty - clutterPenalty + fade);
  const clamped = Math.max(-118, Math.min(-45, strengthDbm));

  const normalized = Math.max(0, Math.min(1, (clamped + 118) / 73));
  const coverageScore = Math.round(normalized * 100);

  let bars = 0;
  if (coverageScore > 10) bars = 1;
  if (coverageScore > 28) bars = 2;
  if (coverageScore > 48) bars = 3;
  if (coverageScore > 68) bars = 4;
  if (coverageScore > 84) bars = 5;

  const quality =
    bars >= 5 ? 'Excellent' : bars === 4 ? 'Strong' : bars === 3 ? 'Fair' : bars === 2 ? 'Weak' : 'No service';

  const throughputBase = profile.id === '5g' ? 420 : profile.id === '4g' ? 160 : profile.id === '3g' ? 42 : 18;
  const throughputMbps = Math.max(0.5, Math.round(throughputBase * Math.pow(normalized, 1.6) * 10) / 10);

  const latencyMs = Math.round(
    profile.id === '5g'
      ? 14 + (1 - normalized) * 28
      : profile.id === '4g'
        ? 24 + (1 - normalized) * 42
        : profile.id === '3g'
          ? 42 + (1 - normalized) * 60
          : 68 + (1 - normalized) * 90
  );

  return {
    strengthDbm: clamped,
    bars,
    quality,
    throughputMbps,
    latencyMs,
    coverageScore,
    fade,
    distanceKm
  };
}

export function autoTowerFor(location: Coordinates): Coordinates {
  const latitude = Math.max(-80, Math.min(80, location.latitude + Math.sin(location.longitude / 9) * 0.35));
  const longitude = ((location.longitude + Math.cos(location.latitude / 7) * 0.42 + 540) % 360) - 180;
  return { latitude, longitude };
}