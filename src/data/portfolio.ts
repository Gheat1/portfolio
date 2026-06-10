/**
 * Single source of truth for all portfolio content.
 *
 * Everything the 3D scene renders (overlay copy, 3D <Text> labels, the number
 * of project planes the camera flies past) is derived from this object, so you
 * never hand-sync the DOM and the WebGL scene — add a project here and a new
 * holographic plane appears automatically.
 */

export interface SkillCategories {
  languages: string[];
  ai_ml: string[];
  security_infra: string[];
  hardware_engineering: string[];
}

/** A human label + the object key, so we can iterate categories in render order. */
export interface SkillGroup {
  /** stable key into {@link SkillCategories} */
  id: keyof SkillCategories;
  /** display label, e.g. "AI / ML" */
  label: string;
  items: string[];
}

export interface Experience {
  company: string;
  role: string;
  period: string;
  bullets: string[];
}

export interface Project {
  /** used as the React key and the in-world <Text> heading */
  title: string;
  subtitle: string;
  details: string;
}

export interface Portfolio {
  summary: string;
  skills: SkillCategories;
  experience: Experience[];
  projects: Project[];
}

/**
 * Who this site belongs to. Used by the hero panel, the contact finale, and
 * the persistent resume button. Keep in sync with scripts/make-resume.py
 * (rerun `python scripts/make-resume.py` after changing either).
 */
export const IDENTITY = {
  name: 'Gheat',
  tagline: 'systems engineer · quantitative developer',
  email: 'gheatmc@gmail.com',
  site: 'gheat.net',
};

export const PORTFOLIO: Portfolio = {
  summary:
    'highly technical software engineer, systems administrator, and quantitative developer with deep experience in full-stack development, ai infrastructure, cryptography, and high-performance bare-metal networking. proven track record architecting enterprise-grade pipelines, processing multi-dimensional vector databases, and automating bare-metal infrastructure deployments. specialized in cyber security, advanced mathematical modeling, and containerized cloud/edge environments.',
  skills: {
    languages: ['Python', 'JavaScript', 'TypeScript', 'C#', 'C', 'C++', 'PHP', 'SQL', 'HTML5', 'CSS3', 'Bash', 'Rust'],
    ai_ml: [
      'Retrieval-Augmented Generation (RAG)',
      'High-Dimensional Vector Databases',
      'MCP Tool Creation',
      'Large Language Model (LLM) Fine-Tuning',
      'Deep-Learning Stem Separation (Demucs)',
      'Optical Character Recognition (OCR) Pipelines',
      'Local AI Agents & Tool Calling (Ollama XML Agent Loops)',
    ],
    security_infra: [
      'Penetration Testing & Vulnerability Remediation',
      'Cross-Site Scripting (XSS) Structural Fixes',
      'SQL Injection Mitigation',
      'Directory Traversal Defense',
      'JWT Secret Forgery Prevention',
      'Network Isolation',
      'Linux System Administration (Arch Linux, Debian)',
      'L2/L3 Network Switching',
      'Tailscale Mesh Networking',
      'Cloudflare Tunnels',
      'Reverse Proxies (Caddy)',
      'Docker Containerization',
    ],
    hardware_engineering: [
      '19" Data Center Rack Architecture',
      'Bare-Metal Server Provisioning',
      'Additive Manufacturing (3D Printing)',
      'Hardware Modding',
      'Systems Engineering',
    ],
  },
  experience: [
    {
      company: 'Hedge Fund',
      role: 'Quantitative Software Engineering Intern',
      period: 'Summer 2025',
      bullets: [
        "selected as the first-ever paid technical intern in the firm's history based on advanced project scope, technical execution, and mathematical aptitude.",
        'architected and deployed a production-grade automated data ingestion pipeline using python and advanced ocr tools to extract unstructured financial data from legacy handwritten contracts.',
        'engineered a high-dimensional vector database solution using python and php to convert extracted textual financial data into searchable mathematical embeddings for quantitative analysis.',
        'implemented secure server-side logic and optimized data flow using structured SQL queries to securely cross-reference internal transactional ledger records.',
        'applied deep financial insights and interest in cryptocurrency markets to optimize automated legal and data workflows for digital asset analysis.',
      ],
    },
    {
      company: 'Independent DevOps & Game Development',
      role: 'Lead Systems Engineer & Security Analyst',
      period: '2024 - Present',
      bullets: [
        'engineered, deployed, and maintain a private bare-metal data center environment utilizing an enterprise-grade 19-inch equipment rack to host high-performance ai workloads, dynamic game servers, and full-stack web applications.',
        'audited application security across self-hosted titles, identifying and neutralizing critical vulnerabilities including database-extracting sql injections, file structure traversal attacks, jwt secret forgery, hit fraud, asset-farming exploits, xss vectors, and ip leaks.',
        'provision, secure, and maintain custom headless arch linux spin-ups across all bare-metal nodes, writing custom bash automation scripts for rapid server deployment, security hardening, and performance monitoring.',
        'built and styled full-stack web applications and custom dashboards using modern HTML, CSS, and JavaScript.',
        'combined advanced mathematical problem-solving with custom 3d printing and hardware modifications to design optimal cooling and physical rack layouts for continuous high-compute ai operations.',
        'volunteered time teaching computer science, programming fundamentals, and technology literacy to younger students, breaking down complex coding concepts into easy-to-understand foundational lessons.',
      ],
    },
  ],
  projects: [
    {
      title: 'Atlas',
      subtitle: 'AI-Driven Desktop Control Panel & Agentic OS',
      details:
        'architected and developed a comprehensive desktop assistant environment leveraging a React 19 / TypeScript frontend and a high-performance Rust backend powered by Tauri 2. built a persistent local AI agent loop powered by Ollama (phi4/qwen2.5-coder) that parses system state in markdown and executes system-level operations via an XML-style tag emission engine. engineered a native desktop terminal system featuring a real interactive SSH shell (xterm.js) and a native Rust PTY bridge alongside integrated SFTP file browsing. integrated full desktop workflows including local markdown note synchronization, an IMAP/SMTP email client with automated AI drafting, calendar/task manipulation, and full-stack financial subscription ledger metrics. secured the platform with a Tailscale-first infrastructure approach, binding all server monitoring and node communication strictly to private mesh IPs to avoid public network exposure.',
    },
    {
      title: 'Wavly',
      subtitle: 'High-Precision DJ Music Similarity Engine',
      details:
        'designed and built a local music matching engine that physically isolates kick drums and basslines using deep-learning stem separation (Demucs) to calculate independent similarity scores. engineered a feature extraction pipeline utilizing librosa, numpy, and scipy to compute low-end mel shapes, chroma pitch classes, and transient profiles into high-dimensional vectors. built a vectorized matrix math query system to rank 1000+ tracks in milliseconds using cached JSON feature vectors and L2-normalised cosine distance calculations. deployed the production engine across a local area network (LAN) using a waitress WSGI server, configuring optimized torch/torchaudio CUDA builds for hardware-accelerated GPU processing. implemented secure network isolation configurations restricting application access exclusively to private local IP addresses.',
    },
    {
      title: 'Spaceships',
      subtitle: 'Real-Time Multiplayer 3D Combat Game',
      details:
        'architected the online backend infrastructure and deployment pipelines for a 3D space combat game hosted live at gheat.net/spaceships. implemented real-time multiplayer synchronization and combat event handling by engineering low-latency WebSocket communication via Node.js and Express. integrated a persistent data tier using SQLite and the better-sqlite3 interface to securely manage pilot user accounts, hashed credentials (bcrypt), and JSON Web Tokens (JWT). collaborated on client-side performance optimizations, including WebSocket message batching, frustum culling, and efficient particle tracking to maintain stable 60 FPS gameplay.',
    },
    {
      title: 'Voidwatch',
      subtitle: 'Space Exploration Simulation Game',
      details:
        'designed and built Voidwatch, a scalable space exploration video game utilizing C# and object-oriented programming paradigms to manage complex physics, mathematical simulations, and real-time state synchronization.',
    },
    {
      title: 'SimplyServer Dashboard',
      subtitle: 'Python, Tailscale API, Linux Administration',
      details:
        'developed a cross-platform desktop gui application using python to manage, monitor, and configure headless remote servers securely over encrypted mesh networks via tailscale APIs.',
    },
    {
      title: 'Custom MCP Tools & AI Automation',
      subtitle: 'Python, LLMs, Developer Workflows',
      details:
        'built and deployed custom model context protocol (mcp) tools to interface local hardware environments and databases with advanced large language models, maximizing developer workflow automation and streamlining model training pipelines.',
    },
  ],
};

/** Categories in render order, with display labels. Drives the skills overlay + 3D labels. */
export const SKILL_GROUPS: SkillGroup[] = [
  { id: 'languages', label: 'LANGUAGES', items: PORTFOLIO.skills.languages },
  { id: 'ai_ml', label: 'AI / ML', items: PORTFOLIO.skills.ai_ml },
  { id: 'security_infra', label: 'SECURITY / INFRA', items: PORTFOLIO.skills.security_infra },
  { id: 'hardware_engineering', label: 'HARDWARE', items: PORTFOLIO.skills.hardware_engineering },
];
