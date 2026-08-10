import React from "react";
import { Truck, ShieldCheck, FileText, Zap, ArrowRight, Building2, BarChart3, Users, CheckCircle2, ChevronRight, Calculator, Navigation } from "lucide-react";
import { RateCalculatorWidget } from "./RateCalculatorWidget";
import { useAuth } from "../context/AuthContext";

interface LandingPageProps {
  onOpenAuth: (mode: "login" | "signup") => void;
}

export const LandingPage: React.FC<LandingPageProps> = ({ onOpenAuth }) => {
  const { signInDemo, loading } = useAuth();

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 font-sans selection:bg-amber-500 selection:text-slate-950">
      
      {/* Hero Banner Section */}
      <section className="relative pt-16 pb-20 px-4 sm:px-6 lg:px-8 overflow-hidden">
        {/* Subtle background glow effect */}
        <div className="absolute top-1/4 left-1/2 -translate-x-1/2 w-[600px] h-[300px] bg-amber-500/10 blur-[120px] rounded-full pointer-events-none" />

        <div className="max-w-6xl mx-auto text-center relative z-10">
          
          {/* Badge */}
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-slate-900 border border-slate-800 text-xs font-medium text-amber-400 mb-6 shadow-sm">
            <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse" />
            <span>Next-Gen Logistics Operating System for Indian Freight</span>
          </div>

          {/* Main Title */}
          <h1 className="text-4xl sm:text-6xl font-extrabold tracking-tight text-white mb-6 leading-tight">
            Digitize Your Freight Fleet, <br className="hidden sm:block" />
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-amber-400 via-orange-400 to-amber-200">
              Generate Bilty & Manage Dispatch
            </span>
          </h1>

          <p className="max-w-3xl mx-auto text-slate-300 text-base sm:text-lg mb-8 leading-relaxed font-normal">
            Thadam is the complete cloud platform for Indian fleet owners, transport contractors, and freight forwarders. Create instant digital Lorry Receipts (LR/Bilty), calculate GST tariffs, monitor FASTag balances, and empower your company team.
          </p>

          {/* CTA Buttons */}
          <div className="flex flex-wrap items-center justify-center gap-4 mb-12">
            <button
              id="hero-register-btn"
              onClick={() => onOpenAuth("signup")}
              className="bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold px-7 py-3.5 rounded-xl text-sm flex items-center gap-2 shadow-xl shadow-amber-500/25 hover:scale-[1.02] transition-all"
            >
              <span>Register Your Company</span>
              <ArrowRight className="w-4 h-4 stroke-[2.5]" />
            </button>

            <button
              id="hero-demo-btn"
              onClick={signInDemo}
              disabled={loading}
              className="bg-slate-900 hover:bg-slate-800 text-slate-200 border border-slate-700 px-6 py-3.5 rounded-xl text-sm font-semibold flex items-center gap-2 hover:border-amber-500/50 transition-all"
            >
              <Zap className="w-4 h-4 text-amber-400 fill-amber-400" />
              <span>Instant Demo Sign In</span>
            </button>
          </div>

          {/* Feature Badges */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 max-w-4xl mx-auto pt-6 border-t border-slate-800/80 text-xs text-slate-400 font-medium">
            <div className="flex items-center justify-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-amber-400" />
              <span>Firebase Auth & Firestore</span>
            </div>
            <div className="flex items-center justify-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-amber-400" />
              <span>Digital Lorry Receipts (LR)</span>
            </div>
            <div className="flex items-center justify-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-amber-400" />
              <span>National Highway Tariff API</span>
            </div>
            <div className="flex items-center justify-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-amber-400" />
              <span>Company & Admin Roles</span>
            </div>
          </div>

        </div>
      </section>

      {/* Interactive Freight Rate & Tariff Estimator Section */}
      <section className="py-12 px-4 sm:px-6 lg:px-8 max-w-6xl mx-auto">
        <div className="text-center mb-8">
          <h2 className="text-2xl sm:text-3xl font-bold text-white">Live Indian Highway Tariff & Rate Estimator</h2>
          <p className="text-slate-400 text-xs sm:text-sm mt-1">
            Test our real-time freight pricing engine below before signing in!
          </p>
        </div>
        <RateCalculatorWidget />
      </section>

      {/* Grid Features */}
      <section className="py-16 px-4 sm:px-6 lg:px-8 max-w-6xl mx-auto border-t border-slate-800/60">
        <div className="text-center mb-12">
          <h2 className="text-2xl sm:text-3xl font-bold text-white">Built Specifically for Indian Transporters</h2>
          <p className="text-slate-400 text-xs sm:text-sm mt-1">Everything your logistics company needs in one unified dashboard</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 hover:border-amber-500/40 transition-all">
            <div className="w-10 h-10 rounded-xl bg-amber-500/10 text-amber-400 flex items-center justify-center mb-4 border border-amber-500/20">
              <FileText className="w-5 h-5" />
            </div>
            <h3 className="font-bold text-lg text-white mb-2">Digital Lorry Receipt (Bilty)</h3>
            <p className="text-slate-400 text-xs leading-relaxed">
              Generate GST-compliant Bilty notes with Consignor, Consignee, E-Way Bill Number, and Freight Breakdown. Print or download as PDF instantly.
            </p>
          </div>

          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 hover:border-amber-500/40 transition-all">
            <div className="w-10 h-10 rounded-xl bg-amber-500/10 text-amber-400 flex items-center justify-center mb-4 border border-amber-500/20">
              <Truck className="w-5 h-5" />
            </div>
            <h3 className="font-bold text-lg text-white mb-2">Fleet & Driver Telematics</h3>
            <p className="text-slate-400 text-xs leading-relaxed">
              Track vehicle status across Tata Prima, Ashok Leyland, and Eicher trucks. Keep tabs on FASTag toll balances and National Permit expiry.
            </p>
          </div>

          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 hover:border-amber-500/40 transition-all">
            <div className="w-10 h-10 rounded-xl bg-amber-500/10 text-amber-400 flex items-center justify-center mb-4 border border-amber-500/20">
              <Users className="w-5 h-5" />
            </div>
            <h3 className="font-bold text-lg text-white mb-2">Company Admin & Team Access</h3>
            <p className="text-slate-400 text-xs leading-relaxed">
              Upon sign-up, your company document is created in Firestore and your account is set as Company Admin. Invite Dispatchers and Accounts team members.
            </p>
          </div>

        </div>
      </section>

      {/* Footer CTA */}
      <footer className="py-12 border-t border-slate-800 text-center text-xs text-slate-500">
        <p>© 2026 Thadam Logistics India. Powered by Firebase Authentication & Firestore.</p>
      </footer>

    </div>
  );
};
