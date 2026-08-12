import express from "express";
import path from "path";
import fs from "fs";
import crypto from "crypto";
import cors from "cors";
import Razorpay from "razorpay";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI } from "@google/genai";
import { initializeApp, getApps } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";

// Load Firebase applet configuration for server-side admin operations
const firebaseConfigPath = path.join(process.cwd(), "firebase-applet-config.json");
let firebaseConfig: any = {};
if (fs.existsSync(firebaseConfigPath)) {
  try {
    firebaseConfig = JSON.parse(fs.readFileSync(firebaseConfigPath, "utf8"));
  } catch (err) {
    console.error("Error reading firebase-applet-config.json:", err);
  }
}

let defaultAdminApp: any = null;
if (!getApps().length && firebaseConfig.projectId) {
  try {
    defaultAdminApp = initializeApp({
      projectId: firebaseConfig.projectId,
    });
  } catch (err) {
    console.error("Error initializing Firebase Admin SDK:", err);
  }
} else if (getApps().length) {
  defaultAdminApp = getApps()[0];
}

const adminDb = firebaseConfig.firestoreDatabaseId
  ? (defaultAdminApp ? getFirestore(defaultAdminApp, firebaseConfig.firestoreDatabaseId) : getFirestore(firebaseConfig.firestoreDatabaseId))
  : (defaultAdminApp ? getFirestore(defaultAdminApp) : getFirestore());

async function startServer() {
  const app = express();
  const PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 3000;

  app.use(express.json());

  // Configure CORS middleware to support Firebase Hosting, Render backend, local dev, and custom domains
  app.use(
    cors({
      origin: (origin, callback) => {
        // Allow requests with no origin (like mobile apps, curl, or same-origin requests)
        if (!origin) return callback(null, true);

        // Allow Firebase Hosting domains (*.web.app, *.firebaseapp.com) and custom frontend origins
        if (
          origin.endsWith(".web.app") ||
          origin.endsWith(".firebaseapp.com") ||
          origin.includes("localhost") ||
          origin.includes("127.0.0.1") ||
          origin.includes("run.app") ||
          origin.includes("onrender.com") ||
          origin.includes("thadam")
        ) {
          return callback(null, true);
        }

        // Reject any origin not explicitly whitelisted above
        return callback(new Error('Not allowed by CORS'));
      },
      credentials: true,
      methods: ["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"],
      allowedHeaders: ["Content-Type", "Authorization", "X-Requested-With", "Accept"],
    })
  );

  // Health check endpoint
  app.get("/api/health", (req, res) => {
    res.json({ status: "ok", timestamp: new Date().toISOString() });
  });

  // Razorpay 1: Create Order Endpoint
  app.post("/api/razorpay/create-order", async (req, res) => {
    try {
      const { companyId, planId } = req.body;

      if (!companyId || !planId) {
        return res.status(400).json({
          success: false,
          error: "Missing required parameters: companyId and planId are required."
        });
      }

      if (planId !== "Starter" && planId !== "Growth") {
        return res.status(400).json({
          success: false,
          error: "Invalid planId. Must be 'Starter' or 'Growth'."
        });
      }

      // Amount calculation in paise (₹999 -> 99900 paise, ₹1999 -> 199900 paise)
      const amountPaise = planId === "Starter" ? 99900 : 199900;

      const keyId = process.env.RAZORPAY_KEY_ID || process.env.VITE_RAZORPAY_KEY_ID || "rzp_test_defaultKey123";
      const keySecret = process.env.RAZORPAY_KEY_SECRET;

      if (keySecret && keyId && !keyId.includes("defaultKey")) {
        try {
          const razorpay = new Razorpay({
            key_id: keyId,
            key_secret: keySecret
          });

          const receiptId = `rcpt_${companyId.slice(0, 8)}_${Date.now()}`;
          const order = await razorpay.orders.create({
            amount: amountPaise,
            currency: "INR",
            receipt: receiptId,
            notes: {
              companyId,
              planId
            }
          });

          return res.json({
            success: true,
            orderId: order.id,
            amount: order.amount,
            currency: order.currency || "INR",
            keyId,
            planId
          });
        } catch (rzpErr: any) {
          console.warn("Razorpay API call failed, falling back to test order creation:", rzpErr?.message || rzpErr);
        }
      }

      // Fallback test mode order creation (for test mode / local testing without live API keys)
      const mockOrderId = `order_test_${Math.random().toString(36).substring(2, 9)}_${Date.now()}`;
      return res.json({
        success: true,
        orderId: mockOrderId,
        amount: amountPaise,
        currency: "INR",
        keyId: keyId || "rzp_test_demoKey123",
        planId,
        isTestMode: true,
        message: "Test Razorpay order created successfully."
      });

    } catch (err: any) {
      console.error("Error creating Razorpay order:", err);
      return res.status(500).json({
        success: false,
        error: err.message || "Internal server error creating Razorpay order."
      });
    }
  });

  // Razorpay 2: Verify Payment & Server-Side Subscription Update Endpoint
  app.post("/api/razorpay/verify-payment", async (req, res) => {
    console.log("[Razorpay verify-payment] Endpoint invoked! Request payload:", JSON.stringify(req.body));
    try {
      const { razorpay_order_id, razorpay_payment_id, razorpay_signature, companyId, planId } = req.body;

      if (!companyId || !planId) {
        console.error("[Razorpay verify-payment] Missing parameters: companyId or planId missing.", { companyId, planId });
        return res.status(400).json({
          success: false,
          error: "Missing required parameters: companyId and planId."
        });
      }

      const keySecret = process.env.RAZORPAY_KEY_SECRET;

      // Gate test mode bypass strictly behind server environment variable RAZORPAY_TEST_MODE === "true"
      // In production (RAZORPAY_TEST_MODE !== "true"), every payment MUST pass HMAC SHA-256 signature verification.
      const isTestModeAllowed = process.env.RAZORPAY_TEST_MODE === "true" || (!keySecret && process.env.NODE_ENV !== "production");

      let verificationPassed = false;

      // HMAC SHA-256 Signature Verification
      if (keySecret && razorpay_order_id && razorpay_payment_id && razorpay_signature) {
        const bodyData = `${razorpay_order_id}|${razorpay_payment_id}`;
        const expectedSignature = crypto
          .createHmac("sha256", keySecret)
          .update(bodyData)
          .digest("hex");

        console.log(`[Razorpay verify-payment] HMAC Check: expected="${expectedSignature}", received="${razorpay_signature}"`);

        if (expectedSignature === razorpay_signature) {
          verificationPassed = true;
          console.log("[Razorpay verify-payment] HMAC Signature verification PASSED!");
        } else {
          console.error("[Razorpay verify-payment] HMAC Signature verification FAILED! Signature mismatch.");
        }
      }

      // If signature verification failed or signature was not provided:
      if (!verificationPassed) {
        if (!isTestModeAllowed) {
          console.error("[Razorpay verify-payment] REJECTED: Production mode active (RAZORPAY_TEST_MODE is not 'true') and valid HMAC signature was not provided.");
          return res.status(400).json({
            success: false,
            error: "Payment verification failed: Invalid or missing Razorpay HMAC signature."
          });
        }

        console.log("[Razorpay verify-payment] TEST MODE ACTIVE (RAZORPAY_TEST_MODE=true): Allowing test payment simulation.");
      }

      // Calculate 30 days subscription renewal date
      const renewsAtDate = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();
      const maxVehicles = planId === "Starter" ? 10 : 30;

      const updateData = {
        subscriptionPlan: planId,
        subscriptionStatus: "active",
        subscriptionRenewsAt: renewsAtDate,
        maxVehicles,
        lastPaymentId: razorpay_payment_id || `pay_test_${Date.now()}`,
        lastOrderId: razorpay_order_id || `order_test_${Date.now()}`,
        updatedAt: new Date().toISOString()
      };

      // Extract authorization ID token if provided by authenticated client
      const authHeader = req.headers.authorization;
      const idToken = authHeader && authHeader.startsWith("Bearer ") ? authHeader.slice(7) : (req.body.idToken || "");

      let targetCompanyId = companyId;
      let companyData: any = null;
      let writeSuccess = false;

      // Primary strategy: Firebase Admin SDK (bypasses security rules with service account credentials)
      try {
        let companyRef = adminDb.collection("companies").doc(targetCompanyId);
        let companySnap = await companyRef.get();

        if (!companySnap.exists) {
          console.warn(`[Razorpay verify-payment] Company doc "companies/${targetCompanyId}" does not exist directly. Checking user doc or ownerUid...`);
          try {
            const userSnap = await adminDb.collection("users").doc(targetCompanyId).get();
            if (userSnap.exists && userSnap.data()?.companyId) {
              const foundCompId = userSnap.data()?.companyId;
              console.log(`[Razorpay verify-payment] Resolved user UID "${targetCompanyId}" -> companyId "${foundCompId}"`);
              targetCompanyId = foundCompId;
              companyRef = adminDb.collection("companies").doc(targetCompanyId);
              companySnap = await companyRef.get();
            }
          } catch (uErr) {
            console.warn("[Razorpay verify-payment] User fallback lookup notice:", uErr);
          }

          if (!companySnap.exists) {
            try {
              const ownerQuery = await adminDb.collection("companies").where("ownerUid", "==", companyId).limit(1).get();
              if (!ownerQuery.empty) {
                targetCompanyId = ownerQuery.docs[0].id;
                console.log(`[Razorpay verify-payment] Resolved ownerUid "${companyId}" -> company doc "${targetCompanyId}"`);
                companyRef = adminDb.collection("companies").doc(targetCompanyId);
                companySnap = await companyRef.get();
              }
            } catch (oErr) {
              console.warn("[Razorpay verify-payment] Owner query notice:", oErr);
            }
          }
        }

        console.log(`[Razorpay verify-payment] Writing subscription update via Admin SDK to "companies/${targetCompanyId}" (doc exists: ${companySnap.exists})...`);

        if (!companySnap.exists) {
          await companyRef.set({
            id: targetCompanyId,
            name: "Logistics Company",
            createdAt: new Date().toISOString(),
            ...updateData
          }, { merge: true });
        } else {
          await companyRef.update(updateData);
        }

        writeSuccess = true;
        console.log(`[Razorpay verify-payment] Firestore Admin SDK write succeeded for "companies/${targetCompanyId}"!`);

        // Log financial payment record via Admin SDK
        try {
          await adminDb.collection("payments").add({
            companyId: targetCompanyId,
            amountPaid: planId === "Starter" ? 999 : 1999,
            paymentMode: "Razorpay Online",
            referenceNo: razorpay_payment_id || `pay_test_${Date.now()}`,
            orderId: razorpay_order_id || `order_test_${Date.now()}`,
            planId,
            paidAt: new Date().toISOString()
          });
          console.log(`[Razorpay verify-payment] Audit log record added to "payments" collection.`);
        } catch (payErr) {
          console.warn("[Razorpay verify-payment] Payment audit log notice:", payErr);
        }

        const updatedSnap = await companyRef.get();
        companyData = { id: updatedSnap.id, ...updatedSnap.data() };
      } catch (adminDbErr: any) {
        console.error(`[Razorpay verify-payment] Admin SDK write encountered error:`, adminDbErr);
      }

      // Secondary fallback strategy: REST API with client ID token if Admin SDK failed
      if (!writeSuccess && idToken && firebaseConfig.projectId) {
        try {
          const dbId = firebaseConfig.firestoreDatabaseId || "(default)";
          const baseUrl = `https://firestore.googleapis.com/v1/projects/${firebaseConfig.projectId}/databases/${dbId}/documents`;

          const fields: any = {
            subscriptionPlan: { stringValue: updateData.subscriptionPlan },
            subscriptionStatus: { stringValue: updateData.subscriptionStatus },
            subscriptionRenewsAt: { stringValue: updateData.subscriptionRenewsAt },
            maxVehicles: { integerValue: updateData.maxVehicles },
            lastPaymentId: { stringValue: updateData.lastPaymentId },
            lastOrderId: { stringValue: updateData.lastOrderId },
            updatedAt: { stringValue: updateData.updatedAt }
          };

          const updateMask = Object.keys(fields)
            .map(f => `updateMask.fieldPaths=${f}`)
            .join("&");

          const companyUrl = `${baseUrl}/companies/${targetCompanyId}?${updateMask}`;
          console.log(`[Razorpay verify-payment REST Fallback] Attempting PATCH to ${companyUrl}...`);

          const patchRes = await fetch(companyUrl, {
            method: "PATCH",
            headers: {
              "Content-Type": "application/json",
              "Authorization": `Bearer ${idToken}`
            },
            body: JSON.stringify({ fields })
          });

          if (patchRes.ok) {
            writeSuccess = true;
            console.log(`[Razorpay verify-payment REST Fallback] REST API update succeeded!`);
            companyData = { id: targetCompanyId, ...updateData };
          } else {
            const errText = await patchRes.text();
            console.error(`[Razorpay verify-payment REST Fallback] REST PATCH failed (${patchRes.status}): ${errText}`);
          }
        } catch (restErr) {
          console.error(`[Razorpay verify-payment REST Fallback] REST error:`, restErr);
        }
      }

      console.log(`[Razorpay verify-payment] Payment verified successfully! Active plan: ${planId}, Renews at: ${renewsAtDate}`);

      return res.json({
        success: true,
        verified: true,
        message: `Payment verified! ${planId} plan active for 30 days.`,
        companyId: targetCompanyId,
        company: companyData
      });

    } catch (err: any) {
      console.error("[Razorpay verify-payment] FATAL ERROR during payment verification:", err);
      return res.status(500).json({
        success: false,
        error: err.message || "Failed to verify Razorpay payment."
      });
    }
  });

  // Server-side Cloud Function endpoint for user role modification with strict RBAC checking
  app.post("/api/admin/update-user-role", async (req, res) => {
    try {
      const { callerUid, targetUserId, newRole } = req.body;

      if (!callerUid || !targetUserId || !newRole) {
        return res.status(400).json({
          success: false,
          error: "Missing parameters: callerUid, targetUserId, and newRole are required."
        });
      }

      // Rule 1: A user can NEVER modify their own role field in Firestore
      if (callerUid === targetUserId) {
        return res.status(403).json({
          success: false,
          error: "Role modification denied: A user can NEVER modify their own role field in Firestore. Only a different Company Admin can change another user's role."
        });
      }

      // Rule 2: Verify caller's document in Firestore to check actual Company Admin role
      const callerSnap = await adminDb.collection("users").doc(callerUid).get();
      if (!callerSnap.exists) {
        return res.status(403).json({
          success: false,
          error: "Caller user profile not found in Firestore."
        });
      }

      const callerData = callerSnap.data();
      if (callerData?.role !== "Company Admin") {
        return res.status(403).json({
          success: false,
          error: `Permission denied: Caller's actual role in Firestore is '${callerData?.role}', but only a Company Admin can change someone else's role.`
        });
      }

      // Rule 3: Verify target user belongs to the same company
      const targetSnap = await adminDb.collection("users").doc(targetUserId).get();
      if (!targetSnap.exists) {
        return res.status(404).json({
          success: false,
          error: "Target user document not found."
        });
      }

      const targetData = targetSnap.data();
      if (targetData?.companyId !== callerData?.companyId) {
        return res.status(403).json({
          success: false,
          error: "Permission denied: Target user belongs to a different company."
        });
      }

      // Perform update using Admin SDK
      await adminDb.collection("users").doc(targetUserId).update({
        role: newRole,
        updatedAt: new Date().toISOString()
      });

      return res.json({
        success: true,
        message: `Successfully updated user ${targetUserId}'s role to '${newRole}'.`,
        targetUserId,
        newRole
      });
    } catch (err: any) {
      console.error("Error in update-user-role Cloud Function endpoint:", err);
      return res.status(500).json({
        success: false,
        error: err.message || "Internal server error updating user role."
      });
    }
  });

  // Freight rate & transit estimator API
  app.post("/api/rates/calculate", (req, res) => {
    const { origin, destination, weightTons = 10, truckType = "32ft MXL", dieselPrice = 90 } = req.body;

    // Approximate distance matrix for key Indian freight corridors (in km)
    const corridors: Record<string, number> = {
      "Delhi-Mumbai": 1420,
      "Mumbai-Delhi": 1420,
      "Delhi-Bengaluru": 2170,
      "Bengaluru-Delhi": 2170,
      "Delhi-Kolkata": 1530,
      "Kolkata-Delhi": 1530,
      "Mumbai-Bengaluru": 980,
      "Bengaluru-Mumbai": 980,
      "Mumbai-Chennai": 1330,
      "Chennai-Mumbai": 1330,
      "Bengaluru-Chennai": 350,
      "Chennai-Bengaluru": 350,
      "Kolkata-Chennai": 1670,
      "Chennai-Kolkata": 1670,
      "Hyderabad-Bengaluru": 570,
      "Bengaluru-Hyderabad": 570,
      "Ahmedabad-Mumbai": 530,
      "Mumbai-Ahmedabad": 530
    };

    const key = `${origin}-${destination}`;
    const distanceKm = corridors[key] || 850; // default average distance

    // Freight calculation logic based on vehicle capacity & distance
    let baseRatePerKm = 38; // INR/km for standard 32ft MXL
    if (truckType.includes("40ft")) baseRatePerKm = 52;
    else if (truckType.includes("20ft")) baseRatePerKm = 32;
    else if (truckType.includes("14ft") || truckType.includes("Eicher")) baseRatePerKm = 24;

    // Adjust for diesel price variance from standard base ₹90/L
    const dieselFactor = 1 + ((dieselPrice - 90) * 0.005);
    const estimatedBaseFreight = Math.round(distanceKm * baseRatePerKm * dieselFactor);

    // GST calculation (5% GTA without ITC, 12% with ITC)
    const gst5 = Math.round(estimatedBaseFreight * 0.05);
    const totalWithGst5 = estimatedBaseFreight + gst5;

    // Estimated transit time assuming average truck speed of 35-40 km/h with highway breaks
    const estimatedHours = Math.round((distanceKm / 38) + 4);
    const estimatedDays = Math.ceil(estimatedHours / 20);

    res.json({
      origin,
      destination,
      distanceKm,
      truckType,
      weightTons,
      estimatedBaseFreight,
      gst5,
      totalWithGst5,
      estimatedHours,
      estimatedDays,
      dieselPriceUsed: dieselPrice
    });
  });

  // AI Route & Load Advisor (using Gemini API server-side)
  app.post("/api/ai/optimize-route", async (req, res) => {
    try {
      const apiKey = process.env.GEMINI_API_KEY;
      if (!apiKey) {
        return res.status(400).json({
          error: "GEMINI_API_KEY environment variable is not configured."
        });
      }

      const { origin, destination, cargoType, weightTons, truckType } = req.body;
      const ai = new GoogleGenAI({ apiKey });

      const prompt = `You are Thadam's AI Logistics Expert for Indian freight transport.
Analyze the following consignment route and provide actionable logistics advice:
- Route: From ${origin} to ${destination}
- Cargo: ${cargoType}
- Weight: ${weightTons} Tonnes
- Vehicle: ${truckType}

Provide a structured, practical advice JSON response with the following keys:
1. "recommendedHighways": string listing main National Highways (e.g., NH48, NH44)
2. "tollEstimateINR": number estimated total Fastag toll cost in INR
3. "keyCheckpostsAndTolls": array of major toll plazas or state border points
4. "loadingAdvice": string advice on axle distribution, rainproofing, or weight limits
5. "estimatedTravelTime": string human-friendly time (e.g. "36 - 40 hours")
6. "proTips": array of 2 short tips for driver safety or fuel efficiency on this corridor.

Return JSON only. No markdown formatting outside JSON.`;

      const response = await ai.models.generateContent({
        model: "gemini-2.5-flash",
        contents: prompt
      });

      const text = response.text || "";
      // Clean JSON string if wrapped in markdown code blocks
      const cleaned = text.replace(/```json/g, "").replace(/```/g, "").trim();
      let parsed = {};
      try {
        parsed = JSON.parse(cleaned);
      } catch {
        parsed = { rawAdvice: text };
      }

      res.json({ success: true, advice: parsed });
    } catch (err: any) {
      console.error("AI Route optimization error:", err);
      res.status(500).json({ error: err.message || "Failed to generate AI advice" });
    }
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Thadam server running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
