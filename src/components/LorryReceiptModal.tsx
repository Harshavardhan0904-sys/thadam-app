import React from "react";
import { X, Printer, Truck, FileText, CheckCircle2, ShieldCheck } from "lucide-react";
import { Shipment, FreightCompany } from "../types";

interface LorryReceiptModalProps {
  shipment: Shipment | null;
  company: FreightCompany | null;
  onClose: () => void;
}

export const LorryReceiptModal: React.FC<LorryReceiptModalProps> = ({
  shipment,
  company,
  onClose
}) => {
  if (!shipment) return null;

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-fade-in overflow-y-auto">
      <div className="relative w-full max-w-3xl bg-white text-slate-900 rounded-2xl shadow-2xl overflow-hidden my-8 border border-slate-200">
        
        {/* Controls Bar */}
        <div className="flex items-center justify-between px-6 py-3 bg-slate-900 text-white print:hidden">
          <div className="flex items-center gap-2">
            <FileText className="w-5 h-5 text-amber-400" />
            <span className="font-bold text-sm">Official Consignment Note (Lorry Receipt / Bilty)</span>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={handlePrint}
              className="flex items-center gap-1.5 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold px-3.5 py-1.5 rounded-lg text-xs transition-colors"
            >
              <Printer className="w-4 h-4" />
              <span>Print / Download PDF</span>
            </button>
            <button
              onClick={onClose}
              className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Printable Document Body */}
        <div className="p-8 space-y-6 font-sans text-xs" id="printable-lr-document">
          
          {/* Header & Transporter info */}
          <div className="flex justify-between items-start border-b-2 border-slate-900 pb-4">
            <div>
              <div className="flex items-center gap-2 text-slate-900 font-extrabold text-2xl tracking-tight">
                <Truck className="w-7 h-7 text-amber-600" />
                <span>{company?.name || "THADAM LOGISTICS PVT LTD"}</span>
              </div>
              <p className="text-slate-600 font-medium text-xs mt-1">
                Head Office: {company?.city || "Mumbai"}, India | Reg GSTIN: {company?.gstin?.trim() ? company.gstin : "Unregistered / Exempt"}
              </p>
              <p className="text-slate-500 text-[11px]">Approved Goods Transport Agency (GTA) Consignment Note</p>
            </div>

            <div className="text-right border-l-2 border-amber-500 pl-4 py-1">
              <div className="text-xs uppercase font-extrabold text-amber-700 tracking-wider">LORRY RECEIPT (BILTY)</div>
              <div className="text-xl font-extrabold text-slate-900 font-mono mt-0.5">{shipment.lrNumber}</div>
              <div className="text-[11px] text-slate-500 mt-0.5">Date: {shipment?.createdAt ? new Date(shipment.createdAt).toLocaleDateString('en-IN') : 'N/A'}</div>
            </div>
          </div>

          {/* Consignor & Consignee details */}
          <div className="grid grid-cols-2 gap-4 bg-slate-50 p-4 rounded-xl border border-slate-200">
            <div className="space-y-1">
              <p className="font-extrabold text-slate-800 uppercase tracking-wider text-[10px] text-amber-700">CONSIGNOR (SENDER)</p>
              <p className="font-bold text-sm text-slate-900">{shipment.consignor}</p>
              <p className="text-slate-600">GSTIN: {shipment.consignorGst || "27AAACG1111A1Z0"}</p>
              <p className="text-slate-600">Origin: <strong className="text-slate-900">{shipment.origin}</strong></p>
            </div>

            <div className="space-y-1 border-l border-slate-300 pl-4">
              <p className="font-extrabold text-slate-800 uppercase tracking-wider text-[10px] text-amber-700">CONSIGNEE (RECEIVER)</p>
              <p className="font-bold text-sm text-slate-900">{shipment.consignee}</p>
              <p className="text-slate-600">GSTIN: {shipment.consigneeGst || "07AAACR2222B1Z9"}</p>
              <p className="text-slate-600">Destination: <strong className="text-slate-900">{shipment.destination}</strong></p>
            </div>
          </div>

          {/* Vehicle & Dispatch Specs */}
          <div className="grid grid-cols-4 gap-3 bg-slate-900 text-white p-4 rounded-xl font-mono text-xs">
            <div>
              <p className="text-slate-400 text-[10px] uppercase">TRUCK REGISTRATION NO</p>
              <p className="font-extrabold text-amber-400 text-sm mt-0.5">{shipment.assignedTruckNumber || "MH 04 FK 8812"}</p>
            </div>
            <div>
              <p className="text-slate-400 text-[10px] uppercase">DRIVER NAME</p>
              <p className="font-bold text-slate-100 text-xs mt-0.5">{shipment.driverName || "Sartaj Singh"}</p>
            </div>
            <div>
              <p className="text-slate-400 text-[10px] uppercase">E-WAY BILL NO</p>
              <p className="font-bold text-amber-300 text-xs mt-0.5">{shipment.ewayBillNo || "3810 9920 4412"}</p>
            </div>
            <div>
              <p className="text-slate-400 text-[10px] uppercase">STATUS</p>
              <p className="font-bold text-emerald-400 text-xs mt-0.5 uppercase">{shipment.status}</p>
            </div>
          </div>

          {/* Cargo Table */}
          <div className="border border-slate-300 rounded-xl overflow-hidden">
            <table className="w-full text-left">
              <thead className="bg-slate-100 text-slate-700 uppercase text-[10px] font-bold border-b border-slate-300">
                <tr>
                  <th className="p-3">Cargo Description</th>
                  <th className="p-3">Truck Type</th>
                  <th className="p-3">Weight (Tons)</th>
                  <th className="p-3 text-right">Freight Charges (₹)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 font-medium">
                <tr>
                  <td className="p-3 font-semibold text-slate-900">{shipment.cargoType}</td>
                  <td className="p-3">{shipment.truckType}</td>
                  <td className="p-3 font-mono">{shipment.weightTons} MT</td>
                  <td className="p-3 text-right font-mono font-bold">₹{(shipment.freightAmount || 0).toLocaleString('en-IN')}</td>
                </tr>
              </tbody>
            </table>
          </div>

          {/* Payment Summary */}
          <div className="flex justify-between items-end border-t border-slate-300 pt-4">
            <div className="space-y-1 text-slate-600 text-[11px] max-w-sm">
              <p className="font-bold text-slate-900 flex items-center gap-1">
                <ShieldCheck className="w-4 h-4 text-emerald-600" />
                Goods Transported Under Standard Carrier Conditions
              </p>
              <p>• Goods received in sound condition for carriage to destination.</p>
              <p>• Subject to GST GTA regulations under reverse charge.</p>
            </div>

            <div className="w-64 bg-slate-50 p-3 rounded-xl border border-slate-200 space-y-1.5 font-mono text-xs">
              <div className="flex justify-between">
                <span className="text-slate-600">Base Freight:</span>
                <span className="font-semibold">₹{(shipment.freightAmount || 0).toLocaleString('en-IN')}</span>
              </div>
              <div className="flex justify-between text-emerald-700">
                <span>Advance Paid:</span>
                <span>- ₹{(shipment.advancePaid || 0).toLocaleString('en-IN')}</span>
              </div>
              <div className="flex justify-between border-t border-slate-300 pt-1.5 font-extrabold text-slate-900 text-sm">
                <span>Balance Due:</span>
                <span className="text-amber-700">
                  ₹{((shipment.freightAmount || 0) - (shipment.advancePaid || 0)).toLocaleString('en-IN')}
                </span>
              </div>
            </div>
          </div>

          {/* Signatures */}
          <div className="grid grid-cols-2 gap-8 pt-8 text-center text-slate-500 text-[11px]">
            <div className="border-t border-slate-300 pt-2">
              <p className="font-bold text-slate-800">Consignor / Driver Signature</p>
            </div>
            <div className="border-t border-slate-300 pt-2">
              <p className="font-bold text-slate-800">For {company?.name || "Thadam Logistics"}</p>
            </div>
          </div>

        </div>

      </div>
    </div>
  );
};
