
# SkillProof AI – AI-Powered Skill Assessment & Document Verification

SkillProof AI is a full-stack AI-powered platform that helps users evaluate their skills through AI-based interviews, practical challenges, evidence verification, and personalized feedback.

## 🚀 Features

- Secure User Registration and Login
- AI-Powered Interviews using Claude AI
- Skill Assessment and Evaluation
- Evidence Verification
- AI-Generated Feedback and Suggestions
- Performance Reports and Scores
- Report Sharing through Public Links
- Supabase Database Integration
- Demo Mode without Backend Setup

## 🛠️ Technologies Used

- **Frontend:** HTML, CSS, JavaScript
- **Backend:** Python, FastAPI
- **Database:** Supabase
- **Authentication:** Supabase Auth
- **AI Integration:** Anthropic Claude API
- **Testing:** Pytest
- **Deployment:** Render and Netlify

## 📁 Project Structure

```text
SkillProof-AI/
│
├── backend/
│   ├── main.py
│   ├── ai.py
│   ├── requirements.txt
│   ├── .env.example
│   ├── .gitignore
│   └── tests/
│       └── test_api.py
│
├── frontend/
│   ├── index.html
│   ├── style.css
│   ├── script.js
│   └── config.js
│
├── demo/
│   └── skillproof-ai.html
│
├── supabase.sql
├── README.md
└── .gitignore
```

## ⚙️ Installation and Setup

### 1. Clone Repository

```bash
git clone YOUR_GITHUB_REPOSITORY_URL
cd SkillProof-AI
```

### 2. Install Backend Dependencies

```bash
cd backend
python -m venv .venv
.venv\Scripts\activate
pip install -r requirements.txt
```

### 3. Configure Environment Variables

Create a `.env` file inside the backend folder using `.env.example`.

Add your credentials:

```env
ANTHROPIC_API_KEY=your_anthropic_api_key
SUPABASE_URL=your_supabase_project_url
SUPABASE_ANON_KEY=your_supabase_anon_key
```

### 4. Configure Supabase

1. Create a Supabase project.
2. Open SQL Editor.
3. Run the `supabase.sql` file.
4. Copy your Project URL and anon public key.
5. Configure email authentication and redirect URLs.

### 5. Run Backend

```bash
uvicorn main:app --reload
```

Backend:
http://127.0.0.1:8000

API Documentation:
http://127.0.0.1:8000/docs

### 6. Configure Frontend

Update `frontend/config.js` with your Supabase credentials and backend URL.

Start the frontend:

```bash
cd frontend
python -m http.server 5500
```

Open:
http://127.0.0.1:5500

## 🧪 Testing

Run backend tests:

```bash
pytest
```

## 🌐 Deployment

**Backend:** Render

**Frontend:** Netlify

**Database and Authentication:** Supabase

## 🔐 Security

- API keys are stored in backend environment variables.
- Never upload `.env` files to GitHub.
- Never expose the Supabase service role key.
- Row Level Security (RLS) protects user data.
- Shared reports can be accessed by anyone with their share link.

## 🎯 Project Objective

To make skill assessment smarter, easier, and more reliable using AI-powered interviews, evidence verification, and personalized performance feedback.

## 👩‍💻 Project

**SkillProof AI**

*AI-Powered Skill Assessment & Verification Platform*
