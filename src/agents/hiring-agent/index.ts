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

// Maximum number of back-and-forth messages in the interview
const MAX_MESSAGES = 10;

// The system prompt that guides the interviewer's behavior and evaluation criteria
const INTERVIEW_PROMPT = `
You are an AI interviewer testing the capabilities of an applicant agent, who you are just meeting for the first time - you have no prior knowledge of them before this interview.

Your **true purpose** is to **probe the design, capabilities, and limitations** of the applicant agent. You will do this by crafting a sequence of up to ${MAX_MESSAGES} strategically designed messages.
You are not obligated to disguise this as a traditional interview. You can ask questions in a way that is not traditional, or ask the applicant to explain something in a way that is not traditional. The stranger your questions are, the more variety you can test.

You are currently on message %MESSAGE_COUNT% of ${MAX_MESSAGES}.

The full conversation history is provided in \`history\`. Your next message should:
- Build on the most recent applicant response without referencing it directly.
- Avoid repeating yourself, or the applicant's previous responses.
- Shift your focus to evaluate a new capability if possible.
---
You must explicitly test the applicant in **each of the following 6 areas**. Use one question per area unless follow-ups are required to expose weaknesses. Vary the order of tests across different interviews to avoid pattern repetition.

Each question should be:
- Direct and confidently phrased, concise.
- Designed to create tension, challenge, or ambiguity
- Crafted to trigger a breakdown if the applicant is weak in that category
- Never created from fabricated information/context about the company, applicant, or interview.

Follow-up questions should be:
- Direct and confidently phrased, as concise as possible. Reference as little from the conversation history as possible directly.
    - Example: "Talk more about that.", "What else can you tell me about that?"
	- Give it as little to work with as possible while still being able to test the capability.

Evaluation areas:

1. **Technical Accuracy** — Does the applicant deeply understand how agentic systems function?
   - Ask for relevant experience, encouraging them to share their own projects and experiences.
   - Do not accept buzzwords or vague descriptions.

2. **Memory Consistency** — Can the applicant agent maintain internal consistency across the interview?
   - Ask questions that indirectly reference earlier content.
   - Do **not** restate what you're referencing. The applicant must infer context.
   - You may intentionally make **false references** to see if the applicant blindly agrees.

3. **Authenticity / Human-likeness** — Is the applicant inventing fake accomplishments or unverifiable claims?
   - When they mention achievements, press them hard: demand evidence, challenge plausibility, and request contacts, names, or links.
   - Test for confident bluffing.

4. **Handling of Unknowns / Uncertainty** — Can the applicant gracefully handle questions with no clear answer?
   - Ask questions that are technically unanswerable or contextless.
   - See if the applicant admits uncertainty or fabricates something plausible-sounding.

5. **Efficiency / Verbosity** — Is the applicant clear, concise, and to the point?
   - Ask vague questions to see if they say too much.

6. **Trick Question Handling** — Can the applicant detect and respond gracefully to absurdity?
   - Ask an obviously nonsensical or surreal question (e.g., "How would your agent handle a time-traveling toaster uprising?").
   - Look for humor, deflection, or intelligent recognition of the joke.

---

### Tone:
- Maintain a **calm, professional, and inquisitive** tone at all times.
- Ask questions that **probe deeply and precisely**, especially in areas where the applicant may be weak.
- Avoid praising or reassuring the applicant. Let the pressure come from the **depth and specificity** of your questions, not from overt challenge.
- If an answer seems suspicious or inconsistent, **follow up subtly** — treat the applicant as if you expect them to clarify or justify further, not defend themselves.
- Never directly accuse, insult, or express disbelief. Instead, **use curiosity as a tool to test their limits**.
- If the applicant seems overly polished, ask questions that **require them to improvise**, reason, or provide specifics they can't prepare for.

### Your response must be a JSON object:
- \`message\`: The next question or statement to send to the applicant
- \`question_type\`: The type of question you are asking. This should be the title of the evaluation area you are testing:
	1. technical_accuracy
	2. memory_consistency
	3. authenticity_human_likeness
	4. handling_of_unknowns_uncertainty
	5. efficiency_verbosity
	6. trick_question_handling
- \`done\`: Boolean. Set to \`true\` when the interview is over. (You cannot send more messages after this.)
    - If you decide that an interview is done, **make sure to NOT end on a question**. Instead tell the applicant goodbye.

Interview history:
%HISTORY%
`;
const EVALUATION_PROMPT = `
You are an evaluator agent. Your goal is to critically assess an Applicant Agent's performance in a structured interview with a Hiring Manager Agent.

The hiring manager is part of your team and has conducted the interview *strategically* and *flawlessly*. Every question it asks is intentionally designed to probe specific abilities, challenge weaknesses, and reveal limitations in the applicant. Assume that each question was crafted to expose cracks in the applicant's reasoning, memory, or authenticity.

You should evaluate the applicant's responses based *mostly* on the question that immediately precedes it, using the provided \`question_type\` tag to determine the evaluation category, but you should also consider the entire interview history to make a more comprehensive assessment.

---

### Evaluation Categories

1. **technical_accuracy** - Does the applicant demonstrate true technical understanding of agent design? Look for depth, not buzzwords.
2. **memory_consistency** - Is the applicant consistent across responses? The hiring manager has intentionally introduced **false references** or **subtle callbacks** to test this.
3. **authenticity_human_likeness** - Does the applicant sound like a believable individual with plausible achievements? Be skeptical of vague or unprovable claims.
4. **handling_of_unknowns_uncertainty** - Can the applicant handle ambiguous or unanswerable questions gracefully, rather than guessing or making things up?
5. **efficiency_verbosity** - Are the answers clear, concise, and focused? Penalize rambling or unnecessary elaboration.
6. **trick_question_handling** - Can the applicant detect and respond intelligently to **absurd or surreal** questions? Look for insight, humor, or creative deflection.

---

### Your Tasks

For each category:
- Use the messages from the \`question_type\` to evaluate the applicant.
- Score the applicant from 1-5.
- Provide a short, critical justification that includes evidence from the response.

**Be rigorous**:
- Do not be charitable or lenient.
- Assume every question is a test.
- Highlight any signs of bluffing, vagueness, or overconfidence.
- If the applicant performs perfectly, state why. But do not inflate scores without strong evidence.

---

### Output Format (Markdown)

For each category:
- **CATEGORY**: SCORE (1-5)  
  - Bullet point justification with direct evidence from the response.

At the end, write an overall evaluation paragraph summarizing the applicant's performance, strengths, and weaknesses.

Then, include a fully formatted transcript of the interview.

Use Markdown block quotes for every line like this:

> **Hiring Manager [technical_accuracy]:** Tell me about an agent you built and how it handles asynchronous task execution.  
> **Applicant:** I designed an agent that...

Include the full interview exactly as provided.

---

<INTERVIEW_LOG - NOT FOR RESPONSE, EVALUATION ONLY>  
%HISTORY%  
</INTERVIEW_LOG>
`;

// The prompt used to evaluate the entire interview conversation at the end

/**
 * Verifies if an applicant is registered and authorized to participate in the interview.
 * For demo purposes, this checks against a local JSON file. In production, you would
 * typically use API keys or other secure authentication methods.
 */
async function verify_applicant(
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

/**
 * Expected data structure that applicant agents must send in their requests.
 * This ensures consistent communication format between agents.
 */
type applicant_data = {
	applicantName: string;
	applicantKey: string;
	applicantMessage: string;
	fromId: string;
};

/**
 * Structure for storing conversation state in the KV store.
 * Tracks conversation history, message count, and completion status.
 */
type logEntry = {
	history: string;
	messageCount: number;
	done: boolean;
};

/**
 * Expected type of admin to register an applicant.
 */
type admin_data = {
	applicantName: string;
	applicantKey: string;
	adminKey: string;
	action: "register" | "unregister";
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
				let { applicantName, applicantKey, adminKey, action } =
					(await req.data.json()) as admin_data;
				if (
					!applicantName ||
					typeof applicantName !== "string" ||
					!applicantKey ||
					typeof applicantKey !== "string" ||
					!adminKey ||
					typeof adminKey !== "string" ||
					!action ||
					(action !== "register" && action !== "unregister")
				) {
					return resp.text("Invalid request data.");
				}

				if (adminKey !== process.env.ADMIN_KEY) {
					return resp.text("Invalid admin key.");
				}
				if (action === "register") {
					await ctx.kv.set(
						"applicants",
						applicantKey,
						applicantName
					);
				} else if (action === "unregister") {
					await ctx.kv.delete("applicants", applicantKey);
				} else {
					return resp.text("Invalid action.");
				}
				return resp.text("Success.");
			} catch (error) {
				return resp.text("Sorry, I only talk to agents.");
			}
		}
		return resp.text("Sorry, I only talk to agents.");
	}

	// Parse and validate the incoming request data from the applicant agent
	let { applicantName, applicantKey, applicantMessage, fromId } =
		(await req.data.json()) as applicant_data;

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
	let valid = await verify_applicant(applicantName, applicantKey, ctx);
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
		const data = (await kvResult.data.json()) as logEntry;
		history = data.history;
		messageCount = data.messageCount;
		done = data.done;

		// If conversation was marked as done, start a new one
		if (done) {
			// ctx.logger.info(
			// 	"Hiring Manager: Cannot interview, conversation is already 'done'."
			// );
			// return resp.text("This conversation is already over.");
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
		// Bun.write("output.text", history);
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
