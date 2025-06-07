// js/memberService.js

// Import the necessary Firebase function for adding/deleting members
import { addSocietyMemberFS, deleteMemberFS as deleteMemberDocumentFS } from './firebaseService.js';

/**
 * Adds a new society member after checking for duplicates.
 *
 * @param {string} appInstanceId - The unique ID for the application instance.
 * @param {string} memberName - The name of the new member.
 * @param {Map<string, string>} currentSocietyMembersMap - A Map of existing society members (id -> name) to check for duplicates.
 * @returns {Promise<Object>} A promise that resolves to an object:
 * - On success: { success: true, newMemberId: string, memberName: string }
 * - On failure: { success: false, error: Error, reason?: string } (reason for user-friendly messages)
 */
export async function addMember(appInstanceId, memberName, currentSocietyMembersMap) {
    const trimmedName = memberName.trim();
    if (!trimmedName) {
        return { success: false, error: new Error("সদস্যের নাম খালি রাখা যাবে না।"), reason: "empty_name" };
    }

    const nameLowercase = trimmedName.toLowerCase();
    // Check for duplicates using the provided map
    if (Array.from(currentSocietyMembersMap.values()).find(existingName => existingName.toLowerCase() === nameLowercase)) {
        return { success: false, error: new Error(`সদস্য "${trimmedName}" ইতিমধ্যে তালিকায় বিদ্যমান।`), reason: "duplicate_name" };
    }

    try {
        const memberData = { name: trimmedName, name_lowercase: nameLowercase };
        const newMemberDocRef = await addSocietyMemberFS(appInstanceId, memberData); // from firebaseService.js
        return { success: true, newMemberId: newMemberDocRef.id, memberName: trimmedName };
    } catch (error) {
        console.error("Error in memberService.addMember:", error);
        return { success: false, error: new Error(`সদস্য যোগ করতে ব্যর্থ: ${error.message}`), reason: "add_failed" };
    }
}

/**
 * Deletes a member document from Firestore.
 * Note: This function ONLY deletes the member document.
 * Recalculating totals and updating UI related to this deletion
 * is currently handled by the calling function in main.js.
 *
 * @param {string} appInstanceId - The unique ID for the application instance.
 * @param {string} memberId - The ID of the member to delete.
 * @returns {Promise<Object>} A promise that resolves to an object:
 * - On success: { success: true }
 * - On failure: { success: false, error: Error }
 */
export async function deleteMember(appInstanceId, memberId) {
    if (!memberId) {
        return { success: false, error: new Error("সদস্য আইডি প্রদান করা হয়নি।") };
    }
    try {
        await deleteMemberDocumentFS(appInstanceId, memberId); // from firebaseService.js
        return { success: true };
    } catch (error) {
        console.error("Error in memberService.deleteMember:", error);
        return { success: false, error: new Error(`সদস্য মুছতে ব্যর্থ: ${error.message}`) };
    }
}

// --- Placeholder for future member service functions ---
/**
 * Updates an existing member's details.
 * (Future feature)
 */
// export async function updateMemberDetails(appInstanceId, memberId, updatedDetails) { /* ... */ }

/**
 * Fetches all members (could be an alternative to direct FS call in main.js for consistency).
 * This would call fetchSocietyMembersFS from firebaseService.js.
 */
// export async function getAllMembers(appInstanceId) { 
//     try {
//         const membersData = await fetchSocietyMembersFS(appInstanceId);
//         // Convert to a Map if firebaseService returns an array, or just return the array
//         if (Array.isArray(membersData)) {
//            const membersMap = new Map();
//            membersData.forEach(member => membersMap.set(member.id, member.name));
//            return { success: true, members: membersMap };
//         } else if (membersData instanceof Map) { // If firebaseService already returns a Map
//            return { success: true, members: membersData };
//         }
//         return { success: true, members: membersData }; // Or just return the array if that's preferred
//     } catch (error) {
//         console.error("Error in memberService.getAllMembers:", error);
//         return { success: false, error };
//     }
// }
