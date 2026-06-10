"""Generate public/resume.pdf — the plain, ATS-friendly fallback resume.

The 3D site is the show; this PDF is the substance for people who just want
a normal document (recruiters, older employers, ATS parsers). Content mirrors
src/data/portfolio.ts. The site copy is stylistically lowercase, so this
script re-cases it for print: sentence capitalization plus a dictionary of
tech proper nouns.

Run:  python scripts/make-resume.py
"""

import re
from pathlib import Path

from reportlab.lib.colors import HexColor
from reportlab.lib.enums import TA_CENTER
from reportlab.lib.pagesizes import letter
from reportlab.lib.styles import ParagraphStyle
from reportlab.lib.units import inch
from reportlab.platypus import (
    HRFlowable,
    Paragraph,
    SimpleDocTemplate,
    Spacer,
    Table,
    TableStyle,
)

OUT = Path(__file__).resolve().parent.parent / "public" / "resume.pdf"

# ── identity ─────────────────────────────────────────────────────────────────
# Keep in sync with src/data/portfolio.ts (IDENTITY).
NAME = "Gheat"
TITLE = "Systems Engineer · Quantitative Developer"
EMAIL = "gheatmc@gmail.com"
SITE = "gheat.net"

SUMMARY = (
    "highly technical software engineer, systems administrator, and quantitative developer with deep "
    "experience in full-stack development, ai infrastructure, cryptography, and high-performance "
    "bare-metal networking. proven track record architecting enterprise-grade pipelines, processing "
    "multi-dimensional vector databases, and automating bare-metal infrastructure deployments. "
    "specialized in cyber security, advanced mathematical modeling, and containerized cloud/edge environments."
)

SKILLS = [
    ("Languages", "Python, JavaScript, TypeScript, C#, C, C++, PHP, SQL, HTML5, CSS3, Bash, Rust"),
    (
        "AI / ML",
        "Retrieval-Augmented Generation (RAG), High-Dimensional Vector Databases, MCP Tool Creation, "
        "LLM Fine-Tuning, Deep-Learning Stem Separation (Demucs), OCR Pipelines, "
        "Local AI Agents & Tool Calling (Ollama XML Agent Loops)",
    ),
    (
        "Security / Infrastructure",
        "Penetration Testing & Vulnerability Remediation, XSS Structural Fixes, SQL Injection Mitigation, "
        "Directory Traversal Defense, JWT Secret Forgery Prevention, Network Isolation, "
        "Linux System Administration (Arch Linux, Debian), L2/L3 Network Switching, Tailscale Mesh Networking, "
        "Cloudflare Tunnels, Reverse Proxies (Caddy), Docker Containerization",
    ),
    (
        "Hardware / Engineering",
        '19" Data Center Rack Architecture, Bare-Metal Server Provisioning, Additive Manufacturing '
        "(3D Printing), Hardware Modding, Systems Engineering",
    ),
]

EXPERIENCE = [
    {
        "company": "Hedge Fund",
        "role": "Quantitative Software Engineering Intern",
        "period": "Summer 2025",
        "bullets": [
            "selected as the first-ever paid technical intern in the firm's history based on advanced project scope, technical execution, and mathematical aptitude.",
            "architected and deployed a production-grade automated data ingestion pipeline using python and advanced ocr tools to extract unstructured financial data from legacy handwritten contracts.",
            "engineered a high-dimensional vector database solution using python and php to convert extracted textual financial data into searchable mathematical embeddings for quantitative analysis.",
            "implemented secure server-side logic and optimized data flow using structured SQL queries to securely cross-reference internal transactional ledger records.",
            "applied deep financial insights and interest in cryptocurrency markets to optimize automated legal and data workflows for digital asset analysis.",
        ],
    },
    {
        "company": "Independent DevOps & Game Development",
        "role": "Lead Systems Engineer & Security Analyst",
        "period": "2024 – Present",
        "bullets": [
            "engineered, deployed, and maintain a private bare-metal data center environment utilizing an enterprise-grade 19-inch equipment rack to host high-performance ai workloads, dynamic game servers, and full-stack web applications.",
            "audited application security across self-hosted titles, identifying and neutralizing critical vulnerabilities including database-extracting sql injections, file structure traversal attacks, jwt secret forgery, hit fraud, asset-farming exploits, xss vectors, and ip leaks.",
            "provision, secure, and maintain custom headless arch linux spin-ups across all bare-metal nodes, writing custom bash automation scripts for rapid server deployment, security hardening, and performance monitoring.",
            "built and styled full-stack web applications and custom dashboards using modern HTML, CSS, and JavaScript.",
            "combined advanced mathematical problem-solving with custom 3d printing and hardware modifications to design optimal cooling and physical rack layouts for continuous high-compute ai operations.",
            "volunteered time teaching computer science, programming fundamentals, and technology literacy to younger students, breaking down complex coding concepts into easy-to-understand foundational lessons.",
        ],
    },
]

PROJECTS = [
    {
        "title": "Atlas",
        "subtitle": "AI-Driven Desktop Control Panel & Agentic OS",
        "details": "architected a desktop assistant environment with a React 19 / TypeScript frontend and a Rust backend powered by Tauri 2. built a persistent local AI agent loop (Ollama) that parses system state and executes system-level operations via an XML-style tag emission engine. engineered a native terminal with a real SSH shell (xterm.js), a Rust PTY bridge, and SFTP browsing; integrated markdown note sync, an IMAP/SMTP email client with AI drafting, calendar/task control, and subscription ledger metrics. secured all node communication over a Tailscale mesh with no public network exposure.",
    },
    {
        "title": "Wavly",
        "subtitle": "High-Precision DJ Music Similarity Engine",
        "details": "built a local music matching engine that isolates kick drums and basslines via deep-learning stem separation (Demucs) to compute independent similarity scores. engineered a feature extraction pipeline (librosa, numpy, scipy) producing high-dimensional vectors; ranks 1000+ tracks in milliseconds using cached JSON feature vectors and L2-normalised cosine distance. deployed on LAN behind a waitress WSGI server with CUDA-accelerated torch builds and strict private-IP network isolation.",
    },
    {
        "title": "Spaceships",
        "subtitle": "Real-Time Multiplayer 3D Combat Game",
        "details": "architected the online backend and deployment pipelines for a 3D space combat game live at gheat.net/spaceships. engineered low-latency WebSocket communication (Node.js, Express) for real-time multiplayer sync and combat events; persistent data tier on SQLite (better-sqlite3) with bcrypt-hashed credentials and JWT auth. collaborated on client optimizations — message batching, frustum culling, particle tracking — to hold stable 60 FPS.",
    },
    {
        "title": "Voidwatch",
        "subtitle": "Space Exploration Simulation Game",
        "details": "designed and built a scalable space exploration game in C#, using object-oriented design to manage complex physics, mathematical simulations, and real-time state synchronization.",
    },
    {
        "title": "SimplyServer Dashboard",
        "subtitle": "Python · Tailscale API · Linux Administration",
        "details": "developed a cross-platform desktop gui application in python to manage, monitor, and configure headless remote servers securely over encrypted tailscale mesh networks.",
    },
    {
        "title": "Custom MCP Tools & AI Automation",
        "subtitle": "Python · LLMs · Developer Workflows",
        "details": "built and deployed custom model context protocol (mcp) tools interfacing local hardware and databases with large language models, streamlining developer workflow automation and model training pipelines.",
    },
]

# ── casing cleanup ────────────────────────────────────────────────────────────
# canonical spellings for tech terms the lowercase site-copy flattens
PROPER = [
    "Python", "JavaScript", "TypeScript", "Rust", "React", "Tauri", "Ollama",
    "IMAP", "SMTP", "SSH", "SFTP", "PTY", "Tailscale", "Demucs", "CUDA", "WSGI",
    "Node.js", "Express", "SQLite", "JWT", "OCR", "SQL", "PHP", "AI", "ML",
    "LAN", "GPU", "JSON", "XML", "Linux", "Arch Linux", "Debian", "Docker",
    "Cloudflare", "Caddy", "XSS", "MCP", "LLM", "RAG", "FPS", "WebSocket",
    "HTML", "CSS", "C#", "API", "GUI", "IP", "3D", "bcrypt", "librosa", "numpy",
    "scipy", "torch", "xterm.js",
]


def recase(text: str) -> str:
    """Sentence-capitalize lowercase site copy and restore tech proper nouns."""
    for term in PROPER:
        if term.lower() == term:  # intentionally lowercase brands (librosa, numpy…)
            continue
        text = re.sub(rf"(?<![\w.]){re.escape(term.lower())}(?![\w.])", term, text, flags=re.IGNORECASE)
    # capitalize the first letter of each sentence
    def cap(m: re.Match) -> str:
        return m.group(1) + m.group(2).upper()

    text = re.sub(r"(^|[.!?]\s+)([a-z])", cap, text)
    return text


# ── document ─────────────────────────────────────────────────────────────────
INK = HexColor("#15201d")
ACCENT = HexColor("#0a8a6e")
RULE = HexColor("#bcd6cf")

styles = {
    "name": ParagraphStyle("name", fontName="Helvetica-Bold", fontSize=24, leading=28, textColor=INK, alignment=TA_CENTER),
    "contact": ParagraphStyle("contact", fontName="Helvetica", fontSize=10, leading=14, textColor=INK, alignment=TA_CENTER),
    "section": ParagraphStyle("section", fontName="Helvetica-Bold", fontSize=11.5, leading=14, textColor=ACCENT, spaceBefore=10, spaceAfter=2),
    "body": ParagraphStyle("body", fontName="Helvetica", fontSize=9.5, leading=13.2, textColor=INK),
    "bullet": ParagraphStyle("bullet", fontName="Helvetica", fontSize=9.5, leading=13, textColor=INK, leftIndent=14, bulletIndent=4, spaceAfter=2),
    "role": ParagraphStyle("role", fontName="Helvetica-Bold", fontSize=10.5, leading=14, textColor=INK),
    "period": ParagraphStyle("period", fontName="Helvetica", fontSize=9.5, leading=14, textColor=INK, alignment=2),
    "subtitle": ParagraphStyle("subtitle", fontName="Helvetica-Oblique", fontSize=9.5, leading=12.5, textColor=ACCENT),
}


def rule() -> HRFlowable:
    return HRFlowable(width="100%", thickness=0.7, color=RULE, spaceBefore=1, spaceAfter=5)


def header_row(left: str, right: str) -> Table:
    t = Table(
        [[Paragraph(left, styles["role"]), Paragraph(right, styles["period"])]],
        colWidths=[5.1 * inch, 1.9 * inch],
    )
    t.setStyle(TableStyle([
        ("LEFTPADDING", (0, 0), (-1, -1), 0),
        ("RIGHTPADDING", (0, 0), (-1, -1), 0),
        ("TOPPADDING", (0, 0), (-1, -1), 2),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 0),
    ]))
    return t


def build() -> None:
    doc = SimpleDocTemplate(
        str(OUT),
        pagesize=letter,
        leftMargin=0.75 * inch,
        rightMargin=0.75 * inch,
        topMargin=0.6 * inch,
        bottomMargin=0.6 * inch,
        title=f"{NAME} — Resume",
        author=NAME,
        subject="Resume",
    )

    story = [
        Paragraph(NAME, styles["name"]),
        Spacer(1, 2),
        Paragraph(f"{TITLE}  ·  <a href='mailto:{EMAIL}'>{EMAIL}</a>  ·  <a href='https://{SITE}'>{SITE}</a>", styles["contact"]),
        Spacer(1, 8),
        Paragraph("SUMMARY", styles["section"]),
        rule(),
        Paragraph(recase(SUMMARY), styles["body"]),
        Paragraph("TECHNICAL SKILLS", styles["section"]),
        rule(),
    ]

    for label, items in SKILLS:
        story.append(Paragraph(f"<b>{label}:</b>  {items}", styles["bullet"]))

    story.append(Paragraph("EXPERIENCE", styles["section"]))
    story.append(rule())
    for job in EXPERIENCE:
        story.append(header_row(f"{job['company']} — {job['role']}", job["period"]))
        for b in job["bullets"]:
            story.append(Paragraph(recase(b), styles["bullet"], bulletText="•"))
        story.append(Spacer(1, 6))

    story.append(Paragraph("PROJECTS", styles["section"]))
    story.append(rule())
    for p in PROJECTS:
        story.append(header_row(p["title"], ""))
        story.append(Paragraph(p["subtitle"], styles["subtitle"]))
        story.append(Paragraph(recase(p["details"]), styles["bullet"], bulletText="•"))
        story.append(Spacer(1, 5))

    doc.build(story)
    print(f"wrote {OUT}")


if __name__ == "__main__":
    build()
