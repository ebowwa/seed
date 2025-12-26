# GLM Models: 4.5, 4.6, and 4.7

<Info>
  Comprehensive comparison of Zhipu AI's GLM (General Language Model) series - 4.5, 4.6, and 4.7. These are flagship large language models designed for agentic tasks, reasoning, coding, and real-world development workflows.
</Info>

## Overview

| Model | Release Date | Status | Key Focus |
|-------|-------------|--------|-----------|
| **GLM-4.5** | July 2025 | Stable | Foundation for agentic tasks, reasoning, coding |
| **GLM-4.6** | ~October 2025 | Stable | Enhanced coding, 200K context, real-world performance |
| **GLM-4.7** | December 22, 2025 | Latest | Enhanced programming, stable multi-step reasoning |

---

## GLM-4.5

### Specifications

| Attribute | Value |
|-----------|-------|
| **Architecture** | Mixture-of-Experts (MoE) |
| **Total Parameters** | 355 billion |
| **Active Parameters** | 32 billion (per forward pass) |
| **Context Window** | 128,000 tokens |
| **Variants** | GLM-4.5-Air (106B total, 12B active) |

### Key Features

- **Hybrid Reasoning Model**: "Thinking mode" for complex reasoning + "non-thinking mode" for instant responses
- **Native Function Calling**: Built-in capacity for function/tool calling
- **Foundation for Agents**: Optimized specifically for agentic tasks

### Performance Highlights

| Benchmark | GLM-4.5 | vs Competitors |
|-----------|--------|----------------|
| **τ-bench Retail** | 79.7% | Matches Claude 4 Sonnet (80.5%) |
| **τ-bench Airline** | 60.4% | Matches Claude 4 Sonnet (60.0%) |
| **BFCL v3** | 77.8% | Matches Claude 4 Sonnet (75.2%) |
| **BrowseComp** | 26.4% | Beats Claude 4 Opus (18.8%) |
| **AIME24** | 91.0% | Competitive with top models |
| **MATH 500** | 98.2% | Top-tier performance |
| **SWE-bench Verified** | 64.2% | Competitive (Claude 4 Sonnet: 70.4%) |
| **Terminal-Bench** | 37.5% | Beats Claude 4 Sonnet (35.5%) |

### Technical Innovations

- **MoE Architecture**: Loss-free balance routing, sigmoid gates
- **Deeper Design**: Increased layers (better reasoning) vs reduced width
- **96 Attention Heads**: 2.5x more heads for improved reasoning benchmarks
- **Muon Optimizer**: Accelerates convergence, tolerates larger batch sizes
- **QK-Norm**: Stabilizes attention logits
- **MTP Layer**: Supports speculative decoding

### Availability

- **Platform**: Z.ai
- **API**: OpenAI-compatible interface
- **Open Weights**: HuggingFace, ModelScope
- **Local Deployment**: vLLM, SGLang support

---

## GLM-4.6

### Specifications

| Attribute | Value |
|-----------|-------|
| **Context Window** | **200,000 tokens** (up from 128K) |
| **Architecture** | Hybrid model, trillion-scale parameters |
| **Variants** | GLM-4.6V (multimodal), GLM-4.6V-Flash (lightweight) |

### Key Enhancements Over GLM-4.5

| Feature | Improvement |
|---------|-------------|
| **Context Window** | 128K → **200K tokens** |
| **Coding Performance** | Higher scores on code benchmarks |
| **Token Efficiency** | **30%+ more efficient** than GLM-4.5 |
| **Frontend Aesthetics** | Better visually polished front-end pages |
| **Tool Use** | Enhanced during inference |

### Core Capabilities

- **Agentic**: Functions as a "decision-making hub" for AI agents
- **Reasoning**: Enhanced complex reasoning capabilities
- **Coding**: Superior code generation, especially for frontend
- **Long-context**: Maintains coherence over 200K tokens
- **Multimodal**: Rich document interpretation (GLM-4.6V variant)

### Real-World Coding Evaluation

- **74 real-world coding tests** in Claude Code environment
- **Surpasses Claude Sonnet 4** in real-world tests
- **Lowest token consumption** among comparable models
- **Publicly released** test questions and trajectories on HuggingFace

### Benchmark Performance (On par with Claude Sonnet 4/4.6)

- AIME 25, GPQA, LCB v6, HLE, SWE-Bench Verified
- Top model developed in China

### Deployment

- **Commercial License**: Available for enterprise use
- **Open-source variants**: GLM-4.6V-Flash for local deployment
- **Optimized**: For low-latency scenarios

---

## GLM-4.7

### Specifications

| Attribute | Value |
|-----------|-------|
| **Architecture** | Mixture-of-Experts (MoE) |
| **Total Parameters** | 358 billion |
| **Context Window** | **200,000 tokens** |
| **Maximum Output** | Up to 128K tokens |
| **Release Date** | December 22, 2025 |
| **Model Type** | Open-weight |

### Key Features

#### Enhanced Thinking Capabilities
- **Interleaved Thinking** (enhanced from GLM-4.5)
- **Preserved Thinking** (new)
- **Turn-level Thinking** (new)
- More stable multi-step reasoning and execution

#### Advanced Programming
- Enhanced coding capabilities
- **"Vibe Coding"** - produces more aesthetically pleasing frontend code
- Excels in core coding tasks
- High performance on coding benchmarks

#### Core Capabilities
- Deep mathematical reasoning
- Multi-modal support (text and images)
- Natural, economical output in conversational scenarios
- Robust handling of extended tasks

### Key Improvements Over GLM-4.6

| Area | Improvement |
|------|-------------|
| **Programming** | Significant upgrades in coding abilities |
| **Reasoning** | More stable and reliable multi-step reasoning |
| **User Experience** | More natural tone, economical output |
| **Code Quality** | Functional AND visually appealing frontend code |

### API Usage

```json
{
  "model": "glm-4.7",
  "messages": [...],
  "thinking": {
    "type": "enabled"
  },
  "max_tokens": 4096,
  "temperature": 1.0
}
```

### Availability

- **ModelScope**: [ZhipuAI/GLM-4.7](https://modelscope.cn/models/ZhipuAI/GLM-4.7)
- **Z.AI Developer Platform**: [docs.z.ai](https://docs.z.ai/guides/llm/glm-4.7)
- **API Providers**: Multiple platforms supported

---

## Model Comparison

### Architecture Comparison

| Feature | GLM-4.5 | GLM-4.6 | GLM-4.7 |
|---------|---------|---------|---------|
| **Architecture** | MoE | Hybrid | MoE |
| **Total Params** | 355B | Trillion-scale | 358B |
| **Active Params** | 32B | N/A | N/A |
| **Context Window** | 128K | **200K** | **200K** |
| **Max Output** | N/A | N/A | 128K |

### Capability Evolution

| Capability | GLM-4.5 | GLM-4.6 | GLM-4.7 |
|------------|---------|---------|---------|
| **Agentic Tasks** | Foundation | Stronger | Enhanced |
| **Reasoning** | Hybrid thinking | Advanced | **Stable multi-step** |
| **Coding** | Strong | Superior | **Vibe coding** |
| **Function Calling** | Native | Enhanced | Enhanced |
| **Frontend Code** | Good | Visually polished | **Aesthetically pleasing** |
| **Token Efficiency** | Baseline | **+30% more efficient** | Optimized |

### Best Use Cases

| Use Case | Recommended Model | Reason |
|----------|-------------------|--------|
| **Simple agent tasks** | GLM-4.5 | Cost-effective, proven |
| **Long-context processing** | GLM-4.6 / GLM-4.7 | 200K context window |
| **Real-world coding** | GLM-4.6 | Proven in Claude Code tests |
| **Frontend development** | GLM-4.7 | Vibe coding, aesthetics |
| **Complex reasoning** | GLM-4.7 | Stable multi-step reasoning |
| **Resource-constrained** | GLM-4.5-Air / GLM-4.6V-Flash | Lightweight variants |

---

## Open Source & Deployment

### Local Deployment Support

| Framework | Support |
|-----------|---------|
| **vLLM** | GLM-4.5, GLM-4.5-Air |
| **SGLang** | GLM-4.5, GLM-4.5-Air |
| **Open Weights** | HuggingFace, ModelScope |

### Variants

| Model | Lightweight Variant | Description |
|-------|---------------------|-------------|
| **GLM-4.5** | GLM-4.5-Air | 106B total, 12B active params |
| **GLM-4.6** | GLM-4.6V-Flash | Open-source, low-latency |
| **GLM-4.7** | TBD | Open-weight available |

---

## RL Infrastructure: slime

Zhipu AI developed and open-sourced **slime**, a Reinforcement Learning infrastructure for large-scale model training:

### Key Features

- **Flexible Hybrid Training**: Synchronous (co-located) + Asynchronous (disaggregated)
- **Decoupled Agent-Oriented Design**: Separate rollout and training engines
- **Mixed Precision**: FP8 for data generation, BF16 for training
- **Agent Framework Integration**: Supports multiple frameworks

### RL Training Focus

- **Reasoning**: Single-stage RL over 64K context with difficulty-based curriculum
- **Agentic Tasks**: Information-seeking QA, software engineering
- **Expert Distillation**: Consolidates specialized skills

---

## Related Resources

- [GLM-4.5 Blog Post](https://z.ai/blog/glm-4.5)
- [GLM-4.6 Documentation](https://docs.z.ai/guides/llm/glm-4.6)
- [GLM-4.7 Documentation](https://docs.z.ai/guides/llm/glm-4.7)
- [Z.AI API Documentation](https://docs.z.ai/)
- [ModelScope](https://modelscope.cn/)
- [HuggingFace](https://huggingface.co/)
- [Claude Code Integration Guide](https://www.aivi.fyi/llms/introduce-GLM-4-6)

---

## Summary

| Model | Best For | Context | Key Innovation |
|-------|----------|---------|----------------|
| **GLM-4.5** | Foundation agentic tasks | 128K | Hybrid reasoning, native function calling |
| **GLM-4.6** | Real-world coding, long-context | 200K | 30% token efficiency, proven in production |
| **GLM-4.7** | Production development workflows | 200K | Stable multi-step reasoning, vibe coding |
