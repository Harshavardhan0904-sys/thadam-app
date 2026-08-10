import React, { createContext, useContext, useEffect, useState, useRef } from "react";
import {
  User as FirebaseUser,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
  updateProfile
} from "firebase/auth";
import { doc, getDoc, setDoc, collection, runTransaction, query, where, getDocs, updateDoc } from "firebase/firestore";
import { auth, db } from "../lib/firebase";
import { FreightUser, FreightCompany } from "../types";

interface SignUpData {
  email: string;
  password: string;
  fullName: string;
  companyName: string;
  city?: string;
  gstin?: string;
  fleetCount?: number;
}

interface AuthContextType {
  currentUser: FirebaseUser | null;
  userProfile: FreightUser | null;
  companyProfile: FreightCompany | null;
  loading: boolean;
  signUp: (data: SignUpData) => Promise<void>;
  signIn: (email: string, password: string) => Promise<void>;
  signInDemo: () => Promise<void>;
  signInDemoDriver: () => Promise<void>;
  logout: () => Promise<void>;
  refreshCompanyProfile: () => Promise<void>;
  error: string | null;
  clearError: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [currentUser, setCurrentUser] = useState<FirebaseUser | null>(null);
  const [userProfile, setUserProfile] = useState<FreightUser | null>(null);
  const [companyProfile, setCompanyProfile] = useState<FreightCompany | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const isSigningUpRef = useRef<boolean>(false);

  const clearError = () => setError(null);

  const fetchUserData = async (uid: string, fallbackUser?: FirebaseUser) => {
    if (isSigningUpRef.current) {
      // Skip fetchUserData while signUp is in progress to prevent race condition
      return;
    }
    try {
      const userDocRef = doc(db, "users", uid);
      const userDocSnap = await getDoc(userDocRef);

      if (userDocSnap.exists()) {
        let uData = userDocSnap.data() as FreightUser;

        // Auto-heal driverRecordId on user document if user is Driver and driverRecordId is missing
        if (uData.role === "Driver" && !uData.driverRecordId) {
          try {
            const driversRef = collection(db, "drivers");
            const q = query(driversRef, where("authUid", "==", uid));
            const dSnap = await getDocs(q);
            if (!dSnap.empty) {
              const matchedDriverId = dSnap.docs[0].id;
              uData = { ...uData, driverRecordId: matchedDriverId };
              await updateDoc(userDocRef, { driverRecordId: matchedDriverId });
              console.log("Auto-healed driverRecordId on users doc:", matchedDriverId);
            }
          } catch (healErr) {
            console.warn("Could not auto-heal driverRecordId on users doc:", healErr);
          }
        }

        setUserProfile(uData);

        if (uData.companyId) {
          const compRef = doc(db, "companies", uData.companyId);
          const compSnap = await getDoc(compRef);
          if (compSnap.exists()) {
            setCompanyProfile({
              id: compSnap.id,
              ...compSnap.data()
            } as FreightCompany);
          }
        }
      } else if (fallbackUser && !isSigningUpRef.current) {
        // Auto-provision default company, branch & user doc atomically if missing
        const compRef = doc(collection(db, "companies"));
        const branchRef = doc(collection(db, "branches"));
        const compData = {
          name: "VRL Freight Express Ltd.",
          ownerUid: uid,
          city: "Mumbai",
          state: "Maharashtra",
          gstin: "27AABCV1234F1Z1",
          fleetCount: 18,
          createdAt: new Date().toISOString()
        };

        const branchData = {
          companyId: compRef.id,
          branchName: "Mumbai Head Office Hub",
          city: "Mumbai",
          state: "Maharashtra",
          address: "Central Logistics Park, Andheri East, Mumbai",
          isHeadOffice: true,
          createdAt: new Date().toISOString()
        };

        const newProfile: FreightUser = {
          uid: uid,
          email: fallbackUser.email || "transporter@thadam.in",
          displayName: fallbackUser.displayName || "Ramesh Sharma",
          companyId: compRef.id,
          companyName: "VRL Freight Express Ltd.",
          role: "Company Admin",
          phone: "+91 98765 43210",
          branchId: branchRef.id,
          createdAt: new Date().toISOString()
        };

        await runTransaction(db, async (transaction) => {
          transaction.set(compRef, compData);
          transaction.set(branchRef, branchData);
          transaction.set(doc(db, "users", uid), newProfile);
        });

        setUserProfile(newProfile);
        setCompanyProfile({
          id: compRef.id,
          ...compData
        });
      }
    } catch (err: any) {
      if (!isSigningUpRef.current) {
        console.error("Error fetching user or company profile:", err);
      }
    }
  };

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      setCurrentUser(user);
      if (user) {
        await fetchUserData(user.uid, user);
      } else {
        setUserProfile(null);
        setCompanyProfile(null);
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const signUp = async (data: SignUpData) => {
    setError(null);
    setLoading(true);
    isSigningUpRef.current = true;
    try {
      // 1. Create Firebase Auth user
      const userCredential = await createUserWithEmailAndPassword(auth, data.email, data.password);
      const user = userCredential.user;

      // 2. Set Firebase Auth Display Name
      if (data.fullName) {
        await updateProfile(user, { displayName: data.fullName });
      }

      // 3. Prepare company, branch & user document references and data
      const companyRef = doc(collection(db, "companies"));
      const branchRef = doc(collection(db, "branches"));
      const companyData = {
        name: data.companyName,
        ownerUid: user.uid,
        city: data.city || "Mumbai",
        state: "Maharashtra",
        gstin: data.gstin || "",
        fleetCount: data.fleetCount || 5,
        createdAt: new Date().toISOString()
      };

      const headOfficeCity = data.city || "Mumbai";
      const branchData = {
        companyId: companyRef.id,
        branchName: `${headOfficeCity} Head Office Hub`,
        city: headOfficeCity,
        state: "Maharashtra",
        address: `Headquarters Logistics Hub, ${headOfficeCity}`,
        isHeadOffice: true,
        createdAt: new Date().toISOString()
      };

      const userDocRef = doc(db, "users", user.uid);
      const userDocData: FreightUser = {
        uid: user.uid,
        email: data.email.toLowerCase(),
        displayName: data.fullName || "Transporter Admin",
        companyId: companyRef.id,
        companyName: data.companyName,
        role: "Company Admin",
        phone: "+91 98765 00000",
        branchId: branchRef.id,
        createdAt: new Date().toISOString()
      };

      // 4. Wrap company, branch, and user profile creation writes in a single Firestore transaction
      await runTransaction(db, async (transaction) => {
        transaction.set(companyRef, companyData);
        transaction.set(branchRef, branchData);
        transaction.set(userDocRef, userDocData);
      });

      setUserProfile(userDocData);
      setCompanyProfile({
        id: companyRef.id,
        ...companyData
      });
      setError(null);
    } catch (err: any) {
      console.error("Sign up error:", err);
      if (err.code === "auth/email-already-in-use") {
        setError("This email address is already registered. Please login instead.");
      } else if (err.code === "auth/weak-password") {
        setError("Password should be at least 6 characters long.");
      } else {
        setError(err.message || "Sign up failed. Please try again.");
      }
      throw err;
    } finally {
      isSigningUpRef.current = false;
      setLoading(false);
    }
  };

  const signIn = async (email: string, password: string) => {
    setError(null);
    setLoading(true);
    try {
      const userCredential = await signInWithEmailAndPassword(auth, email, password);
      await fetchUserData(userCredential.user.uid, userCredential.user);
      setError(null);
    } catch (err: any) {
      console.error("Sign in error:", err);
      if (err.code === "auth/invalid-credential" || err.code === "auth/user-not-found" || err.code === "auth/wrong-password") {
        setError("Invalid email or password. Please check your credentials or click Quick Demo Login.");
      } else {
        setError(err.message || "Failed to sign in. Please try again.");
      }
      throw err;
    } finally {
      setLoading(false);
    }
  };

  const signInDemo = async () => {
    setError(null);
    setLoading(true);
    const demoEmail = "demo.transporter@thadam.in";
    const demoPass = "Freight@123456";

    try {
      const userCredential = await signInWithEmailAndPassword(auth, demoEmail, demoPass);
      await fetchUserData(userCredential.user.uid, userCredential.user);
      setError(null);
    } catch (err: any) {
      console.warn("Demo sign-in direct auth failed, attempting auto-provisioning:", err);
      try {
        await signUp({
          email: demoEmail,
          password: demoPass,
          fullName: "Ramesh Sharma (Demo)",
          companyName: "Sharma Super Freight Logistics",
          city: "Delhi NCR",
          gstin: "07AAACS9981K1Z3",
          fleetCount: 24
        });
        setError(null);
      } catch (signUpErr: any) {
        if (signUpErr.code === "auth/email-already-in-use" || signUpErr.code === "auth/invalid-credential") {
          try {
            const fallbackEmail = `demo.${Date.now()}@thadam.in`;
            await signUp({
              email: fallbackEmail,
              password: demoPass,
              fullName: "Ramesh Sharma (Demo)",
              companyName: "Sharma Super Freight Logistics",
              city: "Delhi NCR",
              gstin: "07AAACS9981K1Z3",
              fleetCount: 24
            });
            setError(null);
          } catch (fallbackErr: any) {
            console.error("Fallback demo signup error:", fallbackErr);
            setError("Could not sign in to demo account: " + (fallbackErr.message || "Unknown error"));
          }
        } else {
          console.error("Demo signup error:", signUpErr);
          setError("Could not sign in to demo account: " + (signUpErr.message || "Unknown error"));
        }
      }
    } finally {
      setLoading(false);
    }
  };

  const signInDemoDriver = async () => {
    setError(null);
    setLoading(true);
    const driverEmail = "driver.demo@thadam.in";
    const driverPass = "Driver@123456";

    try {
      const userCredential = await signInWithEmailAndPassword(auth, driverEmail, driverPass);
      await fetchUserData(userCredential.user.uid, userCredential.user);
      setError(null);
    } catch (err: any) {
      console.warn("Demo driver direct sign-in failed, creating demo driver account:", err);
      let targetEmail = driverEmail;
      let userCredential;
      try {
        userCredential = await createUserWithEmailAndPassword(auth, targetEmail, driverPass);
      } catch (createErr: any) {
        if (createErr.code === "auth/email-already-in-use" || createErr.code === "auth/invalid-credential") {
          targetEmail = `driver.demo.${Date.now()}@thadam.in`;
          userCredential = await createUserWithEmailAndPassword(auth, targetEmail, driverPass);
        } else {
          throw createErr;
        }
      }

      try {
        const user = userCredential.user;
        await updateProfile(user, { displayName: "Ramesh Kumar (Captain)" });

        const companyRef = doc(collection(db, "companies"));
        const branchRef = doc(collection(db, "branches"));
        const companyData = {
          name: "VRL Freight Express Ltd.",
          ownerUid: user.uid,
          city: "Mumbai",
          state: "Maharashtra",
          gstin: "27AABCV1234F1Z1",
          fleetCount: 18,
          createdAt: new Date().toISOString()
        };

        const driverRef = doc(collection(db, "drivers"));
        const driverData = {
          companyId: companyRef.id,
          branchId: branchRef.id,
          fullName: "Ramesh Kumar (Captain)",
          phoneNumber: "+91 98765 43210",
          licenseNumber: "DL-0420229876",
          licenseExpiry: "2028-12-31",
          licenseType: "Transport",
          status: "Active",
          address: "Driver Rest Hub, Bandra Kurla Complex, Mumbai",
          joiningDate: "2024-01-15",
          email: targetEmail,
          authUid: user.uid,
          createdAt: new Date().toISOString()
        };

        const userDocRef = doc(db, "users", user.uid);
        const userDocData: FreightUser = {
          uid: user.uid,
          email: targetEmail,
          displayName: "Ramesh Kumar (Captain)",
          companyId: companyRef.id,
          companyName: "VRL Freight Express Ltd.",
          role: "Driver",
          phone: "+91 98765 43210",
          branchId: branchRef.id,
          driverRecordId: driverRef.id,
          createdAt: new Date().toISOString()
        };

        const shipmentRef = doc(collection(db, "shipments"));
        const shipmentData = {
          companyId: companyRef.id,
          branchId: branchRef.id,
          lrNumber: "LR-2026-8801",
          origin: "Bhiwandi Warehousing Hub, Mumbai",
          destination: "Electronic City Logistics Park, Bengaluru",
          consignor: "Tata Motors Manufacturing Ltd.",
          consignorGst: "27AAACT1234F1Z5",
          consignee: "Reliance Industrial Corp",
          consigneeGst: "29AAACR5678K1Z9",
          cargoType: "Automotive Precision Components",
          shipmentType: "FTL",
          weightTons: 16.5,
          truckType: "32 Ft Multi-Axle Container",
          assignedTruckNumber: "MH 04 FK 9021",
          assignedDriverId: driverRef.id,
          driverName: "Ramesh Kumar (Captain)",
          driverPhone: "+91 98765 43210",
          freightAmount: 64000,
          advancePaid: 32000,
          ewayBillNo: "341098234190",
          status: "In Transit",
          bookingDate: new Date().toISOString().split('T')[0],
          expectedDeliveryDate: new Date(Date.now() + 86400000 * 2).toISOString().split('T')[0],
          statusHistory: [
            { status: "Booked", timestamp: new Date(Date.now() - 3600000 * 5).toISOString(), updatedByRole: "Dispatcher" },
            { status: "Loaded", timestamp: new Date(Date.now() - 3600000 * 3).toISOString(), updatedByRole: "Fleet Manager" },
            { status: "In Transit", timestamp: new Date(Date.now() - 3600000 * 1).toISOString(), updatedByRole: "Driver" }
          ],
          createdAt: new Date().toISOString()
        };

        await runTransaction(db, async (transaction) => {
          transaction.set(companyRef, companyData);
          transaction.set(driverRef, driverData);
          transaction.set(shipmentRef, shipmentData);
          transaction.set(userDocRef, userDocData);
        });

        setUserProfile(userDocData);
        setCompanyProfile({ id: companyRef.id, ...companyData });
        setError(null);
      } catch (createErr: any) {
        console.error("Failed to auto-provision driver demo account:", createErr);
        setError("Driver demo login failed: " + createErr.message);
      }
    } finally {
      setLoading(false);
    }
  };

  const refreshCompanyProfile = async () => {
    const compId = userProfile?.companyId || companyProfile?.id;
    if (!compId) return;
    try {
      const compRef = doc(db, "companies", compId);
      const compSnap = await getDoc(compRef);
      if (compSnap.exists()) {
        setCompanyProfile({
          id: compSnap.id,
          ...compSnap.data()
        } as FreightCompany);
      }
    } catch (err) {
      console.error("Error refreshing company profile:", err);
    }
  };

  const logout = async () => {
    try {
      await signOut(auth);
      setUserProfile(null);
      setCompanyProfile(null);
    } catch (err: any) {
      console.error("Logout error:", err);
    }
  };

  return (
    <AuthContext.Provider
      value={{
        currentUser,
        userProfile,
        companyProfile,
        loading,
        signUp,
        signIn,
        signInDemo,
        signInDemoDriver,
        logout,
        refreshCompanyProfile,
        error,
        clearError
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
};
