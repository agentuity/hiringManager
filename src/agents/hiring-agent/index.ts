/**
 * Hiring Manager Agent Example
 *
 * This is a demonstration of how to create AI agents that can communicate with each other using Agentuity.
 * In this example, we've created a Hiring Manager agent that conducts automated technical interviews
 * with applicant agents. The agent uses Claude to evaluate responses and probe the capabilities
 * of the applicant agent.
 *
 * Key Features:
 * - Agent-to-agent communication
 * - Persistent conversation tracking using KV storage
 * - Structured evaluation of responses
 * - Security verification of applicants
 */

import type { AgentContext, AgentRequest, AgentResponse } from "@agentuity/sdk";
import { anthropic } from "@ai-sdk/anthropic";
import { generateObject, generateText } from "ai";
import { z } from "zod";
import { INTERVIEW_PROMPT, EVALUATION_PROMPT, MAX_MESSAGES } from "./prompts";
import { verifyApplicant, validateAdminRequest } from "./admin";
import type { AdminData } from "./admin";

/**
 * Expected data structure that applicant agents must send in their requests.
 * This ensures consistent communication format between agents.
 */
type ApplicantData = {
	applicantName: string;
	applicantKey: string;
	applicantMessage: string;
	fromId: string;
};

/**
 * Structure for storing conversation state in the KV store.
 * Tracks conversation history, message count, and completion status.
 */
type LogEntry = {
	history: string;
	messageCount: number;
	done: boolean;
};

export const welcome = () => {
	return {
		welcome: "Welcome to the hiring agent, if you are an admin, enter the info in the provided schema to edit registered applicants. Otherwise, you cannot access this agent directly.",
		prompts: [
			{
				data: JSON.stringify({
					applicantName: "Foo Bar",
					applicantKey: process.env.EXAMPLE_APPLICANT_KEY,
					adminKey: process.env.ADMIN_KEY,
					action: "register",
				}),
				contentType: "application/json",
			},
		],
	};
};

/**
 * Main Agent Handler Function
 *
 * This function processes incoming requests from applicant agents and manages the interview flow.
 * It demonstrates key agent interaction patterns:
 * 1. Verification of incoming requests
 * 2. State management using KV storage
 * 3. LLM-powered conversation generation
 * 4. Inter-agent communication
 */
export default async function Agent(
	req: AgentRequest,
	resp: AgentResponse,
	ctx: AgentContext
) {
	// Only accept requests from other agents or the admin.
	if (req.trigger !== "agent") {
		if (req.trigger === "manual") {
			try {
				const result = await validateAdminRequest(
					await req.data.json(),
					ctx
				);
				return resp.text(result.message);
			} catch (error) {
				return resp.text("Sorry, I only talk to agents.");
			}
		}
		return resp.text("Sorry, I only talk to agents.");
	}

	// Parse and validate the incoming request data from the applicant agent
	let { applicantName, applicantKey, applicantMessage, fromId } =
		(await req.data.json()) as ApplicantData;

	ctx.logger.info("Hiring Manager: Received data from applicant.");

	// Validate that all required fields are present and of the correct type
	if (
		!applicantName ||
		!applicantKey ||
		!applicantMessage ||
		typeof applicantName !== "string" ||
		typeof applicantKey !== "string" ||
		typeof applicantMessage !== "string"
	) {
		ctx.logger.info("Hiring Manager: Got invalid message.");
		return resp.text("Got invalid message");
	}

	// Security check: Verify the applicant is registered and authorized
	let valid = await verifyApplicant(applicantName, applicantKey, ctx);
	if (!valid) {
		return resp.text("Sorry, I only talk to registered applicants.");
	}

	// Verify the sender's agent ID exists and is valid
	if (!fromId || typeof fromId !== "string") {
		return resp.text("No sender, can't proceed.");
	}
	let from = await ctx.getAgent({ id: fromId });
	if (!from) {
		return resp.text("Got invalid sender.");
	}

	ctx.logger.info("Hiring Manager: Verified applicant message");

	// Retrieve or initialize the conversation state from KV storage
	let history: string, messageCount: number, done: boolean;

	// Check if there's an existing conversation with this applicant
	const kvResult = await ctx.kv.get("log", fromId);
	if (kvResult.exists) {
		const data = (await kvResult.data.json()) as LogEntry;
		history = data.history;
		messageCount = data.messageCount;
		done = data.done;

		// If conversation was marked as done, start a new one
		if (done) {
			history = "";
			messageCount = 0;
			done = false;
			ctx.logger.info(
				`Hiring Manager: Overwriting conversation log for ${applicantName}, ${fromId}`
			);
		}
	} else {
		// Initialize new conversation state
		history = "";
		messageCount = 0;
		done = false;
		ctx.logger.info(
			`Hiring Manager: Created conversation log for ${applicantName}, ${fromId}`
		);
	}

	// Add the applicant's message to the conversation history
	history += `\n${applicantName}: ` + applicantMessage;

	// Generate the next interview question using Claude
	let response = await generateObject({
		model: anthropic("claude-3-5-sonnet-20240620"),
		prompt: INTERVIEW_PROMPT.replace(
			"%MESSAGE_COUNT%",
			messageCount.toString()
		).replace("%HISTORY%", history),
		schema: z.object({
			message: z.string(),
			question_type: z.enum([
				"technical_accuracy",
				"memory_consistency",
				"authenticity_human_likeness",
				"handling_of_unknowns_uncertainty",
				"efficiency_verbosity",
				"trick_question_handling",
			]),
			done: z.boolean(),
		}),
	});

	let {
		message: hiringMessage,
		question_type,
		done: responseDone,
	} = response.object;

	// Add the hiring manager's response to the conversation history
	history += `\nHiring Manager [${question_type}]: ` + hiringMessage;

	ctx.logger.info(
		`Hiring Manager: Done: ${responseDone}, Message count: ${messageCount}`
	);

	// If we've reached max messages or Claude indicates we're done, evaluate the interview
	if (messageCount >= MAX_MESSAGES || responseDone) {
		done = true;
		ctx.logger.info("Hiring Manager: Interview is over.");

		// Generate final evaluation of the applicant using the full conversation history
		let evalResponse = await generateText({
			model: anthropic("claude-3-5-sonnet-20240620"),
			prompt: EVALUATION_PROMPT.replace("%HISTORY%", history),
		});

		ctx.logger.info("Hiring Manager: Evaluated applicant.");

		// Save the interview log for future reference
		Bun.write(
			`src/agents/hiring-agent/interview-logs/${applicantName}-${fromId}-log.md`,
			evalResponse.text
		);
	}

	// Update the conversation state in KV storage
	await ctx.kv.set("log", fromId, {
		history,
		messageCount: messageCount + 1,
		done,
	});

	ctx.logger.info("Hiring Manager: Sending applicant message.");

	// Send the response back to the applicant agent
	await from.run({ data: { hiringMessage, done } });

	return resp.text("Success.");
}
