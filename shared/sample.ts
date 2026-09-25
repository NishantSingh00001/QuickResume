// A fictional sample resume used by "Start from an example" and the landing page.
import { ACCENTS, bullets, uid, type Resume } from "./types.ts";

export function sampleResume(): Resume {
  return {
    version: 1,
    title: "Ananya Rao · Software Engineer (example)",
    targetRole: "Software Engineer",
    basics: {
      name: "Ananya Rao",
      headline: "Software Engineer · Backend & Cloud",
      email: "ananya.rao@example.com",
      phone: "+91 98765 43210",
      location: "Bengaluru, India",
      links: [
        { id: uid("k"), label: "LinkedIn", url: "linkedin.com/in/ananya-rao-example" },
        { id: uid("k"), label: "GitHub", url: "github.com/ananya-example" },
      ],
    },
    summary:
      "Computer Science graduate who builds reliable backend services. Shipped a payments reconciliation service used by 40+ merchants during an internship, and enjoys turning slow, manual processes into small, well-tested tools. Looking for a backend or platform engineering role.",
    sections: [
      {
        id: uid("s"), kind: "experience", title: "Experience",
        items: [
          {
            id: uid("e"), role: "Software Engineering Intern", org: "Finlytic Payments", location: "Bengaluru", start: "Jan 2026", end: "Jun 2026",
            bullets: bullets(
              "Built a reconciliation service in Go and PostgreSQL that matches 1.2M daily transactions, cutting manual review time by 70%.",
              "Added idempotency keys and retries to the payout API, reducing duplicate payouts to zero over 3 months.",
              "Wrote 150+ unit and integration tests and set up GitHub Actions CI, raising coverage from 41% to 83%.",
            ),
          },
          {
            id: uid("e"), role: "Backend Developer (Part-time)", org: "CampusKart", location: "Remote", start: "Jun 2025", end: "Dec 2025",
            bullets: bullets(
              "Designed REST APIs with Node.js, Express and Redis caching for a student marketplace with 8,000 monthly users.",
              "Moved image uploads to AWS S3 with signed URLs and CloudFront, cutting page load time by 1.8 s.",
            ),
          },
        ],
      },
      {
        id: uid("s"), kind: "projects", title: "Projects",
        items: [
          {
            id: uid("p"), name: "QueueLite", link: "github.com/ananya-example/queuelite", tech: "Go, Redis, Docker", start: "2025", end: "",
            bullets: bullets(
              "Built a lightweight job queue with retries, dead-letter queues and a web dashboard that handles 5,000 jobs/min on one core.",
              "Benchmarked against a Python Celery setup and documented a 4× lower p99 latency.",
            ),
          },
          {
            id: uid("p"), name: "Lecture Notes Search", link: "", tech: "Python, FastAPI, sentence-transformers", start: "2024", end: "",
            bullets: bullets("Built semantic search over 2,000 pages of lecture notes using embeddings; used by 300 classmates during exams."),
          },
        ],
      },
      {
        id: uid("s"), kind: "education", title: "Education",
        items: [
          { id: uid("d"), school: "RV College of Engineering", degree: "B.E. Computer Science and Engineering", location: "Bengaluru", start: "2022", end: "2026", score: "CGPA 8.7 / 10", details: "Coursework: Data Structures and Algorithms, Operating Systems, DBMS, Computer Networks, Distributed Systems" },
        ],
      },
      {
        id: uid("s"), kind: "skills", title: "Skills",
        groups: [
          { id: uid("g"), name: "Languages", skills: "Go, Python, JavaScript, TypeScript, SQL, Java" },
          { id: uid("g"), name: "Backend", skills: "Node.js, Express, FastAPI, REST APIs, PostgreSQL, Redis" },
          { id: uid("g"), name: "Cloud & tools", skills: "AWS (S3, Lambda), Docker, GitHub Actions, Linux, Git" },
        ],
      },
      {
        id: uid("s"), kind: "list", title: "Achievements",
        items: [
          { id: uid("l"), text: "Top 3% in Codeforces Round 912 (Div. 2); 600+ problems solved on LeetCode." },
          { id: uid("l"), text: "Winner, Smart India Hackathon 2025 internal round (team of 6)." },
        ],
      },
    ],
    settings: { template: "modern", accent: ACCENTS[1], fontScale: 1, spacing: 1, paper: "a4" },
  };
}
