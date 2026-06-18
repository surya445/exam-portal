let user = null;
let currentExam = null;
let answers = [];
let reviewMarks = [];
let timer;
let currentQuestionIndex = 0;
let examTimeLeft = 0;

const app = document.getElementById("app");
const SESSION_TIME = 72 * 60 * 60 * 1000;

checkSavedLogin();

function saveLogin(userData) {
  localStorage.setItem("examUser", JSON.stringify({
    user: userData,
    loginTime: Date.now()
  }));
}

function checkSavedLogin() {
  const saved = localStorage.getItem("examUser");

  if (!saved) {
    showLogin();
    return;
  }

  const data = JSON.parse(saved);
  const expired = Date.now() - data.loginTime > SESSION_TIME;

  if (expired) {
    localStorage.removeItem("examUser");
    showLogin();
    return;
  }

  user = data.user;
  if (user.role === "admin") showAdminDashboard();
  else showStudentDashboard();
}

function formatTime(seconds) {
  let min = Math.floor(seconds / 60);
  let sec = seconds % 60;
  if (sec < 10) sec = "0" + sec;
  return min + " min " + sec + " sec";
}

function safeText(text) {
  return String(text).replace(/'/g, "\\'");
}

function showLogin() {
  app.innerHTML = `
    <div class="login-page">
      <div class="login-box">
        <div class="gov-header">
          <div class="emblem">🛡</div>
          <div class="logo">ONLINE EXAMINATION SYSTEM</div>
          <p class="subtitle">Government Competitive Examination Portal</p>
          <div class="exam-info">SSC • UPSC • RRB • Banking • State Exams</div>
        </div>

        <input id="id" placeholder="Enter Candidate ID">
        <input id="password" type="password" placeholder="Enter Password">
        <button style="width:100%" onclick="login()">LOGIN</button>
        <p class="note">Secure CBT Based Examination Login</p>
      </div>
    </div>
  `;
}

async function login() {
  const id = document.getElementById("id").value;
  const password = document.getElementById("password").value;

  const res = await fetch("/login", {
    method: "POST",
    headers: {"Content-Type": "application/json"},
    body: JSON.stringify({ id, password })
  });

  const data = await res.json();

  if (!data.success) {
    alert(data.message);
    return;
  }

  user = data.user;
  saveLogin(user);

  if (user.role === "admin") showAdminDashboard();
  else showStudentDashboard();
}

function layout(content) {
  return `
    <div class="layout">
      <div class="sidebar">
        <h2>ONLINE EXAM</h2>
        <div class="menu">
          ${
            user.role === "admin" ?
            `
            <button onclick="showAdminDashboard()">Dashboard</button>
            <button onclick="showSeriesAdmin()">Series & Subjects</button>
            <button onclick="showCreateExam()">Create Exam</button>
            <button onclick="showStudents()">Students</button>
            <button onclick="showAdmins()">Admins</button>
            <button onclick="showAdminResults()">Results</button>
            <button onclick="showProfile()">Profile</button>
            `
            :
            `
            <button onclick="showStudentDashboard()">Dashboard</button>
            <button onclick="showJoinedSeries()">Course</button>
            
            <button onclick="showProfile()">Profile</button>
            `
          }
          <button class="logout" onclick="logout()">Logout</button>
        </div>
      </div>

      <div class="main">
        <div class="topbar">
          <div>
            <h2>Government Examination Portal</h2>
            <span class="badge">${user.role.toUpperCase()}</span>
          </div>
          <div class="profile">
            <b>${user.name}</b><br>
            <small>${user.course || "Administrator"}</small>
          </div>
        </div>
        ${content}
      </div>
    </div>
  `;
}

/* STUDENT */

async function showStudentDashboard() {
  const series = await fetch("/series").then(r => r.json());
  const joined = await fetch("/student-series/" + user.id).then(r => r.json());
  const results = await fetch("/results/" + user.id).then(r => r.json());

  const joinedIds = joined.map(j => j.seriesId);
  const latest = results.length ? results[results.length - 1] : null;

  const correct = latest ? latest.correctCount || 0 : 0;
  const wrong = latest ? latest.wrongCount || 0 : 0;
  const notAttempted = latest ? latest.notAttempted || 0 : 0;
  const total = correct + wrong + notAttempted || 1;

  const correctPercent = Math.round((correct / total) * 100);
  const wrongPercent = Math.round((wrong / total) * 100);
  const notPercent = Math.round((notAttempted / total) * 100);

  app.innerHTML = layout(`
    <div class="student-hero">
      <div>
        <span class="exam-tag">CBT EXAM PORTAL</span>
        <h1>Online Test Series</h1>
        <p>Join a course series, open subject-wise tests, and attempt exams in secure CBT mode.</p>
      </div>

      <div class="performance-card">
        <h3>Latest Performance</h3>
        ${
          latest ? `
            <div class="score-circle">
              <span>${latest.percentage}%</span>
              <small>Score</small>
            </div>
            <div class="performance-row"><span>Correct</span><b class="green">${correct}</b></div>
            <div class="bar"><div class="bar-green" style="width:${correctPercent}%"></div></div>
            <div class="performance-row"><span>Wrong</span><b class="red">${wrong}</b></div>
            <div class="bar"><div class="bar-red" style="width:${wrongPercent}%"></div></div>
            <div class="performance-row"><span>Not Attempted</span><b class="gray">${notAttempted}</b></div>
            <div class="bar"><div class="bar-gray" style="width:${notPercent}%"></div></div>
          `
          : `
            <div class="no-performance">
              <h4>No Performance Yet</h4>
              <p>Attempt an exam to see your report.</p>
            </div>
          `
        }
      </div>
    </div>

    <div class="grid">
      <div class="stat-card premium"><h3>Joined Course</h3><p>${joined.length}</p></div>
      <div class="stat-card premium"><h3>Total Attempts</h3><p>${results.length}</p></div>
      <div class="stat-card premium"><h3>Available Series</h3><p>${series.length}</p></div>
    </div>

    <div class="section premium-section">
      <h2>Available Exam Series</h2>
      <p class="muted">Join a series once. After joining, open it from the Course menu.</p>

      ${series.length ? series.map(s => `
        <div class="exam-premium-card">
          <div>
            <span class="exam-tag">TEST SERIES</span>
            <h3>${s.name}</h3>
            <p>${s.description || "Subject-wise online mock tests"}</p>
          </div>
          ${
            joinedIds.includes(s.id)
            ? `<button onclick="showJoinedSeries()">Joined</button>`
            : `<button onclick="joinSeries(${s.id})">Join Series</button>`
          }
        </div>
      `).join("") : `
        <div class="empty-state">
          <h3>No Test Series Available</h3>
          <p>Your institute has not published any exam series yet.</p>
        </div>
      `}
    </div>
  `);
}

async function joinSeries(seriesId) {
  const res = await fetch("/join-series", {
    method: "POST",
    headers: {"Content-Type": "application/json"},
    body: JSON.stringify({ studentId: user.id, seriesId })
  });

  const data = await res.json();

  if (data.success) {
    alert(data.message || "Thank you for joining the series");
    showJoinedSeries();
  }
}

async function showJoinedSeries() {
  const joined = await fetch("/student-series/" + user.id).then(r => r.json());

  app.innerHTML = layout(`
    <div class="course-header">
      <span class="exam-tag">COURSE</span>
      <h1>My Test Series</h1>
      <p>Select a joined series to open subjects and tests.</p>
    </div>

    <div class="section premium-section">
      ${joined.length ? joined.map(s => `
        <div class="exam-premium-card">
          <div>
            <span class="exam-tag">JOINED SERIES</span>
            <h3>${s.name}</h3>
            <p>${s.description || "Subject-wise CBT tests"}</p>
          </div>
          <button onclick="showSeriesSubjects(${s.seriesId}, '${safeText(s.name)}')">Open Course</button>
        </div>
      `).join("") : `
        <div class="empty-state">
          <h3>No Series Joined</h3>
          <p>Go to dashboard and join any available test series.</p>
        </div>
      `}
    </div>
  `);
}

async function showSeriesSubjects(seriesId, seriesName) {
  const subjects = await fetch("/subjects/" + seriesId).then(r => r.json());

  app.innerHTML = layout(`
    <div class="course-header">
      <span class="exam-tag">${seriesName}</span>
      <h1>Subject-wise Tests</h1>
      <p>Click on a subject to load its available exams below.</p>
    </div>

    <div class="subject-list">
      ${subjects.length ? subjects.map((sub, index) => `
        <button class="subject-line" onclick="showSubjectExamsInline(${sub.id}, '${safeText(sub.name)}')">
          <span>${index + 1}</span>
          <b>${sub.name}</b>
          <small>View Tests</small>
        </button>
      `).join("") : `
        <div class="empty-state">
          <h3>No Subjects Added</h3>
          <p>Your institute has not added subjects in this series yet.</p>
        </div>
      `}
    </div>

    <div id="subjectExamArea"></div>
  `);
}

async function showSubjectExamsInline(subjectId, subjectName) {
  const exams = await fetch("/exams/subject/" + subjectId).then(r => r.json());
  const allResults = await fetch("/results/" + user.id).then(r => r.json());

  document.getElementById("subjectExamArea").innerHTML = `
    <div class="section premium-section">
      <h2>${subjectName} Tests</h2>

      ${exams.length ? exams.map(e => {
        const attempts = allResults.filter(r => r.examId === e.id);

        return `
        <div class="exam-premium-card">
          <div>
            <span class="exam-tag">CBT MODE</span>
            <h3>${e.title}</h3>
            <p>${e.questions.length} Questions • ${formatTime(e.time)}</p>
            <small>
              Correct: +${e.marksPerQuestion || 1} |
              Negative: -${e.negativeMarks || 0} |
              Attempts: ${attempts.length}
            </small>
          </div>

          <div style="display:flex; gap:10px;">
            <button onclick="showExamInstructions(${e.id})">
              ${attempts.length > 0 ? "Reattempt" : "Start Exam"}
            </button>

            ${
              attempts.length > 0
              ? `<button onclick="showExamAttemptResultsPage(${e.id})">Result</button>`
              : ""
            }
          </div>
        </div>

        <div id="resultBox-${e.id}"></div>
      `}).join("") : `
        <div class="empty-state">
          <h3>No Tests Available</h3>
          <p>No exam is published in this subject yet.</p>
        </div>
      `}
    </div>
  `;
}
async function showExamAttemptResultsPage(examId) {
  const results = await fetch("/results/" + user.id).then(r => r.json());
  const exams = await fetch("/exams").then(r => r.json());

  const exam = exams.find(e => e.id === examId);
  const examResults = results.filter(r => r.examId === examId);

  app.innerHTML = layout(`
    <div class="course-header">
      <span class="exam-tag">RESULT</span>
      <h1>${exam ? exam.title : "Exam Result"}</h1>
      <p>Attempt-wise performance report</p>
    </div>

    <div class="section premium-section">
      <h2>Attempt History</h2>

      ${examResults.length ? examResults.map(r => `
        <div class="attempt-box">
          <h3>Attempt ${r.attemptNo || 1}</h3>
          <p><b>Score:</b> ${r.score}/${r.totalMarks}</p>
          <p><b>Percentage:</b> ${r.percentage || 0}%</p>
          <p>
            <b>Correct:</b> ${r.correctCount || 0}
            &nbsp;|&nbsp;
            <b>Wrong:</b> ${r.wrongCount || 0}
            &nbsp;|&nbsp;
            <b>Not Attempted:</b> ${r.notAttempted || 0}
          </p>
          <p><b>Date:</b> ${r.date}</p>
        </div>
      `).join("") : `
        <div class="empty-state">
          <h3>No Result Found</h3>
          <p>You have not attempted this exam yet.</p>
        </div>
      `}

      <button onclick="showJoinedSeries()">Back to Course</button>
    </div>
  `);
}

async function showExamInstructions(id) {
  const exams = await fetch("/exams").then(r => r.json());
  currentExam = exams.find(e => e.id === id);

  app.innerHTML = `
    <div class="main" style="margin-left:0;width:100%">
      <div class="section">
        <h2>${currentExam.title}</h2>
        <h3>Exam Instructions</h3>

        <div class="card">
          <p>${currentExam.instructions || "Read all questions carefully."}</p>
          <p><b>Total Questions:</b> ${currentExam.questions.length}</p>
          <p><b>Time:</b> ${formatTime(currentExam.time)}</p>
          <p><b>Correct Marks:</b> +${currentExam.marksPerQuestion || 1}</p>
          <p><b>Negative Marks:</b> -${currentExam.negativeMarks || 0}</p>
        </div>

        <button onclick="startExam()">Start Fullscreen Exam</button>
        <button onclick="showJoinedSeries()">Back to Course</button>
      </div>
    </div>
  `;
}

function startExam() {
  answers = new Array(currentExam.questions.length).fill(null);
  reviewMarks = new Array(currentExam.questions.length).fill(false);
  currentQuestionIndex = 0;
    examTimeLeft = currentExam.time;

 

  renderExamScreen();
}

function renderExamScreen() {
  app.innerHTML = `
    <div class="exam-screen">
      <div class="exam-top">
        <h2>${currentExam.title}</h2>
        <h3 id="time">Time Left: ${formatTime(examTimeLeft)}</h3>
      </div>

      <div class="exam-layout">
        <div class="exam-main-panel">
          <div id="questionArea"></div>

          <div class="exam-actions">
            <button onclick="prevQuestion()">Previous</button>
            <button onclick="markForReview()">Mark for Review</button>
            <button onclick="saveAndNext()">Save & Next</button>
            <button class="logout" onclick="confirmSubmit()">Submit Exam</button>
          </div>
        </div>

        <div class="question-sidebar">
          <h3>Questions</h3>
          <div id="questionNumbers"></div>

          <div class="summary-box">
            <p><span class="dot answered-dot"></span> Answered: <b id="answeredCount">0</b></p>
            <p><span class="dot pending-dot"></span> Not Answered: <b id="pendingCount">0</b></p>
            <p><span class="dot review-dot"></span> Review: <b id="reviewCount">0</b></p>
            <p><span class="dot current-dot"></span> Current: <b id="currentCount">1</b></p>
          </div>
        </div>
      </div>
    </div>
  `;

  showQuestion();

  timer = setInterval(() => {
    examTimeLeft--;
    document.getElementById("time").innerText =
      "Time Left: " + formatTime(examTimeLeft);

    if (examTimeLeft <= 0) {
      clearInterval(timer);
      submitExam(true);
    }
  }, 1000);
}

function showQuestion() {
  const q = currentExam.questions[currentQuestionIndex];

  document.getElementById("questionArea").innerHTML = `
    <div class="card question-card">
      <h3>Question ${currentQuestionIndex + 1} of ${currentExam.questions.length}</h3>
      <h2>${q.question}</h2>

      ${q.options.map((op, j) => `
        <label class="option-box">
          <input
            type="radio"
            name="q"
            ${answers[currentQuestionIndex] === j ? "checked" : ""}
            onclick="selectAnswer(${j})"
          >
          ${String.fromCharCode(65 + j)}. ${op}
        </label>
      `).join("")}

      <p class="muted">
        Status: ${reviewMarks[currentQuestionIndex] ? "Marked for Review" : "Normal"}
      </p>
    </div>
  `;

  renderQuestionNumbers();
  updateExamSummary();
}

function selectAnswer(index) {
  answers[currentQuestionIndex] = index;
  renderQuestionNumbers();
  updateExamSummary();
}

function renderQuestionNumbers() {
  document.getElementById("questionNumbers").innerHTML =
    currentExam.questions.map((q, i) => {
      let cls = "q-number pending-q";

      if (answers[i] !== null) cls = "q-number answered-q";
      if (reviewMarks[i]) cls = "q-number review-q";
      if (i === currentQuestionIndex) cls += " current-q";

      return `<button class="${cls}" onclick="jumpQuestion(${i})">${i + 1}</button>`;
    }).join("");
}

function updateExamSummary() {
  const answered = answers.filter(a => a !== null).length;
  const review = reviewMarks.filter(x => x).length;
  const pending = currentExam.questions.length - answered;

  document.getElementById("answeredCount").innerText = answered;
  document.getElementById("pendingCount").innerText = pending;
  document.getElementById("reviewCount").innerText = review;
  document.getElementById("currentCount").innerText = currentQuestionIndex + 1;
}

function jumpQuestion(index) {
  currentQuestionIndex = index;
  showQuestion();
}

function saveAndNext() {
  if (currentQuestionIndex < currentExam.questions.length - 1) {
    currentQuestionIndex++;
    showQuestion();
  } else {
    alert("This is the last question");
  }
}

function prevQuestion() {
  if (currentQuestionIndex > 0) {
    currentQuestionIndex--;
    showQuestion();
  }
}

function markForReview() {
  reviewMarks[currentQuestionIndex] = !reviewMarks[currentQuestionIndex];
  showQuestion();
}

function confirmSubmit() {
  const msg = currentExam.submitWarning || "Are you sure you want to submit this exam?";

  if (confirm(msg)) {
    submitExam(false);
  }
}

async function submitExam(autoSubmitted) {
  clearInterval(timer);

  

  const res = await fetch("/submit", {
    method: "POST",
    headers: {"Content-Type": "application/json"},
    body: JSON.stringify({
      studentId: user.id,
      examId: currentExam.id,
      answers
    })
  });

  const result = await res.json();

  app.innerHTML = layout(`
    <div class="section">
      <h2>${autoSubmitted ? "Time Over - Exam Auto Submitted" : "Exam Submitted Successfully"}</h2>
      <h3>Attempt ${result.attemptNo || 1}</h3>

      <h3>Your Score: ${result.score}/${result.totalMarks}</h3>
      <p><b>Percentage:</b> ${result.percentage}%</p>
      <p><b>Correct:</b> ${result.correctCount}</p>
      <p><b>Wrong:</b> ${result.wrongCount}</p>
      <p><b>Not Attempted:</b> ${result.notAttempted}</p>

      <h2>Answer Key</h2>
      ${result.review.map(r => `
        <div class="card">
          <b>${r.question}</b><br><br>

          Your Answer:
          <span class="${r.status === 'Correct' ? 'correct' : 'wrong'}">
            ${r.yourAnswer}
          </span><br>

          Correct Answer:
          <span class="correct">${r.correctAnswer}</span><br>

          Status: ${r.status}<br>
          Marks: ${r.marks}
        </div>
      `).join("")}

      <button onclick="showStudentDashboard()">Back to Dashboard</button>
    </div>
  `);
}

async function showStudentResults() {
  const results = await fetch("/results/" + user.id).then(r => r.json());

  app.innerHTML = layout(`
    <div class="section">
      <h2>My Results</h2>

      ${results.length ? results.map(r => `
        <div class="card">
          <h3>${r.examTitle}</h3>
          <p><b>Attempt:</b> ${r.attemptNo || 1}</p>
          <p><b>Score:</b> ${r.score}/${r.totalMarks}</p>
          <p><b>Percentage:</b> ${r.percentage || 0}%</p>
          <p><b>Correct:</b> ${r.correctCount || 0}</p>
          <p><b>Wrong:</b> ${r.wrongCount || 0}</p>
          <p><b>Not Attempted:</b> ${r.notAttempted || 0}</p>
          <p><b>Date:</b> ${r.date}</p>
        </div>
      `).join("") : "<p>No result found</p>"}
    </div>
  `);
}

/* ADMIN */

async function showAdminDashboard() {
  const exams = await fetch("/admin/exams").then(r => r.json());
  const results = await fetch("/admin/results").then(r => r.json());
  const students = await fetch("/admin/students").then(r => r.json());
  const admins = await fetch("/admin/admins").then(r => r.json());
  const series = await fetch("/series").then(r => r.json());

  app.innerHTML = layout(`
    <div class="grid">
      <div class="stat-card">
        <h3>Total Series</h3>
        <p>${series.length}</p>
      </div>

      <div class="stat-card">
        <h3>Total Exams</h3>
        <p>${exams.length}</p>
      </div>

      <div class="stat-card">
        <h3>Total Students</h3>
        <p>${students.length}</p>
      </div>

      <div class="stat-card">
        <h3>Total Admins</h3>
        <p>${admins.length}</p>
      </div>

      <div class="stat-card">
        <h3>Total Attempts</h3>
        <p>${results.length}</p>
      </div>
    </div>

    <div class="section">
      <h2>Published Exams</h2>

      ${exams.length ? exams.map(e => `
        <div class="card">
          <h3>${e.title}</h3>
          <p>${e.questions.length} Questions • ${formatTime(e.time)}</p>
          <p>Correct: +${e.marksPerQuestion || 1} | Wrong: -${e.negativeMarks || 0}</p>
          <div style="display:flex; gap:10px; margin-top:10px;">
          <button onclick="editExam(${e.id})">Edit Exam</button>
          <button class="logout" onclick="deleteExam(${e.id})">Delete Exam</button>
        </div>
        </div>
      `).join("") : "<p>No exam published</p>"}
    </div>
  `);
}

async function showSeriesAdmin() {
  const series = await fetch("/series").then(r => r.json());

  app.innerHTML = layout(`
    <div class="section">
      <h2>Add Exam Series</h2>

      <input id="seriesName" placeholder="Series Name, example: SSC">
      <input id="seriesDesc" placeholder="Series Description">

      <button onclick="addSeries()">Add Series</button>
    </div>

    <div class="section">
      <h2>Add Subject</h2>

      <select id="subjectSeries">
        <option value="">Select Series</option>
        ${series.map(s => `<option value="${s.id}">${s.name}</option>`).join("")}
      </select>

      <input id="subjectName" placeholder="Subject Name, example: Mathematics">

      <button onclick="addSubject()">Add Subject</button>
    </div>

    <div class="section">
      <h2>Available Series</h2>

      ${series.length ? series.map(s => `
        <div class="card">
          <h3>${s.name}</h3>
          <p>${s.description}</p>

          <button class="logout" onclick="deleteSeries(${s.id})">
            Delete Series
          </button>
        </div>
      `).join("") : "<p>No series added yet</p>"}
    </div>
  `);
}

async function addSeries() {
  const name = document.getElementById("seriesName").value;
  const description = document.getElementById("seriesDesc").value;

  if (!name) {
    alert("Series name required");
    return;
  }

  const res = await fetch("/admin/add-series", {
    method: "POST",
    headers: {"Content-Type": "application/json"},
    body: JSON.stringify({ name, description })
  });

  const data = await res.json();

  if (!data.success) {
    alert(data.message);
    return;
  }

  alert("Series added");
  showSeriesAdmin();
}

async function deleteSeries(seriesId) {
  const ok = confirm(
    "Series delete karne par uske subjects aur exams bhi delete ho jayenge. Continue?"
  );

  if (!ok) return;

  const res = await fetch("/admin/delete-series/" + seriesId, {
    method: "DELETE"
  });

  const data = await res.json();

  if (data.success) {
    alert("Series deleted");
    showSeriesAdmin();
  }
}
async function addSubject() {
  const seriesId = document.getElementById("subjectSeries").value;
  const name = document.getElementById("subjectName").value;

  if (!seriesId || !name) {
    alert("Series aur subject name required");
    return;
  }

  const res = await fetch("/admin/add-subject", {
    method: "POST",
    headers: {"Content-Type": "application/json"},
    body: JSON.stringify({ seriesId, name })
  });

  const data = await res.json();

  if (!data.success) {
    alert(data.message);
    return;
  }

  alert("Subject added");
  showSeriesAdmin();
}

async function showCreateExam() {
  const series = await fetch("/series").then(r => r.json());

  app.innerHTML = layout(`
    <div class="section">
      <h2>Create & Publish New Exam</h2>

      <select id="examSeries" onchange="loadSubjectOptions()">
        <option value="">Select Series</option>
        ${series.map(s => `<option value="${s.id}">${s.name}</option>`).join("")}
      </select>

      <select id="examSubject">
        <option value="">Select Subject</option>
      </select>

      <input id="examTitle" placeholder="Exam Title">
      <input id="examTime" type="number" placeholder="Time in seconds, example: 600">
      <input id="publishAt" type="datetime-local">
      <input id="marksPerQuestion" type="number" step="0.01" placeholder="Marks for correct answer">
      <input id="negativeMarks" type="number" step="0.01" placeholder="Negative marks for wrong answer">

      <textarea id="instructions" placeholder="Exam instructions"></textarea>
      <textarea id="submitWarning" placeholder="Submit warning popup message"></textarea>

      <div id="questionBox"></div>

      <button onclick="addQuestion()">+ Add Question</button>
      <button onclick="publishExam()">Publish Exam</button>
    </div>
  `);

  addQuestion();
}

async function loadSubjectOptions() {
  const seriesId = document.getElementById("examSeries").value;
  const subjects = await fetch("/subjects/" + seriesId).then(r => r.json());

  document.getElementById("examSubject").innerHTML = `
    <option value="">Select Subject</option>
    ${subjects.map(s => `<option value="${s.id}">${s.name}</option>`).join("")}
  `;
}

function addQuestion() {
  const questionBox = document.getElementById("questionBox");
  const count = questionBox.children.length + 1;

  const html = `
    <div class="card question-card">
      <h3>Question ${count}</h3>

      <input class="question enter-next" placeholder="Enter Question">
      <input class="option1 enter-next" placeholder="Option A">
      <input class="option2 enter-next" placeholder="Option B">
      <input class="option3 enter-next" placeholder="Option C">
      <input class="option4 enter-next" placeholder="Option D">

      <input class="answer enter-next" type="number" min="1" max="4" placeholder="Correct Option Number: 1, 2, 3, or 4">

      <p><small>Jo option number correct doge, wahi correct hoga. Baaki options wrong honge.</small></p>
    </div>
  `;

  questionBox.insertAdjacentHTML("beforeend", html);
  enableEnterNext();

  const allInputs = document.querySelectorAll(".enter-next");
  allInputs[allInputs.length - 6].focus();
}

function enableEnterNext() {
  const inputs = document.querySelectorAll(".enter-next");

  inputs.forEach((input, index) => {
    input.onkeydown = function(event) {
      if (event.key === "Enter") {
        event.preventDefault();

        if (inputs[index + 1]) {
          inputs[index + 1].focus();
        }
      }
    };
  });
}

async function publishExam() {
  const seriesId = document.getElementById("examSeries").value;
  const subjectId = document.getElementById("examSubject").value;
  const title = document.getElementById("examTitle").value;
  const time = document.getElementById("examTime").value;
  const publishAtInput = document.getElementById("publishAt").value;
  const publishAt = publishAtInput ? new Date(publishAtInput).toISOString() : "";
  const marksPerQuestion = document.getElementById("marksPerQuestion").value || 1;
  const negativeMarks = document.getElementById("negativeMarks").value || 0;
  const instructions = document.getElementById("instructions").value;
  const submitWarning = document.getElementById("submitWarning").value;

  if (!seriesId || !subjectId || !title || !time) {
    alert("Series, subject, title aur time fill karo");
    return;
  }

  const questionCards = document.querySelectorAll(".question-card");
  const questions = [];

  questionCards.forEach(card => {
    const question = card.querySelector(".question").value;
    const option1 = card.querySelector(".option1").value;
    const option2 = card.querySelector(".option2").value;
    const option3 = card.querySelector(".option3").value;
    const option4 = card.querySelector(".option4").value;
    const answer = Number(card.querySelector(".answer").value) - 1;

    if (
      question &&
      option1 &&
      option2 &&
      option3 &&
      option4 &&
      answer >= 0 &&
      answer <= 3
    ) {
      questions.push({
        question,
        options: [option1, option2, option3, option4],
        answer
      });
    }
  });

  if (questions.length === 0) {
    alert("Kam se kam 1 valid question add karo");
    return;
  }

  const res = await fetch("/admin/add-exam", {
    method: "POST",
    headers: {"Content-Type": "application/json"},
    body: JSON.stringify({
      seriesId,
      subjectId,
      title,
      publishAt,
      time,
      marksPerQuestion,
      negativeMarks,
      instructions,
      submitWarning,
      questions
    })
  });

  const data = await res.json();

  if (!data.success) {
    alert(data.message);
    return;
  }

  alert("Exam successfully publish ho gaya");
  showAdminDashboard();
}

async function showStudents() {
  const students = await fetch("/admin/students").then(r => r.json());

  app.innerHTML = layout(`
    <div class="section">
      <h2>Add Student Login</h2>

      <input id="studentId" placeholder="Student ID">
      <input id="studentPassword" placeholder="Student Password">
      <input id="studentName" placeholder="Student Name">
      <input id="studentCourse" placeholder="Course / Batch">

      <button onclick="addStudent()">Add Student</button>
    </div>

    <div class="section">
      <h2>All Students</h2>

      ${students.length ? students.map(s => `
        <div class="card exam-premium-card">
          <div>
            <h3>${s.name}</h3>
            <p><b>ID:</b> ${s.id}</p>
            <p><b>Course:</b> ${s.course || "Not Added"}</p>
          </div>

          <button onclick="adminViewStudent('${s.id}', '${safeText(s.name)}')">
            View Report
          </button>
        </div>
      `).join("") : "<p>No student added yet</p>"}
    </div>
  `);
}

async function adminViewStudent(studentId, studentName) {
  const joined = await fetch("/student-series/" + studentId).then(r => r.json());

  app.innerHTML = layout(`
    <div class="course-header">
      <span class="exam-tag">STUDENT REPORT</span>
      <h1>${studentName}</h1>
      <p>View enrolled courses, subjects, exams and attempt-wise reports.</p>
    </div>

    <div class="section premium-section">
      <h2>Enrolled Courses</h2>

      ${joined.length ? joined.map(s => `
        <div class="exam-premium-card">
          <div>
            <span class="exam-tag">ENROLLED</span>
            <h3>${s.name}</h3>
            <p>${s.description || "Course series"}</p>
          </div>

          <button onclick="adminViewStudentSubjects('${studentId}', '${safeText(studentName)}', ${s.seriesId}, '${safeText(s.name)}')">
            Open Course
          </button>
        </div>
      `).join("") : `
        <div class="empty-state">
          <h3>No Course Joined</h3>
          <p>This student has not joined any course yet.</p>
        </div>
      `}

      <button onclick="showStudents()">Back to Students</button>
    </div>
  `);
}

async function adminViewStudentSubjects(studentId, studentName, seriesId, seriesName) {
  const subjects = await fetch("/subjects/" + seriesId).then(r => r.json());

  app.innerHTML = layout(`
    <div class="course-header">
      <span class="exam-tag">${seriesName}</span>
      <h1>${studentName} - Subject Report</h1>
      <p>Select subject to view exam reports.</p>
    </div>

    <div class="subject-list">
      ${subjects.length ? subjects.map((sub, index) => `
        <button class="subject-line" onclick="adminViewStudentSubjectResults('${studentId}', '${safeText(studentName)}', ${sub.id}, '${safeText(sub.name)}')">
          <span>${index + 1}</span>
          <b>${sub.name}</b>
          <small>View Report</small>
        </button>
      `).join("") : `
        <div class="empty-state">
          <h3>No Subjects Added</h3>
        </div>
      `}
    </div>

    <div id="subjectExamArea"></div>
  `);
}

async function adminViewStudentSubjectResults(studentId, studentName, subjectId, subjectName) {
  const exams = await fetch("/admin/exams").then(r => r.json());
  const results = await fetch("/results/" + studentId).then(r => r.json());

  const subjectExams = exams.filter(e => e.subjectId === subjectId);

  document.getElementById("subjectExamArea").innerHTML = `
    <div class="section premium-section">
      <h2>${studentName} - ${subjectName} Attempts</h2>

      ${subjectExams.length ? subjectExams.map(e => {
        const attempts = results.filter(r => r.examId === e.id);

        return `
          <div class="card">
            <h3>${e.title}</h3>
            <p><b>Total Attempts:</b> ${attempts.length}</p>

            ${
              attempts.length ? attempts.map(r => `
                <div class="attempt-box">
                  <h3>Attempt ${r.attemptNo || 1}</h3>

                  <p><b>Score:</b> ${r.score}/${r.totalMarks}</p>
                  <p><b>Percentage:</b> ${r.percentage || 0}%</p>
                  <p>
                    <b>Correct:</b> ${r.correctCount || 0}
                    | <b>Wrong:</b> ${r.wrongCount || 0}
                    | <b>Not Attempted:</b> ${r.notAttempted || 0}
                  </p>
                  <p><b>Date:</b> ${r.date}</p>

                  <button onclick="adminViewAttemptResponse('${studentId}', ${r.examId}, ${r.attemptNo || 1})">
                    View Response
                  </button>
                </div>
              `).join("")
              : `<p>No attempt yet</p>`
            }
          </div>
        `;
      }).join("") : `
        <div class="empty-state">
          <h3>No Exams Found</h3>
        </div>
      `}
    </div>
  `;
}
async function adminViewAttemptResponse(studentId, examId, attemptNo) {
  const results = await fetch("/results/" + studentId).then(r => r.json());

  const result = results.find(
    r =>
      r.examId === examId &&
      Number(r.attemptNo || 1) === Number(attemptNo)
  );

  if (!result) {
    alert("Attempt response not found");
    return;
  }

  app.innerHTML = layout(`
    <div class="course-header">
      <span class="exam-tag">STUDENT RESPONSE</span>
      <h1>${result.studentName}</h1>
      <p>${result.examTitle} - Attempt ${result.attemptNo || 1}</p>
    </div>

    <div class="section premium-section">
      <h2>Attempt Summary</h2>

      <div class="grid">
        <div class="stat-card">
          <h3>Score</h3>
          <p>${result.score}/${result.totalMarks}</p>
        </div>

        <div class="stat-card">
          <h3>Correct</h3>
          <p>${result.correctCount || 0}</p>
        </div>

        <div class="stat-card">
          <h3>Wrong</h3>
          <p>${result.wrongCount || 0}</p>
        </div>

        <div class="stat-card">
          <h3>Not Attempted</h3>
          <p>${result.notAttempted || 0}</p>
        </div>
      </div>

      <h2 style="margin-top:25px;">Question Wise Response</h2>

      ${result.review && result.review.length ? result.review.map((q, i) => `
        <div class="card response-card ${q.status === "Correct" ? "response-correct" : q.status === "Wrong" ? "response-wrong" : "response-not"}">
          <h3>Q${i + 1}. ${q.question}</h3>

          <p>
            <b>Student Answer:</b>
            <span class="${q.status === "Correct" ? "correct" : q.status === "Wrong" ? "wrong" : "gray"}">
              ${q.yourAnswer}
            </span>
          </p>

          <p>
            <b>Correct Answer:</b>
            <span class="correct">${q.correctAnswer}</span>
          </p>

          <p><b>Status:</b> ${q.status}</p>
          <p><b>Marks:</b> ${q.marks}</p>
        </div>
      `).join("") : `
        <div class="empty-state">
          <h3>No Response Found</h3>
        </div>
      `}

      <button onclick="showStudents()">Back to Students</button>
    </div>
  `);
}

async function addStudent() {
  const id = document.getElementById("studentId").value;
  const password = document.getElementById("studentPassword").value;
  const name = document.getElementById("studentName").value;
  const course = document.getElementById("studentCourse").value;

  const res = await fetch("/admin/add-student", {
    method: "POST",
    headers: {"Content-Type": "application/json"},
    body: JSON.stringify({ id, password, name, course })
  });

  const data = await res.json();

  if (!data.success) {
    alert(data.message);
    return;
  }

  alert("Student add ho gaya");
  showStudents();
}

async function showAdmins() {
  const admins = await fetch("/admin/admins").then(r => r.json());

  app.innerHTML = layout(`
    <div class="section">
      <h2>Add New Admin</h2>

      <input id="adminId" placeholder="Admin ID">
      <input id="adminPassword" placeholder="Admin Password">
      <input id="adminName" placeholder="Admin Name">

      <button onclick="addAdmin()">Add Admin</button>
    </div>

    <div class="section">
      <h2>All Admins</h2>

      ${admins.length ? admins.map(a => `
        <div class="card">
          <h3>${a.name}</h3>
          <p><b>ID:</b> ${a.id}</p>
        </div>
      `).join("") : "<p>No admin found</p>"}
    </div>
  `);
}

async function addAdmin() {
  const id = document.getElementById("adminId").value;
  const password = document.getElementById("adminPassword").value;
  const name = document.getElementById("adminName").value;

  const res = await fetch("/admin/add-admin", {
    method: "POST",
    headers: {"Content-Type": "application/json"},
    body: JSON.stringify({ id, password, name })
  });

  const data = await res.json();

  if (!data.success) {
    alert(data.message);
    return;
  }

  alert("Admin add ho gaya");
  showAdmins();
}

async function showAdminResults() {
  const results = await fetch("/admin/results").then(r => r.json());

  const grouped = {};

  results.forEach(r => {
    const key = r.studentId + "_" + r.examId;

    if (!grouped[key]) {
      grouped[key] = {
        studentName: r.studentName,
        studentId: r.studentId,
        examTitle: r.examTitle,
        attempts: []
      };
    }

    grouped[key].attempts.push(r);
  });

  app.innerHTML = layout(`
    <div class="section">
      <h2>All Student Results & Attempts</h2>

      ${Object.values(grouped).length ? Object.values(grouped).map(group => `
        <div class="card">
          <h3>${group.studentName}</h3>
          <p><b>ID:</b> ${group.studentId}</p>
          <p><b>Exam:</b> ${group.examTitle}</p>
          <p><b>Total Attempts:</b> ${group.attempts.length}</p>

          ${group.attempts.map(r => `
            <div class="attempt-box">
              <b>Attempt ${r.attemptNo || 1}</b>
              <p>Score: ${r.score}/${r.totalMarks}</p>
              <p>Percentage: ${r.percentage || 0}%</p>
              <p>Correct: ${r.correctCount || 0}, Wrong: ${r.wrongCount || 0}, Not Attempted: ${r.notAttempted || 0}</p>
              <p>Date: ${r.date}</p>
            </div>
          `).join("")}
        </div>
      `).join("") : "<p>No result found</p>"}
    </div>
  `);
}

function showProfile() {
  app.innerHTML = layout(`
    <div class="section">
      <h2>My Profile</h2>

      <div class="card">
        <p><b>User ID:</b> ${user.id}</p>
        <p><b>Role:</b> ${user.role}</p>
        <p><b>Course:</b> ${user.course || "Administrator"}</p>
      </div>

      <h3>Update Name</h3>
      <input id="newName" value="${user.name}" placeholder="Enter New Name">

      <h3>Change Password</h3>
      <input id="oldPassword" type="password" placeholder="Current Password">
      <input id="newPassword" type="password" placeholder="New Password">
      <input id="confirmPassword" type="password" placeholder="Confirm New Password">

      <button onclick="updateProfile()">Save Changes</button>
    </div>
  `);
}

async function updateProfile() {
  const name = document.getElementById("newName").value;
  const oldPassword = document.getElementById("oldPassword").value;
  const newPassword = document.getElementById("newPassword").value;
  const confirmPassword = document.getElementById("confirmPassword").value;

  if (newPassword && newPassword !== confirmPassword) {
    alert("New password aur confirm password same nahi hai");
    return;
  }

  const res = await fetch("/update-profile", {
    method: "POST",
    headers: {"Content-Type": "application/json"},
    body: JSON.stringify({
      userId: user.id,
      name,
      oldPassword,
      newPassword
    })
  });

  const data = await res.json();

  if (!data.success) {
    alert(data.message);
    return;
  }

  user = data.user;
  saveLogin(user);

  alert("Profile update ho gayi");
  showProfile();
}
async function deleteExam(id) {
  if (!confirm("Are you sure you want to delete this exam?")) return;

  const res = await fetch("/admin/delete-exam/" + id, {
    method: "DELETE"
  });

  const data = await res.json();

  if (data.success) {
    alert("Exam deleted successfully");
    showAdminDashboard();
  }
}

async function editExam(id) {
  const exam = await fetch("/admin/exam/" + id).then(r => r.json());
  const series = await fetch("/series").then(r => r.json());
  const subjects = await fetch("/subjects/" + exam.seriesId).then(r => r.json());

  app.innerHTML = layout(`
    <div class="section">
      <h2>Edit Exam</h2>

      <select id="editSeries" onchange="loadEditSubjectOptions()">
        ${series.map(s => `
          <option value="${s.id}" ${s.id === exam.seriesId ? "selected" : ""}>
            ${s.name}
          </option>
        `).join("")}
      </select>

      <select id="editSubject">
        ${subjects.map(s => `
          <option value="${s.id}" ${s.id === exam.subjectId ? "selected" : ""}>
            ${s.name}
          </option>
        `).join("")}
      </select>

      <input id="editTitle" value="${exam.title}" placeholder="Exam Title">
      <input id="editTime" type="number" value="${exam.time}" placeholder="Time in seconds">
      <input id="editPublishAt" type="datetime-local" value="${exam.publishAt || ""}">
      <input id="editMarks" type="number" step="0.01" value="${exam.marksPerQuestion || 1}">
      <input id="editNegative" type="number" step="0.01" value="${exam.negativeMarks || 0}">

      <textarea id="editInstructions">${exam.instructions || ""}</textarea>
      <textarea id="editSubmitWarning">${exam.submitWarning || ""}</textarea>

      <h2>Questions</h2>
      <div id="editQuestionBox"></div>

      <button onclick="addEditQuestion()">+ Add Question</button>
      <button onclick="updateExam(${exam.id})">Update Exam</button>
      <button onclick="showAdminDashboard()">Cancel</button>
    </div>
  `);

  document.getElementById("editQuestionBox").innerHTML =
    exam.questions.map((q, i) => `
      <div class="card edit-question-card">
        <h3>Question ${i + 1}</h3>

        <input class="edit-question" value="${q.question}" placeholder="Question">
        <input class="edit-option1" value="${q.options[0] || ""}" placeholder="Option A">
        <input class="edit-option2" value="${q.options[1] || ""}" placeholder="Option B">
        <input class="edit-option3" value="${q.options[2] || ""}" placeholder="Option C">
        <input class="edit-option4" value="${q.options[3] || ""}" placeholder="Option D">

        <input class="edit-answer" type="number" min="1" max="4" value="${Number(q.answer) + 1}" placeholder="Correct Option 1-4">

        <button class="logout" onclick="this.parentElement.remove()">Remove Question</button>
      </div>
    `).join("");
}

async function loadEditSubjectOptions() {
  const seriesId = document.getElementById("editSeries").value;
  const subjects = await fetch("/subjects/" + seriesId).then(r => r.json());

  document.getElementById("editSubject").innerHTML =
    subjects.map(s => `<option value="${s.id}">${s.name}</option>`).join("");
}

function addEditQuestion() {
  const box = document.getElementById("editQuestionBox");
  const count = box.children.length + 1;

  box.insertAdjacentHTML("beforeend", `
    <div class="card edit-question-card">
      <h3>Question ${count}</h3>

      <input class="edit-question" placeholder="Question">
      <input class="edit-option1" placeholder="Option A">
      <input class="edit-option2" placeholder="Option B">
      <input class="edit-option3" placeholder="Option C">
      <input class="edit-option4" placeholder="Option D">

      <input class="edit-answer" type="number" min="1" max="4" placeholder="Correct Option 1-4">

      <button class="logout" onclick="this.parentElement.remove()">Remove Question</button>
    </div>
  `);
}

async function updateExam(id) {
  const cards = document.querySelectorAll(".edit-question-card");
  const questions = [];

  cards.forEach(card => {
    const question = card.querySelector(".edit-question").value;
    const option1 = card.querySelector(".edit-option1").value;
    const option2 = card.querySelector(".edit-option2").value;
    const option3 = card.querySelector(".edit-option3").value;
    const option4 = card.querySelector(".edit-option4").value;
    const answer = Number(card.querySelector(".edit-answer").value) - 1;

    if (
      question &&
      option1 &&
      option2 &&
      option3 &&
      option4 &&
      answer >= 0 &&
      answer <= 3
    ) {
      questions.push({
        question,
        options: [option1, option2, option3, option4],
        answer
      });
    }
  });

  if (questions.length === 0) {
    alert("Kam se kam 1 valid question hona chahiye");
    return;
  }

  const updatedExam = {
    seriesId: Number(document.getElementById("editSeries").value),
    subjectId: Number(document.getElementById("editSubject").value),
    title: document.getElementById("editTitle").value,
    time: Number(document.getElementById("editTime").value),
    publishAt: document.getElementById("editPublishAt").value
  ? new Date(document.getElementById("editPublishAt").value).toISOString()
  : "",
    marksPerQuestion: Number(document.getElementById("editMarks").value || 1),
    negativeMarks: Number(document.getElementById("editNegative").value || 0),
    instructions: document.getElementById("editInstructions").value,
    submitWarning: document.getElementById("editSubmitWarning").value,
    questions
  };

  const res = await fetch("/admin/update-exam/" + id, {
    method: "PUT",
    headers: {"Content-Type": "application/json"},
    body: JSON.stringify(updatedExam)
  });

  const data = await res.json();

  if (!data.success) {
    alert(data.message);
    return;
  }

  alert("Exam updated successfully");
  showAdminDashboard();
}

function logout() {
  clearInterval(timer);
  localStorage.removeItem("examUser");
  user = null;
  showLogin();
}