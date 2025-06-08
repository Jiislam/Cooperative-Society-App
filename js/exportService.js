// js/exportService.js

const SOCIETY_NAME_FOR_EXPORT = "আল-বারাকাহ সহায়ক সমিতি";

// --- CSV Export Functions ---
function escapeCsvCell(cellData) {
    const stringData = String(cellData === null || cellData === undefined ? '' : cellData);
    if (stringData.includes(',') || stringData.includes('"') || stringData.includes('\n')) {
        return `"${stringData.replace(/"/g, '""')}"`;
    }
    return stringData;
}

function formatMonthlyReportToCsv(reportDetails) {
    const { data, titleInfo } = reportDetails;
    const monthlyTotals = data.monthlyTotals || {
        savingsDeposit: 0, savingsWithdrawal: 0, savings: 0, // savings is net
        loanDisbursed: 0, loanRepaid: 0, netLoanChange: 0
    };
    const entries = data.entries || [];
    const reportCumulativeTotals = data.cumulativeTotalsAtEndOfReport;
    const { associationName, month, year } = titleInfo;

    let csvContent = "\uFEFF";
    csvContent += `${escapeCsvCell(associationName || SOCIETY_NAME_FOR_EXPORT)} : মাস ${escapeCsvCell(month)} (${escapeCsvCell(year)})` + '\r\n';
    csvContent += '\r\n';
    csvContent += "ক্রমিক নং,সদস্যের নাম,সঞ্চয় জমা (টাকা),সঞ্চয় উত্তোলন (টাকা),ঋণ বিতরণ (টাকা),ঋণ পরিশোধ (টাকা),মন্তব্য/স্বাক্ষর\r\n";

    entries.forEach((entry, index) => {
        const row = [
            index + 1,
            entry.memberName,
            Number(entry.savings || 0).toFixed(2), // 'savings' field in entry is deposit
            Number(entry.savingsWithdrawal || 0).toFixed(2),
            Number(entry.loanDisbursed || 0).toFixed(2),
            Number(entry.loanRepayment || 0).toFixed(2),
            ""
        ];
        csvContent += row.map(escapeCsvCell).join(',') + '\r\n';
    });

    csvContent += ` ,মাসিক মোট:,${Number(monthlyTotals.savingsDeposit || 0).toFixed(2)},${Number(monthlyTotals.savingsWithdrawal || 0).toFixed(2)},${Number(monthlyTotals.loanDisbursed || 0).toFixed(2)},${Number(monthlyTotals.loanRepaid || 0).toFixed(2)},\r\n`;
    csvContent += ` , ,নেট সঞ্চয়:,${Number(monthlyTotals.savings || 0).toFixed(2)},নেট ঋণ:,${Number(monthlyTotals.netLoanChange || 0).toFixed(2)},\r\n`;

    if (reportCumulativeTotals) {
        csvContent += ` , , , , ,সমিতির মোট সঞ্চয় (ক্রমসঞ্চিত):,${Number(reportCumulativeTotals.savings || 0).toFixed(2)}\r\n`;
        csvContent += ` , , , , ,সমিতির মোট ঋণ (ক্রমসঞ্চিত):,${Number(reportCumulativeTotals.loan || 0).toFixed(2)}\r\n`;
    }
    return csvContent;
}

function formatAnnualReportToCsv(reportDetails) {
    const { data, titleInfo } = reportDetails;
    const { year, monthlyData, yearlyTotals, startOfYearTotals, endOfYearTotals, memberSummaries } = data; // Added memberSummaries
    const { associationName } = titleInfo;
    const banglaMonthsForUIOrder = [
        "জানুয়ারি", "ফেব্রুয়ারি", "মার্চ", "এপ্রিল", "মে", "জুন",
        "জুলাই", "আগস্ট", "সেপ্টেম্বর", "অক্টোবর", "নভেম্বর", "ডিসেম্বর"
    ];

    let csvContent = "\uFEFF";
    csvContent += `${escapeCsvCell(associationName || SOCIETY_NAME_FOR_EXPORT)} - ${escapeCsvCell(year)} সালের বার্ষিক রিপোর্ট` + '\r\n';
    csvContent += '\r\n';
    csvContent += "বার্ষিক সারাংশ" + '\r\n';
    csvContent += `বছরের শুরুতে মোট সঞ্চয়:,${Number(startOfYearTotals?.savings || 0).toFixed(2)} টাকা\r\n`;
    csvContent += `বছরের শুরুতে মোট ঋণ:,${Number(startOfYearTotals?.loan || 0).toFixed(2)} টাকা\r\n`;
    csvContent += `এই বছরে মোট সঞ্চয় জমা:,${Number(yearlyTotals?.savingsDeposit || 0).toFixed(2)} টাকা\r\n`;
    csvContent += `এই বছরে মোট সঞ্চয় উত্তোলন:,${Number(yearlyTotals?.savingsWithdrawal || 0).toFixed(2)} টাকা\r\n`;
    csvContent += `এই বছরে নেট সঞ্চয় পরিবর্তন:,${Number(yearlyTotals?.savings || 0).toFixed(2)} টাকা\r\n`;
    csvContent += `এই বছরে মোট ঋণ বিতরণ:,${Number(yearlyTotals?.loanDisbursed || 0).toFixed(2)} টাকা\r\n`;
    csvContent += `এই বছরে মোট ঋণ পরিশোধ:,${Number(yearlyTotals?.loanRepaid || 0).toFixed(2)} টাকা\r\n`;
    csvContent += `এই বছরে নেট ঋণ পরিবর্তন:,${Number(yearlyTotals?.netLoanChange || 0).toFixed(2)} টাকা\r\n`;
    csvContent += `বছরের শেষে মোট সঞ্চয়:,${Number(endOfYearTotals?.savings || 0).toFixed(2)} টাকা\r\n`;
    csvContent += `বছরের শেষে মোট ঋণ:,${Number(endOfYearTotals?.loan || 0).toFixed(2)} টাকা\r\n`;
    csvContent += '\r\n';
    csvContent += "মাসিক বিস্তারিত বিবরণ" + '\r\n';
    csvContent += "মাস,মাসিক সঞ্চয় জমা,মাসিক সঞ্চয় উত্তোলন,মাসিক ঋণ বিতরণ,মাসিক ঋণ পরিশোধ,মাস শেষে ক্রম. সঞ্চয়,মাস শেষে ক্রম. ঋণ\r\n";

    const sortedMonthlyData = [...(monthlyData || [])].sort((a, b) =>
        banglaMonthsForUIOrder.indexOf(a.month) - banglaMonthsForUIOrder.indexOf(b.month)
    );

    sortedMonthlyData.forEach(md => {
        const row = [
            md.month,
            Number(md.monthlySavingsDeposit || 0).toFixed(2),
            Number(md.monthlySavingsWithdrawal || 0).toFixed(2),
            Number(md.monthlyLoanDisbursed || 0).toFixed(2),
            Number(md.monthlyLoanRepaid || 0).toFixed(2),
            Number(md.cumulativeSavingsAtEndOfMonth || 0).toFixed(2),
            Number(md.cumulativeLoanAtEndOfMonth || 0).toFixed(2)
        ];
        csvContent += row.map(escapeCsvCell).join(',') + '\r\n';
    });
    csvContent += '\r\n';

    // Add Member Summaries to CSV
    if (memberSummaries && memberSummaries.length > 0) {
        csvContent += `${year} সালের শেষে সদস্যদের সারাংশ` + '\r\n';
        csvContent += "সদস্যের নাম,মোট সঞ্চয় (নেট),মোট ঋণ (অবশিষ্ট)\r\n";
        memberSummaries.forEach(member => {
            const row = [
                member.memberName,
                Number(member.totalSavings || 0).toFixed(2),
                Number(member.totalLoan || 0).toFixed(2)
            ];
            csvContent += row.map(escapeCsvCell).join(',') + '\r\n';
        });
    }

    return csvContent;
}

function formatMemberStatementToCsv(reportDetails) {
    const { data, titleInfo } = reportDetails;
    const { memberName, transactions } = data;
    const { associationName } = titleInfo;

    let csvContent = "\uFEFF";
    csvContent += `${escapeCsvCell(associationName || SOCIETY_NAME_FOR_EXPORT)}` + '\r\n';
    csvContent += `সদস্য বিবৃতি: ${escapeCsvCell(memberName)}` + '\r\n';
    csvContent += '\r\n';
    csvContent += "তারিখ (রিপোর্ট),বিবরণ,সঞ্চয় জমা (টাকা),সঞ্চয় উত্তোলন (টাকা),ঋণ বিতরণ (টাকা),ঋণ পরিশোধ (টাকা)\r\n";

    let totalMemberSavingsDeposit = 0;
    let totalMemberSavingsWithdrawal = 0;
    let totalMemberLoanDisbursed = 0;
    let totalMemberLoanRepaid = 0;

    (transactions || []).forEach(tx => {
        const row = [
            tx.reportDate,
            tx.description,
            tx.type === 'savings_deposit' ? Number(tx.savings_deposit || 0).toFixed(2) : '',
            tx.type === 'savings_withdrawal' ? Number(tx.savings_withdrawal || 0).toFixed(2) : '',
            tx.type === 'loan_disbursement' ? Number(tx.loan_disbursed || 0).toFixed(2) : '',
            tx.type === 'loan_repayment' ? Number(tx.loan_repayment || 0).toFixed(2) : ''
        ];
        csvContent += row.map(escapeCsvCell).join(',') + '\r\n';

        if (tx.type === 'savings_deposit') totalMemberSavingsDeposit += Number(tx.savings_deposit || 0);
        if (tx.type === 'savings_withdrawal') totalMemberSavingsWithdrawal += Number(tx.savings_withdrawal || 0);
        if (tx.type === 'loan_disbursement') totalMemberLoanDisbursed += Number(tx.loan_disbursed || 0);
        if (tx.type === 'loan_repayment') totalMemberLoanRepaid += Number(tx.loan_repayment || 0);
    });

    csvContent += '\r\n';
    csvContent += `মোট সারাংশ: ${escapeCsvCell(memberName)}` + '\r\n';
    csvContent += `মোট সঞ্চয় জমা:,${totalMemberSavingsDeposit.toFixed(2)} টাকা\r\n`;
    csvContent += `মোট সঞ্চয় উত্তোলন:,${totalMemberSavingsWithdrawal.toFixed(2)} টাকা\r\n`;
    csvContent += `নেট সঞ্চয়:,${(totalMemberSavingsDeposit - totalMemberSavingsWithdrawal).toFixed(2)} টাকা\r\n`;
    csvContent += `মোট ঋণ বিতরণ:,${totalMemberLoanDisbursed.toFixed(2)} টাকা\r\n`;
    csvContent += `মোট ঋণ পরিশোধ:,${totalMemberLoanRepaid.toFixed(2)} টাকা\r\n`;
    csvContent += `অবশিষ্ট ঋণ:,${(totalMemberLoanDisbursed - totalMemberLoanRepaid).toFixed(2)} টাকা\r\n`;

    return csvContent;
}

export function exportToCsv(reportData, showMessageCallback) {
    if (!reportData || !reportData.type || !reportData.data || !reportData.titleInfo) {
        if (showMessageCallback) {
            showMessageCallback("CSV এক্সপোর্ট করার জন্য ডেটা সঠিকভাবে লোড হয়নি বা সম্পূর্ণ নয়।", "error", 0);
        } else {
            console.error("CSV export failed: reportData is incomplete.", reportData);
        }
        return;
    }

    let csvContent = "";
    let fileName = "report.csv";
    const { type, titleInfo } = reportData;

    try {
        if (type === 'monthly') {
            csvContent = formatMonthlyReportToCsv(reportData);
            fileName = `${(titleInfo.associationName || SOCIETY_NAME_FOR_EXPORT).replace(/\s+/g, '_')}_${titleInfo.month}_${titleInfo.year}_মাসিক_রিপোর্ট.csv`;
        } else if (type === 'annual') {
            csvContent = formatAnnualReportToCsv(reportData);
            fileName = `${(titleInfo.associationName || SOCIETY_NAME_FOR_EXPORT).replace(/\s+/g, '_')}_${titleInfo.year}_বার্ষিক_রিপোর্ট.csv`;
        } else if (type === 'memberStatement') {
            csvContent = formatMemberStatementToCsv(reportData);
            fileName = `${(titleInfo.associationName || SOCIETY_NAME_FOR_EXPORT).replace(/\s+/g, '_')}_${(titleInfo.memberName || 'member').replace(/\s+/g, '_')}_সদস্য_বিবরণী.csv`;
        } else {
            if (showMessageCallback) showMessageCallback("অজানা রিপোর্ট প্রকার, CSV এক্সপোর্ট করা যাচ্ছে না।", "error", 0);
            return;
        }

        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement("a");
        if (link.download !== undefined) {
            const url = URL.createObjectURL(blob);
            link.setAttribute("href", url);
            link.setAttribute("download", fileName);
            link.style.visibility = 'hidden';
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            URL.revokeObjectURL(url);
            if (showMessageCallback) showMessageCallback("CSV ফাইল সফলভাবে ডাউনলোড হয়েছে!", "success");
        } else {
            if (showMessageCallback) showMessageCallback("আপনার ব্রাউজার সরাসরি ফাইল ডাউনলোড সমর্থন করে না।", "warning", 0);
        }
    } catch (e) {
        console.error("Error during CSV generation or download:", e);
        if (showMessageCallback) showMessageCallback("CSV ফাইল তৈরিতে ত্রুটি হয়েছে।", "error", 0);
    }
}

// --- PDF Export Function ---
export async function exportToPdf(lastRenderedReportData, reportOutputElement, reportActionButtonsElement, showMessageCallback, globalLibraries) {
    const { jsPDF } = globalLibraries.jsPDF;
    const { html2canvas } = globalLibraries;

    if (!reportOutputElement || !reportOutputElement.innerHTML.includes("<table")) {
        if (showMessageCallback) showMessageCallback("পিডিএফ তৈরি করার জন্য প্রথমে একটি রিপোর্ট প্রদর্শন করুন।", "error", 0);
        return;
    }
    if (showMessageCallback) showMessageCallback("পিডিএফ প্রস্তুত করা হচ্ছে...", "info", 3000);

    let buttonsWereVisible = false;
    if (reportActionButtonsElement && !reportActionButtonsElement.classList.contains('hidden')) {
        buttonsWereVisible = true;
        reportActionButtonsElement.classList.add('hidden');
    }

    let fileName = "Report.pdf";
    if (lastRenderedReportData && lastRenderedReportData.type && lastRenderedReportData.titleInfo) {
        const { type, titleInfo } = lastRenderedReportData;
        
        const associationNameStr = typeof titleInfo.associationName === 'string' ? titleInfo.associationName : SOCIETY_NAME_FOR_EXPORT;
        const monthStr = typeof titleInfo.month === 'string' || typeof titleInfo.month === 'number' ? String(titleInfo.month) : "UnknownMonth";
        const yearStr = typeof titleInfo.year === 'string' || typeof titleInfo.year === 'number' ? String(titleInfo.year) : "UnknownYear";
        const memberNameStr = typeof titleInfo.memberName === 'string' ? titleInfo.memberName : "সদস্য";

        const assoc = associationNameStr.replace(/\s+/g, '_');

        if (type === 'monthly') {
            fileName = `${assoc}_${monthStr}_${yearStr}_মাসিক_রিপোর্ট.pdf`;
        } else if (type === 'annual') {
            fileName = `${assoc}_${yearStr}_বার্ষিক_রিপোর্ট.pdf`;
        } else if (type === 'memberStatement') {
            fileName = `${assoc}_${memberNameStr.replace(/\s+/g, '_')}_সদস্য_বিবরণী.pdf`;
        } else {
            fileName = `${assoc}_Report.pdf`;
        }
    }

    try {
        const canvas = await html2canvas(reportOutputElement, {
            scale: 2.5,
            useCORS: true,
            logging: false,
            allowTaint: true,
            onclone: (documentClone) => {
                const reportClone = documentClone.getElementById(reportOutputElement.id);
                if (reportClone) {
                    // Apply Bengali font
                    reportClone.style.fontFamily = "'Hind Siliguri', Arial, sans-serif";
                    documentClone.querySelectorAll(`#${reportOutputElement.id} .bengali, #${reportOutputElement.id} table th, #${reportOutputElement.id} table td, #${reportOutputElement.id} h2, #${reportOutputElement.id} h3, #${reportOutputElement.id} p`).forEach(el => {
                        el.style.fontFamily = "'Hind Siliguri', Arial, sans-serif";
                    });

                    // Ensure table borders are visible for print
                    documentClone.querySelectorAll(`#${reportOutputElement.id} table, #${reportOutputElement.id} th, #${reportOutputElement.id} td`).forEach(el => {
                        el.style.border = '1px solid #ccc';
                    });
                    documentClone.querySelectorAll(`#${reportOutputElement.id} table th`).forEach(el => {
                        el.style.backgroundColor = '#f0f0f0';
                        el.style.color = '#333';
                    });

                    // NEW: Temporarily remove top margin/padding from the cloned report output element
                    // and its direct children to ensure content starts from the top.
                    reportClone.style.marginTop = '0px';
                    reportClone.style.paddingTop = '0px';
                    // Also check immediate children that might have top margins
                    Array.from(reportClone.children).forEach(child => {
                        if (child instanceof HTMLElement) { // Ensure it's an HTML element
                            child.style.marginTop = '0px';
                            child.style.paddingTop = '0px';
                        }
                    });
                }
            }
        });

        const imgData = canvas.toDataURL('image/png');
        const pdf = new jsPDF({
            orientation: 'p',
            unit: 'mm',
            format: 'a4'
        });

        const pdfWidth = pdf.internal.pageSize.getWidth();
        const pdfHeight = pdf.internal.pageSize.getHeight();
        const margin = 10; // Standard margin

        const imgProps = pdf.getImageProperties(imgData);
        const aspectRatio = imgProps.width / imgProps.height;
        let newImgWidth = pdfWidth - (2 * margin);
        let newImgHeight = newImgWidth / aspectRatio;

        // If the image is taller than the page height, scale it down to fit
        if (newImgHeight > (pdfHeight - (2 * margin))) {
            newImgHeight = pdfHeight - (2 * margin);
            newImgWidth = newImgHeight * aspectRatio;
        }

        // Position the image at the top-left of the usable area (after margin)
        const x = margin;
        const y = margin; // Start from the top margin

        pdf.addImage(imgData, 'PNG', x, y, newImgWidth, newImgHeight);

        const now = new Date();
        const timestampText = `Generated: ${now.toLocaleDateString('en-GB')} ${now.toLocaleTimeString('en-US', { hour12: false })}`;
        pdf.setFontSize(8);
        pdf.text(timestampText, margin, pdfHeight - (margin / 2));

        pdf.save(fileName);
        if (showMessageCallback) showMessageCallback("পিডিএফ সফলভাবে ডাউনলোড হয়েছে!", "success");

    } catch (error) {
        console.error("Error generating PDF:", error);
        if (showMessageCallback) showMessageCallback("পিডিএফ তৈরিতে ত্রুটি। কনসোল পরীক্ষা করুন।", "error", 0);
    } finally {
        if (buttonsWereVisible && reportActionButtonsElement) {
            reportActionButtonsElement.classList.remove('hidden');
        }
    }
}

/**
 * Converts the provided data object to a JSON string and triggers a download.
 * @param {Object} allData - The comprehensive data object (members, reports, cumulativeTotals).
 * @param {function} showMessageCallback - Callback to display messages.
 * @param {string} appInstanceId - For naming the file.
 */
export function exportAllDataToJson(allData, showMessageCallback, appInstanceId) {
    if (!allData || !allData.data) { // Check if allData.data exists
        if (showMessageCallback) showMessageCallback("এক্সপোর্ট করার জন্য কোনো ডেটা পাওয়া যায়নি।", "error", 0);
        console.error("Export All Data: allData or allData.data is undefined", allData);
        return;
    }

    try {
        // We expect allData to have a 'data' property containing members, reports, cumulativeTotals
        const jsonString = JSON.stringify(allData.data, (key, value) => {
            // Custom replacer to handle Firestore Timestamps if they are still in the data
            if (value && typeof value === 'object' && value.hasOwnProperty('seconds') && value.hasOwnProperty('nanoseconds')) {
                try {
                    return new Date(value.seconds * 1000 + value.nanoseconds / 1000000).toISOString();
                } catch (e) { return value; } // Fallback if conversion fails
            }
            return value;
        }, 2);

        const blob = new Blob([jsonString], { type: "application/json;charset=utf-8;" });
        
        const now = new Date();
        const timestamp = `${now.getFullYear()}${(now.getMonth() + 1).toString().padStart(2, '0')}${now.getDate().toString().padStart(2, '0')}_${now.getHours().toString().padStart(2, '0')}${now.getMinutes().toString().padStart(2, '0')}`;
        const fileName = `samity_backup_${appInstanceId}_${timestamp}.json`;

        const link = document.createElement("a");
        if (link.download !== undefined) {
            const url = URL.createObjectURL(blob);
            link.setAttribute("href", url);
            link.setAttribute("download", fileName);
            link.style.visibility = 'hidden';
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            URL.revokeObjectURL(url);
            if (showMessageCallback) showMessageCallback("সকল ডেটা সফলভাবে JSON ফাইলে এক্সপোর্ট হয়েছে!", "success");
        } else {
            if (showMessageCallback) showMessageCallback("আপনার ব্রাউজার সরাসরি ফাইল ডাউনলোড সমর্থন করে না।", "warning", 0);
        }
    } catch (e) {
        console.error("Error during JSON export:", e);
        if (showMessageCallback) showMessageCallback("JSON ফাইল তৈরিতে ত্রুটি হয়েছে।", "error", 0);
    }
}
