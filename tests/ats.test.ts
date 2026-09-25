// Unit tests for the ATS engine. Run: npm test
import { analyzeJd, scoreResume } from "../shared/ats.ts";
import { sampleResume } from "../shared/sample.ts";
import { emptyResume } from "../shared/types.ts";
import { checkBullet } from "../shared/verbs.ts";
import { findSkills } from "../shared/skills.ts";

let failed = 0;
function ok(cond: unknown, msg: string) {
  console.log(`${cond ? "PASS" : "FAIL"} ${msg}`);
  if (!cond) failed++;
}

const JD = `Backend Engineer (SDE-1)
About the role
You'll build payment systems that move money for thousands of merchants. You'll react quickly to incidents.
Requirements:
- 1+ years of experience building REST APIs with Go or Node.js
- Strong SQL and PostgreSQL skills; experience with Redis
- Docker and CI/CD (GitHub Actions)
- B.E./B.Tech in Computer Science or related degree
- Good communication skills
Nice to have:
- Kubernetes, Kafka
- AWS
We care about payment systems reliability and clean code reviews.`;

const jd = analyzeJd(JD);
const terms = jd.keywords.map((k) => k.term);
ok(jd.title === "Backend Engineer (SDE-1)", `title: ${jd.title}`);
ok(terms.includes("Go") && terms.includes("Node.js") && terms.includes("PostgreSQL") && terms.includes("Docker"), `dictionary keywords: ${terms.join(", ")}`);
ok(!terms.includes("React"), "“react quickly” is not the React library");
ok(jd.keywords.find((k) => k.term === "Kubernetes")?.required === false, "Kubernetes is nice-to-have");
ok(jd.keywords.find((k) => k.term === "Redis")?.required === true, "Redis is required");
ok(jd.keywords.find((k) => k.term === "Communication")?.weight === 0.4, "soft skills weigh less");
ok(terms.includes("payment systems"), "domain phrase found: payment systems");
ok(jd.years === 1, `years: ${jd.years}`);
ok(Boolean(jd.degree), `degree: ${jd.degree}`);

const sample = scoreResume(sampleResume(), jd);
console.log("  sample:", sample.total, sample.parts.map((p) => `${p.id} ${p.score}/${p.max}`).join(" · "));
ok(sample.total >= 70 && sample.total <= 95, `sample resume scores well: ${sample.total}`);
const missing = sample.keywords.filter((k) => !k.found).map((k) => k.term);
ok(missing.includes("Kafka") && !missing.includes("Go"), `missing keywords: ${missing.join(", ")}`);

const empty = scoreResume(emptyResume(), jd);
ok(empty.total < 15, `empty resume scores low: ${empty.total}`);
const general = scoreResume(sampleResume(), null);
ok(!general.hasJd && general.parts.length === 4 && general.total > 80, `without a job description: ${general.total} (health only)`);

ok(checkBullet("Responsible for testing the app").weak === "responsible for", "weak opener detected");
ok(checkBullet("Built a queue handling 5,000 jobs/min").verb === "built" && checkBullet("Built a queue handling 5,000 jobs/min").hasNumber, "strong verb + number");
ok(checkBullet("Design and build APIs").verb === "designed", "present tense verb");
ok(!checkBullet("Reduced latency by [X]%").hasNumber, "placeholders aren't numbers");
ok([...findSkills("Worked with C++, C#, and .NET; used node.js", "resume").keys()].join() === "C++,C#,Node.js,.NET", "symbols in skill names");

console.log(failed ? `\n${failed} failed` : "\nAll ATS tests passed.");
process.exit(failed ? 1 : 0);
