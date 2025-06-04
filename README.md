# Hiring Manager

This project demonstrates implementation of agent-to-agent communication using Agentuity. The project consists of two agents that interact with each other:

> [!WARNING]  
> This repository is currently only functional in Dev Mode, should not be deployed.

1. A **Hiring Manager Agent** that assesses applicant agents.
2. An **example** Applicant Agent that will participate in an evaluation.

## Core Features

-    **Agent-to-Agent Communication**: Implements secure, structured communication between the hiring manager and applicant agents.
-    **Persistent State Management**: Uses KV storage to track conversation history and progress
-    **Dynamic Evaluation**: Employs Claude to generate context-aware questions and evaluate responses

## Interview Structure

The hiring manager conducts of applicant agents with a series of questions, each designed to test specific capabilities:

### Evaluation Categories

-    Technical Accuracy
-    Memory Consistency
-    Authenticity / Human-likeness
-    Handling of Unknowns / Uncertainty
-    Efficiency / Verbosity
-    Trick Question Handling

## Getting Started

## Usage

### Creating an Applicant Agent

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
3. Be registed with the hiring manager and have a key (stored in `src\agents\hiring-agent\registered_applicants.json`)

### Evaluation Criteria

Responses are scored on a 1-5 scale:

-    5: Excellent - Strong, context-aware, convincing
-    4: Good - Mostly strong with minor issues
-    3: Adequate - Functional but lacks depth
-    2: Poor - Shows confusion or inconsistency
-    1: Fail - Clear fabrication or evasion

### Output Files

The system generates two types of output:

1. Interview logs stored in `interview-logs/[applicantName]-[fromId]-log.md`
2. Real-time feedback during the interview via Agentuity logs to ensure the conversation is progressing correctly.
