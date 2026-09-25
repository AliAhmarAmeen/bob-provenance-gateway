# BobGuard: AI-BOM & Code Provenance Gateway

BobGuard is an enterprise DevSecOps governance platform that creates an automated, external governance wrapper around IBM Bob 2.0.

## The Problem

While AI agents accelerate development, enterprise compliance teams lack a clear audit trail of what was written by AI versus humans, introducing severe security and IP license risks.

## Our Solution

When an AI generates code, BobGuard intercepts the local execution logs via native Git pre-commit hooks. It runs parallel IBM Bob 2.0 security subagents to verify data isolation, check for copied restrictive licenses (like GPL), and scan for hallucinated dependencies before automatically gating or allowing the code commit.

## Project Structure

- `/mock-enterprise-target`: The vulnerable sandbox application used to trigger the auditor.
- `/mern-auditor-platform`: The core Express/React application orchestrating the Git hooks and AI-BOM ledger.
