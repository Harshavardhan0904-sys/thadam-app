import React, { useState, useEffect } from "react";
import {
  Truck, ShieldCheck, Plus, Search, Filter, FileText, Printer, Building2,
  Users, CheckCircle2, Clock, MapPin, IndianRupee, AlertCircle, RefreshCw,
  TrendingUp, BarChart3, Fuel, Settings, UserCheck, ArrowUpRight, Zap, Sparkles,
  Trash2, Lock, Eye, Contact, Phone, Edit, Calendar, AlertTriangle, User, X, Mail, CreditCard
} from "lucide-react";
import { collection, query, where, getDocs, addDoc, updateDoc, deleteDoc, doc, setDoc } from "firebase/firestore";
import { db, auth, createDriverAuthAccount } from "../lib/firebase";
import { useAuth } from "../context/AuthContext";
import {
  Shipment, Vehicle, FreightUser, ShipmentStatus, UserRole, Invoice,
  Driver, DriverLicenseType, DriverStatus, ShipmentType, ShipmentStatusHistoryItem, Branch
} from "../types";
import { LorryReceiptModal } from "./LorryReceiptModal";
import { ShipmentDetailModal } from "./ShipmentDetailModal";
import { RateCalculatorWidget } from "./RateCalculatorWidget";
import { PricingPage } from "./PricingPage";
import { AdminPanel } from "./AdminPanel";

export const Dashboard: React.FC = () => {
  const { userProfile, companyProfile, isSuperAdmin, logout } = useAuth();
  
  const [activeTab, setActiveTab] = useState<"overview" | "shipments" | "fleet" | "drivers" | "rates" | "financials" | "team" | "branches" | "pricing" | "admin">("overview");

  const isSubscriptionActive =
    Boolean(companyProfile?.isDemoAccount) ||
    companyProfile?.subscriptionStatus === "active" ||
    (companyProfile?.subscriptionStatus === "active" &&
      companyProfile?.subscriptionRenewsAt &&
      new Date(companyProfile.subscriptionRenewsAt) > new Date());
  
  // Active Role State (Allows switching role in UI to test Role-Based Access Control)
  const [activeRole, setActiveRole] = useState<UserRole>(userProfile?.role || "Company Admin");

  // Sync profile role when loaded
  useEffect(() => {
    if (userProfile?.role) {
      setActiveRole(userProfile.role);
    }
  }, [userProfile?.role]);

  // Handle active role switch in UI testing (switches active view role to test role permissions)
  const handleSwitchRole = async (newRole: UserRole) => {
    setActiveRole(newRole);
  };

  // Handle Company Admin updating ANOTHER team member's role directly in Firestore
  const handleUpdateMemberRole = async (targetUid: string, newRole: UserRole) => {
    if (!userProfile?.uid) return;
    try {
      const userRef = doc(db, "users", targetUid);
      await updateDoc(userRef, { role: newRole });
      setTeamMembers((prev) =>
        prev.map((m) => (m.uid === targetUid ? { ...m, role: newRole } : m))
      );
      alert(`Successfully updated member's role to ${newRole}`);
    } catch (err: any) {
      console.error("Error updating user role in Firestore:", err);
      alert("Firestore Permission Denied or Error: " + (err.message || "Failed to update role."));
    }
  };

  // Role Capabilities Logic according to Security Rules
  const canCreateShipment = activeRole === "Company Admin" || activeRole === "Fleet Manager" || activeRole === "Dispatcher";
  const canUpdateShipment = activeRole === "Company Admin" || activeRole === "Fleet Manager" || activeRole === "Dispatcher";
  const canDeleteShipment = activeRole === "Company Admin" || activeRole === "Fleet Manager";

  const canAddVehicle = activeRole === "Company Admin" || activeRole === "Fleet Manager" || activeRole === "Dispatcher";
  const canUpdateVehicle = activeRole === "Company Admin" || activeRole === "Fleet Manager" || activeRole === "Dispatcher";
  const canDeleteVehicle = activeRole === "Company Admin" || activeRole === "Fleet Manager";

  const canAddDriver = activeRole === "Company Admin" || activeRole === "Fleet Manager" || activeRole === "Dispatcher";
  const canUpdateDriver = activeRole === "Company Admin" || activeRole === "Fleet Manager" || activeRole === "Dispatcher";
  const canDeleteDriver = activeRole === "Company Admin" || activeRole === "Fleet Manager";

  const canManageInvoices = activeRole === "Company Admin" || activeRole === "Accounts";
  const canManageTeam = activeRole === "Company Admin";

  // Firestore Collections State
  const [shipments, setShipments] = useState<Shipment[]>([]);
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [drivers, setDrivers] = useState<Driver[]>([]);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [teamMembers, setTeamMembers] = useState<FreightUser[]>([]);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [loadingData, setLoadingData] = useState(true);

  // Selected LR for print/view
  const [selectedLrShipment, setSelectedLrShipment] = useState<Shipment | null>(null);

  // Modals
  const [isAddShipmentOpen, setIsAddShipmentOpen] = useState(false);
  const [isAddVehicleOpen, setIsAddVehicleOpen] = useState(false);
  const [isAddDriverOpen, setIsAddDriverOpen] = useState(false);
  const [editingDriver, setEditingDriver] = useState<Driver | null>(null);
  const [isAddInvoiceOpen, setIsAddInvoiceOpen] = useState(false);
  const [isAddMemberOpen, setIsAddMemberOpen] = useState(false);
  const [isAddBranchOpen, setIsAddBranchOpen] = useState(false);
  const [editingBranch, setEditingBranch] = useState<Branch | null>(null);

  // Branch Form State
  const [branchName, setBranchName] = useState("");
  const [branchCity, setBranchCity] = useState("Delhi NCR");
  const [branchState, setBranchState] = useState("Delhi");
  const [branchAddress, setBranchAddress] = useState("");
  const [branchIsHeadOffice, setBranchIsHeadOffice] = useState(false);

  // Selection Branch States for Creation Forms
  const [shipmentBranchId, setShipmentBranchId] = useState("");
  const [vehBranchId, setVehBranchId] = useState("");
  const [driverBranchId, setDriverBranchId] = useState("");

  // Helper to resolve user's branch ID or Head Office branch ID default
  const getDefaultBranchId = (currentBranches: Branch[] = branches): string => {
    if (userProfile?.branchId && currentBranches.some(b => b.id === userProfile.branchId)) {
      return userProfile.branchId;
    }
    const ho = currentBranches.find(b => b.isHeadOffice);
    if (ho) return ho.id;
    return currentBranches[0]?.id || "";
  };

  // Helper to render branch badge label
  const getBranchBadge = (branchId?: string) => {
    if (!branchId) return null;
    const b = branches.find(br => br.id === branchId);
    if (!b) return null;
    return (
      <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-semibold transition-all ${
        b.isHeadOffice
          ? "bg-amber-500/15 text-amber-300 border border-amber-500/30"
          : "bg-slate-800 text-slate-300 border border-slate-700"
      }`}>
        <Building2 className="w-2.5 h-2.5 shrink-0" />
        <span className="truncate max-w-[100px]">{b.branchName || b.city}</span>
        {b.isHeadOffice && <span className="text-[9px] text-amber-400 font-bold ml-0.5">[HO]</span>}
      </span>
    );
  };

  // New Shipment Form State
  const [origin, setOrigin] = useState("Delhi NCR");
  const [destination, setDestination] = useState("Mumbai (Bhiwandi)");
  const [consignor, setConsignor] = useState("Reliable Logistics Corp");
  const [consignee, setConsignee] = useState("Mahindra Automotive Spares");
  const [cargoType, setCargoType] = useState("Auto Ancillary Spares");
  const [weightTons, setWeightTons] = useState("18");
  const [shipmentType, setShipmentType] = useState<ShipmentType>("FTL");
  const [truckType, setTruckType] = useState("32ft MXL Multi-Axle");
  const [shipmentVehicleId, setShipmentVehicleId] = useState("");
  const [shipmentDriverId, setShipmentDriverId] = useState("");
  const [freightAmount, setFreightAmount] = useState("54000");
  const [advancePaid, setAdvancePaid] = useState("15000");
  const [ewayBillNo, setEwayBillNo] = useState("3810 9920 1142");
  const [bookingDate, setBookingDate] = useState(new Date().toISOString().split('T')[0]);
  const [expectedDeliveryDate, setExpectedDeliveryDate] = useState(new Date(Date.now() + 86400000 * 3).toISOString().split('T')[0]);

  // Shipment List Filters & Track Modal State
  const [shipmentSearchQuery, setShipmentSearchQuery] = useState("");
  const [shipmentStatusFilter, setShipmentStatusFilter] = useState<string>("All");
  const [shipmentTypeFilter, setShipmentTypeFilter] = useState<string>("All");
  const [selectedTrackShipment, setSelectedTrackShipment] = useState<Shipment | null>(null);

  // New Vehicle Form State
  const [regNum, setRegNum] = useState("MH 04 FK 9021");
  const [vehModel, setVehModel] = useState("Tata Prima 3530.K");
  const [vehCapacity, setVehCapacity] = useState("18.5");
  const [vehDriver, setVehDriver] = useState("Sartaj Singh");
  const [vehDriverId, setVehDriverId] = useState("");

  // Driver Form State
  const [driverFullName, setDriverFullName] = useState("");
  const [driverPhone, setDriverPhone] = useState("");
  const [driverLicenseNo, setDriverLicenseNo] = useState("");
  const [driverLicenseExpiry, setDriverLicenseExpiry] = useState("");
  const [driverLicenseType, setDriverLicenseType] = useState<DriverLicenseType>("Transport");
  const [driverStatus, setDriverStatus] = useState<DriverStatus>("Active");
  const [driverAssignedVehicleId, setDriverAssignedVehicleId] = useState("");
  const [driverAddress, setDriverAddress] = useState("");
  const [driverJoiningDate, setDriverJoiningDate] = useState("");
  const [driverEmail, setDriverEmail] = useState("");
  const [driverPassword, setDriverPassword] = useState("");
  const [isProvisioningDriverAuth, setIsProvisioningDriverAuth] = useState(false);

  // Driver Table Filters
  const [driverSearchQuery, setDriverSearchQuery] = useState("");
  const [driverStatusFilter, setDriverStatusFilter] = useState<string>("All");

  // Helper for License Expiry calculations (30 days highlight or expired)
  const getLicenseExpiryInfo = (expiryStr?: string) => {
    if (!expiryStr) return { isExpired: false, isExpiringSoon: false, daysLeft: 999 };
    const expiryDate = new Date(expiryStr);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const diffTime = expiryDate.getTime() - today.getTime();
    const daysLeft = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return {
      isExpired: daysLeft < 0,
      isExpiringSoon: daysLeft >= 0 && daysLeft <= 30,
      daysLeft
    };
  };

  // New Invoice Form State
  const [invLrNum, setInvLrNum] = useState("LR-2026-9001");
  const [invClient, setInvClient] = useState("Havells India Electricals");
  const [invAmount, setInvAmount] = useState("58000");

  // New Team Member Form State
  const [memberEmail, setMemberEmail] = useState("");
  const [memberName, setMemberName] = useState("");
  const [memberRole, setMemberRole] = useState<UserRole>("Dispatcher");

  const companyId = userProfile?.companyId || companyProfile?.id;

  // Helpers to detect active shipments for vehicles and drivers
  const getActiveShipmentForVehicle = (v: Vehicle) => {
    return shipments.find(s =>
      (s.assignedVehicleId === v.id || (s.assignedTruckNumber && s.assignedTruckNumber.toLowerCase() === v.registrationNumber.toLowerCase())) &&
      s.status !== "Delivered" &&
      s.status !== "Cancelled"
    );
  };

  const getActiveShipmentForDriver = (d: Driver) => {
    return shipments.find(s =>
      (s.assignedDriverId === d.id || (s.driverName && s.driverName.toLowerCase() === d.fullName.toLowerCase())) &&
      s.status !== "Delivered" &&
      s.status !== "Cancelled"
    );
  };

  // Fetch Firestore Data
  const loadCompanyData = async () => {
    if (!companyId) return;
    setLoadingData(true);
    try {
      // 0. Fetch Branches for this company
      const qBranches = query(collection(db, "branches"), where("companyId", "==", companyId));
      const snapBranches = await getDocs(qBranches);
      const fetchedBranches: Branch[] = [];
      snapBranches.forEach((docSnap) => {
        fetchedBranches.push({ id: docSnap.id, ...docSnap.data() } as Branch);
      });

      // Auto-create Head Office branch if none exists in Firestore
      if (fetchedBranches.length === 0) {
        const hoCity = companyProfile?.city || "Mumbai";
        const hoData = {
          companyId,
          branchName: `${hoCity} Head Office Hub`,
          city: hoCity,
          state: companyProfile?.state || "Maharashtra",
          address: `Central Logistics Terminal, ${hoCity}`,
          isHeadOffice: true,
          createdAt: new Date().toISOString()
        };

        try {
          const bRef = await addDoc(collection(db, "branches"), hoData);
          fetchedBranches.push({ id: bRef.id, ...hoData });
        } catch (e) {
          console.warn("Seeding branch skipped due to rules:", e);
        }
      }

      setBranches(fetchedBranches);
      const defaultBranchId = fetchedBranches.find(b => b.isHeadOffice)?.id || fetchedBranches[0]?.id || "";

      // 1. Fetch Vehicles for this company
      const qVehicles = query(collection(db, "vehicles"), where("companyId", "==", companyId));
      const snapVehicles = await getDocs(qVehicles);
      const fetchedVehicles: Vehicle[] = [];
      snapVehicles.forEach((docSnap) => {
        fetchedVehicles.push({ id: docSnap.id, ...docSnap.data() } as Vehicle);
      });

      // Seed initial fleet vehicles if empty
      if (fetchedVehicles.length === 0 && canAddVehicle) {
        const seedV1: Omit<Vehicle, "id"> = {
          companyId,
          branchId: defaultBranchId,
          registrationNumber: "MH 04 FK 8812",
          model: "Tata Prima 3530.K",
          capacityTons: 18.5,
          type: "32ft MXL",
          status: "En-Route",
          fastagBalance: 4250,
          driverName: "Gurpreet Singh",
          lastLocation: "NH48 near Vadodara Toll"
        };
        const seedV2: Omit<Vehicle, "id"> = {
          companyId,
          branchId: defaultBranchId,
          registrationNumber: "KA 01 E 4092",
          model: "Ashok Leyland 2820",
          capacityTons: 14,
          type: "20ft Open Body",
          status: "Available",
          fastagBalance: 1800,
          driverName: "M. K. Venkatesh",
          lastLocation: "Bengaluru Logistics Park"
        };

        try {
          const vRef1 = await addDoc(collection(db, "vehicles"), seedV1);
          const vRef2 = await addDoc(collection(db, "vehicles"), seedV2);
          fetchedVehicles.push({ id: vRef1.id, ...seedV1 }, { id: vRef2.id, ...seedV2 });
        } catch (e) {
          console.warn("Seeding vehicles skipped due to rules:", e);
        }
      }

      setVehicles(fetchedVehicles);

      // 2. Fetch Drivers for this company
      const qDrivers = query(collection(db, "drivers"), where("companyId", "==", companyId));
      const snapDrivers = await getDocs(qDrivers);
      const fetchedDrivers: Driver[] = [];
      snapDrivers.forEach((docSnap) => {
        fetchedDrivers.push({ id: docSnap.id, ...docSnap.data() } as Driver);
      });

      // Seed initial company drivers if empty
      if (fetchedDrivers.length === 0 && canAddDriver) {
        const todayMs = Date.now();
        const seedD1: Omit<Driver, "id"> = {
          companyId,
          branchId: defaultBranchId,
          fullName: "Gurpreet Singh",
          phoneNumber: "+91 98112 34567",
          licenseNumber: "DL-042019008812",
          licenseExpiry: new Date(todayMs + 86400000 * 18).toISOString().split('T')[0], // expiring in 18 days
          licenseType: "Transport",
          status: "Active",
          address: "Plot 14, Transport Nagar, New Delhi",
          joiningDate: "2021-04-15",
          assignedVehicleId: fetchedVehicles[0]?.id || "",
          createdAt: new Date().toISOString()
        };

        const seedD2: Omit<Driver, "id"> = {
          companyId,
          branchId: defaultBranchId,
          fullName: "M. K. Venkatesh",
          phoneNumber: "+91 94432 10987",
          licenseNumber: "KA-012015004092",
          licenseExpiry: new Date(todayMs + 86400000 * 365).toISOString().split('T')[0], // valid 1 year
          licenseType: "HMV",
          status: "Active",
          address: "No 88, Electronic City Phase 1, Bengaluru",
          joiningDate: "2022-09-01",
          assignedVehicleId: fetchedVehicles[1]?.id || "",
          createdAt: new Date().toISOString()
        };

        const seedD3: Omit<Driver, "id"> = {
          companyId,
          branchId: defaultBranchId,
          fullName: "Sartaj Singh",
          phoneNumber: "+91 98765 43210",
          licenseNumber: "PB-102018003344",
          licenseExpiry: new Date(todayMs - 86400000 * 5).toISOString().split('T')[0], // expired 5 days ago
          licenseType: "Transport",
          status: "On Leave",
          address: "GT Road, Ludhiana, Punjab",
          joiningDate: "2020-01-10",
          assignedVehicleId: "",
          createdAt: new Date().toISOString()
        };

        try {
          const dRef1 = await addDoc(collection(db, "drivers"), seedD1);
          const dRef2 = await addDoc(collection(db, "drivers"), seedD2);
          const dRef3 = await addDoc(collection(db, "drivers"), seedD3);
          fetchedDrivers.push(
            { id: dRef1.id, ...seedD1 },
            { id: dRef2.id, ...seedD2 },
            { id: dRef3.id, ...seedD3 }
          );
        } catch (e) {
          console.warn("Seeding drivers skipped due to rules:", e);
        }
      }

      setDrivers(fetchedDrivers);

      // 3. Fetch Shipments for this company
      const qShipments = query(collection(db, "shipments"), where("companyId", "==", companyId));
      const snapShipments = await getDocs(qShipments);
      const fetchedShipments: Shipment[] = [];
      snapShipments.forEach((docSnap) => {
        fetchedShipments.push({ id: docSnap.id, ...docSnap.data() } as Shipment);
      });

      // Seed initial shipments if empty
      if (fetchedShipments.length === 0 && canCreateShipment) {
        const seed1: Omit<Shipment, "id"> = {
          companyId,
          branchId: defaultBranchId,
          lrNumber: "LR-2026-9001",
          origin: "Delhi NCR",
          destination: "Mumbai (Bhiwandi)",
          consignor: "Havells India Electricals",
          consignee: "Croma Retail Distribution Hub",
          cargoType: "Electrical Consumer Durables",
          shipmentType: "FTL",
          weightTons: 16,
          truckType: "32ft MXL Multi-Axle",
          assignedVehicleId: fetchedVehicles[0]?.id || undefined,
          assignedTruckNumber: fetchedVehicles[0]?.registrationNumber || "MH 04 FK 8812",
          assignedDriverId: fetchedDrivers[0]?.id || undefined,
          driverName: fetchedDrivers[0]?.fullName || "Gurpreet Singh",
          driverPhone: fetchedDrivers[0]?.phoneNumber || "+91 98112 34567",
          freightAmount: 58000,
          advancePaid: 20000,
          ewayBillNo: "3810 9920 4412",
          status: "In Transit",
          bookingDate: new Date(Date.now() - 86400000 * 2).toISOString().split('T')[0],
          expectedDeliveryDate: new Date(Date.now() + 86400000 * 1).toISOString().split('T')[0],
          statusHistory: [
            { status: "Booked", timestamp: new Date(Date.now() - 86400000 * 2).toISOString(), updatedByRole: "Dispatcher", note: "Booking created and LR generated" },
            { status: "Loaded", timestamp: new Date(Date.now() - 86400000 * 1.5).toISOString(), updatedByRole: "Fleet Manager", note: "Cargo inspected and loaded at Delhi Hub" },
            { status: "In Transit", timestamp: new Date(Date.now() - 86400000 * 1).toISOString(), updatedByRole: "Dispatcher", note: "Vehicle departed and en-route to Mumbai" }
          ],
          createdAt: new Date(Date.now() - 86400000 * 2).toISOString()
        };

        const seed2: Omit<Shipment, "id"> = {
          companyId,
          lrNumber: "LR-2026-9002",
          origin: "Bengaluru",
          destination: "Chennai Port",
          consignor: "TVS Motor Component Hub",
          consignee: "Hyundai Export Ancillary",
          cargoType: "Precision Machine Parts",
          shipmentType: "Express",
          weightTons: 12,
          truckType: "20ft Container",
          assignedVehicleId: fetchedVehicles[1]?.id || undefined,
          assignedTruckNumber: fetchedVehicles[1]?.registrationNumber || "KA 01 E 4092",
          assignedDriverId: fetchedDrivers[1]?.id || undefined,
          driverName: fetchedDrivers[1]?.fullName || "M. K. Venkatesh",
          driverPhone: fetchedDrivers[1]?.phoneNumber || "+91 94432 10987",
          freightAmount: 32000,
          advancePaid: 10000,
          ewayBillNo: "8821 0049 2231",
          status: "Loaded",
          bookingDate: new Date(Date.now() - 86400000 * 1).toISOString().split('T')[0],
          expectedDeliveryDate: new Date(Date.now() + 86400000 * 2).toISOString().split('T')[0],
          statusHistory: [
            { status: "Booked", timestamp: new Date(Date.now() - 86400000 * 1).toISOString(), updatedByRole: "Dispatcher", note: "Booking created" },
            { status: "Loaded", timestamp: new Date(Date.now() - 86400000 * 0.5).toISOString(), updatedByRole: "Fleet Manager", note: "Container locked and sealed" }
          ],
          createdAt: new Date(Date.now() - 86400000 * 1).toISOString()
        };

        try {
          const docRef1 = await addDoc(collection(db, "shipments"), seed1);
          const docRef2 = await addDoc(collection(db, "shipments"), seed2);
          fetchedShipments.push({ id: docRef1.id, ...seed1 });
          fetchedShipments.push({ id: docRef2.id, ...seed2 });
        } catch (e) {
          console.warn("Seeding shipments skipped due to rules:", e);
        }
      }

      setShipments(fetchedShipments);

      // 4. Fetch Invoices for this company
      const qInvoices = query(collection(db, "invoices"), where("companyId", "==", companyId));
      const snapInvoices = await getDocs(qInvoices);
      const fetchedInvoices: Invoice[] = [];
      snapInvoices.forEach((docSnap) => {
        fetchedInvoices.push({ id: docSnap.id, ...docSnap.data() } as Invoice);
      });

      if (fetchedInvoices.length === 0 && canManageInvoices) {
        const seedInv1: Omit<Invoice, "id"> = {
          companyId,
          invoiceNumber: "INV-2026-001",
          lrNumber: "LR-2026-9001",
          clientName: "Havells India Electricals",
          amount: 58000,
          gstAmount: 2900,
          totalAmount: 60900,
          status: "Issued",
          dueDate: new Date(Date.now() + 86400000 * 15).toISOString().split('T')[0],
          createdAt: new Date().toISOString()
        };
        try {
          const invRef1 = await addDoc(collection(db, "invoices"), seedInv1);
          fetchedInvoices.push({ id: invRef1.id, ...seedInv1 });
        } catch (e) {
          console.warn("Seeding invoices skipped due to rules:", e);
        }
      }

      setInvoices(fetchedInvoices);

      // 4. Fetch Team Members for this company from 'users' collection
      const qUsers = query(collection(db, "users"), where("companyId", "==", companyId));
      const snapUsers = await getDocs(qUsers);
      const fetchedUsers: FreightUser[] = [];
      snapUsers.forEach((docSnap) => {
        fetchedUsers.push(docSnap.data() as FreightUser);
      });

      if (fetchedUsers.length === 0 && userProfile) {
        fetchedUsers.push(userProfile);
      }

      setTeamMembers(fetchedUsers);

    } catch (err) {
      console.error("Error loading company Firestore collections:", err);
    } finally {
      setLoadingData(false);
    }
  };

  useEffect(() => {
    loadCompanyData();
  }, [companyId, activeRole]);

  // Geolocation watchPosition Effect for active "In Transit" shipments
  useEffect(() => {
    const inTransitShipments = shipments.filter((s) => s.status === "In Transit");
    if (userProfile?.role !== "Driver" || inTransitShipments.length === 0) return;

    if (!navigator.geolocation) {
      console.warn("Geolocation API not available in browser.");
      return;
    }

    let lastWriteTime = 0;
    const WRITE_THROTTLE_MS = 30000; // Record every 30-60 seconds

    const recordLocationPing = async (lat: number, lng: number) => {
      const now = Date.now();
      if (now - lastWriteTime < WRITE_THROTTLE_MS) return;
      lastWriteTime = now;

      for (const shp of inTransitShipments) {
        try {
          const currentUid = auth.currentUser?.uid || userProfile?.uid || shp.assignedDriverId || "driver-1";
          const locData = {
            driverId: currentUid,
            shipmentId: shp.id,
            companyId: shp.companyId || companyId || "",
            latitude: Number(lat.toFixed(6)),
            longitude: Number(lng.toFixed(6)),
            timestamp: new Date().toISOString()
          };
          await addDoc(collection(db, "driverLocations"), locData);
        } catch (err) {
          console.error("Failed to write watchPosition location to driverLocations:", err);
        }
      }
    };

    const watchId = navigator.geolocation.watchPosition(
      (pos) => {
        recordLocationPing(pos.coords.latitude, pos.coords.longitude);
      },
      (err) => {
        console.warn("Geolocation watchPosition notice:", err.message);
      },
      {
        enableHighAccuracy: true,
        maximumAge: 30000,
        timeout: 27000
      }
    );

    const intervalId = setInterval(() => {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          recordLocationPing(pos.coords.latitude, pos.coords.longitude);
        },
        () => {},
        { enableHighAccuracy: true, timeout: 10000 }
      );
    }, 45000);

    return () => {
      navigator.geolocation.clearWatch(watchId);
      clearInterval(intervalId);
    };
  }, [shipments, companyId]);

  // Create new shipment / LR (Allowed for Admin, Fleet Manager, Dispatcher)
  const handleCreateShipment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canCreateShipment) {
      alert("Role Permission Denied: Only Company Admin, Fleet Manager, or Dispatcher can create shipments.");
      return;
    }

    // Validate vehicle status
    if (shipmentVehicleId) {
      const selectedVeh = vehicles.find(v => v.id === shipmentVehicleId);
      if (selectedVeh) {
        const activeVehShipment = getActiveShipmentForVehicle(selectedVeh);
        if (selectedVeh.status === "En-Route" || activeVehShipment) {
          const lrInfo = activeVehShipment ? activeVehShipment.lrNumber : "another delivery";
          alert(`Assignment Blocked: Vehicle ${selectedVeh.registrationNumber} is currently on delivery (${lrInfo}) and cannot be assigned until it is marked Delivered or Cancelled.`);
          return;
        }
        if (selectedVeh.status === "Maintenance") {
          alert(`Assignment Blocked: Vehicle ${selectedVeh.registrationNumber} is currently in Maintenance and cannot be assigned to new shipments.`);
          return;
        }
      }
    }

    // Validate driver status
    if (shipmentDriverId) {
      const selectedDrv = drivers.find(d => d.id === shipmentDriverId);
      if (selectedDrv) {
        const activeDrvShipment = getActiveShipmentForDriver(selectedDrv);
        if (activeDrvShipment) {
          alert(`Assignment Blocked: Driver ${selectedDrv.fullName} is currently assigned to an active delivery (${activeDrvShipment.lrNumber}) and cannot be assigned until it is marked Delivered or Cancelled.`);
          return;
        }
        if (selectedDrv.status !== "Active") {
          alert(`Assignment Blocked: Driver ${selectedDrv.fullName} status is '${selectedDrv.status}' and cannot be assigned to a new shipment.`);
          return;
        }
      }
    }

    try {
      const lrNumber = `LR-2026-${Math.floor(1000 + Math.random() * 9000)}`;
      const selectedVeh = vehicles.find(v => v.id === shipmentVehicleId);
      const selectedDrv = drivers.find(d => d.id === shipmentDriverId);

      const assignedTruckNumber = selectedVeh ? selectedVeh.registrationNumber : undefined;
      const driverName = selectedDrv ? selectedDrv.fullName : (selectedVeh?.driverName || undefined);
      const driverPhone = selectedDrv ? selectedDrv.phoneNumber : undefined;

      const nowIso = new Date().toISOString();
      const initialHistoryItem: ShipmentStatusHistoryItem = {
        status: "Booked",
        timestamp: nowIso,
        updatedByRole: activeRole,
        note: "Initial booking created & LR generated"
      };

      const newShipmentData: Omit<Shipment, "id"> = {
        companyId,
        branchId: shipmentBranchId || getDefaultBranchId(),
        lrNumber,
        origin,
        destination,
        consignor,
        consignee,
        cargoType,
        shipmentType,
        weightTons: Number(weightTons) || 10,
        truckType: selectedVeh ? `${selectedVeh.type} (${selectedVeh.model})` : (truckType || "32ft MXL"),
        assignedVehicleId: shipmentVehicleId || undefined,
        assignedTruckNumber,
        assignedDriverId: shipmentDriverId || undefined,
        driverName,
        driverPhone,
        freightAmount: Number(freightAmount) || 45000,
        advancePaid: Number(advancePaid) || 10000,
        ewayBillNo,
        status: "Booked",
        bookingDate: bookingDate || new Date().toISOString().split('T')[0],
        expectedDeliveryDate: expectedDeliveryDate || new Date(Date.now() + 86400000 * 3).toISOString().split('T')[0],
        statusHistory: [initialHistoryItem],
        createdAt: nowIso
      };

      const docRef = await addDoc(collection(db, "shipments"), newShipmentData);
      setShipments((prev) => [{ id: docRef.id, ...newShipmentData }, ...prev]);
      setIsAddShipmentOpen(false);
    } catch (err) {
      console.error("Error creating shipment in Firestore:", err);
      alert("Firestore Security Rule Denied: Your role does not have write access for shipments.");
    }
  };

  // Delete shipment (Allowed for Admin & Fleet Manager ONLY)
  const handleDeleteShipment = async (shipmentId: string) => {
    if (!canDeleteShipment) {
      alert("Permission Denied: Only Company Admin and Fleet Manager can delete shipments. Dispatcher and Accounts cannot delete.");
      return;
    }
    if (!confirm("Are you sure you want to delete this shipment?")) return;
    try {
      await deleteDoc(doc(db, "shipments", shipmentId));
      setShipments((prev) => prev.filter((s) => s.id !== shipmentId));
      if (selectedTrackShipment?.id === shipmentId) {
        setSelectedTrackShipment(null);
      }
    } catch (err) {
      console.error("Error deleting shipment:", err);
      alert("Firestore Security Rule Denied: Failed to delete shipment document.");
    }
  };

  // Update shipment status in Firestore with statusHistory logging & vehicle status updates
  const handleAdvanceShipmentStatus = async (shipment: Shipment, targetStatus: ShipmentStatus, customNote?: string) => {
    if (!canUpdateShipment) {
      alert("Role Permission Denied: Accounts role cannot modify shipment status.");
      return;
    }
    try {
      const nowIso = new Date().toISOString();
      const newHistoryItem: ShipmentStatusHistoryItem = {
        status: targetStatus,
        timestamp: nowIso,
        updatedByRole: activeRole,
        note: customNote || `Status changed from ${shipment.status} to ${targetStatus}`
      };
      const updatedHistory = [...(shipment.statusHistory || []), newHistoryItem];

      const shipRef = doc(db, "shipments", shipment.id);
      await updateDoc(shipRef, {
        status: targetStatus,
        statusHistory: updatedHistory
      });

      // Update vehicle status reflection:
      // If shipment goes "In Transit", vehicle becomes "En-Route"
      // If shipment goes "Delivered" or "Cancelled", vehicle becomes "Available"
      if (shipment.assignedVehicleId) {
        const linkedVeh = vehicles.find(v => v.id === shipment.assignedVehicleId || v.registrationNumber === shipment.assignedTruckNumber);
        if (linkedVeh) {
          let nextVehStatus: "Available" | "En-Route" | "Maintenance" | null = null;
          if (targetStatus === "In Transit") {
            nextVehStatus = "En-Route";
          } else if (targetStatus === "Delivered" || targetStatus === "Cancelled") {
            nextVehStatus = "Available";
          }
          if (nextVehStatus && nextVehStatus !== linkedVeh.status) {
            try {
              const vehRef = doc(db, "vehicles", linkedVeh.id);
              await updateDoc(vehRef, { status: nextVehStatus });
              setVehicles(prev => prev.map(v => v.id === linkedVeh.id ? { ...v, status: nextVehStatus! } : v));
            } catch (vErr) {
              console.warn("Auto-update vehicle status skipped due to rules:", vErr);
            }
          }
        }
      }

      const updatedShipmentObj: Shipment = {
        ...shipment,
        status: targetStatus,
        statusHistory: updatedHistory
      };

      setShipments((prev) =>
        prev.map((s) => (s.id === shipment.id ? updatedShipmentObj : s))
      );

      if (selectedTrackShipment?.id === shipment.id) {
        setSelectedTrackShipment(updatedShipmentObj);
      }
    } catch (err: any) {
      console.error("Error updating shipment status:", err);
      alert("Firestore Security Rule Denied: Cannot update status. " + (err.message || ""));
    }
  };

  // Add vehicle to fleet (Allowed for Admin, Fleet Manager, Dispatcher)
  const handleAddVehicle = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canAddVehicle) {
      alert("Role Permission Denied: Accounts role cannot add vehicles to fleet.");
      return;
    }

    const maxVehicles = companyProfile?.maxVehicles || (companyProfile?.subscriptionPlan === "Growth" ? 30 : companyProfile?.subscriptionPlan === "Starter" ? 10 : 10);
    if (vehicles.length >= maxVehicles) {
      alert(`Vehicle Limit Reached (${vehicles.length} / ${maxVehicles} vehicles): Your current ${companyProfile?.subscriptionPlan || "Starter"} subscription allows a maximum of ${maxVehicles} vehicles. Please upgrade to the Growth Plan under Pricing & Subscription for up to 30 vehicles.`);
      setIsAddVehicleOpen(false);
      setActiveTab("pricing");
      return;
    }

    try {
      const newVehData: Omit<Vehicle, "id"> = {
        companyId,
        branchId: vehBranchId || getDefaultBranchId(),
        registrationNumber: regNum.toUpperCase(),
        model: vehModel,
        capacityTons: Number(vehCapacity) || 15,
        type: "Multi-Axle Truck",
        status: "Available",
        fastagBalance: 3000,
        driverName: vehDriver || "Unassigned",
        assignedDriverId: vehDriverId || undefined,
        lastLocation: "HQ Depot"
      };

      const docRef = await addDoc(collection(db, "vehicles"), newVehData);
      setVehicles((prev) => [{ id: docRef.id, ...newVehData }, ...prev]);
      setIsAddVehicleOpen(false);
    } catch (err) {
      console.error("Error adding vehicle:", err);
      alert("Firestore Security Rule Denied: Failed to add vehicle.");
    }
  };

  // Driver CRUD Handlers (Company Admin, Fleet Manager, Dispatcher: C/U; Admin & Fleet Manager: D; Accounts: Read)
  const resetDriverForm = () => {
    setEditingDriver(null);
    setDriverFullName("");
    setDriverPhone("");
    setDriverLicenseNo("");
    setDriverLicenseExpiry(new Date(Date.now() + 86400000 * 365).toISOString().split('T')[0]);
    setDriverLicenseType("Transport");
    setDriverStatus("Active");
    setDriverAssignedVehicleId("");
    setDriverAddress("");
    setDriverJoiningDate(new Date().toISOString().split('T')[0]);
    setDriverEmail("");
    setDriverPassword("");
  };

  const handleOpenAddDriver = () => {
    resetDriverForm();
    setIsAddDriverOpen(true);
  };

  const handleOpenEditDriver = (driver: Driver) => {
    setEditingDriver(driver);
    setDriverFullName(driver.fullName);
    setDriverPhone(driver.phoneNumber);
    setDriverLicenseNo(driver.licenseNumber);
    setDriverLicenseExpiry(driver.licenseExpiry || "");
    setDriverLicenseType(driver.licenseType || "Transport");
    setDriverStatus(driver.status || "Active");
    setDriverAssignedVehicleId(driver.assignedVehicleId || "");
    setDriverAddress(driver.address || "");
    setDriverJoiningDate(driver.joiningDate || "");
    setDriverEmail(driver.email || "");
    setDriverPassword("");
    setIsAddDriverOpen(true);
  };

  const handleSaveDriver = async (e: React.FormEvent) => {
    e.preventDefault();
    if (editingDriver ? !canUpdateDriver : !canAddDriver) {
      alert(`Role Permission Denied: Only Company Admin, Fleet Manager, or Dispatcher can ${editingDriver ? 'update' : 'add'} drivers.`);
      return;
    }

    try {
      setIsProvisioningDriverAuth(true);

      let createdAuthUid = editingDriver?.authUid || "";
      const emailTrimmed = driverEmail.trim().toLowerCase();
      const passTrimmed = driverPassword.trim();

      // If email and password provided, create real Firebase Auth user account
      if (emailTrimmed && passTrimmed && !createdAuthUid) {
        try {
          createdAuthUid = await createDriverAuthAccount(emailTrimmed, passTrimmed);
        } catch (authErr: any) {
          console.error("Driver Firebase Auth Account Creation Error:", authErr);
          alert(`Failed to create Driver Auth account: ${authErr.message || authErr}`);
          setIsProvisioningDriverAuth(false);
          return;
        }
      }

      const driverPayload = {
        companyId,
        branchId: driverBranchId || editingDriver?.branchId || getDefaultBranchId(),
        fullName: driverFullName.trim(),
        phoneNumber: driverPhone.trim(),
        licenseNumber: driverLicenseNo.trim().toUpperCase(),
        licenseExpiry: driverLicenseExpiry,
        licenseType: driverLicenseType,
        status: driverStatus,
        assignedVehicleId: driverAssignedVehicleId || "",
        address: driverAddress.trim(),
        joiningDate: driverJoiningDate,
        email: emailTrimmed || editingDriver?.email || "",
        authUid: createdAuthUid || editingDriver?.authUid || "",
        createdAt: editingDriver?.createdAt || new Date().toISOString()
      };

      let finalDriverId = editingDriver?.id || "";

      if (editingDriver) {
        const dRef = doc(db, "drivers", editingDriver.id);
        await updateDoc(dRef, driverPayload);
        setDrivers((prev) =>
          prev.map((d) => (d.id === editingDriver.id ? { id: editingDriver.id, ...driverPayload } : d))
        );
      } else {
        const docRef = await addDoc(collection(db, "drivers"), driverPayload);
        finalDriverId = docRef.id;
        setDrivers((prev) => [{ id: finalDriverId, ...driverPayload }, ...prev]);
      }

      // Create corresponding users collection document if createdAuthUid exists
      if (createdAuthUid && finalDriverId) {
        const userDocRef = doc(db, "users", createdAuthUid);
        const userDocData: FreightUser = {
          uid: createdAuthUid,
          email: emailTrimmed || "driver@thadam.in",
          displayName: driverFullName.trim(),
          companyId,
          companyName: companyProfile?.name || userProfile?.companyName || "Freight Transporter",
          role: "Driver",
          phone: driverPhone.trim(),
          branchId: driverBranchId || getDefaultBranchId(),
          driverRecordId: finalDriverId,
          createdAt: new Date().toISOString()
        };
        await setDoc(userDocRef, userDocData);
      }

      // If driver was assigned a vehicle, sync the vehicle's driverName & assignedDriverId
      if (driverAssignedVehicleId) {
        const linkedVeh = vehicles.find(v => v.id === driverAssignedVehicleId);
        if (linkedVeh) {
          const vRef = doc(db, "vehicles", linkedVeh.id);
          await updateDoc(vRef, {
            driverName: driverFullName.trim(),
            assignedDriverId: finalDriverId
          });
          setVehicles((prev) =>
            prev.map(v => v.id === linkedVeh.id ? { ...v, driverName: driverFullName.trim(), assignedDriverId: finalDriverId } : v)
          );
        }
      }

      setIsAddDriverOpen(false);
      resetDriverForm();
    } catch (err) {
      console.error("Error saving driver in Firestore:", err);
      alert("Firestore Security Rule Denied: Cannot write driver document.");
    } finally {
      setIsProvisioningDriverAuth(false);
    }
  };

  const handleDeleteDriver = async (driverId: string) => {
    if (!canDeleteDriver) {
      alert("Permission Denied: Only Company Admin and Fleet Manager can delete drivers. Dispatcher and Accounts cannot delete.");
      return;
    }
    if (!confirm("Are you sure you want to delete this driver record?")) return;
    try {
      await deleteDoc(doc(db, "drivers", driverId));
      setDrivers((prev) => prev.filter((d) => d.id !== driverId));
    } catch (err) {
      console.error("Error deleting driver:", err);
      alert("Firestore Security Rule Denied: Failed to delete driver document.");
    }
  };

  // Branch Management CRUD Handlers (Company Admin ONLY for write operations)
  const handleOpenAddBranch = () => {
    if (activeRole !== "Company Admin") {
      alert("Permission Denied: Only Company Admin can add or edit company branches.");
      return;
    }
    setEditingBranch(null);
    setBranchName("");
    setBranchCity("Delhi NCR");
    setBranchState("Delhi");
    setBranchAddress("");
    setBranchIsHeadOffice(branches.length === 0);
    setIsAddBranchOpen(true);
  };

  const handleOpenEditBranch = (branch: Branch) => {
    if (activeRole !== "Company Admin") {
      alert("Permission Denied: Only Company Admin can edit company branches.");
      return;
    }
    setEditingBranch(branch);
    setBranchName(branch.branchName);
    setBranchCity(branch.city);
    setBranchState(branch.state || "");
    setBranchAddress(branch.address || "");
    setBranchIsHeadOffice(branch.isHeadOffice);
    setIsAddBranchOpen(true);
  };

  const handleSaveBranch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (activeRole !== "Company Admin") {
      alert("Permission Denied: Only Company Admin can create or update company branches.");
      return;
    }
    if (!branchName.trim() || !branchCity.trim()) {
      alert("Please enter both Branch Name and City.");
      return;
    }

    try {
      const nowIso = new Date().toISOString();

      // If user marks this branch as Head Office, unmark all other branches for this company
      if (branchIsHeadOffice) {
        const otherHOs = branches.filter(b => b.isHeadOffice && b.id !== editingBranch?.id);
        for (const oldHo of otherHOs) {
          try {
            await updateDoc(doc(db, "branches", oldHo.id), { isHeadOffice: false });
          } catch (e) {
            console.warn("Error unmarking previous HO branch:", e);
          }
        }
      }

      if (editingBranch) {
        const branchRef = doc(db, "branches", editingBranch.id);
        const updateData = {
          branchName: branchName.trim(),
          city: branchCity.trim(),
          state: branchState.trim() || "State",
          address: branchAddress.trim() || "",
          isHeadOffice: branchIsHeadOffice
        };
        await updateDoc(branchRef, updateData);
        setBranches((prev) =>
          prev.map((b) =>
            b.id === editingBranch.id
              ? { ...b, ...updateData }
              : branchIsHeadOffice
              ? { ...b, isHeadOffice: false }
              : b
          )
        );
      } else {
        const newBranchData = {
          companyId,
          branchName: branchName.trim(),
          city: branchCity.trim(),
          state: branchState.trim() || "State",
          address: branchAddress.trim() || "",
          isHeadOffice: branchIsHeadOffice || branches.length === 0,
          createdAt: nowIso
        };
        const docRef = await addDoc(collection(db, "branches"), newBranchData);
        setBranches((prev) => [
          ...prev.map((b) => (branchIsHeadOffice ? { ...b, isHeadOffice: false } : b)),
          { id: docRef.id, ...newBranchData }
        ]);
      }

      setIsAddBranchOpen(false);
      setEditingBranch(null);
      setBranchName("");
      setBranchCity("");
      setBranchAddress("");
      setBranchIsHeadOffice(false);
    } catch (err: any) {
      console.error("Error saving branch in Firestore:", err);
      alert("Firestore Security Rule Denied: " + (err.message || "Cannot write branch document. Only Company Admin has write permissions."));
    }
  };

  const handleDeleteBranch = async (branchIdToDelete: string) => {
    if (activeRole !== "Company Admin") {
      alert("Permission Denied: Only Company Admin can delete company branches.");
      return;
    }
    const targetB = branches.find((b) => b.id === branchIdToDelete);
    if (targetB?.isHeadOffice && branches.length > 1) {
      alert("Cannot delete the Head Office branch. Please designate another branch as Head Office before deleting this one.");
      return;
    }
    if (!confirm(`Are you sure you want to delete the branch '${targetB?.branchName || 'Selected Branch'}'?`)) return;

    try {
      await deleteDoc(doc(db, "branches", branchIdToDelete));
      setBranches((prev) => prev.filter((b) => b.id !== branchIdToDelete));
    } catch (err: any) {
      console.error("Error deleting branch in Firestore:", err);
      alert("Firestore Security Rule Denied: Failed to delete branch document.");
    }
  };

  // Delete vehicle (Allowed for Admin & Fleet Manager ONLY)
  const handleDeleteVehicle = async (vehicleId: string) => {
    if (!canDeleteVehicle) {
      alert("Permission Denied: Only Company Admin and Fleet Manager can delete fleet vehicles.");
      return;
    }
    if (!confirm("Are you sure you want to delete this vehicle?")) return;
    try {
      await deleteDoc(doc(db, "vehicles", vehicleId));
      setVehicles((prev) => prev.filter((v) => v.id !== vehicleId));
    } catch (err) {
      console.error("Error deleting vehicle:", err);
      alert("Firestore Security Rule Denied: Failed to delete vehicle.");
    }
  };

  // Add Invoice (Allowed for Company Admin & Accounts)
  const handleCreateInvoice = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canManageInvoices) {
      alert("Permission Denied: Only Company Admin and Accounts roles can create invoices.");
      return;
    }
    try {
      const amt = Number(invAmount) || 50000;
      const gst = amt * 0.05;
      const newInvoice: Omit<Invoice, "id"> = {
        companyId,
        invoiceNumber: `INV-2026-${Math.floor(100 + Math.random() * 900)}`,
        lrNumber: invLrNum,
        clientName: invClient,
        amount: amt,
        gstAmount: gst,
        totalAmount: amt + gst,
        status: "Issued",
        dueDate: new Date(Date.now() + 86400000 * 15).toISOString().split('T')[0],
        createdAt: new Date().toISOString()
      };

      const docRef = await addDoc(collection(db, "invoices"), newInvoice);
      setInvoices((prev) => [{ id: docRef.id, ...newInvoice }, ...prev]);
      setIsAddInvoiceOpen(false);
    } catch (err) {
      console.error("Error creating invoice:", err);
      alert("Firestore Security Rule Denied: Cannot create invoice document.");
    }
  };

  // Delete Invoice (Allowed for Company Admin & Accounts)
  const handleDeleteInvoice = async (invoiceId: string) => {
    if (!canManageInvoices) {
      alert("Permission Denied: Only Company Admin and Accounts roles can delete invoices.");
      return;
    }
    if (!confirm("Are you sure you want to delete this invoice?")) return;
    try {
      await deleteDoc(doc(db, "invoices", invoiceId));
      setInvoices((prev) => prev.filter((i) => i.id !== invoiceId));
    } catch (err) {
      console.error("Error deleting invoice:", err);
      alert("Firestore Security Rule Denied: Cannot delete invoice.");
    }
  };

  // Add team member (Allowed for Company Admin ONLY)
  const handleAddMember = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canManageTeam) {
      alert("Permission Denied: Only Company Admin can add team users.");
      return;
    }
    try {
      const mockUid = `user_${Date.now()}`;
      const newMemberData: FreightUser = {
        uid: mockUid,
        email: memberEmail.toLowerCase(),
        displayName: memberName,
        companyId,
        companyName: companyProfile?.name || "Freight Company",
        role: memberRole,
        phone: "+91 98000 00000",
        createdAt: new Date().toISOString()
      };

      await setDoc(doc(db, "users", mockUid), newMemberData);
      setTeamMembers((prev) => [...prev, newMemberData]);
      setIsAddMemberOpen(false);
      setMemberEmail("");
      setMemberName("");
    } catch (err) {
      console.error("Error adding team member:", err);
      alert("Firestore Security Rule Denied: Only Company Admin can manage users.");
    }
  };

  // Calculated KPI stats
  const totalShipmentsCount = shipments.length;
  const activeShipmentsCount = shipments.filter(s => s.status === "In Transit" || s.status === "Loaded").length;
  const totalRevenueINR = shipments.reduce((sum, s) => sum + (s.freightAmount || 0), 0);
  const totalVehiclesCount = vehicles.length;
  const activeVehiclesCount = vehicles.filter(v => v.status === "En-Route").length;

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 font-sans">
      
      {/* Protected Dashboard Header Banner */}
      <div className="bg-slate-900 border-b border-slate-800 px-4 sm:px-6 lg:px-8 py-5">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row md:items-center justify-between gap-4">
          
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-2xl bg-amber-500/20 text-amber-400 flex items-center justify-center border border-amber-500/30 shadow-lg shadow-amber-500/10">
              <Building2 className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="font-extrabold text-xl text-white tracking-tight">
                  {companyProfile?.name || userProfile?.companyName || "Sharma Transporter Logistics"}
                </h1>
                
                {/* Active Role Selector Dropdown for RBAC Verification */}
                <div className="flex items-center gap-1.5 bg-slate-800 border border-amber-500/30 rounded-xl px-2.5 py-1">
                  <UserCheck className="w-3.5 h-3.5 text-amber-400" />
                  <span className="text-[10px] text-slate-400 font-semibold uppercase">Active Role:</span>
                  <select
                    value={activeRole}
                    onChange={(e) => handleSwitchRole(e.target.value as UserRole)}
                    className="bg-transparent text-amber-300 text-xs font-bold focus:outline-none cursor-pointer"
                  >
                    <option value="Company Admin" className="bg-slate-900 text-white">Company Admin</option>
                    <option value="Fleet Manager" className="bg-slate-900 text-white">Fleet Manager</option>
                    <option value="Dispatcher" className="bg-slate-900 text-white">Dispatcher</option>
                    <option value="Accounts" className="bg-slate-900 text-white">Accounts</option>
                  </select>
                </div>
              </div>
              <p className="text-xs text-slate-400 mt-1 flex flex-wrap items-center gap-3">
                <span>GSTIN: <strong className="text-slate-200">{companyProfile?.gstin?.trim() ? companyProfile.gstin : "Unregistered / Optional"}</strong></span>
                <span>•</span>
                <span>City: <strong className="text-slate-200">{companyProfile?.city || "Mumbai"}</strong></span>
                <span>•</span>
                <span className="text-emerald-400 flex items-center gap-1 font-mono text-[11px]">
                  <ShieldCheck className="w-3.5 h-3.5" />
                  Firestore Rules Enforced
                </span>
              </p>
            </div>
          </div>

          {/* Top Quick Actions (Role Restricted) */}
          <div className="flex items-center gap-3">
            {canCreateShipment ? (
              <button
                id="new-booking-btn"
                onClick={() => setIsAddShipmentOpen(true)}
                className="bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold px-4 py-2 rounded-xl text-xs flex items-center gap-1.5 shadow-lg shadow-amber-500/20 transition-all"
              >
                <Plus className="w-4 h-4 stroke-[3]" />
                <span>Create New Booking / LR</span>
              </button>
            ) : (
              <div className="bg-slate-800/80 border border-slate-700/60 px-3 py-1.5 rounded-xl text-xs text-slate-400 flex items-center gap-1.5">
                <Lock className="w-3.5 h-3.5 text-amber-400/80" />
                <span>Booking Creation (Locked for {activeRole})</span>
              </div>
            )}
            
            <button
              id="refresh-firestore-btn"
              onClick={loadCompanyData}
              className="bg-slate-800 hover:bg-slate-700 text-slate-300 p-2 rounded-xl text-xs border border-slate-700 transition-colors"
              title="Refresh Firestore Data"
            >
              <RefreshCw className={`w-4 h-4 ${loadingData ? "animate-spin text-amber-400" : ""}`} />
            </button>
          </div>

        </div>

        {/* Navigation Bar / Tabs Sidebar Replacement (Renders tabs and permission badges) */}
        <div className="max-w-7xl mx-auto flex gap-2 mt-6 overflow-x-auto pb-1 scrollbar-none">
          {[
            { id: "overview", label: "Operations Hub", icon: BarChart3 },
            { id: "shipments", label: `Shipments & Bilty (${shipments.length})`, icon: FileText },
            { id: "fleet", label: `Fleet Telematics (${vehicles.length})`, icon: Truck },
            { id: "drivers", label: `Drivers (${drivers.length})`, icon: Contact },
            { id: "rates", label: "Rate Card & AI Advisor", icon: Sparkles },
            { id: "financials", label: `Invoices & Ledger (${invoices.length})`, icon: IndianRupee },
            { id: "team", label: `Company & Team (${teamMembers.length})`, icon: Users },
            { id: "branches", label: `Branches (${branches.length})`, icon: Building2 },
            { id: "pricing", label: isSubscriptionActive ? `Plan: ${companyProfile?.subscriptionPlan || 'Active'}` : "Pricing & Subscription ⚡", icon: CreditCard },
            ...(isSuperAdmin ? [{ id: "admin", label: "Admin Panel 🛡️", icon: ShieldCheck }] : [])
          ].map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                id={`tab-${tab.id}`}
                onClick={() => setActiveTab(tab.id as any)}
                className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold whitespace-nowrap transition-all ${
                  isActive
                    ? "bg-amber-500 text-slate-950 shadow-md shadow-amber-500/20"
                    : "bg-slate-800/60 text-slate-400 hover:text-slate-200 hover:bg-slate-800"
                }`}
              >
                <Icon className="w-4 h-4" />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Main Dashboard Workspace */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">

        {/* Top Subscription Notice Banner */}
        {!isSubscriptionActive && activeTab !== "pricing" && (
          <div className="bg-gradient-to-r from-amber-500/15 via-orange-500/15 to-amber-500/15 border border-amber-500/30 rounded-2xl p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 shadow-lg">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-amber-500/20 text-amber-400 flex items-center justify-center border border-amber-500/30 shrink-0">
                <AlertTriangle className="w-5 h-5 text-amber-400" />
              </div>
              <div>
                <div className="font-bold text-sm text-amber-200">
                  Transporter Subscription Inactive or Expired
                </div>
                <p className="text-xs text-slate-300">
                  Access to Shipments, Fleet Vehicles, Drivers, and Multi-Branch operations is restricted. Select a Razorpay subscription plan to activate operational features.
                </p>
              </div>
            </div>
            <button
              onClick={() => setActiveTab("pricing")}
              className="bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs px-4 py-2.5 rounded-xl shrink-0 flex items-center gap-1.5 shadow-md shadow-amber-500/20 transition-all cursor-pointer"
            >
              <Zap className="w-4 h-4 fill-slate-950" />
              <span>Subscribe & Unlock (from ₹999/mo)</span>
            </button>
          </div>
        )}

        {/* Restricted Tab Guard for Inactive Subscription */}
        {!isSubscriptionActive && ["shipments", "fleet", "drivers", "branches"].includes(activeTab) ? (
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-8 sm:p-12 text-center max-w-2xl mx-auto my-8 space-y-6 shadow-2xl animate-fade-in">
            <div className="w-16 h-16 rounded-2xl bg-amber-500/10 border border-amber-500/30 text-amber-400 flex items-center justify-center mx-auto shadow-inner">
              <Lock className="w-8 h-8 stroke-[2]" />
            </div>
            <div className="space-y-2">
              <span className="bg-amber-500/20 text-amber-300 border border-amber-500/30 text-xs font-semibold px-3 py-1 rounded-full uppercase tracking-wider inline-block">
                Subscription Plan Required
              </span>
              <h2 className="text-2xl font-extrabold text-white">
                Operational Module Restricted
              </h2>
              <p className="text-sm text-slate-400 leading-relaxed max-w-lg mx-auto">
                Managing live Shipments, Fleet Telematics, Drivers, and Multi-Branch Hubs is reserved for subscribers with an active plan.
              </p>
            </div>

            <div className="bg-slate-800/80 border border-slate-700/80 rounded-xl p-4 text-xs text-left space-y-2 text-slate-300 max-w-md mx-auto">
              <div className="flex justify-between">
                <span>Transporter Account:</span>
                <strong className="text-white">{companyProfile?.name || "Logistics Pvt Ltd"}</strong>
              </div>
              <div className="flex justify-between">
                <span>Subscription Status:</span>
                <strong className="text-amber-400 uppercase font-bold">{companyProfile?.subscriptionStatus || "Inactive / Expired"}</strong>
              </div>
            </div>

            <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-2">
              <button
                onClick={() => setActiveTab("pricing")}
                className="w-full sm:w-auto px-6 py-3 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs flex items-center justify-center gap-2 shadow-lg shadow-amber-500/20 transition-all cursor-pointer"
              >
                <Zap className="w-4 h-4 fill-slate-950" />
                <span>Subscribe & Activate Now</span>
              </button>
              <button
                onClick={() => setActiveTab("overview")}
                className="w-full sm:w-auto px-6 py-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-medium text-xs border border-slate-700 transition-colors cursor-pointer"
              >
                View Read-Only Summary
              </button>
            </div>
          </div>
        ) : (
          <>
            {/* SUPER ADMIN PANEL TAB */}
            {activeTab === "admin" && (
              <AdminPanel onBackToApp={() => setActiveTab("overview")} />
            )}

            {/* PRICING & SUBSCRIPTION TAB */}
            {activeTab === "pricing" && (
              <PricingPage
                vehicleCount={vehicles.length}
                onSubscriptionSuccess={() => {
                  loadCompanyData();
                  setActiveTab("overview");
                }}
              />
            )}

            {/* TAB 1: OPERATIONS OVERVIEW */}
            {activeTab === "overview" && (
          <div className="space-y-6 animate-fade-in">
            
            {/* KPI Cards Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5">
                <div className="flex items-center justify-between text-slate-400 text-xs mb-2">
                  <span>Active En-Route Loads</span>
                  <Truck className="w-4 h-4 text-amber-400" />
                </div>
                <div className="text-2xl font-extrabold text-white">{activeShipmentsCount} Loads</div>
                <p className="text-[11px] text-amber-400/90 mt-1 flex items-center gap-1">
                  <TrendingUp className="w-3 h-3" />
                  Out of {totalShipmentsCount} total bookings
                </p>
              </div>

              <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5">
                <div className="flex items-center justify-between text-slate-400 text-xs mb-2">
                  <span>Fleet Utilization</span>
                  <BarChart3 className="w-4 h-4 text-emerald-400" />
                </div>
                <div className="text-2xl font-extrabold text-white">
                  {totalVehiclesCount > 0 ? Math.round((activeVehiclesCount / totalVehiclesCount) * 100) : 75}%
                </div>
                <p className="text-[11px] text-emerald-400 mt-1">
                  {activeVehiclesCount} of {totalVehiclesCount} trucks currently assigned
                </p>
              </div>

              <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5">
                <div className="flex items-center justify-between text-slate-400 text-xs mb-2">
                  <span>Total Freight Value</span>
                  <IndianRupee className="w-4 h-4 text-amber-400" />
                </div>
                <div className="text-2xl font-extrabold text-amber-300">
                  ₹{(totalRevenueINR / 100000).toFixed(2)} Lakhs
                </div>
                <p className="text-[11px] text-slate-400 mt-1">
                  Across registered consignment Biltys
                </p>
              </div>

              <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5">
                <div className="flex items-center justify-between text-slate-400 text-xs mb-2">
                  <span>Invoices & Billing</span>
                  <FileText className="w-4 h-4 text-blue-400" />
                </div>
                <div className="text-2xl font-extrabold text-white">
                  {invoices.length} Bills
                </div>
                <p className="text-[11px] text-slate-400 mt-1">Managed under companyId rules</p>
              </div>
            </div>

            {/* Active Bookings Quick Feed */}
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6">
              <div className="flex items-center justify-between mb-4 pb-3 border-b border-slate-800">
                <div>
                  <h3 className="font-bold text-base text-white">Live Consignment Dispatch Feed</h3>
                  <p className="text-xs text-slate-400">Stored in Firestore `shipments` collection</p>
                </div>
                <button
                  onClick={() => setActiveTab("shipments")}
                  className="text-xs text-amber-400 hover:underline flex items-center gap-1 font-semibold"
                >
                  View All Consignments
                  <ArrowUpRight className="w-3.5 h-3.5" />
                </button>
              </div>

              {shipments.length === 0 ? (
                <p className="text-xs text-slate-500 py-6 text-center">No active consignments found in Firestore.</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead className="text-slate-400 uppercase text-[10px] font-semibold bg-slate-950/60 border-b border-slate-800">
                      <tr>
                        <th className="p-3">LR / Bilty No</th>
                        <th className="p-3">Route (Origin → Dest)</th>
                        <th className="p-3">Cargo Specs</th>
                        <th className="p-3">Assigned Truck</th>
                        <th className="p-3">Freight Value</th>
                        <th className="p-3">Status</th>
                        <th className="p-3 text-right">Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800/80 font-medium text-slate-200">
                      {shipments.slice(0, 5).map((s) => (
                        <tr key={s.id} className="hover:bg-slate-800/40">
                          <td className="p-3 font-mono font-bold text-amber-400">{s.lrNumber}</td>
                          <td className="p-3">
                            <span className="font-bold text-white">{s.origin}</span> → {s.destination}
                          </td>
                          <td className="p-3">
                            <div>{s.cargoType}</div>
                            <div className="text-[10px] text-slate-400">{s.weightTons} MT ({s.truckType})</div>
                          </td>
                          <td className="p-3 font-mono text-slate-300">
                            {s.assignedTruckNumber || "Not Assigned"}
                          </td>
                          <td className="p-3 font-bold text-emerald-400">
                            ₹{(s.freightAmount || 0).toLocaleString('en-IN')}
                          </td>
                          <td className="p-3">
                            <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                              s.status === "In Transit" ? "bg-amber-500/10 text-amber-400 border border-amber-500/20" :
                              s.status === "Delivered" ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20" :
                              "bg-slate-800 text-slate-300 border border-slate-700"
                            }`}>
                              {s.status}
                            </span>
                          </td>
                          <td className="p-3 text-right">
                            <button
                              onClick={() => setSelectedLrShipment(s)}
                              className="bg-slate-800 hover:bg-slate-700 text-amber-300 px-2.5 py-1 rounded text-[11px] font-semibold border border-slate-700"
                            >
                              Print Bilty
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

          </div>
        )}

        {/* TAB 2: SHIPMENTS & DIGITAL BILTY (LR) */}
        {activeTab === "shipments" && (
          <div className="space-y-6 animate-fade-in">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-slate-900 border border-slate-800 p-5 rounded-2xl">
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="font-bold text-lg text-white">Consignments & Lorry Receipts (LR/Bilty)</h2>
                  {!canDeleteShipment && (
                    <span className="bg-blue-500/10 text-blue-400 border border-blue-500/20 text-[10px] px-2 py-0.5 rounded font-mono">
                      No Delete ({activeRole})
                    </span>
                  )}
                </div>
                <p className="text-xs text-slate-400">Manage freight bookings, vehicle/driver dispatch, lifecycle tracking & bilty documents</p>
              </div>

              {canCreateShipment ? (
                <button
                  id="create-bilty-tab-btn"
                  onClick={() => {
                    setOrigin("Delhi NCR");
                    setDestination("Mumbai (Bhiwandi)");
                    setConsignor("Havells India Electricals");
                    setConsignee("Croma Retail Distribution Hub");
                    setCargoType("Electrical Durables");
                    setWeightTons("16");
                    setShipmentType("FTL");
                    setTruckType("32ft MXL Multi-Axle");
                    setFreightAmount("58000");
                    setAdvancePaid("20000");
                    setEwayBillNo(`3810 ${Math.floor(1000 + Math.random() * 9000)} ${Math.floor(1000 + Math.random() * 9000)}`);
                    const availV = vehicles.find(v => v.status === "Available" && !getActiveShipmentForVehicle(v));
                    const availD = drivers.find(d => d.status === "Active" && !getActiveShipmentForDriver(d));
                    setShipmentVehicleId(availV?.id || "");
                    setShipmentDriverId(availD?.id || "");
                    setBookingDate(new Date().toISOString().split('T')[0]);
                    setExpectedDeliveryDate(new Date(Date.now() + 86400000 * 3).toISOString().split('T')[0]);
                    setIsAddShipmentOpen(true);
                  }}
                  className="bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold px-4 py-2 rounded-xl text-xs flex items-center gap-1.5 shadow-md shadow-amber-500/20 transition-all hover:scale-105"
                >
                  <Plus className="w-4 h-4 stroke-[3]" />
                  <span>+ Create New Booking / LR</span>
                </button>
              ) : (
                <div className="bg-slate-800/80 border border-slate-700 px-3 py-1.5 rounded-xl text-xs text-slate-400 flex items-center gap-1.5">
                  <Lock className="w-3.5 h-3.5 text-amber-400" />
                  <span>Read-Only View ({activeRole})</span>
                </div>
              )}
            </div>

            {/* Shipment Summary Stats Bar */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="bg-slate-900 border border-slate-800 p-4 rounded-xl">
                <span className="text-slate-400 text-xs font-medium block">Total Consignments</span>
                <span className="text-2xl font-extrabold text-white mt-1 block font-mono">{shipments.length}</span>
                <span className="text-[10px] text-slate-400 mt-1 block">Registered LR documents</span>
              </div>

              <div className="bg-slate-900 border border-slate-800 p-4 rounded-xl">
                <span className="text-slate-400 text-xs font-medium block">Active In Transit</span>
                <span className="text-2xl font-extrabold text-amber-400 mt-1 block font-mono">
                  {shipments.filter(s => s.status === "In Transit").length}
                </span>
                <span className="text-[10px] text-amber-500/80 mt-1 block font-medium">En-route on corridors</span>
              </div>

              <div className="bg-slate-900 border border-slate-800 p-4 rounded-xl">
                <span className="text-slate-400 text-xs font-medium block">Delivered Cargo</span>
                <span className="text-2xl font-extrabold text-emerald-400 mt-1 block font-mono">
                  {shipments.filter(s => s.status === "Delivered").length}
                </span>
                <span className="text-[10px] text-emerald-500/80 mt-1 block font-medium">POD confirmed</span>
              </div>

              <div className="bg-slate-900 border border-slate-800 p-4 rounded-xl">
                <span className="text-slate-400 text-xs font-medium block">Total Freight Value</span>
                <span className="text-2xl font-extrabold text-white mt-1 block font-mono">
                  ₹{shipments.reduce((acc, s) => acc + (s.freightAmount || 0), 0).toLocaleString('en-IN')}
                </span>
                <span className="text-[10px] text-slate-400 mt-1 block">Combined billing value</span>
              </div>
            </div>

            {/* Filter Toolbar */}
            <div className="bg-slate-900 border border-slate-800 p-4 rounded-2xl flex flex-col md:flex-row items-center justify-between gap-4">
              <div className="relative w-full md:w-80">
                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                <input
                  type="text"
                  value={shipmentSearchQuery}
                  onChange={(e) => setShipmentSearchQuery(e.target.value)}
                  placeholder="Search by LR#, Consignor, Consignee, Truck..."
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-9 pr-3 py-2 text-xs text-white focus:outline-none focus:border-amber-500"
                />
              </div>

              <div className="flex flex-wrap items-center gap-2 w-full md:w-auto">
                <div className="flex items-center gap-1 bg-slate-950 p-1 rounded-xl border border-slate-800 overflow-x-auto text-xs">
                  {["All", "Booked", "Loaded", "In Transit", "Delivered", "Cancelled"].map((st) => (
                    <button
                      key={st}
                      onClick={() => setShipmentStatusFilter(st)}
                      className={`px-2.5 py-1 rounded-lg font-semibold text-[11px] transition-colors whitespace-nowrap ${
                        shipmentStatusFilter === st
                          ? "bg-amber-500 text-slate-950 font-bold"
                          : "text-slate-400 hover:text-white hover:bg-slate-900"
                      }`}
                    >
                      {st}
                    </button>
                  ))}
                </div>

                <div className="flex items-center gap-1 text-xs">
                  <span className="text-slate-400 text-[11px] font-mono">Type:</span>
                  <select
                    value={shipmentTypeFilter}
                    onChange={(e) => setShipmentTypeFilter(e.target.value)}
                    className="bg-slate-950 border border-slate-800 rounded-xl px-2.5 py-1.5 text-white text-xs focus:outline-none cursor-pointer"
                  >
                    <option value="All">All Types</option>
                    <option value="FTL">FTL (Full Truck)</option>
                    <option value="LTL">LTL (Part Load)</option>
                    <option value="Express">Express</option>
                  </select>
                </div>
              </div>
            </div>

            {/* Shipments List Table */}
            <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-xl">
              <div className="p-4 bg-slate-950/60 border-b border-slate-800 flex items-center justify-between text-xs text-slate-400 font-medium">
                <span>Showing Firestore documents for company: <strong className="text-amber-400 font-mono">{companyId}</strong></span>
                <span>Total: {shipments.filter(s => {
                  const q = shipmentSearchQuery.toLowerCase().trim();
                  const matchesQuery = !q || (
                    s.lrNumber.toLowerCase().includes(q) ||
                    s.consignor.toLowerCase().includes(q) ||
                    s.consignee.toLowerCase().includes(q) ||
                    s.origin.toLowerCase().includes(q) ||
                    s.destination.toLowerCase().includes(q) ||
                    (s.cargoType && s.cargoType.toLowerCase().includes(q)) ||
                    (s.assignedTruckNumber && s.assignedTruckNumber.toLowerCase().includes(q)) ||
                    (s.driverName && s.driverName.toLowerCase().includes(q))
                  );
                  const matchesStatus = shipmentStatusFilter === "All" || s.status === shipmentStatusFilter;
                  const matchesType = shipmentTypeFilter === "All" || s.shipmentType === shipmentTypeFilter;
                  return matchesQuery && matchesStatus && matchesType;
                }).length} Consignments</span>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="text-slate-400 uppercase text-[10px] font-semibold bg-slate-950/80 border-b border-slate-800">
                    <tr>
                      <th className="p-3.5">LR Number & Type</th>
                      <th className="p-3.5">Consignor & Consignee</th>
                      <th className="p-3.5">Corridor Route</th>
                      <th className="p-3.5">Cargo Specs</th>
                      <th className="p-3.5">Vehicle & Driver</th>
                      <th className="p-3.5">Freight Amount</th>
                      <th className="p-3.5">Status Lifecycle</th>
                      <th className="p-3.5 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/80 font-medium text-slate-200">
                    {shipments.filter(s => {
                      const q = shipmentSearchQuery.toLowerCase().trim();
                      const matchesQuery = !q || (
                        s.lrNumber.toLowerCase().includes(q) ||
                        s.consignor.toLowerCase().includes(q) ||
                        s.consignee.toLowerCase().includes(q) ||
                        s.origin.toLowerCase().includes(q) ||
                        s.destination.toLowerCase().includes(q) ||
                        (s.cargoType && s.cargoType.toLowerCase().includes(q)) ||
                        (s.assignedTruckNumber && s.assignedTruckNumber.toLowerCase().includes(q)) ||
                        (s.driverName && s.driverName.toLowerCase().includes(q))
                      );
                      const matchesStatus = shipmentStatusFilter === "All" || s.status === shipmentStatusFilter;
                      const matchesType = shipmentTypeFilter === "All" || s.shipmentType === shipmentTypeFilter;
                      return matchesQuery && matchesStatus && matchesType;
                    }).map((s) => {
                      const assignedVeh = vehicles.find(v => v.id === s.assignedVehicleId || v.registrationNumber === s.assignedTruckNumber);
                      const assignedDrv = drivers.find(d => d.id === s.assignedDriverId || d.fullName === s.driverName);

                      return (
                        <tr key={s.id} className="hover:bg-slate-800/40 transition-colors">
                          <td className="p-3.5">
                            <div className="font-mono font-extrabold text-amber-400 text-sm">{s.lrNumber}</div>
                            <div className="flex items-center gap-1.5 mt-0.5">
                              <span className={`px-1.5 py-0.2 rounded text-[9px] font-extrabold uppercase ${
                                s.shipmentType === "Express" ? "bg-purple-500/20 text-purple-300 border border-purple-500/30" :
                                s.shipmentType === "LTL" ? "bg-blue-500/20 text-blue-300 border border-blue-500/30" :
                                "bg-amber-500/20 text-amber-300 border border-amber-500/30"
                              }`}>
                                {s.shipmentType || "FTL"}
                              </span>
                              {s.bookingDate && (
                                <span className="text-[10px] text-slate-400">{s.bookingDate}</span>
                              )}
                            </div>
                          </td>

                          <td className="p-3.5">
                            <div className="font-bold text-white">{s.consignor}</div>
                            <div className="text-[11px] text-slate-400">To: {s.consignee}</div>
                          </td>

                          <td className="p-3.5">
                            <div className="font-semibold text-slate-200">{s.origin}</div>
                            <div className="text-[11px] text-slate-400 flex items-center gap-1">
                              <span>↓</span>
                              <span>{s.destination}</span>
                            </div>
                          </td>

                          <td className="p-3.5">
                            <div className="font-medium text-slate-200">{s.cargoType}</div>
                            <div className="text-[10px] text-slate-400 font-mono">
                              {s.weightTons || 10} MT • {assignedVeh ? assignedVeh.type : (s.truckType || "32ft MXL")}
                            </div>
                          </td>

                          <td className="p-3.5">
                            <div className="font-mono font-bold text-amber-300 flex items-center gap-1">
                              <Truck className="w-3.5 h-3.5 text-amber-400" />
                              <span>{assignedVeh ? assignedVeh.registrationNumber : (s.assignedTruckNumber || "Unassigned")}</span>
                            </div>
                            <div className="text-[11px] text-slate-400 flex items-center gap-1 mt-0.5">
                              <User className="w-3 h-3 text-slate-500" />
                              <span>{assignedDrv ? assignedDrv.fullName : (s.driverName || "Driver Unassigned")}</span>
                            </div>
                          </td>

                          <td className="p-3.5 font-mono">
                            <div className="font-bold text-emerald-400">₹{(s.freightAmount || 0).toLocaleString('en-IN')}</div>
                            <div className="text-[10px] text-slate-400">Adv: ₹{(s.advancePaid || 0).toLocaleString('en-IN')}</div>
                          </td>

                          <td className="p-3.5">
                            {canUpdateShipment ? (
                              <select
                                value={s.status}
                                onChange={(e) => handleAdvanceShipmentStatus(s, e.target.value as ShipmentStatus)}
                                className="bg-slate-800 border border-slate-700 rounded-lg px-2 py-1 text-[11px] text-amber-300 font-bold focus:outline-none cursor-pointer"
                              >
                                <option value="Booked">Booked</option>
                                <option value="Loaded">Loaded</option>
                                <option value="In Transit">In Transit</option>
                                <option value="Delivered">Delivered</option>
                                <option value="Cancelled">Cancelled</option>
                              </select>
                            ) : (
                              <span className={`px-2.5 py-1 rounded text-[11px] font-bold ${
                                s.status === "In Transit" ? "bg-amber-500/20 text-amber-400 border border-amber-500/30" :
                                s.status === "Delivered" ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30" :
                                "bg-slate-800 text-slate-300 border border-slate-700"
                              }`}>
                                {s.status}
                              </span>
                            )}
                          </td>

                          <td className="p-3.5 text-right flex items-center justify-end gap-1.5">
                            <button
                              onClick={() => setSelectedTrackShipment(s)}
                              className="bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 px-2.5 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1 transition-colors"
                              title="View Full Lifecycle & Update Status"
                            >
                              <Clock className="w-3.5 h-3.5 text-amber-400" />
                              <span>Track & Detail</span>
                            </button>

                            <button
                              onClick={() => setSelectedLrShipment(s)}
                              className="bg-amber-500/10 hover:bg-amber-500/20 text-amber-400 border border-amber-500/30 px-2 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1 transition-colors"
                              title="Print GST Lorry Receipt Form"
                            >
                              <Printer className="w-3.5 h-3.5" />
                              <span>LR Bilty</span>
                            </button>

                            {canDeleteShipment && (
                              <button
                                onClick={() => handleDeleteShipment(s.id)}
                                className="bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/30 p-1.5 rounded-lg text-xs font-semibold transition-colors"
                                title="Delete Shipment (Company Admin & Fleet Manager Only)"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* TAB 3: FLEET & VEHICLES */}
        {activeTab === "fleet" && (
          <div className="space-y-6 animate-fade-in">
            <div className="flex items-center justify-between bg-slate-900 border border-slate-800 p-5 rounded-2xl">
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="font-bold text-lg text-white">Company Fleet Vehicles</h2>
                  {!canDeleteVehicle && (
                    <span className="bg-blue-500/10 text-blue-400 border border-blue-500/20 text-[10px] px-2 py-0.5 rounded font-mono">
                      No Delete ({activeRole})
                    </span>
                  )}
                </div>
                <p className="text-xs text-slate-400">Firestore `vehicles` collection</p>
              </div>

              {canAddVehicle ? (
                <button
                  id="add-vehicle-btn"
                  onClick={() => setIsAddVehicleOpen(true)}
                  className="bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold px-4 py-2 rounded-xl text-xs flex items-center gap-1.5"
                >
                  <Plus className="w-4 h-4 stroke-[3]" />
                  <span>+ Add Truck to Fleet</span>
                </button>
              ) : (
                <div className="bg-slate-800/80 border border-slate-700 px-3 py-1.5 rounded-xl text-xs text-slate-400 flex items-center gap-1.5">
                  <Lock className="w-3.5 h-3.5 text-amber-400" />
                  <span>Read-Only View ({activeRole})</span>
                </div>
              )}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {vehicles.map((v) => (
                <div key={v.id} className="bg-slate-900 border border-slate-800 rounded-2xl p-5 space-y-3 relative group">
                  <div className="flex items-center justify-between pb-3 border-b border-slate-800">
                    <div>
                      <span className="font-mono font-extrabold text-base text-amber-400">{v.registrationNumber}</span>
                      <p className="text-xs font-semibold text-slate-200 mt-0.5">{v.model}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                        v.status === "Available" ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20" :
                        v.status === "En-Route" ? "bg-amber-500/10 text-amber-400 border border-amber-500/20" :
                        "bg-rose-500/10 text-rose-400 border border-rose-500/20"
                      }`}>
                        {v.status}
                      </span>

                      {canDeleteVehicle && (
                        <button
                          onClick={() => handleDeleteVehicle(v.id)}
                          className="bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/30 p-1 rounded-lg text-xs"
                          title="Delete Truck (Admin & Fleet Manager Only)"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  </div>

                  <div className="space-y-1.5 text-xs text-slate-300 font-medium">
                    <div className="flex justify-between items-center">
                      <span className="text-slate-400">Assigned Driver:</span>
                      <span className="text-white font-semibold flex items-center gap-1">
                        <Contact className="w-3.5 h-3.5 text-amber-400" />
                        {v.driverName || "Unassigned"}
                        {(() => {
                          const assignedDrv = drivers.find(d => d.id === v.assignedDriverId || d.fullName === v.driverName);
                          if (!assignedDrv) return null;
                          const exp = getLicenseExpiryInfo(assignedDrv.licenseExpiry);
                          if (exp.isExpired) {
                            return (
                              <span className="bg-rose-500/20 text-rose-300 border border-rose-500/40 text-[9px] px-1.5 py-0.2 rounded font-bold" title="Driver License Expired!">
                                License Expired
                              </span>
                            );
                          } else if (exp.isExpiringSoon) {
                            return (
                              <span className="bg-amber-500/20 text-amber-300 border border-amber-500/40 text-[9px] px-1.5 py-0.2 rounded font-bold" title={`License expiring in ${exp.daysLeft} days`}>
                                {exp.daysLeft}d left
                              </span>
                            );
                          }
                          return null;
                        })()}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-400">Payload Capacity:</span>
                      <span className="font-mono text-slate-200">{v.capacityTons} MT</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-400">FASTag Balance:</span>
                      <span className="font-mono font-bold text-amber-300">₹{(v.fastagBalance || 0).toLocaleString('en-IN')}</span>
                    </div>
                    <div className="flex justify-between pt-1 text-[11px]">
                      <span className="text-slate-400">Last Telematics Location:</span>
                      <span className="text-slate-300 truncate max-w-[150px]">{v.lastLocation || "Depot"}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* TAB 3.5: DRIVER MANAGEMENT */}
        {activeTab === "drivers" && (
          <div className="space-y-6 animate-fade-in">
            {/* Header & Controls */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-slate-900 border border-slate-800 p-5 rounded-2xl">
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="font-bold text-lg text-white flex items-center gap-2">
                    <Contact className="w-5 h-5 text-amber-400" />
                    Company Driver Management
                  </h2>
                  {!canDeleteDriver && (
                    <span className="bg-blue-500/10 text-blue-400 border border-blue-500/20 text-[10px] px-2 py-0.5 rounded font-mono">
                      No Delete ({activeRole})
                    </span>
                  )}
                </div>
                <p className="text-xs text-slate-400">
                  Manage commercial drivers, licensing, status, and vehicle assignments in Firestore `drivers` collection.
                </p>
              </div>

              {canAddDriver ? (
                <button
                  id="add-driver-btn"
                  onClick={handleOpenAddDriver}
                  className="bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold px-4 py-2 rounded-xl text-xs flex items-center gap-1.5 shadow-lg shadow-amber-500/20 transition-all cursor-pointer"
                >
                  <Plus className="w-4 h-4 stroke-[3]" />
                  <span>+ Add Driver</span>
                </button>
              ) : (
                <div className="bg-slate-800/80 border border-slate-700 px-3 py-1.5 rounded-xl text-xs text-slate-400 flex items-center gap-1.5">
                  <Lock className="w-3.5 h-3.5 text-amber-400" />
                  <span>Read-Only View ({activeRole})</span>
                </div>
              )}
            </div>

            {/* Expiring License Alert Notice if any */}
            {(() => {
              const expiringOrExpired = drivers.filter(d => {
                const exp = getLicenseExpiryInfo(d.licenseExpiry);
                return exp.isExpired || exp.isExpiringSoon;
              });
              if (expiringOrExpired.length === 0) return null;
              return (
                <div className="bg-amber-500/10 border border-amber-500/30 p-4 rounded-2xl flex items-start gap-3">
                  <AlertTriangle className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
                  <div className="text-xs text-slate-200">
                    <strong className="text-amber-300 font-bold block mb-0.5">
                      Licensing Alert: {expiringOrExpired.length} Driver(s) Require License Renewal
                    </strong>
                    The following drivers have licenses expiring within 30 days or already expired: {" "}
                    {expiringOrExpired.map((d, idx) => (
                      <span key={d.id} className="font-semibold text-white">
                        {d.fullName} ({d.licenseNumber} - {getLicenseExpiryInfo(d.licenseExpiry).isExpired ? "EXPIRED" : `${getLicenseExpiryInfo(d.licenseExpiry).daysLeft} days remaining`})
                        {idx < expiringOrExpired.length - 1 ? ", " : ""}
                      </span>
                    ))}
                  </div>
                </div>
              );
            })()}

            {/* Driver Filter / Search Controls */}
            <div className="flex flex-col sm:flex-row gap-3 items-center justify-between bg-slate-900/60 p-3 rounded-xl border border-slate-800/80">
              <div className="relative w-full sm:w-80">
                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                <input
                  type="text"
                  placeholder="Search by driver name, phone, license..."
                  value={driverSearchQuery}
                  onChange={(e) => setDriverSearchQuery(e.target.value)}
                  className="w-full bg-slate-800 border border-slate-700 rounded-lg pl-9 pr-3 py-1.5 text-xs text-white placeholder-slate-400 focus:outline-none focus:border-amber-500"
                />
              </div>

              <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
                <Filter className="w-3.5 h-3.5 text-slate-400" />
                <span className="text-xs text-slate-400">Filter Status:</span>
                <select
                  value={driverStatusFilter}
                  onChange={(e) => setDriverStatusFilter(e.target.value)}
                  className="bg-slate-800 border border-slate-700 text-white text-xs rounded-lg px-2.5 py-1.5 focus:outline-none focus:border-amber-500 cursor-pointer"
                >
                  <option value="All">All Drivers ({drivers.length})</option>
                  <option value="Active">Active Only</option>
                  <option value="On Leave">On Leave</option>
                  <option value="Inactive">Inactive</option>
                  <option value="ExpiringSoon">License Expiry Warnings</option>
                </select>
              </div>
            </div>

            {/* Drivers Table */}
            <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-xl">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs text-slate-300">
                  <thead className="bg-slate-800/80 text-slate-400 uppercase font-mono text-[10px]">
                    <tr>
                      <th className="p-4">Driver Name & Contact</th>
                      <th className="p-4">License Details</th>
                      <th className="p-4">License Expiry</th>
                      <th className="p-4">Status</th>
                      <th className="p-4">Assigned Vehicle</th>
                      <th className="p-4">Joining Date</th>
                      <th className="p-4 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800 font-medium">
                    {(() => {
                      const filteredDrivers = drivers.filter(d => {
                        const matchesSearch =
                          d.fullName.toLowerCase().includes(driverSearchQuery.toLowerCase()) ||
                          d.phoneNumber.includes(driverSearchQuery) ||
                          d.licenseNumber.toLowerCase().includes(driverSearchQuery.toLowerCase()) ||
                          (d.address && d.address.toLowerCase().includes(driverSearchQuery.toLowerCase()));

                        if (!matchesSearch) return false;

                        if (driverStatusFilter === "Active") return d.status === "Active";
                        if (driverStatusFilter === "On Leave") return d.status === "On Leave";
                        if (driverStatusFilter === "Inactive") return d.status === "Inactive";
                        if (driverStatusFilter === "ExpiringSoon") {
                          const exp = getLicenseExpiryInfo(d.licenseExpiry);
                          return exp.isExpired || exp.isExpiringSoon;
                        }
                        return true;
                      });

                      if (filteredDrivers.length === 0) {
                        return (
                          <tr>
                            <td colSpan={7} className="p-8 text-center text-slate-400">
                              No drivers found matching your filter criteria.
                            </td>
                          </tr>
                        );
                      }

                      return filteredDrivers.map((driver) => {
                        const expiryInfo = getLicenseExpiryInfo(driver.licenseExpiry);
                        const assignedVeh = vehicles.find(v => v.id === driver.assignedVehicleId || v.driverName === driver.fullName);

                        return (
                          <tr key={driver.id} className="hover:bg-slate-800/50 transition-colors">
                            {/* Driver Name & Contact */}
                            <td className="p-4">
                              <div className="font-bold text-white text-sm flex items-center gap-2">
                                <div className="w-8 h-8 rounded-full bg-slate-800 border border-slate-700 flex items-center justify-center text-amber-400 font-bold text-xs shrink-0">
                                  {driver.fullName.slice(0, 2).toUpperCase()}
                                </div>
                                <div>
                                  <div>{driver.fullName}</div>
                                  <div className="text-[11px] text-slate-400 font-mono flex items-center gap-1 font-normal mt-0.5">
                                    <Phone className="w-3 h-3 text-amber-400" />
                                    {driver.phoneNumber}
                                  </div>
                                  {driver.email && (
                                    <div className="text-[10px] text-emerald-400 font-mono flex items-center gap-1 mt-0.5">
                                      <Mail className="w-3 h-3 text-emerald-400" />
                                      <span className="truncate max-w-[140px]">{driver.email}</span>
                                      <span className="bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 px-1 py-0.2 rounded text-[9px] font-sans">App Active</span>
                                    </div>
                                  )}
                                </div>
                              </div>
                              {driver.address && (
                                <p className="text-[11px] text-slate-400 mt-1 truncate max-w-[220px] flex items-center gap-1">
                                  <MapPin className="w-3 h-3 text-slate-400 shrink-0" />
                                  {driver.address}
                                </p>
                              )}
                            </td>

                            {/* License Details */}
                            <td className="p-4">
                              <div className="font-mono font-bold text-amber-300">{driver.licenseNumber}</div>
                              <span className="inline-block mt-1 bg-slate-800 text-slate-300 border border-slate-700 text-[10px] font-semibold px-2 py-0.5 rounded">
                                {driver.licenseType}
                              </span>
                            </td>

                            {/* Expiry Date with Highlight Badge */}
                            <td className="p-4">
                              <div className="font-mono text-xs">{driver.licenseExpiry || "N/A"}</div>
                              <div className="mt-1">
                                {expiryInfo.isExpired ? (
                                  <span className="bg-rose-500/20 text-rose-300 border border-rose-500/40 text-[10px] font-bold px-2 py-0.5 rounded inline-flex items-center gap-1">
                                    <AlertCircle className="w-3 h-3 text-rose-400 animate-pulse" />
                                    Expired ({Math.abs(expiryInfo.daysLeft)}d ago)
                                  </span>
                                ) : expiryInfo.isExpiringSoon ? (
                                  <span className="bg-amber-500/20 text-amber-300 border border-amber-500/40 text-[10px] font-bold px-2 py-0.5 rounded inline-flex items-center gap-1">
                                    <Clock className="w-3 h-3 text-amber-400" />
                                    Expires in {expiryInfo.daysLeft} days
                                  </span>
                                ) : (
                                  <span className="bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 text-[10px] font-medium px-2 py-0.5 rounded">
                                    Valid License
                                  </span>
                                )}
                              </div>
                            </td>

                            {/* Status */}
                            <td className="p-4">
                              <span className={`px-2.5 py-1 rounded-full text-[10px] font-bold uppercase ${
                                driver.status === "Active" ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20" :
                                driver.status === "On Leave" ? "bg-amber-500/10 text-amber-400 border border-amber-500/20" :
                                "bg-slate-800 text-slate-400 border border-slate-700"
                              }`}>
                                {driver.status}
                              </span>
                            </td>

                            {/* Assigned Vehicle */}
                            <td className="p-4">
                              {assignedVeh ? (
                                <div>
                                  <span className="font-mono font-bold text-slate-100 flex items-center gap-1">
                                    <Truck className="w-3.5 h-3.5 text-amber-400" />
                                    {assignedVeh.registrationNumber}
                                  </span>
                                  <span className="text-[10px] text-slate-400 block">{assignedVeh.model}</span>
                                </div>
                              ) : (
                                <span className="text-slate-400 italic text-[11px]">Unassigned</span>
                              )}
                            </td>

                            {/* Joining Date */}
                            <td className="p-4 font-mono text-xs text-slate-300">
                              {driver.joiningDate || "N/A"}
                            </td>

                            {/* Actions */}
                            <td className="p-4 text-right space-x-2">
                              {canUpdateDriver ? (
                                <button
                                  onClick={() => handleOpenEditDriver(driver)}
                                  className="bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 p-1.5 rounded-lg text-xs cursor-pointer"
                                  title="Edit Driver"
                                >
                                  <Edit className="w-3.5 h-3.5" />
                                </button>
                              ) : null}

                              {canDeleteDriver ? (
                                <button
                                  onClick={() => handleDeleteDriver(driver.id)}
                                  className="bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/30 p-1.5 rounded-lg text-xs cursor-pointer"
                                  title="Delete Driver (Admin & Fleet Manager Only)"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              ) : null}
                            </td>
                          </tr>
                        );
                      });
                    })()}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* TAB 4: RATE CARD & AI ADVISOR */}
        {activeTab === "rates" && (
          <div className="space-y-6 animate-fade-in">
            <RateCalculatorWidget />
          </div>
        )}

        {/* TAB 5: FINANCIALS & INVOICES */}
        {activeTab === "financials" && (
          <div className="space-y-6 animate-fade-in">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-slate-900 border border-slate-800 p-5 rounded-2xl">
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="font-bold text-lg text-white">Financial Invoices & GST Ledger</h2>
                  {canManageInvoices ? (
                    <span className="bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 text-[10px] px-2 py-0.5 rounded font-mono">
                      Write Access ({activeRole})
                    </span>
                  ) : (
                    <span className="bg-amber-500/10 text-amber-400 border border-amber-500/20 text-[10px] px-2 py-0.5 rounded font-mono flex items-center gap-1">
                      <Eye className="w-3 h-3" /> Read Only ({activeRole})
                    </span>
                  )}
                </div>
                <p className="text-xs text-slate-400">Managed in Firestore `invoices` collection. Accessible strictly by Company Admin and Accounts for writes.</p>
              </div>

              {canManageInvoices ? (
                <button
                  id="add-invoice-btn"
                  onClick={() => setIsAddInvoiceOpen(true)}
                  className="bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold px-4 py-2 rounded-xl text-xs flex items-center gap-1.5 shadow-md shadow-amber-500/20"
                >
                  <Plus className="w-4 h-4 stroke-[3]" />
                  <span>+ Create Tax Invoice</span>
                </button>
              ) : (
                <div className="bg-slate-800/80 border border-slate-700 px-3 py-1.5 rounded-xl text-xs text-slate-400 flex items-center gap-1.5">
                  <Lock className="w-3.5 h-3.5 text-amber-400" />
                  <span>Invoice Creation Restricted to Accounts & Admin</span>
                </div>
              )}
            </div>

            <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-xl">
              <div className="p-4 bg-slate-950/60 border-b border-slate-800 flex items-center justify-between text-xs text-slate-400 font-medium">
                <span>Firestore `invoices` Collection</span>
                <span>Total: {invoices.length} Invoices</span>
              </div>

              {invoices.length === 0 ? (
                <div className="p-8 text-center text-xs text-slate-500">
                  No invoices created yet.
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead className="text-slate-400 uppercase text-[10px] font-semibold bg-slate-950/80 border-b border-slate-800">
                      <tr>
                        <th className="p-3.5">Invoice No</th>
                        <th className="p-3.5">Consignment LR</th>
                        <th className="p-3.5">Client Billed</th>
                        <th className="p-3.5">Base Freight</th>
                        <th className="p-3.5">GST (5%)</th>
                        <th className="p-3.5">Total Amount</th>
                        <th className="p-3.5">Status</th>
                        <th className="p-3.5 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800/80 font-medium text-slate-200">
                      {invoices.map((inv) => (
                        <tr key={inv.id} className="hover:bg-slate-800/40">
                          <td className="p-3.5 font-mono font-bold text-amber-400">{inv.invoiceNumber}</td>
                          <td className="p-3.5 font-mono text-slate-300">{inv.lrNumber}</td>
                          <td className="p-3.5 font-bold text-white">{inv.clientName}</td>
                          <td className="p-3.5 font-mono text-slate-300">₹{(inv.amount || 0).toLocaleString('en-IN')}</td>
                          <td className="p-3.5 font-mono text-slate-400">₹{(inv.gstAmount || 0).toLocaleString('en-IN')}</td>
                          <td className="p-3.5 font-mono font-extrabold text-emerald-400">₹{(inv.totalAmount || 0).toLocaleString('en-IN')}</td>
                          <td className="p-3.5">
                            <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                              {inv.status}
                            </span>
                          </td>
                          <td className="p-3.5 text-right">
                            {canManageInvoices ? (
                              <button
                                onClick={() => handleDeleteInvoice(inv.id)}
                                className="bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/30 p-1.5 rounded-lg text-xs"
                                title="Delete Invoice (Company Admin & Accounts Only)"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            ) : (
                              <span className="text-[11px] text-slate-500 italic">Read Only</span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        )}

        {/* TAB 6: COMPANY & TEAM MANAGEMENT */}
        {activeTab === "team" && (
          <div className="space-y-6 animate-fade-in">
            
            {/* Company Info Box */}
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6">
              <h2 className="font-bold text-lg text-white mb-1">Company Profile & Firestore Data</h2>
              <p className="text-xs text-slate-400 mb-4">Document details from Firestore `companies` collection</p>

              <div className="grid grid-cols-1 sm:grid-cols-4 gap-4 text-xs bg-slate-950/60 p-4 rounded-xl border border-slate-800/80">
                <div>
                  <span className="text-slate-400 block text-[11px]">Company Name</span>
                  <span className="font-bold text-white text-sm">{companyProfile?.name || "Sharma Freight Logistics"}</span>
                </div>
                <div>
                  <span className="text-slate-400 block text-[11px]">GSTIN Status</span>
                  <span className="font-mono text-slate-200 text-xs font-bold">
                    {companyProfile?.gstin?.trim() ? companyProfile.gstin : "Not Provided (Optional)"}
                  </span>
                </div>
                <div>
                  <span className="text-slate-400 block text-[11px]">Firestore Document ID</span>
                  <span className="font-mono text-amber-400 font-bold">{companyId}</span>
                </div>
                <div>
                  <span className="text-slate-400 block text-[11px]">Company Owner UID</span>
                  <span className="font-mono text-slate-300 text-[11px] truncate block">{companyProfile?.ownerUid || userProfile?.uid}</span>
                </div>
              </div>
            </div>

            {/* Team Members List */}
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6">
              <div className="flex items-center justify-between pb-4 border-b border-slate-800 mb-4">
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="font-bold text-base text-white">Team Members & Access Roles</h3>
                    {!canManageTeam && (
                      <span className="bg-slate-800 text-slate-400 border border-slate-700 text-[10px] px-2 py-0.5 rounded font-mono">
                        Read Only for {activeRole}
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-slate-400">Stored in Firestore `users` collection linked by companyId</p>
                </div>

                {canManageTeam ? (
                  <button
                    id="add-member-btn"
                    onClick={() => setIsAddMemberOpen(true)}
                    className="bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold px-3.5 py-2 rounded-xl text-xs flex items-center gap-1.5"
                  >
                    <Plus className="w-4 h-4 stroke-[3]" />
                    <span>+ Add Team User</span>
                  </button>
                ) : (
                  <div className="bg-slate-800/80 border border-slate-700 px-3 py-1.5 rounded-xl text-xs text-slate-400 flex items-center gap-1.5">
                    <Lock className="w-3.5 h-3.5 text-amber-400" />
                    <span>User Management Locked (Admin Only)</span>
                  </div>
                )}
              </div>

              <div className="divide-y divide-slate-800">
                {teamMembers.map((m, idx) => {
                  const isSelf = m.uid === userProfile?.uid;
                  return (
                    <div key={idx} className="py-3 flex items-center justify-between text-xs">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-slate-800 text-amber-400 flex items-center justify-center font-bold">
                          {m.displayName ? m.displayName[0] : "U"}
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <p className="font-bold text-white">{m.displayName || "Company User"}</p>
                            {isSelf && (
                              <span className="bg-slate-800 text-amber-400 text-[10px] px-1.5 py-0.5 rounded border border-amber-500/30">
                                You
                              </span>
                            )}
                          </div>
                          <p className="text-slate-400 text-[11px]">{m.email}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        {canManageTeam && !isSelf ? (
                          <div className="flex items-center gap-1">
                            <span className="text-[10px] text-slate-400 font-mono">Role:</span>
                            <select
                              value={m.role || "Dispatcher"}
                              onChange={(e) => handleUpdateMemberRole(m.uid, e.target.value as UserRole)}
                              className="bg-slate-800 border border-slate-700 text-amber-300 font-bold text-xs rounded px-2 py-1 focus:outline-none focus:border-amber-500 cursor-pointer"
                            >
                              <option value="Company Admin">Company Admin</option>
                              <option value="Fleet Manager">Fleet Manager</option>
                              <option value="Dispatcher">Dispatcher</option>
                              <option value="Accounts">Accounts</option>
                            </select>
                          </div>
                        ) : (
                          <span className="bg-amber-500/10 text-amber-400 border border-amber-500/20 px-2.5 py-1 rounded text-[11px] font-bold">
                            {m.role || "Company Admin"}
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

          </div>
        )}

        {/* TAB 7: MULTI-BRANCH OPERATIONS HUB */}
        {activeTab === "branches" && (
          <div className="space-y-6 animate-fade-in">
            {/* Header & Stats */}
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-800 mb-6">
                <div>
                  <div className="flex items-center gap-2">
                    <Building2 className="w-6 h-6 text-amber-400" />
                    <h2 className="font-extrabold text-xl text-white">Multi-Branch Logistics Network</h2>
                    {activeRole === "Company Admin" ? (
                      <span className="bg-amber-500/15 text-amber-300 border border-amber-500/30 text-[10px] px-2 py-0.5 rounded font-mono font-bold">
                        Admin Write Access
                      </span>
                    ) : (
                      <span className="bg-slate-800 text-slate-400 border border-slate-700 text-[10px] px-2 py-0.5 rounded font-mono">
                        Read Only for {activeRole}
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-slate-400 mt-1">
                    Manage regional hubs, dispatch centers, and Head Office operations in Firestore `branches` collection
                  </p>
                </div>

                {activeRole === "Company Admin" ? (
                  <button
                    id="add-branch-btn"
                    onClick={handleOpenAddBranch}
                    className="bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold px-4 py-2 rounded-xl text-xs flex items-center gap-1.5 shadow-lg shadow-amber-500/20 cursor-pointer"
                  >
                    <Plus className="w-4 h-4 stroke-[3]" />
                    <span>+ Add New Branch Hub</span>
                  </button>
                ) : (
                  <div className="bg-slate-800/80 border border-slate-700/60 px-3 py-1.5 rounded-xl text-xs text-slate-400 flex items-center gap-1.5">
                    <Lock className="w-3.5 h-3.5 text-amber-400" />
                    <span>Branch Management (Admin Only)</span>
                  </div>
                )}
              </div>

              {/* Branch Network KPI Stats */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="bg-slate-950/70 border border-slate-800 p-4 rounded-xl">
                  <span className="text-slate-400 text-xs block mb-1">Total Registered Hubs</span>
                  <div className="text-2xl font-extrabold text-white flex items-center gap-2">
                    <span>{branches.length}</span>
                    <span className="text-xs font-normal text-amber-400">Regional Hubs</span>
                  </div>
                </div>

                <div className="bg-slate-950/70 border border-slate-800 p-4 rounded-xl">
                  <span className="text-slate-400 text-xs block mb-1">Head Office Hub</span>
                  <div className="text-lg font-bold text-amber-300 truncate">
                    {branches.find(b => b.isHeadOffice)?.branchName || companyProfile?.city || "Head Office"}
                  </div>
                </div>

                <div className="bg-slate-950/70 border border-slate-800 p-4 rounded-xl">
                  <span className="text-slate-400 text-xs block mb-1">Assigned Vehicles & Drivers</span>
                  <div className="text-base font-bold text-white flex items-center gap-3">
                    <span className="text-emerald-400">{vehicles.filter(v => v.branchId).length} / {vehicles.length} Trucks</span>
                    <span className="text-slate-600">•</span>
                    <span className="text-sky-400">{drivers.filter(d => d.branchId).length} / {drivers.length} Drivers</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Branches List Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
              {branches.map((b) => {
                const branchVehiclesCount = vehicles.filter(v => v.branchId === b.id).length;
                const branchDriversCount = drivers.filter(d => d.branchId === b.id).length;
                const branchShipmentsCount = shipments.filter(s => s.branchId === b.id).length;

                return (
                  <div
                    key={b.id}
                    className={`relative bg-slate-900 border rounded-2xl p-5 flex flex-col justify-between transition-all ${
                      b.isHeadOffice
                        ? "border-amber-500/50 shadow-xl shadow-amber-500/5 bg-gradient-to-b from-slate-900 via-slate-900 to-amber-950/10"
                        : "border-slate-800 hover:border-slate-700"
                    }`}
                  >
                    <div>
                      <div className="flex items-start justify-between gap-2 mb-3">
                        <div className="flex items-center gap-2">
                          <div className={`p-2 rounded-xl ${b.isHeadOffice ? "bg-amber-500/20 text-amber-400" : "bg-slate-800 text-slate-300"}`}>
                            <Building2 className="w-5 h-5" />
                          </div>
                          <div>
                            <h3 className="font-bold text-base text-white">{b.branchName}</h3>
                            <p className="text-xs text-slate-400 flex items-center gap-1 mt-0.5">
                              <MapPin className="w-3 h-3 text-amber-400 shrink-0" />
                              <span>{b.city}{b.state ? `, ${b.state}` : ""}</span>
                            </p>
                          </div>
                        </div>

                        {b.isHeadOffice && (
                          <span className="bg-amber-500/20 text-amber-300 border border-amber-500/40 text-[10px] font-extrabold px-2 py-0.5 rounded-full uppercase tracking-wider shrink-0">
                            Head Office
                          </span>
                        )}
                      </div>

                      {b.address && (
                        <p className="text-xs text-slate-300 bg-slate-950/60 p-2.5 rounded-xl border border-slate-800 mb-4 font-mono">
                          {b.address}
                        </p>
                      )}

                      {/* Associated counts */}
                      <div className="grid grid-cols-3 gap-2 py-2 border-t border-slate-800/80 text-center mb-4">
                        <div className="bg-slate-950/40 p-2 rounded-lg">
                          <span className="text-[10px] text-slate-400 uppercase font-semibold block">Shipments</span>
                          <span className="text-sm font-bold text-amber-400">{branchShipmentsCount}</span>
                        </div>
                        <div className="bg-slate-950/40 p-2 rounded-lg">
                          <span className="text-[10px] text-slate-400 uppercase font-semibold block">Vehicles</span>
                          <span className="text-sm font-bold text-emerald-400">{branchVehiclesCount}</span>
                        </div>
                        <div className="bg-slate-950/40 p-2 rounded-lg">
                          <span className="text-[10px] text-slate-400 uppercase font-semibold block">Drivers</span>
                          <span className="text-sm font-bold text-sky-400">{branchDriversCount}</span>
                        </div>
                      </div>
                    </div>

                    {/* Actions */}
                    <div className="pt-3 border-t border-slate-800/80 flex items-center justify-between">
                      <span className="text-[10px] text-slate-500 font-mono">
                        ID: {b.id.substring(0, 8)}...
                      </span>

                      {activeRole === "Company Admin" ? (
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => handleOpenEditBranch(b)}
                            className="bg-slate-800 hover:bg-slate-700 text-amber-300 px-2.5 py-1 rounded-lg text-xs font-semibold flex items-center gap-1 border border-slate-700 cursor-pointer"
                          >
                            <Edit className="w-3.5 h-3.5" />
                            <span>Edit</span>
                          </button>
                          <button
                            onClick={() => handleDeleteBranch(b.id)}
                            className="bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/30 p-1.5 rounded-lg text-xs cursor-pointer"
                            title="Delete Branch"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      ) : (
                        <span className="text-[11px] text-slate-500 italic">Read Only</span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
          </>
        )}

      </main>

      {/* MODAL: CREATE SHIPMENT / BILTY */}
      {isAddShipmentOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-fade-in">
          <div className="relative w-full max-w-xl bg-slate-900 border border-slate-800 rounded-2xl p-6 text-slate-100 shadow-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-3 mb-3 border-b border-slate-800">
              <div>
                <h3 className="font-bold text-lg text-white">Create Consignment & Generate LR</h3>
                <p className="text-xs text-slate-400">Saves directly to Firestore `shipments` collection under companyId</p>
              </div>
              <button
                onClick={() => setIsAddShipmentOpen(false)}
                className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateShipment} className="space-y-3.5 text-xs">
              <div>
                <label className="block text-slate-300 font-semibold mb-1">Assigned Branch Hub *</label>
                <select
                  value={shipmentBranchId || getDefaultBranchId()}
                  onChange={(e) => setShipmentBranchId(e.target.value)}
                  className="w-full bg-slate-800 border border-slate-700 rounded-lg p-2 text-amber-300 font-semibold focus:outline-none focus:border-amber-500 cursor-pointer"
                >
                  {branches.map((b) => (
                    <option key={b.id} value={b.id}>
                      {b.branchName} ({b.city}){b.isHeadOffice ? " [Head Office]" : ""}
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-300 font-semibold mb-1">Shipment Type *</label>
                  <select
                    value={shipmentType}
                    onChange={(e) => setShipmentType(e.target.value as ShipmentType)}
                    className="w-full bg-slate-800 border border-slate-700 rounded-lg p-2 text-white focus:outline-none focus:border-amber-500 cursor-pointer"
                  >
                    <option value="FTL">FTL - Full Truck Load</option>
                    <option value="LTL">LTL - Less Than Truckload (Part Cargo)</option>
                    <option value="Express">Express Priority Corridor</option>
                  </select>
                </div>

                <div>
                  <label className="block text-slate-300 font-semibold mb-1">Booking Date *</label>
                  <input
                    type="date"
                    required
                    value={bookingDate}
                    onChange={(e) => setBookingDate(e.target.value)}
                    className="w-full bg-slate-800 border border-slate-700 rounded-lg p-2 text-white focus:outline-none focus:border-amber-500 font-mono"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-300 font-semibold mb-1">Consignor (Sender Company) *</label>
                  <input
                    type="text"
                    required
                    value={consignor}
                    onChange={(e) => setConsignor(e.target.value)}
                    placeholder="e.g. Havells India Ltd"
                    className="w-full bg-slate-800 border border-slate-700 rounded-lg p-2 text-white focus:outline-none focus:border-amber-500"
                  />
                </div>
                <div>
                  <label className="block text-slate-300 font-semibold mb-1">Consignee (Receiver Company) *</label>
                  <input
                    type="text"
                    required
                    value={consignee}
                    onChange={(e) => setConsignee(e.target.value)}
                    placeholder="e.g. Croma Distribution Hub"
                    className="w-full bg-slate-800 border border-slate-700 rounded-lg p-2 text-white focus:outline-none focus:border-amber-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-300 font-semibold mb-1">Origin City / Hub *</label>
                  <input
                    type="text"
                    required
                    value={origin}
                    onChange={(e) => setOrigin(e.target.value)}
                    placeholder="e.g. Delhi NCR"
                    className="w-full bg-slate-800 border border-slate-700 rounded-lg p-2 text-white focus:outline-none focus:border-amber-500"
                  />
                </div>
                <div>
                  <label className="block text-slate-300 font-semibold mb-1">Destination City / Hub *</label>
                  <input
                    type="text"
                    required
                    value={destination}
                    onChange={(e) => setDestination(e.target.value)}
                    placeholder="e.g. Mumbai (Bhiwandi)"
                    className="w-full bg-slate-800 border border-slate-700 rounded-lg p-2 text-white focus:outline-none focus:border-amber-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block text-slate-300 font-semibold mb-1">Cargo Description *</label>
                  <input
                    type="text"
                    required
                    value={cargoType}
                    onChange={(e) => setCargoType(e.target.value)}
                    placeholder="e.g. Electrical Durables"
                    className="w-full bg-slate-800 border border-slate-700 rounded-lg p-2 text-white focus:outline-none focus:border-amber-500"
                  />
                </div>
                <div>
                  <label className="block text-slate-300 font-semibold mb-1">Weight (Tons) *</label>
                  <input
                    type="number"
                    step="0.1"
                    required
                    value={weightTons}
                    onChange={(e) => setWeightTons(e.target.value)}
                    className="w-full bg-slate-800 border border-slate-700 rounded-lg p-2 text-white focus:outline-none focus:border-amber-500 font-mono"
                  />
                </div>
                <div>
                  <label className="block text-slate-300 font-semibold mb-1">Expected Delivery</label>
                  <input
                    type="date"
                    value={expectedDeliveryDate}
                    onChange={(e) => setExpectedDeliveryDate(e.target.value)}
                    className="w-full bg-slate-800 border border-slate-700 rounded-lg p-2 text-white focus:outline-none focus:border-amber-500 font-mono"
                  />
                </div>
              </div>

              {/* Assign Vehicle & Driver dropdowns from company records */}
              <div className="p-3.5 bg-slate-950/80 border border-amber-500/20 rounded-xl space-y-3">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1">
                  <span className="text-[11px] font-bold text-amber-400 uppercase tracking-wide">
                    Assign Fleet Vehicle & Driver
                  </span>
                  <span className="text-[10px] text-slate-400 flex items-center gap-1 font-medium">
                    <AlertCircle className="w-3 h-3 text-amber-400" />
                    <span>En-Route & busy resources disabled</span>
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-slate-300 font-semibold mb-1">Select Fleet Vehicle</label>
                    <select
                      value={shipmentVehicleId}
                      onChange={(e) => {
                        const vId = e.target.value;
                        setShipmentVehicleId(vId);
                        const selV = vehicles.find(v => v.id === vId);
                        if (selV && selV.assignedDriverId) {
                          const targetDriver = drivers.find(d => d.id === selV.assignedDriverId);
                          if (targetDriver && !getActiveShipmentForDriver(targetDriver) && targetDriver.status === "Active") {
                            setShipmentDriverId(targetDriver.id);
                          }
                        }
                      }}
                      className="w-full bg-slate-800 border border-slate-700 rounded-lg p-2 text-amber-300 font-semibold text-xs focus:outline-none focus:border-amber-500 cursor-pointer"
                    >
                      <option value="">-- No Truck Assigned --</option>
                      {vehicles.map((v) => {
                        const activeShipment = getActiveShipmentForVehicle(v);
                        const isEnRoute = v.status === "En-Route" || !!activeShipment;
                        const isMaintenance = v.status === "Maintenance";
                        const isDisabled = isEnRoute || isMaintenance;

                        let statusLabel = v.status;
                        if (activeShipment) {
                          statusLabel = `En-Route (${activeShipment.lrNumber})`;
                        } else if (isMaintenance) {
                          statusLabel = `Maintenance`;
                        }

                        return (
                          <option
                            key={v.id}
                            value={v.id}
                            disabled={isDisabled}
                            className={isDisabled ? "text-slate-500 bg-slate-900" : "text-white font-medium"}
                          >
                            {v.registrationNumber} ({v.type} — {statusLabel}){isDisabled ? " [UNAVAILABLE]" : ""}
                          </option>
                        );
                      })}
                    </select>
                  </div>

                  <div>
                    <label className="block text-slate-300 font-semibold mb-1">Select Driver</label>
                    <select
                      value={shipmentDriverId}
                      onChange={(e) => setShipmentDriverId(e.target.value)}
                      className="w-full bg-slate-800 border border-slate-700 rounded-lg p-2 text-amber-300 font-semibold text-xs focus:outline-none focus:border-amber-500 cursor-pointer"
                    >
                      <option value="">-- No Driver Assigned --</option>
                      {drivers.map((d) => {
                        const activeShipment = getActiveShipmentForDriver(d);
                        const isBusy = !!activeShipment;
                        const isNotActive = d.status !== "Active";
                        const isDisabled = isBusy || isNotActive;

                        let statusLabel = d.status;
                        if (activeShipment) {
                          statusLabel = `On Delivery (${activeShipment.lrNumber})`;
                        }

                        return (
                          <option
                            key={d.id}
                            value={d.id}
                            disabled={isDisabled}
                            className={isDisabled ? "text-slate-500 bg-slate-900" : "text-white font-medium"}
                          >
                            {d.fullName} ({d.phoneNumber} — {statusLabel}){isDisabled ? " [UNAVAILABLE]" : ""}
                          </option>
                        );
                      })}
                    </select>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-300 font-semibold mb-1">Freight Amount (₹) *</label>
                  <input
                    type="number"
                    required
                    value={freightAmount}
                    onChange={(e) => setFreightAmount(e.target.value)}
                    className="w-full bg-slate-800 border border-slate-700 rounded-lg p-2 text-white focus:outline-none focus:border-amber-500 font-mono"
                  />
                </div>
                <div>
                  <label className="block text-slate-300 font-semibold mb-1">Advance Amount Paid (₹)</label>
                  <input
                    type="number"
                    value={advancePaid}
                    onChange={(e) => setAdvancePaid(e.target.value)}
                    className="w-full bg-slate-800 border border-slate-700 rounded-lg p-2 text-white focus:outline-none focus:border-amber-500 font-mono"
                  />
                </div>
              </div>

              <div>
                <label className="block text-slate-300 font-semibold mb-1">E-Way Bill Number</label>
                <input
                  type="text"
                  value={ewayBillNo}
                  onChange={(e) => setEwayBillNo(e.target.value)}
                  placeholder="e.g. 3810 9920 1142"
                  className="w-full bg-slate-800 border border-slate-700 rounded-lg p-2 text-white focus:outline-none focus:border-amber-500 font-mono"
                />
              </div>

              <div className="flex justify-end gap-3 pt-4 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setIsAddShipmentOpen(false)}
                  className="px-4 py-2 bg-slate-800 hover:bg-slate-700 rounded-lg text-slate-300 font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold rounded-lg shadow"
                >
                  Save LR Document
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: ADD VEHICLE */}
      {isAddVehicleOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-fade-in">
          <div className="relative w-full max-w-md bg-slate-900 border border-slate-800 rounded-2xl p-6 text-slate-100 shadow-2xl">
            <h3 className="font-bold text-lg text-white mb-3">Add Truck to Fleet</h3>
            <form onSubmit={handleAddVehicle} className="space-y-3 text-xs">
              <div>
                <label className="block text-slate-300 font-semibold mb-1">Assigned Branch Hub *</label>
                <select
                  value={vehBranchId || getDefaultBranchId()}
                  onChange={(e) => setVehBranchId(e.target.value)}
                  className="w-full bg-slate-800 border border-slate-700 rounded-lg p-2 text-amber-300 font-semibold focus:outline-none focus:border-amber-500 cursor-pointer"
                >
                  {branches.map((b) => (
                    <option key={b.id} value={b.id}>
                      {b.branchName} ({b.city}){b.isHeadOffice ? " [Head Office]" : ""}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-slate-300 font-semibold mb-1">Registration Number</label>
                <input
                  type="text"
                  required
                  value={regNum}
                  onChange={(e) => setRegNum(e.target.value)}
                  placeholder="MH 04 FK 9021"
                  className="w-full bg-slate-800 border border-slate-700 rounded-lg p-2 text-white focus:outline-none focus:border-amber-500 font-mono uppercase"
                />
              </div>
              <div>
                <label className="block text-slate-300 font-semibold mb-1">Truck Model</label>
                <input
                  type="text"
                  required
                  value={vehModel}
                  onChange={(e) => setVehModel(e.target.value)}
                  placeholder="Tata Prima 3530.K / BharatBenz 1920"
                  className="w-full bg-slate-800 border border-slate-700 rounded-lg p-2 text-white focus:outline-none focus:border-amber-500"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-300 font-semibold mb-1">Capacity (MT)</label>
                  <input
                    type="number"
                    value={vehCapacity}
                    onChange={(e) => setVehCapacity(e.target.value)}
                    className="w-full bg-slate-800 border border-slate-700 rounded-lg p-2 text-white focus:outline-none focus:border-amber-500"
                  />
                </div>
                <div>
                  <label className="block text-slate-300 font-semibold mb-1">Assigned Driver</label>
                  <select
                    value={vehDriverId}
                    onChange={(e) => {
                      const selectedId = e.target.value;
                      setVehDriverId(selectedId);
                      const dObj = drivers.find(d => d.id === selectedId);
                      if (dObj) {
                        setVehDriver(dObj.fullName);
                      }
                    }}
                    className="w-full bg-slate-800 border border-slate-700 rounded-lg p-2 text-white focus:outline-none focus:border-amber-500 cursor-pointer"
                  >
                    <option value="">-- Select Company Driver --</option>
                    {drivers.map((d) => (
                      <option key={d.id} value={d.id}>
                        {d.fullName} ({d.licenseType} - {d.status})
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Optional Custom Driver Name fallback */}
              {!vehDriverId && (
                <div>
                  <label className="block text-slate-300 font-semibold mb-1">Or Manual Driver Name</label>
                  <input
                    type="text"
                    value={vehDriver}
                    onChange={(e) => setVehDriver(e.target.value)}
                    placeholder="e.g. Ramesh Kumar"
                    className="w-full bg-slate-800 border border-slate-700 rounded-lg p-2 text-white focus:outline-none focus:border-amber-500"
                  />
                </div>
              )}

              <div className="flex justify-end gap-3 pt-4 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setIsAddVehicleOpen(false)}
                  className="px-4 py-2 bg-slate-800 hover:bg-slate-700 rounded-lg text-slate-300 font-semibold cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold rounded-lg shadow cursor-pointer"
                >
                  Save Vehicle
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: ADD / EDIT DRIVER */}
      {isAddDriverOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-fade-in">
          <div className="relative w-full max-w-lg bg-slate-900 border border-slate-800 rounded-2xl p-6 text-slate-100 shadow-2xl max-h-[90vh] overflow-y-auto">
            <h3 className="font-bold text-lg text-white mb-1 flex items-center gap-2">
              <Contact className="w-5 h-5 text-amber-400" />
              {editingDriver ? "Edit Driver Profile" : "Add New Commercial Driver"}
            </h3>
            <p className="text-xs text-slate-400 mb-4">
              Saved directly to Firestore `drivers` collection under companyId.
            </p>

            <form onSubmit={handleSaveDriver} className="space-y-3 text-xs">
              <div>
                <label className="block text-slate-300 font-semibold mb-1">Assigned Branch Hub *</label>
                <select
                  value={driverBranchId || editingDriver?.branchId || getDefaultBranchId()}
                  onChange={(e) => setDriverBranchId(e.target.value)}
                  className="w-full bg-slate-800 border border-slate-700 rounded-lg p-2 text-amber-300 font-semibold focus:outline-none focus:border-amber-500 cursor-pointer"
                >
                  {branches.map((b) => (
                    <option key={b.id} value={b.id}>
                      {b.branchName} ({b.city}){b.isHeadOffice ? " [Head Office]" : ""}
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-300 font-semibold mb-1">Full Name *</label>
                  <input
                    type="text"
                    required
                    value={driverFullName}
                    onChange={(e) => setDriverFullName(e.target.value)}
                    placeholder="e.g. Ramesh Kumar"
                    className="w-full bg-slate-800 border border-slate-700 rounded-lg p-2 text-white focus:outline-none focus:border-amber-500"
                  />
                </div>
                <div>
                  <label className="block text-slate-300 font-semibold mb-1">Phone Number *</label>
                  <input
                    type="text"
                    required
                    value={driverPhone}
                    onChange={(e) => setDriverPhone(e.target.value)}
                    placeholder="+91 98765 43210"
                    className="w-full bg-slate-800 border border-slate-700 rounded-lg p-2 text-white focus:outline-none focus:border-amber-500 font-mono"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-300 font-semibold mb-1">License Number *</label>
                  <input
                    type="text"
                    required
                    value={driverLicenseNo}
                    onChange={(e) => setDriverLicenseNo(e.target.value)}
                    placeholder="DL-042019008812"
                    className="w-full bg-slate-800 border border-slate-700 rounded-lg p-2 text-white focus:outline-none focus:border-amber-500 font-mono uppercase"
                  />
                </div>
                <div>
                  <label className="block text-slate-300 font-semibold mb-1">License Type *</label>
                  <select
                    value={driverLicenseType}
                    onChange={(e) => setDriverLicenseType(e.target.value as DriverLicenseType)}
                    className="w-full bg-slate-800 border border-slate-700 rounded-lg p-2 text-white focus:outline-none focus:border-amber-500 cursor-pointer"
                  >
                    <option value="Transport">Transport (Heavy Commercial)</option>
                    <option value="HMV">HMV (Heavy Motor Vehicle)</option>
                    <option value="LMV">LMV (Light Motor Vehicle)</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-300 font-semibold mb-1">License Expiry Date *</label>
                  <input
                    type="date"
                    required
                    value={driverLicenseExpiry}
                    onChange={(e) => setDriverLicenseExpiry(e.target.value)}
                    className="w-full bg-slate-800 border border-slate-700 rounded-lg p-2 text-white focus:outline-none focus:border-amber-500 font-mono"
                  />
                </div>
                <div>
                  <label className="block text-slate-300 font-semibold mb-1">Driver Status *</label>
                  <select
                    value={driverStatus}
                    onChange={(e) => setDriverStatus(e.target.value as DriverStatus)}
                    className="w-full bg-slate-800 border border-slate-700 rounded-lg p-2 text-white focus:outline-none focus:border-amber-500 cursor-pointer"
                  >
                    <option value="Active">Active</option>
                    <option value="On Leave">On Leave</option>
                    <option value="Inactive">Inactive</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-300 font-semibold mb-1">Assigned Vehicle (Optional)</label>
                  <select
                    value={driverAssignedVehicleId}
                    onChange={(e) => setDriverAssignedVehicleId(e.target.value)}
                    className="w-full bg-slate-800 border border-slate-700 rounded-lg p-2 text-white focus:outline-none focus:border-amber-500 cursor-pointer"
                  >
                    <option value="">-- Unassigned --</option>
                    {vehicles.map((v) => (
                      <option key={v.id} value={v.id}>
                        {v.registrationNumber} ({v.model})
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-slate-300 font-semibold mb-1">Joining Date</label>
                  <input
                    type="date"
                    value={driverJoiningDate}
                    onChange={(e) => setDriverJoiningDate(e.target.value)}
                    className="w-full bg-slate-800 border border-slate-700 rounded-lg p-2 text-white focus:outline-none focus:border-amber-500 font-mono"
                  />
                </div>
              </div>

              <div>
                <label className="block text-slate-300 font-semibold mb-1">Address / Driver Base</label>
                <textarea
                  rows={2}
                  value={driverAddress}
                  onChange={(e) => setDriverAddress(e.target.value)}
                  placeholder="Street address, city, state"
                  className="w-full bg-slate-800 border border-slate-700 rounded-lg p-2 text-white focus:outline-none focus:border-amber-500"
                />
              </div>

              {/* Driver Mobile App Account Credentials (Optional) */}
              <div className="bg-slate-950/80 border border-slate-800 rounded-xl p-3 space-y-2">
                <div className="flex items-center gap-1.5 text-xs font-bold text-amber-400">
                  <UserCheck className="w-4 h-4" />
                  <span>Driver Mobile Portal Login Account</span>
                </div>
                <p className="text-[11px] text-slate-400">
                  Optionally set an email and temporary password to create a real Firebase Auth account with role <strong className="text-white">Driver</strong> so they can log into the Driver App.
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1">
                  <div>
                    <label className="block text-slate-300 font-semibold mb-1 text-[11px]">Driver Email</label>
                    <input
                      type="email"
                      value={driverEmail}
                      onChange={(e) => setDriverEmail(e.target.value)}
                      placeholder="driver.name@thadam.in"
                      className="w-full bg-slate-800 border border-slate-700 rounded-lg p-2 text-white text-xs focus:outline-none focus:border-amber-500 font-mono"
                    />
                  </div>
                  <div>
                    <label className="block text-slate-300 font-semibold mb-1 text-[11px]">Temporary Password</label>
                    <input
                      type="password"
                      value={driverPassword}
                      onChange={(e) => setDriverPassword(e.target.value)}
                      placeholder={editingDriver?.authUid ? "(Account already provisioned)" : "Min 6 characters"}
                      disabled={!!editingDriver?.authUid}
                      className="w-full bg-slate-800 border border-slate-700 rounded-lg p-2 text-white text-xs focus:outline-none focus:border-amber-500 font-mono disabled:opacity-50"
                    />
                  </div>
                </div>
              </div>

              <div className="flex justify-end gap-3 pt-4 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setIsAddDriverOpen(false)}
                  className="px-4 py-2 bg-slate-800 hover:bg-slate-700 rounded-lg text-slate-300 font-semibold cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isProvisioningDriverAuth}
                  className="px-5 py-2 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold rounded-lg shadow cursor-pointer flex items-center gap-2 disabled:opacity-50"
                >
                  {isProvisioningDriverAuth && <RefreshCw className="w-4 h-4 animate-spin" />}
                  <span>{editingDriver ? "Update Driver Profile" : "Save Driver"}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: ADD INVOICE */}
      {isAddInvoiceOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-fade-in">
          <div className="relative w-full max-w-md bg-slate-900 border border-slate-800 rounded-2xl p-6 text-slate-100 shadow-2xl">
            <h3 className="font-bold text-lg text-white mb-3">Create Tax Invoice</h3>
            <form onSubmit={handleCreateInvoice} className="space-y-3 text-xs">
              <div>
                <label className="block text-slate-300 font-semibold mb-1">LR Number Ref</label>
                <input
                  type="text"
                  required
                  value={invLrNum}
                  onChange={(e) => setInvLrNum(e.target.value)}
                  placeholder="LR-2026-9001"
                  className="w-full bg-slate-800 border border-slate-700 rounded-lg p-2 text-white focus:outline-none focus:border-amber-500 font-mono"
                />
              </div>
              <div>
                <label className="block text-slate-300 font-semibold mb-1">Billed Client Name</label>
                <input
                  type="text"
                  required
                  value={invClient}
                  onChange={(e) => setInvClient(e.target.value)}
                  placeholder="Havells India Electricals"
                  className="w-full bg-slate-800 border border-slate-700 rounded-lg p-2 text-white focus:outline-none focus:border-amber-500"
                />
              </div>
              <div>
                <label className="block text-slate-300 font-semibold mb-1">Freight Amount (₹)</label>
                <input
                  type="number"
                  required
                  value={invAmount}
                  onChange={(e) => setInvAmount(e.target.value)}
                  className="w-full bg-slate-800 border border-slate-700 rounded-lg p-2 text-white focus:outline-none focus:border-amber-500 font-mono"
                />
              </div>

              <div className="flex justify-end gap-3 pt-4 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setIsAddInvoiceOpen(false)}
                  className="px-4 py-2 bg-slate-800 hover:bg-slate-700 rounded-lg text-slate-300 font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold rounded-lg shadow"
                >
                  Issue Tax Invoice
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: ADD TEAM MEMBER */}
      {isAddMemberOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-fade-in">
          <div className="relative w-full max-w-md bg-slate-900 border border-slate-800 rounded-2xl p-6 text-slate-100 shadow-2xl">
            <h3 className="font-bold text-lg text-white mb-3">Add Company Team Member</h3>
            <form onSubmit={handleAddMember} className="space-y-3 text-xs">
              <div>
                <label className="block text-slate-300 font-semibold mb-1">Full Name</label>
                <input
                  type="text"
                  required
                  value={memberName}
                  onChange={(e) => setMemberName(e.target.value)}
                  placeholder="e.g. Priya Nair"
                  className="w-full bg-slate-800 border border-slate-700 rounded-lg p-2 text-white focus:outline-none focus:border-amber-500"
                />
              </div>
              <div>
                <label className="block text-slate-300 font-semibold mb-1">Work Email</label>
                <input
                  type="email"
                  required
                  value={memberEmail}
                  onChange={(e) => setMemberEmail(e.target.value)}
                  placeholder="priya@company.com"
                  className="w-full bg-slate-800 border border-slate-700 rounded-lg p-2 text-white focus:outline-none focus:border-amber-500"
                />
              </div>
              <div>
                <label className="block text-slate-300 font-semibold mb-1">Assign Access Role</label>
                <select
                  value={memberRole}
                  onChange={(e) => setMemberRole(e.target.value as UserRole)}
                  className="w-full bg-slate-800 border border-slate-700 rounded-lg p-2 text-white focus:outline-none focus:border-amber-500"
                >
                  <option value="Dispatcher">Dispatcher</option>
                  <option value="Fleet Manager">Fleet Manager</option>
                  <option value="Accounts">Accounts</option>
                </select>
              </div>

              <div className="flex justify-end gap-3 pt-4 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setIsAddMemberOpen(false)}
                  className="px-4 py-2 bg-slate-800 hover:bg-slate-700 rounded-lg text-slate-300 font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold rounded-lg shadow"
                >
                  Add Member
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: ADD / EDIT BRANCH */}
      {isAddBranchOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-fade-in">
          <div className="relative w-full max-w-md bg-slate-900 border border-slate-800 rounded-2xl p-6 text-slate-100 shadow-2xl">
            <div className="flex items-center justify-between pb-3 mb-3 border-b border-slate-800">
              <div>
                <h3 className="font-bold text-lg text-white">
                  {editingBranch ? "Edit Branch Hub" : "Add New Company Branch"}
                </h3>
                <p className="text-xs text-slate-400">
                  Saved in Firestore `branches` collection under companyId
                </p>
              </div>
              <button
                onClick={() => setIsAddBranchOpen(false)}
                className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveBranch} className="space-y-3.5 text-xs">
              <div>
                <label className="block text-slate-300 font-semibold mb-1">Branch / Hub Name *</label>
                <input
                  type="text"
                  required
                  value={branchName}
                  onChange={(e) => setBranchName(e.target.value)}
                  placeholder="e.g. Delhi NCR Regional Hub"
                  className="w-full bg-slate-800 border border-slate-700 rounded-lg p-2 text-white focus:outline-none focus:border-amber-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-300 font-semibold mb-1">City *</label>
                  <input
                    type="text"
                    required
                    value={branchCity}
                    onChange={(e) => setBranchCity(e.target.value)}
                    placeholder="e.g. Delhi"
                    className="w-full bg-slate-800 border border-slate-700 rounded-lg p-2 text-white focus:outline-none focus:border-amber-500"
                  />
                </div>
                <div>
                  <label className="block text-slate-300 font-semibold mb-1">State</label>
                  <input
                    type="text"
                    value={branchState}
                    onChange={(e) => setBranchState(e.target.value)}
                    placeholder="e.g. Delhi"
                    className="w-full bg-slate-800 border border-slate-700 rounded-lg p-2 text-white focus:outline-none focus:border-amber-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-slate-300 font-semibold mb-1">Full Street Address</label>
                <input
                  type="text"
                  value={branchAddress}
                  onChange={(e) => setBranchAddress(e.target.value)}
                  placeholder="e.g. Plot 42, Transport Nagar, GT Road"
                  className="w-full bg-slate-800 border border-slate-700 rounded-lg p-2 text-white focus:outline-none focus:border-amber-500"
                />
              </div>

              <div className="p-3 bg-slate-950 rounded-xl border border-slate-800 flex items-center justify-between">
                <div>
                  <span className="block font-semibold text-slate-200">Head Office Hub</span>
                  <span className="text-[11px] text-slate-400 block">Designate as primary company headquarters branch</span>
                </div>
                <input
                  type="checkbox"
                  checked={branchIsHeadOffice}
                  onChange={(e) => setBranchIsHeadOffice(e.target.checked)}
                  className="w-4 h-4 accent-amber-500 cursor-pointer"
                />
              </div>

              <div className="flex justify-end gap-3 pt-4 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setIsAddBranchOpen(false)}
                  className="px-4 py-2 bg-slate-800 hover:bg-slate-700 rounded-lg text-slate-300 font-semibold cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold rounded-lg shadow cursor-pointer"
                >
                  Save Branch
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Lorry Receipt Printable Modal */}
      <LorryReceiptModal
        shipment={selectedLrShipment}
        company={companyProfile}
        onClose={() => setSelectedLrShipment(null)}
      />

      {/* Shipment Lifecycle Detail & Status Update Modal */}
      <ShipmentDetailModal
        shipment={selectedTrackShipment}
        company={companyProfile}
        vehicles={vehicles}
        drivers={drivers}
        userRole={activeRole}
        canUpdateStatus={canUpdateShipment}
        onClose={() => setSelectedTrackShipment(null)}
        onUpdateStatus={(targetStatus, note) => {
          if (selectedTrackShipment) {
            handleAdvanceShipmentStatus(selectedTrackShipment, targetStatus, note);
          }
        }}
        onPrintLr={(s) => {
          setSelectedTrackShipment(null);
          setSelectedLrShipment(s);
        }}
      />

    </div>
  );
};
