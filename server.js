const express = require("express");
const fs = require("fs");
const cors = require("cors");

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.static("public"));

const DB = "database.json";

function readDB() {
  return JSON.parse(fs.readFileSync(DB, "utf8"));
}

function writeDB(data) {
  fs.writeFileSync(DB, JSON.stringify(data, null, 2));
}

function ensureArrays(db) {
  db.users = db.users || [];
  db.examSeries = db.examSeries || [];
  db.subjects = db.subjects || [];
  db.studentSeries = db.studentSeries || [];
  db.exams = db.exams || [];
  db.results = db.results || [];
}

function isPublishedExam(exam) {
  if (!exam.publishAt) return true;
  return new Date(exam.publishAt).getTime() <= Date.now();
}

app.post("/login", (req, res) => {
  const { id, password } = req.body;
  const db = readDB();
  ensureArrays(db);

  const user = db.users.find(u => u.id === id && u.password === password);

  if (!user) {
    return res.json({ success: false, message: "Wrong ID or Password" });
  }

  res.json({
    success: true,
    user: {
      id: user.id,
      name: user.name,
      role: user.role,
      course: user.course || ""
    }
  });
});

app.post("/update-profile", (req, res) => {
  const { userId, name, oldPassword, newPassword } = req.body;
  const db = readDB();
  ensureArrays(db);

  const user = db.users.find(u => u.id === userId);

  if (!user) {
    return res.json({ success: false, message: "User not found" });
  }

  if (name) user.name = name;

  if (newPassword) {
    if (user.password !== oldPassword) {
      return res.json({ success: false, message: "Old password wrong hai" });
    }
    user.password = newPassword;
  }

  writeDB(db);

  res.json({
    success: true,
    user: {
      id: user.id,
      name: user.name,
      role: user.role,
      course: user.course || ""
    }
  });
});

app.get("/series", (req, res) => {
  const db = readDB();
  ensureArrays(db);
  res.json(db.examSeries);
});

app.get("/subjects/:seriesId", (req, res) => {
  const db = readDB();
  ensureArrays(db);

  const seriesId = Number(req.params.seriesId);
  res.json(db.subjects.filter(s => s.seriesId === seriesId));
});

app.post("/join-series", (req, res) => {
  const { studentId, seriesId } = req.body;
  const db = readDB();
  ensureArrays(db);

  const alreadyJoined = db.studentSeries.find(
    x => x.studentId === studentId && x.seriesId === Number(seriesId)
  );

  if (!alreadyJoined) {
    db.studentSeries.push({
      studentId,
      seriesId: Number(seriesId),
      joinedAt: new Date().toLocaleString()
    });
    writeDB(db);
  }

  res.json({
    success: true,
    message: "Thank you for joining the series"
  });
});

app.get("/student-series/:studentId", (req, res) => {
  const db = readDB();
  ensureArrays(db);

  const joined = db.studentSeries
    .filter(x => x.studentId === req.params.studentId)
    .map(x => {
      const series = db.examSeries.find(s => s.id === x.seriesId);
      return {
        ...x,
        name: series ? series.name : "Unknown",
        description: series ? series.description : ""
      };
    });

  res.json(joined);
});

app.get("/exams", (req, res) => {
  const db = readDB();
  ensureArrays(db);
  res.json(db.exams.filter(isPublishedExam));
});

app.get("/admin/exams", (req, res) => {
  const db = readDB();
  ensureArrays(db);
  res.json(db.exams);
});

app.get("/exams/subject/:subjectId", (req, res) => {
  const db = readDB();
  ensureArrays(db);

  const subjectId = Number(req.params.subjectId);

  const exams = db.exams
    .filter(e => e.subjectId === subjectId)
    .filter(isPublishedExam);

  res.json(exams);
});

app.post("/submit", (req, res) => {
  const { studentId, examId, answers } = req.body;
  const db = readDB();
  ensureArrays(db);

  const student = db.users.find(u => u.id === studentId);
  const exam = db.exams.find(e => e.id === examId);

  if (!student || !exam) {
    return res.json({ success: false, message: "Student or Exam not found" });
  }

  const marksPerQuestion = Number(exam.marksPerQuestion || 1);
  const negativeMarks = Number(exam.negativeMarks || 0);

  let score = 0;
  let correctCount = 0;
  let wrongCount = 0;
  let notAttempted = 0;
  let review = [];

  exam.questions.forEach((q, i) => {
    const userAnswer = answers[i];

    if (userAnswer === null || userAnswer === undefined) {
      notAttempted++;

      review.push({
        question: q.question,
        yourAnswer: "Not Attempted",
        correctAnswer: q.options[q.answer],
        status: "Not Attempted",
        marks: 0
      });

      return;
    }

    const correct = userAnswer === q.answer;

    if (correct) {
      correctCount++;
      score += marksPerQuestion;
    } else {
      wrongCount++;
      score -= negativeMarks;
    }

    review.push({
      question: q.question,
      yourAnswer: q.options[userAnswer],
      correctAnswer: q.options[q.answer],
      status: correct ? "Correct" : "Wrong",
      marks: correct ? marksPerQuestion : -negativeMarks
    });
  });

  const totalMarks = exam.questions.length * marksPerQuestion;
  const percentage =
    totalMarks > 0 ? ((score / totalMarks) * 100).toFixed(2) : 0;

  const previousAttempts = db.results.filter(
    r => r.studentId === studentId && r.examId === examId
  );

  const attemptNo = previousAttempts.length + 1;

  const result = {
    studentId,
    studentName: student.name,
    examId,
    examTitle: exam.title,
    attemptNo,
    score,
    totalMarks,
    percentage,
    correctCount,
    wrongCount,
    notAttempted,
    marksPerQuestion,
    negativeMarks,
    date: new Date().toLocaleString(),
    review
  };

  db.results.push(result);
  writeDB(db);

  res.json(result);
});

app.get("/results/:studentId", (req, res) => {
  const db = readDB();
  ensureArrays(db);

  const results = db.results.filter(r => r.studentId === req.params.studentId);
  res.json(results);
});

app.get("/admin/results", (req, res) => {
  const db = readDB();
  ensureArrays(db);

  res.json(db.results);
});

app.get("/admin/students", (req, res) => {
  const db = readDB();
  ensureArrays(db);

  const students = db.users
    .filter(u => u.role === "student")
    .map(u => ({
      id: u.id,
      name: u.name,
      course: u.course || ""
    }));

  res.json(students);
});

app.get("/admin/admins", (req, res) => {
  const db = readDB();
  ensureArrays(db);

  const admins = db.users
    .filter(u => u.role === "admin")
    .map(u => ({
      id: u.id,
      name: u.name,
      course: u.course || ""
    }));

  res.json(admins);
});

app.post("/admin/add-student", (req, res) => {
  const { id, password, name, course } = req.body;
  const db = readDB();
  ensureArrays(db);

  if (!id || !password || !name) {
    return res.json({
      success: false,
      message: "ID, password aur name required hai"
    });
  }

  const exists = db.users.find(u => u.id === id);

  if (exists) {
    return res.json({
      success: false,
      message: "Ye ID already exist karti hai"
    });
  }

  db.users.push({
    id,
    password,
    name,
    role: "student",
    course: course || ""
  });

  writeDB(db);

  res.json({
    success: true,
    message: "Student added successfully"
  });
});

app.post("/admin/add-admin", (req, res) => {
  const { id, password, name } = req.body;
  const db = readDB();
  ensureArrays(db);

  if (!id || !password || !name) {
    return res.json({
      success: false,
      message: "Admin ID, password aur name required hai"
    });
  }

  const exists = db.users.find(u => u.id === id);

  if (exists) {
    return res.json({
      success: false,
      message: "Ye ID already exist karti hai"
    });
  }

  db.users.push({
    id,
    password,
    name,
    role: "admin",
    course: ""
  });

  writeDB(db);

  res.json({
    success: true,
    message: "Admin added successfully"
  });
});

app.post("/admin/add-series", (req, res) => {
  const { name, description } = req.body;
  const db = readDB();
  ensureArrays(db);

  if (!name) {
    return res.json({
      success: false,
      message: "Series name required hai"
    });
  }

  const newSeries = {
    id: Date.now(),
    name,
    description: description || ""
  };

  db.examSeries.push(newSeries);
  writeDB(db);

  res.json({
    success: true,
    series: newSeries
  });
});

app.delete("/admin/delete-series/:seriesId", (req, res) => {
  const db = readDB();
  ensureArrays(db);

  const seriesId = Number(req.params.seriesId);

  db.examSeries = db.examSeries.filter(s => s.id !== seriesId);

  const subjectIds = db.subjects
    .filter(s => s.seriesId === seriesId)
    .map(s => s.id);

  db.subjects = db.subjects.filter(s => s.seriesId !== seriesId);

  db.exams = db.exams.filter(
    e => e.seriesId !== seriesId && !subjectIds.includes(e.subjectId)
  );

  db.studentSeries = db.studentSeries.filter(x => x.seriesId !== seriesId);

  writeDB(db);

  res.json({
    success: true,
    message: "Series deleted successfully"
  });
});

app.post("/admin/add-subject", (req, res) => {
  const { seriesId, name } = req.body;
  const db = readDB();
  ensureArrays(db);

  if (!seriesId || !name) {
    return res.json({
      success: false,
      message: "Series aur subject name required hai"
    });
  }

  const newSubject = {
    id: Date.now(),
    seriesId: Number(seriesId),
    name
  };

  db.subjects.push(newSubject);
  writeDB(db);

  res.json({
    success: true,
    subject: newSubject
  });
});

app.delete("/admin/delete-subject/:subjectId", (req, res) => {
  const db = readDB();
  ensureArrays(db);

  const subjectId = Number(req.params.subjectId);

  db.subjects = db.subjects.filter(s => s.id !== subjectId);
  db.exams = db.exams.filter(e => e.subjectId !== subjectId);

  writeDB(db);

  res.json({
    success: true,
    message: "Subject deleted successfully"
  });
});

app.post("/admin/add-exam", (req, res) => {
  const {
    seriesId,
    subjectId,
    title,
    time,
    publishAt,
    marksPerQuestion,
    negativeMarks,
    instructions,
    submitWarning,
    questions
  } = req.body;

  const db = readDB();
  ensureArrays(db);

  if (!seriesId || !subjectId || !title || !time || !questions || !questions.length) {
    return res.json({
      success: false,
      message: "Exam details incomplete hain"
    });
  }

  const newExam = {
    id: Date.now(),
    seriesId: Number(seriesId),
    subjectId: Number(subjectId),
    title,
    time: Number(time),
    publishAt: publishAt || "",
    marksPerQuestion: Number(marksPerQuestion || 1),
    negativeMarks: Number(negativeMarks || 0),
    instructions:
      instructions || "Please read all questions carefully before submitting.",
    submitWarning:
      submitWarning || "Are you sure you want to submit this exam?",
    questions
  };

  db.exams.push(newExam);
  writeDB(db);

  res.json({
    success: true,
    exam: newExam
  });
});
app.get("/admin/exam/:id", (req, res) => {
  const db = readDB();
  ensureArrays(db);

  const exam = db.exams.find(e => e.id === Number(req.params.id));

  res.json(exam || null);
});

app.put("/admin/update-exam/:id", (req, res) => {
  const db = readDB();
  ensureArrays(db);

  const index = db.exams.findIndex(e => e.id === Number(req.params.id));

  if (index === -1) {
    return res.json({
      success: false,
      message: "Exam not found"
    });
  }

  db.exams[index] = {
    ...db.exams[index],
    ...req.body,
    id: db.exams[index].id
  };

  writeDB(db);

  res.json({
    success: true,
    message: "Exam updated successfully"
  });
});

app.delete("/admin/delete-exam/:id", (req, res) => {
  const db = readDB();
  ensureArrays(db);

  db.exams = db.exams.filter(e => e.id !== Number(req.params.id));

  writeDB(db);

  res.json({
    success: true,
    message: "Exam deleted successfully"
  });
});

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log("Server running on port " + PORT);
});