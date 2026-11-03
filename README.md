# StudyMate AI 📚

### Your AI-Powered Study & Exam Preparation Assistant

StudyMate AI is an AI-powered learning platform designed to help students understand topics, organize study materials, and prepare for examinations more effectively.

Students can enter a topic, provide their class notes, and generate structured revision summaries, interactive flashcards, and MCQ quizzes using AI.

🌐 **Live Demo:** [https://studymate-workspace.netlify.app/](https://studymate-workspace.netlify.app/)

---

## ✨ Features

### 🤖 AI-Powered Study Materials

- Generate study materials from topics or provided class notes.
- Create structured, exam-oriented revision summaries.
- Adjust content according to difficulty level.
- Choose different summary styles.
- Use your own supported AI provider API key.

### 📝 AI Revision Summaries

- Organized headings and subheadings.
- Important definitions and concepts.
- Detailed explanations and examples.
- Code snippets and comparison tables where relevant.
- Important examination points and quick revision notes.
- Copy, download, and listen to generated summaries.

### 🎯 Interactive MCQ Quizzes

- Automatically generated multiple-choice questions.
- Multiple answer options.
- Instant answer evaluation.
- Explanations for correct answers.
- Score tracking to evaluate understanding.

### 🗂️ Interactive Flashcards

- AI-generated question-and-answer cards.
- Interactive card-flipping functionality.
- Mark cards as known or needing revision.
- Track revision progress.

### 📖 My Notes

- Create and manage personal study notes.
- Edit and delete notes.
- Search saved notes.
- Automatic saving.
- Access notes after refreshing the browser.

### 📊 Study History

- Save previously generated study sessions.
- Reopen previous study materials.
- Search through study sessions.
- Delete individual sessions.
- Clear study history.

### ⚙️ Personalization & Settings

- Configure your AI provider.
- Add and manage your own API key.
- Set default study difficulty.
- Choose preferred summary styles.
- Light and dark themes.

### 📱 Responsive Design

- Clean and modern user interface.
- Collapsible sidebar navigation.
- Responsive desktop, tablet, and mobile layouts.

---

## 🛠️ Technology Stack

| Technology        | Purpose                                    |
| ----------------- | ------------------------------------------ |
| HTML5             | Application structure                      |
| CSS3              | Styling and responsive layouts             |
| JavaScript        | Application logic and interactivity        |
| Google Gemini API | AI-powered content generation              |
| LocalStorage      | Browser-based data persistence             |
| Netlify           | Hosting and deployment                     |
| Git & GitHub      | Version control and source code management |

---

## 🚀 Getting Started

Follow these instructions to run StudyMate AI locally.

### 1. Clone the Repository

```bash
git clone https://github.com/Chandan-Mahajan/StudyMate-Ai.git
```

### 2. Navigate to the Project Directory

```bash
cd StudyMate-Ai
```

### 3. Open the Project

Open the project folder in Visual Studio Code.

```bash
code .
```

### 4. Run the Application

You can use the VS Code Live Server extension.

1. Install Live Server in VS Code.
2. Open `index.html`.
3. Right-click and select **Open with Live Server**.
4. The application will open in your browser.

---

## 🔑 AI API Configuration

StudyMate AI allows users to configure their own AI API key.

To use AI-powered features:

1. Visit [Google AI Studio](https://aistudio.google.com/apikey).
2. Generate a Gemini API key.
3. Open StudyMate AI.
4. Navigate to **Settings → AI Connection**.
5. Select Google Gemini.
6. Enter your API key.
7. Save your API settings.
8. Open Study Workspace and generate study materials.

**Note:** AI generation requires a valid API key and access to a supported model. API usage may be subject to provider quotas and pricing.

---

## 📂 Project Structure

```text
StudyMate-Ai/
│
├── index.html
├── style.css
├── script.js
│
├── StudyMate-logo.png
├── StudyMate-icon.png
│
├── README.md
└── .gitignore
```

*The project structure above represents the main application files. Additional assets or configuration files may also be present.*

---

## 💾 Data Storage

StudyMate AI currently uses browser LocalStorage for prototype data persistence.

- Study notes are stored locally.
- Study history is stored locally.
- User preferences are stored locally.
- API key configuration is stored in the browser.

Data is associated with the browser and device being used. It does not automatically synchronize between devices.

Registration submission and centralized cloud storage are not currently enabled.

---

## 🔒 Security & Privacy

- Users provide their own AI API keys.
- API keys are stored in browser storage in the current prototype.
- Never share your API key or commit it to GitHub.
- Browser-side API key storage is not suitable for secure production credential management.
- AI-generated content should be verified against reliable study materials.
- Personal Information submission is temporarily unavailable.

A secure backend should be implemented before using the application for broader public production with sensitive credentials or personal data.

---

## 🌐 Deployment

StudyMate AI is deployed using Netlify and connected to GitHub.

**Live Website:** [https://studymate-workspace.netlify.app/](https://studymate-workspace.netlify.app/)

The deployment is configured to publish the main branch. New changes pushed to GitHub can trigger automatic deployments.

---

## 🎯 Project Goal

The goal of StudyMate AI is to make learning more organized, interactive, and accessible.

Instead of switching between different tools for notes, revision, and practice, students can use one workspace to:

- Understand new topics.
- Generate structured study notes.
- Revise using flashcards.
- Test their knowledge with quizzes.
- Track their learning progress.

**Study smarter. Revise better. Prepare with confidence.**

---

## 👨‍💻 Author

**Chandan Mahajan**

B.Tech Computer Science and Engineering Student

- GitHub: [Chandan-Mahajan](https://github.com/Chandan-Mahajan)
- LinkedIn: [Chandan Mahajan](https://www.linkedin.com/in/chandan-mahajan-02335a380/)

---

## 📄 License

This project is currently an academic and personal development project.

A formal open-source license can be added to define permissions for reuse, modification, and distribution.

---

\<p align="center">
&#x20; Made with ❤️ for students.
&#x20; \<br>
&#x20; \<strong>StudyMate AI — Learn Smarter, Not Harder.\</strong>
\</p>
