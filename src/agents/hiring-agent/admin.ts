import type { AgentContext } from "@agentuity/sdk";

/**
 * Expected type of admin to register an applicant.
 */
export type AdminData = {
	applicantName: string;
	applicantKey: string;
	adminKey: string;
	action: "register" | "unregister";
};

/**
 * Validates and processes an admin request.
 * Returns a success message if valid, or an error message if invalid.
 */
export async function validateAdminRequest(
	data: unknown,
	ctx: AgentContext
): Promise<{ success: boolean; message: string }> {
	try {
		const adminData = data as AdminData;

		if (
			!adminData.applicantName ||
			typeof adminData.applicantName !== "string" ||
			!adminData.applicantKey ||
			typeof adminData.applicantKey !== "string" ||
			!adminData.adminKey ||
			typeof adminData.adminKey !== "string" ||
			!adminData.action ||
			(adminData.action !== "register" &&
				adminData.action !== "unregister")
		) {
			return { success: false, message: "Failure." };
		}

		if (adminData.adminKey !== process.env.ADMIN_KEY) {
			return { success: false, message: "Failure." };
		}

		if (adminData.action === "register") {
			try {
				await ctx.kv.set(
					"applicants",
					adminData.applicantKey,
					adminData.applicantName
				);
			} catch (error) {
				return {
					success: false,
					message: "Failure.",
				};
			}
		} else if (adminData.action === "unregister") {
			try {
				await ctx.kv.delete("applicants", adminData.applicantKey);
			} catch (error) {
				return {
					success: false,
					message: "Failure.",
				};
			}
		}

		return { success: true, message: "Success." };
	} catch (error) {
		return { success: false, message: "Sorry, I only talk to agents." };
	}
}

/**
 * Verifies if an applicant is registered and authorized to participate in the interview.
 * For demo purposes, this checks against a local JSON file. In production, you would
 * typically use API keys or other secure authentication methods.
 */
export async function verifyApplicant(
	name: string,
	key: string,
	ctx: AgentContext
): Promise<boolean> {
	const kvResult = await ctx.kv.get("applicants", key);
	if (kvResult.exists) {
		let applicantName = await kvResult.data.text();
		return applicantName === name;
	}
	return false;
}
