export type UserRole = "Company Admin" | "Dispatcher" | "Fleet Manager" | "Accounts" | "Driver";

export interface Branch {
  id: string;
  companyId: string;
  branchName: string;
  city: string;
  state?: string;
  address?: string;
  isHeadOffice: boolean;
  createdAt: string;
}

export interface FreightUser {
  uid: string;
  email: string;
  displayName: string;
  companyId: string;
  companyName: string;
  role: UserRole;
  phone?: string;
  branchId?: string;
  driverRecordId?: string;
  createdAt: string;
}

export type SubscriptionPlan = "Starter" | "Growth";
export type SubscriptionStatus = "active" | "inactive" | "expired" | "none";

export interface FreightCompany {
  id: string;
  name: string;
  ownerUid: string;
  gstin?: string;
  city?: string;
  state?: string;
  fleetCount?: number;
  subscriptionPlan?: SubscriptionPlan;
  subscriptionStatus?: SubscriptionStatus;
  subscriptionRenewsAt?: string;
  maxVehicles?: number;
  isDemoAccount?: boolean;
  lastPaymentId?: string;
  lastOrderId?: string;
  createdAt: string;
}

export type ShipmentType = "FTL" | "LTL" | "Express";
export type ShipmentStatus = "Booked" | "Loaded" | "In Transit" | "Delivered" | "Cancelled";

export interface ShipmentStatusHistoryItem {
  status: ShipmentStatus;
  timestamp: string;
  updatedByRole?: string;
  note?: string;
}

export interface Shipment {
  id: string;
  companyId: string;
  branchId?: string;
  lrNumber: string;
  origin: string;
  destination: string;
  consignor: string;
  consignorGst?: string;
  consignee: string;
  consigneeGst?: string;
  cargoType: string;
  shipmentType?: ShipmentType;
  weightTons?: number;
  truckType?: string;
  assignedVehicleId?: string;
  assignedTruckNumber?: string;
  assignedDriverId?: string;
  driverName?: string;
  driverPhone?: string;
  freightAmount: number;
  advancePaid: number;
  ewayBillNo?: string;
  status: ShipmentStatus;
  bookingDate?: string;
  expectedDeliveryDate?: string;
  statusHistory?: ShipmentStatusHistoryItem[];
  createdAt: string;
  notes?: string;
}

export interface Vehicle {
  id: string;
  companyId: string;
  branchId?: string;
  registrationNumber: string;
  model: string;
  capacityTons: number;
  type: string;
  status: "Available" | "En-Route" | "Maintenance";
  fastagBalance: number;
  driverName?: string;
  assignedDriverId?: string;
  lastLocation?: string;
  permitValidTill?: string;
}

export type DriverLicenseType = "LMV" | "HMV" | "Transport";
export type DriverStatus = "Active" | "On Leave" | "Inactive";

export interface Driver {
  id: string;
  companyId: string;
  branchId?: string;
  fullName: string;
  phoneNumber: string;
  licenseNumber: string;
  licenseExpiry: string; // ISO Date YYYY-MM-DD
  licenseType: DriverLicenseType;
  status: DriverStatus;
  assignedVehicleId?: string;
  address: string;
  joiningDate: string; // ISO Date YYYY-MM-DD;
  email?: string;
  authUid?: string;
  createdAt: string;
}

export interface RateEstimate {
  origin: string;
  destination: string;
  distanceKm: number;
  truckType: string;
  weightTons: number;
  estimatedBaseFreight: number;
  gst5: number;
  totalWithGst5: number;
  estimatedHours: number;
  estimatedDays: number;
  dieselPriceUsed: number;
}

export interface Invoice {
  id: string;
  companyId: string;
  invoiceNumber: string;
  lrNumber: string;
  clientName: string;
  amount: number;
  gstAmount: number;
  totalAmount: number;
  status: "Draft" | "Issued" | "Paid" | "Overdue";
  dueDate: string;
  createdAt: string;
}

export interface Payment {
  id: string;
  companyId: string;
  invoiceNumber: string;
  amountPaid: number;
  paymentMode: "NEFT/RTGS" | "UPI" | "Cheque" | "Cash";
  referenceNo: string;
  paidAt: string;
}

export interface DriverLocation {
  id?: string;
  driverId: string;
  shipmentId: string;
  companyId: string;
  latitude: number;
  longitude: number;
  timestamp: string; // ISO string or timestamp
}


