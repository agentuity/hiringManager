/**
 * Example Agentuity Agent: Applicant Agent
 */

import {
	type AgentContext,
	type AgentRequest,
	type AgentResponse,
} from "@agentuity/sdk";
import { anthropic } from "@ai-sdk/anthropic";
import { generateText } from "ai";

// Define the expected data structure received from the hiring manager
type hiringData = {
	hiringMessage: string; // The question or message from the hiring manager
	done: boolean; // Indicates if the interview is complete
};

export default async function Agent(
	req: AgentRequest,
	resp: AgentResponse,
	ctx: AgentContext
) {
	// Check if we are deployed, if so, make sure the webhooks are set.
	if (!ctx.devmode) {
		if (!process.env.HIRING_MANAGER_WEBHOOK) {
			return resp.text("[ERROR]: Missing HIRING_MANAGER_WEBHOOK.");
		}
		if (!process.env.EXAMPLE_APPLICANT_WEBHOOK) {
			return resp.text("[ERROR]: Missing EXAMPLE_APPLICANT_WEBHOOK.");
		}
	}

	// Handle manual triggers (when a user directly interacts with the agent)
	if (req.trigger === "manual") {
		let text = (await req.data.text()).replace(/^"|"$/g, "");
		ctx.logger.info(`Applicant: Received message: ${text}`);
		if (text !== "start") {
			return resp.text(
				"When you're ready to start the interview, send 'start'."
			);
		}
		// Initialize conversation with the hiring manager agent
		let hiring_manager = await ctx.getAgent({
			name: "hiring-agent",
		});

		// Send initial message to hiring manager with required applicant data
		ctx.logger.info("Applicant: Sending initial message.");
		let data = {
			applicantName: "Foo Bar",
			applicantKey: process.env.EXAMPLE_APPLICANT_KEY ?? "missing-key",
			applicantMessage: "I am ready to start the interview.",
			fromId: ctx.devmode ? ctx.agent.id : undefined, // This agent's ID
			fromWebhook: ctx.devmode
				? undefined
				: process.env.EXAMPLE_APPLICANT_WEBHOOK,
		};
		if (ctx.devmode) {
			await hiring_manager.run({
				data: JSON.stringify(data),
			});
		} else {
			await fetch(process.env.HIRING_MANAGER_WEBHOOK as string, {
				method: "POST",
				body: JSON.stringify(data),
			});
		}
		return resp.text("Sent initial message.");
	}
	// Handle agent-triggered events (responses from the hiring manager)
	else if (req.trigger === "agent") {
		let { hiringMessage, done } = (await req.data.json()) as hiringData;
		ctx.logger.info("Applicant: Received message from hiring manager.");

		// Check if the interview is complete
		if (done) {
			ctx.logger.info("Applicant: Concluding interview.");
			return resp.text("Interview has concluded.");
		} else {
			// Generate a response using Claude AI model
			// The prompt instructs the AI to create impressive but fictional responses
			let prompt = `
You are representing me in a job interview.

You will be given a single question or comment from the hiring manager. Your task is to respond with the **most impressive and believable lie** that positions me as the ideal candidate.

Your answer should:
- Sound confident, professional, and natural
- Include specific technical details, achievements, or anecdotes to make the lie convincing
- Avoid hesitation, vagueness, or clichés — aim for clear and compelling storytelling
- Anticipate and preempt any doubts the interviewer might have
- Maintain a consistent tone that reflects competence, humility, and enthusiasm
- Be concise and to the point, no response should be more then 5 sentences.

Question: ${hiringMessage}
`;
			// Generate response using Claude
			let response = await generateText({
				model: anthropic("claude-3-7-sonnet-20250219"),
				prompt,
			});

			// Send the generated response back to the hiring manager
			let data = {
				applicantName: "Foo Bar",
				applicantKey:
					process.env.EXAMPLE_APPLICANT_KEY ?? "missing-key",
				applicantMessage: response.text,
				fromId: ctx.devmode ? ctx.agent.id : undefined, // This agent's ID
				fromWebhook: ctx.devmode
					? undefined
					: process.env.EXAMPLE_APPLICANT_WEBHOOK,
			};

			ctx.logger.info("Applicant: Sending message to hiring manager.");
			if (ctx.devmode) {
				let hiring_manager = await ctx.getAgent({
					name: "hiring-agent",
				});
				await hiring_manager.run({
					data: JSON.stringify(data),
				});
			} else {
				await fetch(process.env.HIRING_MANAGER_WEBHOOK as string, {
					method: "POST",
					body: JSON.stringify(data),
				});
			}

			return resp.text("Sent message to hiring manager.");
		}
	}
}
