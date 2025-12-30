# VPS Conductor Decision Model

## Overview

This document defines the decision-making model for the Desktop Conductor when reviewing proposals from remote VPS agents. It ensures project integrity, security, and code quality.

## Decision Categories

| Category | Description | Action |
|----------|-------------|--------|
| **APPROVE** | Change is safe, tested, and aligned with project goals | Apply changes immediately |
| **MODIFY** | Change is good but needs adjustments before applying | Request revisions from agent |
| **REJECT** | Change is unsafe, not tested, or not aligned | Discard and explain why |

## Risk Assessment Matrix

| Impact | Likelihood | Risk Level | Action |
|--------|------------|------------|--------|
| High | High | **CRITICAL** | REJECT |
| High | Medium | **HIGH** | REJECT or careful review |
| High | Low | **MEDIUM** | MODIFY |
| Medium | High | **MEDIUM** | MODIFY |
| Medium | Medium/Low | **LOW** | APPROVE |
| Low | Any | **MINIMAL** | APPROVE |

### Impact Definitions
- **High**: Affects security, data integrity, or core functionality
- **Medium**: Affects performance, UX, or non-core features
- **Low**: Cosmetic, documentation, or minor refactor

### Likelihood Definitions
- **High**: Change will definitely execute in production
- **Medium**: Change may execute under certain conditions
- **Low**: Change is defensive or unlikely to execute

## Review Checklists

### 1. Security Checklist (Must Have)

| Check | Pass/Fail | Notes |
|-------|-----------|-------|
| No hardcoded secrets or API keys | ☐ | |
| Input validation on all user inputs | ☐ | |
| SQL/Command injection protection | ☐ | |
| XSS protection for web outputs | ☐ | |
| Authentication/authorization checks | ☐ | |
| Secure error handling | ☐ | |
| No eval/exec of user input | ☐ | |

**Decision**: If any FAIL, **REJECT** or **MODIFY** depending on severity.

### 2. Code Quality Checklist (Should Have)

| Check | Pass/Fail | Notes |
|-------|-----------|-------|
| Follows project code style | ☐ | |
| Functions are small and focused | ☐ | |
| Variables have meaningful names | ☐ | |
| DRY principle (no duplication) | ☐ | |
| Error handling is present | ☐ | |

**Decision**: If more than 3 FAIL, **MODIFY**.

### 3. Testing Checklist (Must Have for Code Changes)

| Check | Pass/Fail | Notes |
|-------|-----------|-------|
| Unit tests cover new functionality | ☐ | |
| Edge cases are tested | ☐ | |
| Error conditions are tested | ☐ | |

**Decision**: If any FAIL for high/medium impact changes, **MODIFY** or **REJECT**.

### 4. Scope Checklist (Must Have)

| Check | Pass/Fail | Notes |
|-------|-----------|-------|
| Changes match the task description | ☐ | |
| No unrelated changes included | ☐ | |
| Changes are minimal for the goal | ☐ | |

**Decision**: If any FAIL, **MODIFY**.

## Decision Workflow

```
Receive Proposal
       │
       ▼
Run Checklists (Security, Quality, Testing, Scope)
       │
       ▼
Assess Risk (Impact × Likelihood)
       │
       ▼
Make Decision
       │
   ┌───┼───┐
   ▼   ▼   ▼
APPROVE MODIFY REJECT
   │   │   │   │
   ▼   ▼   ▼
Apply Request Discard
changes revisions
```

## Decision Examples

### Example 1: APPROVE
**Proposal**: Fix typo in README.md
- Security: N/A
- Testing: N/A
- Scope: Pass
- Risk: Minimal

**Decision**: **APPROVE**

### Example 2: MODIFY
**Proposal**: Add user authentication feature
- Security: Pass
- Code Quality: 2 Fail (functions too long)
- Testing: Fail (no edge case tests)
- Risk: Medium

**Decision**: **MODIFY**
> "Good start. Please break down functions and add edge case tests."

### Example 3: REJECT
**Proposal**: Execute user input directly in shell
- Security: **CRITICAL FAIL** (uses eval)
- Risk: Critical

**Decision**: **REJECT**
> "This introduces a critical security vulnerability. Use safer alternatives."

## Continuous Improvement

Review rejected proposals to identify:
- Common issues agents should avoid
- Missing checklist items
- Areas for better system prompts
