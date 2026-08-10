import React, { useState } from "react";
import {
  Check, Zap, ShieldCheck, Sparkles, Building2, Truck, CreditCard,
  AlertCircle, Clock, CheckCircle2, ArrowRight, RefreshCw, Lock
} from "lucide-react";
import { auth } from "../lib/firebase";
import { useAuth } from "../context/AuthContext";
import { SubscriptionPlan } from "../types";

interface PricingPageProps {
  vehicleCount?: number;
  onSubscriptionSuccess?: () => void;
}

export const PricingPage: React.FC<PricingPageProps> = ({ vehicleCount = 0, onSubscriptionSuccess }) => {
  const { userProfile, companyProfile, refreshCompanyProfile } = useAuth();
  const [processingPlan, setProcessingPlan] = useState<SubscriptionPlan | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Test mode payment simulation state for restricted environments
  const [testOrderModal, setTestOrderModal] = useState<{
    orderId: string;
    amount: number;
    planId: SubscriptionPlan;
    keyId: string;
  } | null>(null);

  const companyId = userProfile?.companyId || companyProfile?.id || "";
  const currentPlan = companyProfile?.subscriptionPlan;
  const isSubscriptionActive =
    companyProfile?.subscriptionStatus === "active" &&
    companyProfile?.subscriptionRenewsAt &&
    new Date(companyProfile.subscriptionRenewsAt) > new Date();

  const maxVehicles = companyProfile?.maxVehicles || (currentPlan === "Growth" ? 30 : currentPlan === "Starter" ? 10 : 0);

  // Load Razorpay Script dynamically if needed
  const loadRazorpayScript = (): Promise<boolean> => {
    return new Promise((resolve) => {
      if ((window as any).Razorpay) {
        resolve(true);
        return;
      }
      const script = document.createElement("script");
      script.src = "https://checkout.razorpay.com/v1/checkout.js";
      script.onload = () => resolve(true);
      script.onerror = () => resolve(false);
      document.body.appendChild(script);
    });
  };

  const handleVerifyPayment = async (
    orderId: string,
    paymentId: string,
    signature: string,
    planId: SubscriptionPlan
  ) => {
    try {
      setErrorMsg(null);
      let idToken = "";
      if (auth.currentUser) {
        try {
          idToken = await auth.currentUser.getIdToken();
        } catch (tErr) {
          console.warn("[PricingPage] Failed to retrieve idToken:", tErr);
        }
      }

      const res = await fetch("/api/razorpay/verify-payment", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(idToken ? { Authorization: `Bearer ${idToken}` } : {})
        },
        body: JSON.stringify({
          razorpay_order_id: orderId,
          razorpay_payment_id: paymentId,
          razorpay_signature: signature,
          companyId,
          planId
        })
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || "Payment verification failed server-side.");
      }

      setSuccessMsg(`🎉 Payment Verified! ${planId} Plan activated for 30 days.`);
      setTestOrderModal(null);
      setProcessingPlan(null);

      // Refresh company context
      if (refreshCompanyProfile) {
        await refreshCompanyProfile();
      }
      if (onSubscriptionSuccess) {
        onSubscriptionSuccess();
      }
    } catch (err: any) {
      console.error("Payment verification error:", err);
      setErrorMsg(err.message || "Failed to verify payment.");
      setProcessingPlan(null);
    }
  };

  const handleSubscribe = async (planId: SubscriptionPlan) => {
    if (!companyId) {
      setErrorMsg("Company profile not loaded. Please sign in as Company Admin.");
      return;
    }

    if (userProfile?.role !== "Company Admin") {
      setErrorMsg("Only Company Admins can initiate subscription payments.");
      return;
    }

    setProcessingPlan(planId);
    setErrorMsg(null);
    setSuccessMsg(null);

    try {
      // Step 1: Create Order via Server-side Cloud API
      const orderRes = await fetch("/api/razorpay/create-order", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ companyId, planId })
      });

      const orderData = await orderRes.json();
      if (!orderRes.ok || !orderData.success) {
        throw new Error(orderData.error || "Failed to create Razorpay payment order.");
      }

      const { orderId, amount, currency, keyId, isTestMode } = orderData;

      // Try loading Razorpay Checkout script
      const isScriptLoaded = await loadRazorpayScript();

      if (isScriptLoaded && (window as any).Razorpay) {
        const options = {
          key: keyId,
          amount: amount,
          currency: currency || "INR",
          name: "Thadam Logistics OS",
          description: `Subscription: ${planId} Plan (1 Month)`,
          image: "https://images.unsplash.com/photo-1586528116311-ad8dd3c8310d?auto=format&fit=crop&w=120&q=80",
          order_id: orderId,
          prefill: {
            name: userProfile?.displayName || "Company Admin",
            email: userProfile?.email || "admin@thadam.in",
            contact: userProfile?.phone || "+91 98765 43210"
          },
          theme: {
            color: "#f59e0b"
          },
          handler: async (response: any) => {
            await handleVerifyPayment(
              response.razorpay_order_id,
              response.razorpay_payment_id,
              response.razorpay_signature,
              planId
            );
          },
          modal: {
            ondismiss: () => {
              setProcessingPlan(null);
            }
          }
        };

        const rzp = new (window as any).Razorpay(options);
        rzp.on("payment.failed", (response: any) => {
          setErrorMsg("Payment failed or cancelled: " + (response.error.description || "Unknown error"));
          setProcessingPlan(null);
        });
        rzp.open();
      } else {
        // Fallback for iframe / blocked script environment
        setTestOrderModal({
          orderId,
          amount,
          planId,
          keyId
        });
      }
    } catch (err: any) {
      console.error("Subscription order creation error:", err);
      setErrorMsg(err.message || "Error processing subscription.");
      setProcessingPlan(null);
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
      {/* Header Banner */}
      <div className="text-center max-w-3xl mx-auto space-y-3">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-amber-500/10 border border-amber-500/30 text-amber-400 text-xs font-semibold">
          <Zap className="w-3.5 h-3.5 fill-amber-400" />
          <span>Flexible Subscription Plans for Indian Logistics Transporters</span>
        </div>
        <h1 className="text-3xl sm:text-4xl font-extrabold text-white tracking-tight">
          Manage Your Fleet with <span className="text-amber-400">Thadam</span>
        </h1>
        <p className="text-sm sm:text-base text-slate-400 font-medium">
          Choose a plan tailored to your fleet size. Enjoy digital bilty creation, multi-branch hubs, and automated GST billing with secure Razorpay checkout.
        </p>
      </div>

      {/* Error & Success Messages */}
      {errorMsg && (
        <div className="bg-red-500/10 border border-red-500/30 text-red-300 p-4 rounded-xl flex items-center justify-between text-sm">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-5 h-5 text-red-400 shrink-0" />
            <span>{errorMsg}</span>
          </div>
          <button onClick={() => setErrorMsg(null)} className="text-xs underline hover:text-white">Dismiss</button>
        </div>
      )}

      {successMsg && (
        <div className="bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 p-4 rounded-xl flex items-center justify-between text-sm">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
            <span>{successMsg}</span>
          </div>
          <button onClick={() => setSuccessMsg(null)} className="text-xs underline hover:text-white">Dismiss</button>
        </div>
      )}

      {/* Current Subscription Status Widget */}
      <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-6 shadow-xl relative overflow-hidden">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="space-y-2">
            <div className="flex items-center gap-3">
              <Building2 className="w-5 h-5 text-amber-400" />
              <h3 className="text-lg font-bold text-white">
                {companyProfile?.name || "Company Subscription Status"}
              </h3>
              {isSubscriptionActive ? (
                <span className="bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 text-xs font-semibold px-2.5 py-0.5 rounded-full flex items-center gap-1">
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  Active Plan: {currentPlan}
                </span>
              ) : (
                <span className="bg-amber-500/20 text-amber-400 border border-amber-500/30 text-xs font-semibold px-2.5 py-0.5 rounded-full flex items-center gap-1">
                  <AlertCircle className="w-3.5 h-3.5" />
                  Subscription Inactive
                </span>
              )}
            </div>
            
            <p className="text-xs text-slate-400">
              {isSubscriptionActive && companyProfile?.subscriptionRenewsAt ? (
                <>Next billing renewal on <strong className="text-slate-200">{new Date(companyProfile.subscriptionRenewsAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}</strong></>
              ) : (
                "Select a plan below to activate operational features, vehicle management, and digital bilty generation."
              )}
            </p>
          </div>

          {/* Vehicle Usage Meter */}
          <div className="bg-slate-800/80 border border-slate-700/80 rounded-xl p-4 min-w-[240px] space-y-2">
            <div className="flex items-center justify-between text-xs font-medium">
              <span className="text-slate-400 flex items-center gap-1">
                <Truck className="w-3.5 h-3.5 text-amber-400" />
                Fleet Limit Usage:
              </span>
              <span className="text-slate-200 font-bold">
                {vehicleCount} / {maxVehicles > 0 ? maxVehicles : "0"} Vehicles
              </span>
            </div>

            <div className="w-full bg-slate-900 rounded-full h-2 overflow-hidden border border-slate-700">
              <div
                className={`h-full transition-all ${
                  maxVehicles > 0 && vehicleCount >= maxVehicles
                    ? "bg-red-500"
                    : "bg-amber-500"
                }`}
                style={{
                  width: `${maxVehicles > 0 ? Math.min(100, (vehicleCount / maxVehicles) * 100) : 0}%`
                }}
              />
            </div>
            {maxVehicles > 0 && vehicleCount >= maxVehicles && (
              <p className="text-[11px] text-red-400 font-medium">Vehicle limit reached for current plan.</p>
            )}
          </div>
        </div>
      </div>

      {/* Pricing Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-8 items-stretch">
        
        {/* Starter Plan */}
        <div className={`bg-slate-900 border ${currentPlan === "Starter" && isSubscriptionActive ? "border-amber-500 ring-2 ring-amber-500/30" : "border-slate-800 hover:border-slate-700"} rounded-2xl p-6 sm:p-8 flex flex-col justify-between transition-all relative shadow-xl`}>
          {currentPlan === "Starter" && isSubscriptionActive && (
            <div className="absolute -top-3 right-6 bg-amber-500 text-slate-950 font-bold text-xs uppercase tracking-wider px-3 py-1 rounded-full shadow-md">
              Current Plan
            </div>
          )}

          <div className="space-y-6">
            <div>
              <div className="flex items-center gap-2">
                <ShieldCheck className="w-6 h-6 text-amber-400" />
                <h3 className="text-xl font-bold text-white">Starter Plan</h3>
              </div>
              <p className="text-xs text-slate-400 mt-1">
                Ideal for growing regional transport fleets with up to 10 vehicles.
              </p>
            </div>

            <div className="flex items-baseline gap-2">
              <span className="text-4xl font-extrabold text-white">₹999</span>
              <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">/ month</span>
            </div>

            <div className="border-t border-slate-800 pt-6 space-y-3.5">
              <div className="text-xs font-semibold text-slate-300 uppercase tracking-wider">Includes:</div>
              <ul className="space-y-3 text-xs text-slate-300">
                <li className="flex items-center gap-2.5">
                  <div className="w-5 h-5 rounded-full bg-amber-500/10 text-amber-400 flex items-center justify-center shrink-0">
                    <Check className="w-3.5 h-3.5 stroke-[3]" />
                  </div>
                  <span>Up to <strong>10 Fleet Vehicles</strong></span>
                </li>
                <li className="flex items-center gap-2.5">
                  <div className="w-5 h-5 rounded-full bg-amber-500/10 text-amber-400 flex items-center justify-center shrink-0">
                    <Check className="w-3.5 h-3.5 stroke-[3]" />
                  </div>
                  <span>Unlimited <strong>LR / Bilty Generation</strong> & Printing</span>
                </li>
                <li className="flex items-center gap-2.5">
                  <div className="w-5 h-5 rounded-full bg-amber-500/10 text-amber-400 flex items-center justify-center shrink-0">
                    <Check className="w-3.5 h-3.5 stroke-[3]" />
                  </div>
                  <span>Digital <strong>GST Invoicing & Payments Ledger</strong></span>
                </li>
                <li className="flex items-center gap-2.5">
                  <div className="w-5 h-5 rounded-full bg-amber-500/10 text-amber-400 flex items-center justify-center shrink-0">
                    <Check className="w-3.5 h-3.5 stroke-[3]" />
                  </div>
                  <span><strong>Multi-Branch Terminal Support</strong></span>
                </li>
                <li className="flex items-center gap-2.5">
                  <div className="w-5 h-5 rounded-full bg-amber-500/10 text-amber-400 flex items-center justify-center shrink-0">
                    <Check className="w-3.5 h-3.5 stroke-[3]" />
                  </div>
                  <span>Real-time Driver <strong>GPS Location Telemetry</strong></span>
                </li>
                <li className="flex items-center gap-2.5">
                  <div className="w-5 h-5 rounded-full bg-amber-500/10 text-amber-400 flex items-center justify-center shrink-0">
                    <Check className="w-3.5 h-3.5 stroke-[3]" />
                  </div>
                  <span>Freight Rate & Transit Time Estimator</span>
                </li>
              </ul>
            </div>
          </div>

          <div className="pt-8">
            <button
              onClick={() => handleSubscribe("Starter")}
              disabled={processingPlan !== null || (currentPlan === "Starter" && isSubscriptionActive)}
              className={`w-full py-3 px-4 rounded-xl font-bold text-xs sm:text-sm flex items-center justify-center gap-2 transition-all ${
                currentPlan === "Starter" && isSubscriptionActive
                  ? "bg-slate-800 text-slate-400 border border-slate-700 cursor-not-allowed"
                  : "bg-amber-500 hover:bg-amber-400 text-slate-950 shadow-lg shadow-amber-500/20 active:scale-[0.99]"
              }`}
            >
              {processingPlan === "Starter" ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  <span>Processing Razorpay Checkout...</span>
                </>
              ) : currentPlan === "Starter" && isSubscriptionActive ? (
                <>
                  <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                  <span>Active Plan</span>
                </>
              ) : (
                <>
                  <CreditCard className="w-4 h-4" />
                  <span>Subscribe Starter (₹999/mo)</span>
                </>
              )}
            </button>
          </div>
        </div>

        {/* Growth Plan */}
        <div className={`bg-gradient-to-b from-slate-900 to-slate-900/90 border ${currentPlan === "Growth" && isSubscriptionActive ? "border-amber-500 ring-2 ring-amber-500/30" : "border-amber-500/50 hover:border-amber-500"} rounded-2xl p-6 sm:p-8 flex flex-col justify-between transition-all relative shadow-2xl`}>
          <div className="absolute -top-3 right-6 bg-gradient-to-r from-amber-500 to-orange-500 text-slate-950 font-extrabold text-xs uppercase tracking-wider px-3.5 py-1 rounded-full shadow-lg flex items-center gap-1">
            <Sparkles className="w-3.5 h-3.5 fill-slate-950" />
            <span>Most Popular</span>
          </div>

          <div className="space-y-6">
            <div>
              <div className="flex items-center gap-2">
                <Sparkles className="w-6 h-6 text-amber-400" />
                <h3 className="text-xl font-bold text-white">Growth Plan</h3>
              </div>
              <p className="text-xs text-slate-400 mt-1">
                Designed for high-capacity interstate logistics operators requiring higher fleet limits & AI optimization.
              </p>
            </div>

            <div className="flex items-baseline gap-2">
              <span className="text-4xl font-extrabold text-white">₹1,999</span>
              <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">/ month</span>
            </div>

            <div className="border-t border-slate-800 pt-6 space-y-3.5">
              <div className="text-xs font-semibold text-amber-400 uppercase tracking-wider">Everything in Starter, plus:</div>
              <ul className="space-y-3 text-xs text-slate-300">
                <li className="flex items-center gap-2.5">
                  <div className="w-5 h-5 rounded-full bg-amber-500/20 text-amber-400 flex items-center justify-center shrink-0 border border-amber-500/30">
                    <Check className="w-3.5 h-3.5 stroke-[3]" />
                  </div>
                  <span>Up to <strong>30 Fleet Vehicles</strong></span>
                </li>
                <li className="flex items-center gap-2.5">
                  <div className="w-5 h-5 rounded-full bg-amber-500/20 text-amber-400 flex items-center justify-center shrink-0 border border-amber-500/30">
                    <Check className="w-3.5 h-3.5 stroke-[3]" />
                  </div>
                  <span><strong>AI Route & Load Advisor</strong> (Gemini 2.5)</span>
                </li>
                <li className="flex items-center gap-2.5">
                  <div className="w-5 h-5 rounded-full bg-amber-500/20 text-amber-400 flex items-center justify-center shrink-0 border border-amber-500/30">
                    <Check className="w-3.5 h-3.5 stroke-[3]" />
                  </div>
                  <span>Priority <strong>FASTag & Toll Tracking</strong></span>
                </li>
                <li className="flex items-center gap-2.5">
                  <div className="w-5 h-5 rounded-full bg-amber-500/20 text-amber-400 flex items-center justify-center shrink-0 border border-amber-500/30">
                    <Check className="w-3.5 h-3.5 stroke-[3]" />
                  </div>
                  <span>Custom GST Bilty Company Branding</span>
                </li>
                <li className="flex items-center gap-2.5">
                  <div className="w-5 h-5 rounded-full bg-amber-500/20 text-amber-400 flex items-center justify-center shrink-0 border border-amber-500/30">
                    <Check className="w-3.5 h-3.5 stroke-[3]" />
                  </div>
                  <span>Dedicated Support Manager</span>
                </li>
              </ul>
            </div>
          </div>

          <div className="pt-8">
            <button
              onClick={() => handleSubscribe("Growth")}
              disabled={processingPlan !== null || (currentPlan === "Growth" && isSubscriptionActive)}
              className={`w-full py-3 px-4 rounded-xl font-bold text-xs sm:text-sm flex items-center justify-center gap-2 transition-all ${
                currentPlan === "Growth" && isSubscriptionActive
                  ? "bg-slate-800 text-slate-400 border border-slate-700 cursor-not-allowed"
                  : "bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-400 hover:to-orange-400 text-slate-950 shadow-xl shadow-orange-500/20 active:scale-[0.99]"
              }`}
            >
              {processingPlan === "Growth" ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  <span>Processing Razorpay Checkout...</span>
                </>
              ) : currentPlan === "Growth" && isSubscriptionActive ? (
                <>
                  <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                  <span>Active Plan</span>
                </>
              ) : (
                <>
                  <Sparkles className="w-4 h-4 fill-slate-950" />
                  <span>Subscribe Growth (₹1,999/mo)</span>
                </>
              )}
            </button>
          </div>
        </div>

      </div>

      {/* Test Mode Simulation Modal (Ensures seamless payment completion in test environments) */}
      {testOrderModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-5">
            <div className="flex items-center justify-between border-b border-slate-800 pb-4">
              <div className="flex items-center gap-2">
                <CreditCard className="w-5 h-5 text-amber-400" />
                <h3 className="font-bold text-lg text-white">Razorpay Payment Simulation</h3>
              </div>
              <button
                onClick={() => setTestOrderModal(null)}
                className="text-slate-400 hover:text-white text-sm"
              >
                ✕
              </button>
            </div>

            <div className="bg-slate-800/80 border border-slate-700/80 rounded-xl p-4 text-xs space-y-2">
              <div className="flex justify-between text-slate-300">
                <span>Selected Plan:</span>
                <strong className="text-amber-400 font-bold">{testOrderModal.planId}</strong>
              </div>
              <div className="flex justify-between text-slate-300">
                <span>Amount:</span>
                <strong className="text-white">₹{testOrderModal.amount / 100}</strong>
              </div>
              <div className="flex justify-between text-slate-300">
                <span>Order ID:</span>
                <code className="text-amber-300 text-[11px]">{testOrderModal.orderId}</code>
              </div>
            </div>

            <p className="text-xs text-slate-400 leading-relaxed">
              In test mode, click <strong>"Complete Test Payment"</strong> to simulate a successful Razorpay webhook callback and activate your subscription server-side.
            </p>

            <div className="flex items-center gap-3 pt-2">
              <button
                onClick={() =>
                  handleVerifyPayment(
                    testOrderModal.orderId,
                    `pay_simulated_${Date.now()}`,
                    `sig_simulated_${Date.now()}`,
                    testOrderModal.planId
                  )
                }
                className="flex-1 py-2.5 px-4 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs flex items-center justify-center gap-2 shadow-lg"
              >
                <CheckCircle2 className="w-4 h-4" />
                <span>Complete Test Payment</span>
              </button>
              <button
                onClick={() => setTestOrderModal(null)}
                className="py-2.5 px-4 rounded-xl bg-slate-800 text-slate-300 text-xs hover:bg-slate-700"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
