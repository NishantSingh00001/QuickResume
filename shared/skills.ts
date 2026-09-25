// A dictionary of skills and their common spellings, used to pull keywords out of job
// descriptions and to find them in resumes.
// Format: "Canonical|alias|alias".
// A trailing "!" makes an alias case-sensitive when reading job descriptions, where
// "react quickly" or "express ideas" are plain English. "!!" makes it case-sensitive
// everywhere ("go-live", "the rest of").

export type SkillCategory = "language" | "frontend" | "backend" | "data" | "ml" | "cloud" | "devops" | "mobile" | "testing" | "practice" | "tool" | "soft";

const RAW: Record<SkillCategory, string[]> = {
  language: [
    "Python", "Java", "JavaScript|js|es6|ecmascript", "TypeScript", "C++|cpp", "C#|csharp|c sharp", "C|C!!", "Go|golang|Go!!",
    "Rust", "Kotlin", "Swift|Swift!!", "Ruby", "PHP", "Scala", "R (language)|R programming|R language|RStudio", "MATLAB", "Dart", "Bash|shell scripting|shell script",
    "SQL", "Solidity", "Perl", "Haskell", "Elixir", "Objective-C|objective c",
  ],
  frontend: [
    "React|react.js|reactjs|React!", "Next.js|nextjs", "Angular|angularjs", "Vue.js|vue|vuejs|nuxt", "Svelte|sveltekit", "HTML|html5", "CSS|css3",
    "Tailwind CSS|tailwind|tailwindcss", "Sass|scss", "Bootstrap", "Redux|redux toolkit", "Webpack", "Vite", "jQuery", "Three.js|threejs",
    "Accessibility|a11y|wcag", "Responsive design|responsive web design", "Figma", "Framer Motion", "D3.js|d3",
  ],
  backend: [
    "Node.js|nodejs|node js|Node!", "Express.js|expressjs|express js|Express!", "Django", "Flask", "FastAPI", "Spring Boot|spring framework|Spring!",
    ".NET|dotnet|asp.net|.net core", "Ruby on Rails|rails|RoR", "Laravel", "NestJS|nest.js", "GraphQL", "REST APIs|REST!!|RESTful|rest api|rest apis|restful apis",
    "gRPC", "Microservices|microservice|micro-services", "WebSockets|websocket|web sockets", "Socket.IO|socketio", "Kafka|apache kafka", "RabbitMQ",
    "Redis", "Nginx", "OAuth|oauth2|oauth 2.0", "JWT|json web tokens?", "System design", "Distributed systems|distributed system",
    "API design", "Caching", "Serverless", "Message queues|message queue",
  ],
  data: [
    "PostgreSQL|postgres|psql", "MySQL", "MongoDB|mongo", "SQLite", "Oracle Database|Oracle!", "SQL Server|mssql|ms sql", "Cassandra", "DynamoDB",
    "Elasticsearch|elastic search|opensearch", "Firebase|firestore", "NoSQL", "Snowflake", "BigQuery", "Redshift", "Databricks", "Apache Spark|pyspark|Spark!",
    "Hadoop", "Hive", "Airflow|apache airflow", "dbt", "ETL|elt|etl pipelines", "Data pipelines|data pipeline", "Data warehousing|data warehouse",
    "Data modeling|data modelling", "Pandas", "NumPy", "Excel|Microsoft Excel|MS Excel|Excel!!", "Tableau", "Power BI|powerbi", "Looker",
    "Data analysis|data analytics|analyzing data", "Data visualization|data visualisation", "Statistics|statistical analysis", "A/B testing|ab testing|a/b tests",
    "Business intelligence|BI!!",
  ],
  ml: [
    "Machine learning|ML!|machine-learning", "Deep learning|deep-learning", "TensorFlow", "PyTorch", "Keras", "scikit-learn|sklearn|scikit learn",
    "NLP|natural language processing", "Computer vision|opencv", "OpenCV", "LLMs|LLM|large language models?", "Generative AI|genai|gen ai|generative ai",
    "RAG|retrieval-augmented generation|retrieval augmented generation", "Prompt engineering", "LangChain", "Hugging Face|huggingface", "Transformers",
    "MLOps|ml ops", "Feature engineering", "Model deployment", "Recommendation systems|recommender systems?", "Time series|time-series",
    "XGBoost", "Reinforcement learning", "Vector databases|vector database|pinecone|faiss|chroma", "Fine-tuning|fine tuning|finetuning",
    "Neural networks|neural network|CNN!!|RNN!!|LSTM", "Clustering|k-means|kmeans", "Regression|linear regression|logistic regression",
  ],
  cloud: [
    "AWS|amazon web services|ec2|s3|aws lambda", "Azure|microsoft azure", "Google Cloud|GCP|google cloud platform", "Heroku", "Vercel", "Netlify",
    "Cloudflare", "Lambda functions|AWS Lambda",
  ],
  devops: [
    "Docker|containers|containerization", "Kubernetes|k8s", "Terraform", "Ansible", "Jenkins", "CI/CD|ci cd|continuous integration|continuous delivery|continuous deployment",
    "GitHub Actions", "GitLab CI", "Linux|unix", "Git|github|gitlab|version control", "Monitoring|observability|prometheus|grafana", "Helm", "Infrastructure as code|IaC!!",
  ],
  mobile: ["Android", "iOS", "Flutter", "React Native", "Jetpack Compose", "SwiftUI", "Xcode"],
  testing: [
    "Unit testing|unit tests|unit test", "Integration testing|integration tests", "Jest", "Pytest", "JUnit", "Selenium", "Cypress", "Playwright",
    "TDD|test-driven development|test driven development", "Automation testing|test automation|automated testing",
  ],
  practice: [
    "Data structures|DSA!|data structures and algorithms", "Algorithms", "Object-oriented programming|OOP|OOPs|object oriented", "Design patterns",
    "Multithreading|concurrency|multi-threading", "Agile|scrum|kanban", "Code review|code reviews", "Debugging", "Performance optimization|performance tuning",
    "Security|application security|secure coding|OWASP", "Networking|TCP/IP|computer networks", "Operating systems", "DBMS|database management",
    "Cloud computing", "Blockchain|web3", "Product analytics",
  ],
  tool: ["Jira", "Confluence", "Postman", "VS Code|visual studio code", "Notion", "Slack|Slack!!", "Salesforce", "SAP"],
  soft: [
    "Communication|communication skills|communicate", "Teamwork|team player|collaboration|collaborate|cross-functional", "Leadership|lead a team|led a team",
    "Problem solving|problem-solving|problem solver", "Ownership", "Mentoring|mentored|mentor", "Stakeholder management|stakeholders",
    "Time management", "Attention to detail|detail-oriented|detail oriented", "Adaptability|fast learner|quick learner",
  ],
};

export interface Skill {
  name: string;
  category: SkillCategory;
  /** Patterns for job descriptions (stricter about plain-English words). */
  strict: RegExp[];
  /** Patterns for resumes. */
  loose: RegExp[];
}

const esc = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

function source(body: string): string {
  const optionalS = body.endsWith("s?");
  if (optionalS) body = body.slice(0, -2);
  let src = esc(body).replace(/ /g, "[\\s-]+");
  if (optionalS) src += "s?";
  // Word-ish boundaries that treat + and # as part of a token (C++, C#) and allow "Node.js".
  return `(?<![A-Za-z0-9+#.])${src}(?![A-Za-z0-9+#]|\\.[A-Za-z0-9])`;
}

function compile(alias: string): { strict: RegExp; loose: RegExp } {
  const always = alias.endsWith("!!");
  const jdOnly = !always && alias.endsWith("!");
  const body = alias.replace(/!+$/, "");
  const src = source(body);
  return {
    strict: new RegExp(src, always || jdOnly ? "g" : "gi"),
    loose: new RegExp(src, always ? "g" : "gi"),
  };
}

export const SKILLS: Skill[] = Object.entries(RAW).flatMap(([category, list]) =>
  list.map((line) => {
    const aliases = [...new Set(line.split("|"))];
    const name = aliases[0].replace(/!+$/, "");
    // If the canonical name is also listed with "!" or "!!", only the marked version is used.
    const used = aliases.filter((a) => !(a === name && aliases.some((b) => b !== a && b.replace(/!+$/, "") === name)));
    const compiled = used.map(compile);
    return { name, category: category as SkillCategory, strict: compiled.map((c) => c.strict), loose: compiled.map((c) => c.loose) };
  }),
);

export const SKILL_BY_NAME = new Map(SKILLS.map((s) => [s.name.toLowerCase(), s]));

function count(text: string, patterns: RegExp[]): number {
  let n = 0;
  for (const re of patterns) {
    re.lastIndex = 0;
    const m = text.match(re);
    if (m) n += m.length;
  }
  return n;
}

/** Skills mentioned in a text. Use mode "jd" for job descriptions and "resume" for resumes. */
export function findSkills(text: string, mode: "jd" | "resume"): Map<string, { skill: Skill; count: number }> {
  const found = new Map<string, { skill: Skill; count: number }>();
  for (const skill of SKILLS) {
    const n = count(text, mode === "jd" ? skill.strict : skill.loose);
    if (n) found.set(skill.name, { skill, count: n });
  }
  return found;
}

/** Does the resume text mention this keyword (a known skill or any phrase)? */
export function mentions(text: string, keyword: string): number {
  const skill = SKILL_BY_NAME.get(keyword.toLowerCase());
  if (skill) return count(text, skill.loose);
  return count(text, [new RegExp(source(keyword.toLowerCase()), "gi")]);
}
