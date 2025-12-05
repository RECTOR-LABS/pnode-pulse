# Starter Prompt for New Session

Copy and paste the prompt below into a new Claude Code session:

---

## The Prompt

```
Read the project files at ~/local-dev/pnode-pulse (README.md and CLAUDE.md) to understand the context.

I'm building **pNode Pulse** - a real-time analytics platform for Xandeum's pNode network. Before writing any code, I need your help with strategic planning.

## What I Need

### 1. Vision & Mission
- Define a compelling vision that positions us as THE definitive analytics platform for Xandeum (like Etherscan for Ethereum, Solscan for Solana)
- What unique value proposition will make operators and developers choose us?

### 2. Competitive Analysis
- Deep dive into existing competitors (Filfox, Filscan, beaconcha.in, Solana Beach)
- What do they do exceptionally well?
- What gaps exist that we can exploit?
- How can we differentiate beyond just "another dashboard"?

### 3. Strategy
- Given that Xandeum is early-stage (pRPC has only 3 methods), how do we position for growth?
- Should we focus on depth (master current APIs) or breadth (prepare for v0.7 Heidelberg)?
- What partnerships or integrations would accelerate adoption?
- How do we become indispensable to the Xandeum ecosystem?

### 4. End Game LOC Target
- Based on comparable analytics platforms, estimate our target codebase size
- Break down LOC by component (frontend, backend, data layer, etc.)
- This helps us understand the true scope and plan accordingly

### 5. Phased Roadmap
- Don't rush. I want to build this right, even if it takes a year.
- Define clear phases with success criteria
- Each phase should deliver real value while building toward the vision

## Constraints
- Quality over speed
- We want to be THE BEST, not just "good enough"
- No shortcuts that compromise long-term architecture

Help me think through this strategically before we write a single line of code.
```

---

## Notes

- This prompt is designed for deep strategic thinking, not implementation
- The session should produce a PRD or strategy document
- Once strategy is locked, we'll create implementation-focused prompts
