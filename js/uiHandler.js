// js/uiHandler.js

// --- NEW ---
// Global variable to hold the chart instance so it can be destroyed
let financialChartInstance = null;

// DOM Elements
const loadingModal = document.getElementById('loadingModal');
const messageModal = document.getElementById('messageModal');
const messageModalTitle = document.getElementById('messageModalTitle');
const messageModalText = document.getElementById('messageModalText');
const messageModalCloseBtn = document.getElementById('messageModalCloseBtn');
const appContainer = document.getElementById('appContainer');

// New Modal Elements
const confirmModal = document.getElementById('confirmModal');
const confirmModalTitle = document.getElementById('confirmModalTitle');
const confirmModalText = document.getElementById('confirmModalText');
const confirmModalConfirmBtn = document.getElementById('confirmModalConfirmBtn');
const confirmModalCancelBtn = document.getElementById('confirmModalCancelBtn');

const promptModal = document.getElementById('promptModal');
const promptModalTitle = document.getElementById('promptModalTitle');
const promptModalText = document.getElementById('promptModalText');
const promptModalInput = document.getElementById('promptModalInput');
const promptModalConfirmBtn = document.getElementById('promptModalConfirmBtn');
const promptModalCancelBtn = document.getElementById('promptModalCancelBtn');


const firebaseConfigSection = document.getElementById('firebaseConfigSection');
// Get specific section elements for toggling
const mainDashboardSection = document.getElementById('mainDashboardSection'); // This should ALWAYS be visible after Firebase init
const inputFormsSection = document.getElementById('inputFormsSection'); // This wrapper contains all input forms
const memberManagementSection = document.getElementById('memberManagementSection');
const reportCreationSection = document.getElementById('reportCreationSection');
const singleEntrySection = document.getElementById('singleEntrySection');
const batchEntrySection = document.getElementById('batchEntrySection');
const currentReportEntriesPreviewSection = document.getElementById('currentReportEntriesPreviewSection');
const appSettingsAndDataManagementSection = document.getElementById('appSettingsAndDataManagement'); // Collapsible settings section


const ulSocietyMembers = document.getElementById('ulSocietyMembers');
const memberCountSpan = document.getElementById('memberCount');
const reportMemberNameSelect = document.getElementById('reportMemberNameSelect');
const reportMonthSelectUI = document.getElementById('reportMonthSelect');
const reportYearSelectUI = document.getElementById('reportYearSelect');
const annualReportYearSelectUI = document.getElementById('annualReportYearSelect');


const ulCurrentReportEntries = document.getElementById('ulCurrentReportEntries');
const currentReportEntryCountSpan = document.getElementById('currentReportEntryCount');

const totalSavingsDisplay = document.getElementById('totalSavingsDisplay');
const totalLoanDisplay = document.getElementById('totalLoanDisplay');
const currentCashDisplay = document.getElementById('currentCashDisplay');
const dashboardMemberCountDisplay = document.getElementById('dashboardMemberCountDisplay');
const currentDateDisplay = document.getElementById('currentDateDisplay');

const previousReportsListContainer = document.getElementById('previousReportsListContainer');

const reportOutputDiv = document.getElementById('reportOutput');
const reportOutputContainer = document.getElementById('reportOutputContainer');
const reportActionButtonsDiv = document.getElementById('reportActionButtons');
const additionalReportsSection = document.getElementById('additionalReportsSection'); // Section containing previous reports and annual report

const inlineMessageDisplay = document.getElementById('inlineMessageDisplay');


const banglaMonthsForUI = [
    "জানুয়ারি", "ফেব্রুয়ারি", "মার্চ", "এপ্রিল", "মে", "জুন",
    "জুলাই", "আগস্ট", "সেপ্টেম্বর", "অক্টোবর", "নভেম্বর", "ডিসেম্বর"
];

let messageModalTimeoutId = null;

// --- REWRITTEN & CORRECTED CHART RENDERING FUNCTION ---
/**
 * Renders a financial chart based on the specified type and data.
 * This function can now render bar/line combo, pie, or doughnut charts.
 * @param {string | null} chartType - The type of chart to render ('bar', 'pie', 'doughnut') or null to clear.
 * @param {number} year - The year the data represents.
 * @param {object} chartData - The data object, which varies based on chart type.
 * @param {string} [pieDataType='savings'] - The type of data for pie/doughnut charts ('savings' or 'loan').
 */
export function renderFinancialChartUI(chartType, year, chartData, pieDataType = 'savings') {
    const ctx = document.getElementById('financialChart');
    if (!ctx) {
        console.error("Financial chart canvas element not found.");
        return;
    }

    // If a chart instance already exists, destroy it before creating a new one
    if (financialChartInstance) {
        financialChartInstance.destroy();
    }

    // If chartType is null, we just clear the canvas and exit.
    if (!chartType || !chartData) {
        return;
    }
    
    let config;

    // --- Configuration for Bar/Line Chart ---
    if (chartType === 'bar') {
        const { monthlyData } = chartData;
        monthlyData.sort((a, b) => banglaMonthsForUI.indexOf(a.month) - banglaMonthsForUI.indexOf(b.month));
        const labels = monthlyData.map(d => d.month);

        config = {
            type: 'bar',
            data: {
                labels: labels,
                datasets: [
                    { type: 'bar', label: 'মাসিক সঞ্চয় জমা', data: monthlyData.map(d => d.monthlySavingsDeposit), backgroundColor: 'rgba(75, 192, 192, 0.6)', yAxisID: 'y' },
                    { type: 'bar', label: 'মাসিক ঋণ বিতরণ', data: monthlyData.map(d => d.monthlyLoanDisbursed), backgroundColor: 'rgba(255, 99, 132, 0.6)', yAxisID: 'y' },
                    { type: 'line', label: 'ক্রমসঞ্চিত সঞ্চয়', data: monthlyData.map(d => d.cumulativeSavingsAtEndOfMonth), borderColor: 'rgb(75, 192, 192)', fill: true, tension: 0.2, yAxisID: 'y1' },
                    { type: 'line', label: 'ক্রমসঞ্চিত ঋণ', data: monthlyData.map(d => d.cumulativeLoanAtEndOfMonth), borderColor: 'rgb(255, 99, 132)', fill: true, tension: 0.2, yAxisID: 'y1' }
                ]
            },
            options: {
                responsive: true, maintainAspectRatio: false, interaction: { mode: 'index', intersect: false },
                plugins: {
                    title: { display: true, text: `${year} সালের আর্থিক পরিসংখ্যান`, font: { size: 18, family: "'Hind Siliguri', sans-serif" }, padding: { top: 10, bottom: 20 } },
                    tooltip: { callbacks: { label: (c) => `${c.dataset.label || ''}: ${new Intl.NumberFormat('bn-BD').format(c.parsed.y)} টাকা` } }
                },
                scales: {
                    x: { ticks: { font: { family: "'Hind Siliguri', sans-serif" } } },
                    y: { type: 'linear', display: true, position: 'left', title: { display: true, text: 'মাসিক লেনদেন (টাকা)', font: { family: "'Hind Siliguri', sans-serif" } } },
                    y1: { type: 'linear', display: true, position: 'right', title: { display: true, text: 'ক্রমসঞ্চিত মোট (টাকা)', font: { family: "'Hind Siliguri', sans-serif" } }, grid: { drawOnChartArea: false } }
                }
            }
        };
    }
    // --- Configuration for Pie/Doughnut Chart ---
    else if (chartType === 'pie' || chartType === 'doughnut') {
        const { members, totals } = chartData;
        const isSavings = pieDataType === 'savings';
        
        const dataSet = isSavings ? members.map(m => m.totalSavings) : members.map(m => m.totalLoan);
        const totalValue = isSavings ? totals.savings : totals.loan;
        const titleText = isSavings ? `${year} সালের সঞ্চয় বিতরণ` : `${year} সালের ঋণ বিতরণ`;
        const labels = members.map(m => m.memberName);

        config = {
            type: chartType,
            data: {
                labels: labels,
                datasets: [{
                    label: 'পরিমাণ (টাকা)',
                    data: dataSet,
                    backgroundColor: [ // Add more colors if you have many members
                        'rgba(255, 99, 132, 0.8)', 'rgba(54, 162, 235, 0.8)', 'rgba(255, 206, 86, 0.8)',
                        'rgba(75, 192, 192, 0.8)', 'rgba(153, 102, 255, 0.8)', 'rgba(255, 159, 64, 0.8)',
                        'rgba(199, 199, 199, 0.8)', 'rgba(83, 102, 255, 0.8)', 'rgba(40, 159, 64, 0.8)',
                        'rgba(255, 100, 100, 0.8)'
                    ],
                    borderColor: '#ffffff',
                    borderWidth: 2
                }]
            },
            options: {
                responsive: true, maintainAspectRatio: false,
                plugins: {
                    title: { display: true, text: titleText, font: { size: 18, family: "'Hind Siliguri', sans-serif" }, padding: { top: 10, bottom: 20 } },
                    legend: { position: 'top', labels: { font: { family: "'Hind Siliguri', sans-serif" } } },
                    tooltip: {
                        callbacks: {
                            label: function(context) {
                                let label = context.label || '';
                                if (label) { label += ': '; }
                                const value = context.parsed;
                                const percentage = totalValue > 0 ? ((value / totalValue) * 100).toFixed(2) : 0;
                                label += `${new Intl.NumberFormat('bn-BD').format(value)} টাকা (${percentage}%)`;
                                return label;
                            }
                        }
                    }
                }
            }
        };
    }

    if (config) {
        financialChartInstance = new Chart(ctx, config);
    }
}


// Helper function to format dates in Bengali
function formatBengaliDateTime(dateObj) {
    if (!dateObj || !(dateObj instanceof Date) || isNaN(dateObj.getTime())) {
        console.log("formatBengaliDateTime received invalid dateObj:", dateObj);
        return 'N/A';
    }
    try {
        return dateObj.toLocaleString('bn-BD', {
            year: 'numeric', month: 'long', day: 'numeric',
            hour: 'numeric', minute: '2-digit', hour12: true,
            timeZone: 'Asia/Dhaka'
        });
    } catch (e) {
        console.error("Error formatting date in toLocaleString:", e, dateObj);
        try {
            return dateObj.toLocaleDateString('bn-BD', { year: 'numeric', month: 'long', day: 'numeric'}) + " " +
                   dateObj.toLocaleTimeString('bn-BD', { hour: 'numeric', minute: '2-digit', hour12: true });
        } catch (e2) {
            console.error("Error in fallback date formatting:", e2, dateObj);
            return dateObj.toString();
        }
    }
}


export function showLoadingUI(show) {
    if (loadingModal && appContainer) {
        loadingModal.classList.toggle('active', show);
        document.body.classList.toggle('loading-active', show);
    } else {
        const fallbackLoader = document.getElementById('loadingIndicator');
        if (fallbackLoader) fallbackLoader.classList.toggle('hidden', !show);
    }
}

/**
 * Toggles the visibility of the Firebase configuration section.
 * This should ONLY affect the Firebase config section itself.
 * @param {boolean} show - True to show Firebase config, false to hide.
 */
export function showFirebaseConfigSectionUI(show) {
    if (firebaseConfigSection) {
        firebaseConfigSection.classList.toggle('hidden', !show);
    }
}

/**
 * Toggles the visibility of main input/creation sections.
 * Does NOT affect the main dashboard, report output, additional reports, or app settings section.
 * @param {boolean} showForms - True to show input/creation forms, false to hide them.
 */
export function toggleInputSectionsVisibility(showForms) {
    if (inputFormsSection) {
        inputFormsSection.classList.toggle('hidden', !showForms);
    }
}

/**
 * Toggles the visibility of the report output container.
 * @param {boolean} show - True to show the report output, false to hide it.
 */
export function toggleReportOutputVisibility(show) {
    if (reportOutputContainer) {
        reportOutputContainer.classList.toggle('hidden', !show);
    }
}

/**
 * Toggles the visibility of the additional reports section (previous months, annual).
 * @param {boolean} show - True to show the additional reports section, false to hide it.
 */
export function toggleAdditionalReportsVisibility(show) {
    if (additionalReportsSection) {
        additionalReportsSection.classList.toggle('hidden', !show);
    }
}

/**
 * Toggles the visibility of the app settings and data management section.
 * @param {boolean} show - True to show the settings section, false to hide it.
 */
export function toggleAppSettingsVisibility(show) {
    if (appSettingsAndDataManagementSection) {
        appSettingsAndDataManagementSection.classList.toggle('hidden', !show);
    }
}


export function showMessageUI(message, type = "info", autoDismissDelay = null) {
    if (!messageModal || !messageModalTitle || !messageModalText || !messageModalCloseBtn) {
        console.warn("Message modal elements not found, falling back to console.", message, type);
        if (type === "error") console.error(message);
        else if (type === "warning") console.warn(message);
        else console.info(message);
        return;
    }

    if (messageModalTimeoutId) {
        clearTimeout(messageModalTimeoutId);
        messageModalTimeoutId = null;
    }

    let title = "বার্তা";
    let titleColorClass = "theme-text-info";
    let requiresManualCloseLocal = false;

    if (type === "success") {
        title = "সফল!";
        titleColorClass = "theme-text-success";
        if (autoDismissDelay === null) autoDismissDelay = 3000;
    } else if (type === "error") {
        title = "ত্রুটি!";
        titleColorClass = "theme-text-danger";
        requiresManualCloseLocal = true;
    } else if (type === "warning") {
        title = "সতর্কবার্তা!";
        titleColorClass = "theme-text-warning";
        requiresManualCloseLocal = true;
    } else {
        title = "বার্তা";
        titleColorClass = "theme-text-info";
        if (autoDismissDelay === null) autoDismissDelay = 4000;
    }

    messageModalTitle.textContent = title;
    messageModalTitle.className = `bengali font-semibold ${titleColorClass}`;

    messageModalText.textContent = message;
    messageModalText.className = `bengali theme-modal-text`;

    if (requiresManualCloseLocal || autoDismissDelay === 0) {
        messageModalCloseBtn.style.display = 'inline-block';
    } else {
        messageModalCloseBtn.style.display = 'none';
        messageModalTimeoutId = setTimeout(() => {
            if (messageModal) messageModal.classList.remove('active');
            messageModalTimeoutId = null;
        }, autoDismissDelay);
    }
    messageModal.classList.add('active');
}

if (messageModalCloseBtn) {
    messageModalCloseBtn.addEventListener('click', () => {
        if (messageModal) {
            messageModal.classList.remove('active');
            if (messageModalTimeoutId) {
                clearTimeout(messageModalTimeoutId);
                messageModalTimeoutId = null;
            }
        }
    });
}
if (messageModal) {
    messageModal.addEventListener('click', (event) => {
        if (event.target === messageModal) {
            messageModal.classList.remove('active');
            if (messageModalTimeoutId) {
                clearTimeout(messageModalTimeoutId);
                messageModalTimeoutId = null;
            }
        }
    });
}

export function showConfirmModalUI(title, message, confirmButtonText = "নিশ্চিত করুন", cancelButtonText = "বাতিল করুন") {
    return new Promise(resolve => {
        if (!confirmModal || !confirmModalTitle || !confirmModalText || !confirmModalConfirmBtn || !confirmModalCancelBtn) {
            console.warn("Confirm modal elements not found, falling back to window.confirm.");
            resolve(window.confirm(message));
            return;
        }

        confirmModalTitle.textContent = title;
        confirmModalText.textContent = message;
        confirmModalConfirmBtn.textContent = confirmButtonText;
        confirmModalCancelBtn.textContent = cancelButtonText;

        confirmModal.classList.add('active');

        const handleConfirm = () => {
            confirmModal.classList.remove('active');
            confirmModalConfirmBtn.removeEventListener('click', handleConfirm);
            confirmModalCancelBtn.removeEventListener('click', handleCancel);
            confirmModal.removeEventListener('click', handleOverlayClick);
            resolve(true);
        };

        const handleCancel = () => {
            confirmModal.classList.remove('active');
            confirmModalConfirmBtn.removeEventListener('click', handleConfirm);
            confirmModalCancelBtn.removeEventListener('click', handleCancel);
            confirmModal.removeEventListener('click', handleOverlayClick);
            resolve(false);
        };

        const handleOverlayClick = (event) => {
            if (event.target === confirmModal) {
                handleCancel();
            }
        };

        confirmModalConfirmBtn.addEventListener('click', handleConfirm);
        confirmModalCancelBtn.addEventListener('click', handleCancel);
        confirmModal.addEventListener('click', handleOverlayClick);
    });
}

export function showPromptModalUI(title, message, placeholder = "", confirmButtonText = "জমা দিন", cancelButtonText = "বাতিল করুন") {
    return new Promise(resolve => {
        if (!promptModal || !promptModalTitle || !promptModalText || !promptModalInput || !promptModalConfirmBtn || !promptModalCancelBtn) {
            console.warn("Prompt modal elements not found, falling back to window.prompt.");
            resolve(window.prompt(message));
            return;
        }

        promptModalTitle.textContent = title;
        promptModalText.textContent = message;
        promptModalInput.value = '';
        promptModalInput.placeholder = placeholder;
        promptModalConfirmBtn.textContent = confirmButtonText;
        promptModalCancelBtn.textContent = cancelButtonText;

        promptModal.classList.add('active');
        promptModalInput.focus();

        const handleConfirm = () => {
            promptModal.classList.remove('active');
            promptModalConfirmBtn.removeEventListener('click', handleConfirm);
            promptModalCancelBtn.removeEventListener('click', handleCancel);
            promptModal.removeEventListener('click', handleOverlayClick);
            resolve(promptModalInput.value);
        };

        const handleCancel = () => {
            promptModal.classList.remove('active');
            promptModalConfirmBtn.removeEventListener('click', handleConfirm);
            promptModalCancelBtn.removeEventListener('click', handleCancel);
            promptModal.removeEventListener('click', handleOverlayClick);
            resolve(null);
        };

        const handleOverlayClick = (event) => {
            if (event.target === promptModal) {
                handleCancel();
            }
        };

        promptModalConfirmBtn.addEventListener('click', handleConfirm);
        promptModalCancelBtn.addEventListener('click', handleCancel);
        promptModal.addEventListener('click', handleOverlayClick);

        promptModalInput.addEventListener('keypress', function(event) {
            if (event.key === 'Enter') {
                event.preventDefault();
                handleConfirm();
            }
        });
    });
}

/**
 * Displays an inline message within the UI.
 * @param {string} message - The message to display.
 * @param {string} type - 'success', 'error', 'warning', or 'info'.
 * @param {number} [autoDismissDelay=2500] - Delay in milliseconds before message dismisses. 0 for manual dismiss.
 */
export function showInlineMessageUI(message, type = "info", autoDismissDelay = null) {
    if (!inlineMessageDisplay) {
        console.warn("inlineMessageDisplay element not found. Cannot show inline message.");
        return;
    }
    const messageParagraph = inlineMessageDisplay.querySelector('p');
    if (!messageParagraph) return;

    if (inlineMessageDisplay.timeoutId) {
        clearTimeout(inlineMessageDisplay.timeoutId);
    }

    messageParagraph.textContent = message;

    messageParagraph.className = 'py-1 px-3 rounded-full shadow-md bengali ';
    if (type === 'success') {
        messageParagraph.classList.add('bg-green-100', 'text-green-800');
    } else if (type === 'error') {
        messageParagraph.classList.add('bg-red-100', 'text-red-800');
    } else if (type === 'warning') {
        messageParagraph.classList.add('bg-yellow-100', 'text-yellow-800');
    } else {
        messageParagraph.classList.add('bg-blue-100', 'text-blue-800');
    }

    inlineMessageDisplay.classList.remove('opacity-0', 'invisible');
    inlineMessageDisplay.classList.add('opacity-100', 'visible');

    if (autoDismissDelay !== 0) {
        inlineMessageDisplay.timeoutId = setTimeout(() => {
            inlineMessageDisplay.classList.remove('opacity-100', 'visible');
            inlineMessageDisplay.classList.add('opacity-0', 'invisible');
        }, autoDismissDelay || 2500);
    }
}


/**
 * Renders the list of society members, with optional search filtering and batch selection checkboxes.
 * @param {Map<string, string>} societyMembersMap - Map of member IDs to member names.
 * @param {function} handleDeleteCallback - Callback for deleting a member.
 * @param {function} handleViewStatementCallback - Callback for viewing a member's statement.
 * @param {string} [searchTerm=''] - Optional search term to filter members.
 * @param {Map<string, string>} selectedBatchMembersMap - Map of currently selected members for batch operations.
 * @param {string|null} selectedSingleMemberId - ID of the member selected in the single entry dropdown, if any.
 * @param {string[]} [membersInCurrentReport=[]] - An array of member IDs already in the current report draft.
 */
export function renderSocietyMembersListUI(societyMembersMap, handleDeleteCallback, handleViewStatementCallback, searchTerm = '', selectedBatchMembersMap, selectedSingleMemberId = null, membersInCurrentReport = []) {
    if (!ulSocietyMembers || !memberCountSpan) return;
    ulSocietyMembers.innerHTML = '';

    const fragment = document.createDocumentFragment();
    const sortedMembers = [...societyMembersMap.entries()].sort((a, b) => a[1].localeCompare(b[1], 'bn', { sensitivity: 'base' }));

    let filteredCount = 0;

    sortedMembers.forEach(([id, name]) => {
        if (searchTerm && !name.toLowerCase().includes(searchTerm.toLowerCase())) {
            return;
        }

        filteredCount++;
        const li = document.createElement('li');
        li.className = "flex justify-between items-center py-1";

        const checkboxContainer = document.createElement('div');
        checkboxContainer.className = "flex items-center flex-shrink-0 mr-2";

        const checkbox = document.createElement('input');
        checkbox.type = 'checkbox';
        checkbox.className = 'member-select-checkbox h-4 w-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500';
        checkbox.value = id;
        checkbox.dataset.memberName = name;
        checkbox.checked = selectedBatchMembersMap.has(id);

        const isAlreadyInReport = membersInCurrentReport.includes(id);

        // Disable checkbox if this member is selected in the single entry dropdown OR already in the report.
        if ((selectedSingleMemberId && selectedSingleMemberId === id) || isAlreadyInReport) {
            checkbox.disabled = true;
            checkbox.checked = false; // Ensure it's not checked if disabled
            selectedBatchMembersMap.delete(id); // Remove from batch selection if it becomes disabled
        } else {
            checkbox.disabled = false;
        }

        checkboxContainer.appendChild(checkbox);
        li.appendChild(checkboxContainer);


        const nameSpan = document.createElement('span');
        nameSpan.textContent = name;
        nameSpan.className = "bengali flex-grow theme-text-p";
        li.appendChild(nameSpan);

        const buttonsDiv = document.createElement('div');
        buttonsDiv.className = "flex items-center space-x-2";

        const viewStatementButton = document.createElement('button');
        viewStatementButton.innerHTML = '📄বিবৃতি';
        viewStatementButton.title = "সদস্যের বিবৃতি দেখুন";
        viewStatementButton.className = "bengali text-xs px-2 py-1 rounded border theme-text-info theme-border-color hover:bg-blue-50";
        viewStatementButton.onclick = () => handleViewStatementCallback(id, name);
        buttonsDiv.appendChild(viewStatementButton);

        const deleteButton = document.createElement('button');
        deleteButton.innerHTML = '🗑️ মুছুন';
        deleteButton.title = "সদস্য মুছুন";
        deleteButton.className = "bengali text-xs px-2 py-1 rounded border theme-text-danger theme-border-color hover:bg-red-50";
        deleteButton.onclick = () => handleDeleteCallback(id, name);
        buttonsDiv.appendChild(deleteButton);

        li.appendChild(buttonsDiv);
        fragment.appendChild(li);
    });

    ulSocietyMembers.appendChild(fragment);
    memberCountSpan.textContent = filteredCount;

    if (filteredCount === 0) {
        ulSocietyMembers.innerHTML = '<li class="theme-text-muted bengali text-center py-4">কোনো সদস্য খুঁজে পাওয়া হয়নি।</li>';
    }
}

export function populateReportEntryMemberDropdownUI(fullSocietyMembersMap, currentReportEntryMemberIds = []) {
    if (!reportMemberNameSelect) return;
    reportMemberNameSelect.innerHTML = '<option value="" class="bengali">-- বিদ্যমান সদস্য নির্বাচন করুন --</option>';
    const availableMembers = new Map();
    for (const [id, name] of fullSocietyMembersMap.entries()) {
        if (!currentReportEntryMemberIds.includes(id)) {
            availableMembers.set(id, name);
        }
    }
    if (availableMembers.size === 0 && fullSocietyMembersMap.size > 0 && currentReportEntryMemberIds.length > 0) {
        const option = document.createElement('option');
        option.textContent = "সব সদস্য ইতিমধ্যে যুক্ত";
        option.disabled = true;
        option.className = "bengali";
        reportMemberNameSelect.appendChild(option);
        return;
    }
     if (availableMembers.size === 0 && fullSocietyMembersMap.size === 0) {
        const option = document.createElement('option');
        option.textContent = "কোনো সদস্য উপলব্ধ নেই";
        option.disabled = true;
        option.className = "bengali";
        reportMemberNameSelect.appendChild(option);
        return;
    }
    const sortedMembers = [...availableMembers.entries()].sort((a, b) => a[1].localeCompare(b[1], 'bn', { sensitivity: 'base' }));
    sortedMembers.forEach(([id, name]) => {
        const option = document.createElement('option');
        option.value = id;
        option.textContent = name;
        option.className = "bengali";
        reportMemberNameSelect.appendChild(option);
    });
}

export function populateMonthDropdownUI() {
    if (!reportMonthSelectUI) return;
    reportMonthSelectUI.innerHTML = '';
    banglaMonthsForUI.forEach(month => {
        const option = document.createElement('option');
        option.value = month;
        option.textContent = month;
        option.className = "bengali";
        reportMonthSelectUI.appendChild(option);
    });
    const currentMonthIndex = new Date().getMonth();
    if (reportMonthSelectUI.options[currentMonthIndex]) {
        reportMonthSelectUI.value = banglaMonthsForUI[currentMonthIndex];
    } else if (banglaMonthsForUI.length > 0) {
        reportMonthSelectUI.value = banglaMonthsForUI[0];
    }
}

/**
 * Populates a year dropdown (select element) with a range of years.
 * @param {HTMLSelectElement} selectElement - The select element to populate.
 * @param {number} startYear - The earliest year to include.
 * @param {number} endYear - The latest year to include.
 * @param {number} [currentYear] - The year to set as default selected. Defaults to current actual year.
 */
export function populateYearDropdownUI(selectElement, startYear, endYear, currentYear = new Date().getFullYear()) {
    if (!selectElement) return;
    selectElement.innerHTML = ''; // Clear existing options

    // Ensure years are in descending order as typically desired for reports
    for (let year = endYear; year >= startYear; year--) {
        const option = document.createElement('option');
        option.value = String(year);
        option.textContent = String(year);
        option.className = "bengali";
        if (year === currentYear) {
            option.selected = true;
        }
        selectElement.appendChild(option);
    }
}


export function renderCurrentReportEntriesPreviewUI(currentReportEntriesArray, handleDeleteSingleEntryCallback) {
    if (!ulCurrentReportEntries || !currentReportEntryCountSpan) return;
    ulCurrentReportEntries.innerHTML = '';
    currentReportEntryCountSpan.textContent = currentReportEntriesArray.length;

    if (currentReportEntriesArray.length === 0) {
        ulCurrentReportEntries.innerHTML = '<li class="theme-text-muted bengali">এই রিপোর্টে এখনও কোনও এন্ট্রি যুক্ত করা হয়নি।</li>';
        return;
    }

    const fragment = document.createDocumentFragment();
    currentReportEntriesArray.forEach((entry, index) => {
        const li = document.createElement('li');
        li.className = "flex justify-between items-center py-1 bengali theme-text-p";

        const entryText = document.createElement('span');
        entryText.textContent = `${index + 1}. ${entry.memberName} (সঞ্চয় জমা: ${Number(entry.savings || 0).toFixed(2)}, সঞ্চয় উত্তোলন: ${Number(entry.savingsWithdrawal || 0).toFixed(2)}, ঋণ বিতরণ: ${Number(entry.loanDisbursed || 0).toFixed(2)}, ঋণ পরিশোধ: ${Number(entry.loanRepayment || 0).toFixed(2)})`;
        li.appendChild(entryText);

        const deleteButton = document.createElement('button');
        deleteButton.innerHTML = '🗑️ মুছুন';
        deleteButton.title = "এন্ট্রি মুছুন";
        deleteButton.className = "text-xs ml-2 px-1 rounded border theme-text-danger theme-border-color hover:bg-red-50";
        deleteButton.onclick = () => handleDeleteSingleEntryCallback(index);
        li.appendChild(deleteButton);

        fragment.appendChild(li);
    });
    ulCurrentReportEntries.appendChild(fragment);
}

export function updateOverallFinancialStatusDisplayUI(cumulativeTotalsData, memberCount) {
    if (totalSavingsDisplay) {
        const savings = Number(cumulativeTotalsData?.savings || 0);
        totalSavingsDisplay.textContent = `${savings.toFixed(2)} টাকা`;
    }
    if (totalLoanDisplay) {
        const loan = Number(cumulativeTotalsData?.loan || 0);
        totalLoanDisplay.textContent = `${loan.toFixed(2)} টাকা`;
    }
    if (currentCashDisplay) {
        const savings = Number(cumulativeTotalsData?.savings || 0);
        const loan = Number(cumulativeTotalsData?.loan || 0);
        const cash = savings - loan;
        currentCashDisplay.textContent = `${cash.toFixed(2)} টাকা`;
    }

    if (dashboardMemberCountDisplay && typeof memberCount !== 'undefined') {
        dashboardMemberCountDisplay.textContent = `${memberCount} জন`;
    }
}

export function updateCurrentDateDisplayUI() {
    if (!currentDateDisplay) return;
    const today = new Date();
    const datePart = today.toLocaleDateString('bn-BD', { year: 'numeric', month: 'long', day: 'numeric' });
    const weekdayPart = today.toLocaleDateString('bn-BD', { weekday: 'long' });
    currentDateDisplay.textContent = `${datePart}, ${weekdayPart}`;
}


export function renderReportToHtmlUI(
    entriesToRender,
    monthlyNetSavings,
    monthlyLoanDisbursed,
    monthlyLoanRepaid,
    cumulativeSnapshot,
    assocNameParam,
    rptMonthParam,
    rptYearParam,
    currentGlobalTotals,
    monthlyTotalSavingsDeposit,
    monthlyTotalSavingsWithdrawal,
    createdAtDate,
    updatedAtDate,
    societyMembersMap // New parameter to pass active members
) {
    if (!reportOutputDiv) {
        console.error("reportOutputDiv not found in renderReportToHtmlUI");
        return "";
    }

    console.log("renderReportToHtmlUI received createdAtDate:", createdAtDate, "Type:", typeof createdAtDate, "IsDate:", createdAtDate instanceof Date);
    console.log("renderReportToHtmlUI received updatedAtDate:", updatedAtDate, "Type:", typeof updatedAtDate, "IsDate:", updatedAtDate instanceof Date);

    let html = '';

    const associationName = (typeof assocNameParam === 'string' && assocNameParam.trim() !== '') ? assocNameParam : "আল-বারাকাহ সহায়ক সমিতি";
    const reportMonth = (typeof rptMonthParam === 'string' && rptMonthParam.trim() !== '') ? rptMonthParam : (document.getElementById('reportMonthSelect')?.value || "মাস");
    const reportYear = (typeof rptYearParam === 'string' || typeof rptYearParam === 'number') && String(rptYearParam).trim() !== '' ? String(rptYearParam) : (document.getElementById('reportYearSelect')?.value || "বছর");

    html += `<h2 class="text-xl md:text-2xl font-bold text-center mb-1 bengali theme-text-h1">${associationName} : মাস ${reportMonth} (${reportYear})</h2>`;
    html += `<div class="text-xs theme-text-muted mt-0 mb-3 text-center bengali">`; // Start of date info div
    if (createdAtDate && createdAtDate instanceof Date && !isNaN(createdAtDate.getTime())) {
        html += `<p>রিপোর্ট তৈরির তারিখ: ${formatBengaliDateTime(createdAtDate)}</p>`;
    } else {
        console.warn("createdAtDate is not a valid Date object for rendering in HTML report:", createdAtDate);
    }

    if (updatedAtDate && updatedAtDate instanceof Date && !isNaN(updatedAtDate.getTime())) {
        if (createdAtDate && createdAtDate instanceof Date && !isNaN(createdAtDate.getTime()) && Math.abs(updatedAtDate.getTime() - createdAtDate.getTime()) > 5000) {
            html += `<p>সর্বশেষ সম্পাদনার তারিখ: ${formatBengaliDateTime(updatedAtDate)}</p>`;
        } else if (!createdAtDate && updatedAtDate) {
             html += `<p>আপডেট তারিখ: ${formatBengaliDateTime(updatedAtDate)}</p>`;
        }
    } else {
         if (updatedAtDate) console.warn("updatedAtDate is not a valid Date object for rendering in HTML report:", updatedAtDate);
    }
    html += `</div>`; // End of date info div


    html += '<table class="min-w-full table-bordered bg-white text-sm shadow-md">';
    html += `<thead class="bg-gray-100 theme-section-bg"><tr>
                <th class="px-3 py-2 text-left text-xs font-medium theme-text-label uppercase tracking-wider bengali">ক্রমিক নং</th>
                <th class="px-3 py-2 text-left text-xs font-medium theme-text-label uppercase tracking-wider bengali">সদস্যের নাম</th>
                <th class="px-3 py-2 text-right text-xs font-medium theme-text-label uppercase tracking-wider bengali">সঞ্চয় জমা (টাকা)</th>
                <th class="px-3 py-2 text-right text-xs font-medium theme-text-label uppercase tracking-wider bengali">সঞ্চয় উত্তোলন (টাকা)</th>
                <th class="px-3 py-2 text-right text-xs font-medium theme-text-label uppercase tracking-wider bengali">ঋণ বিতরণ (টাকা)</th>
                <th class="px-3 py-2 text-right text-xs font-medium theme-text-label uppercase tracking-wider bengali">ঋণ পরিশোধ (টাকা)</th>
                <th class="px-3 py-2 text-left text-xs font-medium theme-text-label uppercase tracking-wider bengali">মন্তব্য/স্বাক্ষর</th>
            </tr></thead>`;

    html += '<tbody class="bg-white divide-y theme-divide-color">';
    if (!entriesToRender || entriesToRender.length === 0) {
         html += `<tr><td colspan="7" class="text-center py-4 theme-text-muted bengali">এই রিপোর্টের জন্য কোনও এন্ট্রি নেই।</td></tr>`;
    } else {
        entriesToRender.forEach((entry, index) => {
            const isMemberActive = societyMembersMap.has(entry.memberId);
            const rowClass = isMemberActive ? "hover:bg-gray-50" : "bg-gray-100 text-gray-400 italic";
            const commentText = isMemberActive ? "" : "সদস্য মুছে ফেলা হয়েছে";

            html += `<tr class="${rowClass}">
                        <td class="px-3 py-2 whitespace-nowrap theme-text-p">${index + 1}</td>
                        <td class="px-3 py-2 whitespace-nowrap bengali theme-text-p">${entry.memberName}</td>
                        <td class="px-3 py-2 whitespace-nowrap text-right bengali theme-text-p">${Number(entry.savings || 0).toFixed(2)}</td>
                        <td class="px-3 py-2 whitespace-nowrap text-right bengali theme-text-p">${Number(entry.savingsWithdrawal || 0).toFixed(2)}</td>
                        <td class="px-3 py-2 whitespace-nowrap text-right bengali theme-text-p">${Number(entry.loanDisbursed || 0).toFixed(2)}</td>
                        <td class="px-3 py-2 whitespace-nowrap text-right bengali theme-text-p">${Number(entry.loanRepayment || 0).toFixed(2)}</td>
                        <td class="px-3 py-2 whitespace-nowrap theme-text-p">${commentText}</td>
                     </tr>`;
        });
    }
    html += '</tbody>';

    html += '<tfoot class="bg-gray-100 font-semibold theme-text-h4 theme-section-bg">';
    html += `<tr>
                <td colspan="2" class="px-3 py-2 text-right bengali">মাসিক মোট:</td>
                <td class="px-3 py-2 text-right bengali">${(Number(monthlyTotalSavingsDeposit) || 0).toFixed(2)}</td>
                <td class="px-3 py-2 text-right bengali">${(Number(monthlyTotalSavingsWithdrawal) || 0).toFixed(2)}</td>
                <td class="px-3 py-2 text-right bengali">${(Number(monthlyLoanDisbursed) || 0).toFixed(2)}</td>
                <td class="px-3 py-2 text-right bengali">${(Number(monthlyLoanRepaid) || 0).toFixed(2)}</td>
                <td class="px-3 py-2"></td>
             </tr>`;
    html += `<tr>
                <td colspan="3" class="px-3 py-2 text-right bengali theme-text-label">এই মাসের নেট সঞ্চয়:</td>
                <td colspan="2" class="px-3 py-2 text-right bengali theme-text-info">${(Number(monthlyNetSavings) || 0).toFixed(2)}</td>
                <td colspan="2"></td>
            </tr>`;

    const displayCumulativeSavings = (cumulativeSnapshot && typeof cumulativeSnapshot.savings !== 'undefined')
        ? Number(cumulativeSnapshot.savings)
        : Number(currentGlobalTotals?.savings || 0);
    const displayCumulativeLoan = (cumulativeSnapshot && typeof cumulativeSnapshot.loan !== 'undefined')
        ? Number(cumulativeSnapshot.loan)
        : Number(currentGlobalTotals?.loan || 0);

    html += `<tr>
                <td colspan="5" class="px-3 py-2 text-right font-semibold bengali theme-text-label">সমিতির মোট সঞ্চয় (ক্রমসঞ্চিত):</td>
                <td colspan="2" class="px-3 py-2 text-right font-semibold theme-text-h4">${(displayCumulativeSavings || 0).toFixed(2)}</td>
             </tr>`;
    html += `<tr>
                <td colspan="5" class="px-3 py-2 text-right font-semibold bengali theme-text-label">সমিতির মোট ঋণ (ক্রমসঞ্চিত):</td>
                <td colspan="2" class="px-3 py-2 text-right font-semibold theme-text-h4">${(displayCumulativeLoan || 0).toFixed(2)}</td>
             </tr>`;
    html += '</tfoot></table>';
    reportOutputDiv.innerHTML = html;
}

export function populatePreviousReportsDropdownUI(reportsArray, loadCallback, editCallback, deleteCallback) {
    const container = document.getElementById('previousReportsListContainer');
    if (!container) {
        console.warn("previousReportsListContainer not found in UI. Cannot display previous reports list.");
        const oldSelect = document.getElementById('previousReportsSelect');
        if (oldSelect) oldSelect.innerHTML = '<option value="" class="bengali">রিপোর্ট তালিকা দেখানোর স্থান পাওয়া যায়নি।</option>';

        const oldLoadBtn = document.getElementById('loadPreviousReportBtn');
        if(oldLoadBtn) oldLoadBtn.style.display = 'none';
        return;
    }
    container.innerHTML = '';

    if (!reportsArray || reportsArray.length === 0) {
        container.innerHTML = '<p class="bengali theme-text-muted">কোনো রিপোর্ট সংরক্ষিত নেই।</p>';
        return;
    }

    const oldLoadBtn = document.getElementById('loadPreviousReportBtn');
    if(oldLoadBtn) oldLoadBtn.style.display = 'none';

    const ul = document.createElement('ul');
    ul.className = 'space-y-2 max-h-60 overflow-y-auto theme-divide-color divide-y pr-2';

    reportsArray.forEach((report) => {
        const li = document.createElement('li');
        li.className = 'flex justify-between items-center py-2 theme-text-p';
        li.setAttribute('data-report-id', report.id);

        const reportInfoSpan = document.createElement('span');
        let createdDate = null;
        if (report.createdAt?.toDate) {
            createdDate = report.createdAt.toDate();
        } else if (report.createdAt instanceof Date) {
            createdDate = report.createdAt;
        }
        const dateString = createdDate ? formatBengaliDateTime(createdDate).split(',')[0] : 'তারিখ নেই';

        reportInfoSpan.textContent = `${report.month || 'মাস অজানা'} ${report.year || 'বছর অজানা'} (তৈরিঃ ${dateString})`;
        reportInfoSpan.className = 'bengali cursor-pointer hover:underline theme-text-link flex-grow mr-2';
        reportInfoSpan.onclick = () => loadCallback(report.id);
        li.appendChild(reportInfoSpan);

        const buttonsDiv = document.createElement('div');
        buttonsDiv.className = 'flex space-x-1 items-center flex-shrink-0';

        const editButton = document.createElement('button');
        editButton.innerHTML = '✏️';
        editButton.title = "সম্পাদনা করুন";
        editButton.className = "bengali text-xs p-1 rounded border theme-button-neutral hover:bg-gray-100";
        editButton.onclick = (e) => {
            e.stopPropagation();
            if(editCallback) editCallback(report.id, report.month, report.year);
        };
        buttonsDiv.appendChild(editButton);

        const deleteButton = document.createElement('button');
        deleteButton.innerHTML = '🗑️';
        deleteButton.title = "মুছে ফেলুন";
        deleteButton.className = "bengali text-xs p-1 rounded border theme-button-danger hover:bg-red-100";
        deleteButton.onclick = (e) => {
            e.stopPropagation();
            if(deleteCallback) deleteCallback(report.id, report.month, report.year);
        };
        buttonsDiv.appendChild(deleteButton);

        li.appendChild(buttonsDiv);
        ul.appendChild(li);
    });
    container.appendChild(ul);
}


export function setReportOutputHTML(htmlContent) {
    if (reportOutputDiv) {
        reportOutputDiv.innerHTML = htmlContent;
    }
}

export function renderAnnualReportUI(year, monthlyData, yearlyTotals, startOfYearTotals, endOfYearTotals, memberSummaries) {
    if (!reportOutputDiv) {
        console.error("reportOutputDiv not found in uiHandler for Annual Report");
        return;
    }

    let html = `<h2 class="text-xl md:text-2xl font-bold text-center mb-1 bengali theme-text-h1">${year} সালের বার্ষিক রিপোর্ট তৈরি হয়েছে।</h2>`;
    html += `<div class="text-xs theme-text-muted mt-0 mb-3 text-center bengali"><p>রিপোর্ট তৈরির তারিখ: ${formatBengaliDateTime(new Date())}</p></div>`;


    html += `<div class="mb-6 p-4 border rounded-md shadow-md theme-section-bg theme-border-color">`;
    html += `<h3 class="text-lg font-semibold mb-3 bengali theme-text-h2">বার্ষিক সারাংশ</h3>`;
    html += `<div class="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-2 text-sm">`;
    html += `<div class="font-medium bengali theme-text-label">বছরের শুরুতে মোট সঞ্চয়:</div> <div class="bengali text-right sm:text-left theme-text-p">${Number(startOfYearTotals.savings || 0).toFixed(2)} টাকা</div>`;
    html += `<div class="font-medium bengali theme-text-label">বছরের শুরুতে মোট ঋণ:</div> <div class="bengali text-right sm:text-left theme-text-p">${Number(startOfYearTotals.loan || 0).toFixed(2)} টাকা</div>`;
    html += `<div class="col-span-full"><hr class="my-2 theme-divide-color"></div>`;
    html += `<div class="font-medium bengali theme-text-label">এই বছরে মোট সঞ্চয় জমা:</div> <div class="bengali text-right sm:text-left theme-text-p">${Number(yearlyTotals.savingsDeposit || 0).toFixed(2)} টাকা</div>`;
    html += `<div class="font-medium bengali theme-text-label">এই বছরে মোট সঞ্চয় উত্তোলন:</div> <div class="bengali text-right sm:text-left theme-text-p">${Number(yearlyTotals.savingsWithdrawal || 0).toFixed(2)} টাকা</div>`;
    html += `<div class="font-medium bengali theme-text-label">এই বছরে নেট সঞ্চয় পরিবর্তন:</div> <div class="bengali text-right sm:text-left ${ (yearlyTotals.savings || 0) >= 0 ? 'theme-text-success' : 'theme-text-danger'} font-semibold">${Number(yearlyTotals.savings || 0).toFixed(2)} টাকা</div>`;
    html += `<div class="font-medium bengali theme-text-label">এই বছরে মোট ঋণ বিতরণ:</div> <div class="bengali text-right sm:text-left theme-text-p">${Number(yearlyTotals.loanDisbursed || 0).toFixed(2)} টাকা</div>`;
    html += `<div class="font-medium bengali theme-text-label">এই বছরে মোট ঋণ পরিশোধ:</div> <div class="bengali text-right sm:text-left theme-text-p">${Number(yearlyTotals.loanRepaid || 0).toFixed(2)} টাকা</div>`;
    html += `<div class="font-medium bengali theme-text-label">এই বছরে নেট ঋণ পরিবর্তন:</div> <div class="bengali text-right sm:text-left ${ (yearlyTotals.netLoanChange || 0) >= 0 ? 'theme-text-danger' : 'theme-text-success'} font-semibold">${Number(yearlyTotals.netLoanChange || 0).toFixed(2)} টাকা</div>`;
    html += `<div class="col-span-full"><hr class="my-2 theme-divide-color"></div>`;
    html += `<div class="font-medium bengali theme-text-label">বছরের শেষে মোট সঞ্চয়:</div> <div class="bengali text-right sm:text-left font-bold theme-text-h4">${Number(endOfYearTotals.savings || 0).toFixed(2)} টাকা</div>`;
    html += `<div class="font-medium bengali theme-text-label">বছরের শেষে মোট ঋণ:</div> <div class="bengali text-right sm:text-left font-bold theme-text-h4">${Number(endOfYearTotals.loan || 0).toFixed(2)} টাকা</div>`;
    html += `</div></div>`;

    html += `<h3 class="text-lg font-semibold mt-6 mb-3 bengali theme-text-h2">মাসিক বিস্তারিত বিবরণ</h3>`;
    html += '<table class="min-w-full table-bordered bg-white text-sm shadow-md">';
    html += `<thead class="bg-gray-100 theme-section-bg"><tr>
                <th class="px-3 py-2 text-left text-xs font-medium theme-text-label uppercase tracking-wider bengali">মাস</th>
                <th class="px-3 py-2 text-right text-xs font-medium theme-text-label uppercase tracking-wider bengali">মাসিক সঞ্চয় জমা</th>
                <th class="px-3 py-2 text-right text-xs font-medium theme-text-label uppercase tracking-wider bengali">মাসিক সঞ্চয় উত্তোলন</th>
                <th class="px-3 py-2 text-right text-xs font-medium theme-text-label uppercase tracking-wider bengali">মাসিক ঋণ বিতরণ</th>
                <th class="px-3 py-2 text-right text-xs font-medium theme-text-label uppercase tracking-wider bengali">মাসিক ঋণ পরিশোধ</th>
                <th class="px-3 py-2 text-right text-xs font-medium theme-text-label uppercase tracking-wider bengali">মাস শেষে ক্রম. সঞ্চয়</th>
                <th class="px-3 py-2 text-right text-xs font-medium theme-text-label uppercase tracking-wider bengali">মাস শেষে ক্রম. ঋণ</th>
            </tr></thead>`;
    html += '<tbody class="bg-white divide-y theme-divide-color">';

    if (!monthlyData || monthlyData.length === 0) {
        html += `<tr><td colspan="7" class="text-center py-4 theme-text-muted bengali">${year} সালের জন্য কোনও মাসিক রিপোর্ট পাওয়া হয়নি।</td></tr>`;
    } else {
        monthlyData.sort((a, b) => banglaMonthsForUI.indexOf(a.month) - banglaMonthsForUI.indexOf(b.month));
        monthlyData.forEach(data => {
            html += `<tr class="hover:bg-gray-50">
                        <td class="px-3 py-2 whitespace-nowrap bengali theme-text-p">${data.month}</td>
                        <td class="px-3 py-2 whitespace-nowrap text-right bengali theme-text-p">${Number(data.monthlySavingsDeposit || 0).toFixed(2)}</td>
                        <td class="px-3 py-2 whitespace-nowrap text-right bengali theme-text-p">${Number(data.monthlySavingsWithdrawal || 0).toFixed(2)}</td>
                        <td class="px-3 py-2 whitespace-nowrap text-right bengali theme-text-p">${Number(data.monthlyLoanDisbursed || 0).toFixed(2)}</td>
                        <td class="px-3 py-2 whitespace-nowrap text-right bengali theme-text-p">${Number(data.monthlyLoanRepaid || 0).toFixed(2)}</td>
                        <td class="px-3 py-2 whitespace-nowrap text-right bengali theme-text-p">${Number(data.cumulativeSavingsAtEndOfMonth || 0).toFixed(2)}</td>
                        <td class="px-3 py-2 whitespace-nowrap text-right bengali theme-text-p">${Number(data.cumulativeLoanAtEndOfMonth || 0).toFixed(2)}</td>
                     </tr>`;
        });
    }
    html += '</tbody></table>';

    if (memberSummaries && memberSummaries.length > 0) {
        html += `<h3 class="text-lg font-semibold mt-8 mb-3 bengali theme-text-h2">${year} সালের শেষে সদস্যদের সারাংশ</h3>`;
        html += '<table class="min-w-full table-bordered bg-white text-sm shadow-md">';
        html += `<thead class="bg-gray-100 theme-section-bg"><tr>
                    <th class="px-3 py-2 text-left text-xs font-medium theme-text-label uppercase tracking-wider bengali">ক্রমিক নং</th>
                    <th class="px-3 py-2 text-left text-xs font-medium theme-text-label uppercase tracking-wider bengali">সদস্যের নাম</th>
                    <th class="px-3 py-2 text-right text-xs font-medium theme-text-label uppercase tracking-wider bengali">মোট সঞ্চয় (নেট)</th>
                    <th class="px-3 py-2 text-right text-xs font-medium theme-text-label uppercase tracking-wider bengali">মোট ঋণ (অবশিষ্ট)</th>
                </tr></thead>`;
        html += '<tbody class="bg-white divide-y theme-divide-color">';
        memberSummaries.forEach((member, index) => {
            html += `<tr class="hover:bg-gray-50">
                        <td class="px-3 py-2 whitespace-nowrap theme-text-p">${index + 1}</td>
                        <td class="px-3 py-2 whitespace-nowrap bengali theme-text-p">${member.memberName}</td>
                        <td class="px-3 py-2 whitespace-nowrap text-right bengali theme-text-p">${Number(member.totalSavings || 0).toFixed(2)}</td>
                        <td class="px-3 py-2 whitespace-nowrap text-right bengali theme-text-p">${Number(member.totalLoan || 0).toFixed(2)}</td>
                     </tr>`;
        });
    } else if (memberSummaries) {
         html += `<p class="mt-4 theme-text-muted bengali">${year} সালের জন্য কোনো সদস্যের সারাংশ পাওয়া যায়নি।</p>`;
    }


    reportOutputDiv.innerHTML = html;
}

export function populateStatementMemberDropdownUI(societyMembersMap) {
    const statementMemberSelectUI = document.getElementById('statementMemberSelect');
    if (!statementMemberSelectUI) {
        return;
    }
}

export function renderMemberStatementUI(memberName, transactions, societyName) {
    if (!reportOutputDiv) {
        console.error("reportOutputDiv not found in uiHandler for Member Statement");
        return;
    }

    let html = `<h2 class="text-xl md:text-2xl font-bold text-center mb-1 bengali theme-text-h1">${societyName}</h2>`;
    html += `<h3 class="text-lg md:text-xl font-semibold text-center mb-1 bengali theme-text-h2">সদস্য বিবৃতি: ${memberName}</h3>`;
    html += `<div class="text-xs theme-text-muted mt-0 mb-3 text-center bengali"><p>বিবৃতি তৈরির তারিখ: ${formatBengaliDateTime(new Date())}</p></div>`;


    html += '<table class="min-w-full table-bordered bg-white text-sm shadow-md">';
    html += `<thead class="bg-gray-100 theme-section-bg"><tr>
                <th class="px-3 py-2 text-left text-xs font-medium theme-text-label uppercase tracking-wider bengali">তারিখ (রিপোর্ট)</th>
                <th class="px-3 py-2 text-left text-xs font-medium theme-text-label uppercase tracking-wider bengali">বিবরণ</th>
                <th class="px-3 py-2 text-right text-xs font-medium theme-text-label uppercase tracking-wider bengali">সঞ্চয় জমা (টাকা)</th>
                <th class="px-3 py-2 text-right text-xs font-medium theme-text-label uppercase tracking-wider bengali">সঞ্চয় উত্তোলন (টাকা)</th>
                <th class="px-3 py-2 text-right text-xs font-medium theme-text-label uppercase tracking-wider bengali">ঋণ বিতরণ (টাকা)</th>
                <th class="px-3 py-2 text-right text-xs font-medium theme-text-label uppercase tracking-wider bengali">ঋণ পরিশোধ (টাকা)</th>
            </tr></thead>`;
    html += '<tbody class="bg-white divide-y theme-divide-color">';

    if (!transactions || transactions.length === 0) {
        html += `<tr><td colspan="6" class="text-center py-4 theme-text-muted bengali">${memberName} এর জন্য কোনও লেনদেন পাওয়া যায়নি।</td></tr>`;
    } else {
        transactions.forEach(tx => {
            html += `<tr class="hover:bg-gray-50">
                        <td class="px-3 py-2 whitespace-nowrap bengali theme-text-p">${tx.reportDate}</td>
                        <td class="px-3 py-2 whitespace-nowrap bengali theme-text-p">${tx.description}</td>
                        <td class="px-3 py-2 whitespace-nowrap text-right bengali theme-text-p">${tx.type === 'savings_deposit' ? Number(tx.savings_deposit || 0).toFixed(2) : '-'}</td>
                        <td class="px-3 py-2 whitespace-nowrap text-right bengali theme-text-p">${tx.type === 'savings_withdrawal' ? Number(tx.savings_withdrawal || 0).toFixed(2) : '-'}</td>
                        <td class="px-3 py-2 whitespace-nowrap text-right bengali theme-text-p">${tx.type === 'loan_disbursed' ? Number(tx.loan_disbursed || 0).toFixed(2) : '-'}</td>
                        <td class="px-3 py-2 whitespace-nowrap text-right bengali theme-text-p">${tx.type === 'loan_repayment' ? Number(tx.loan_repayment || 0).toFixed(2) : '-'}</td>
                     </tr>`;
        });
    }
    html += '</tbody></table>';

    let totalMemberSavingsDeposit = 0;
    let totalMemberSavingsWithdrawal = 0;
    let totalMemberLoanDisbursed = 0;
    let totalMemberLoanRepaid = 0;

    (transactions || []).forEach(tx => {
        if (tx.type === 'savings_deposit') totalMemberSavingsDeposit += Number(tx.savings_deposit || 0);
        if (tx.type === 'savings_withdrawal') totalMemberSavingsWithdrawal += Number(tx.savings_withdrawal || 0);
        if (tx.type === 'loan_disbursed') totalMemberLoanDisbursed += Number(tx.loan_disbursed || 0);
        if (tx.type === 'loan_repayment') totalMemberLoanRepaid += Number(tx.loan_repayment || 0);
    });
    const netMemberSavings = totalMemberSavingsDeposit - totalMemberSavingsWithdrawal;
    const netOutstandingLoan = totalMemberLoanDisbursed - totalMemberLoanRepaid;

    html += `<div class="mt-6 p-4 border rounded-md shadow-md theme-section-bg theme-border-color">`;
    html += `<h4 class="text-md font-semibold mb-2 bengali theme-text-h4">${memberName} এর মোট সারাংশ:</h4>`;
    html += `<p class="bengali theme-text-p"><strong>মোট সঞ্চয় জমা:</strong> ${totalMemberSavingsDeposit.toFixed(2)} টাকা</p>`;
    html += `<p class="bengali theme-text-p"><strong>মোট সঞ্চয় উত্তোলন:</strong> ${totalMemberSavingsWithdrawal.toFixed(2)} টাকা</p>`;
    html += `<p class="bengali theme-text-p"><strong>বর্তমান নেট সঞ্চয়:</strong> ${netMemberSavings.toFixed(2)} টাকা</p>`;
    html += `<p class="bengali theme-text-p"><strong>মোট ঋণ বিতরণ:</strong> ${totalMemberLoanDisbursed.toFixed(2)} টাকা</p>`;
    html += `<p class="bengali theme-text-p"><strong>মোট ঋণ পরিশোধ:</strong> ${totalMemberLoanRepaid.toFixed(2)} টাকা</p>`;
    html += `<p class="bengali theme-text-p"><strong>বর্তমান অবশিষ্ট ঋণ:</strong> ${netOutstandingLoan.toFixed(2)} টাকা</p>`;
    html += `</div>`;

    reportOutputDiv.innerHTML = html;
}

export function toggleReportActionButtonsUI(show) {
    if (reportActionButtonsDiv) {
        reportActionButtonsDiv.classList.toggle('hidden', !show);
    } else {
        console.warn("reportActionButtonsDiv not found in toggleReportActionButtonsUI");
    }
};
