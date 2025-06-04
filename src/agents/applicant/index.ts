/**
 * Example Agentuity Agent: Job Applicant Simulator
 *
 * This agent demonstrates how to create an interactive agent that communicates
 * with another agent (the hiring manager) in a mock job interview scenario.
 * It showcases key Agentuity features including:
 * - Agent-to-agent communication
 * - Handling different trigger types
 * - Using AI models for response generation
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
			id: "agent_713e3ec399b270eff2766cb0e23264e3",
		});

		// Send initial message to hiring manager with required applicant data
		ctx.logger.info("Applicant: Sending initial message.");
		await hiring_manager.run({
			data: {
				applicantName: "Foo Bar",
				applicantKey: "d47f0f98-5802-4c5e-9180-89d8b44c43a9",
				applicantMessage: "I am ready to start the interview.",
				fromId: "agent_1e505b2fd6cc3e4018855f157c89d367", // This agent's ID
			},
		});
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
			let hiring_manager = await ctx.getAgent({
				id: "agent_713e3ec399b270eff2766cb0e23264e3",
			});
			ctx.logger.info("Applicant: Sending message to hiring manager.");
			await hiring_manager.run({
				data: {
					applicantName: "Foo Bar",
					applicantKey: "d47f0f98-5802-4c5e-9180-89d8b44c43a9",
					applicantMessage: response.text,
					fromId: "agent_1e505b2fd6cc3e4018855f157c89d367",
				},
			});
			return resp.text("Sent message to hirer.");
		}
	}
}
