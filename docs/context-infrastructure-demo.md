# Context infrastructure demo foundation

This repository already has the ingredients for a healthy AI operating model: project instructions, scoped `.github/instructions` guidance, a `quality-checks` skill, and MCP configuration. The missing piece is a focused demonstration of how to treat context as team infrastructure rather than ad hoc prompting.

## Goal

Use the current catalog as a stable starting point, then rehearse a small workflow for context-aware QA and implementation without changing app behavior. The goal is to teach the team how to choose the right context, compose the right prompt, ship with concrete evidence, and maintain the system with feedback loops.

## Scope

This is a foundation demo only. It does not implement category filtering, add a new data model, or change the live catalog behavior.

## Rehearsal loop: Choose -> Compose -> Ship -> Maintain + Learn

### 1. Choose

Select the smallest meaningful slice of context:

- repository instructions and relevant project guidance
- the issue or acceptance criteria
- the current code and data shape
- the quality checks that define success

Keep this distinct from broad observation. “Discoverable context” is what the team can find in the repo and the issue; “observed use” is what the client or agent actually does in a session.

### 2. Compose

Turn that context into a prompt that is explicit about:

- the exact task and out-of-scope boundaries
- the repo controls that must be respected
- the evidence the request needs before completion
- the single source of truth for success

A strong compose step should differentiate:

- guidance from enforced controls
- quality evaluation from adoption or execution telemetry
- documented repository rules from agent behavior that is only observed in the client

### 3. Ship

Ship with evidence, not assumption. The demo should leverage the existing quality gates and repo conventions, including:

- the repository instructions and scoped `.github/instructions` files
- the `quality-checks` skill for unit tests, linting, and type checks
- a clear acceptance brief with observable proof points

Examples of evidence include:

- requirement summary ties back to the issue
- repo conventions checked against instructions
- relevant commands identified and run when appropriate
- no hidden drift into unrelated feature work

### 4. Maintain + Learn

After the task, reflect on the signals that matter:

- did the prompt load the right instructions?
- did the agent apply the project rules or improvise around them?
- were the checks accurate and reproducible?
- what client-specific behavior still needs rehearsal?

The objective is not to encourage endless review loops; it is to make the team’s context infrastructure observable, teachable, and reusable.

## Ready-to-copy prompts

### Discovery prompt

```text
Review this issue and the repository guidance before proposing any implementation. Tell me:
1. what is explicitly in scope vs. out of scope,
2. which instructions should control the work,
3. which repo quality checks are the source of truth,
4. what evidence would count as acceptance for this demo.
```

### Implementation prompt

```text
We are creating a small context infrastructure demo foundation only. Do not implement category filtering or change the app behavior. Reuse the repo instructions and the existing quality-checks skill rather than duplicating them. Describe the intended QA workflow, the rehearsal loop, and the setup caveats that need client-specific verification.
```

### QA prompt

```text
Review the requested work against repository guidance and the acceptance criteria. Do not silently implement fixes. Return evidence for:
- requirement boundaries,
- repo-specific controls,
- required quality checks,
- any missing verification or client-specific setup steps.
```

## Acceptance evidence checklist

A successful rehearsal should include evidence for each of the following:

- the repo’s instructions and skill files were reviewed instead of copied
- the task stayed focused on a demo foundation rather than a live feature implementation
- the workflow distinguishes discoverable context from observed use
- the guidance and enforced controls are clearly separated
- there is a documented evaluation path for quality checks and another for telemetry or adoption signals
- any client-dependent setup requirements are listed explicitly, including delegated-agent instruction loading and MCP tool availability

## Client-dependent setup checks

Some parts of this workflow are not purely repo-local. A complete rehearsal should note the client-specific checks that still need to be performed by the human running the session:

- ensure the correct instructions are loaded for the active session or delegated agent
- confirm the intended MCP toolset is available in the client
- verify that the repo-level guidance is visible before the task begins
- distinguish local repository evidence from behavior only visible in the client runtime

If a tool is missing or a delegated agent is not loading the expected instruction set, that is a design issue for the client workflow, not proof that the repo itself is wrong.

## Starting state

The repository’s current catalog remains the baseline for the later live implementation. The demo foundation is about the shared context and QA pattern, not the application logic itself.
