import React, { useState } from "react";
import { AuthProvider, useAuth } from "./context/AuthContext";
import { Navbar } from "./components/Navbar";
import { LandingPage } from "./components/LandingPage";
import { Dashboard } from "./components/Dashboard";
import { DriverDashboard } from "./components/DriverDashboard";
import { AdminPanel } from "./components/AdminPanel";
import { AuthModal } from "./components/AuthModal";
import { Truck } from "lucide-react";

function MainContent() {
  const { currentUser, userProfile, isSuperAdmin, loading } = useAuth();
  const [authModalOpen, setAuthModalOpen] = useState(false);
  const [authModalMode, setAuthModalMode] = useState<"login" | "signup">("login");
  const [showAdminView, setShowAdminView] = useState(false);

  const handleOpenAuth = (mode: "login" | "signup") => {
    setAuthModalMode(mode);
    setAuthModalOpen(true);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center text-slate-100">
        <div className="w-12 h-12 rounded-2xl bg-amber-500/20 text-amber-400 flex items-center justify-center border border-amber-500/30 animate-bounce mb-4">
          <Truck className="w-6 h-6 stroke-[2.5]" />
        </div>
        <p className="text-sm font-semibold text-slate-300">Connecting Thadam to Firebase...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans">
      <Navbar
        onOpenAuth={handleOpenAuth}
        onNavigateHome={() => setShowAdminView(false)}
        onOpenAdminPanel={() => setShowAdminView(true)}
      />

      {currentUser ? (
        showAdminView && isSuperAdmin ? (
          <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 w-full">
            <AdminPanel onBackToApp={() => setShowAdminView(false)} />
          </main>
        ) : userProfile?.role === "Driver" ? (
          <DriverDashboard />
        ) : (
          <Dashboard />
        )
      ) : (
        <LandingPage onOpenAuth={handleOpenAuth} />
      )}

      <AuthModal
        isOpen={authModalOpen}
        initialMode={authModalMode}
        onClose={() => setAuthModalOpen(false)}
      />
    </div>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <MainContent />
    </AuthProvider>
  );
}
