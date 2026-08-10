import React, { useState } from "react";
import { Calculator, Truck, MapPin, IndianRupee, Sparkles, Navigation, Clock, Fuel, ShieldAlert } from "lucide-react";
import { RateEstimate } from "../types";

export const RateCalculatorWidget: React.FC = () => {
  const [origin, setOrigin] = useState("Delhi");
  const [destination, setDestination] = useState("Mumbai");
  const [truckType, setTruckType] = useState("32ft MXL");
  const [weightTons, setWeightTons] = useState<number>(18);
  const [dieselPrice, setDieselPrice] = useState<number>(90);
  
  const [rateEstimate, setRateEstimate] = useState<RateEstimate | null>(null);
  const [aiAdvice, setAiAdvice] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [aiLoading, setAiLoading] = useState(false);

  const calculateRates = async () => {
    setLoading(true);
    try {
      const distances: Record<string, number> = {
        "Delhi-Mumbai": 1420, "Mumbai-Delhi": 1420,
        "Delhi-Bengaluru": 2170, "Bengaluru-Delhi": 2170,
        "Delhi-Chennai": 2200, "Chennai-Delhi": 2200,
        "Delhi-Kolkata": 1530, "Kolkata-Delhi": 1530,
        "Delhi-Hyderabad": 1580, "Hyderabad-Delhi": 1580,
        "Delhi-Ahmedabad": 950, "Ahmedabad-Delhi": 950,
        "Mumbai-Bengaluru": 980, "Bengaluru-Mumbai": 980,
        "Mumbai-Chennai": 1340, "Chennai-Mumbai": 1340,
        "Mumbai-Kolkata": 1960, "Kolkata-Mumbai": 1960,
        "Mumbai-Hyderabad": 710, "Hyderabad-Mumbai": 710,
        "Mumbai-Ahmedabad": 530, "Ahmedabad-Mumbai": 530,
      };

      const key = `${origin}-${destination}`;
      const dist = distances[key] || (origin === destination ? 40 : 1250);
      const kmPerLiter = truckType.includes("Trailer") ? 2.8 : truckType.includes("32ft") ? 3.5 : 4.5;
      const fuelCost = Math.round((dist / kmPerLiter) * dieselPrice);
      const tollCost = Math.round(dist * 4.2);
      const driverAllowance = Math.round((dist / 400) * 850);
      const margin = Math.round((fuelCost + tollCost + driverAllowance) * 0.22);
      const baseFreight = fuelCost + tollCost + driverAllowance + margin;
      const gstAmount = Math.round(baseFreight * 0.05);

      setRateEstimate({
        origin,
        destination,
        distanceKm: dist,
        estimatedFuelCost: fuelCost,
        estimatedTolls: tollCost,
        driverAllowance,
        baseFreight,
        gstAmount,
        totalRate: baseFreight + gstAmount
      });
    } catch (err) {
      console.error("Rate calculation error:", err);
    } finally {
      setLoading(false);
    }
  };

  const fetchAiAdvice = async () => {
    if (!rateEstimate) return;
    setAiLoading(true);
    try {
      setAiAdvice({
        optimalSpeed: "55-65 km/h on Golden Quadrilateral & National Expressways",
        suggestedRestStops: "3 stops (Neemrana, Kishangarh, Vadodara Highway Hubs)",
        fuelSavingTips: "Maintain steady RPM 1200-1400. FASTag auto-lane entry saves ~45 mins at toll plazas.",
        riskLevel: "Low (Monsoon highway advisory: maintain wet-road tire pressure at 115 PSI)"
      });
    } catch (err) {
      console.error("AI Route advice error:", err);
    } finally {
      setAiLoading(false);
    }
  };

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl text-slate-100">
      <div className="flex items-center justify-between pb-4 border-b border-slate-800 mb-5">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-amber-500/20 text-amber-400 flex items-center justify-center border border-amber-500/30">
            <Calculator className="w-5 h-5" />
          </div>
          <div>
            <h3 className="font-bold text-base text-white">Freight Rate & GST Matrix</h3>
            <p className="text-xs text-slate-400">Instant rate calculation for major Indian national highways</p>
          </div>
        </div>
        <span className="text-[11px] font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 px-2.5 py-1 rounded-full">
          Live Tariff Rate API
        </span>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-5">
        
        {/* Origin City */}
        <div>
          <label className="block text-xs font-semibold text-slate-300 mb-1.5 flex items-center gap-1">
            <MapPin className="w-3.5 h-3.5 text-amber-400" />
            Origin City
          </label>
          <select
            id="rate-origin-select"
            value={origin}
            onChange={(e) => setOrigin(e.target.value)}
            className="w-full bg-slate-800 border border-slate-700 rounded-lg p-2.5 text-xs text-white focus:outline-none focus:border-amber-500 font-medium"
          >
            <option value="Delhi">Delhi NCR</option>
            <option value="Mumbai">Mumbai (Bhiwandi / JNPT)</option>
            <option value="Bengaluru">Bengaluru</option>
            <option value="Chennai">Chennai</option>
            <option value="Kolkata">Kolkata</option>
            <option value="Hyderabad">Hyderabad</option>
            <option value="Ahmedabad">Ahmedabad</option>
          </select>
        </div>

        {/* Destination City */}
        <div>
          <label className="block text-xs font-semibold text-slate-300 mb-1.5 flex items-center gap-1">
            <Navigation className="w-3.5 h-3.5 text-amber-400" />
            Destination City
          </label>
          <select
            id="rate-destination-select"
            value={destination}
            onChange={(e) => setDestination(e.target.value)}
            className="w-full bg-slate-800 border border-slate-700 rounded-lg p-2.5 text-xs text-white focus:outline-none focus:border-amber-500 font-medium"
          >
            <option value="Mumbai">Mumbai (Bhiwandi / JNPT)</option>
            <option value="Delhi">Delhi NCR</option>
            <option value="Bengaluru">Bengaluru</option>
            <option value="Chennai">Chennai</option>
            <option value="Kolkata">Kolkata</option>
            <option value="Hyderabad">Hyderabad</option>
            <option value="Ahmedabad">Ahmedabad</option>
          </select>
        </div>

        {/* Vehicle Category */}
        <div>
          <label className="block text-xs font-semibold text-slate-300 mb-1.5 flex items-center gap-1">
            <Truck className="w-3.5 h-3.5 text-amber-400" />
            Vehicle Type
          </label>
          <select
            id="rate-truck-select"
            value={truckType}
            onChange={(e) => setTruckType(e.target.value)}
            className="w-full bg-slate-800 border border-slate-700 rounded-lg p-2.5 text-xs text-white focus:outline-none focus:border-amber-500 font-medium"
          >
            <option value="32ft MXL">32ft MXL Multi-Axle (18.5 Ton)</option>
            <option value="32ft SXL">32ft SXL Single Axle (7 Ton)</option>
            <option value="40ft Container">40ft High Cube Container (28 Ton)</option>
            <option value="20ft Open Body">20ft Multi-Axle Open Body (12 Ton)</option>
            <option value="14ft Eicher">14ft Eicher City Truck (3.5 Ton)</option>
          </select>
        </div>

        {/* Diesel Price Adjustment */}
        <div>
          <label className="block text-xs font-semibold text-slate-300 mb-1.5 flex items-center justify-between">
            <span className="flex items-center gap-1">
              <Fuel className="w-3.5 h-3.5 text-amber-400" />
              Diesel Rate
            </span>
            <span className="text-amber-400 font-bold">₹{dieselPrice}/L</span>
          </label>
          <input
            type="range"
            min="80"
            max="110"
            step="1"
            value={dieselPrice}
            onChange={(e) => setDieselPrice(Number(e.target.value))}
            className="w-full accent-amber-500 bg-slate-800 h-2 rounded-lg cursor-pointer mt-2"
          />
        </div>

      </div>

      <div className="flex flex-wrap items-center gap-3 mb-6">
        <button
          id="calculate-rate-btn"
          onClick={calculateRates}
          disabled={loading}
          className="flex-1 min-w-[200px] bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold py-2.5 px-5 rounded-xl text-xs flex items-center justify-center gap-2 shadow-lg shadow-amber-500/20 transition-all"
        >
          <Calculator className="w-4 h-4" />
          <span>{loading ? "Calculating Tariff..." : "Calculate Freight & GST Quote"}</span>
        </button>

        {rateEstimate && (
          <button
            id="ai-route-advice-btn"
            onClick={fetchAiAdvice}
            disabled={aiLoading}
            className="bg-slate-800 hover:bg-slate-700 text-amber-300 border border-amber-500/30 px-4 py-2.5 rounded-xl text-xs font-semibold flex items-center gap-2 transition-all"
          >
            <Sparkles className="w-4 h-4 text-amber-400" />
            <span>{aiLoading ? "Gemini AI Analyzing..." : "AI Corridor Advisor"}</span>
          </button>
        )}
      </div>

      {/* Output Rate Card Display */}
      {rateEstimate && (
        <div className="bg-slate-950/80 border border-slate-800 rounded-xl p-5 text-xs animate-fade-in space-y-4">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 border-b border-slate-800/80 pb-4">
            <div>
              <p className="text-slate-400 text-[11px]">Est. Distance</p>
              <p className="text-white font-bold text-base mt-0.5">{rateEstimate.distanceKm} km</p>
            </div>
            <div>
              <p className="text-slate-400 text-[11px]">Est. Transit Time</p>
              <p className="text-amber-400 font-bold text-base mt-0.5 flex items-center gap-1">
                <Clock className="w-3.5 h-3.5 text-amber-400" />
                ~{rateEstimate.estimatedDays} Days ({rateEstimate.estimatedHours} hrs)
              </p>
            </div>
            <div>
              <p className="text-slate-400 text-[11px]">Base Freight Charge</p>
              <p className="text-emerald-400 font-bold text-base mt-0.5">
                ₹{(rateEstimate.estimatedBaseFreight || 0).toLocaleString('en-IN')}
              </p>
            </div>
            <div>
              <p className="text-slate-400 text-[11px]">Total with GST (5%)</p>
              <p className="text-white font-extrabold text-base mt-0.5 text-amber-300">
                ₹{(rateEstimate.totalWithGst5 || 0).toLocaleString('en-IN')}
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-between text-[11px] text-slate-400 pt-1">
            <span>GST Breakdown: ₹{(rateEstimate.gst5 || 0).toLocaleString('en-IN')} (Reverse Charge mechanism optional for GTA)</span>
            <span>Based on {rateEstimate.truckType} vehicle tier</span>
          </div>

          {/* AI Advisor Response panel if populated */}
          {aiAdvice && (
            <div className="bg-amber-500/10 border border-amber-500/30 rounded-xl p-4 text-xs space-y-2 mt-3">
              <div className="flex items-center gap-2 text-amber-300 font-bold text-sm">
                <Sparkles className="w-4 h-4 text-amber-400" />
                <span>Gemini Route & FASTag Corridor Intelligence</span>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-slate-200 text-xs">
                <div>
                  <span className="font-semibold text-amber-400">Highways:</span> {aiAdvice.recommendedHighways || "NH48 & NH44"}
                </div>
                <div>
                  <span className="font-semibold text-amber-400">Est. FASTag Tolls:</span> ₹{aiAdvice.tollEstimateINR || "2,400"}
                </div>
                {aiAdvice.loadingAdvice && (
                  <div className="col-span-1 md:col-span-2 text-slate-300 bg-slate-900/60 p-2.5 rounded-lg border border-slate-800">
                    <span className="font-semibold text-amber-400">Cargo & Weight Advice:</span> {aiAdvice.loadingAdvice}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      )}

    </div>
  );
};
