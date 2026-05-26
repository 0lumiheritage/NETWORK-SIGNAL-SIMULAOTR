import { useEffect, useMemo, useState } from 'react';
import {
  autoTowerFor,
  NETWORK_PROFILES,
  simulateSignal,
  type Coordinates,
  type NetworkProfile
} from './signalModel';

const DEFAULT_LOCATION: Coordinates = { latitude: 40.7128, longitude: -74.006 };

const meterSegments = [
  { label: 'No service', threshold: 0 },
  { label: 'Weak', threshold: 2 },
  { label: 'Fair', threshold: 3 },
  { label: 'Strong', threshold: 4 },
  { label: 'Excellent', threshold: 5 }
];

function formatCoord(value: number) {
  return value.toFixed(4);
}

function signalHue(bars: number) {
  if (bars >= 5) return 'var(--green)';
  if (bars >= 4) return 'var(--lime)';
  if (bars >= 3) return 'var(--gold)';
  if (bars >= 2) return 'var(--orange)';
  return 'var(--red)';
}

export default function App() {
  const [location, setLocation] = useState(DEFAULT_LOCATION);
  const [tower, setTower] = useState(() => autoTowerFor(DEFAULT_LOCATION));
  const [profileId, setProfileId] = useState<NetworkProfile['id']>('4g');
  const [geoStatus, setGeoStatus] = useState('Using a simulated location in New York City.');

  const profile = NETWORK_PROFILES.find((item) => item.id === profileId) ?? NETWORK_PROFILES[2];
  const signal = useMemo(() => simulateSignal(location, tower, profile), [location, tower, profile]);

  useEffect(() => {
    const connection = (navigator as Navigator & {
      connection?: {
        effectiveType?: string;
        downlink?: number;
        rtt?: number;
      };
    }).connection as
      | {
          effectiveType?: string;
          downlink?: number;
          rtt?: number;
        }
      | undefined;

    if (connection?.effectiveType) {
      setGeoStatus(
        `Browser reports ${connection.effectiveType.toUpperCase()} connectivity${
          typeof connection.downlink === 'number' ? ` at ~${connection.downlink.toFixed(1)} Mbps` : ''
        }.`
      );
    }
  }, []);

  const handleLocate = () => {
    if (!navigator.geolocation) {
      setGeoStatus('Geolocation is not supported in this browser.');
      return;
    }

    setGeoStatus('Requesting your current position...');

    navigator.geolocation.getCurrentPosition(
      (position) => {
        const nextLocation = {
          latitude: position.coords.latitude,
          longitude: position.coords.longitude
        };

        setLocation(nextLocation);
        setTower(autoTowerFor(nextLocation));
        setGeoStatus('Location updated from the browser and tower recalibrated nearby.');
      },
      () => {
        setGeoStatus('Permission denied or position unavailable. Kept the simulated location.');
      },
      { enableHighAccuracy: true, timeout: 8000 }
    );
  };

  const updateLocation = (field: keyof Coordinates, value: string) => {
    setLocation((current) => ({ ...current, [field]: Number(value) }));
  };

  const updateTower = (field: keyof Coordinates, value: string) => {
    setTower((current) => ({ ...current, [field]: Number(value) }));
  };

  return (
    <main className="shell">
      <section className="hero">
        <div className="hero-copy">
          <p className="eyebrow">Signal strength simulator</p>
          <h1>Model cellular coverage from location, distance, and network type.</h1>
          <p className="lede">
            Move the device position, shift the serving tower, or switch between 2G, 3G, 4G, and 5G to see how
            terrain and frequency change the experience.
          </p>
          <div className="hero-actions">
            <button className="primary-button" onClick={handleLocate} type="button">
              Use my location
            </button>
            <button
              className="secondary-button"
              type="button"
              onClick={() => {
                setTower(autoTowerFor(location));
                setGeoStatus('Tower placement refreshed around the current location.');
              }}
            >
              Recenter tower
            </button>
          </div>
          <p className="status-line">{geoStatus}</p>
        </div>

        <div className="meter-card">
          <div className="meter-topline">
            <span>{profile.label} network</span>
            <span>{signal.quality}</span>
          </div>

          <div className="signal-ring" style={{ ['--accent' as string]: signalHue(signal.bars), ['--coverage' as string]: signal.coverageScore }}>
            <div className="signal-ring-inner">
              <div className="signal-value">{signal.coverageScore}</div>
              <div className="signal-label">Coverage score</div>
              <div className="signal-meta">{signal.strengthDbm} dBm</div>
            </div>
          </div>

          <div className="bars" aria-label="signal bars">
            {meterSegments.map((segment, index) => (
              <div
                key={segment.label}
                className={`bar ${signal.bars >= segment.threshold ? 'active' : ''}`}
                style={{ height: `${22 + index * 16}px` }}
              />
            ))}
          </div>

          <div className="meter-stats">
            <div>
              <span>Throughput</span>
              <strong>{signal.throughputMbps} Mbps</strong>
            </div>
            <div>
              <span>Latency</span>
              <strong>{signal.latencyMs} ms</strong>
            </div>
            <div>
              <span>Distance to tower</span>
              <strong>{signal.distanceKm.toFixed(2)} km</strong>
            </div>
          </div>
        </div>
      </section>

      <section className="workspace">
        <div className="control-panel">
          <div className="panel-header">
            <h2>Simulation controls</h2>
            <p>Every change recomputes the predicted signal strength.</p>
          </div>

          <div className="control-grid">
            <label>
              Device latitude
              <input
                type="number"
                step="0.0001"
                value={location.latitude}
                onChange={(event) => updateLocation('latitude', event.target.value)}
              />
            </label>
            <label>
              Device longitude
              <input
                type="number"
                step="0.0001"
                value={location.longitude}
                onChange={(event) => updateLocation('longitude', event.target.value)}
              />
            </label>
            <label>
              Tower latitude
              <input
                type="number"
                step="0.0001"
                value={tower.latitude}
                onChange={(event) => updateTower('latitude', event.target.value)}
              />
            </label>
            <label>
              Tower longitude
              <input
                type="number"
                step="0.0001"
                value={tower.longitude}
                onChange={(event) => updateTower('longitude', event.target.value)}
              />
            </label>
          </div>

          <div className="network-picker">
            {NETWORK_PROFILES.map((item) => (
              <button
                key={item.id}
                type="button"
                className={`network-option ${profile.id === item.id ? 'selected' : ''}`}
                onClick={() => setProfileId(item.id)}
              >
                <span>{item.label}</span>
                <small>{item.frequencyMHz} MHz</small>
              </button>
            ))}
          </div>
        </div>

        <div className="insight-panel">
          <div className="panel-header">
            <h2>Location analytics</h2>
            <p>Signal fades as frequency rises and the tower moves farther away.</p>
          </div>

          <div className="insight-grid">
            <article>
              <span>Device position</span>
              <strong>
                {formatCoord(location.latitude)}, {formatCoord(location.longitude)}
              </strong>
            </article>
            <article>
              <span>Serving tower</span>
              <strong>
                {formatCoord(tower.latitude)}, {formatCoord(tower.longitude)}
              </strong>
            </article>
            <article>
              <span>Frequency</span>
              <strong>{profile.frequencyMHz} MHz</strong>
            </article>
            <article>
              <span>Shadow loss</span>
              <strong>{signal.fade.toFixed(1)} units</strong>
            </article>
          </div>

          <div className="terrain-strip">
            <div className="terrain-glow" />
            <div className="terrain-labels">
              <div>
                <span>Coverage</span>
                <strong>{signal.coverageScore}%</strong>
              </div>
              <div>
                <span>Quality</span>
                <strong>{signal.quality}</strong>
              </div>
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}