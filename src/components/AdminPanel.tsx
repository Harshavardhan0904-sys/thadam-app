import React, { useState, useEffect } from "react";
import {
  ShieldCheck, Building2, Truck, Users, FileText, IndianRupee, Search,
  RefreshCw, Lock, AlertTriangle, ChevronRight, Edit3, ArrowLeft, Plus,
  CheckCircle2, Clock, MapPin, Contact, Calendar, Sliders, Shield, Eye,
  Trash2, Filter, AlertCircle, Sparkles, UserCheck, CreditCard
} from "lucide-react";
import {
  collection, getDocs, doc, updateDoc, deleteDoc, query, where, addDoc, setDoc
} from "firebase/firestore";
import { db } from "../lib/firebase";
import { useAuth } from "../context/AuthContext";
import {
  FreightCompany, FreightUser, Shipment, Vehicle, Driver, Invoice, Branch,
  SubscriptionPlan, SubscriptionStatus, UserRole
} from "../types";

export const AdminPanel: React.FC<{ onBackToApp?: () => void }> = ({ onBackToApp }) => {
  const { currentUser, isSuperAdmin, refreshSuperAdminStatus } = useAuth();

  // State
  const [companies, setCompanies] = useState<FreightCompany[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("All");
  const [planFilter, setPlanFilter] = useState<string>("All");

  // Company Detail View State
  const [selectedCompany, setSelectedCompany] = useState<FreightCompany | null>(null);
  const [companyDetailTab, setCompanyDetailTab] = useState<"overview" | "shipments" | "vehicles" | "drivers" | "invoices" | "users" | "branches">("overview");

  // Company Collections Data for Selected Company
  const [compShipments, setCompShipments] = useState<Shipment[]>([]);
  const [compVehicles, setCompVehicles] = useState<Vehicle[]>([]);
  const [compDrivers, setCompDrivers] = useState<Driver[]>([]);
  const [compInvoices, setCompInvoices] = useState<Invoice[]>([]);
  const [compUsers, setCompUsers] = useState<FreightUser[]>([]);
  const [compBranches, setCompBranches] = useState<Branch[]>([]);
  const [loadingDetails, setLoadingDetails] = useState(false);

  // Override Subscription Modal State
  const [overrideModalCompany, setOverrideModalCompany] = useState<FreightCompany | null>(null);
  const [overrideStatus, setOverrideStatus] = useState<SubscriptionStatus>("active");
  const [overridePlan, setOverridePlan] = useState<SubscriptionPlan>("Growth");
  const [overrideMaxVehicles, setOverrideMaxVehicles] = useState<number>(30);
  const [overrideRenewal, setOverrideRenewal] = useState<string>("2099-12-31T23:59:59.000Z");
  const [isSavingOverride, setIsSavingOverride] = useState(false);

  // Initial Fetch of Platform Companies
  const loadPlatformCompanies = async () => {
    setLoading(true);
    try {
      // Re-verify super admin claim token
      await refreshSuperAdminStatus();
      
      const compSnap = await getDocs(collection(db, "companies"));
      const list: FreightCompany[] = [];
      compSnap.forEach((d) => {
        list.push({ id: d.id, ...d.data() } as FreightCompany);
      });
      // Sort newest first
      list.sort((a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime());
      setCompanies(list);
    } catch (err: any) {
      console.error("Error fetching platform companies:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isSuperAdmin) {
      loadPlatformCompanies();
    } else {
      setLoading(false);
    }
  }, [isSuperAdmin]);

  // Drill down into selected company data
  const loadCompanyDetails = async (company: FreightCompany) => {
    setSelectedCompany(company);
    setLoadingDetails(true);
    try {
      const cId = company.id;

      // 1. Shipments
      const shipSnap = await getDocs(query(collection(db, "shipments"), where("companyId", "==", cId)));
      const ships: Shipment[] = [];
      shipSnap.forEach((d) => ships.push({ id: d.id, ...d.data() } as Shipment));
      setCompShipments(ships);

      // 2. Vehicles
      const vehSnap = await getDocs(query(collection(db, "vehicles"), where("companyId", "==", cId)));
      const vehs: Vehicle[] = [];
      vehSnap.forEach((d) => vehs.push({ id: d.id, ...d.data() } as Vehicle));
      setCompVehicles(vehs);

      // 3. Drivers
      const drvSnap = await getDocs(query(collection(db, "drivers"), where("companyId", "==", cId)));
      const drvs: Driver[] = [];
      drvSnap.forEach((d) => drvs.push({ id: d.id, ...d.data() } as Driver));
      setCompDrivers(drvs);

      // 4. Invoices
      const invSnap = await getDocs(query(collection(db, "invoices"), where("companyId", "==", cId)));
      const invs: Invoice[] = [];
      invSnap.forEach((d) => invs.push({ id: d.id, ...d.data() } as Invoice));
      setCompInvoices(invs);

      // 5. Users
      const usrSnap = await getDocs(query(collection(db, "users"), where("companyId", "==", cId)));
      const usrs: FreightUser[] = [];
      usrSnap.forEach((d) => usrs.push({ uid: d.id, ...d.data() } as FreightUser));
      setCompUsers(usrs);

      // 6. Branches
      const brSnap = await getDocs(query(collection(db, "branches"), where("companyId", "==", cId)));
      const brs: Branch[] = [];
      brSnap.forEach((d) => brs.push({ id: d.id, ...d.data() } as Branch));
      setCompBranches(brs);

    } catch (err: any) {
      console.error("Error loading company details for super admin:", err);
      alert("Failed to fetch complete company records: " + (err.message || err));
    } finally {
      setLoadingDetails(false);
    }
  };

  // Open Override Modal
  const handleOpenOverride = (company: FreightCompany, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    setOverrideModalCompany(company);
    setOverrideStatus(company.subscriptionStatus || "active");
    setOverridePlan(company.subscriptionPlan || "Growth");
    setOverrideMaxVehicles(company.maxVehicles || 30);
    setOverrideRenewal(company.subscriptionRenewsAt || "2099-12-31T23:59:59.000Z");
  };

  // Save Subscription Override
  const handleSaveOverride = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!overrideModalCompany) return;
    setIsSavingOverride(true);
    try {
      const compRef = doc(db, "companies", overrideModalCompany.id);
      const updatePayload = {
        subscriptionStatus: overrideStatus,
        subscriptionPlan: overridePlan,
        maxVehicles: Number(overrideMaxVehicles),
        subscriptionRenewsAt: overrideRenewal
      };

      await updateDoc(compRef, updatePayload);

      // Update state locally
      setCompanies((prev) =>
        prev.map((c) => (c.id === overrideModalCompany.id ? { ...c, ...updatePayload } : c))
      );

      if (selectedCompany?.id === overrideModalCompany.id) {
        setSelectedCompany((prev) => (prev ? { ...prev, ...updatePayload } : null));
      }

      alert(`Successfully updated subscription parameters for ${overrideModalCompany.name}!`);
      setOverrideModalCompany(null);
    } catch (err: any) {
      console.error("Super Admin Override Error:", err);
      alert("Firestore Permission Denied or Error: " + (err.message || err));
    } finally {
      setIsSavingOverride(false);
    }
  };

  // Delete Shipment as Super Admin
  const handleDeleteShipment = async (sId: string) => {
    if (!confirm("Super Admin Action: Permanently delete this shipment record?")) return;
    try {
      await deleteDoc(doc(db, "shipments", sId));
      setCompShipments((prev) => prev.filter((s) => s.id !== sId));
    } catch (err: any) {
      alert("Error deleting shipment: " + err.message);
    }
  };

  // Delete Vehicle as Super Admin
  const handleDeleteVehicle = async (vId: string) => {
    if (!confirm("Super Admin Action: Delete this fleet vehicle document?")) return;
    try {
      await deleteDoc(doc(db, "vehicles", vId));
      setCompVehicles((prev) => prev.filter((v) => v.id !== vId));
    } catch (err: any) {
      alert("Error deleting vehicle: " + err.message);
    }
  };

  // Delete Driver as Super Admin
  const handleDeleteDriver = async (dId: string) => {
    if (!confirm("Super Admin Action: Delete this driver document?")) return;
    try {
      await deleteDoc(doc(db, "drivers", dId));
      setCompDrivers((prev) => prev.filter((d) => d.id !== dId));
    } catch (err: any) {
      alert("Error deleting driver: " + err.message);
    }
  };

  // Delete Invoice as Super Admin
  const handleDeleteInvoice = async (iId: string) => {
    if (!confirm("Super Admin Action: Delete this invoice record?")) return;
    try {
      await deleteDoc(doc(db, "invoices", iId));
      setCompInvoices((prev) => prev.filter((i) => i.id !== iId));
    } catch (err: any) {
      alert("Error deleting invoice: " + err.message);
    }
  };

  // Filtered Companies
  const filteredCompanies = companies.filter((c) => {
    const q = searchQuery.toLowerCase();
    const matchesQuery =
      c.name.toLowerCase().includes(q) ||
      (c.city && c.city.toLowerCase().includes(q)) ||
      (c.gstin && c.gstin.toLowerCase().includes(q)) ||
      c.id.toLowerCase().includes(q);

    const matchesStatus =
      statusFilter === "All" ||
      (statusFilter === "Active" && (c.subscriptionStatus === "active" || c.isDemoAccount)) ||
      (statusFilter === "Inactive" && c.subscriptionStatus !== "active" && !c.isDemoAccount);

    const matchesPlan =
      planFilter === "All" || c.subscriptionPlan === planFilter;

    return matchesQuery && matchesStatus && matchesPlan;
  });

  // Security Guard Check
  if (!isSuperAdmin) {
    return (
      <div className="min-h-[80vh] flex flex-col items-center justify-center p-6 text-center">
        <div className="w-16 h-16 rounded-2xl bg-rose-500/10 border border-rose-500/30 text-rose-400 flex items-center justify-center mb-4 shadow-xl">
          <Lock className="w-8 h-8 stroke-[2]" />
        </div>
        <div className="max-w-md space-y-3">
          <span className="bg-rose-500/20 text-rose-300 border border-rose-500/30 text-xs font-semibold px-3 py-1 rounded-full uppercase tracking-wider">
            Access Denied
          </span>
          <h2 className="text-2xl font-black text-white">Super Admin Token Required</h2>
          <p className="text-xs text-slate-400 leading-relaxed">
            The Admin Panel requires an authenticated Firebase ID token containing the <code className="text-amber-300 bg-slate-800 px-1.5 py-0.5 rounded font-mono">superAdmin: true</code> custom claim.
          </p>
          <div className="pt-2">
            <button
              onClick={refreshSuperAdminStatus}
              className="bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 px-4 py-2 rounded-xl text-xs font-semibold inline-flex items-center gap-2"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              <span>Re-verify ID Token Custom Claims</span>
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      
      {/* Super Admin Panel Title & Header */}
      <div className="bg-gradient-to-r from-purple-950/60 via-slate-900 to-indigo-950/60 border border-purple-500/30 rounded-2xl p-6 shadow-2xl">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-2xl bg-purple-500/20 text-purple-300 border border-purple-500/30 flex items-center justify-center shadow-lg shadow-purple-500/20">
              <ShieldCheck className="w-7 h-7" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-2xl font-extrabold text-white tracking-tight">
                  Platform Admin Panel
                </h1>
                <span className="bg-purple-500/20 text-purple-300 border border-purple-500/30 text-[10px] font-bold uppercase px-2 py-0.5 rounded-full flex items-center gap-1">
                  <Sparkles className="w-3 h-3 text-purple-300" />
                  Super Admin
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-1">
                Cross-company platform management, manual subscription overrides, and global logistics records.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={loadPlatformCompanies}
              className="bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 px-3.5 py-2 rounded-xl text-xs font-semibold flex items-center gap-2 transition-all"
              title="Refresh Firestore Companies"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin text-purple-400" : ""}`} />
              <span>Refresh Companies</span>
            </button>

            {onBackToApp && (
              <button
                onClick={onBackToApp}
                className="bg-purple-600 hover:bg-purple-500 text-white font-semibold px-4 py-2 rounded-xl text-xs flex items-center gap-1.5 shadow-lg shadow-purple-600/30 transition-all"
              >
                <ArrowLeft className="w-4 h-4" />
                <span>Return to Operations</span>
              </button>
            )}
          </div>
        </div>

        {/* Global Platform Metrics */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-6 pt-6 border-t border-purple-500/20">
          <div className="bg-slate-900/80 border border-purple-500/20 rounded-xl p-3.5">
            <div className="text-[11px] text-slate-400 font-medium">Total Companies</div>
            <div className="text-xl font-black text-white mt-0.5">{companies.length}</div>
          </div>
          <div className="bg-slate-900/80 border border-emerald-500/20 rounded-xl p-3.5">
            <div className="text-[11px] text-emerald-400/80 font-medium">Active Subscriptions</div>
            <div className="text-xl font-black text-emerald-400 mt-0.5">
              {companies.filter((c) => c.subscriptionStatus === "active" || c.isDemoAccount).length}
            </div>
          </div>
          <div className="bg-slate-900/80 border border-amber-500/20 rounded-xl p-3.5">
            <div className="text-[11px] text-amber-400/80 font-medium">Starter vs Growth</div>
            <div className="text-xl font-black text-amber-300 mt-0.5">
              {companies.filter((c) => c.subscriptionPlan === "Starter").length} / {companies.filter((c) => c.subscriptionPlan === "Growth").length}
            </div>
          </div>
          <div className="bg-slate-900/80 border border-indigo-500/20 rounded-xl p-3.5">
            <div className="text-[11px] text-indigo-400/80 font-medium">Total Fleet Capacity</div>
            <div className="text-xl font-black text-indigo-300 mt-0.5">
              {companies.reduce((sum, c) => sum + (c.fleetCount || c.maxVehicles || 0), 0)} trucks
            </div>
          </div>
        </div>
      </div>

      {/* Main Content Area: Company List OR Detailed View */}
      {selectedCompany ? (
        
        /* DRILL-DOWN COMPANY DETAIL VIEW */
        <div className="space-y-6 animate-fade-in">
          
          {/* Breadcrumb & Selected Company Header */}
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <button
                onClick={() => setSelectedCompany(null)}
                className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 transition-colors"
                title="Back to All Companies List"
              >
                <ArrowLeft className="w-4 h-4" />
              </button>
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="text-xl font-bold text-white">{selectedCompany.name}</h2>
                  <span className={`text-[10px] font-bold uppercase px-2.5 py-0.5 rounded border ${
                    selectedCompany.subscriptionStatus === "active" || selectedCompany.isDemoAccount
                      ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/30"
                      : "bg-rose-500/10 text-rose-400 border-rose-500/30"
                  }`}>
                    {selectedCompany.isDemoAccount ? "Demo Account" : selectedCompany.subscriptionStatus || "Inactive"}
                  </span>
                </div>
                <p className="text-xs text-slate-400 mt-0.5">
                  ID: <span className="font-mono text-slate-300">{selectedCompany.id}</span> • City: <strong className="text-slate-200">{selectedCompany.city || "Mumbai"}</strong> • GSTIN: <strong className="text-slate-200">{selectedCompany.gstin || "N/A"}</strong>
                </p>
              </div>
            </div>

            <button
              onClick={(e) => handleOpenOverride(selectedCompany, e)}
              className="bg-purple-600/20 hover:bg-purple-600/30 text-purple-300 border border-purple-500/40 px-3.5 py-2 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-all"
            >
              <Sliders className="w-3.5 h-3.5" />
              <span>Override Subscription & Limits</span>
            </button>
          </div>

          {/* Company Detailed Tabs */}
          <div className="flex gap-2 border-b border-slate-800 pb-2 overflow-x-auto">
            {[
              { id: "overview", label: "Company Overview", icon: Building2 },
              { id: "shipments", label: `Shipments (${compShipments.length})`, icon: FileText },
              { id: "vehicles", label: `Fleet (${compVehicles.length})`, icon: Truck },
              { id: "drivers", label: `Drivers (${compDrivers.length})`, icon: Contact },
              { id: "invoices", label: `Invoices (${compInvoices.length})`, icon: IndianRupee },
              { id: "users", label: `Users & Team (${compUsers.length})`, icon: Users },
              { id: "branches", label: `Branches (${compBranches.length})`, icon: Building2 },
            ].map((tab) => {
              const Icon = tab.icon;
              const isActive = companyDetailTab === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => setCompanyDetailTab(tab.id as any)}
                  className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold whitespace-nowrap transition-all ${
                    isActive
                      ? "bg-purple-600 text-white shadow-md shadow-purple-600/20"
                      : "bg-slate-800/60 text-slate-400 hover:text-slate-200 hover:bg-slate-800"
                  }`}
                >
                  <Icon className="w-4 h-4" />
                  <span>{tab.label}</span>
                </button>
              );
            })}
          </div>

          {/* Tab Contents */}
          {loadingDetails ? (
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-12 text-center text-slate-400">
              <RefreshCw className="w-8 h-8 animate-spin mx-auto text-purple-400 mb-3" />
              <p className="text-sm font-semibold">Fetching full company records from Firestore...</p>
            </div>
          ) : (
            <div>
              
              {/* TAB 1: OVERVIEW */}
              {companyDetailTab === "overview" && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 space-y-4">
                    <h3 className="font-bold text-sm text-white flex items-center gap-2">
                      <Building2 className="w-4 h-4 text-purple-400" />
                      Company Info & Parameters
                    </h3>
                    <div className="space-y-2.5 text-xs">
                      <div className="flex justify-between py-1.5 border-b border-slate-800">
                        <span className="text-slate-400">Company Name:</span>
                        <strong className="text-slate-200">{selectedCompany.name}</strong>
                      </div>
                      <div className="flex justify-between py-1.5 border-b border-slate-800">
                        <span className="text-slate-400">Owner User UID:</span>
                        <span className="font-mono text-purple-300">{selectedCompany.ownerUid || "N/A"}</span>
                      </div>
                      <div className="flex justify-between py-1.5 border-b border-slate-800">
                        <span className="text-slate-400">GSTIN:</span>
                        <strong className="text-slate-200">{selectedCompany.gstin || "Unregistered"}</strong>
                      </div>
                      <div className="flex justify-between py-1.5 border-b border-slate-800">
                        <span className="text-slate-400">Headquarters City:</span>
                        <strong className="text-slate-200">{selectedCompany.city || "Mumbai"}</strong>
                      </div>
                      <div className="flex justify-between py-1.5 border-b border-slate-800">
                        <span className="text-slate-400">Registered On:</span>
                        <span className="text-slate-300">
                          {selectedCompany.createdAt ? new Date(selectedCompany.createdAt).toLocaleDateString() : "N/A"}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 space-y-4">
                    <h3 className="font-bold text-sm text-white flex items-center gap-2">
                      <CreditCard className="w-4 h-4 text-emerald-400" />
                      Subscription & Vehicle Limits
                    </h3>
                    <div className="space-y-2.5 text-xs">
                      <div className="flex justify-between py-1.5 border-b border-slate-800">
                        <span className="text-slate-400">Subscription Status:</span>
                        <span className={`font-bold ${selectedCompany.subscriptionStatus === "active" ? "text-emerald-400" : "text-rose-400"}`}>
                          {selectedCompany.subscriptionStatus?.toUpperCase() || "INACTIVE"}
                        </span>
                      </div>
                      <div className="flex justify-between py-1.5 border-b border-slate-800">
                        <span className="text-slate-400">Subscription Plan:</span>
                        <span className="text-amber-300 font-semibold">{selectedCompany.subscriptionPlan || "Starter"}</span>
                      </div>
                      <div className="flex justify-between py-1.5 border-b border-slate-800">
                        <span className="text-slate-400">Vehicle Limit (maxVehicles):</span>
                        <strong className="text-white">{selectedCompany.maxVehicles || 10} vehicles</strong>
                      </div>
                      <div className="flex justify-between py-1.5 border-b border-slate-800">
                        <span className="text-slate-400">Renews / Valid Till:</span>
                        <span className="text-slate-300 font-mono">
                          {selectedCompany.subscriptionRenewsAt ? new Date(selectedCompany.subscriptionRenewsAt).toLocaleDateString() : "N/A"}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* TAB 2: SHIPMENTS */}
              {companyDetailTab === "shipments" && (
                <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 space-y-4">
                  <h3 className="font-bold text-sm text-white">Company Shipments & Lorry Receipts ({compShipments.length})</h3>
                  {compShipments.length === 0 ? (
                    <p className="text-xs text-slate-400 italic py-4 text-center">No shipments recorded for this company.</p>
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="w-full text-left text-xs">
                        <thead className="bg-slate-800/80 text-slate-400 font-semibold">
                          <tr>
                            <th className="p-3 rounded-l-xl">LR Number</th>
                            <th className="p-3">Route</th>
                            <th className="p-3">Consignor / Consignee</th>
                            <th className="p-3">Freight</th>
                            <th className="p-3">Status</th>
                            <th className="p-3 rounded-r-xl text-right">Super Admin Action</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-800">
                          {compShipments.map((s) => (
                            <tr key={s.id} className="hover:bg-slate-800/40">
                              <td className="p-3 font-mono text-amber-300 font-bold">{s.lrNumber}</td>
                              <td className="p-3">{s.origin} ➔ {s.destination}</td>
                              <td className="p-3 text-slate-300">{s.consignor} / {s.consignee}</td>
                              <td className="p-3 font-semibold text-emerald-400">₹{(s.freightAmount || 0).toLocaleString('en-IN')}</td>
                              <td className="p-3">
                                <span className="bg-slate-800 text-slate-200 border border-slate-700 px-2 py-0.5 rounded text-[10px]">
                                  {s.status}
                                </span>
                              </td>
                              <td className="p-3 text-right">
                                <button
                                  onClick={() => handleDeleteShipment(s.id)}
                                  className="text-rose-400 hover:text-rose-300 bg-rose-500/10 hover:bg-rose-500/20 p-1.5 rounded-lg border border-rose-500/20 transition-all"
                                  title="Delete Shipment"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              )}

              {/* TAB 3: VEHICLES */}
              {companyDetailTab === "vehicles" && (
                <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 space-y-4">
                  <h3 className="font-bold text-sm text-white">Fleet Telematics & Vehicles ({compVehicles.length})</h3>
                  {compVehicles.length === 0 ? (
                    <p className="text-xs text-slate-400 italic py-4 text-center">No fleet vehicles recorded for this company.</p>
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="w-full text-left text-xs">
                        <thead className="bg-slate-800/80 text-slate-400 font-semibold">
                          <tr>
                            <th className="p-3 rounded-l-xl">Registration No.</th>
                            <th className="p-3">Model / Type</th>
                            <th className="p-3">Capacity</th>
                            <th className="p-3">Driver Name</th>
                            <th className="p-3">Status</th>
                            <th className="p-3 rounded-r-xl text-right">Super Admin Action</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-800">
                          {compVehicles.map((v) => (
                            <tr key={v.id} className="hover:bg-slate-800/40">
                              <td className="p-3 font-mono text-white font-bold">{v.registrationNumber}</td>
                              <td className="p-3 text-slate-300">{v.model} ({v.type})</td>
                              <td className="p-3 text-slate-300">{v.capacityTons} Tons</td>
                              <td className="p-3 text-slate-300">{v.driverName || "Unassigned"}</td>
                              <td className="p-3">
                                <span className={`px-2 py-0.5 rounded text-[10px] font-semibold ${
                                  v.status === "Available" ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20" : "bg-amber-500/10 text-amber-400 border border-amber-500/20"
                                }`}>
                                  {v.status}
                                </span>
                              </td>
                              <td className="p-3 text-right">
                                <button
                                  onClick={() => handleDeleteVehicle(v.id)}
                                  className="text-rose-400 hover:text-rose-300 bg-rose-500/10 hover:bg-rose-500/20 p-1.5 rounded-lg border border-rose-500/20 transition-all"
                                  title="Delete Vehicle"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              )}

              {/* TAB 4: DRIVERS */}
              {companyDetailTab === "drivers" && (
                <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 space-y-4">
                  <h3 className="font-bold text-sm text-white">Registered Drivers ({compDrivers.length})</h3>
                  {compDrivers.length === 0 ? (
                    <p className="text-xs text-slate-400 italic py-4 text-center">No drivers recorded for this company.</p>
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="w-full text-left text-xs">
                        <thead className="bg-slate-800/80 text-slate-400 font-semibold">
                          <tr>
                            <th className="p-3 rounded-l-xl">Driver Name</th>
                            <th className="p-3">Phone</th>
                            <th className="p-3">License Number</th>
                            <th className="p-3">License Expiry</th>
                            <th className="p-3">Status</th>
                            <th className="p-3 rounded-r-xl text-right">Super Admin Action</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-800">
                          {compDrivers.map((d) => (
                            <tr key={d.id} className="hover:bg-slate-800/40">
                              <td className="p-3 font-semibold text-white">{d.fullName}</td>
                              <td className="p-3 font-mono text-slate-300">{d.phoneNumber}</td>
                              <td className="p-3 font-mono text-amber-300">{d.licenseNumber}</td>
                              <td className="p-3 text-slate-300">{d.licenseExpiry || "N/A"}</td>
                              <td className="p-3">
                                <span className={`px-2 py-0.5 rounded text-[10px] font-semibold ${
                                  d.status === "Active" ? "bg-emerald-500/10 text-emerald-400" : "bg-slate-800 text-slate-400"
                                }`}>
                                  {d.status}
                                </span>
                              </td>
                              <td className="p-3 text-right">
                                <button
                                  onClick={() => handleDeleteDriver(d.id)}
                                  className="text-rose-400 hover:text-rose-300 bg-rose-500/10 hover:bg-rose-500/20 p-1.5 rounded-lg border border-rose-500/20 transition-all"
                                  title="Delete Driver"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              )}

              {/* TAB 5: INVOICES */}
              {companyDetailTab === "invoices" && (
                <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 space-y-4">
                  <h3 className="font-bold text-sm text-white">Invoices & Financials ({compInvoices.length})</h3>
                  {compInvoices.length === 0 ? (
                    <p className="text-xs text-slate-400 italic py-4 text-center">No invoices recorded for this company.</p>
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="w-full text-left text-xs">
                        <thead className="bg-slate-800/80 text-slate-400 font-semibold">
                          <tr>
                            <th className="p-3 rounded-l-xl">Invoice No</th>
                            <th className="p-3">LR No</th>
                            <th className="p-3">Client</th>
                            <th className="p-3">Total Amount</th>
                            <th className="p-3">Status</th>
                            <th className="p-3 rounded-r-xl text-right">Super Admin Action</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-800">
                          {compInvoices.map((inv) => (
                            <tr key={inv.id} className="hover:bg-slate-800/40">
                              <td className="p-3 font-mono text-purple-300 font-bold">{inv.invoiceNumber}</td>
                              <td className="p-3 font-mono text-slate-300">{inv.lrNumber}</td>
                              <td className="p-3 text-slate-300">{inv.clientName}</td>
                              <td className="p-3 font-semibold text-emerald-400">₹{(inv.totalAmount || inv.amount).toLocaleString('en-IN')}</td>
                              <td className="p-3">
                                <span className="bg-slate-800 text-slate-300 px-2 py-0.5 rounded text-[10px]">
                                  {inv.status}
                                </span>
                              </td>
                              <td className="p-3 text-right">
                                <button
                                  onClick={() => handleDeleteInvoice(inv.id)}
                                  className="text-rose-400 hover:text-rose-300 bg-rose-500/10 hover:bg-rose-500/20 p-1.5 rounded-lg border border-rose-500/20 transition-all"
                                  title="Delete Invoice"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              )}

              {/* TAB 6: USERS */}
              {companyDetailTab === "users" && (
                <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 space-y-4">
                  <h3 className="font-bold text-sm text-white">Company Users ({compUsers.length})</h3>
                  {compUsers.length === 0 ? (
                    <p className="text-xs text-slate-400 italic py-4 text-center">No team members found in users collection.</p>
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="w-full text-left text-xs">
                        <thead className="bg-slate-800/80 text-slate-400 font-semibold">
                          <tr>
                            <th className="p-3 rounded-l-xl">UID</th>
                            <th className="p-3">Full Name</th>
                            <th className="p-3">Email</th>
                            <th className="p-3">Role</th>
                            <th className="p-3 rounded-r-xl text-right">Phone</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-800">
                          {compUsers.map((u) => (
                            <tr key={u.uid} className="hover:bg-slate-800/40">
                              <td className="p-3 font-mono text-purple-300">{u.uid}</td>
                              <td className="p-3 font-semibold text-white">{u.displayName || "User"}</td>
                              <td className="p-3 text-slate-300 font-mono">{u.email}</td>
                              <td className="p-3">
                                <span className="bg-amber-500/10 text-amber-400 border border-amber-500/20 px-2 py-0.5 rounded text-[10px] font-semibold">
                                  {u.role || "Member"}
                                </span>
                              </td>
                              <td className="p-3 text-right font-mono text-slate-400">{u.phone || "N/A"}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              )}

              {/* TAB 7: BRANCHES */}
              {companyDetailTab === "branches" && (
                <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 space-y-4">
                  <h3 className="font-bold text-sm text-white">Company Branches ({compBranches.length})</h3>
                  {compBranches.length === 0 ? (
                    <p className="text-xs text-slate-400 italic py-4 text-center">No branch documents found for this company.</p>
                  ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      {compBranches.map((br) => (
                        <div key={br.id} className="bg-slate-800/60 border border-slate-700/80 rounded-xl p-4 space-y-1 text-xs">
                          <div className="flex items-center justify-between">
                            <span className="font-bold text-white text-sm">{br.branchName}</span>
                            {br.isHeadOffice && (
                              <span className="bg-amber-500/20 text-amber-300 text-[10px] font-bold px-2 py-0.5 rounded border border-amber-500/30">
                                Head Office
                              </span>
                            )}
                          </div>
                          <div className="text-slate-300">City: <strong>{br.city}</strong> ({br.state || "India"})</div>
                          <div className="text-slate-400 text-[11px]">{br.address || "No address entered"}</div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

            </div>
          )}

        </div>
      ) : (
        
        /* ALL COMPANIES TABLE LISTING */
        <div className="space-y-4 animate-fade-in">
          
          {/* Controls & Search Toolbar */}
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 flex flex-col md:flex-row items-center justify-between gap-4">
            
            {/* Search Input */}
            <div className="relative w-full md:w-96">
              <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Search company name, GSTIN, city..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-10 pr-4 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-purple-500"
              />
            </div>

            {/* Filter Dropdowns */}
            <div className="flex items-center gap-3 w-full md:w-auto">
              <div className="flex items-center gap-1.5 text-xs text-slate-400">
                <Filter className="w-3.5 h-3.5" />
                <span>Status:</span>
                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                  className="bg-slate-950 border border-slate-800 rounded-xl px-2.5 py-1.5 text-xs text-slate-200 focus:outline-none focus:border-purple-500 cursor-pointer"
                >
                  <option value="All">All Statuses</option>
                  <option value="Active">Active Subscriptions</option>
                  <option value="Inactive">Inactive / Expired</option>
                </select>
              </div>

              <div className="flex items-center gap-1.5 text-xs text-slate-400">
                <span>Plan:</span>
                <select
                  value={planFilter}
                  onChange={(e) => setPlanFilter(e.target.value)}
                  className="bg-slate-950 border border-slate-800 rounded-xl px-2.5 py-1.5 text-xs text-slate-200 focus:outline-none focus:border-purple-500 cursor-pointer"
                >
                  <option value="All">All Plans</option>
                  <option value="Starter">Starter Plan</option>
                  <option value="Growth">Growth Plan</option>
                </select>
              </div>
            </div>

          </div>

          {/* Companies Table */}
          <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-xl">
            {loading ? (
              <div className="p-12 text-center text-slate-400 space-y-3">
                <RefreshCw className="w-8 h-8 animate-spin mx-auto text-purple-400" />
                <p className="text-sm font-semibold">Loading companies across platform from Firestore...</p>
              </div>
            ) : filteredCompanies.length === 0 ? (
              <div className="p-12 text-center text-slate-400 space-y-2">
                <Building2 className="w-8 h-8 mx-auto text-slate-600" />
                <p className="text-sm font-semibold text-slate-300">No matching companies found.</p>
                <p className="text-xs text-slate-500">Try adjusting your search query or filters.</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="bg-slate-800/80 text-slate-400 font-semibold border-b border-slate-800">
                      <th className="p-4">Company Name</th>
                      <th className="p-4">GSTIN</th>
                      <th className="p-4">City</th>
                      <th className="p-4">Subscription Status</th>
                      <th className="p-4">Plan</th>
                      <th className="p-4">Vehicles</th>
                      <th className="p-4">Created Date</th>
                      <th className="p-4 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800">
                    {filteredCompanies.map((comp) => {
                      const isActive = comp.subscriptionStatus === "active" || comp.isDemoAccount;
                      return (
                        <tr
                          key={comp.id}
                          onClick={() => loadCompanyDetails(comp)}
                          className="hover:bg-slate-800/50 cursor-pointer transition-colors group"
                        >
                          <td className="p-4">
                            <div className="font-bold text-slate-100 group-hover:text-purple-300 transition-colors flex items-center gap-2">
                              <span>{comp.name}</span>
                              {comp.isDemoAccount && (
                                <span className="bg-amber-500/10 text-amber-300 text-[9px] px-1.5 py-0.2 rounded border border-amber-500/20 font-mono">
                                  Demo
                                </span>
                              )}
                            </div>
                            <div className="text-[10px] font-mono text-slate-500 truncate max-w-[160px]">
                              {comp.id}
                            </div>
                          </td>

                          <td className="p-4 font-mono text-slate-300">
                            {comp.gstin?.trim() ? comp.gstin : <span className="text-slate-600">N/A</span>}
                          </td>

                          <td className="p-4 text-slate-300">
                            {comp.city || "Mumbai"}
                          </td>

                          <td className="p-4">
                            <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[10px] font-extrabold uppercase border ${
                              isActive
                                ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/30"
                                : "bg-rose-500/10 text-rose-400 border-rose-500/30"
                            }`}>
                              <span className={`w-1.5 h-1.5 rounded-full ${isActive ? "bg-emerald-400 animate-pulse" : "bg-rose-400"}`} />
                              {comp.isDemoAccount ? "active (Demo)" : comp.subscriptionStatus || "inactive"}
                            </span>
                          </td>

                          <td className="p-4">
                            <span className="bg-purple-500/10 text-purple-300 border border-purple-500/20 px-2.5 py-0.5 rounded-lg font-bold text-[11px]">
                              {comp.subscriptionPlan || "Starter"}
                            </span>
                          </td>

                          <td className="p-4 text-slate-200 font-semibold">
                            {comp.fleetCount || comp.maxVehicles || 10} <span className="text-[10px] text-slate-400 font-normal">max</span>
                          </td>

                          <td className="p-4 text-slate-400 font-mono">
                            {comp.createdAt ? new Date(comp.createdAt).toLocaleDateString() : "N/A"}
                          </td>

                          <td className="p-4 text-right whitespace-nowrap">
                            <div className="flex items-center justify-end gap-2" onClick={(e) => e.stopPropagation()}>
                              <button
                                onClick={(e) => handleOpenOverride(comp, e)}
                                className="bg-purple-600/20 hover:bg-purple-600/30 text-purple-300 border border-purple-500/30 px-2.5 py-1.5 rounded-lg text-xs font-medium flex items-center gap-1 transition-all"
                                title="Manually override subscription & limits"
                              >
                                <Sliders className="w-3.5 h-3.5" />
                                <span>Override</span>
                              </button>

                              <button
                                onClick={() => loadCompanyDetails(comp)}
                                className="bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 px-2.5 py-1.5 rounded-lg text-xs font-medium flex items-center gap-1 transition-all"
                              >
                                <span>Details</span>
                                <ChevronRight className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>

        </div>
      )}

      {/* MANUAL OVERRIDE SUBSCRIPTION MODAL */}
      {overrideModalCompany && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-purple-500/40 rounded-2xl max-w-lg w-full p-6 space-y-5 shadow-2xl animate-fade-in text-slate-100">
            
            <div className="flex items-center justify-between border-b border-slate-800 pb-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-purple-500/20 text-purple-300 flex items-center justify-center border border-purple-500/30">
                  <Sliders className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-bold text-base text-white">Manual Subscription Override</h3>
                  <p className="text-xs text-slate-400 font-mono">{overrideModalCompany.name}</p>
                </div>
              </div>
              <button
                onClick={() => setOverrideModalCompany(null)}
                className="text-slate-400 hover:text-white p-1 rounded-lg"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSaveOverride} className="space-y-4 text-xs">
              
              <div>
                <label className="block text-slate-300 font-semibold mb-1">Subscription Status</label>
                <select
                  value={overrideStatus}
                  onChange={(e) => setOverrideStatus(e.target.value as SubscriptionStatus)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-purple-500 font-semibold"
                >
                  <option value="active">Active (Unlock Full Features)</option>
                  <option value="inactive">Inactive (Restricted Access)</option>
                  <option value="expired">Expired</option>
                  <option value="none">None</option>
                </select>
              </div>

              <div>
                <label className="block text-slate-300 font-semibold mb-1">Subscription Plan</label>
                <select
                  value={overridePlan}
                  onChange={(e) => setOverridePlan(e.target.value as SubscriptionPlan)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-purple-500 font-semibold"
                >
                  <option value="Starter">Starter Plan (Up to 10 Vehicles)</option>
                  <option value="Growth">Growth Plan (Up to 30 Vehicles)</option>
                </select>
              </div>

              <div>
                <label className="block text-slate-300 font-semibold mb-1">Max Fleet Vehicles Allowance (maxVehicles)</label>
                <input
                  type="number"
                  value={overrideMaxVehicles}
                  onChange={(e) => setOverrideMaxVehicles(Number(e.target.value))}
                  min={1}
                  max={9999}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-purple-500 font-mono font-bold"
                />
                <p className="text-[10px] text-slate-500 mt-1">Set max allowed vehicles limit for support or manual override.</p>
              </div>

              <div>
                <label className="block text-slate-300 font-semibold mb-1">Subscription Renewal / Expiry Date</label>
                <input
                  type="text"
                  value={overrideRenewal}
                  onChange={(e) => setOverrideRenewal(e.target.value)}
                  placeholder="2099-12-31T23:59:59.000Z"
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-purple-500 font-mono"
                />
              </div>

              <div className="bg-purple-950/40 border border-purple-500/20 rounded-xl p-3 text-[11px] text-purple-200">
                <span className="font-bold">Security Note:</span> This directly modifies Firestore fields <code className="text-amber-300">subscriptionStatus</code>, <code className="text-amber-300">subscriptionPlan</code>, and <code className="text-amber-300">maxVehicles</code>. <code className="text-amber-300">firestore.rules</code> authorizes this exclusively for users with <code className="text-amber-300">superAdmin == true</code> custom claim.
              </div>

              <div className="flex items-center justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setOverrideModalCompany(null)}
                  className="bg-slate-800 hover:bg-slate-700 text-slate-300 px-4 py-2 rounded-xl font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSavingOverride}
                  className="bg-purple-600 hover:bg-purple-500 text-white font-bold px-5 py-2 rounded-xl flex items-center gap-2 shadow-lg shadow-purple-600/30"
                >
                  <ShieldCheck className="w-4 h-4" />
                  <span>{isSavingOverride ? "Saving Override..." : "Save Override"}</span>
                </button>
              </div>

            </form>

          </div>
        </div>
      )}

    </div>
  );
};
