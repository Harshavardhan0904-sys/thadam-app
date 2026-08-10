import React, { useState, useEffect } from "react";
import {
  Truck,
  MapPin,
  Package,
  CheckCircle2,
  Navigation,
  LogOut,
  Radio,
  ArrowRight,
  ShieldCheck,
  AlertCircle,
  RefreshCw,
  PhoneCall,
  Clock,
  Building2,
  CheckCircle
} from "lucide-react";
import { collection, query, where, onSnapshot, doc, updateDoc, addDoc } from "firebase/firestore";
import { db } from "../lib/firebase";
import { useAuth } from "../context/AuthContext";
import { Shipment, ShipmentStatus, ShipmentStatusHistoryItem, DriverLocation } from "../types";

export const DriverDashboard: React.FC = () => {
  const { userProfile, companyProfile, logout } = useAuth();
  const [assignedShipment, setAssignedShipment] = useState<Shipment | null>(null);
  const [loadingShipment, setLoadingShipment] = useState(true);
  const [isUpdatingStatus, setIsUpdatingStatus] = useState(false);
  const [lastGpsPingTime, setLastGpsPingTime] = useState<string | null>(null);
  const [gpsErrorMsg, setGpsErrorMsg] = useState<string | null>(null);
  const [manualPingCount, setManualPingCount] = useState(0);

  const driverRecordId = userProfile?.driverRecordId || "";
  const companyId = userProfile?.companyId || "";

  // 1. Listen to assigned shipment for this driver
  useEffect(() => {
    if (!companyId) return;
    setLoadingShipment(true);

    try {
      const shipmentsRef = collection(db, "shipments");
      const q = query(shipmentsRef, where("companyId", "==", companyId));

      const unsubscribe = onSnapshot(
        q,
        (snapshot) => {
          const allShipments = snapshot.docs.map(
            (d) => ({ id: d.id, ...d.data() } as Shipment)
          );

          // Find shipment assigned to this driver by driverRecordId or driverName/uid
          const myShipments = allShipments.filter(
            (s) =>
              s.assignedDriverId === driverRecordId ||
              s.assignedDriverId === userProfile?.uid ||
              (s.driverName && s.driverName.toLowerCase() === userProfile?.displayName.toLowerCase())
          );

          // Prioritize active non-delivered shipments
          const active = myShipments.find((s) => s.status !== "Delivered" && s.status !== "Cancelled");
          if (active) {
            setAssignedShipment(active);
          } else if (myShipments.length > 0) {
            // Sort by creation date descending if all delivered
            myShipments.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
            setAssignedShipment(myShipments[0]);
          } else {
            setAssignedShipment(null);
          }

          setLoadingShipment(false);
        },
        (error) => {
          console.error("Error listening to driver shipments:", error);
          setLoadingShipment(false);
        }
      );

      return () => unsubscribe();
    } catch (err) {
      console.error("Failed to query driver assigned shipment:", err);
      setLoadingShipment(false);
    }
  }, [companyId, driverRecordId, userProfile?.uid, userProfile?.displayName]);

  // 2. Real-time GPS Location Capture when shipment is 'In Transit'
  useEffect(() => {
    if (!assignedShipment || assignedShipment.status !== "In Transit" || !driverRecordId) {
      return;
    }

    if (!navigator.geolocation) {
      setGpsErrorMsg("Browser does not support Geolocation API.");
      return;
    }

    let lastWriteMs = 0;
    const WRITE_THROTTLE_MS = 25000; // 25s throttle

    const recordLocation = async (lat: number, lng: number) => {
      const now = Date.now();
      if (now - lastWriteMs < WRITE_THROTTLE_MS) return;
      lastWriteMs = now;

      if (!driverRecordId) {
        console.warn("Location write aborted: driverRecordId is empty on user profile.", userProfile);
        setGpsErrorMsg("GPS Write Blocked: missing driverRecordId on user profile.");
        return;
      }

      console.log(
        "Writing driver location to driverLocations collection. Target driverRecordId:",
        driverRecordId,
        "User Profile driverRecordId:",
        userProfile?.driverRecordId,
        "Auth UID:",
        userProfile?.uid
      );

      try {
        const locPayload: Omit<DriverLocation, "id"> = {
          driverId: driverRecordId,
          shipmentId: assignedShipment.id,
          companyId: companyId,
          latitude: Number(lat.toFixed(6)),
          longitude: Number(lng.toFixed(6)),
          timestamp: new Date().toISOString()
        };
        await addDoc(collection(db, "driverLocations"), locPayload);
        setLastGpsPingTime(new Date().toLocaleTimeString());
        setGpsErrorMsg(null);
      } catch (err: any) {
        console.error("Error writing driver location telemetry:", err);
        setGpsErrorMsg("GPS Write Blocked: Check Firestore rules or connectivity.");
      }
    };

    const watchId = navigator.geolocation.watchPosition(
      (pos) => {
        recordLocation(pos.coords.latitude, pos.coords.longitude);
      },
      (err) => {
        console.warn("GPS watchPosition warning:", err.message);
        setGpsErrorMsg(`GPS Warning: ${err.message}`);
      },
      { enableHighAccuracy: true, maximumAge: 20000, timeout: 25000 }
    );

    // Initial immediate ping
    navigator.geolocation.getCurrentPosition(
      (pos) => recordLocation(pos.coords.latitude, pos.coords.longitude),
      () => {},
      { enableHighAccuracy: true }
    );

    return () => {
      navigator.geolocation.clearWatch(watchId);
    };
  }, [assignedShipment, driverRecordId, companyId, manualPingCount]);

  // Manual Trigger for GPS Ping
  const handleManualGpsPing = () => {
    if (!navigator.geolocation) return;
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        if (!assignedShipment || !driverRecordId) {
          console.warn("Manual GPS write aborted: missing assignedShipment or driverRecordId", { assignedShipment, driverRecordId });
          alert("GPS Ping Aborted: missing driverRecordId on user profile.");
          return;
        }

        console.log(
          "Writing manual driver location to driverLocations collection. Target driverRecordId:",
          driverRecordId,
          "User Profile driverRecordId:",
          userProfile?.driverRecordId,
          "Auth UID:",
          userProfile?.uid
        );

        try {
          const locPayload: Omit<DriverLocation, "id"> = {
            driverId: driverRecordId,
            shipmentId: assignedShipment.id,
            companyId: companyId,
            latitude: Number(pos.coords.latitude.toFixed(6)),
            longitude: Number(pos.coords.longitude.toFixed(6)),
            timestamp: new Date().toISOString()
          };
          await addDoc(collection(db, "driverLocations"), locPayload);
          setLastGpsPingTime(new Date().toLocaleTimeString());
          setManualPingCount((c) => c + 1);
        } catch (err: any) {
          console.error("Manual ping error:", err);
          alert("Failed to send location ping: " + (err.message || err));
        }
      },
      (err) => alert("Could not fetch location: " + err.message)
    );
  };

  // Lifecycle Progression Logic: Booked -> Loaded -> In Transit -> Delivered
  const getNextStatus = (curr: ShipmentStatus): ShipmentStatus | null => {
    if (curr === "Booked") return "Loaded";
    if (curr === "Loaded") return "In Transit";
    if (curr === "In Transit") return "Delivered";
    return null;
  };

  const nextStatus = assignedShipment ? getNextStatus(assignedShipment.status) : null;

  const handleAdvanceStatus = async () => {
    if (!assignedShipment || !nextStatus) return;

    setIsUpdatingStatus(true);
    try {
      const nowIso = new Date().toISOString();
      const historyItem: ShipmentStatusHistoryItem = {
        status: nextStatus,
        timestamp: nowIso,
        updatedByRole: "Driver",
        note: `Status updated to ${nextStatus} by Driver ${userProfile?.displayName}`
      };

      const existingHistory = assignedShipment.statusHistory || [];
      const updatedHistory = [...existingHistory, historyItem];

      const sRef = doc(db, "shipments", assignedShipment.id);
      await updateDoc(sRef, {
        status: nextStatus,
        statusHistory: updatedHistory
      });

      // Update local state copy
      setAssignedShipment((prev) =>
        prev
          ? {
              ...prev,
              status: nextStatus,
              statusHistory: updatedHistory
            }
          : null
      );
    } catch (err) {
      console.error("Failed to advance shipment status:", err);
      alert("Firestore Permission Denied: Unable to update shipment status.");
    } finally {
      setIsUpdatingStatus(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 p-4 sm:p-6 pb-12 flex flex-col items-center">
      <div className="w-full max-w-md space-y-4">
        
        {/* Driver Header Card */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-xl relative overflow-hidden">
          <div className="absolute top-0 right-0 w-32 h-32 bg-amber-500/5 rounded-full blur-2xl pointer-events-none" />
          
          <div className="flex items-center justify-between gap-3 border-b border-slate-800/80 pb-3">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-amber-500 to-amber-600 text-slate-950 flex items-center justify-center font-bold text-lg shadow-lg shadow-amber-500/20">
                <Truck className="w-6 h-6 stroke-[2.5]" />
              </div>
              <div>
                <h2 className="font-extrabold text-lg text-white leading-tight">
                  {userProfile?.displayName || "Captain Driver"}
                </h2>
                <div className="flex items-center gap-1.5 text-xs text-amber-400 font-semibold mt-0.5">
                  <ShieldCheck className="w-3.5 h-3.5" />
                  <span>{companyProfile?.name || userProfile?.companyName || "Freight Transporter"}</span>
                </div>
              </div>
            </div>

            <button
              onClick={logout}
              className="p-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl transition-colors cursor-pointer"
              title="Sign Out"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>

          <div className="mt-3 flex items-center justify-between text-xs text-slate-400">
            <span className="flex items-center gap-1">
              <Radio className="w-3.5 h-3.5 text-emerald-400 animate-pulse" />
              Role: <strong className="text-white">Commercial Driver</strong>
            </span>
            <span className="bg-slate-800 text-slate-300 px-2.5 py-0.5 rounded-full font-mono text-[11px]">
              ID: {driverRecordId.substring(0, 8)}...
            </span>
          </div>
        </div>

        {/* GPS Live Telemetry Banner (when in transit) */}
        {assignedShipment?.status === "In Transit" && (
          <div className="bg-emerald-950/60 border border-emerald-500/40 rounded-2xl p-4 flex items-center justify-between gap-3 text-xs shadow-lg backdrop-blur-md">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-xl bg-emerald-500/20 text-emerald-400 shrink-0">
                <Navigation className="w-5 h-5 animate-spin-slow" />
              </div>
              <div>
                <div className="font-bold text-emerald-300 flex items-center gap-1.5">
                  <span>GPS Telemetry Active</span>
                  <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
                </div>
                <p className="text-[11px] text-emerald-200/80">
                  {lastGpsPingTime ? `Last pinged at ${lastGpsPingTime}` : "Pinging driverLocations collection..."}
                </p>
                {gpsErrorMsg && <p className="text-[10px] text-amber-300 font-mono mt-0.5">{gpsErrorMsg}</p>}
              </div>
            </div>

            <button
              onClick={handleManualGpsPing}
              className="px-2.5 py-1.5 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold rounded-lg text-[11px] flex items-center gap-1 shrink-0 transition-colors cursor-pointer"
            >
              <RefreshCw className="w-3 h-3" />
              <span>Ping Now</span>
            </button>
          </div>
        )}

        {/* Assigned Shipment Section */}
        {loadingShipment ? (
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-8 text-center text-slate-400 space-y-3">
            <RefreshCw className="w-8 h-8 text-amber-400 animate-spin mx-auto" />
            <p className="text-xs font-semibold">Loading assigned shipment from Firestore...</p>
          </div>
        ) : !assignedShipment ? (
          /* No Active Shipment State */
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-8 text-center space-y-4 shadow-xl">
            <div className="w-16 h-16 rounded-2xl bg-slate-800 text-slate-500 flex items-center justify-center mx-auto border border-slate-700">
              <Truck className="w-8 h-8" />
            </div>
            <div>
              <h3 className="font-bold text-lg text-white">No Active Shipment Assigned</h3>
              <p className="text-xs text-slate-400 mt-1 max-w-xs mx-auto">
                You currently have no load assigned for transit. Standby at your branch hub or contact your Fleet Manager / Dispatcher.
              </p>
            </div>
            <div className="inline-flex items-center gap-2 bg-slate-800 text-amber-400 text-xs font-semibold px-4 py-2 rounded-xl border border-slate-700">
              <Clock className="w-4 h-4" />
              <span>Status: Standby at Hub</span>
            </div>
          </div>
        ) : (
          /* Assigned Shipment Card */
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 space-y-4 shadow-2xl relative">
            
            {/* LR Badge & Status */}
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div>
                <span className="text-[10px] text-slate-400 font-mono uppercase tracking-wider block">Consignment Bilty</span>
                <span className="font-extrabold text-amber-400 font-mono text-base">{assignedShipment.lrNumber}</span>
              </div>
              <span
                className={`px-3 py-1 rounded-full text-xs font-bold font-mono tracking-wide ${
                  assignedShipment.status === "Booked"
                    ? "bg-sky-500/20 text-sky-400 border border-sky-500/30"
                    : assignedShipment.status === "Loaded"
                    ? "bg-amber-500/20 text-amber-400 border border-amber-500/30"
                    : assignedShipment.status === "In Transit"
                    ? "bg-indigo-500/20 text-indigo-400 border border-indigo-500/30 animate-pulse"
                    : "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30"
                }`}
              >
                {assignedShipment.status}
              </span>
            </div>

            {/* Route Card */}
            <div className="bg-slate-950/80 border border-slate-800 rounded-xl p-3.5 space-y-2">
              <div className="text-[10px] text-slate-400 font-semibold uppercase tracking-wider">Transport Route</div>
              <div className="flex items-center justify-between gap-2">
                <div className="flex-1">
                  <div className="text-xs text-slate-400 font-medium">Origin</div>
                  <div className="font-bold text-white text-sm">{assignedShipment.origin}</div>
                </div>
                <div className="flex flex-col items-center justify-center px-2">
                  <ArrowRight className="w-4 h-4 text-amber-400" />
                  <span className="text-[9px] text-slate-500 font-mono">In-Transit</span>
                </div>
                <div className="flex-1 text-right">
                  <div className="text-xs text-slate-400 font-medium">Destination</div>
                  <div className="font-bold text-white text-sm">{assignedShipment.destination}</div>
                </div>
              </div>
            </div>

            {/* Consignment Specs */}
            <div className="grid grid-cols-2 gap-2 text-xs">
              <div className="bg-slate-800/60 p-2.5 rounded-xl border border-slate-800">
                <span className="text-slate-400 text-[10px] block">Consignee Client</span>
                <strong className="text-slate-200 font-semibold truncate block">{assignedShipment.consignee}</strong>
              </div>
              <div className="bg-slate-800/60 p-2.5 rounded-xl border border-slate-800">
                <span className="text-slate-400 text-[10px] block">Cargo Load</span>
                <strong className="text-slate-200 font-semibold truncate block">
                  {assignedShipment.cargoType} ({assignedShipment.weightTons || 12} Tons)
                </strong>
              </div>
            </div>

            {/* Vehicle Info */}
            <div className="flex items-center justify-between text-xs bg-slate-800/40 p-3 rounded-xl border border-slate-800">
              <div className="flex items-center gap-2 text-slate-300">
                <Truck className="w-4 h-4 text-amber-400" />
                <span>Vehicle: <strong className="text-white font-mono">{assignedShipment.assignedTruckNumber || "Assigned Truck"}</strong></span>
              </div>
              {assignedShipment.ewayBillNo && (
                <span className="text-[10px] text-slate-400 font-mono">
                  E-Way: {assignedShipment.ewayBillNo}
                </span>
              )}
            </div>

            {/* ACTION BUTTON TO ADVANCE STATUS */}
            {nextStatus ? (
              <div className="pt-2">
                <button
                  id="driver-advance-status-btn"
                  disabled={isUpdatingStatus}
                  onClick={handleAdvanceStatus}
                  className="w-full py-3.5 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 font-extrabold text-sm rounded-xl shadow-lg shadow-amber-500/20 flex items-center justify-center gap-2 transition-all cursor-pointer active:scale-95 disabled:opacity-50"
                >
                  {isUpdatingStatus ? (
                    <>
                      <RefreshCw className="w-4 h-4 animate-spin" />
                      <span>Updating Firestore Status...</span>
                    </>
                  ) : (
                    <>
                      <CheckCircle2 className="w-5 h-5" />
                      <span>
                        {assignedShipment.status === "Booked" && "Mark Cargo as Loaded"}
                        {assignedShipment.status === "Loaded" && "Start In Transit Run"}
                        {assignedShipment.status === "In Transit" && "Confirm Final Delivery"}
                      </span>
                    </>
                  )}
                </button>
                <p className="text-[11px] text-center text-slate-400 mt-2">
                  Advances status to <span className="text-amber-400 font-bold">{nextStatus}</span> & logs audit record.
                </p>
              </div>
            ) : (
              <div className="bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 p-3 rounded-xl text-xs font-semibold flex items-center justify-center gap-2">
                <CheckCircle className="w-5 h-5 text-emerald-400" />
                <span>Shipment Delivered — Good Job Captain!</span>
              </div>
            )}

            {/* Lifecycle Timeline History */}
            {assignedShipment.statusHistory && assignedShipment.statusHistory.length > 0 && (
              <div className="border-t border-slate-800 pt-3 space-y-1.5">
                <span className="text-[10px] text-slate-400 font-mono uppercase">Status History Trail</span>
                <div className="space-y-1 text-[11px]">
                  {assignedShipment.statusHistory.slice().reverse().map((item, idx) => (
                    <div key={idx} className="flex items-center justify-between text-slate-300 bg-slate-950/40 px-2.5 py-1.5 rounded-lg font-mono text-[10px]">
                      <span className="font-bold text-amber-400">{item.status}</span>
                      <span className="text-slate-500">{new Date(item.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

      </div>
    </div>
  );
};
