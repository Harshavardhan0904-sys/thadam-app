import React, { useState } from "react";
import { Navigation, MapPin, AlertTriangle, RefreshCw, Radio, CheckCircle2, ShieldAlert } from "lucide-react";
import { DriverLocation, Shipment, Vehicle, UserRole } from "../types";

export const INDIAN_CITY_COORDS: Record<string, { lat: number; lng: number }> = {
  "Delhi NCR": { lat: 28.6139, lng: 77.2090 },
  "Delhi": { lat: 28.6139, lng: 77.2090 },
  "Mumbai (Bhiwandi)": { lat: 19.2812, lng: 73.0482 },
  "Mumbai": { lat: 19.0760, lng: 72.8777 },
  "Bengaluru": { lat: 12.9716, lng: 77.5946 },
  "Chennai": { lat: 13.0827, lng: 80.2707 },
  "Kolkata": { lat: 22.5726, lng: 88.3639 },
  "Hyderabad": { lat: 17.3850, lng: 78.4867 },
  "Ahmedabad": { lat: 23.0225, lng: 72.5714 },
  "Pune": { lat: 18.5204, lng: 73.8567 },
  "Surat": { lat: 21.1702, lng: 72.8311 },
  "Jaipur": { lat: 26.9124, lng: 75.7873 },
  "Lucknow": { lat: 26.8467, lng: 80.9462 },
  "Indore": { lat: 22.7196, lng: 75.8577 },
  "Nagpur": { lat: 21.1458, lng: 79.0882 },
  "Bhopal": { lat: 23.2599, lng: 77.4126 },
  "Chandigarh": { lat: 30.7333, lng: 76.7794 },
  "Ludhiana": { lat: 30.9010, lng: 75.8573 },
  "Kanpur": { lat: 26.4499, lng: 80.3319 },
};

interface LiveLocationMapProps {
  shipment: Shipment;
  assignedVehicle?: Vehicle | null;
  driverLocation: DriverLocation | null;
  loadingLocation?: boolean;
  onSendManualPing: (lat: number, lng: number) => Promise<void>;
  userRole?: UserRole;
}

export const LiveLocationMap: React.FC<LiveLocationMapProps> = ({
  shipment,
  assignedVehicle,
  driverLocation,
  loadingLocation = false,
  onSendManualPing,
  userRole,
}) => {
  const [isPinging, setIsPinging] = useState(false);
  const [pingSuccessMsg, setPingSuccessMsg] = useState<string | null>(null);

  // Fallback lat/lng from city coordinates or Delhi
  const defaultCoords = INDIAN_CITY_COORDS[shipment.origin] || INDIAN_CITY_COORDS["Delhi NCR"];
  const currentLat = driverLocation?.latitude ?? defaultCoords.lat;
  const currentLng = driverLocation?.longitude ?? defaultCoords.lng;

  // Stale location calculation (15 minutes threshold = 900,000 ms)
  const STALE_THRESHOLD_MS = 15 * 60 * 1000;
  
  const isStale = React.useMemo(() => {
    if (!driverLocation || !driverLocation.timestamp) return true;
    const updateTime = new Date(driverLocation.timestamp).getTime();
    if (isNaN(updateTime)) return true;
    return Date.now() - updateTime > STALE_THRESHOLD_MS;
  }, [driverLocation]);

  const timeAgoText = React.useMemo(() => {
    if (!driverLocation || !driverLocation.timestamp) {
      return "No GPS telemetry received yet";
    }
    const updateTime = new Date(driverLocation.timestamp).getTime();
    if (isNaN(updateTime)) return "No GPS telemetry received yet";

    const diffSec = Math.floor((Date.now() - updateTime) / 1000);
    if (diffSec < 5) return "Just now";
    if (diffSec < 60) return `${diffSec} seconds ago`;
    const diffMin = Math.floor(diffSec / 60);
    if (diffMin < 60) return `${diffMin} ${diffMin === 1 ? "minute" : "minutes"} ago`;
    const diffHours = Math.floor(diffMin / 60);
    return `${diffHours} ${diffHours === 1 ? "hour" : "hours"} ago`;
  }, [driverLocation]);

  // Handle capturing browser GPS directly
  const handleCaptureBrowserGps = () => {
    if (!navigator.geolocation) {
      alert("Geolocation API is not supported by your browser.");
      return;
    }
    setIsPinging(true);
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        try {
          await onSendManualPing(pos.coords.latitude, pos.coords.longitude);
          setPingSuccessMsg("Browser GPS location captured & updated!");
          setTimeout(() => setPingSuccessMsg(null), 3000);
        } catch (err) {
          console.error("Failed to record location:", err);
        } finally {
          setIsPinging(false);
        }
      },
      (err) => {
        console.warn("Geolocation permission error or timeout:", err.message);
        // Fallback simulate with small variation
        handleSimulatePing();
      },
      { enableHighAccuracy: true, timeout: 8000 }
    );
  };

  // Handle simulation ping (useful for testing when GPS is indoor or disabled)
  const handleSimulatePing = async () => {
    setIsPinging(true);
    // Add small random movement offset ~0.005 deg (~500m)
    const latOffset = (Math.random() - 0.5) * 0.01;
    const lngOffset = (Math.random() - 0.5) * 0.01;
    const newLat = Number((currentLat + latOffset).toFixed(6));
    const newLng = Number((currentLng + lngOffset).toFixed(6));

    try {
      await onSendManualPing(newLat, newLng);
      setPingSuccessMsg(`Simulated live GPS move: ${newLat}, ${newLng}`);
      setTimeout(() => setPingSuccessMsg(null), 3000);
    } catch (err) {
      console.error("Failed to simulate location:", err);
    } finally {
      setIsPinging(false);
    }
  };

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 space-y-4">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-800 pb-3">
        <div className="flex items-center gap-2">
          <div className="p-2 rounded-xl bg-amber-500/20 text-amber-400">
            <Radio className="w-5 h-5 animate-pulse" />
          </div>
          <div>
            <h3 className="font-bold text-base text-white flex items-center gap-2">
              <span>Live Vehicle GPS Telemetry</span>
              {shipment.status === "In Transit" && (
                <span className="bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 text-[10px] px-2 py-0.5 rounded-full font-mono uppercase font-bold tracking-wider animate-pulse">
                  Active Transit
                </span>
              )}
            </h3>
            <p className="text-xs text-slate-400">
              Target Collection: <code className="text-amber-300">driverLocations</code>
            </p>
          </div>
        </div>

        {/* Status Indicators */}
        <div className="flex items-center gap-2">
          {isStale ? (
            <div id="location-stale-warning" className="bg-amber-500/15 border border-amber-500/40 text-amber-300 text-xs px-3 py-1 rounded-xl flex items-center gap-1.5 font-semibold">
              <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0" />
              <span>Location Stale</span>
            </div>
          ) : (
            <div className="bg-emerald-500/15 border border-emerald-500/40 text-emerald-300 text-xs px-3 py-1 rounded-xl flex items-center gap-1.5 font-semibold">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping"></span>
              <span>GPS Live Signal</span>
            </div>
          )}
        </div>
      </div>

      {/* Embedded Google Map Frame */}
      <div className="relative rounded-2xl overflow-hidden border border-slate-800 bg-slate-950 aspect-video sm:aspect-[21/9] min-h-[260px] shadow-2xl">
        {loadingLocation ? (
          <div className="absolute inset-0 flex items-center justify-center bg-slate-950/90 z-20">
            <div className="flex items-center gap-2 text-slate-400 text-xs">
              <RefreshCw className="w-5 h-5 text-amber-400 animate-spin" />
              <span>Fetching latest GPS coordinates from Firestore...</span>
            </div>
          </div>
        ) : null}

        {/* Embedded Map iframe */}
        <iframe
          title={`GPS Location Map - ${shipment.lrNumber}`}
          width="100%"
          height="100%"
          className="w-full h-full border-0 filter brightness-90 contrast-105"
          loading="lazy"
          allowFullScreen
          src={`https://maps.google.com/maps?q=${currentLat},${currentLng}&z=13&output=embed`}
        />

        {/* Overlay Banner for Stale Location Warning */}
        {isStale && (
          <div className="absolute top-3 left-3 right-3 z-10 bg-amber-950/90 border border-amber-500/60 text-amber-200 px-3.5 py-2 rounded-xl text-xs flex items-center justify-between gap-2 shadow-xl backdrop-blur-md">
            <div className="flex items-center gap-2">
              <ShieldAlert className="w-4 h-4 text-amber-400 shrink-0" />
              <span className="font-semibold">
                Location stale — No update received in the last 15 minutes.
              </span>
            </div>
            <span className="text-[10px] bg-amber-500/20 text-amber-300 border border-amber-500/30 px-2 py-0.5 rounded font-mono">
              {timeAgoText}
            </span>
          </div>
        )}

        {/* Floating Bottom Telemetry Card */}
        <div className="absolute bottom-3 left-3 right-3 z-10 bg-slate-900/90 border border-slate-700/80 p-3 rounded-xl backdrop-blur-md text-xs text-slate-200 flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-3">
            <div className="bg-amber-500 text-slate-950 p-2 rounded-lg font-bold">
              <Navigation className="w-4 h-4" />
            </div>
            <div>
              <div className="font-bold text-white flex items-center gap-2">
                <span>Truck: {assignedVehicle?.registrationNumber || shipment.assignedTruckNumber || "N/A"}</span>
                <span className="text-slate-400">•</span>
                <span className="text-amber-300">{shipment.driverName || "Assigned Driver"}</span>
              </div>
              <div className="text-[11px] text-slate-400 flex items-center gap-2 mt-0.5 font-mono">
                <MapPin className="w-3 h-3 text-amber-400 shrink-0" />
                <span>{currentLat.toFixed(4)}° N, {currentLng.toFixed(4)}° E</span>
                <span className="text-slate-600">|</span>
                <span className={isStale ? "text-amber-400 font-semibold" : "text-emerald-400"}>
                  Last updated {timeAgoText}
                </span>
              </div>
            </div>
          </div>

          {/* Quick Action Pings */}
          <div className="flex items-center gap-2">
            <button
              id="send-browser-gps-btn"
              disabled={isPinging}
              onClick={handleCaptureBrowserGps}
              className="bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold px-3 py-1.5 rounded-lg text-xs flex items-center gap-1.5 transition-all cursor-pointer shadow-lg shadow-amber-500/20 disabled:opacity-50"
              title="Capture real device location using navigator.geolocation"
            >
              {isPinging ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Radio className="w-3.5 h-3.5" />}
              <span>{isPinging ? "Pinging..." : "Transmit Device GPS"}</span>
            </button>

            <button
              onClick={handleSimulatePing}
              disabled={isPinging}
              className="bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 font-semibold px-2.5 py-1.5 rounded-lg text-xs flex items-center gap-1 cursor-pointer transition-all disabled:opacity-50"
              title="Simulate vehicle movement ping along the route"
            >
              <span>Simulate Movement</span>
            </button>
          </div>
        </div>
      </div>

      {/* Success Notification Feedback */}
      {pingSuccessMsg && (
        <div className="bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 p-2.5 rounded-xl text-xs flex items-center gap-2 font-medium animate-fade-in">
          <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
          <span>{pingSuccessMsg}</span>
        </div>
      )}
    </div>
  );
};
