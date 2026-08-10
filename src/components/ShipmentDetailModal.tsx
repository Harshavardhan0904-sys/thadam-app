import React, { useState, useEffect } from "react";
import {
  X,
  Truck,
  CheckCircle2,
  Clock,
  MapPin,
  Calendar,
  IndianRupee,
  FileText,
  User,
  Phone,
  Printer,
  Trash2,
  ShieldCheck,
  AlertCircle,
  ArrowRight,
  Package,
  BadgeAlert,
  History
} from "lucide-react";
import { collection, query, where, onSnapshot, addDoc } from "firebase/firestore";
import { db, auth } from "../lib/firebase";
import { useAuth } from "../context/AuthContext";
import { Shipment, ShipmentStatus, Vehicle, Driver, UserRole, DriverLocation } from "../types";
import { LiveLocationMap } from "./LiveLocationMap";

interface ShipmentDetailModalProps {
  shipment: Shipment | null;
  vehicles: Vehicle[];
  drivers: Driver[];
  canUpdateShipment: boolean;
  canDeleteShipment: boolean;
  activeRole: UserRole;
  onClose: () => void;
  onUpdateStatus: (shipment: Shipment, targetStatus: ShipmentStatus, note?: string) => Promise<void>;
  onDeleteShipment: (shipmentId: string) => void;
  onOpenPrintBilty: (shipment: Shipment) => void;
}

const LIFECYCLE_STAGES: ShipmentStatus[] = ["Booked", "Loaded", "In Transit", "Delivered"];

export const ShipmentDetailModal: React.FC<ShipmentDetailModalProps> = ({
  shipment,
  vehicles,
  drivers,
  canUpdateShipment,
  canDeleteShipment,
  activeRole,
  onClose,
  onUpdateStatus,
  onDeleteShipment,
  onOpenPrintBilty
}) => {
  const { userProfile } = useAuth();
  const [selectedNextStatus, setSelectedNextStatus] = useState<ShipmentStatus>("Loaded");
  const [customNote, setCustomNote] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Live Driver Location Telemetry State
  const [latestDriverLocation, setLatestDriverLocation] = useState<DriverLocation | null>(null);
  const [loadingLocation, setLoadingLocation] = useState<boolean>(false);

  useEffect(() => {
    if (!shipment?.id) return;
    setLoadingLocation(true);

    try {
      const locsRef = collection(db, "driverLocations");
      const compId = shipment.companyId || userProfile?.companyId;
      const q = compId
        ? query(locsRef, where("companyId", "==", compId), where("shipmentId", "==", shipment.id))
        : query(locsRef, where("shipmentId", "==", shipment.id));

      const unsubscribe = onSnapshot(
        q,
        (snapshot) => {
          if (!snapshot.empty) {
            const docs = snapshot.docs.map((d) => ({ id: d.id, ...d.data() } as DriverLocation));
            docs.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
            setLatestDriverLocation(docs[0]);
          } else {
            setLatestDriverLocation(null);
          }
          setLoadingLocation(false);
        },
        (error) => {
          console.error("Firestore driverLocations listener error:", error);
          setLoadingLocation(false);
        }
      );

      return () => unsubscribe();
    } catch (err) {
      console.error("Failed to query driverLocations:", err);
      setLoadingLocation(false);
    }
  }, [shipment?.id, shipment?.companyId, userProfile?.companyId]);

  const handleSendManualPing = async (latitude: number, longitude: number) => {
    if (!shipment) return;
    try {
      const activeDriverRecordId =
        userProfile?.driverRecordId ||
        shipment.assignedDriverId ||
        auth.currentUser?.uid ||
        "driver-1";

      console.log(
        "Writing manual driver location from ShipmentDetailModal. Target driverId:",
        activeDriverRecordId,
        "userProfile.driverRecordId:",
        userProfile?.driverRecordId,
        "Auth UID:",
        auth.currentUser?.uid
      );

      const newLocData: Omit<DriverLocation, "id"> = {
        driverId: activeDriverRecordId,
        shipmentId: shipment.id,
        companyId: shipment.companyId || userProfile?.companyId || "",
        latitude,
        longitude,
        timestamp: new Date().toISOString()
      };
      await addDoc(collection(db, "driverLocations"), newLocData);
    } catch (err) {
      console.error("Error creating location document in driverLocations:", err);
      throw err;
    }
  };

  if (!shipment) return null;

  const currentStageIndex = LIFECYCLE_STAGES.indexOf(shipment.status);
  
  // Find next logical status
  const getNextStatus = (): ShipmentStatus | null => {
    if (shipment.status === "Booked") return "Loaded";
    if (shipment.status === "Loaded") return "In Transit";
    if (shipment.status === "In Transit") return "Delivered";
    return null;
  };

  const nextStatus = getNextStatus();

  const handleStatusSubmit = async (targetStatus: ShipmentStatus) => {
    if (!canUpdateShipment) return;
    setIsSubmitting(true);
    try {
      await onUpdateStatus(shipment, targetStatus, customNote.trim() || undefined);
      setCustomNote("");
    } catch (err) {
      console.error(err);
    } finally {
      setIsSubmitting(false);
    }
  };

  const assignedVeh = vehicles.find(
    v => v.id === shipment.assignedVehicleId || v.registrationNumber === shipment.assignedTruckNumber
  );

  const assignedDrv = drivers.find(
    d => d.id === shipment.assignedDriverId || d.fullName === shipment.driverName
  );

  const balanceAmount = (shipment.freightAmount || 0) - (shipment.advancePaid || 0);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-fade-in overflow-y-auto">
      <div className="relative w-full max-w-4xl bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl overflow-hidden my-8 text-slate-100">
        
        {/* Header Bar */}
        <div className="flex items-center justify-between px-6 py-4 bg-slate-950/90 border-b border-slate-800">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center">
              <Package className="w-5 h-5 text-amber-400" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-mono font-extrabold text-lg text-white">{shipment.lrNumber}</h3>
                <span className={`px-2.5 py-0.5 rounded text-[10px] font-extrabold uppercase ${
                  shipment.shipmentType === "Express" ? "bg-purple-500/20 text-purple-300 border border-purple-500/30" :
                  shipment.shipmentType === "LTL" ? "bg-blue-500/20 text-blue-300 border border-blue-500/30" :
                  "bg-amber-500/20 text-amber-300 border border-amber-500/30"
                }`}>
                  {shipment.shipmentType || "FTL"}
                </span>
                <span className={`px-2.5 py-0.5 rounded text-[10px] font-bold uppercase ${
                  shipment.status === "In Transit" ? "bg-amber-500/20 text-amber-400 border border-amber-500/30 animate-pulse" :
                  shipment.status === "Delivered" ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30" :
                  shipment.status === "Cancelled" ? "bg-rose-500/20 text-rose-400 border border-rose-500/30" :
                  "bg-slate-800 text-slate-300 border border-slate-700"
                }`}>
                  {shipment.status}
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-0.5">
                Consignment Details & Real-Time Status Lifecycle
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => onOpenPrintBilty(shipment)}
              className="bg-amber-500/10 hover:bg-amber-500/20 text-amber-400 border border-amber-500/30 px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors"
            >
              <Printer className="w-3.5 h-3.5" />
              <span>Print LR Bilty</span>
            </button>

            {canDeleteShipment && (
              <button
                onClick={() => {
                  onClose();
                  onDeleteShipment(shipment.id);
                }}
                className="bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/30 p-1.5 rounded-lg text-xs font-semibold"
                title="Delete Shipment"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            )}

            <button
              onClick={onClose}
              className="text-slate-400 hover:text-white p-1.5 rounded-lg hover:bg-slate-800 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Modal Body */}
        <div className="p-6 space-y-6 text-xs max-h-[80vh] overflow-y-auto">

          {/* Lifecycle Progress Stepper */}
          <div className="bg-slate-950/60 border border-slate-800 rounded-2xl p-5 space-y-3">
            <div className="flex items-center justify-between">
              <span className="font-bold text-slate-200 uppercase tracking-wider text-[11px] flex items-center gap-1.5">
                <Clock className="w-4 h-4 text-amber-400" />
                Shipment Lifecycle Pipeline
              </span>
              <span className="text-[11px] text-slate-400">
                Created: {shipment?.createdAt ? new Date(shipment.createdAt).toLocaleDateString("en-IN") : "N/A"}
              </span>
            </div>

            <div className="grid grid-cols-4 gap-2 pt-2 relative">
              {LIFECYCLE_STAGES.map((stage, idx) => {
                const isPassed = currentStageIndex >= idx;
                const isCurrent = shipment.status === stage;
                
                // Find status history entry for this stage
                const historyEntry = (shipment.statusHistory || []).slice().reverse().find(h => h.status === stage);

                return (
                  <div key={stage} className="flex flex-col items-center text-center relative z-10">
                    <div className={`w-10 h-10 rounded-full flex items-center justify-center font-bold mb-2 transition-all ${
                      isCurrent
                        ? "bg-amber-500 text-slate-950 ring-4 ring-amber-500/20 shadow-lg shadow-amber-500/30 scale-105"
                        : isPassed
                        ? "bg-emerald-500 text-slate-950 font-extrabold"
                        : "bg-slate-800 text-slate-500 border border-slate-700"
                    }`}>
                      {isPassed ? <CheckCircle2 className="w-5 h-5 stroke-[2.5]" /> : idx + 1}
                    </div>

                    <span className={`font-bold text-xs ${isCurrent ? "text-amber-400" : isPassed ? "text-white" : "text-slate-500"}`}>
                      {stage}
                    </span>

                    {historyEntry && historyEntry.timestamp ? (
                      <span className="text-[10px] text-slate-400 mt-1">
                        {new Date(historyEntry.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    ) : (
                      <span className="text-[10px] text-slate-600 mt-1">Pending</span>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Status Advancement Actions (for allowed roles) */}
          {canUpdateShipment ? (
            <div className="bg-slate-900 border border-amber-500/30 p-4 rounded-xl space-y-3">
              <div className="flex items-center justify-between">
                <span className="font-bold text-amber-300 text-xs flex items-center gap-1.5">
                  <ShieldCheck className="w-4 h-4 text-amber-400" />
                  Advance Shipment Status ({activeRole})
                </span>
                {assignedVeh && shipment.status === "In Transit" && (
                  <span className="bg-amber-500/10 text-amber-400 border border-amber-500/20 text-[10px] px-2 py-0.5 rounded font-mono">
                    Truck {assignedVeh.registrationNumber} is marked EN-ROUTE
                  </span>
                )}
              </div>

              <div className="flex flex-col sm:flex-row gap-2 items-center">
                {nextStatus && (
                  <button
                    disabled={isSubmitting}
                    onClick={() => handleStatusSubmit(nextStatus)}
                    className="w-full sm:w-auto bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold px-4 py-2 rounded-xl text-xs flex items-center justify-center gap-1.5 shadow"
                  >
                    <span>Mark as "{nextStatus}"</span>
                    <ArrowRight className="w-4 h-4 stroke-[2.5]" />
                  </button>
                )}

                <div className="flex items-center gap-2 w-full sm:w-auto">
                  <select
                    value={selectedNextStatus}
                    onChange={(e) => setSelectedNextStatus(e.target.value as ShipmentStatus)}
                    className="bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-white font-bold text-xs focus:outline-none focus:border-amber-500 cursor-pointer"
                  >
                    <option value="Booked">Booked</option>
                    <option value="Loaded">Loaded</option>
                    <option value="In Transit">In Transit</option>
                    <option value="Delivered">Delivered</option>
                    <option value="Cancelled">Cancelled</option>
                  </select>

                  <button
                    disabled={isSubmitting}
                    onClick={() => handleStatusSubmit(selectedNextStatus)}
                    className="bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 font-semibold px-3 py-2 rounded-xl text-xs"
                  >
                    Set Selected Status
                  </button>
                </div>
              </div>

              <div>
                <input
                  type="text"
                  value={customNote}
                  onChange={(e) => setCustomNote(e.target.value)}
                  placeholder="Optional status update note (e.g. Driver reported checkpoint arrival at Kotputli Toll)"
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2 text-white text-xs focus:outline-none focus:border-amber-500"
                />
              </div>
            </div>
          ) : (
            <div className="bg-slate-950/60 border border-slate-800 p-3 rounded-xl text-slate-400 text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-amber-400" />
              <span>Read-only role ({activeRole}). Status updates restricted to Admin, Fleet Manager & Dispatcher.</span>
            </div>
          )}

          {/* Embedded Live Google Map Telemetry */}
          <LiveLocationMap
            shipment={shipment}
            assignedVehicle={assignedVeh}
            driverLocation={latestDriverLocation}
            loadingLocation={loadingLocation}
            onSendManualPing={handleSendManualPing}
            userRole={activeRole}
          />

          {/* Consignment Details Overview */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            
            {/* Left Box: Route & Parties */}
            <div className="bg-slate-950/60 border border-slate-800 rounded-xl p-4 space-y-3">
              <h4 className="font-bold text-white text-xs border-b border-slate-800 pb-2 flex items-center gap-1.5">
                <MapPin className="w-4 h-4 text-amber-400" />
                Route & Consignment Parties
              </h4>

              <div className="space-y-2 text-slate-300">
                <div className="flex justify-between">
                  <span className="text-slate-400">Origin City:</span>
                  <span className="font-bold text-white">{shipment.origin}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Destination City:</span>
                  <span className="font-bold text-white">{shipment.destination}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Consignor (Sender):</span>
                  <span className="font-semibold text-amber-300">{shipment.consignor}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Consignee (Receiver):</span>
                  <span className="font-semibold text-emerald-300">{shipment.consignee}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Cargo Type:</span>
                  <span className="text-slate-200">{shipment.cargoType} ({shipment.weightTons || 10} MT)</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">E-Way Bill No:</span>
                  <span className="font-mono text-amber-400">{shipment.ewayBillNo || "N/A"}</span>
                </div>
              </div>
            </div>

            {/* Right Box: Fleet & Driver Assignment */}
            <div className="bg-slate-950/60 border border-slate-800 rounded-xl p-4 space-y-3">
              <h4 className="font-bold text-white text-xs border-b border-slate-800 pb-2 flex items-center gap-1.5">
                <Truck className="w-4 h-4 text-amber-400" />
                Assigned Vehicle & Driver
              </h4>

              <div className="space-y-2 text-slate-300">
                <div className="flex justify-between">
                  <span className="text-slate-400">Truck Registration:</span>
                  <span className="font-mono font-extrabold text-amber-400">
                    {shipment.assignedTruckNumber || assignedVeh?.registrationNumber || "Unassigned"}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Vehicle Model / Specs:</span>
                  <span className="text-slate-200">{assignedVeh?.model || shipment.truckType || "32ft MXL"}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Vehicle Trip Status:</span>
                  <span className={`font-bold ${assignedVeh?.status === "En-Route" ? "text-amber-400" : "text-emerald-400"}`}>
                    {assignedVeh?.status || (shipment.status === "In Transit" ? "En-Route" : "Available")}
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-slate-400">Assigned Driver:</span>
                  <span className="font-semibold text-white flex items-center gap-1">
                    <User className="w-3.5 h-3.5 text-amber-400" />
                    {shipment.driverName || assignedDrv?.fullName || "Unassigned"}
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-slate-400">Driver Contact:</span>
                  <span className="font-mono text-slate-300 flex items-center gap-1">
                    <Phone className="w-3 h-3 text-slate-400" />
                    {shipment.driverPhone || assignedDrv?.phoneNumber || "N/A"}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Expected Delivery:</span>
                  <span className="font-semibold text-emerald-400">
                    {shipment.expectedDeliveryDate ? new Date(shipment.expectedDeliveryDate).toLocaleDateString("en-IN") : "TBD"}
                  </span>
                </div>
              </div>
            </div>

          </div>

          {/* Financial Summary */}
          <div className="bg-slate-950/60 border border-slate-800 rounded-xl p-4 flex flex-col sm:flex-row items-center justify-between gap-4 font-mono">
            <div className="flex items-center gap-2">
              <IndianRupee className="w-5 h-5 text-emerald-400" />
              <div>
                <span className="text-[11px] text-slate-400 block font-sans">Freight Commercial Value</span>
                <span className="text-lg font-extrabold text-white">
                  ₹{(shipment.freightAmount || 0).toLocaleString('en-IN')}
                </span>
              </div>
            </div>

            <div className="flex items-center gap-6 text-xs">
              <div>
                <span className="text-[10px] text-slate-400 block font-sans">Advance Paid</span>
                <span className="font-bold text-amber-300">
                  ₹{(shipment.advancePaid || 0).toLocaleString('en-IN')}
                </span>
              </div>
              <div className="border-l border-slate-800 pl-6">
                <span className="text-[10px] text-slate-400 block font-sans">Balance Due on POD</span>
                <span className="font-bold text-emerald-400">
                  ₹{balanceAmount > 0 ? balanceAmount.toLocaleString('en-IN') : 0}
                </span>
              </div>
            </div>
          </div>

          {/* Status History Timeline Log */}
          <div className="bg-slate-950/60 border border-slate-800 rounded-2xl p-4 space-y-3">
            <h4 className="font-bold text-white text-xs flex items-center gap-1.5 border-b border-slate-800 pb-2">
              <History className="w-4 h-4 text-amber-400" />
              Status Change Audit History Log ({shipment.statusHistory?.length || 0} Events)
            </h4>

            {!shipment.statusHistory || shipment.statusHistory.length === 0 ? (
              <p className="text-slate-500 text-xs py-2">No historical status logs recorded.</p>
            ) : (
              <div className="space-y-3 font-sans">
                {shipment.statusHistory.slice().reverse().map((item, idx) => (
                  <div key={idx} className="flex items-start gap-3 bg-slate-900/60 p-3 rounded-xl border border-slate-800">
                    <div className={`w-7 h-7 rounded-lg flex items-center justify-center font-bold text-xs shrink-0 ${
                      item.status === "Delivered" ? "bg-emerald-500/20 text-emerald-400" :
                      item.status === "In Transit" ? "bg-amber-500/20 text-amber-400" :
                      item.status === "Loaded" ? "bg-purple-500/20 text-purple-400" :
                      "bg-blue-500/20 text-blue-400"
                    }`}>
                      <CheckCircle2 className="w-4 h-4" />
                    </div>
                    <div className="flex-1 space-y-0.5">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-white text-xs">{item.status}</span>
                          {item.updatedByRole && (
                            <span className="bg-slate-800 text-amber-400 border border-amber-500/20 text-[9px] px-1.5 py-0.2 rounded font-mono">
                              {item.updatedByRole}
                            </span>
                          )}
                        </div>
                        <span className="text-[10px] text-slate-400 font-mono">
                          {item.timestamp ? new Date(item.timestamp).toLocaleString("en-IN") : "N/A"}
                        </span>
                      </div>
                      {item.note && (
                        <p className="text-[11px] text-slate-300 italic">{item.note}</p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

        </div>

      </div>
    </div>
  );
};
