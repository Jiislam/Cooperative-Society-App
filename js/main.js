// js/main.js (Orchestrator with All UI/Feature Updates)
import {
    initializeFirebase, fetchSocietyMembersFS,
    fetchCumulativeTotalsFS, fetchAllReportsMetadataFS,
    recalculateTotalsAfterDeletionFS,
    deleteAllMembersFS, deleteAllReportsFS, deleteCumulativeTotalsFS,
    fetchAllDataForExportFS
} from './firebaseService.js';

import {
    showLoadingUI, showFirebaseConfigSectionUI, showMessageUI,
    renderSocietyMembersListUI,
    populateReportEntryMemberDropdownUI,
    populateMonthDropdownUI,
    populateYearDropdownUI, // New: Import populateYearDropdownUI
    renderCurrentReportEntriesPreviewUI,
    updateOverallFinancialStatusDisplayUI,
    updateCurrentDateDisplayUI,
    renderReportToHtmlUI, populatePreviousReportsDropdownUI, setReportOutputHTML,
    renderAnnualReportUI,
    populateStatementMemberDropdownUI, renderMemberStatementUI,
    toggleReportActionButtonsUI,
    showConfirmModalUI, // Import new custom confirm modal
    showPromptModalUI   // Import new custom prompt modal
} from './uiHandler.js';

// Import services
import { exportToCsv, exportToPdf, exportAllDataToJson } from './exportService.js';
import { calculateMonthlyTotals } from './transactionService.js';
import {
    createNewMonthlyReport,
    loadReportById,
    generateAnnualReportData,
    generateMemberStatementData,
    deleteMonthlyReportAndRecalculate,
    updateMonthlyReportAndRecalculate,
    getMemberNetSavingsAsOfDate,
    getMemberNetLoanAsOfDate
} from './reportService.js';
import { addMember, deleteMember as deleteMemberFromService } from './memberService.js';


// --- App Constants & State ---
const SOCIETY_NAME = "আল-বারাকাহ সহায়ক সমিতি";

// Function to get/set app instance ID, now with manual override capability
const getAppInstanceId = () => {
    let id = localStorage.getItem('coopReportAppInstanceId');
    if (!id) {
        id = `coop-report-${crypto.randomUUID().substring(0,12)}`;
        localStorage.setItem('coopReportAppInstanceId', id);
    }
    return id;
}
let appInstanceId = getAppInstanceId(); // Initialize with existing or new ID

// Function to set a new app instance ID and reload data
async function setAndLoadAppInstanceId(newId) {
    if (!newId || newId.trim() === '') {
        showMessageUI("অ্যাপ ইনস্ট্যান্স আইডি খালি হতে পারে না।", "error", 0);
        return;
    }
    localStorage.setItem('coopReportAppInstanceId', newId.trim());
    appInstanceId = newId.trim(); // Update the global variable
    if (displayAppIdElement) {
        displayAppIdElement.textContent = appInstanceId;
    }
    if (currentAppInstanceIdDisplay) { // Update the new display element
        currentAppInstanceIdDisplay.textContent = appInstanceId;
    }
    showMessageUI(`অ্যাপ ইনস্ট্যান্স আইডি "${appInstanceId}" লোড করা হয়েছে। ডেটা রিফ্রেশ করা হচ্ছে...`, "info");
    await loadInitialData(); // Reload all data for the new instance ID
}


let currentReportEntries = [];
let societyMembers = new Map(); // Stores active members
let cumulativeTotals = { savings: 0, loan: 0 };
let lastRenderedReportData = { type: null, data: null, titleInfo: {} };
let editingReportId = null;
let editingReportOriginalTotals = null;

const banglaMonthsForUI = [
    "জানুয়ারি", "ফেব্রুয়ারি", "মার্চ", "এপ্রিল", "মে", "জুন",
    "জুলাই", "আগস্ট", "সেপ্টেম্বর", "অক্টোবর", "নভেম্বর", "ডিসেম্বর"
];

// --- DOM Elements ---
const firebaseConfigInput = document.getElementById('firebaseConfigInput');
const saveFirebaseConfigBtn = document.getElementById('saveFirebaseConfigBtn');
const displayAppIdElement = document.getElementById('displayAppId');
const currentAppInstanceIdDisplay = document.getElementById('currentAppInstanceIdDisplay'); // New display for current ID
const appInstanceIdInput = document.getElementById('appInstanceIdInput'); // New input for manual ID
const loadAppInstanceIdBtn = document.getElementById('loadAppInstanceIdBtn'); // New button to load ID
const copyAppInstanceIdBtn = document.getElementById('copyAppInstanceIdBtn'); // New button to copy ID


const reportMonthSelect = document.getElementById('reportMonthSelect');
const reportYearSelect = document.getElementById('reportYearSelect'); // New: Updated ID for select element

const newSocietyMemberNameInput = document.getElementById('newSocietyMemberName');
const addSocietyMemberBtn = document.getElementById('addSocietyMemberBtn');
const reportMemberNameSelect = document.getElementById('reportMemberNameSelect');

const memberSavingsInput = document.getElementById('memberSavings');
const memberSavingsWithdrawalInput = document.getElementById('memberSavingsWithdrawal');
const memberLoanDisbursedInput = document.getElementById('memberLoanDisbursed') || document.getElementById('memberLoan');
const memberLoanRepaymentInput = document.getElementById('memberLoanRepayment');
const addMemberToReportBtn = document.getElementById('addMemberToReportBtn');


const generateReportBtn = document.getElementById('generateReportBtn');
const downloadPdfBtn = document.getElementById('downloadPdfBtn');
const exportCsvBtn = document.getElementById('exportCsvBtn');
const printReportBtn = document.getElementById('printReportBtn');
const clearCurrentReportEntriesBtn = document.getElementById('clearCurrentReportEntriesBtn');
const cancelEditReportBtn = document.getElementById('cancelEditReportBtn');


const previousReportsListContainer = document.getElementById('previousReportsListContainer');

const reportOutputDiv = document.getElementById('reportOutput');

const annualReportYearSelect = document.getElementById('annualReportYearSelect'); // New: Updated ID for select element
const generateAnnualReportBtn = document.getElementById('generateAnnualReportBtn');

const resetAllDataBtn = document.getElementById('resetAllDataBtn');
const exportAllDataBtn = document.getElementById('exportAllDataBtn');

if (displayAppIdElement) {
    displayAppIdElement.textContent = appInstanceId;
}
if (currentAppInstanceIdDisplay) { // Initialize the new display for current ID
    currentAppInstanceIdDisplay.textContent = appInstanceId;
}

// --- Helper function to reset edit mode ---
function resetEditMode() {
    editingReportId = null;
    editingReportOriginalTotals = null;
    if (generateReportBtn) {
        generateReportBtn.textContent = "রিপোর্ট তৈরি ও সংরক্ষণ করুন";
        generateReportBtn.classList.remove('theme-button-accent');
        generateReportBtn.classList.add('theme-button-success-lg');
    }
    if (reportMonthSelect) reportMonthSelect.disabled = false;
    if (reportYearSelect) reportYearSelect.disabled = false; // Updated ID here
    if (cancelEditReportBtn) cancelEditReportBtn.classList.add('hidden'); // Hide cancel button
    currentReportEntries = []; // Clear entries on cancel
    renderCurrentReportEntriesPreviewUI(currentReportEntries, handleDeleteSingleReportEntry);
    updateReportMemberDropdown();
}


// --- Initialization Flow ---
async function handleFirebaseInitialization(config) {
    showLoadingUI(true);
    const { success, error } = await initializeFirebase(config);
    if (success) {
        showMessageUI("ফায়ারবেস সফলভাবে সংযুক্ত হয়েছে!", "success");
        showFirebaseConfigSectionUI(false);
        populateMonthDropdownUI();
        // Populate year dropdowns on initialization
        const currentYear = new Date().getFullYear();
        populateYearDropdownUI(reportYearSelect, currentYear - 10, currentYear + 5, currentYear); // For monthly report
        populateYearDropdownUI(annualReportYearSelect, currentYear - 10, currentYear + 5, currentYear); // For annual report
        updateCurrentDateDisplayUI();
        await loadInitialData();
    } else {
        console.error("Firebase Initialization Error in main: ", error);
        showMessageUI(`ফায়ারবেস সংযোগ ব্যর্থ হয়েছে: ${error.message || 'Unknown error'}. কনফিগ এবং নেটওয়ার্ক পরীক্ষা করুন।`, "error", 0);
        if (firebaseConfigInput) firebaseConfigInput.value = '';
        localStorage.removeItem(`firebaseConfig_${appInstanceId}`);
        updateCurrentDateDisplayUI();
    }
    showLoadingUI(false);
    return success;
}

window.addEventListener('load', async () => {
    updateCurrentDateDisplayUI();

    const savedConfig = localStorage.getItem(`firebaseConfig_${appInstanceId}`);
    if (savedConfig) {
        console.log("Using saved Firebase config from local storage.");
        try {
            await handleFirebaseInitialization(JSON.parse(savedConfig));
        } catch (e) {
            console.error("Error parsing saved Firebase config:", e);
            showMessageUI("সংরক্ষিত Firebase কনফিগারেশনে ত্রুটি। অনুগ্রহ করে পুনরায় প্রবেশ করুন।", "error", 0);
            localStorage.removeItem(`firebaseConfig_${appInstanceId}`);
            showFirebaseConfigSectionUI(true);
            populateMonthDropdownUI();
            // Also populate year dropdowns even if Firebase fails, so UI is consistent
            const currentYear = new Date().getFullYear();
            populateYearDropdownUI(reportYearSelect, currentYear - 10, currentYear + 5, currentYear);
            populateYearDropdownUI(annualReportYearSelect, currentYear - 10, currentYear + 5, currentYear);
        }
    } else {
        console.log("No Firebase config found. Please enter manually.");
        showFirebaseConfigSectionUI(true);
        populateMonthDropdownUI();
        // Populate year dropdowns if no config found
        const currentYear = new Date().getFullYear();
        populateYearDropdownUI(reportYearSelect, currentYear - 10, currentYear + 5, currentYear);
        populateYearDropdownUI(annualReportYearSelect, currentYear - 10, currentYear + 5, currentYear);
    }

    const savedTheme = localStorage.getItem('selectedTheme');
    const themeSelector = document.getElementById('themeSelector');
    if (themeSelector) {
        if (savedTheme) {
            document.body.className = savedTheme === 'default' ? '' : `theme-${savedTheme}`;
            themeSelector.value = savedTheme;
        } else {
            document.body.className = '';
            themeSelector.value = 'default';
        }

        themeSelector.addEventListener('change', (event) => {
            const selectedTheme = event.target.value;
            document.body.className = selectedTheme === 'default' ? '' : `theme-${selectedTheme}`;
            localStorage.setItem('selectedTheme', selectedTheme);
        });
    }
    showLoadingUI(false);
});

if (saveFirebaseConfigBtn) {
    saveFirebaseConfigBtn.addEventListener('click', async () => {
        if (!firebaseConfigInput) return;
        const configString = firebaseConfigInput.value;
        if (!configString.trim()) {
            showMessageUI("Firebase কনফিগ খালি রাখা যাবে না।", "error", 0);
            return;
        }
        try {
            const config = JSON.parse(configString);
            if (await handleFirebaseInitialization(config)) {
                localStorage.setItem(`firebaseConfig_${appInstanceId}`, configString);
            }
        } catch (e) {
            showMessageUI("অবৈধ Firebase কনফিগ JSON। অনুগ্রহ করে ফর্ম্যাট এবং বিষয়বস্তু পরীক্ষা করুন।", "error", 0);
            console.error("Invalid JSON config", e);
        }
    });
}

// New event listener for loading app instance ID
if (loadAppInstanceIdBtn) {
    loadAppInstanceIdBtn.addEventListener('click', async () => {
        if (!appInstanceIdInput) return;
        const newId = appInstanceIdInput.value;
        await setAndLoadAppInstanceId(newId);
    });
}

// New event listener for copying app instance ID
if (copyAppInstanceIdBtn) {
    copyAppInstanceIdBtn.addEventListener('click', () => {
        if (currentAppInstanceIdDisplay) {
            const idToCopy = currentAppInstanceIdDisplay.textContent;
            // Use document.execCommand('copy') for clipboard operations in iframes
            const tempTextArea = document.createElement('textarea');
            tempTextArea.value = idToCopy;
            document.body.appendChild(tempTextArea);
            tempTextArea.select();
            try {
                document.execCommand('copy');
                showMessageUI("অ্যাপ ইনস্ট্যান্স আইডি কপি করা হয়েছে!", "success");
            } catch (err) {
                console.error('Failed to copy text: ', err);
                showMessageUI("আইডি কপি করতে ব্যর্থ। অনুগ্রহ করে ম্যানুয়ালি কপি করুন।", "error", 0);
            }
            document.body.removeChild(tempTextArea);
        }
    });
}


function updateReportMemberDropdown() {
    const currentEntryMemberIds = currentReportEntries.map(entry => entry.memberId);
    populateReportEntryMemberDropdownUI(societyMembers, currentEntryMemberIds);
}

async function loadInitialData() {
    showLoadingUI(true);
    try {
        const membersData = await fetchSocietyMembersFS(appInstanceId);
        if (Array.isArray(membersData)) {
            const membersMap = new Map();
            membersData.forEach(member => membersMap.set(member.id, member.name));
            societyMembers = membersMap;
        } else if (membersData instanceof Map) {
            societyMembers = membersData;
        } else {
            societyMembers = new Map();
            console.warn("fetchSocietyMembersFS did not return an Array or Map as expected by main.js.");
        }

        renderSocietyMembersListUI(societyMembers, handleDeleteMember, handleViewMemberStatementFromList);
        updateReportMemberDropdown();

        cumulativeTotals = await fetchCumulativeTotalsFS(appInstanceId);
        updateOverallFinancialStatusDisplayUI(cumulativeTotals, societyMembers.size);

        const reports = await fetchAllReportsMetadataFS(appInstanceId);
        populatePreviousReportsDropdownUI(reports, handleLoadPreviousReportFromList, handleInitiateEditReport, handleInitiateDeleteReport);

    } catch (error) {
        console.error("Error loading initial data in main.js:", error);
        showMessageUI("Firestore থেকে প্রাথমিক ডেটা লোড করতে ব্যর্থ।", "error", 0);
    } finally {
        showLoadingUI(false);
    }
}

// --- Event Listener Callbacks & Core Logic ---

async function handleAddSocietyMember() {
    if (!newSocietyMemberNameInput) return;
    const name = newSocietyMemberNameInput.value;

    showLoadingUI(true);
    const result = await addMember(appInstanceId, name, societyMembers);

    if (result.success) {
        societyMembers.set(result.newMemberId, result.memberName);
        renderSocietyMembersListUI(societyMembers, handleDeleteMember, handleViewMemberStatementFromList);
        updateReportMemberDropdown();
        updateOverallFinancialStatusDisplayUI(cumulativeTotals, societyMembers.size);
        showMessageUI(`সমিতির সদস্য "${result.memberName}" সফলভাবে যুক্ত হয়েছে।`, "success");
        newSocietyMemberNameInput.value = '';
    } else {
        if (result.reason === "empty_name") {
            showMessageUI("নতুন সমিতির সদস্যের নাম খালি রাখা যাবে না।", "error", 0);
        } else if (result.reason === "duplicate_name") {
            showMessageUI(`সদস্য "${name.trim()}" ইতিমধ্যে সমিতির তালিকায় বিদ্যমান।`, "warning", 0);
            newSocietyMemberNameInput.value = '';
        } else {
            showMessageUI(result.error.message || "সদস্য যোগ করতে একটি অজানা ত্রুটি ঘটেছে।", "error", 0);
        }
        console.error("Error adding member via service:", result.error);
    }
    showLoadingUI(false);
}

async function handleDeleteMember(memberId, memberNameFromUI) {
    const memberNameToConfirm = societyMembers.get(memberId) || memberNameFromUI;
    const confirmationMessage = `আপনি কি সদস্য "${memberNameToConfirm}" কে মুছে ফেলতে চান? এই পদক্ষেপটি পূর্বাবস্থায় ফেরানো যাবে না এবং তাদের পূর্ববর্তী লেনদেনগুলি সমিতির মোট হিসাব থেকে বাদ দেওয়া হবে।`;

    const confirmed = await showConfirmModalUI("সদস্য মুছুন", confirmationMessage, "মুছুন", "বাতিল করুন");

    if (confirmed) {
        showLoadingUI(true);
        try {
            const deleteResult = await deleteMemberFromService(appInstanceId, memberId);

            if (!deleteResult.success) {
                throw deleteResult.error || new Error("সদস্য ডকুমেন্ট মুছতে ব্যর্থ।");
            }
            const oldMemberNameForMessage = societyMembers.get(memberId) || memberNameToConfirm;
            societyMembers.delete(memberId);

            currentReportEntries = currentReportEntries.filter(entry => entry.memberId !== memberId);
            renderCurrentReportEntriesPreviewUI(currentReportEntries, handleDeleteSingleReportEntry);

            let totalSavingsFromDeleted = 0;
            let totalLoanFromDeleted = 0;
            // When a member is deleted, we need to re-calculate the cumulative totals
            // based on the *remaining* active members' transactions across all reports.
            // This is more robust than trying to subtract the deleted member's specific past totals,
            // which might be complex due to report edits.

            // 1. Fetch all reports to recalculate
            const allReports = await fetchAllReportsMetadataFS(appInstanceId);
            
            // 2. Calculate the net impact of the *deleted* member's transactions
            //    This is needed to adjust the global cumulative totals *before* the recalculation logic.
            //    It ensures that when we adjust, we remove ONLY what that member contributed previously.
            allReports.forEach(report => {
                if (report.entries && Array.isArray(report.entries)) {
                    report.entries.forEach(entry => {
                        // Only count entries of the member being deleted
                        if (entry.memberId === memberId) {
                            totalSavingsFromDeleted += (Number(entry.savings) || 0);
                            totalSavingsFromDeleted -= (Number(entry.savingsWithdrawal) || 0);

                            const entryLoanDisbursed = Number(entry.loanDisbursed) || 0;
                            const entryLoanRepaid = Number(entry.loanRepayment) || 0;
                            totalLoanFromDeleted += (entryLoanDisbursed - entryLoanRepaid);
                        }
                    });
                }
            });

            // 3. Adjust cumulative totals to reflect the removal of this member's historical contributions.
            if (totalSavingsFromDeleted !== 0 || totalLoanFromDeleted !== 0) {
                const updatedTotals = await recalculateTotalsAfterDeletionFS(appInstanceId, totalSavingsFromDeleted, totalLoanFromDeleted);
                cumulativeTotals = updatedTotals;
                showMessageUI(`সদস্য "${oldMemberNameForMessage}" এর ঐতিহাসিক লেনদেন (নেট সঞ্চয়: ${totalSavingsFromDeleted.toFixed(2)}, নেট ঋণ: ${totalLoanFromDeleted.toFixed(2)}) ক্রমসঞ্চিত মোট থেকে বাদ দেওয়া হয়েছে।`, "info", 7000);
            }

            // Re-render UI components that depend on member list or totals
            renderSocietyMembersListUI(societyMembers, handleDeleteMember, handleViewMemberStatementFromList);
            updateReportMemberDropdown();
            updateOverallFinancialStatusDisplayUI(cumulativeTotals, societyMembers.size);
            
            // Re-populate previous reports dropdown as member data might affect statements
            const reportsForDropdown = await fetchAllReportsMetadataFS(appInstanceId);
            populatePreviousReportsDropdownUI(reportsForDropdown, handleLoadPreviousReportFromList, handleInitiateEditReport, handleInitiateDeleteReport);


            showMessageUI(`সদস্য "${oldMemberNameForMessage}" সফলভাবে মুছে ফেলা হয়েছে।`, "success");

        } catch (error) {
            console.error("Error in handleDeleteMember:", error);
            const memberNameForErrorMessage = societyMembers.get(memberId) || memberNameToConfirm;
            showMessageUI(`সদস্য "${memberNameForErrorMessage}" কে মুছতে বা পরিসংখ্যান পুনরায় গণনা করতে ব্যর্থ: ${error.message}`, "error", 0);
            await loadInitialData(); // Attempt to reload data to restore consistent state
        } finally {
            showLoadingUI(false);
        }
    } else {
        showMessageUI("সদস্য মোছা বাতিল করা হয়েছে।", "info");
    }
}


async function handleAddMemberToReport() {
    if (!reportMemberNameSelect || !memberSavingsInput || !memberSavingsWithdrawalInput || !memberLoanDisbursedInput || !memberLoanRepaymentInput) {
        showMessageUI("প্রয়োজনীয় ইনপুট উপাদান এক বা একাধিক পাওয়া যায়নি। অনুগ্রহ করে পৃষ্ঠাটি রিফ্রেশ করুন অথবা অ্যাডমিনকে জানান।", "error", 0);
        return;
    }

    const memberId = reportMemberNameSelect.value;
    if (!memberId) {
        showMessageUI("রিপোর্টে যুক্ত করার জন্য অনুগ্রহ করে একজন সদস্য নির্বাচন করুন।", "error", 0);
        return;
    }
    const existingEntry = currentReportEntries.find(entry => entry.memberId === memberId);
    if (existingEntry) {
        showMessageUI(`সদস্য "${existingEntry.memberName}" ইতিমধ্যে এই রিপোর্টে যুক্ত আছেন। অনুগ্রহ করে আগের এন্ট্রি মুছুন অথবা অন্য সদস্য নির্বাচন করুন।`, "warning", 0);
        return;
    }
    const memberName = societyMembers.get(memberId);
    if (!memberName) {
        showMessageUI("নির্বাচিত সদস্য খুঁজে পাওয়া যায়নি।", "error", 0);
        return;
    }

    const savingsDeposit = parseFloat(memberSavingsInput.value) || 0;
    const savingsWithdrawal = parseFloat(memberSavingsWithdrawalInput.value) || 0;
    const loanDisbursed = parseFloat(memberLoanDisbursedInput.value) || 0;
    const loanRepayment = parseFloat(memberLoanRepaymentInput.value) || 0;

    if (savingsDeposit < 0) {
        showMessageUI("সঞ্চয় জমার পরিমাণ ঋণাত্মক হতে পারবে না।", "error", 0);
        memberSavingsInput.focus();
        return;
    }
    if (savingsWithdrawal < 0 || loanDisbursed < 0 || loanRepayment < 0) {
        showMessageUI("টাকার পরিমাণ ঋণাত্মক হতে পারবে না।", "error", 0);
        return;
    }

    // Removed the validation for simultaneous savings deposit and withdrawal as per user request.
    // if (savingsWithdrawal > 0 && savingsDeposit > 0) {
    //     showMessageUI("একই এন্ট্রিতে সঞ্চয় জমা এবং উত্তোলন উভয়ই করা যাবে না। অনুগ্রহ করে আলাদা এন্ট্রি করুন।", "warning", 0);
    //     return;
    // }

    // Removed the validation for simultaneous loan disbursement and repayment as per user request.
    // if (loanDisbursed > 0 && loanRepayment > 0) {
    //     showMessageUI("একই এন্ট্রিতে ঋণ গ্রহণ এবং ঋণ পরিশোধ উভয়ই করা যাবে না। অনুগ্রহ করে আলাদা এন্ট্রি করুন।", "warning", 0);
    //     memberLoanDisbursedInput.focus();
    //     return;
    // }

    // --- Chronological Validation for Withdrawals and Loan Repayments ---
    const reportMonthString = reportMonthSelect.value;
    const reportYearString = reportYearSelect.value; // Updated ID here
    const reportYearNumber = parseInt(reportYearString);
    const reportMonthIndex = banglaMonthsForUI.indexOf(reportMonthString);

    if (isNaN(reportYearNumber) || reportMonthIndex === -1) {
        showMessageUI("রিপোর্টের মাস বা বছর অবৈধ।", "error", 0);
        return;
    }

    // Create a Date object for the first day of the report month
    const reportDate = new Date(reportYearNumber, reportMonthIndex, 1);

    if (savingsWithdrawal > 0) {
        showLoadingUI(true);
        // Get net savings as of the report date
        const memberNetSavingsAsOfReportDate = await getMemberNetSavingsAsOfDate(appInstanceId, memberId, reportDate);
        showLoadingUI(false);

        if (memberNetSavingsAsOfReportDate === null) {
            showMessageUI("সদস্যের সঞ্চয় হিসাব করতে ত্রুটি হয়েছে।", "error", 0);
            return;
        }

        if (savingsWithdrawal > memberNetSavingsAsOfReportDate) {
            showMessageUI(`"${memberName}" এর অ্যাকাউন্টে পর্যাপ্ত সঞ্চয় (${memberNetSavingsAsOfReportDate.toFixed(2)} টাকা) নেই। সর্বোচ্চ ${memberNetSavingsAsOfReportDate.toFixed(2)} টাকা উত্তোলন করা যাবে।`, "error", 0);
            memberSavingsWithdrawalInput.focus();
            return;
        }
    }

    if (loanRepayment > 0) {
        showLoadingUI(true);
        // Get outstanding loan as of the report date
        const memberOutstandingLoanAsOfReportDate = await getMemberNetLoanAsOfDate(appInstanceId, memberId, reportDate);
        showLoadingUI(false);

        if (memberOutstandingLoanAsOfReportDate === null) {
            showMessageUI("সদস্যের ঋণ হিসাব করতে ত্রুটি হয়েছে।", "error", 0);
            return;
        }

        if (memberOutstandingLoanAsOfReportDate <= 0) {
            showMessageUI(`"${memberName}" এর কোনো পরিশোধযোগ্য ঋণ নেই।`, "error", 0);
            memberLoanRepaymentInput.focus();
            return;
        }
        if (loanRepayment > memberOutstandingLoanAsOfReportDate) {
            showMessageUI(`"${memberName}" এর পরিশোধযোগ্য ঋণের পরিমাণ (${memberOutstandingLoanAsOfReportDate.toFixed(2)} টাকা) থেকে বেশি পরিশোধ করা যাবে না।`, "error", 0);
            memberLoanRepaymentInput.focus();
            return;
        }
    }
    // --- End Chronological Validation ---

    if (loanDisbursed > 0) {
        const cashOnHand = (cumulativeTotals.savings || 0) - (cumulativeTotals.loan || 0);
        let totalLoanDisbursedInCurrentDraft = 0;
        currentReportEntries.forEach(entry => {
            totalLoanDisbursedInCurrentDraft += (Number(entry.loanDisbursed) || 0);
        });
        const projectedTotalLoanForThisReport = totalLoanDisbursedInCurrentDraft + loanDisbursed;
        if (projectedTotalLoanForThisReport > cashOnHand) {
            showMessageUI(
                `সমিতির হাতে (${cashOnHand.toFixed(2)} টাকা) এই পরিমাণ ঋণ বিতরণের জন্য পর্যাপ্ত তহবিল নেই। ` +
                `এই রিপোর্টে ইতিমধ্যে বিতরণ করার জন্য প্রস্তাবিত ঋণ (${totalLoanDisbursedInCurrentDraft.toFixed(2)}) ` +
                `এবং এই এন্ট্রির ঋণ (${loanDisbursed.toFixed(2)}) সহ মোট ঋণ দাঁড়াবে ${projectedTotalLoanForThisReport.toFixed(2)} টাকা।`,
                "error",
                0
            );
            memberLoanDisbursedInput.focus();
            return;
        }
    }


    currentReportEntries.push({
        memberId,
        memberName,
        savings: savingsDeposit,
        savingsWithdrawal,
        loanDisbursed,
        loanRepayment
    });
    renderCurrentReportEntriesPreviewUI(currentReportEntries, handleDeleteSingleReportEntry);
    updateReportMemberDropdown();
    showMessageUI(`"${memberName}" এর জন্য এন্ট্রি বর্তমান রিপোর্টে যুক্ত হয়েছে।`, "info");

    memberSavingsInput.value = '';
    memberSavingsWithdrawalInput.value = '';
    memberLoanDisbursedInput.value = '';
    memberLoanRepaymentInput.value = '';
    if (reportMemberNameSelect) reportMemberNameSelect.focus();
}

function handleDeleteSingleReportEntry(indexToDelete) {
    if (indexToDelete >= 0 && indexToDelete < currentReportEntries.length) {
        const removedEntry = currentReportEntries.splice(indexToDelete, 1)[0];
        renderCurrentReportEntriesPreviewUI(currentReportEntries, handleDeleteSingleReportEntry);
        updateReportMemberDropdown();
        showMessageUI(`"${removedEntry.memberName}" এর এন্ট্রি বর্তমান রিপোর্ট থেকে সফলভাবে মুছে ফেলা হয়েছে।`, "info");
        if (currentReportEntries.length === 0) {
            toggleReportActionButtonsUI(false);
            if (editingReportId && generateReportBtn) {
                generateReportBtn.textContent = "রিপোর্ট আপডেট করুন";
            }
        }
    }
}

async function handleClearCurrentReportEntries() {
    if (currentReportEntries.length > 0) {
        const confirmed = await showConfirmModalUI(
            "এন্ট্রি মুছুন",
            "আপনি কি নিশ্চিত যে বর্তমান রিপোর্টে যুক্ত সমস্ত এন্ট্রি মুছে ফেলতে চান? এই পদক্ষেপটি পূর্বাবস্থায় ফেরানো যাবে না।",
            "মুছুন",
            "বাতিল করুন"
        );
        if (confirmed) {
            currentReportEntries = [];
            renderCurrentReportEntriesPreviewUI(currentReportEntries, handleDeleteSingleReportEntry);
            updateReportMemberDropdown();
            showMessageUI("বর্তমান রিপোর্ট এন্ট্রিগুলি মুছে ফেলা হয়েছে।", "info");
            toggleReportActionButtonsUI(false);
            resetEditMode();
        } else {
            showMessageUI("এন্ট্রি মোছা বাতিল করা হয়েছে।", "info");
        }
    } else {
        showMessageUI("মোছার জন্য কোনও এন্ট্রি নেই।", "info");
    }
}

async function handleGenerateReport() {
    if (currentReportEntries.length === 0 && !editingReportId) {
        showMessageUI("রিপোর্ট তৈরি/আপডেট করতে অনুগ্রহ করে কমপক্ষে একটি সদস্য এন্ট্রি যুক্ত করুন।", "error", 0);
        return;
    }
    if (!reportMonthSelect || !reportYearSelect || !generateReportBtn) { // Updated ID here
        console.error("Required UI elements for report generation are missing.");
        showMessageUI("রিপোর্ট তৈরির জন্য প্রয়োজনীয় UI উপাদান পাওয়া যায়নি।", "error", 0);
        return;
    }

    showLoadingUI(true);
    generateReportBtn.disabled = true;

    try {
        const associationNameString = SOCIETY_NAME;
        const reportMonthString = reportMonthSelect.value;
        const reportYearString = reportYearSelect.value; // Updated ID here

        let result;
        if (editingReportId) {
            // Added check for entries being zero in edit mode
            if (currentReportEntries.length === 0) {
                const confirmed = await showConfirmModalUI(
                    "এন্ট্রিবিহীন রিপোর্ট",
                    "আপনি কি নিশ্চিত যে আপনি এই রিপোর্টটি কোনো এন্ট্রি ছাড়াই সংরক্ষণ করতে চান? এটি একটি খালি রিপোর্ট হিসেবে সংরক্ষণ হবে।",
                    "হ্যাঁ, সংরক্ষণ করুন",
                    "বাতিল করুন"
                );
                if (!confirmed) {
                    showMessageUI("রিপোর্ট সংরক্ষণ বাতিল করা হয়েছে।", "info");
                    showLoadingUI(false);
                    generateReportBtn.disabled = false;
                    return; // Stop execution if not confirmed
                }
            }

            if (!editingReportOriginalTotals) {
                showMessageUI("সম্পাদনার জন্য মূল রিপোর্টের ডেটা অনুপস্থিত। অনুগ্রহ করে আবার চেষ্টা করুন।", "error", 0);
                resetEditMode();
                throw new Error("Original report totals missing for update.");
            }
            result = await updateMonthlyReportAndRecalculate(
                appInstanceId,
                editingReportId,
                currentReportEntries,
                editingReportOriginalTotals
            );
        } else {
            result = await createNewMonthlyReport(
                appInstanceId,
                currentReportEntries,
                reportMonthString,
                reportYearString,
                associationNameString
            );
        }

        if (result.success) {
            cumulativeTotals = editingReportId ? result.newGlobalCumulativeTotals : result.updatedCumulativeTotals;
            updateOverallFinancialStatusDisplayUI(cumulativeTotals, societyMembers.size);

            const reportsForDropdown = await fetchAllReportsMetadataFS(appInstanceId);
            populatePreviousReportsDropdownUI(reportsForDropdown, handleLoadPreviousReportFromList, handleInitiateEditReport, handleInitiateDeleteReport);

            const reportDataToDisplay = editingReportId ? result.updatedReportData : result.savedReportData;

            const createdAtJSDate = reportDataToDisplay.createdAt?.toDate ? reportDataToDisplay.createdAt.toDate() : (reportDataToDisplay.createdAt instanceof Date ? reportDataToDisplay.createdAt : new Date());
            const updatedAtJSDate = reportDataToDisplay.updatedAt?.toDate ? reportDataToDisplay.updatedAt.toDate() : (reportDataToDisplay.updatedAt instanceof Date ? reportDataToDisplay.updatedAt : null);


            renderReportToHtmlUI(
                reportDataToDisplay.entries,
                reportDataToDisplay.monthlyTotals.savings,
                reportDataToDisplay.monthlyTotals.loanDisbursed,
                reportDataToDisplay.monthlyTotals.loanRepaid,
                reportDataToDisplay.cumulativeTotalsAtEndOfReport,
                associationNameString,
                reportMonthString,
                reportYearString,
                cumulativeTotals,
                reportDataToDisplay.monthlyTotals.savingsDeposit, // Corrected access
                reportDataToDisplay.monthlyTotals.savingsWithdrawal, // Corrected access
                createdAtJSDate,
                updatedAtJSDate,
                societyMembers // Pass societyMembers to renderReportToHtmlUI
            );
            lastRenderedReportData = {
                type: 'monthly',
                data: {
                    ...reportDataToDisplay,
                    createdAt: createdAtJSDate,
                    updatedAt: updatedAtJSDate
                },
                titleInfo: {
                    associationName: associationNameString,
                    month: reportMonthString,
                    year: reportYearString,
                    id: reportDataToDisplay.id
                }
            };
            toggleReportActionButtonsUI(true);

            const actionMessage = editingReportId ? "সফলভাবে আপডেট করা হয়েছে" : "তৈরি ও সংরক্ষিত হয়েছে";
            showMessageUI(`রিপোর্ট (আইডি: ${reportDataToDisplay.id.substring(0,6)}...) ${actionMessage}।`, "success");

            currentReportEntries = [];
            renderCurrentReportEntriesPreviewUI(currentReportEntries, handleDeleteSingleReportEntry);
            updateReportMemberDropdown();

            if (editingReportId) {
                resetEditMode();
            }

        } else {
            if (result.isDuplicate && !editingReportId) {
                showMessageUI(result.error.message, "warning", 0);
            } else {
                const actionVerb = editingReportId ? "আপডেট" : "তৈরি";
                showMessageUI(`রিপোর্ট ${actionVerb} করতে ব্যর্থ: ${result.error.message || 'অজানা ত্রুটি।'}`, "error", 0);
            }
            console.error("Error generating/updating report via service:", result.error);
            if (!editingReportId) {
                toggleReportActionButtonsUI(lastRenderedReportData.type !== null);
            } else {
                 if(generateReportBtn) generateReportBtn.textContent = "রিপোর্ট আপডেট করুন";
            }
        }
    } catch (error) {
        console.error("Critical error in handleGenerateReport:", error);
        showMessageUI("রিপোর্ট তৈরি/আপডেট করার সময় একটি গুরুতর ত্রুটি ঘটেছে।", "error", 0);
        toggleReportActionButtonsUI(false);
        if (editingReportId) {
            resetEditMode();
        }
    } finally {
        showLoadingUI(false);
        if (generateReportBtn) generateReportBtn.disabled = false;
    }
}

async function handleLoadPreviousReportFromList(reportId) {
    if (!reportId) {
        showMessageUI("লোড করার জন্য রিপোর্ট আইডি পাওয়া যায়নি।", "error", 0);
        return;
    }
    showLoadingUI(true);
    try {
        if (editingReportId) {
            resetEditMode();
            currentReportEntries = [];
            renderCurrentReportEntriesPreviewUI(currentReportEntries, handleDeleteSingleReportEntry);
            updateReportMemberDropdown();
        }

        const result = await loadReportById(appInstanceId, reportId);

        if (result.success) {
            const reportData = result.reportData;
            const associationNameStr = typeof reportData.associationName === 'string' ? reportData.associationName : SOCIETY_NAME;
            const reportMonthStr = typeof reportData.month === 'string' ? reportData.month : "UnknownMonth";
            const reportYearStr = typeof reportData.year === 'string' || typeof reportData.year === 'number' ? String(reportData.year) : "UnknownYear";

            const monthlySavingsNet = reportData.monthlyTotals?.savings || 0;
            const monthlySavingsDeposit = reportData.monthlyTotals?.savingsDeposit || monthlySavingsNet;
            const monthlySavingsWithdrawal = reportData.monthlyTotals?.savingsWithdrawal || 0;
            const monthlyLoanDisbursed = reportData.monthlyTotals?.loanDisbursed || 0;
            const monthlyLoanRepaid = reportData.monthlyTotals?.loanRepaid || 0;

            const createdAtJSDate = reportData.createdAt?.toDate ? reportData.createdAt.toDate() : null;
            const updatedAtJSDate = reportData.updatedAt?.toDate ? reportData.updatedAt.toDate() : null;

            renderReportToHtmlUI(
                reportData.entries,
                monthlySavingsNet,
                monthlyLoanDisbursed,
                monthlyLoanRepaid,
                reportData.cumulativeTotalsAtEndOfReport,
                associationNameStr,
                reportMonthStr,
                reportYearStr,
                cumulativeTotals,
                reportData.monthlyTotals.savingsDeposit, // Corrected access
                reportData.monthlyTotals.savingsWithdrawal, // Corrected access
                createdAtJSDate,
                updatedAtJSDate,
                societyMembers // Pass societyMembers to renderReportToHtmlUI
            );
            lastRenderedReportData = {
                type: 'monthly',
                data: {
                    ...reportData,
                    createdAt: createdAtJSDate,
                    updatedAt: updatedAtJSDate
                },
                titleInfo: {
                    associationName: associationNameStr,
                    month: reportMonthStr,
                    year: reportYearStr,
                    id: reportId
                }
            };
            toggleReportActionButtonsUI(true);
            showMessageUI(`রিপোর্ট "${reportMonthStr} ${reportYearStr}" সফলভাবে লোড হয়েছে।`, "success");

            const reportOutputContainerElement = document.getElementById('reportOutputContainer');
            if (reportOutputContainerElement) {
                reportOutputContainerElement.scrollIntoView({ behavior: 'smooth', block: 'start' });
            }

        } else {
            console.error("Error loading previous report via service:", result.error);
            showMessageUI(`পূর্ববর্তী রিপোর্ট লোড করতে ব্যর্থ: ${result.error.message}`, "error", 0);
            setReportOutputHTML(`<p class="text-gray-400 text-center bengali">রিপোর্ট লোড করা যায়নি।</p>`);
            toggleReportActionButtonsUI(false);
            lastRenderedReportData = { type: null, data: null, titleInfo: {} };
        }
    } catch (error) {
        console.error("Critical error in handleLoadPreviousReportFromList:", error);
        showMessageUI("পূর্ববর্তী রিপোর্ট লোড করার সময় একটি গুরুতর ত্রুটি ঘটেছে।", "error", 0);
        setReportOutputHTML(`<p class="text-gray-400 text-center bengali">রিপোর্ট লোড করা যায়নি।</p>`);
        toggleReportActionButtonsUI(false);
        lastRenderedReportData = { type: null, data: null, titleInfo: {} };
    } finally {
        showLoadingUI(false);
    }
}

async function handleInitiateEditReport(reportId, month, year) {
    if (!reportId) {
        showMessageUI("সম্পাদনা করার জন্য রিপোর্ট আইডি পাওয়া যায়নি।", "error", 0);
        return;
    }
    showLoadingUI(true);
    try {
        if (editingReportId) { // If already in edit mode for another report, reset first
            resetEditMode();
        }
        // Always clear current entries when initiating a new edit, even if it's the same report
        currentReportEntries = [];
        renderCurrentReportEntriesPreviewUI(currentReportEntries, handleDeleteSingleReportEntry);
        updateReportMemberDropdown();


        const result = await loadReportById(appInstanceId, reportId);
        if (result.success && result.reportData && Array.isArray(result.reportData.entries)) {
            const reportToEdit = result.reportData;

            editingReportOriginalTotals = {
                savings: Number(reportToEdit.monthlyTotals?.savings || 0),
                netLoanChange: Number(reportToEdit.monthlyTotals?.netLoanChange || 0)
            };

            // Populate currentReportEntries with entries from the report to edit
            reportToEdit.entries.forEach(entry => {
                currentReportEntries.push({ ...entry });
            });

            if (reportMonthSelect) reportMonthSelect.value = reportToEdit.month;
            if (reportYearSelect) reportYearSelect.value = String(reportToEdit.year); // Updated ID here, ensure string value for select

            renderCurrentReportEntriesPreviewUI(currentReportEntries, handleDeleteSingleReportEntry);
            updateReportMemberDropdown();

            editingReportId = reportId;
            if (generateReportBtn) {
                generateReportBtn.textContent = "রিপোর্ট আপডেট করুন";
                generateReportBtn.classList.remove('theme-button-success-lg');
                generateReportBtn.classList.add('theme-button-accent');
            }

            if(reportMonthSelect) reportMonthSelect.disabled = true;
            if(reportYearSelect) reportYearSelect.disabled = true; // Updated ID here
            if(cancelEditReportBtn) cancelEditReportBtn.classList.remove('hidden'); // Show cancel button

            showMessageUI(`"${reportToEdit.month} ${reportToEdit.year}" মাসের রিপোর্ট এখন সম্পাদনা করছেন।`, "info");

            const reportEntrySectionTitle = document.querySelector('#inputSection h2.bengali:nth-of-type(3)');
            if (reportEntrySectionTitle && reportEntrySectionTitle.textContent.includes("বর্তমান রিপোর্টে সদস্য এন্ট্রি যুক্ত করুন")) {
                 reportEntrySectionTitle.scrollIntoView({ behavior: 'smooth', block: 'center' });
            } else {
                const addEntrySection = document.querySelector('#inputSection > div:nth-child(4)');
                if (addEntrySection) {
                    addEntrySection.scrollIntoView({ behavior: 'smooth', block: 'start' });
                } else {
                    const inputSectionElement = document.getElementById('inputSection');
                    if(inputSectionElement) inputSectionElement.scrollIntoView({ behavior: 'smooth', block: 'start' });
                }
            }

            setReportOutputHTML(`<p class="text-gray-400 text-center bengali">"${reportToEdit.month} ${reportToEdit.year}" মাসের রিপোর্ট সম্পাদনা করছেন...</p>`);
            toggleReportActionButtonsUI(false);

        } else {
            throw result.error || new Error("সম্পাদনার জন্য রিপোর্ট লোড করতে ডেটা পাওয়া যায়নি।");
        }
    } catch (error) {
        console.error("Error initiating report edit:", error);
        showMessageUI(`রিপোর্ট সম্পাদনার জন্য লোড করতে ব্যর্থ: ${error.message}`, "error", 0);
        resetEditMode();
    } finally {
        showLoadingUI(false);
    }
}

async function handleInitiateDeleteReport(reportId, month, year) {
    const confirmationMessage = `আপনি কি "${month} ${year}" মাসের রিপোর্টটি স্থায়ীভাবে মুছে ফেলতে চান? এই কাজটি পূর্বাবস্থায় ফেরানো যাবে না এবং সমিতির মোট আর্থিক পরিসংখ্যান সমন্বয় করা হবে।`;
    const confirmed = await showConfirmModalUI("রিপোর্ট মুছুন", confirmationMessage, "মুছুন", "বাতিল করুন");

    if (!confirmed) {
        showMessageUI("রিপোর্ট মোছা বাতিল করা হয়েছে।", "info");
        return;
    }

    showLoadingUI(true);
    try {
        const result = await deleteMonthlyReportAndRecalculate(appInstanceId, reportId);

        if (result.success) {
            cumulativeTotals = result.updatedCumulativeTotals;
            updateOverallFinancialStatusDisplayUI(cumulativeTotals, societyMembers.size);

            const reportsForDropdown = await fetchAllReportsMetadataFS(appInstanceId);
            populatePreviousReportsDropdownUI(reportsForDropdown, handleLoadPreviousReportFromList, handleInitiateEditReport, handleInitiateDeleteReport);

            if (lastRenderedReportData && lastRenderedReportData.type === 'monthly' && lastRenderedReportData.titleInfo.id === reportId) {
                setReportOutputHTML(`<p class="text-gray-400 text-center bengali">রিপোর্ট মুছে ফেলা হয়েছে। নতুন রিপোর্ট তৈরি করুন বা অন্য একটি লোড করুন।</p>`);
                toggleReportActionButtonsUI(false);
                lastRenderedReportData = { type: null, data: null, titleInfo: {} };
            }
            showMessageUI(`"${month} ${year}" মাসের রিপোর্ট সফলভাবে মুছে ফেলা হয়েছে এবং আর্থিক পরিসংখ্যান আপডেট করা হয়েছে।`, "success");
        } else {
            console.error("Error deleting report via service:", result.error);
            showMessageUI(`রিপোর্ট মুছতে ব্যর্থ: ${result.error.message || 'অজানা ত্রুটি।'}`, "error", 0);
        }
    }
    catch (error) {
        console.error("Critical error in handleInitiateDeleteReport:", error);
        showMessageUI("রিপোর্ট মোছার সময় একটি গুরুতর ত্রুটি ঘটেছে।", "error", 0);
    } finally {
        showLoadingUI(false);
    }
}


async function handleGenerateAnnualReport() {
    if (!annualReportYearSelect || !annualReportYearSelect.value) { // Updated ID here
        showMessageUI("অনুগ্রহ করে বার্ষিক রিপোর্টের জন্য বছর নির্বাচন করুন।", "error", 0);
        return;
    }
    const yearNum = parseInt(annualReportYearSelect.value); // Updated ID here
    if (isNaN(yearNum) || String(yearNum).length !== 4) {
        showMessageUI("অনুগ্রহ করে একটি সঠিক ৪-সংখ্যার বছর লিখুন।", "error", 0);
        return;
    }
    showLoadingUI(true);
    try {
        const result = await generateAnnualReportData(appInstanceId, yearNum, banglaMonthsForUI);
        if (result.success) {
            const { year, monthlyData, yearlyTotals, startOfYearTotals, endOfYearTotals, isEmpty, memberSummaries } = result.annualReportViewData;
            if (isEmpty) { showMessageUI(`${year} সালের জন্য কোনও রিপোর্ট পাওয়া হয়নি।`, "info"); }
            else { showMessageUI(`${year} সালের বার্ষিক রিপোর্ট সফলভাবে তৈরি হয়েছে।`, "success"); }
            // For annual report, memberSummaries are already derived from active members up to the end of the year.
            // So, simply passing societyMembers (active list) to renderAnnualReportUI is sufficient if needed there,
            // but for rendering annual report, we use memberSummaries provided by generateAnnualReportData.
            renderAnnualReportUI(year, monthlyData, yearlyTotals, startOfYearTotals, endOfYearTotals, memberSummaries);
            lastRenderedReportData = {
                type: 'annual',
                data: { year, monthlyData, yearlyTotals, startOfYearTotals, endOfYearTotals, memberSummaries },
                titleInfo: { associationName: SOCIETY_NAME, year: String(year) }
            };
            toggleReportActionButtonsUI(true);
        } else {
            console.error("Error generating annual report via service:", result.error);
            showMessageUI(`বার্ষিক রিপোর্ট তৈরিতে ব্যর্থ: ${result.error.message}`, "error", 0);
            if (reportOutputDiv) setReportOutputHTML(`<p class="text-gray-400 text-center bengali">বার্ষিক রিপোর্ট তৈরি করা যায়নি।</p>`);
            toggleReportActionButtonsUI(false); lastRenderedReportData = { type: null, data: null, titleInfo: {} };
        }
    } catch (error) {
        console.error("Critical error in handleGenerateAnnualReport:", error);
        showMessageUI("বার্ষিক রিপোর্ট তৈরি করার সময় একটি গুরুতর ত্রুটি ঘটেছে।", "error", 0);
        if (reportOutputDiv) setReportOutputHTML(`<p class="text-gray-400 text-center bengali">বার্ষিক রিপোর্ট তৈরি করা যায়নি।</p>`);
        toggleReportActionButtonsUI(false); lastRenderedReportData = { type: null, data: null, titleInfo: {} };
    } finally { showLoadingUI(false); }
}

async function generateMemberStatementLogic(memberId, memberName) {
    showLoadingUI(true);
    try {
        const result = await generateMemberStatementData(appInstanceId, memberId, banglaMonthsForUI);
        if (result.success) {
            const { transactions } = result.statementData;
            renderMemberStatementUI(memberName, transactions, SOCIETY_NAME);
            lastRenderedReportData = { type: 'memberStatement', data: { memberName, transactions }, titleInfo: { associationName: SOCIETY_NAME, memberName: typeof memberName === 'string' ? memberName : "UnknownMember" } };
            toggleReportActionButtonsUI(true);
            showMessageUI(`${memberName} এর জন্য সদস্য বিবৃতি সফলভাবে তৈরি হয়েছে।`, "success");
        } else {
            console.error("Error generating member statement via service:", result.error);
            showMessageUI(`সদস্যের বিবৃতি তৈরিতে ব্যর্থ: ${result.error.message}`, "error", 0);
            if (reportOutputDiv) setReportOutputHTML(`<p class="text-gray-400 text-center bengali">সদস্যের বিবৃতি তৈরি করা যায়নি।</p>`);
            toggleReportActionButtonsUI(false); lastRenderedReportData = { type: null, data: null, titleInfo: {} };
        }
    } catch (error) {
        console.error("Critical error in generateMemberStatementLogic:", error);
        showMessageUI("সদস্যের বিবৃতি তৈরি করার সময় একটি গুরুতর ত্রুটি ঘটেছে।", "error", 0);
        if (reportOutputDiv) setReportOutputHTML(`<p class="text-gray-400 text-center bengali">সদস্যের বিবৃতি তৈরি করা যায়নি।</p>`);
        toggleReportActionButtonsUI(false); lastRenderedReportData = { type: null, data: null, titleInfo: {} };
    } finally { showLoadingUI(false); }
}

async function handleViewMemberStatementFromList(memberId, memberName) {
    if (!memberId || !memberName) {
        showMessageUI("সদস্য নির্বাচন করা হয়নি।", "error", 0);
        return;
    }
    await generateMemberStatementLogic(memberId, memberName);
    const reportOutputContainerElement = document.getElementById('reportOutputContainer');
    if (reportOutputContainerElement) {
        reportOutputContainerElement.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
}

function handlePrintReport() {
    const reportOutputElement = document.getElementById('reportOutput');
    if (!reportOutputElement || !reportOutputElement.innerHTML.includes("<table")) {
        showMessageUI("প্রিন্ট করার জন্য প্রথমে একটি রিপোর্ট প্রদর্শন করুন।", "error", 0);
        return;
    }
    window.print();
}

async function handleExportAllData() {
    if (!appInstanceId) {
        showMessageUI("অ্যাপ্লিকেশন সঠিকভাবে শুরু হয়নি। অনুগ্রহ করে পৃষ্ঠাটি রিফ্রেশ করুন।", "error", 0);
        return;
    }
    showLoadingUI(true);
    showMessageUI("সকল ডেটা এক্সপোর্ট করা হচ্ছে...", "info");
    try {
        const allData = await fetchAllDataForExportFS(appInstanceId);

        if (allData) {
            exportAllDataToJson(allData, showMessageUI, appInstanceId);
        } else {
            throw new Error("এক্সপোর্ট করার জন্য কোনও ডেটা পাওয়া যায়নি।");
        }
    } catch (error) {
        console.error("Error exporting all data:", error);
        showMessageUI(`সকল ডেটা এক্সপোর্ট করতে ব্যর্থ: ${error.message}`, "error", 0);
    } finally {
        showLoadingUI(false);
    }
}


async function handleResetAllApplicationData() {
    const confirmMsg1 = `গুরুত্বপূর্ণ: সকল ডেটা মোছার আগে, আপনার রেকর্ডের জন্য একটি ব্যাকআপ (JSON এক্সপোর্ট) ডাউনলোড করার পরামর্শ দেওয়া হচ্ছে।\n\nআপনি কি নিশ্চিত যে আপনি সমস্ত ডেটা রিসেট করতে চান? এর মধ্যে সমস্ত সদস্য, রিপোর্ট এবং ক্রমসঞ্চিত পরিসংখ্যান অন্তর্ভুক্ত রয়েছে। এই পদক্ষেপটি স্থায়ীভাবে সমস্ত ডেটা মুছে ফেলবে!`;
    const confirmed1 = await showConfirmModalUI("সব ডেটা রিসেট করুন", confirmMsg1, "হ্যাঁ, রিসেট করুন", "বাতিল করুন");

    if (!confirmed1) {
        showMessageUI("ডেটা রিসেট বাতিল করা হয়েছে।", "info"); return;
    }

    const confirm2Text = appInstanceId.slice(-6);
    const confirm2 = await showPromptModalUI(
        "চূড়ান্ত নিশ্চিতকরণ",
        `এটি আপনার চূড়ান্ত সুযোগ। রিসেট করলে এই অ্যাপ ইনস্ট্যান্সের (${appInstanceId}) জন্য সংরক্ষিত সমস্ত ডেটা মুছে যাবে। আপনি কি সত্যিই এগিয়ে যেতে চান? নিশ্চিত করতে "${confirm2Text}" টাইপ করুন:`,
        confirm2Text, // Placeholder for prompt input
        "জমা দিন",
        "বাতিল করুন"
    );

    if (confirm2 !== confirm2Text) {
        showMessageUI("নিশ্চিতকরণ টেক্সট মেলেনি। ডেটা রিসেট বাতিল করা হয়েছে।", "warning", 0); return;
    }

    showLoadingUI(true); showMessageUI("সমস্ত ডেটা রিসেট করা হচ্ছে... অনুগ্রহ করে অপেক্ষা করুন।", "info", 0);
    try {
        await deleteAllMembersFS(appInstanceId);
        await deleteAllReportsFS(appInstanceId);
        await deleteCumulativeTotalsFS(appInstanceId);

        currentReportEntries = []; societyMembers.clear(); cumulativeTotals = { savings: 0, loan: 0 }; lastRenderedReportData = { type: null, data: null, titleInfo: {} };

        renderCurrentReportEntriesPreviewUI(currentReportEntries, handleDeleteSingleReportEntry);
        renderSocietyMembersListUI(societyMembers, handleDeleteMember, handleViewMemberStatementFromList);
        updateReportMemberDropdown();
        updateOverallFinancialStatusDisplayUI(cumulativeTotals, societyMembers.size);
        const reports = await fetchAllReportsMetadataFS(appInstanceId);
        populatePreviousReportsDropdownUI(reports, handleLoadPreviousReportFromList, handleInitiateEditReport, handleInitiateDeleteReport);
        setReportOutputHTML(`<p class="text-gray-400 text-center bengali">রিপোর্ট তৈরি হওয়ার পর এখানে প্রদর্শিত হবে।</p>`);
        toggleReportActionButtonsUI(false);
        showMessageUI("সমস্ত ডেটা সফলভাবে রিসেট করা হয়েছে।", "success");
    } catch (error) {
        console.error("Error resetting all data:", error);
        showMessageUI(`ডেটা রিসেট করতে ব্যর্থ: ${error.message}`, "error", 0);
        await loadInitialData();
    } finally { showLoadingUI(false); }
}

// --- Attach Event Listeners ---
if (addSocietyMemberBtn) addSocietyMemberBtn.addEventListener('click', handleAddSocietyMember);
if (addMemberToReportBtn) addMemberToReportBtn.addEventListener('click', handleAddMemberToReport);
if (clearCurrentReportEntriesBtn) clearCurrentReportEntriesBtn.addEventListener('click', handleClearCurrentReportEntries);
if (cancelEditReportBtn) cancelEditReportBtn.addEventListener('click', resetEditMode); // New Listener
if (generateReportBtn) generateReportBtn.addEventListener('click', handleGenerateReport);
if (generateAnnualReportBtn) generateAnnualReportBtn.addEventListener('click', handleGenerateAnnualReport);
if (downloadPdfBtn) {
    downloadPdfBtn.addEventListener('click', () => {
        const reportOutputElement = document.getElementById('reportOutput');
        const reportActionButtons = document.getElementById('reportActionButtons');
        if (lastRenderedReportData && lastRenderedReportData.type && reportOutputElement) {
            exportToPdf(lastRenderedReportData, reportOutputElement, reportActionButtons, showMessageUI, { jsPDF: window.jspdf, html2canvas: window.html2canvas });
        } else { showMessageUI("পিডিএফ এক্সপোর্ট করার জন্য প্রথমে একটি রিপোর্ট তৈরি করুন বা লোড করুন।", "info"); }
    });
}
if (exportCsvBtn) {
    exportCsvBtn.addEventListener('click', () => {
        if (lastRenderedReportData && lastRenderedReportData.type) {
            exportToCsv(lastRenderedReportData, showMessageUI);
        } else { showMessageUI("CSV এক্সপোর্ট করার জন্য প্রথমে একটি রিপোর্ট তৈরি করুন বা লোড করুন।", "info"); }
    });
}
if (printReportBtn) printReportBtn.addEventListener('click', handlePrintReport);
if (resetAllDataBtn) resetAllDataBtn.addEventListener('click', handleResetAllApplicationData);
if (exportAllDataBtn) exportAllDataBtn.addEventListener('click', handleExportAllData);
