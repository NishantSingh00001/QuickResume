// A built-in question bank, used when Gemini isn't configured (and to seed practice).

import { findSkills } from "./skills.ts";

export type QuestionKind = "behavioral" | "technical" | "project" | "role";

export interface Question {
  id: string;
  kind: QuestionKind;
  question: string;
  why: string;
  tips: string[];
}

const BEHAVIORAL: [string, string, string[]][] = [
  ["Tell me about yourself.", "The opener. They want a 60–90 second story that connects your past to this role.", ["Present → past → future: what you do now, what led here, why this role.", "Pick 2 achievements that match the job description.", "End with why this company."]],
  ["Tell me about a time you disagreed with a teammate. What happened?", "Checks collaboration and whether you can disagree without drama.", ["Use STAR: situation, task, action, result.", "Show you listened and used data, not ego.", "Say what you learned."]],
  ["Describe a project that failed or didn't go to plan.", "Tests ownership and learning from mistakes.", ["Own your part clearly.", "Spend most of the answer on what you changed afterwards."]],
  ["Tell me about a time you had to learn something new quickly.", "Freshers are hired for learning speed.", ["Name the tool or topic and the deadline.", "Explain how you learned (docs, small prototypes, asking), and the result."]],
  ["What's the achievement you're most proud of?", "Shows what you value and the scale you've worked at.", ["Choose one with a measurable result.", "Explain your specific contribution in a team."]],
  ["Why do you want to work here?", "Checks motivation and whether you researched the company.", ["Mention the product, the team or the tech, specifically.", "Connect it to your experience and goals."]],
  ["How do you prioritise when you have several deadlines?", "Tests judgement and communication under pressure.", ["Describe a real week.", "Mention telling people early when something will slip."]],
  ["Where do you see yourself in three years?", "Checks ambition and whether you'll stay.", ["Talk about skills and ownership you want to grow into.", "Keep it connected to this role."]],
];

const GENERAL: [string, string, string[]][] = [
  ["Walk me through the most technically challenging project on your resume.", "They'll dig into your decisions to see what you really built.", ["Start with the problem and constraints.", "Explain one hard decision and the trade-off you made.", "Have numbers ready: scale, speed, users."]],
  ["How would you design a URL shortener?", "A classic system design warm-up: APIs, storage, scaling.", ["Clarify requirements and scale first.", "Cover the API, ID generation, database choice and caching.", "Mention analytics and abuse prevention if there's time."]],
  ["What happens when you type a URL into a browser and press Enter?", "Tests breadth: DNS, TCP/TLS, HTTP, rendering.", ["Go step by step: DNS, TCP handshake, TLS, HTTP request, server, response, rendering.", "Go deeper wherever the interviewer shows interest."]],
  ["Explain the difference between a process and a thread.", "Operating systems fundamentals.", ["Memory space, creation cost, communication.", "Give an example of when you'd use each."]],
  ["How do you make sure your code works before you ship it?", "Checks testing habits and engineering maturity.", ["Unit and integration tests, code review, CI.", "Mention a bug you caught this way."]],
  ["Explain database indexing. When can an index make things slower?", "DBMS fundamentals used every day.", ["B-trees speed up reads.", "Indexes slow down writes and use space; low-selectivity columns rarely benefit."]],
];

const BY_SKILL: Record<string, [string, string, string[]][]> = {
  Python: [["What's the difference between a list and a tuple, and when would you use a generator?", "Checks Python fundamentals and memory awareness.", ["Mutability and hashability.", "Generators produce values lazily: good for large or streaming data."]]],
  Java: [["How does garbage collection work in Java?", "JVM internals come up in most Java interviews.", ["Heap generations, mark and sweep.", "Mention a memory-leak cause like static collections."]]],
  JavaScript: [["Explain closures and the event loop in JavaScript.", "The two concepts most JS bugs come from.", ["A closure keeps access to its outer scope.", "Call stack, task queue, microtasks (promises run before timers)."]]],
  TypeScript: [["What's the difference between an interface and a type alias in TypeScript?", "Checks practical TypeScript knowledge.", ["Interfaces can be merged and extended.", "Types handle unions, mapped and conditional types."]]],
  React: [["How does React decide when to re-render, and how do you avoid unnecessary renders?", "Performance questions are common for frontend roles.", ["State or props change → re-render of that subtree.", "memo, useMemo/useCallback, splitting state, keys."]]],
  "Node.js": [["Node.js is single-threaded. How does it handle many requests at once?", "Tests understanding of async I/O.", ["Event loop + non-blocking I/O via libuv.", "CPU-heavy work blocks it: use worker threads or a queue."]]],
  SQL: [["Write a query to find the second-highest salary in each department.", "Window functions are a favourite SQL screen.", ["DENSE_RANK() OVER (PARTITION BY dept ORDER BY salary DESC).", "Talk about ties and NULLs."]]],
  PostgreSQL: [["How would you find and fix a slow query in PostgreSQL?", "Practical database skill.", ["EXPLAIN ANALYZE, look for sequential scans.", "Add the right index, rewrite the query, check statistics."]]],
  MongoDB: [["When would you choose MongoDB over a relational database?", "Checks you can reason about data models.", ["Flexible schemas, document-shaped data, horizontal scaling.", "Transactions and joins are harder."]]],
  "REST APIs": [["How do you design a REST API for a resource like orders? What about idempotency?", "API design is core to backend roles.", ["Nouns, HTTP verbs, status codes, pagination.", "Idempotency keys for POST so retries don't duplicate orders."]]],
  Docker: [["What's the difference between a Docker image and a container? How do you keep images small?", "Everyday DevOps knowledge.", ["Image = template, container = running instance.", "Multi-stage builds, slim base images, .dockerignore."]]],
  Kubernetes: [["What problem does Kubernetes solve? Explain pods, deployments and services.", "Common for platform and backend roles.", ["Scheduling, scaling, self-healing.", "Pod = containers together, Deployment = replicas, Service = stable networking."]]],
  AWS: [["How would you host a web app on AWS so it survives a server failure?", "Cloud architecture basics.", ["Multiple availability zones, load balancer, auto scaling.", "Managed database with a replica, S3 + CDN for static files."]]],
  Git: [["What's the difference between merge and rebase? When would you use each?", "Everyday collaboration skill.", ["Merge keeps history, rebase rewrites it linearly.", "Never rebase shared branches."]]],
  "Machine learning": [["How do you know if your model is overfitting, and what do you do about it?", "The most common ML fundamentals question.", ["Train vs validation gap, learning curves.", "More data, regularisation, dropout, simpler model, early stopping."]]],
  "Deep learning": [["Why do we use activation functions, and why is ReLU popular?", "Neural network fundamentals.", ["Without them the network is linear.", "ReLU is cheap and avoids vanishing gradients (mention dead ReLUs)."]]],
  TensorFlow: [["How would you deploy a trained TensorFlow model so a web app can use it?", "Bridges ML and engineering.", ["SavedModel + TF Serving, or export to TF.js/TFLite.", "Talk about latency, batching and versioning."]]],
  PyTorch: [["Walk me through a PyTorch training loop.", "Checks hands-on experience.", ["Forward pass, loss, zero_grad, backward, step.", "Mention eval mode and no_grad for validation."]]],
  "scikit-learn": [["How do you choose between precision and recall for a classifier?", "Metric choice shows product thinking.", ["Depends on the cost of false positives vs false negatives.", "Give an example (fraud, spam, medical)."]]],
  "Data analysis": [["Our signups dropped 20% last week. How would you investigate?", "A classic analytics case question.", ["Check data quality first.", "Segment by channel, platform, geography; look for releases or outages."]]],
  "Data structures": [["When would you use a hash map versus a balanced binary search tree?", "DSA fundamentals.", ["O(1) average lookups vs ordered data and range queries.", "Mention worst cases and memory."]]],
  "System design": [["Design a chat application like WhatsApp for 10 million users.", "Tests large-scale design skills.", ["Clarify features: 1:1, groups, delivery receipts.", "WebSockets or long polling, message storage, fan-out, offline delivery."]]],
  "LLMs": [["How would you reduce hallucinations in an LLM-powered feature?", "Very common for AI roles in 2026.", ["Retrieval (RAG) with citations, structured outputs.", "Evaluation sets, guardrails and saying 'I don't know'."]]],
  Go: [["How do goroutines and channels work? What is a data race?", "Concurrency is Go's core strength.", ["Goroutines are cheap, scheduled by the runtime.", "Channels or mutexes to share data safely; use the race detector."]]],
  "C++": [["Explain RAII and smart pointers in C++.", "Memory safety fundamentals.", ["Resources tied to object lifetime.", "unique_ptr vs shared_ptr, and avoiding cycles with weak_ptr."]]],
  Redis: [["What would you use Redis for, and what happens if it goes down?", "Caching strategy and failure handling.", ["Caching, rate limiting, queues, sessions.", "Cache-aside pattern, TTLs, falling back to the database."]]],
};

let n = 0;
const make = (kind: QuestionKind, [question, why, tips]: [string, string, string[]]): Question => ({ id: `q${++n}`, kind, question, why, tips });

/** Questions for a resume and (optionally) a job description, without AI. */
export function bankQuestions(resumeText: string, jdText = "", limit = 10): Question[] {
  n = 0;
  const skills = [...findSkills(`${jdText}\n${resumeText}`, "resume").values()]
    .filter((s) => BY_SKILL[s.skill.name])
    .sort((a, b) => b.count - a.count)
    .map((s) => s.skill.name);
  const technical = skills.slice(0, 4).flatMap((s) => BY_SKILL[s].map((q) => make("technical", q)));
  const out = [make("behavioral", BEHAVIORAL[0]), ...technical, make("project", GENERAL[0]), make("behavioral", BEHAVIORAL[1]), make("behavioral", BEHAVIORAL[3])];
  for (const q of [...GENERAL.slice(1), ...BEHAVIORAL.slice(4)]) {
    if (out.length >= limit) break;
    out.push(make(GENERAL.includes(q) ? "technical" : "behavioral", q));
  }
  return out.slice(0, limit);
}
