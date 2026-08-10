import React from "react";
import { Truck, ShieldCheck, LogOut, User, Building2, ChevronRight, Zap } from "lucide-react";
import { useAuth } from "../context/AuthContext";

interface NavbarProps {
  onOpenAuth: (mode: "login" | "signup") => void;
  onNavigateHome?: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({ onOpenAuth, onNavigateHome }) => {
  const { currentUser, userProfile, companyProfile, logout, signInDemo, loading } = useAuth();

  return (
    <header className="sticky top-0 z-40 bg-slate-900 border-b border-slate-800 text-white shadow-md">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
        
        {/* Brand Logo */}
        <div 
          onClick={onNavigateHome}
          className="flex items-center gap-3 cursor-pointer group"
          id="brand-logo-button"
        >
          <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-amber-500 to-orange-600 flex items-center justify-center text-slate-950 font-bold shadow-lg shadow-orange-500/20 group-hover:scale-105 transition-transform">
            <Truck className="w-6 h-6 stroke-[2.5]" />
          </div>
          <div>
            <div className="flex items-center gap-1.5">
              <span className="font-extrabold text-xl tracking-tight text-white font-sans">
                Thadam
              </span>
              <span className="bg-amber-400/10 text-amber-300 border border-amber-400/20 text-[10px] font-semibold uppercase px-1.5 py-0.5 rounded">
                India
              </span>
            </div>
            <p className="text-xs text-slate-400 font-medium hidden sm:block">Logistics & Bilty OS</p>
          </div>
        </div>

        {/* Action Controls */}
        <div className="flex items-center gap-3">
          {currentUser ? (
            <div className="flex items-center gap-3">
              {/* Signed In User Pill */}
              <div className="hidden md:flex items-center gap-2.5 bg-slate-800/80 border border-slate-700/80 rounded-lg px-3 py-1.5 text-xs">
                <div className="w-7 h-7 rounded-full bg-amber-500/20 text-amber-400 flex items-center justify-center font-bold">
                  <User className="w-4 h-4" />
                </div>
                <div className="text-left">
                  <div className="font-semibold text-slate-100 flex items-center gap-1">
                    {userProfile?.displayName || currentUser.email}
                    <span className="bg-emerald-500/10 text-emerald-400 text-[10px] px-1.5 py-0.2 rounded border border-emerald-500/20">
                      {userProfile?.role || "Company Admin"}
                    </span>
                  </div>
                  <div className="text-slate-400 text-[11px] flex items-center gap-1 truncate max-w-[180px]">
                    <Building2 className="w-3 h-3 text-slate-400" />
                    {companyProfile?.name || userProfile?.companyName || "Logistics Pvt Ltd"}
                  </div>
                </div>
              </div>

              {/* Logout Button */}
              <button
                id="logout-button"
                onClick={logout}
                className="flex items-center gap-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white px-3 py-1.5 rounded-lg text-xs font-medium border border-slate-700 transition-colors"
                title="Sign Out"
              >
                <LogOut className="w-3.5 h-3.5" />
                <span>Sign Out</span>
              </button>
            </div>
          ) : (
            <div className="flex items-center gap-2">
              {/* Quick Demo Button */}
              <button
                id="quick-demo-login-nav"
                onClick={signInDemo}
                disabled={loading}
                className="hidden sm:flex items-center gap-1.5 bg-amber-500/10 hover:bg-amber-500/20 text-amber-400 border border-amber-500/30 px-3 py-1.5 rounded-lg text-xs font-medium transition-all"
              >
                <Zap className="w-3.5 h-3.5 fill-amber-400 text-amber-400" />
                <span>Quick Demo Login</span>
              </button>

              {/* Login Button */}
              <button
                id="login-nav-button"
                onClick={() => onOpenAuth("login")}
                className="text-slate-300 hover:text-white px-3 py-1.5 rounded-lg text-xs font-medium hover:bg-slate-800 transition-colors"
              >
                Sign In
              </button>

              {/* Sign Up CTA */}
              <button
                id="signup-nav-button"
                onClick={() => onOpenAuth("signup")}
                className="flex items-center gap-1 bg-amber-500 hover:bg-amber-400 text-slate-950 font-semibold px-3.5 py-1.5 rounded-lg text-xs shadow-md shadow-amber-500/20 transition-all"
              >
                <span>Register Transporter</span>
                <ChevronRight className="w-3.5 h-3.5" />
              </button>
            </div>
          )}
        </div>

      </div>
    </header>
  );
};
