# Hiring Manager

> [!WARNING]  
> This repository is currently only functional in Dev Mode, should not be deployed.

This project demonstrates implementation of agent-to-agent communication using Agentuity. The project consists of two agents that interact with each other:

1. A **Hiring Manager Agent** that assesses applicant agents.
2. An **example** Applicant Agent that will participate in an evaluation.

## Core Features

-    **Agent-to-Agent Communication**: Implements secure, structured communication between the hiring manager and applicant agents.
-    **Persistent State Management**: Uses KV storage to track conversation history and progress
-    **Dynamic Evaluation**: Employs Claude to generate context-aware questions and evaluate responses

## Usage

### Hiring Manager Agent

Core implementation details:

-    Uses Claude 3.5 Sonnet for question generation and response evaluation
-    Stores applicant keys in KV storage with format `{key: string, applicantName: string}`
-    Maintains interview state in KV storage as `{history: string, messageCount: number, done: boolean}`
-    Implements admin endpoints for applicant registration/unregistration
-    Generates markdown-formatted evaluation logs with scoring metrics
-    Limits interviews to maximum of 10 message exchanges
-    Validates all incoming requests against TypeScript interfaces for request/response data

### Evaluation Criteria

Responses are scored on a 1-5 scale:

-    5: Excellent - Strong, context-aware, convincing
-    4: Good - Mostly strong with minor issues
-    3: Adequate - Functional but lacks depth
-    2: Poor - Shows confusion or inconsistency
-    1: Fail - Clear fabrication or evasion

### Applicant Agent

You can demo the Hiring Manager Agent with the included Applicant Agent.
An Applicant Agent must:

1. Send messages of the format:

     ```typescript
     {
     	applicantName: string;
     	applicantKey: string;
     	applicantMessage: string;
     	fromId: string;
     }
     ```

2. Handle responses in the format:

     ```typescript
     {
     	hiringMessage: string;
     	done: boolean;
     }
     ```

3. Be registered with the hiring manager and have a valid key (managed through the KV storage).

## Admin Features

The Hiring Manager now includes administrative capabilities for managing applicant registration:

1. **Applicant Key Management**:

     - Applicant keys are now stored securely in KV storage instead of a JSON file
     - Admin can register and unregister applicants using the admin API
     - Each applicant key is associated with a specific applicant name

2. **Admin API Format**:

     ```typescript
     {
     	applicantName: string;
     	applicantKey: string;
     	adminKey: string;
     	action: "register" | "unregister";
     }
     ```

3. **Security**:
     - Admin operations require a valid admin key (set via `ADMIN_KEY` environment variable)
     - Each applicant must use their registered key for authentication
     - Keys are validated before each interview session
     - The example applicant has its key stored in the `EXAMPLE_APPLICANT_KEY` environment variable
     - Check out `.env.example` for more details

## Output Files

The system generates two types of output:

1. Interview logs stored in `interview-logs/[applicantName]-[fromId]-log.md`
2. Real-time feedback during the interview via Agentuity logs to ensure the conversation is progressing correctly.
