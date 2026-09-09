# AI Interview Prep Kit

An AI-powered interview preparation platform that takes a job description, company website, and available preparation days, then generates a personalized interview preparation kit.

The application researches the company, extracts role requirements, generates requirement-linked interview questions and flashcards, checks requirement coverage, and creates a deterministic preparation schedule.

## 🚀 Live Demo

**Frontend:**  
https://ai-interview-prepration-blond.vercel.app

**Backend API:**  
https://ai-interview-prepration-0d55.onrender.com

---

## 📌 Project Overview

The goal of this project is to help candidates prepare for interviews based on a specific job opportunity instead of using generic interview questions.

The user provides:

- Job description
- Company website URL
- Number of preparation days

The system then:

1. Extracts structured requirements from the job description.
2. Researches the company website.
3. Discovers relevant pages dynamically.
4. Searches for publicly available interview-related information.
5. Generates personalized interview questions.
6. Links questions to specific job requirements.
7. Checks whether all must-have requirements are covered.
8. Runs a second coverage pass when required.
9. Generates flashcards.
10. Creates a preparation schedule for exactly the requested number of days.
11. Allows the user to edit and manage the generated kit.
12. Provides a practice mode based on confidence and coverage.

---

## ✨ Features

### Authentication

- User registration
- User login
- JWT-based authentication
- Protected API routes
- Users can access only their own interview kits

### Interview Kit Creation

Each kit contains:

- Company information
- Role information
- Seniority
- Responsibilities
- Technical and non-technical requirements
- Interview questions
- Answer outlines
- Flashcards
- Preparation schedule
- Requirement coverage information

### Company Research

The backend can:

- Crawl the provided company website
- Discover relevant links dynamically
- Respect robots.txt rules
- Handle redirects safely
- Retry temporary failures
- Skip inaccessible pages
- Limit response size and request time
- Prevent requests to private/loopback network addresses

Research failures are reported as gaps instead of silently inventing information.

### AI-Generated Questions

Questions are generated based on the extracted requirements.

Each question contains:

- Question ID
- Requirement IDs
- Category
- Question prompt
- Answer outline
- Difficulty from 1–3

### Requirement Coverage

The application checks generated questions against the extracted requirements.

Must-have requirements receive higher priority.

If requirements remain uncovered, the system performs an additional coverage pass.

The final kit stores:

```json
{
  "uncovered_requirement_ids": [],
  "passes": 1
}

Architecture

The application is divided into separate frontend and backend applications.

                    ┌──────────────────────┐
                    │      Next.js UI      │
                    │   React + Tailwind   │
                    └──────────┬───────────┘
                               │
                               │ REST API
                               ▼
                    ┌──────────────────────┐
                    │   Express Backend    │
                    │      TypeScript      │
                    └──────────┬───────────┘
                               │
              ┌────────────────┼─────────────────┐
              │                │                 │
              ▼                ▼                 ▼
       Authentication      AI Pipeline       Research
          JWT              Gemini API        Web Crawler
              │                │                 │
              └────────────────┼─────────────────┘
                               │
                               ▼
                         ┌───────────┐
                         │ MongoDB   │
                         └───────────┘


Backend layers


Routes
  ↓
Controllers
  ↓
Services
  ├── AI
  ├── Crawler
  ├── Research
  ├── Pipeline
  ├── Scheduling
  └── Validation
  ↓
Models
  ↓
MongoDB


🛠️ Tech Stack
Frontend
Next.js
React
TypeScript
Tailwind CSS
React Router / Next.js routing
Fetch-based API integration
Backend
Node.js
Express.js
TypeScript
MongoDB
Mongoose
JWT
Zod
Vitest
AI
Google Gemini API
@google/genai

Current models:

Primary:
gemini-3.6-flash

Fallback:
gemini-3.5-flash-lite

The fallback model is used when the primary model encounters supported provider availability or quota failures.

Deployment
Frontend: Vercel
Backend: Render
Database: MongoDB



AI Generation Pipeline

The kit generation pipeline follows a sequential workflow

Job Description
      ↓
Requirement Extraction
      ↓
Company URL Validation
      ↓
Company Website Crawl
      ↓
Research Text Preparation
      ↓
Company Brief
      ↓
Public Interview Research
      ↓
Personalized Questions
      ↓
Requirement Coverage Check
      ↓
Additional Coverage Pass
      ↓
Flashcards
      ↓
Deterministic Schedule
      ↓
Final Validation
      ↓
MongoDB




🔍 Company Research

The crawler does not rely on a fixed list of company URL paths.

It dynamically discovers links from the provided company website and ranks relevant pages.

The crawler includes:

URL validation
HTTP/HTTPS restriction
DNS resolution checks
Private IP protection
Loopback protection
Redirect validation
robots.txt handling
Request timeout
Response size limits
Retry/backoff handling
HTML/XHTML content validation
Same-host restrictions

If a company website cannot be accessed, the application continues with thin research where possible and reports the research gap.


Project Structure


AI_Interview_Prepration/
│
├── backend/
│   ├── evaluation/
│   │   ├── cases.json
│   │   └── kits.json
│   │
│   ├── scripts/
│   │   ├── evaluate.ts
│   │   └── evaluationHelpers.ts
│   │
│   ├── src/
│   │   ├── config/
│   │   ├── controllers/
│   │   ├── middleware/
│   │   ├── models/
│   │   ├── routes/
│   │   ├── services/
│   │   │   ├── ai/
│   │   │   ├── crawler/
│   │   │   ├── pipeline/
│   │   │   ├── research/
│   │   │   ├── scheduling/
│   │   │   └── validation/
│   │   ├── tests/
│   │   └── server.ts
│   │
│   ├── .env
│   ├── package.json
│   └── tsconfig.json
│
├── frontend/
│   ├── app/
│   ├── components/
│   ├── lib/
│   ├── types/
│   ├── package.json
│   └── ...
│
└── README.md




Local Setup
1. Clone the repository
git clone https://github.com/mdmaj/AI_Interview_Prepration.git
cd AI_Interview_Prepration
2. Backend Setup
cd backend
npm install

Create a .env file:

MONGODB_URI=your_mongodb_connection_string
JWT_SECRET=your_jwt_secret

GEMINI_API_KEY=your_gemini_api_key
GEMINI_MODEL=gemini-3.6-flash
GEMINI_FALLBACK_MODEL=gemini-3.5-flash-lite

TAVILY_API_KEY=your_tavily_api_key

Start the backend:

npm run dev

The backend will run locally on the configured port.

Health endpoint:

/api/health
🖥️ Frontend Setup

Open another terminal:

cd frontend
npm install

Create:

frontend/.env.local

Add:

NEXT_PUBLIC_API_URL=http://localhost:5000/api

Start the frontend:

npm run dev

The Next.js application will be available on the local development URL shown by Next.js.




Deployment
Frontend

The frontend is deployed on Vercel.

https://ai-interview-prepration-blond.vercel.app
Backend

The backend is deployed on Render.

https://ai-interview-prepration-0d55.onrender.com
Database

MongoDB is used as the production database.

Production secrets are configured through the deployment platform environment variables.

⚠️ Edge Case Handling

The application is designed to handle:

Invalid company URLs
404 URLs
Timeout errors
Unreachable company websites
Missing hiring/about pages
Very short job descriptions
No public interview discussions
robots.txt restrictions
LLM JSON validation failures
LLM provider failures
Rate limits
Duplicate generated content
1-day preparation plans
Large preparation windows
Partial company research

When research is incomplete but a valid kit can still be generated, the system reports the research gap instead of pretending that the missing information was found.

🧠 Design Decisions
Why requirement IDs?

Stable requirement IDs allow questions, flashcards, coverage checks, and schedules to reference the same underlying job requirement.

Why deterministic scheduling?

The schedule needs to produce predictable output and guarantee that all requested days are represented.

Why separate research and generation?

Keeping crawling/research separate from LLM generation makes failures easier to isolate and allows incomplete research to be reported without necessarily failing the entire kit.

Why model fallback?

Free-tier AI providers can have rate limits and quotas. A fallback model improves resilience and allows the evaluator to continue when the primary model becomes unavailable.

Why validation?

LLM output is not assumed to be correct. Generated structures are validated before they are persisted.

🤝 AI-Assisted Development

AI coding and research tools were used during development for:

Debugging
Code suggestions
API integration guidance
Architecture discussions
Test generation assistance
Error analysis
Documentation assistance

All generated code and model outputs were reviewed, tested, and integrated manually.

The final implementation was validated using automated tests, the batch evaluator, local testing, and deployed application testing.

📌 Known Limitations
Company research quality depends on the accessibility and structure of the provided website.
Public interview information may not always be available.
LLM output quality depends on the selected provider/model and available quota.
Free-tier AI providers may impose request limits.
Some websites may block automated crawling through robots.txt or other restrictions.

When these limitations occur, the application attempts to continue with the available information and reports research gaps.

👨‍💻 Author

Md Mazid Hussain

BTech Computer Science Engineering

GitHub:
https://github.com/mdmaj

LinkedIn:
https://www.linkedin.com/in/md-mazid-hussain-maj1707/

Portfolio:
https://www.mdmaj.in/

⭐ Project Status

The project currently includes:

✅ Authentication
✅ Interview kit generation
✅ Company research
✅ Web crawling
✅ Gemini AI integration
✅ Requirement extraction
✅ Requirement coverage
✅ Coverage pass
✅ Interview questions
✅ Flashcards
✅ Deterministic schedule
✅ Practice mode
✅ Kit editing
✅ Batch evaluator
✅ Automated tests
✅ Production frontend deployment
✅ Production backend deployment
✅ 5/5 batch evaluation success

