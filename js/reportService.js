// js/reportService.js

import { calculateMonthlyTotals } from './transactionService.js';
import {
    saveReportWithTransactionFS,
    fetchAllReportsMetadataFS,
    fetchReportByIdFS,
    fetchReportsByYearFS,
    checkIfReportExistsFS,
    deleteReportFS,
    recalculateTotalsAfterDeletionFS as recalculateGlobalTotalsFS,
    updateReportFS,
    adjustCumulativeTotalsFS,
    fetchSocietyMembersFS // Import fetchSocietyMembersFS to get active members
} from './firebaseService.js';

// Define banglaMonths for internal use in reportService for date comparisons
const banglaMonthsForReports = [
    "জানুয়ারি", "ফেব্রুয়ারি", "মার্চ", "এপ্রিল", "মে", "জুন",
    "জুলাই", "আগস্ট", "সেপ্টেম্বর", "অক্টোবর", "নভেম্বর", "ডিসেম্বর"
];

// Helper to get month index from Bengali month name
function getNumericMonthIndex(monthName) {
    return banglaMonthsForReports.indexOf(monthName);
}

/**
 * Creates and saves a new monthly report, including savings withdrawal and duplicate check.
 */
export async function createNewMonthlyReport(
    appInstanceId,
    currentReportEntries,
    reportMonthString,
    reportYearString,
    associationNameString
) {
    if (!currentReportEntries || currentReportEntries.length === 0) {
        return { success: false, error: new Error("রিপোর্ট এন্ট্রি খালি রাখা যাবে না।") };
    }

    try {
        const reportYearNumber = parseInt(reportYearString);
        const existingReportId = await checkIfReportExistsFS(appInstanceId, reportMonthString, reportYearNumber);
        if (existingReportId) {
            return {
                success: false,
                error: new Error(`এই মাস (${reportMonthString}) ও বছর (${reportYearString}) এর জন্য ইতিমধ্যে একটি রিপোর্ট (ID: ${existingReportId.substring(0,6)}...) তৈরি করা হয়েছে। নতুন রিপোর্ট তৈরি করতে হলে আগেরটি মুছুন অথবা সম্পাদনা করুন।`),
                isDuplicate: true,
                existingReportId: existingReportId
            };
        }

        const monthlyAggregates = calculateMonthlyTotals(currentReportEntries);

        const reportDataForSave = {
            associationName: associationNameString,
            month: reportMonthString,
            year: reportYearNumber,
            entries: [...currentReportEntries],
            monthlyTotals: {
                savingsDeposit: Number(monthlyAggregates.monthlyTotalSavingsDeposit || 0), // Explicit cast
                savingsWithdrawal: Number(monthlyAggregates.monthlyTotalSavingsWithdrawal || 0), // Explicit cast
                savings: Number(monthlyAggregates.netMonthlySavingsChange || 0), // Explicit cast
                loanDisbursed: Number(monthlyAggregates.monthlyTotalLoanDisbursed || 0), // Explicit cast
                loanRepaid: Number(monthlyAggregates.monthlyLoanRepaid || 0), // Explicit cast
                netLoanChange: Number(monthlyAggregates.netMonthlyLoanChange || 0) // Explicit cast
            },
            // createdAt will be set by Firestore serverTimestamp in saveReportWithTransactionFS
        };

        const { reportId, updatedCumulativeTotals } = await saveReportWithTransactionFS(
            appInstanceId,
            reportDataForSave,
            monthlyAggregates.netMonthlySavingsChange,
            monthlyAggregates.netMonthlyLoanChange
        );

        const finalSavedReportData = {
            ...reportDataForSave,
            id: reportId,
            createdAt: new Date(), // Use client-side new Date() for immediate use for UI
            cumulativeTotalsAtEndOfReport: { ...updatedCumulativeTotals }
        };

        return {
            success: true,
            reportId,
            savedReportData: finalSavedReportData,
            updatedCumulativeTotals
        };

    } catch (error) {
        console.error("Error in reportService.createNewMonthlyReport:", error);
        return { success: false, error: new Error(`মাসিক রিপোর্ট তৈরিতে ত্রুটি: ${error.message}`) };
    }
}

/**
 * Loads a specific report by its ID.
 */
export async function loadReportById(appInstanceId, reportId) {
    if (!reportId) {
        return { success: false, error: new Error("রিপোর্ট আইডি প্রদান করা হয়নি।") };
    }
    try {
        const reportData = await fetchReportByIdFS(appInstanceId, reportId);
        if (!reportData) {
             return { success: false, error: new Error("নির্দিষ্ট আইডি সহ রিপোর্ট খুঁজে পাওয়া যায়নি।") };
        }
        // Convert Firestore Timestamps to JS Dates if they exist
        const processedReportData = {
            ...reportData,
            createdAt: reportData.createdAt?.toDate ? reportData.createdAt.toDate() : (reportData.createdAt instanceof Date ? reportData.createdAt : null),
            updatedAt: reportData.updatedAt?.toDate ? reportData.updatedAt.toDate() : (reportData.updatedAt instanceof Date ? reportData.updatedAt : null),
        };
        return { success: true, reportData: processedReportData };
    } catch (error) {
        console.error("Error in reportService.loadReportById:", error);
        return { success: false, error: new Error(`রিপোর্ট লোড করতে ত্রুটি: ${error.message}`) };
    }
}

/**
 * Calculates a member's net savings up to a specific date (inclusive).
 * It considers reports based on their 'month' and 'year' fields, not 'createdAt'.
 * @param {string} appInstanceId - The unique ID for the application instance.
 * @param {string} memberId - The ID of the member.
 * @param {Date} asOfDate - The date up to which to calculate savings (JS Date object, typically the 1st of a month).
 * @returns {Promise<number|null>} The net savings, or null if an error occurs.
 */
export async function getMemberNetSavingsAsOfDate(appInstanceId, memberId, asOfDate) {
    let netSavings = 0;
    try {
        const allReports = await fetchAllReportsMetadataFS(appInstanceId); // Fetch all reports
        allReports.forEach(report => {
            // Construct a Date object representing the first day of the report's actual month and year.
            const reportMonthIndex = getNumericMonthIndex(report.month);
            // Ensure month and year are valid before creating date
            if (reportMonthIndex === -1 || isNaN(report.year)) {
                 console.warn(`Skipping report with invalid month/year: ${report.month}, ${report.year}`);
                 return;
            }
            const reportEffectiveDate = new Date(report.year, reportMonthIndex, 1);

            // Only consider reports whose effective month/year is on or before the asOfDate's month/year
            // Comparison by getTime() ensures proper chronological order
            if (reportEffectiveDate && reportEffectiveDate.getTime() <= asOfDate.getTime()) {
                if (report.entries && Array.isArray(report.entries)) {
                    report.entries.forEach(entry => {
                        if (entry.memberId === memberId) {
                            netSavings += (Number(entry.savings) || 0);
                            netSavings -= (Number(entry.savingsWithdrawal) || 0);
                        }
                    });
                }
            }
        });
    } catch (error) {
        console.error("Error calculating member net savings as of date:", error);
        return null;
    }
    return netSavings;
}

/**
 * Calculates a member's net outstanding loan up to a specific date (inclusive).
 * It considers reports based on their 'month' and 'year' fields, not 'createdAt'.
 * @param {string} appInstanceId - The unique ID for the application instance.
 * @param {string} memberId - The ID of the member.
 * @param {Date} asOfDate - The date up to which to calculate loan (JS Date object, typically the 1st of a month).
 * @returns {Promise<number|null>} The net outstanding loan, or null if an error occurs.
 */
export async function getMemberNetLoanAsOfDate(appInstanceId, memberId, asOfDate) {
    let netLoan = 0;
    try {
        const allReports = await fetchAllReportsMetadataFS(appInstanceId); // Fetch all reports
        allReports.forEach(report => {
            // Construct a Date object representing the first day of the report's actual month and year.
            const reportMonthIndex = getNumericMonthIndex(report.month);
            // Ensure month and year are valid before creating date
            if (reportMonthIndex === -1 || isNaN(report.year)) {
                console.warn(`Skipping report with invalid month/year: ${report.month}, ${report.year}`);
                return;
            }
            const reportEffectiveDate = new Date(report.year, reportMonthIndex, 1);

            // Only consider reports whose effective month/year is on or before the asOfDate's month/year
            // Comparison by getTime() ensures proper chronological order
            if (reportEffectiveDate && reportEffectiveDate.getTime() <= asOfDate.getTime()) {
                if (report.entries && Array.isArray(report.entries)) {
                    report.entries.forEach(entry => {
                        if (entry.memberId === memberId) {
                            netLoan += (Number(entry.loanDisbursed) || 0);
                            netLoan -= (Number(entry.loanRepayment) || 0);
                        }
                    });
                }
            }
        });
    } catch (error) {
        console.error("Error calculating member net loan as of date:", error);
        return null;
    }
    return netLoan;
}


/**
 * Generates data for an annual report.
 * The banglaMonthsOrder parameter is kept for consistency with how it's passed from main.js,
 * but internal functions will now use banglaMonthsForReports.
 */
export async function generateAnnualReportData(appInstanceId, year, banglaMonthsOrder) { // banglaMonthsOrder passed for compatibility
    if (!year || String(year).length !== 4) {
        return { success: false, error: new Error("সঠিক ৪-সংখ্যার বছর প্রদান করুন।") };
    }
    const numericYear = Number(year);

    try {
        const reportsForSelectedYear = await fetchReportsByYearFS(appInstanceId, numericYear);
        const allMembersArray = await fetchSocietyMembersFS(appInstanceId);

        const memberSummaries = [];
        const allHistoricalReports = await fetchAllReportsMetadataFS(appInstanceId);

        // Filter reports relevant for member balances up to the end of the annual report year
        const endOfAnnualReportYear = new Date(numericYear, 11, 31, 23, 59, 59, 999); // End of December of the report year
        const relevantHistoricalReportsForMemberBalances = allHistoricalReports.filter(report => {
            const reportMonthIndex = getNumericMonthIndex(report.month);
            if (reportMonthIndex === -1 || isNaN(report.year)) return false;
            const reportEffectiveDate = new Date(report.year, reportMonthIndex, 1);
            return reportEffectiveDate && reportEffectiveDate.getTime() <= endOfAnnualReportYear.getTime();
        }).sort((a,b) => {
            const dateA = new Date(a.year, getNumericMonthIndex(a.month), 1);
            const dateB = new Date(b.year, getNumericMonthIndex(b.month), 1);
            return dateA.getTime() - dateB.getTime();
        });

        for (const member of allMembersArray) {
            let memberTotalNetSavings = 0;
            let memberTotalLoanDisbursed = 0;
            let memberTotalLoanRepaid = 0;

            relevantHistoricalReportsForMemberBalances.forEach(report => {
                if (report.entries && Array.isArray(report.entries)) {
                    report.entries.forEach(entry => {
                        if (entry.memberId === member.id) {
                            memberTotalNetSavings += (Number(entry.savings) || 0);
                            memberTotalNetSavings -= (Number(entry.savingsWithdrawal) || 0);
                            memberTotalLoanDisbursed += (Number(entry.loanDisbursed) || 0);
                            memberTotalLoanRepaid += (Number(entry.loanRepayment) || 0);
                        }
                    });
                }
            });
            const memberNetOutstandingLoan = memberTotalLoanDisbursed - memberTotalLoanRepaid;
            memberSummaries.push({
                memberId: member.id,
                memberName: member.name,
                totalSavings: memberTotalNetSavings,
                totalLoan: memberNetOutstandingLoan
            });
        }
        memberSummaries.sort((a, b) => a.memberName.localeCompare(b.memberName, 'bn'));


        let startOfYearTotals = { savings: 0, loan: 0 };
        const previousYearEnd = new Date(numericYear - 1, 11, 31, 23, 59, 59, 999); // End of previous year
        const reportsBeforeCurrentYear = allHistoricalReports
            .filter(r => {
                const reportMonthIndex = getNumericMonthIndex(r.month);
                if (reportMonthIndex === -1 || isNaN(r.year)) return false;
                const reportEffectiveDate = new Date(r.year, reportMonthIndex, 1);
                return reportEffectiveDate && reportEffectiveDate.getTime() <= previousYearEnd.getTime();
            })
            .sort((a,b) => {
                const dateA = new Date(a.year, getNumericMonthIndex(a.month), 1);
                const dateB = new Date(b.year, getNumericMonthIndex(b.month), 1);
                return dateB.getTime() - dateA.getTime(); // Sort descending to get the latest report before the year
            });

        if (reportsBeforeCurrentYear.length > 0 && reportsBeforeCurrentYear[0].cumulativeTotalsAtEndOfReport) {
            startOfYearTotals = {
                savings: Number(reportsBeforeCurrentYear[0].cumulativeTotalsAtEndOfReport.savings || 0),
                loan: Number(reportsBeforeCurrentYear[0].cumulativeTotalsAtEndOfReport.loan || 0)
            };
        }

        if (reportsForSelectedYear.length === 0) {
            return {
                success: true,
                annualReportViewData: {
                    year: numericYear,
                    monthlyData: [],
                    yearlyTotals: { savingsDeposit: 0, savingsWithdrawal: 0, savings: 0, loanDisbursed: 0, loanRepaid: 0, netLoanChange: 0 },
                    startOfYearTotals,
                    endOfYearTotals: startOfYearTotals,
                    memberSummaries,
                    isEmpty: true
                }
            };
        }

        const monthlyDataForAnnualReport = [];
        let yearlyTotalSavingsDeposit = 0;
        let yearlyTotalSavingsWithdrawal = 0;
        let yearlyTotalLoanDisbursed = 0;
        let yearlyTotalLoanRepaid = 0;

        reportsForSelectedYear.sort((a, b) => {
            const monthAIndex = getNumericMonthIndex(a.month);
            const monthBIndex = getNumericMonthIndex(b.month);
            return monthAIndex - monthBIndex;
        });

        reportsForSelectedYear.forEach(report => {
            const mt = report.monthlyTotals || { savings: 0, savingsDeposit: 0, savingsWithdrawal: 0, loanDisbursed: 0, loanRepaid: 0, netLoanChange: 0 };
            const ct = report.cumulativeTotalsAtEndOfReport || { savings: 0, loan: 0 };

            monthlyDataForAnnualReport.push({
                month: report.month,
                monthlySavingsDeposit: Number(mt.savingsDeposit || 0), // Ensuring numbers
                monthlySavingsWithdrawal: Number(mt.savingsWithdrawal || 0), // Ensuring numbers
                monthlyNetSavings: Number(mt.savings || 0), // Ensuring numbers
                monthlyLoanDisbursed: Number(mt.loanDisbursed || 0), // Ensuring numbers
                monthlyLoanRepaid: Number(mt.loanRepaid || 0), // Ensuring numbers
                netMonthlyLoanChange: Number(mt.netLoanChange || 0), // Ensuring numbers
                cumulativeSavingsAtEndOfMonth: Number(ct.savings || 0), // Ensuring numbers
                cumulativeLoanAtEndOfMonth: Number(ct.loan || 0), // Ensuring numbers
            });
            yearlyTotalSavingsDeposit += Number(mt.savingsDeposit || 0);
            yearlyTotalSavingsWithdrawal += Number(mt.savingsWithdrawal || 0);
            yearlyTotalLoanDisbursed += Number(mt.loanDisbursed || 0);
            yearlyTotalLoanRepaid += Number(mt.loanRepaid || 0);
        });
        const yearlyNetSavingsChange = yearlyTotalSavingsDeposit - yearlyTotalSavingsWithdrawal;
        const yearlyNetLoanChange = yearlyTotalLoanDisbursed - yearlyTotalLoanRepaid;

        const endOfYearTotals = reportsForSelectedYear.length > 0 ?
            (reportsForSelectedYear[reportsForSelectedYear.length - 1].cumulativeTotalsAtEndOfReport || { savings: startOfYearTotals.savings + yearlyNetSavingsChange, loan: startOfYearTotals.loan + yearlyNetLoanChange }) :
            startOfYearTotals;

        const yearlyTotalsForDisplay = {
            savingsDeposit: yearlyTotalSavingsDeposit,
            savingsWithdrawal: yearlyTotalSavingsWithdrawal,
            savings: yearlyNetSavingsChange,
            loanDisbursed: yearlyTotalLoanDisbursed,
            loanRepaid: yearlyTotalLoanRepaid,
            netLoanChange: yearlyNetLoanChange
        };

        return {
            success: true,
            annualReportViewData: {
                year: numericYear,
                monthlyData: monthlyDataForAnnualReport,
                yearlyTotals: yearlyTotalsForDisplay,
                startOfYearTotals,
                endOfYearTotals,
                memberSummaries,
                isEmpty: false
            }
        };

    } catch (error) {
        console.error("Error in reportService.generateAnnualReportData:", error);
        return { success: false, error: new Error(`বার্ষিক রিপোর্ট ডেটা তৈরিতে ত্রুটি: ${error.message}`) };
    }
}

/**
 * --- CORRECTED FUNCTION FOR PIE/DONUT CHARTS ---
 * Generates member-based distribution data for a given year, suitable for pie/donut charts.
 * This function was corrected to be more robust and to be properly used by the chart generation logic.
 * It now returns totals for calculating percentages.
 * @param {string} appInstanceId - The application instance ID.
 * @param {number} year - The year for which to calculate distribution.
 * @returns {Promise<Object>} An object containing the distribution data.
 */
export async function generateMemberDistributionDataForYear(appInstanceId, year) {
    try {
        const allMembers = await fetchSocietyMembersFS(appInstanceId);
        const allReports = await fetchAllReportsMetadataFS(appInstanceId);
        
        const yearNumber = Number(year);
        const reportsForYear = allReports.filter(r => r.year === yearNumber);

        if (reportsForYear.length === 0) {
            return { success: true, data: { members: [], totals: { savings: 0, loan: 0 } } };
        }

        const memberData = new Map();
        // Initialize map with all current members to include members with zero transactions
        allMembers.forEach(member => {
            memberData.set(member.id, {
                memberName: member.name,
                totalSavings: 0,
                totalLoan: 0
            });
        });

        let yearlyTotalSavings = 0;
        let yearlyTotalLoan = 0;

        for (const report of reportsForYear) {
            if (report.entries && Array.isArray(report.entries)) {
                 for (const entry of report.entries) {
                    // Only process entries for members that are still in the main members list
                    if (memberData.has(entry.memberId)) {
                        const member = memberData.get(entry.memberId);
                        
                        // For pie charts, we show the total contribution (deposits) and disbursed loans
                        const savingsDeposit = Number(entry.savings) || 0;
                        const loanDisbursed = Number(entry.loanDisbursed) || 0;

                        member.totalSavings += savingsDeposit;
                        member.totalLoan += loanDisbursed;
                        
                        yearlyTotalSavings += savingsDeposit;
                        yearlyTotalLoan += loanDisbursed;
                    }
                }
            }
        }
        
        // Filter out members who had no transactions in that year to keep the chart clean
        const distributionData = Array.from(memberData.values()).filter(m => m.totalSavings > 0 || m.totalLoan > 0);

        return { 
            success: true, 
            data: {
                members: distributionData,
                totals: {
                    savings: yearlyTotalSavings,
                    loan: yearlyTotalLoan
                }
            }
        };

    } catch (error) {
        console.error("Error generating member distribution data:", error);
        return { success: false, error };
    }
}

export async function generateMemberStatementData(appInstanceId, memberId, banglaMonthsOrder) {
    if (!memberId) {
        return { success: false, error: new Error("সদস্য আইডি প্রদান করা হয়নি।") };
    }
    try {
        const allReports = await fetchAllReportsMetadataFS(appInstanceId);
        const memberTransactions = [];
        allReports.forEach(report => {
            if (report.entries && Array.isArray(report.entries)) {
                report.entries.forEach(entry => {
                    if (entry.memberId === memberId) {
                        const reportDate = report.createdAt?.toDate ? report.createdAt.toDate().toLocaleDateString('bn-BD', { year: 'numeric', month: 'long', day: 'numeric' }) : `${report.month} ${report.year}`;
                        
                        // Use report.month and report.year for sorting consistency
                        const reportMonthIndex = getNumericMonthIndex(report.month);
                        let jsDateForSorting = new Date(report.year, reportMonthIndex, 1);
                        // If createdAt exists and is earlier, use it for more precise ordering
                        if (report.createdAt?.toDate) {
                            const createdAtDate = report.createdAt.toDate();
                            if (createdAtDate.getFullYear() === report.year && createdAtDate.getMonth() === reportMonthIndex) {
                                jsDateForSorting = createdAtDate; // Use precise timestamp if within the same month/year
                            }
                        }


                        if (Number(entry.savings) > 0) {
                            memberTransactions.push({ type: 'savings_deposit', reportDate, description: `মাসিক সঞ্চয় জমা (${report.month} ${report.year})`, savings_deposit: Number(entry.savings || 0), savings_withdrawal: 0, loan_disbursed: 0, loan_repayment: 0, originalDate: jsDateForSorting });
                        }
                        if (Number(entry.savingsWithdrawal) > 0) {
                            memberTransactions.push({ type: 'savings_withdrawal', reportDate, description: `সঞ্চয় উত্তোলন (${report.month} ${report.year})`, savings_deposit: 0, savings_withdrawal: Number(entry.savingsWithdrawal || 0), loan_disbursed: 0, loan_repayment: 0, originalDate: jsDateForSorting });
                        }
                        if (Number(entry.loanDisbursed) > 0) {
                            memberTransactions.push({ type: 'loan_disbursement', reportDate, description: `ঋণ বিতরণ (${report.month} ${report.year})`, savings_deposit: 0, savings_withdrawal: 0, loan_disbursed: Number(entry.loanDisbursed || 0), loan_repayment: 0, originalDate: jsDateForSorting });
                        }
                        if (Number(entry.loanRepayment) > 0) {
                            memberTransactions.push({ type: 'loan_repayment', reportDate, description: `ঋণ পরিশোধ (${report.month} ${report.year})`, savings_deposit: 0, savings_withdrawal: 0, loan_disbursed: 0, loan_repayment: Number(entry.loanRepayment || 0), originalDate: jsDateForSorting });
                        }
                    }
                });
            }
        });
        memberTransactions.sort((a, b) => (a.originalDate ? a.originalDate.getTime() : 0) - (b.originalDate ? b.originalDate.getTime() : 0));
        return { success: true, statementData: { transactions: memberTransactions } };
    } catch (error) {
        console.error("Error in reportService.generateMemberStatementData:", error);
        return { success: false, error: new Error(`সদস্য বিবৃতি ডেটা তৈরিতে ত্রুটি: ${error.message}`) };
    }
}

export async function deleteMonthlyReportAndRecalculate(appInstanceId, reportIdToDelete) {
    if (!reportIdToDelete) {
        return { success: false, error: new Error("মুছে ফেলার জন্য রিপোর্ট আইডি প্রয়োজন।") };
    }
    try {
        const reportToDeleteResult = await loadReportById(appInstanceId, reportIdToDelete);
        if (!reportToDeleteResult.success || !reportToDeleteResult.reportData) {
            throw new Error(`মুছে ফেলার জন্য রিপোর্টটি খুঁজে পাওয়া যায়নি (ID: ${reportIdToDelete}).`);
        }
        const reportToDeleteData = reportToDeleteResult.reportData;

        const activeMembersArray = await fetchSocietyMembersFS(appInstanceId);
        const activeMemberIds = new Set(activeMembersArray.map(m => m.id));

        let netSavingsImpactOfActiveMembersInReport = 0;
        let netLoanImpactOfActiveMembersInReport = 0;

        // Only consider the impact of entries from members who are still active
        if (reportToDeleteData.entries && Array.isArray(reportToDeleteData.entries)) {
            reportToDeleteData.entries.forEach(entry => {
                if (activeMemberIds.has(entry.memberId)) { // Only count if member is active
                    netSavingsImpactOfActiveMembersInReport += (Number(entry.savings) || 0) - (Number(entry.savingsWithdrawal) || 0);
                    netLoanImpactOfActiveMembersInReport += (Number(entry.loanDisbursed) || 0) - (Number(entry.loanRepayment) || 0);
                }
            });
        }

        await deleteReportFS(appInstanceId, reportIdToDelete);

        const updatedCumulativeTotals = await recalculateGlobalTotalsFS(
            appInstanceId,
            netSavingsImpactOfActiveMembersInReport,
            netLoanImpactOfActiveMembersInReport
        );

        return { success: true, updatedCumulativeTotals };

    } catch (error) {
        console.error("Error in reportService.deleteMonthlyReportAndRecalculate:", error);
        return { success: false, error: new Error(`রিপোর্ট মুছতে এবং মোট হিসাব পুনরায় গণনা করতে ত্রুটি: ${error.message}`) };
    }
}


export async function updateMonthlyReportAndRecalculate(
    appInstanceId,
    reportIdToUpdate,
    newEntries,
    originalReportMonthlyTotals // This parameter will now be ignored for calculating the difference
) {
    if (!reportIdToUpdate) {
        return { success: false, error: new Error("আপডেট করার জন্য রিপোর্ট আইডি প্রয়োজন।") };
    }
    if (!newEntries) {
        newEntries = [];
    }

    try {
        // 1. Get the original report data from Firestore to access its original entries
        const originalReportResult = await loadReportById(appInstanceId, reportIdToUpdate);
        if (!originalReportResult.success || !originalReportResult.reportData) {
            throw new Error("আপডেট করার জন্য মূল রিপোর্ট লোড করা যায়নি।");
        }
        const originalReportData = originalReportResult.reportData;

        // 2. Fetch the current list of active members
        const activeMembersArray = await fetchSocietyMembersFS(appInstanceId);
        const activeMemberIds = new Set(activeMembersArray.map(m => m.id));

        // 3. Calculate the impact of the original report's entries, considering only active members
        let originalReportNetSavingsImpact = 0;
        let originalReportNetLoanImpact = 0;
        if (originalReportData.entries && Array.isArray(originalReportData.entries)) {
            originalReportData.entries.forEach(entry => {
                if (activeMemberIds.has(entry.memberId)) { // Only count if member is still active
                    originalReportNetSavingsImpact += (Number(entry.savings) || 0) - (Number(entry.savingsWithdrawal) || 0);
                    originalReportNetLoanImpact += (Number(entry.loanDisbursed) || 0) - (Number(entry.loanRepayment) || 0);
                }
            });
        }

        // 4. Calculate the impact of the new (updated) entries, considering only active members
        // The newEntries are already what's currently in the UI, and the UI might have removed
        // entries for deleted members, or the user might have manually removed them.
        let newEntriesNetSavingsImpact = 0;
        let newEntriesNetLoanImpact = 0;
        newEntries.forEach(entry => {
            // It's crucial here to rely on the incoming newEntries as accurate.
            // If the UI allows deleted members to be kept (greyed out) but filtered from calculations,
            // then current `newEntries` should already exclude them or be prepared for it.
            // However, the `calculateMonthlyTotals` will process all entries in `newEntries`.
            // For robustness, let's assume `newEntries` already reflects what should be calculated.
            // The UI will filter out deleted member from dropdown for new additions.
            // When editing, if a deleted member's entry is still in `newEntries`,
            // we should not count its impact on totals, as its historical impact was already removed.
            if (activeMemberIds.has(entry.memberId)) {
                newEntriesNetSavingsImpact += (Number(entry.savings) || 0) - (Number(entry.savingsWithdrawal) || 0);
                newEntriesNetLoanImpact += (Number(entry.loanDisbursed) || 0) - (Number(entry.loanRepayment) || 0);
            }
        });

        // 5. Calculate the net difference for cumulative totals
        const netSavingsDifference = newEntriesNetSavingsImpact - originalReportNetSavingsImpact;
        const netLoanDifference = newEntriesNetLoanImpact - originalReportNetLoanImpact;

        // 6. Adjust the global cumulative totals
        const newGlobalCumulativeTotals = await adjustCumulativeTotalsFS(appInstanceId, netSavingsDifference, netLoanDifference);

        // 7. Calculate the new monthly totals for the report being saved (for display purposes)
        const newMonthlyAggregates = calculateMonthlyTotals(newEntries); // This calculates from all entries in newEntries

        // 8. Prepare the updated report data for saving to Firestore
        const updatedReportDataForSave = {
            associationName: originalReportData.associationName,
            month: originalReportData.month,
            year: originalReportData.year,
            createdAt: originalReportData.createdAt,
            entries: [...newEntries],
            monthlyTotals: {
                savingsDeposit: Number(newMonthlyAggregates.monthlyTotalSavingsDeposit || 0),
                savingsWithdrawal: Number(newMonthlyAggregates.monthlyTotalSavingsWithdrawal || 0),
                savings: Number(newMonthlyAggregates.netMonthlySavingsChange || 0),
                loanDisbursed: Number(newMonthlyAggregates.monthlyTotalLoanDisbursed || 0),
                loanRepaid: Number(newMonthlyAggregates.monthlyLoanRepaid || 0),
                netLoanChange: Number(newMonthlyAggregates.netMonthlyLoanChange || 0)
            },
            cumulativeTotalsAtEndOfReport: { ...newGlobalCumulativeTotals } // Use the newly calculated global totals
        };

        // 9. Update the report in Firestore
        await updateReportFS(appInstanceId, reportIdToUpdate, updatedReportDataForSave, newGlobalCumulativeTotals);

        const finalUpdatedReportData = {
            ...updatedReportDataForSave,
            id: reportIdToUpdate,
            updatedAt: new Date() // Set client-side update timestamp
        };

        return {
            success: true,
            updatedReportData: finalUpdatedReportData,
            newGlobalCumulativeTotals
        };

    } catch (error) {
        console.error("Error in reportService.updateMonthlyReportAndRecalculate:", error);
        return { success: false, error: new Error(`রিপোর্ট আপডেট করতে এবং মোট হিসাব পুনরায় গণনা করতে ত্রুটি: ${error.message}`) };
    }
}
