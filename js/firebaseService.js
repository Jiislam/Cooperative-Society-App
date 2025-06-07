// js/firebaseService.js
import { initializeApp } from "https://www.gstatic.com/firebasejs/9.23.0/firebase-app.js";
import { getAuth, signInAnonymously, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/9.23.0/firebase-auth.js";
import {
    getFirestore, doc, getDoc, setDoc, addDoc, updateDoc,
    collection, query, getDocs, serverTimestamp, runTransaction, 
    orderBy, deleteDoc, where, writeBatch, arrayUnion 
} from "https://www.gstatic.com/firebasejs/9.23.0/firebase-firestore.js";

let db = null;
let auth = null;
let firebaseApp = null;

export async function initializeFirebase(config) {
    try {
        if (firebaseApp) {
            // console.log("Firebase connection already active."); // Optional for debugging
            return { success: true, db, auth };
        }
        firebaseApp = initializeApp(config);
        db = getFirestore(firebaseApp);
        auth = getAuth(firebaseApp);

        await signInAnonymously(auth);
        // console.log("Signed in anonymously to Firebase."); // Optional for debugging

        onAuthStateChanged(auth, (user) => {
            // if (user) console.log("Firebase Auth User UID:", user.uid); // Optional for debugging
            // else console.log("Firebase User signed out or no user."); // Optional for debugging
        });
        return { success: true, db, auth };
    } catch (error) {
        console.error("Firebase Initialization Error in service: ", error);
        return { success: false, error };
    }
}

export const getDb = () => db;
export const getAuthInstance = () => auth;

async function deleteAllDocumentsInCollectionFS(collectionPath) {
    if (!getDb()) throw new Error("Firestore not initialized");
    const collRef = collection(getDb(), collectionPath);
    const querySnapshot = await getDocs(collRef);
    const deletePromises = [];
    querySnapshot.forEach((docSnapshot) => {
        deletePromises.push(deleteDoc(docSnapshot.ref));
    });
    await Promise.all(deletePromises);
    console.log(`All documents in ${collectionPath} deleted.`);
}

// --- Member related Firestore operations ---
export async function fetchSocietyMembersFS(appInstanceId) {
    if (!getDb()) throw new Error("Firestore not initialized");
    const membersArray = []; // Returns an array of member objects
    const membersColRef = collection(getDb(), `app_data/${appInstanceId}/members`);
    const q = query(membersColRef, orderBy("name_lowercase"));
    const querySnapshot = await getDocs(q);
    querySnapshot.forEach((doc) => {
        membersArray.push({ id: doc.id, ...doc.data() });
    });
    return membersArray;
}

export async function addSocietyMemberFS(appInstanceId, memberData) {
    if (!getDb()) throw new Error("Firestore not initialized");
    const membersColRef = collection(getDb(), `app_data/${appInstanceId}/members`);
    const newMemberDocRef = await addDoc(membersColRef, {
        ...memberData,
        date_added: serverTimestamp()
    });
    return newMemberDocRef;
}

export async function deleteMemberFS(appInstanceId, memberId) {
    if (!getDb()) throw new Error("Firestore not initialized");
    const memberDocRef = doc(getDb(), `app_data/${appInstanceId}/members`, memberId);
    await deleteDoc(memberDocRef);
}

// --- Cumulative Totals Firestore operations ---
export async function fetchCumulativeTotalsFS(appInstanceId) {
    if (!getDb()) throw new Error("Firestore not initialized");
    const totalsDocRef = doc(getDb(), `app_data/${appInstanceId}/cumulative_totals/current`);
    const docSnap = await getDoc(totalsDocRef);
    if (docSnap.exists()) {
        return docSnap.data();
    } else {
        const initialTotals = { savings: 0, loan: 0, lastUpdated: serverTimestamp() };
        await setDoc(totalsDocRef, initialTotals);
        return { savings: 0, loan: 0, lastUpdated: null }; 
    }
}

export async function recalculateTotalsAfterDeletionFS(appInstanceId, totalNetSavingsChangeFromDeleted, totalNetLoanChangeFromDeleted) {
    if (!getDb()) throw new Error("Firestore not initialized");
    const totalsDocRef = doc(getDb(), `app_data/${appInstanceId}/cumulative_totals/current`);
    let newTotalsData;
    await runTransaction(getDb(), async (transaction) => {
        const totalsSnap = await transaction.get(totalsDocRef);
        let currentSavings = 0;
        let currentLoan = 0;
        if (totalsSnap.exists()) {
            currentSavings = Number(totalsSnap.data().savings) || 0;
            currentLoan = Number(totalsSnap.data().loan) || 0;
        }
        
        const newCumulativeSavings = currentSavings - totalNetSavingsChangeFromDeleted;
        const newCumulativeLoan = currentLoan - totalNetLoanChangeFromDeleted;

        newTotalsData = { savings: newCumulativeSavings, loan: newCumulativeLoan };
        transaction.set(totalsDocRef, { 
            ...newTotalsData,
            lastUpdated: serverTimestamp()
        }, { merge: true }); 
    });
    return { ...newTotalsData, lastUpdated: new Date() }; 
}


export async function deleteCumulativeTotalsFS(appInstanceId) {
    if (!getDb()) throw new Error("Firestore not initialized");
    const totalsDocRef = doc(getDb(), `app_data/${appInstanceId}/cumulative_totals/current`);
    const docSnap = await getDoc(totalsDocRef);
    if (docSnap.exists()) {
        await deleteDoc(totalsDocRef);
        console.log(`Cumulative totals document deleted for instance: ${appInstanceId}`);
    } else {
        console.log(`Cumulative totals document did not exist for instance: ${appInstanceId}, no deletion needed.`);
    }
}


// --- Report related Firestore operations ---
export async function fetchAllReportsMetadataFS(appInstanceId) {
    if (!getDb()) throw new Error("Firestore not initialized in firebaseService");
    const reportsList = [];
    const reportsColRef = collection(getDb(), `app_data/${appInstanceId}/reports`);
    const q = query(reportsColRef, orderBy("createdAt", "desc")); 
    const querySnapshot = await getDocs(q);
    querySnapshot.forEach((doc) => {
        reportsList.push({ id: doc.id, ...doc.data() });
    });
    return reportsList;
}

export async function fetchReportByIdFS(appInstanceId, reportId) {
    if (!getDb()) throw new Error("Firestore not initialized in firebaseService");
    const reportDocRef = doc(getDb(), `app_data/${appInstanceId}/reports`, reportId);
    const reportDocSnap = await getDoc(reportDocRef);
    if (reportDocSnap.exists()) {
        return { id: reportDocSnap.id, ...reportDocSnap.data() }; 
    }
    throw new Error("রিপোর্ট খুঁজে পাওয়া যায়নি।"); 
}

export async function saveReportWithTransactionFS(appInstanceId, reportDataFromMain, monthlyNetSavings, monthlyNetLoan) {
    if (!getDb()) throw new Error("Firestore not initialized in firebaseService");
    const newReportDocRef = doc(collection(getDb(), `app_data/${appInstanceId}/reports`));
    const totalsDocRef = doc(getDb(), `app_data/${appInstanceId}/cumulative_totals/current`);
    let finalCumulativeTotals;
    await runTransaction(getDb(), async (transaction) => {
        const totalsSnap = await transaction.get(totalsDocRef);
        let newCumulativeSavings = monthlyNetSavings; 
        let newCumulativeLoan = monthlyNetLoan;     
        if (totalsSnap.exists()) {
            newCumulativeSavings += (Number(totalsSnap.data().savings) || 0);
            newCumulativeLoan += (Number(totalsSnap.data().loan) || 0);
        } else {
            console.warn("Cumulative totals document not found. Initializing with current report's net values.");
        }
        finalCumulativeTotals = { savings: newCumulativeSavings, loan: newCumulativeLoan };
        transaction.set(totalsDocRef, {
            ...finalCumulativeTotals,
            lastUpdated: serverTimestamp()
        }, { merge: true }); 
        const fullReportData = {
            ...reportDataFromMain, 
            createdAt: serverTimestamp(), 
            cumulativeTotalsAtEndOfReport: { ...finalCumulativeTotals } 
        };
        transaction.set(newReportDocRef, fullReportData);
    });
    return { reportId: newReportDocRef.id, updatedCumulativeTotals: { ...finalCumulativeTotals, lastUpdated: new Date() } };
}

export async function fetchReportsByYearFS(appInstanceId, year) {
    if (!getDb()) throw new Error("Firestore not initialized in firebaseService");
    const reportsForYear = [];
    const reportsColRef = collection(getDb(), `app_data/${appInstanceId}/reports`);
    const numericYear = Number(year);
    const q = query(reportsColRef, where("year", "==", numericYear), orderBy("createdAt")); 
    try {
        const querySnapshot = await getDocs(q);
        querySnapshot.forEach((doc) => {
            reportsForYear.push({ id: doc.id, ...doc.data() });
        });
    } catch (error) {
        console.error("Error fetching reports by year (check Firestore indexes):", error);
        if (error.code === 'failed-precondition' || error.message.includes("index")) {
            console.warn("Missing Firestore index for year query with ordering. Falling back to client-side filter (less efficient). Create an index on 'year' and 'createdAt' for optimal performance.");
            const allReportsSnapshot = await getDocs(collection(getDb(), `app_data/${appInstanceId}/reports`));
            allReportsSnapshot.forEach((doc) => {
                const reportData = doc.data();
                if (Number(reportData.year) === numericYear) {
                    reportsForYear.push({ id: doc.id, ...doc.data() });
                }
            });
            reportsForYear.sort((a,b) => (a.createdAt?.toDate() || 0) - (b.createdAt?.toDate() || 0));
        } else {
            throw error;
        }
    }
    return reportsForYear;
}

export async function checkIfReportExistsFS(appInstanceId, month, year) {
    if (!getDb()) throw new Error("Firestore not initialized");
    const reportsColRef = collection(getDb(), `app_data/${appInstanceId}/reports`);
    const q = query(reportsColRef, 
                    where("month", "==", month), 
                    where("year", "==", year)
                  );
    try {
        const querySnapshot = await getDocs(q);
        if (!querySnapshot.empty) {
            return querySnapshot.docs[0].id; 
        }
        return null; 
    } catch (error) {
        console.error("Error checking for existing report:", error);
        throw error; 
    }
}

export async function deleteReportFS(appInstanceId, reportId) {
    if (!getDb()) throw new Error("Firestore not initialized");
    if (!reportId) throw new Error("Report ID is required for deletion.");
    const reportDocRef = doc(getDb(), `app_data/${appInstanceId}/reports`, reportId);
    await deleteDoc(reportDocRef);
    console.log(`Report document ${reportId} deleted successfully.`);
}

export async function updateReportFS(appInstanceId, reportId, updatedReportDataPayload, newCumulativeTotalsAtEndOfReport) {
    if (!getDb()) throw new Error("Firestore not initialized");
    if (!reportId) throw new Error("Report ID is required for update.");
    
    const reportDocRef = doc(getDb(), `app_data/${appInstanceId}/reports`, reportId);
    const dataToUpdate = {
        entries: updatedReportDataPayload.entries, 
        monthlyTotals: updatedReportDataPayload.monthlyTotals,
        cumulativeTotalsAtEndOfReport: newCumulativeTotalsAtEndOfReport,
        updatedAt: serverTimestamp(),
        editHistory: arrayUnion({ 
            timestamp: new Date(), 
            action: 'edit_v1.1' 
        })
    };
    await updateDoc(reportDocRef, dataToUpdate);
    console.log(`Report document ${reportId} updated successfully.`);
}

export async function adjustCumulativeTotalsFS(appInstanceId, netSavingsDifference, netLoanDifference) {
    if (!getDb()) throw new Error("Firestore not initialized");
    const totalsDocRef = doc(getDb(), `app_data/${appInstanceId}/cumulative_totals/current`);
    let newGlobalTotals;

    await runTransaction(getDb(), async (transaction) => {
        const totalsSnap = await transaction.get(totalsDocRef);
        let currentGlobalSavings = 0;
        let currentGlobalLoan = 0;

        if (totalsSnap.exists()) {
            currentGlobalSavings = Number(totalsSnap.data().savings) || 0;
            currentGlobalLoan = Number(totalsSnap.data().loan) || 0;
        } else {
            console.warn("Global cumulative totals document not found during adjustment. This might lead to incorrect totals if this is not the first transaction.");
        }
        
        const updatedGlobalSavings = currentGlobalSavings + netSavingsDifference;
        const updatedGlobalLoan = currentGlobalLoan + netLoanDifference;

        newGlobalTotals = { savings: updatedGlobalSavings, loan: updatedGlobalLoan };
        transaction.set(totalsDocRef, {
            ...newGlobalTotals,
            lastUpdated: serverTimestamp()
        }, { merge: true }); 
    });
    return { ...newGlobalTotals, lastUpdated: new Date() }; 
}

// *** NEW FUNCTION to fetch all data for export ***
/**
 * Fetches all members, reports, and current cumulative totals for a given app instance.
 * @param {string} appInstanceId - The application instance ID.
 * @returns {Promise<Object|null>} An object containing members, reports, and cumulativeTotals, or null if an error occurs.
 */
export async function fetchAllDataForExportFS(appInstanceId) {
    if (!getDb()) {
        console.error("Firestore not initialized for export.");
        return null;
    }
    try {
        const members = await fetchSocietyMembersFS(appInstanceId); 
        const reports = await fetchAllReportsMetadataFS(appInstanceId); 
        const cumulativeTotals = await fetchCumulativeTotalsFS(appInstanceId);

        return {
            appInstanceId: appInstanceId,
            exportTimestamp: new Date().toISOString(),
            data: {
                members: members, // fetchSocietyMembersFS now returns an array
                reports: reports,
                cumulativeTotals: cumulativeTotals
            }
        };
    } catch (error) {
        console.error("Error fetching all data for export:", error);
        return null;
    }
}


// --- Data Reset Functions ---
export async function deleteAllMembersFS(appInstanceId) {
    const membersPath = `app_data/${appInstanceId}/members`;
    await deleteAllDocumentsInCollectionFS(membersPath);
}

export async function deleteAllReportsFS(appInstanceId) {
    const reportsPath = `app_data/${appInstanceId}/reports`;
    await deleteAllDocumentsInCollectionFS(reportsPath);
}
