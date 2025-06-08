// js/main.js (Orchestrator with All UI/Feature Updates)
import {
    initializeFirebase, fetchSocietyMembersFS,
    fetchCumulativeTotalsFS, fetchAllReportsMetadataFS,
    recalculateTotalsAfterDeletionFS,
    deleteAllMembersFS, deleteAllReportsFS, deleteCumulativeTotalsFS,
    fetchAllDataForExportFS
} from './firebaseService.js';

import {
    showFirebaseConfigSectionUI, showMessageUI, showInlineMessageUI,
    toggleInputSectionsVisibility,      // Now only controls inputFormsSection
    toggleReportOutputVisibility,       // Controls reportOutputContainer
    toggleAppSettingsVisibility,        // Controls appSettingsAndDataManagementSection
    toggleAdditionalReportsVisibility,  // Controls additionalReportsSection
    renderSocietyMembersListUI,
    populateReportEntryMemberDropdownUI,
    populateMonthDropdownUI,
    populateYearDropdownUI,
    renderCurrentReportEntriesPreviewUI,
    updateOverallFinancialStatusDisplayUI,
    updateCurrentDateDisplayUI,
    renderReportToHtmlUI, populatePreviousReportsDropdownUI, setReportOutputHTML,
    renderAnnualReportUI,
    populateStatementMemberDropdownUI, renderMemberStatementUI,
    toggleReportActionButtonsUI,
    showConfirmModalUI,
    showPromptModalUI,
    renderFinancialChartUI // <-- IMPORT for Charting
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
    getMemberNetLoanAsOfDate,
    generateMemberDistributionDataForYear // <-- NEW IMPORT for Pie/Donut Charts
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
    if (displayAppId) {
        displayAppId.textContent = appInstanceId;
    }
    if (currentAppInstanceIdDisplay) { // Update the new display element
        currentAppInstanceIdDisplay.textContent = appInstanceId;
    }
    showMessageUI(`অ্যাপ ইনস্ট্যান্স আইডি "${appInstanceId}" লোড করা হয়েছে। ডেটা রিফ্রেশ করা হচ্ছে...`, "info");
    await loadInitialData(); // Reload all data for the new instance ID
}


let currentReportEntries = [];
let societyMembers = new Map(); // Stores active members (id -> name map)
let cumulativeTotals = { savings: 0, loan: 0 };
let lastRenderedReportData = { type: null, data: null, titleInfo: {} };
let editingReportId = null;
let editingReportOriginalTotals = null;
let selectedBatchMembers = new Map(); // New: To store members selected for batch entry (memberId -> memberName)
let selectedSingleMemberId = null; // New: To store the ID of the member selected in the single entry dropdown

const banglaMonthsForUI = [
    "জানুয়ারি", "ফেব্রুয়ারি", "মার্চ", "এপ্রিল", "মে", "জুন",
    "জুলাই", "আগস্ট", "সেপ্টেম্বর", "অক্টোবর", "নভেম্বর", "ডিসেম্বর"
];

// --- DOM Elements ---
const firebaseConfigInput = document.getElementById('firebaseConfigInput');
const saveFirebaseConfigBtn = document.getElementById('saveFirebaseConfigBtn');
const displayAppId = document.getElementById('displayAppId');
const currentAppInstanceIdDisplay = document.getElementById('currentAppInstanceIdDisplay');
const appInstanceIdInput = document.getElementById('appInstanceIdInput');
const loadAppInstanceIdBtn = document.getElementById('loadAppInstanceIdBtn');
const copyAppInstanceIdBtn = document.getElementById('copyAppInstanceIdBtn');

// Main app title element
const mainAppTitle = document.getElementById('mainAppTitle');


const reportMonthSelect = document.getElementById('reportMonthSelect');
const reportYearSelect = document.getElementById('reportYearSelect');

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
const discardMonthYearBtn = document.getElementById('discardMonthYearBtn');

// New UI Elements for Close button and Scroll-to-Top
const closeReportViewBtn = document.getElementById('closeReportViewBtn');
const scrollToTopBtn = document.getElementById('scrollToTopBtn');

// New UI element for member search
const memberSearchInput = document.getElementById('memberSearchInput');

// New UI Elements for Batch Entry
const batchSavingsInput = document.getElementById('batchSavings');
const batchSavingsWithdrawalInput = document.getElementById('batchSavingsWithdrawal');
const batchLoanDisbursedInput = document.getElementById('batchLoanDisbursed');
const batchLoanRepaymentInput = document.getElementById('batchLoanRepayment');
const addBatchToReportBtn = document.getElementById('addBatchToReportBtn');
const batchEntrySection = document.getElementById('batchEntrySection');


const previousReportsListContainer = document.getElementById('previousReportsListContainer');

const reportOutputDiv = document.getElementById('reportOutput');
const reportOutputContainer = document.getElementById('reportOutputContainer');

const annualReportYearSelect = document.getElementById('annualReportYearSelect');
const generateAnnualReportBtn = document.getElementById('generateAnnualReportBtn');

// --- CHART-RELATED DOM ELEMENTS ---
const chartYearSelect = document.getElementById('chartYearSelect');
const generateChartBtn = document.getElementById('generateChartBtn');


const resetAllDataBtn = document.getElementById('resetAllDataBtn');
const exportAllDataBtn = document.getElementById('exportAllDataBtn');

const appSettingsAndDataManagementSection = document.getElementById('appSettingsAndDataManagement');

// Get direct references to the main input sections that need to be toggled
const memberManagementSection = document.getElementById('memberManagementSection');
const reportCreationSection = document.getElementById('reportCreationSection');
const singleEntrySection = document.getElementById('singleEntrySection');
const currentReportEntriesPreviewSection = document.getElementById('currentReportEntriesPreviewSection');
const mainDashboardSection = document.getElementById('mainDashboardSection');


if (displayAppId) {
    displayAppId.textContent = appInstanceId;
}
if (currentAppInstanceIdDisplay) {
    currentAppInstanceIdDisplay.textContent = appInstanceId;
}

/**
 * Unlocks the month and year selectors for a new report without clearing entries.
 * This is a "soft reset" of the date selection only.
 */
function unlockMonthYearForNewReport() {
    if (reportMonthSelect) reportMonthSelect.disabled = false;
    if (reportYearSelect) reportYearSelect.disabled = false;
    if (discardMonthYearBtn) discardMonthYearBtn.classList.add('hidden'); // Hide the button itself
    showInlineMessageUI("মাস ও বছর পরিবর্তন করার জন্য আনলক করা হয়েছে।", "info");
}


// --- Helper function to reset edit mode (and discard entries) ---
// This function acts as the "return to homepage" or "clear report view"
/**
 * Resets the UI from an editing state.
 * @param {boolean} [keepReportVisible=false] - If true, resets the form but keeps the report output visible.
 */
// FIX 1: Added 'keepReportVisible' parameter to prevent hiding the report after an update.
function resetEditMode(keepReportVisible = false) {
    editingReportId = null;
    editingReportOriginalTotals = null;
    if (generateReportBtn) {
        generateReportBtn.textContent = "রিপোর্ট তৈরি ও সংরক্ষণ করুন";
        generateReportBtn.classList.remove('theme-button-accent');
        generateReportBtn.classList.add('theme-button-success-lg');
    }
    // Unlock month and year selectors
    if (reportMonthSelect) reportMonthSelect.disabled = false;
    if (reportYearSelect) reportYearSelect.disabled = false;
    // Hide cancel and discard buttons
    if (cancelEditReportBtn) cancelEditReportBtn.classList.add('hidden');
    if (discardMonthYearBtn) discardMonthYearBtn.classList.add('hidden');
    
    currentReportEntries = []; // Clear entries on discard/cancel
    renderCurrentReportEntriesPreviewUI(currentReportEntries, handleDeleteSingleReportEntry);
    updateReportMemberDropdown(); // Re-populate single entry dropdown
    
    // Clear batch selections and re-enable all checkboxes
    selectedBatchMembers.clear();
    const currentSearchTerm = memberSearchInput ? memberSearchInput.value.toLowerCase() : '';
    // Pass currentReportEntries.map(entry => entry.memberId) to ensure checkboxes are re-enabled correctly
    renderSocietyMembersListUI(societyMembers, handleDeleteMember, handleViewMemberStatementFromList, currentSearchTerm, selectedBatchMembers, selectedSingleMemberId, currentReportEntries.map(entry => entry.memberId));
    
    // Clear batch input fields
    if (batchSavingsInput) batchSavingsInput.value = '';
    if (batchSavingsWithdrawalInput) batchSavingsWithdrawalInput.value = '';
    if (batchLoanDisbursedInput) batchLoanDisbursedInput.value = '';
    if (batchLoanRepaymentInput) batchLoanRepaymentInput.value = '';

    // Collapse batch entry section
    if (batchEntrySection) {
        batchEntrySection.open = false; // Ensure it's collapsed
    }

    // Conditionally hide the report output and reset the main UI layout
    if (!keepReportVisible) {
        setReportOutputHTML(`<p class="text-center bengali theme-text-muted">রিপোর্ট তৈরি হওয়ার পর এখানে প্রদর্শিত হবে।</p>`);
        toggleReportActionButtonsUI(false);
        lastRenderedReportData = { type: null, data: null, titleInfo: {} };

        toggleInputSectionsVisibility(true);     // Show input forms
        toggleAdditionalReportsVisibility(true); // Show additional reports section
        toggleReportOutputVisibility(false);     // Hide the report display section
        toggleAppSettingsVisibility(true);       // Show app settings section
    }
}


// --- Initialization Flow ---
async function handleFirebaseInitialization(config) {
    showMessageUI("ফায়ারবেস সংযোগ করা হচ্ছে...", "info", 2000); // Inline feedback
    const { success, error } = await initializeFirebase(config);
    if (success) {
        showInlineMessageUI("ফায়ারবেস সফলভাবে সংযুক্ত হয়েছে!", "success", 2000);
        showFirebaseConfigSectionUI(false); // This hides the Firebase config section itself

        // Set initial visibility for "homepage" view
        if (mainDashboardSection) mainDashboardSection.classList.remove('hidden'); // Ensure dashboard is visible
        toggleInputSectionsVisibility(true);     // Show input forms
        toggleAdditionalReportsVisibility(true); // Show additional reports section
        toggleReportOutputVisibility(false);     // Hide report output initially
        toggleAppSettingsVisibility(true);       // Show app settings
        

        populateMonthDropdownUI();
        // Populate year dropdowns on initialization
        const currentYear = new Date().getFullYear();
        populateYearDropdownUI(reportYearSelect, currentYear - 10, currentYear + 5, currentYear); // For monthly report
        populateYearDropdownUI(annualReportYearSelect, currentYear - 10, currentYear + 5, currentYear); // For annual report
        populateYearDropdownUI(chartYearSelect, currentYear - 10, currentYear + 5, currentYear); // For chart
        
        updateCurrentDateDisplayUI();
        await loadInitialData();
    } else {
        console.error("Firebase Initialization Error in main: ", error);
        showMessageUI(`ফায়ারবেস সংযোগ ব্যর্থ হয়েছে: ${error.message || 'Unknown error'}. কনফিগ এবং নেটওয়ার্ক পরীক্ষা করুন।`, "error", 0);
        if (firebaseConfigInput) firebaseConfigInput.value = '';
        localStorage.removeItem(`firebaseConfig_${appInstanceId}`);
        updateCurrentDateDisplayUI();
    }
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
            populateYearDropdownUI(chartYearSelect, currentYear - 10, currentYear + 5, currentYear); // For chart
        }
    } else {
        console.log("No Firebase config found. Please enter manually.");
        showFirebaseConfigSectionUI(true);
        populateMonthDropdownUI();
        // Populate year dropdowns if no config found
        const currentYear = new Date().getFullYear();
        populateYearDropdownUI(reportYearSelect, currentYear - 10, currentYear + 5, currentYear);
        populateYearDropdownUI(annualReportYearSelect, currentYear - 10, currentYear + 5, currentYear);
        populateYearDropdownUI(chartYearSelect, currentYear - 10, currentYear + 5, currentYear); // For chart
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

    // Initial check for scroll to top button visibility
    if (window.scrollY > 200) { // Show if scrolled more than 200px
        scrollToTopBtn.classList.add('opacity-100', 'visible');
    } else {
        scrollToTopBtn.classList.remove('opacity-100', 'visible');
    }

    // Scroll-to-top button visibility logic
    window.addEventListener('scroll', () => {
        if (window.scrollY > 200) {
            if (scrollToTopBtn.classList.contains('invisible')) {
                scrollToTopBtn.classList.remove('invisible', 'opacity-0');
                scrollToTopBtn.classList.add('opacity-100', 'visible');
            }
        } else {
            if (scrollToTopBtn.classList.contains('visible')) {
                scrollToTopBtn.classList.remove('opacity-100', 'visible');
                scrollToTopBtn.classList.add('opacity-0', 'invisible');
            }
        }
    });

    // Scroll-to-top button click handler
    if (scrollToTopBtn) {
        scrollToTopBtn.addEventListener('click', () => {
            window.scrollTo({
                top: 0,
                behavior: 'smooth'
            });
        });
    }

    // Member Search Input Listener
    if (memberSearchInput) {
        memberSearchInput.addEventListener('input', () => {
            const searchTerm = memberSearchInput.value.toLowerCase();
            // Pass currentReportEntries.map(entry => entry.memberId) to update member list checkboxes
            renderSocietyMembersListUI(societyMembers, handleDeleteMember, handleViewMemberStatementFromList, searchTerm, selectedBatchMembers, selectedSingleMemberId, currentReportEntries.map(entry => entry.memberId));
        });
    }

    // Listener for single member select dropdown to update selectedSingleMemberId and refresh member list
    if (reportMemberNameSelect) {
        reportMemberNameSelect.addEventListener('change', () => {
            selectedSingleMemberId = reportMemberNameSelect.value;
            const currentSearchTerm = memberSearchInput ? memberSearchInput.value.toLowerCase() : '';
            // Pass currentReportEntries.map(entry => entry.memberId) to update member list checkboxes
            renderSocietyMembersListUI(societyMembers, handleDeleteMember, handleViewMemberStatementFromList, currentSearchTerm, selectedBatchMembers, selectedSingleMemberId, currentReportEntries.map(entry => entry.memberId));
        });
    }

    // Event listener for main app title to return to homepage
    if (mainAppTitle) {
        mainAppTitle.addEventListener('click', resetEditMode);
    }
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
        showInlineMessageUI("আইডি লোড করা হচ্ছে...", "info", 1500); // Inline feedback
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

        const currentSearchTerm = memberSearchInput ? memberSearchInput.value.toLowerCase() : '';
        // Pass currentReportEntries.map(entry => entry.memberId) to update member list checkboxes
        renderSocietyMembersListUI(societyMembers, handleDeleteMember, handleViewMemberStatementFromList, currentSearchTerm, selectedBatchMembers, selectedSingleMemberId, currentReportEntries.map(entry => entry.memberId));
        
        updateReportMemberDropdown();

        cumulativeTotals = await fetchCumulativeTotalsFS(appInstanceId);
        updateOverallFinancialStatusDisplayUI(cumulativeTotals, societyMembers.size);

        const reports = await fetchAllReportsMetadataFS(appInstanceId);
        populatePreviousReportsDropdownUI(reports, handleLoadPreviousReportFromList, handleInitiateEditReport, handleInitiateDeleteReport);
        showInlineMessageUI("ডেটা লোড হয়েছে!", "info", 2000); // Changed to inline message

    } catch (error) {
        console.error("Error loading initial data in main.js:", error);
        showMessageUI("Firestore থেকে প্রাথমিক ডেটা লোad করতে ব্যর্থ।", "error", 0);
    } finally {
        // Any final actions that don't need a spinner
    }
}

// --- Event Listener Callbacks & Core Logic ---

// Event listener for member selection checkbox (delegated to document)
document.addEventListener('change', (event) => {
    if (event.target.matches('.member-select-checkbox')) {
        const checkbox = event.target;
        const memberId = checkbox.value;
        const memberName = checkbox.dataset.memberName; // Get member name from data attribute

        // Get current report entries to update the disabled state accurately
        const currentEntryMemberIds = currentReportEntries.map(entry => entry.memberId);

        if (checkbox.checked) {
            selectedBatchMembers.set(memberId, memberName);
        } else {
            selectedBatchMembers.delete(memberId);
        }
        // Re-render member dropdown and member list to ensure disabled states are correct
        updateReportMemberDropdown();
        const currentSearchTerm = memberSearchInput ? memberSearchInput.value.toLowerCase() : '';
        renderSocietyMembersListUI(societyMembers, handleDeleteMember, handleViewMemberStatementFromList, currentSearchTerm, selectedBatchMembers, selectedSingleMemberId, currentEntryMemberIds);
    }
});


async function handleAddSocietyMember() {
    if (!newSocietyMemberNameInput) return;
    const name = newSocietyMemberNameInput.value;

    showMessageUI("সদস্য যুক্ত করা হচ্ছে...", "info", 1500); // Inline feedback
    const result = await addMember(appInstanceId, name, societyMembers);

    if (result.success) {
        societyMembers.set(result.newMemberId, result.memberName);
        const currentSearchTerm = memberSearchInput ? memberSearchInput.value.toLowerCase() : '';
        // Pass currentReportEntries.map(entry => entry.memberId) to update member list checkboxes
        renderSocietyMembersListUI(societyMembers, handleDeleteMember, handleViewMemberStatementFromList, currentSearchTerm, selectedBatchMembers, selectedSingleMemberId, currentReportEntries.map(entry => entry.memberId));
        
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
}

async function handleDeleteMember(memberId, memberNameFromUI) {
    const memberNameToConfirm = societyMembers.get(memberId) || memberNameFromUI;
    const confirmationMessage = `আপনি কি সদস্য "${memberNameToConfirm}" কে মুছে ফেলতে চান? এই পদক্ষেপটি পূর্বাবস্থায় ফেরানো যাবে না এবং তাদের পূর্ববর্তী লেনদেনগুলি সমিতির মোট হিসাব থেকে বাদ দেওয়া হবে।`;

    const confirmed = await showConfirmModalUI("সদস্য মুছুন", confirmationMessage, "মুছুন", "বাতিল করুন");

    if (confirmed) {
        showMessageUI(`সদস্য "${memberNameToConfirm}" মুছে ফেলা হচ্ছে...`, "info", 3000);
        try {
            const deleteResult = await deleteMemberFromService(appInstanceId, memberId);

            if (!deleteResult.success) {
                throw deleteResult.error || new Error("সদস্য ডকুমেন্ট মুছতে ব্যর্থ।");
            }
            const oldMemberNameForMessage = societyMembers.get(memberId) || memberNameToConfirm;
            societyMembers.delete(memberId);
            selectedBatchMembers.delete(memberId); // Remove from batch selection if deleted
            if (selectedSingleMemberId === memberId) { // If the deleted member was selected in single entry
                selectedSingleMemberId = null;
                if (reportMemberNameSelect) reportMemberNameSelect.value = '';
            }


            currentReportEntries = currentReportEntries.filter(entry => entry.memberId !== memberId);
            renderCurrentReportEntriesPreviewUI(currentReportEntries, handleDeleteSingleReportEntry);

            let totalSavingsFromDeleted = 0;
            let totalLoanFromDeleted = 0;
            const allReports = await fetchAllReportsMetadataFS(appInstanceId);
            
            allReports.forEach(report => {
                if (report.entries && Array.isArray(report.entries)) {
                    report.entries.forEach(entry => {
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

            if (totalSavingsFromDeleted !== 0 || totalLoanFromDeleted !== 0) {
                showMessageUI("আর্থিক পরিসংখ্যান পুনরায় গণনা করা হচ্ছে...", "info", 3000);
                const updatedTotals = await recalculateTotalsAfterDeletionFS(appInstanceId, totalSavingsFromDeleted, totalLoanFromDeleted);
                cumulativeTotals = updatedTotals;
                showInlineMessageUI(`সদস্য "${oldMemberNameForMessage}" এর ঐতিহাসিক লেনদেন (নেট সঞ্চয়: ${totalSavingsFromDeleted.toFixed(2)}, নেট ঋণ: ${totalLoanFromDeleted.toFixed(2)}) ক্রমসঞ্চিত মোট থেকে বাদ দেওয়া হয়েছে।`, "success", 7000); // Auto-dismiss
            } else {
                showMessageUI(`সদস্য "${oldMemberNameForMessage}" সফলভাবে মুছে ফেলা হয়েছে।`, "success", 3000); // Auto-dismiss
            }

            const currentSearchTerm = memberSearchInput ? memberSearchInput.value.toLowerCase() : '';
            // Pass currentReportEntries.map(entry => entry.memberId) to update member list checkboxes
            renderSocietyMembersListUI(societyMembers, handleDeleteMember, handleViewMemberStatementFromList, currentSearchTerm, selectedBatchMembers, selectedSingleMemberId, currentReportEntries.map(entry => entry.memberId));
            
            updateReportMemberDropdown();
            updateOverallFinancialStatusDisplayUI(cumulativeTotals, societyMembers.size);
            
            const reportsForDropdown = await fetchAllReportsMetadataFS(appInstanceId);
            populatePreviousReportsDropdownUI(reportsForDropdown, handleLoadPreviousReportFromList, handleInitiateEditReport, handleInitiateDeleteReport);


        } catch (error) {
            console.error("Error in handleDeleteMember:", error);
            const memberNameForErrorMessage = societyMembers.get(memberId) || memberNameToConfirm;
            showMessageUI(`সদস্য "${memberNameForErrorMessage}" কে মুছতে বা পরিসংখ্যান পুনরায় গণনা করতে ব্যর্থ: ${error.message}`, "error", 0);
            await loadInitialData(); // Attempt to reload data to restore consistent state
        } finally {
            // Nothing needed here now that showLoadingUI is removed
        }
    } else {
        showMessageUI("সদস্য মোছা বাতিল করা হয়েছে।", "info");
    }
}


async function handleAddMemberToReport() {
    if (!reportMemberNameSelect) {
        showMessageUI("প্রয়োজনীয় ইনপুট উপাদান এক বা একাধিক পাওয়া যায়নি। অনুগ্রহ করে পৃষ্ঠাটি রিফ্রেশ করুন অথবা অ্যাডমিনকে জানান।", "error", 0);
        return;
    }

    const memberId = reportMemberNameSelect.value;
    if (!memberId) {
        showMessageUI("রিপোর্টে যুক্ত করার জন্য অনুগ্রহ করে একজন সদস্য নির্বাচন করুন।", "error", 0);
        return;
    }
    // For single entry, prevent adding if already in current report
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

    // --- Chronological Validation for Withdrawals and Loan Repayments ---
    const reportMonthString = reportMonthSelect.value;
    const reportYearString = reportYearSelect.value;
    const reportYearNumber = parseInt(reportYearString);
    const reportMonthIndex = banglaMonthsForUI.indexOf(reportMonthString);

    if (isNaN(reportYearNumber) || reportMonthIndex === -1) {
        showMessageUI("রিপোর্টের মাস বা বছর অবৈধ।", "error", 0);
        return;
    }

    const reportDate = new Date(reportYearNumber, reportMonthIndex, 1);

    if (savingsWithdrawal > 0) {
        showInlineMessageUI("সঞ্চয় ব্যালেন্স চেক করা হচ্ছে...", "info", 1500);
        const memberNetSavingsAsOfReportDate = await getMemberNetSavingsAsOfDate(appInstanceId, memberId, reportDate);

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
        showInlineMessageUI("ঋণ ব্যালেন্স চেক করা হচ্ছে...", "info", 1500);
        const memberOutstandingLoanAsOfReportDate = await getMemberNetLoanAsOfDate(appInstanceId, memberId, reportDate);

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
    updateReportMemberDropdown(); // Re-populate single entry dropdown
    showInlineMessageUI(`"${memberName}" এর জন্য এন্ট্রি বর্তমান রিপোর্টে যুক্ত হয়েছে।`, "success", 1500);

    // Clear single entry inputs
    memberSavingsInput.value = '';
    memberSavingsWithdrawalInput.value = '';
    memberLoanDisbursedInput.value = '';
    memberLoanRepaymentInput.value = '';
    if (reportMemberNameSelect) reportMemberNameSelect.value = ''; // Clear selected member from dropdown
    selectedSingleMemberId = null; // Clear selected single member
    // Re-render member list to update disabled states based on new entry
    const currentSearchTerm = memberSearchInput ? memberSearchInput.value.toLowerCase() : '';
    renderSocietyMembersListUI(societyMembers, handleDeleteMember, handleViewMemberStatementFromList, currentSearchTerm, selectedBatchMembers, selectedSingleMemberId, currentReportEntries.map(entry => entry.memberId));

    if (reportMemberNameSelect) reportMemberNameSelect.focus();

    // If this is the first entry, lock month/year selectors and show discard button
    if (currentReportEntries.length === 1 && !editingReportId) {
        if (reportMonthSelect) reportMonthSelect.disabled = true;
        if (reportYearSelect) reportYearSelect.disabled = true;
        if (discardMonthYearBtn) discardMonthYearBtn.classList.remove('hidden'); // Show discard button
    }
}

// Rewritten handleAddBatchToReport function for batch update/add
async function handleAddBatchToReport() {
    if (selectedBatchMembers.size === 0) {
        showMessageUI("ব্যাচ এন্ট্রির জন্য কোনো সদস্য নির্বাচন করা হয়নি।", "error", 0);
        return;
    }
    if (!reportMonthSelect || !reportYearSelect) {
        showMessageUI("রিপোর্টের মাস বা বছর নির্বাচন করা হয়নি।", "error", 0);
        return;
    }

    const batchSavings = parseFloat(batchSavingsInput.value) || 0;
    const batchSavingsWithdrawal = parseFloat(batchSavingsWithdrawalInput.value) || 0;
    const batchLoanDisbursed = parseFloat(batchLoanDisbursedInput.value) || 0;
    const batchLoanRepayment = parseFloat(batchLoanRepaymentInput.value) || 0;

    if (batchSavings < 0 || batchSavingsWithdrawal < 0 || batchLoanDisbursed < 0 || batchLoanRepayment < 0) {
        showMessageUI("টাকার পরিমাণ ঋণাত্মক হতে পারবে না।", "error", 0);
        return;
    }

    if (batchSavings === 0 && batchSavingsWithdrawal === 0 &&
        batchLoanDisbursed === 0 && batchLoanRepayment === 0) {
        showMessageUI("ব্যাচ এন্ট্রির জন্য কমপক্ষে একটি টাকার পরিমাণ ইনপুট করুন।", "warning", 0);
        return;
    }

    const reportMonthString = reportMonthSelect.value;
    const reportYearString = reportYearSelect.value;
    const reportYearNumber = parseInt(reportYearString);
    const reportMonthIndex = banglaMonthsForUI.indexOf(reportMonthString);
    const reportDate = new Date(reportYearNumber, reportMonthIndex, 1);

    let membersAddedCount = 0; // Renamed for clarity, tracks truly *new* entries
    let membersSkippedCount = 0;
    let insufficientFundsMembers = [];
    let insufficientLoanMembers = [];
    let alreadyInReportMembers = [];
    let singleSelectedConflictMembers = [];

    // Temporarily disable batch button during processing
    if (addBatchToReportBtn) addBatchToReportBtn.disabled = true;
    showInlineMessageUI("ব্যাচ এন্ট্রি প্রক্রিয়া করা হচ্ছে...", "info", 0); // Show processing message

    // --- Pre-calculate total loan disbursement for the batch for cash validation ---
    let totalBatchLoanDisbursedAttempted = 0;
    selectedBatchMembers.forEach(() => {
        totalBatchLoanDisbursedAttempted += batchLoanDisbursed;
    });

    // Calculate current total loan disbursement from existing entries in the draft report
    const currentDraftLoanDisbursed = currentReportEntries.reduce((sum, entry) => sum + (Number(entry.loanDisbursed) || 0), 0);

    // Check overall cash availability for the entire batch loan disbursement BEFORE processing
    const cashOnHand = (cumulativeTotals.savings || 0) - (cumulativeTotals.loan || 0);
    const projectedTotalLoanForThisReport = currentDraftLoanDisbursed + totalBatchLoanDisbursedAttempted;

    if (batchLoanDisbursed > 0 && projectedTotalLoanForThisReport > cashOnHand) {
        showMessageUI(
            `সমিতির হাতে (${cashOnHand.toFixed(2)} টাকা) এই ব্যাচ ঋণ বিতরণের জন্য পর্যাপ্ত তহবিল নেই। ` +
            `এই রিপোর্টে ইতিমধ্যে বিতরণ করার জন্য প্রস্তাবিত ঋণ (${currentDraftLoanDisbursed.toFixed(2)}) ` +
            `এবং এই ব্যাচ এন্ট্রির ঋণ (${totalBatchLoanDisbursedAttempted.toFixed(2)}) সহ মোট ঋণ দাঁড়াবে ${projectedTotalLoanForThisReport.toFixed(2)} টাকা।`,
            "error",
            0
        );
        if (addBatchToReportBtn) addBatchToReportBtn.disabled = false;
        return; // Halt batch operation if overall cash is insufficient
    }

    for (const [memberId, memberName] of selectedBatchMembers.entries()) {
        let entryToProcess = {
            memberId,
            memberName,
            savings: batchSavings,
            savingsWithdrawal: batchSavingsWithdrawal,
            loanDisbursed: batchLoanDisbursed,
            loanRepayment: batchLoanRepayment
        };

        let skipMember = false;

        // 1. Check for single selected member conflict
        if (memberId === selectedSingleMemberId) {
            singleSelectedConflictMembers.push(memberName);
            skipMember = true;
        }

        // 2. Check if member already has an entry in currentReportEntries
        const existingEntryIndex = currentReportEntries.findIndex(entry => entry.memberId === memberId);
        if (existingEntryIndex !== -1) {
            alreadyInReportMembers.push(memberName);
            skipMember = true; // Mark to skip for batch
        }


        // --- Chronological Validation for Withdrawals and Loan Repayments ---
        if (batchSavingsWithdrawal > 0 && !skipMember) {
            const memberNetSavingsAsOfReportDate = await getMemberNetSavingsAsOfDate(appInstanceId, memberId, reportDate);
            if (memberNetSavingsAsOfReportDate === null) {
                showMessageUI(`সদস্যের সঞ্চয় হিসাব করতে ত্রুটি হয়েছে: ${memberName}।`, "error", 0);
                membersSkippedCount++;
                skipMember = true; // Flag to skip this member
            } else if (batchSavingsWithdrawal > memberNetSavingsAsOfReportDate) {
                insufficientFundsMembers.push(memberName);
                skipMember = true; // Flag to skip this member
            }
        }

        if (batchLoanRepayment > 0 && !skipMember) { // Only check if not already skipped
            const memberOutstandingLoanAsOfReportDate = await getMemberNetLoanAsOfDate(appInstanceId, memberId, reportDate);
            if (memberOutstandingLoanAsOfReportDate === null) {
                showMessageUI(`সদস্যের ঋণ হিসাব করতে ত্রুটি হয়েছে: ${memberName}।`, "error", 0);
                membersSkippedCount++;
                skipMember = true;
            } else if (memberOutstandingLoanAsOfReportDate <= 0 || batchLoanRepayment > memberOutstandingLoanAsOfReportDate) {
                insufficientLoanMembers.push(memberName);
                skipMember = true;
            }
        }

        if (skipMember) {
            membersSkippedCount++; // Increment overall skipped count for any reason
            continue; // Skip this member and move to the next in the batch
        }

        // If not skipped, add as a new entry. (Existing entries are strictly skipped now)
        currentReportEntries.push(entryToProcess);
        membersAddedCount++;
    }

    renderCurrentReportEntriesPreviewUI(currentReportEntries, handleDeleteSingleReportEntry);
    updateReportMemberDropdown(); // Re-populate single entry dropdown

    let feedbackMessage = `ব্যাচ এন্ট্রি সম্পন্ন হয়েছে: ${membersAddedCount} জন সদস্যের এন্ট্রি যুক্ত হয়েছে।`;
    if (membersSkippedCount > 0) {
        feedbackMessage += ` ${membersSkippedCount} জন সদস্যকে বাদ দেওয়া হয়েছে। কারণ:`;
        const reasons = [];
        if (singleSelectedConflictMembers.length > 0) reasons.push(` একক এন্ট্রিতে নির্বাচিত (${singleSelectedConflictMembers.join(', ')})`);
        if (alreadyInReportMembers.length > 0) reasons.push(` ইতিমধ্যে রিপোর্টে যুক্ত (${alreadyInReportMembers.join(', ')})`);
        if (insufficientFundsMembers.length > 0) reasons.push(` সঞ্চয় অপর্যাপ্ত (${insufficientFundsMembers.join(', ')})`);
        if (insufficientLoanMembers.length > 0) reasons.push(` ঋণ অপর্যাপ্ত (${insufficientLoanMembers.join(', ')}`);
        
        feedbackMessage += reasons.join(';');
        feedbackMessage += `।`;
    }
    
    // FIX 2: Changed auto-dismiss delay from 0 to 10000 (10 seconds) for the batch summary message.
    showInlineMessageUI(feedbackMessage, membersAddedCount > 0 ? "success" : "warning", 10000); 

    // Clear batch inputs
    if (batchSavingsInput) batchSavingsInput.value = '';
    if (batchSavingsWithdrawalInput) batchSavingsWithdrawalInput.value = '';
    if (batchLoanDisbursedInput) batchLoanDisbursedInput.value = '';
    if (batchLoanRepaymentInput) batchLoanRepaymentInput.value = '';

    // Clear batch selections and re-render member list to uncheck checkboxes
    selectedBatchMembers.clear();
    const currentSearchTerm = memberSearchInput ? memberSearchInput.value.toLowerCase() : '';
    // Pass currentReportEntries.map(entry => entry.memberId) to update member list checkboxes
    renderSocietyMembersListUI(societyMembers, handleDeleteMember, handleViewMemberStatementFromList, currentSearchTerm, selectedBatchMembers, selectedSingleMemberId, currentReportEntries.map(entry => entry.memberId));

    // If this is the first entry added or entries exist and not in edit mode, lock month/year selectors
    if (currentReportEntries.length > 0 && !editingReportId) {
        if (reportMonthSelect) reportMonthSelect.disabled = true;
        if (reportYearSelect) reportYearSelect.disabled = true;
        if (discardMonthYearBtn) discardMonthYearBtn.classList.remove('hidden'); // Show discard button
    }
    if (addBatchToReportBtn) addBatchToReportBtn.disabled = false; // Re-enable batch button
}


function handleDeleteSingleReportEntry(indexToDelete) {
    if (indexToDelete >= 0 && indexToDelete < currentReportEntries.length) {
        const removedEntry = currentReportEntries.splice(indexToDelete, 1)[0];
        renderCurrentReportEntriesPreviewUI(currentReportEntries, handleDeleteSingleReportEntry);
        updateReportMemberDropdown(); // Re-populate single entry dropdown
        showInlineMessageUI(`"${removedEntry.memberName}" এর এন্ট্রি বর্তমান রিপোর্ট থেকে সফলভাবে মুছে ফেলা হয়েছে।`, "info");
        // Re-render member list to update disabled states (e.g., if a previously disabled member is now re-enabled)
        const currentSearchTerm = memberSearchInput ? memberSearchInput.value.toLowerCase() : '';
        renderSocietyMembersListUI(societyMembers, handleDeleteMember, handleViewMemberStatementFromList, currentSearchTerm, selectedBatchMembers, selectedSingleMemberId, currentReportEntries.map(entry => entry.memberId));
        
        // If all entries are cleared, unlock month/year selectors if not in edit mode
        if (currentReportEntries.length === 0 && !editingReportId) {
            if (reportMonthSelect) reportMonthSelect.disabled = false;
            if (reportYearSelect) reportYearSelect.disabled = false;
            if (discardMonthYearBtn) discardMonthYearBtn.classList.add('hidden'); // Hide discard button if all entries cleared
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
            updateReportMemberDropdown(); // Re-populate single entry dropdown
            showInlineMessageUI("বর্তমান রিপোর্ট এন্ট্রিগুলি মুছে ফেলা হয়েছে।", "info");
            toggleReportActionButtonsUI(false);
            resetEditMode(); // Ensure edit mode is reset if all entries are cleared
        } else {
            showInlineMessageUI("এন্ট্রি মোছা বাতিল করা হয়েছে।", "info");
        }
    } else {
        showInlineMessageUI("মোছার জন্য কোনও এন্ট্রি নেই।", "info");
    }
}

async function handleGenerateReport() {
    if (currentReportEntries.length === 0 && !editingReportId) {
        showInlineMessageUI("রিপোর্ট তৈরি/আপডেট করতে অনুগ্রহ করে কমপক্ষে একটি সদস্য এন্ট্রি যুক্ত করুন।", "error", 0);
        return;
    }
    if (!reportMonthSelect || !reportYearSelect || !generateReportBtn) {
        console.error("Required UI elements for report generation are missing.");
        showInlineMessageUI("রিপোর্ট তৈরির জন্য প্রয়োজনীয় UI উপাদান পাওয়া যায়নি।", "error", 0);
        return;
    }

    // Handle empty entries for edit mode FIRST, without blocking spinner
    if (editingReportId && currentReportEntries.length === 0) {
        const confirmed = await showConfirmModalUI(
            "এন্ট্রিবিহীন রিপোর্ট",
            "আপনি কি নিশ্চিত যে আপনি এই রিপোর্টটি কোনো এন্ট্রি ছাড়াই সংরক্ষণ করতে চান? এটি একটি খালি রিপোর্ট হিসেবে সংরক্ষণ হবে।",
            "হ্যাঁ, সংরক্ষণ করুন",
            "বাতিল করুন"
        );
        if (!confirmed) {
            showInlineMessageUI("রিপোর্ট সংরক্ষণ বাতিল করা হয়েছে।", "info");
            return; // Stop execution if not confirmed
        }
    }
    
    // Now, disable button and show inline message for the actual async operation
    generateReportBtn.disabled = true;
    showInlineMessageUI("রিপোর্ট তৈরি/আপডেট করা হচ্ছে...", "info", 0); // Persistent inline message

    try {
        const associationNameString = SOCIETY_NAME;
        const reportMonthString = reportMonthSelect.value;
        const reportYearString = reportYearSelect.value;

        let result;
        if (editingReportId) {
            if (!editingReportOriginalTotals) {
                showInlineMessageUI("সম্পাদনার জন্য মূল রিপোর্টের ডেটা অনুপস্থিত। অনুগ্রহ করে আবার চেষ্টা করুন।", "error", 0);
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
            cumulativeTotals = editingReportId ? result.newGlobalCumulativeTotals : result.savedReportData.cumulativeTotalsAtEndOfReport; // Ensure updated cumulative totals
            updateOverallFinancialStatusDisplayUI(cumulativeTotals, societyMembers.size);

            const reportsForDropdown = await fetchAllReportsMetadataFS(appInstanceId);
            populatePreviousReportsDropdownUI(reportsForDropdown, handleLoadPreviousReportFromList, handleInitiateEditReport, handleInitiateDeleteReport);

            const reportDataToDisplay = editingReportId ? result.updatedReportData : result.savedReportData;

            // Ensure these are Date objects before passing to renderReportToHtmlUI
            const createdAtJSDate = reportDataToDisplay.createdAt instanceof Date ? reportDataToDisplay.createdAt : (reportDataToDisplay.createdAt?.toDate ? reportDataToDisplay.createdAt.toDate() : null);
            const updatedAtJSDate = reportDataToDisplay.updatedAt instanceof Date ? reportDataToDisplay.updatedAt : (reportDataToDisplay.updatedAt?.toDate ? reportDataToDisplay.updatedAt.toDate() : null);


            renderReportToHtmlUI(
                reportDataToDisplay.entries,
                reportDataToDisplay.monthlyTotals.savings,
                reportDataToDisplay.monthlyTotals.loanDisbursed,
                reportDataToDisplay.monthlyTotals.loanRepaid,
                reportDataToDisplay.cumulativeTotalsAtEndOfReport,
                associationNameString,
                reportMonthString,
                reportYearString,
                cumulativeTotals, // Pass the correct updated cumulative totals
                reportDataToDisplay.monthlyTotals.savingsDeposit,
                reportDataToDisplay.monthlyTotals.savingsWithdrawal,
                createdAtJSDate,
                updatedAtJSDate,
                societyMembers
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
            toggleReportOutputVisibility(true);     // Show report output
            toggleInputSectionsVisibility(true);     // Keep input sections visible
            toggleAdditionalReportsVisibility(true); // Keep additional reports visible
            toggleAppSettingsVisibility(true);       // Keep app settings visible


            const actionMessage = editingReportId ? "সফলভাবে আপডেট করা হয়েছে" : "তৈরি ও সংরক্ষিত হয়েছে";
            showInlineMessageUI(`রিপোর্ট (আইডি: ${reportDataToDisplay.id.substring(0,6)}...) ${actionMessage}।`, "success", 3000); // Auto-dismiss after 3s

            currentReportEntries = [];
            renderCurrentReportEntriesPreviewUI(currentReportEntries, handleDeleteSingleReportEntry);
            updateReportMemberDropdown(); // Re-populate single entry dropdown
            // Re-render member list to update disabled states after new report generation
            const currentSearchTerm = memberSearchInput ? memberSearchInput.value.toLowerCase() : '';
            renderSocietyMembersListUI(societyMembers, handleDeleteMember, handleViewMemberStatementFromList, currentSearchTerm, selectedBatchMembers, selectedSingleMemberId, currentReportEntries.map(entry => entry.memberId));

            if (editingReportId) {
                // FIX 1: Called resetEditMode(true) to ensure the report remains visible after an update.
                resetEditMode(true); 
            }
            // Scroll to report output after generation/update
            if (reportOutputContainer) {
                reportOutputContainer.scrollIntoView({ behavior: 'smooth', block: 'start' });
            }

        } else {
            if (result.isDuplicate && !editingReportId) {
                showMessageUI(result.error.message, "warning", 0);
            } else {
                const actionVerb = editingReportId ? "আপডেট" : "তৈরি";
                showInlineMessageUI(`রিপোর্ট ${actionVerb} করতে ব্যর্থ: ${result.error.message || 'অজানা ত্রুটি।'}`, "error", 0);
            }
            console.error("Error generating/updating report via service:", result.error);
            // Ensure UI is reset even on failure
            if (!editingReportId) {
                toggleReportActionButtonsUI(lastRenderedReportData.type !== null);
            } else {
                 if(generateReportBtn) generateReportBtn.textContent = "রিপোর্ট আপডেট করুন";
            }
        }
    } catch (error) {
        console.error("Critical error in handleGenerateReport:", error);
        showInlineMessageUI("রিপোর্ট তৈরি/আপডেট করার সময় একটি গুরুতর ত্রুটি ঘটেছে।", "error", 0);
        toggleReportActionButtonsUI(false);
        if (editingReportId) {
            resetEditMode();
        }
    } finally {
        if (generateReportBtn) generateReportBtn.disabled = false; // Always re-enable button
    }
}

async function handleLoadPreviousReportFromList(reportId) {
    if (!reportId) {
        showInlineMessageUI("লোড করার জন্য রিপোর্ট আইডি পাওয়া যায়নি।", "error", 0);
        return;
    }
    showInlineMessageUI("রিপোর্ট লোড করা হচ্ছে...", "info", 1500); // Inline feedback
    try {
        if (editingReportId) {
            resetEditMode();
            currentReportEntries = [];
            renderCurrentReportEntriesPreviewUI(currentReportEntries, handleDeleteSingleReportEntry);
            updateReportMemberDropdown(); // Re-populate single entry dropdown
        }

        const result = await loadReportById(appInstanceId, reportId);

        if (result.success) {
            const reportData = result.reportData;
            const associationNameStr = reportData.associationName || SOCIETY_NAME;
            const reportMonthStr = reportData.month || "UnknownMonth";
            const reportYearStr = String(reportData.year) || "UnknownYear";

            const monthlySavingsNet = reportData.monthlyTotals?.savings || 0;
            const monthlySavingsDeposit = reportData.monthlyTotals?.savingsDeposit || monthlySavingsNet;
            const monthlySavingsWithdrawal = reportData.monthlyTotals?.savingsWithdrawal || 0;
            const monthlyLoanDisbursed = reportData.monthlyTotals?.loanDisbursed || 0;
            const monthlyLoanRepaid = reportData.monthlyTotals?.loanRepaid || 0;

            // Ensure these are Date objects before passing to renderReportToHtmlUI
            const createdAtJSDate = reportData.createdAt instanceof Date ? reportData.createdAt : (reportData.createdAt?.toDate ? reportData.createdAt.toDate() : null);
            const updatedAtJSDate = reportData.updatedAt instanceof Date ? reportData.updatedAt : (reportData.updatedAt?.toDate ? reportData.updatedAt.toDate() : null);

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
                monthlySavingsDeposit,
                monthlySavingsWithdrawal,
                createdAtJSDate,
                updatedAtJSDate,
                societyMembers
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
            toggleReportOutputVisibility(true);     // Show report output
            toggleInputSectionsVisibility(false);    // Hide input sections
            toggleAdditionalReportsVisibility(true); // Show additional reports section
            toggleAppSettingsVisibility(false);      // Hide app settings


            const reportOutputContainerElement = document.getElementById('reportOutputContainer');
            if (reportOutputContainerElement) {
                reportOutputContainerElement.scrollIntoView({ behavior: 'smooth', block: 'start' });
            }

        } else {
            console.error("Error loading previous report via service:", result.error);
            showInlineMessageUI(`পূর্ববর্তী রিপোর্ট লোড করতে ব্যর্থ: ${result.error.message}`, "error", 0);
            setReportOutputHTML(`<p class="text-gray-400 text-center bengali">রিপোর্ট লোড করা যায়নি।</p>`);
            toggleReportActionButtonsUI(false);
            lastRenderedReportData = { type: null, data: null, titleInfo: {} };
        }
    } catch (error) {
        console.error("Critical error in handleLoadPreviousReportFromList:", error);
        showInlineMessageUI("পূর্ববর্তী রিপোর্ট লোড করার সময় একটি গুরুতর ত্রুটি ঘটেছে।", "error", 0);
        setReportOutputHTML(`<p class="text-gray-400 text-center bengali">রিপোর্ট লোad করা যায়নি।</p>`);
        toggleReportActionButtonsUI(false);
        lastRenderedReportData = { type: null, data: null, titleInfo: {} };
    } finally {
        // Nothing needed here now that showLoadingUI is removed
    }
}

async function handleInitiateEditReport(reportId, month, year) {
    if (!reportId) {
        showInlineMessageUI("সম্পাদনা করার জন্য রিপোর্ট আইডি পাওয়া যায়নি।", "error", 0);
        return;
    }
    showInlineMessageUI("রিপোর্ট সম্পাদনার জন্য লোad করা হচ্ছে...", "info", 1500); // Inline feedback
    try {
        if (editingReportId) { // If already in edit mode for another report, reset first
            resetEditMode();
        }
        // Always clear current entries when initiating a new edit, even if it's the same report
        currentReportEntries = [];
        renderCurrentReportEntriesPreviewUI(currentReportEntries, handleDeleteSingleReportEntry);
        updateReportMemberDropdown(); // Re-populate single entry dropdown


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
            updateReportMemberDropdown(); // Re-populate single entry dropdown
            // Re-render member list to update disabled states based on entries being loaded for edit
            const currentSearchTerm = memberSearchInput ? memberSearchInput.value.toLowerCase() : '';
            renderSocietyMembersListUI(societyMembers, handleDeleteMember, handleViewMemberStatementFromList, currentSearchTerm, selectedBatchMembers, selectedSingleMemberId, currentReportEntries.map(entry => entry.memberId));


            editingReportId = reportId;
            if (generateReportBtn) {
                generateReportBtn.textContent = "রিপোর্ট আপডেট করুন";
                generateReportBtn.classList.remove('theme-button-success-lg');
                generateReportBtn.classList.add('theme-button-accent');
            }

            if(reportMonthSelect) reportMonthSelect.disabled = true;
            if(reportYearSelect) reportYearSelect.disabled = true; // Updated ID here
            if(cancelEditReportBtn) cancelEditReportBtn.classList.remove('hidden'); // Show cancel button
            if(discardMonthYearBtn) discardMonthYearBtn.classList.remove('hidden'); // Show discard button

            showInlineMessageUI(`"${reportToEdit.month} ${reportToEdit.year}" মাসের রিপোর্ট এখন সম্পাদনা করছেন।`, "success", 3000); // Auto-dismiss after 3s

            // Scroll to report entry section after initiating edit
            if (singleEntrySection) { // Targeting the single entry section
                singleEntrySection.scrollIntoView({ behavior: 'smooth', block: 'start' });
            } else {
                const inputSectionElement = document.getElementById('inputSection'); // Fallback to general input section
                if(inputSectionElement) inputSectionElement.scrollIntoView({ behavior: 'smooth', block: 'start' });
            }

            setReportOutputHTML(`<p class="text-gray-400 text-center bengali">"${reportToEdit.month} ${reportToEdit.year}" মাসের রিপোর্ট সম্পাদনা করছেন...</p>`);
            toggleReportActionButtonsUI(false);
            toggleReportOutputVisibility(true);     // Show report output during edit
            toggleInputSectionsVisibility(true);     // Keep input forms visible for editing
            toggleAdditionalReportsVisibility(false); // Hide additional reports section
            toggleAppSettingsVisibility(false);      // Hide app settings during edit

        } else {
            throw result.error || new Error("সম্পাদনার জন্য মূল রিপোর্ট লোad করা যায়নি।");
        }
    } catch (error) {
        console.error("Error initiating report edit:", error);
        showInlineMessageUI(`রিপোর্ট সম্পাদনার জন্য লোad করতে ব্যর্থ: ${error.message}`, "error", 0);
        resetEditMode();
    } finally {
        // Nothing needed here now that showLoadingUI is removed
    }
}

async function handleInitiateDeleteReport(reportId, month, year) {
    const confirmationMessage = `আপনি কি "${month} ${year}" মাসের রিপোর্টটি স্থায়ীভাবে মুছে ফেলতে চান? এই কাজটি পূর্বাবস্থায় ফেরানো যাবে না এবং সমিতির মোট আর্থিক পরিসংখ্যান সমন্বয় করা হবে।`;
    const confirmed = await showConfirmModalUI("রিপোর্ট মুছুন", confirmationMessage, "মুছুন", "বাতিল করুন");

    if (!confirmed) {
        showInlineMessageUI("রিপোর্ট মোছা বাতিল করা হয়েছে।", "info");
        return;
    }

    showInlineMessageUI(`"${month} ${year}" মাসের রিপোর্ট মুছে ফেলা হচ্ছে...`, "info", 0); // Persistent inline feedback
    try {
        const result = await deleteMonthlyReportAndRecalculate(appInstanceId, reportId);

        if (result.success) {
            cumulativeTotals = result.updatedCumulativeTotals;
            updateOverallFinancialStatusDisplayUI(cumulativeTotals, societyMembers.size);

            const reportsForDropdown = await fetchAllReportsMetadataFS(appInstanceId);
            populatePreviousReportsDropdownUI(reportsForDropdown, handleLoadPreviousReportFromList, handleInitiateEditReport, handleInitiateDeleteReport);

            if (lastRenderedReportData && lastRenderedReportData.type === 'monthly' && lastRenderedReportData.titleInfo.id === reportId) {
                setReportOutputHTML(`<p class="text-center bengali theme-text-muted">রিপোর্ট মুছে ফেলা হয়েছে। নতুন রিপোর্ট তৈরি করুন বা অন্য একটি লোad করুন।</p>`);
                toggleReportActionButtonsUI(false);
                lastRenderedReportData = { type: null, data: null, titleInfo: {} };
            }
            showInlineMessageUI(`"${month} ${year}" মাসের রিপোর্ট সফলভাবে মুছে ফেলা হয়েছে এবং আর্থিক পরিসংখ্যান আপডেট করা হয়েছে।`, "success", 3000); // Auto-dismiss after 3s
            
            toggleReportOutputVisibility(false);     // Hide report output after deletion
            toggleInputSectionsVisibility(true);     // Show input sections
            toggleAdditionalReportsVisibility(true); // Show additional reports section
            toggleAppSettingsVisibility(true);       // Show app settings


        } else {
            console.error("Error deleting report via service:", error);
            showInlineMessageUI(`রিপোর্ট মুছতে ব্যর্থ: ${error.message}`, "error", 0);
        }
    }
    catch (error) {
        console.error("Critical error in handleInitiateDeleteReport:", error);
        showInlineMessageUI("রিপোর্ট মোছার সময় একটি গুরুতর ত্রুটি ঘটেছে।", "error", 0);
    } finally {
        // Nothing needed here now that showLoadingUI is removed
    }
}


async function handleGenerateAnnualReport() {
    if (!annualReportYearSelect || !annualReportYearSelect.value) {
        showInlineMessageUI("অনুগ্রহ করে বার্ষিক রিপোর্টের জন্য বছর নির্বাচন করুন।", "error", 0);
        return;
    }
    const yearNum = parseInt(annualReportYearSelect.value);
    if (isNaN(yearNum) || String(yearNum).length !== 4) {
        showInlineMessageUI("অনুগ্রহ করে একটি সঠিক ৪-সংখ্যার বছর লিখুন।", "error", 0);
        return;
    }
    showInlineMessageUI(`বার্ষিক রিপোর্ট (${yearNum} সাল) তৈরি করা হচ্ছে...`, "info", 0); // Persistent inline feedback
    try {
        const result = await generateAnnualReportData(appInstanceId, yearNum, banglaMonthsForUI);
        if (result.success) {
            const { year, monthlyData, yearlyTotals, startOfYearTotals, endOfYearTotals, isEmpty, memberSummaries } = result.annualReportViewData;
            if (isEmpty) { showInlineMessageUI(`${year} সালের জন্য কোনও রিপোর্ট পাওয়া হয়নি।`, "info"); }
            else { showInlineMessageUI(`${year} সালের বার্ষিক রিপোর্ট সফলভাবে তৈরি হয়েছে।`, "success", 3000); } // Auto-dismiss after 3s
            renderAnnualReportUI(year, monthlyData, yearlyTotals, startOfYearTotals, endOfYearTotals, memberSummaries);
            lastRenderedReportData = {
                type: 'annual',
                data: { year, monthlyData, yearlyTotals, startOfYearTotals, endOfYearTotals, memberSummaries },
                titleInfo: { associationName: SOCIETY_NAME, year: String(year) }
            };
            toggleReportActionButtonsUI(true);
            toggleReportOutputVisibility(true);     // Show report output
            toggleInputSectionsVisibility(false);    // Hide input sections
            toggleAdditionalReportsVisibility(true); // Show additional reports section
            toggleAppSettingsVisibility(false);      // Hide app settings


        } else {
            console.error("Error generating annual report via service:", result.error);
            showInlineMessageUI(`বার্ষিক রিপোর্ট তৈরিতে ব্যর্থ: ${result.error.message}`, "error", 0);
            if (reportOutputDiv) setReportOutputHTML(`<p class="text-gray-400 text-center bengali">বার্ষিক রিপোর্ট তৈরি করা যায়নি।</p>`);
            toggleReportActionButtonsUI(false); lastRenderedReportData = { type: null, data: null, titleInfo: {} };
        }
    } catch (error) {
        console.error("Critical error in handleGenerateAnnualReport:", error);
        showInlineMessageUI("বার্ষিক রিপোর্ট তৈরি করার সময় একটি গুরুতর ত্রুটি ঘটেছে।", "error", 0);
        if (reportOutputDiv) setReportOutputHTML(`<p class="text-gray-400 text-center bengali">বার্ষিক রিপোর্ট তৈরি করা যায়নি।</p>`);
        toggleReportActionButtonsUI(false); lastRenderedReportData = { type: null, data: null, titleInfo: {} };
    } finally {
        // Nothing needed here now that showLoadingUI is removed
    }
}

// --- REWRITTEN & CORRECTED FUNCTION TO HANDLE CHART GENERATION ---
async function handleGenerateChart() {
    const chartTypeSelect = document.getElementById('chartTypeSelect');
    const pieChartDataTypeSelect = document.getElementById('pieChartDataType');
    const chartYearSelect = document.getElementById('chartYearSelect');
    const pieChartDataTypeContainer = document.getElementById('pieChartDataTypeContainer');

    if (!chartTypeSelect || !chartYearSelect || !pieChartDataTypeSelect) {
        showInlineMessageUI("চার্টের প্রয়োজনীয় উপাদান পাওয়া যায়নি।", "error", 0);
        return;
    }

    const chartType = chartTypeSelect.value;
    const yearNum = parseInt(chartYearSelect.value);

    if (isNaN(yearNum)) {
        showInlineMessageUI("অনুগ্রহ করে একটি সঠিক বছর নির্বাচন করুন।", "error", 0);
        return;
    }

    // Toggle visibility of the pie data type selector based on chart type
    if (chartType === 'pie' || chartType === 'doughnut') {
        if(pieChartDataTypeContainer) pieChartDataTypeContainer.classList.remove('hidden');
    } else {
        if(pieChartDataTypeContainer) pieChartDataTypeContainer.classList.add('hidden');
    }
    
    showInlineMessageUI(`গ্রাফিক্যাল রিপোর্ট (${yearNum} সাল) তৈরি করা হচ্ছে...`, "info", 2000);

    // Find the details element and open it to make the chart visible
    const graphDetailsElement = document.getElementById('financialChart')?.closest('details');
    if(graphDetailsElement) {
        graphDetailsElement.open = true;
    }

    try {
        let result;
        if (chartType === 'pie' || chartType === 'doughnut') {
            // Use the new service function for pie/doughnut data
            const pieDataType = pieChartDataTypeSelect.value;
            result = await generateMemberDistributionDataForYear(appInstanceId, yearNum);
            
            if (result.success) {
                if (!result.data || result.data.members.length === 0) {
                    showInlineMessageUI(`${yearNum} সালের জন্য কোনও ডেটা পাওয়া যায়নি। গ্রাফ দেখানো সম্ভব নয়।`, "warning", 3000);
                    renderFinancialChartUI(null); // Call with null to clear the chart
                } else {
                    showInlineMessageUI(`${yearNum} সালের গ্রাফ সফলভাবে তৈরি হয়েছে।`, "success", 3000);
                    renderFinancialChartUI(chartType, yearNum, result.data, pieDataType);
                }
            } else {
                 throw result.error || new Error("Pie chart data could not be generated.");
            }

        } else { // 'bar' chart type
            result = await generateAnnualReportData(appInstanceId, yearNum, banglaMonthsForUI);
            if (result.success) {
                if (result.annualReportViewData.isEmpty) {
                    showInlineMessageUI(`${yearNum} সালের জন্য কোনও ডেটা পাওয়া যায়নি। গ্রাফ দেখানো সম্ভব নয়।`, "warning", 3000);
                    renderFinancialChartUI(null); // Call with null to clear the chart
                } else {
                    showInlineMessageUI(`${yearNum} সালের গ্রাফ সফলভাবে তৈরি হয়েছে।`, "success", 3000);
                    renderFinancialChartUI('bar', yearNum, result.annualReportViewData);
                }
            } else {
                throw result.error || new Error("Bar chart data could not be generated.");
            }
        }
    } catch (error) {
        console.error("Critical error in handleGenerateChart:", error);
        showInlineMessageUI(`গ্রাফ তৈরি করার সময় একটি গুরুতর ত্রুটি ঘটেছে: ${error.message}`, "error", 0);
        renderFinancialChartUI(null); // Clear chart on error
    }
}


async function generateMemberStatementLogic(memberId, memberName) {
    showInlineMessageUI(`${memberName} এর বিবৃতি তৈরি করা হচ্ছে...`, "info", 0); // Persistent inline feedback
    try {
        const result = await generateMemberStatementData(appInstanceId, memberId, banglaMonthsForUI);
        if (result.success) {
            const { transactions } = result.statementData;
            renderMemberStatementUI(memberName, transactions, SOCIETY_NAME);
            lastRenderedReportData = { type: 'memberStatement', data: { memberName, transactions }, titleInfo: { associationName: SOCIETY_NAME, memberName: typeof memberName === 'string' ? memberName : "UnknownMember" } };
            toggleReportActionButtonsUI(true);
            showInlineMessageUI(`${memberName} এর জন্য সদস্য বিবৃতি সফলভাবে তৈরি হয়েছে।`, "success", 3000); // Auto-dismiss after 3s
            toggleReportOutputVisibility(true);     // Show report output
            toggleInputSectionsVisibility(false);    // Hide input sections
            toggleAdditionalReportsVisibility(true); // Show additional reports section
            toggleAppSettingsVisibility(false);      // Hide app settings


        } else {
            console.error("Error generating member statement via service:", result.error);
            showInlineMessageUI(`সদস্যের বিবৃতি তৈরিতে ব্যর্থ: ${result.error.message}`, "error", 0);
            if (reportOutputDiv) setReportOutputHTML(`<p class="text-gray-400 text-center bengali">সদস্যের বিবৃতি তৈরি করা যায়নি।</p>`);
            toggleReportActionButtonsUI(false); lastRenderedReportData = { type: null, data: null, titleInfo: {} };
        }
    } catch (error) {
        console.error("Critical error in generateMemberStatementLogic:", error);
        showInlineMessageUI("সদস্যের বিবৃতি তৈরি করার সময় একটি গুরুতর ত্রুটি ঘটেছে।", "error", 0);
        if (reportOutputDiv) setReportOutputHTML(`<p class="text-gray-400 text-center bengali">সদস্যের বিবৃতি তৈরি করা যায়নি।</p>`);
        toggleReportActionButtonsUI(false); lastRenderedReportData = { type: null, data: null, titleInfo: {} };
    } finally {
        // Nothing needed here now that showLoadingUI is removed
    }
}

async function handleViewMemberStatementFromList(memberId, memberName) {
    if (!memberId || !memberName) {
        showInlineMessageUI("সদস্য নির্বাচন করা হয়নি।", "error", 0);
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
        showInlineMessageUI("প্রিন্ট করার জন্য প্রথমে একটি রিপোর্ট প্রদর্শন করুন।", "error", 0);
        return;
    }
    window.print();
}

async function handleExportAllData() {
    if (!appInstanceId) {
        showInlineMessageUI("অ্যাপ্লিকেশন সঠিকভাবে শুরু হয়নি। অনুগ্রহ করে পৃষ্ঠাটি রিফ্রেশ করুন।", "error", 0);
        return;
    }
    showInlineMessageUI("সকল ডেটা এক্সপোর্ট করা হচ্ছে...", "info", 0); // Persistent inline feedback
    try {
        const allData = await fetchAllDataForExportFS(appInstanceId);

        if (allData) {
            exportAllDataToJson(allData, showInlineMessageUI, appInstanceId);
        } else {
            throw new Error("এক্সপোর্ট করার জন্য কোনও ডেটা পাওয়া যায়নি।");
        }
    } catch (error) {
        console.error("Error exporting all data:", error);
        showInlineMessageUI(`সকল ডেটা এক্সপোর্ট করতে ব্যর্থ: ${error.message}`, "error", 0);
    } finally {
        // Nothing needed here now that showLoadingUI is removed
    }
}


async function handleResetAllApplicationData() {
    const confirmMsg1 = `গুরুত্বপূর্ণ: সকল ডেটা মোছার আগে, আপনার রেকর্ডের জন্য একটি ব্যাকআপ (JSON এক্সপোর্ট) ডাউনলোড করার পরামর্শ দেওয়া হচ্ছে।\n\nআপনি কি নিশ্চিত যে আপনি সমস্ত ডেটা রিসেট করতে চান? এর মধ্যে সমস্ত সদস্য, রিপোর্ট এবং ক্রমসঞ্চিত পরিসংখ্যান অন্তর্ভুক্ত রয়েছে। এই পদক্ষেপটি স্থায়ীভাবে সমস্ত ডেটা মুছে ফেলবে!`;
    const confirmed1 = await showConfirmModalUI("সব ডেটা রিসেট করুন", confirmMsg1, "হ্যাঁ, রিসেট করুন", "বাতিল করুন");

    if (!confirmed1) {
        showInlineMessageUI("ডেটা রিসেট বাতিল করা হয়েছে।", "info"); return;
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
        showInlineMessageUI("নিশ্চিতকরণ টেক্সট মেলেনি। ডেটা রিসেট বাতিল করা হয়েছে।", "warning", 0); return;
    }

    showInlineMessageUI("সমস্ত ডেটা রিসেট করা হচ্ছে... অনুগ্রহ করে অপেক্ষা করুন।", "info", 0); // Persistent inline feedback
    try {
        await deleteAllMembersFS(appInstanceId);
        await deleteAllReportsFS(appInstanceId);
        await deleteCumulativeTotalsFS(appInstanceId);

        currentReportEntries = []; societyMembers.clear(); cumulativeTotals = { savings: 0, loan: 0 }; lastRenderedReportData = { type: null, data: null, titleInfo: {} };

        renderCurrentReportEntriesPreviewUI(currentReportEntries, handleDeleteSingleReportEntry);
        const currentSearchTerm = memberSearchInput ? memberSearchInput.value.toLowerCase() : '';
        // Pass currentReportEntries.map(entry => entry.memberId) to update member list checkboxes
        renderSocietyMembersListUI(societyMembers, handleDeleteMember, handleViewMemberStatementFromList, currentSearchTerm, selectedBatchMembers, selectedSingleMemberId, currentReportEntries.map(entry => entry.memberId));
        updateReportMemberDropdown();
        updateOverallFinancialStatusDisplayUI(cumulativeTotals, societyMembers.size);
        const reports = await fetchAllReportsMetadataFS(appInstanceId);
        populatePreviousReportsDropdownUI(reports, handleLoadPreviousReportFromList, handleInitiateEditReport, handleInitiateDeleteReport);
        setReportOutputHTML(`<p class="text-center bengali theme-text-muted">রিপোর্ট তৈরি হওয়ার পর এখানে প্রদর্শিত হবে।</p>`);
        toggleReportActionButtonsUI(false);
        showInlineMessageUI("সমস্ত ডেটা সফলভাবে রিসেট করা হয়েছে।", "success", 3000); // Auto-dismiss after 3s
        
        toggleReportOutputVisibility(false);     // Hide report output
        toggleInputSectionsVisibility(true);     // Show input sections
        toggleAdditionalReportsVisibility(true); // Show additional reports section
        toggleAppSettingsVisibility(true);       // Show app settings


    } catch (error) {
        console.error("Error resetting all data:", error);
        showInlineMessageUI(`ডেটা রিসেট করতে ব্যর্থ: ${error.message}`, "error", 0);
        await loadInitialData();
    } finally {
        // Nothing needed here now that showLoadingUI is removed
    }
}

// --- Attach Event Listeners ---
if (addSocietyMemberBtn) addSocietyMemberBtn.addEventListener('click', handleAddSocietyMember);
if (addMemberToReportBtn) addMemberToReportBtn.addEventListener('click', handleAddMemberToReport);
if (clearCurrentReportEntriesBtn) clearCurrentReportEntriesBtn.addEventListener('click', handleClearCurrentReportEntries);
if (cancelEditReportBtn) cancelEditReportBtn.addEventListener('click', resetEditMode);
if (discardMonthYearBtn) discardMonthYearBtn.addEventListener('click', unlockMonthYearForNewReport);

if (generateReportBtn) generateReportBtn.addEventListener('click', handleGenerateReport);
if (generateAnnualReportBtn) generateAnnualReportBtn.addEventListener('click', handleGenerateAnnualReport);

// --- LISTENER FOR CHART BUTTON ---
if (generateChartBtn) {
    generateChartBtn.addEventListener('click', handleGenerateChart);
}

// --- NEW EVENT LISTENER TO TOGGLE PIE CHART OPTIONS ---
document.addEventListener('DOMContentLoaded', () => {
    const chartTypeSelect = document.getElementById('chartTypeSelect');
    const pieChartDataTypeContainer = document.getElementById('pieChartDataTypeContainer');

    if (chartTypeSelect && pieChartDataTypeContainer) {
        const togglePieOptions = () => {
            if (chartTypeSelect.value === 'pie' || chartTypeSelect.value === 'doughnut') {
                pieChartDataTypeContainer.classList.remove('hidden');
            } else {
                pieChartDataTypeContainer.classList.add('hidden');
            }
        };
        togglePieOptions(); // Initial check
        chartTypeSelect.addEventListener('change', togglePieOptions);
    }
});


if (downloadPdfBtn) {
    downloadPdfBtn.addEventListener('click', () => {
        const reportOutputElement = document.getElementById('reportOutput');
        const reportActionButtons = document.getElementById('reportActionButtons');
        if (lastRenderedReportData && lastRenderedReportData.type && reportOutputElement) {
            exportToPdf(lastRenderedReportData, reportOutputElement, reportActionButtons, showMessageUI, { jsPDF: window.jspdf, html2canvas: window.html2canvas });
        } else { showInlineMessageUI("পিডিএফ এক্সপোর্ট করার জন্য প্রথমে একটি রিপোর্ট তৈরি করুন বা লোad করুন।", "info"); }
    });
}
if (exportCsvBtn) {
    exportCsvBtn.addEventListener('click', () => {
        if (lastRenderedReportData && lastRenderedReportData.type) {
            exportToCsv(lastRenderedReportData, showMessageUI);
        } else { showInlineMessageUI("CSV এক্সপোর্ট করার জন্য প্রথমে একটি রিপোর্ট তৈরি করুন বা লোad করুন।", "info"); }
    });
}
if (printReportBtn) printReportBtn.addEventListener('click', handlePrintReport);
if (resetAllDataBtn) resetAllDataBtn.addEventListener('click', handleResetAllApplicationData);
if (exportAllDataBtn) exportAllDataBtn.addEventListener('click', handleExportAllData);

// New Event Listener for Close Report View Button
if (closeReportViewBtn) {
    closeReportViewBtn.addEventListener('click', () => {
        setReportOutputHTML(`<p class="text-center bengali theme-text-muted">রিপোর্ট তৈরি হওয়ার পর এখানে প্রদর্শিত হবে।</p>`);
        toggleReportActionButtonsUI(false);
        lastRenderedReportData = { type: null, data: null, titleInfo: {} }; // Clear last rendered report data
        if (reportOutputContainer) {
            reportOutputContainer.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
        resetEditMode(); // Call resetEditMode to unlock month/year selectors and show input sections
    });
}

// Event listener for Batch Add to Report Button
if (addBatchToReportBtn) {
    addBatchToReportBtn.addEventListener('click', handleAddBatchToReport);
};
