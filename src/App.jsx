import React, { useEffect, useMemo, useRef, useState } from "react";
import { rawQuestionText } from "./questions";

const QUESTIONS_PER_PART = 45;
const TIMER_OPTIONS = [10, 15, 20, 30, 45, 60, 90, 120];

function shuffleArray(items) {
  const arr = [...items];
  for (let i = arr.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

function formatTime(seconds) {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${String(mins).padStart(2, "0")}:${String(secs).padStart(2, "0")}`;
}

function toCsvCell(value) {
  const safe = String(value ?? "").replace(/"/g, '""');
  return `"${safe}"`;
}

function parseQuestions(raw) {
  return raw
    .split("++++")
    .map((block) => block.trim())
    .filter(Boolean)
    .map((block, index) => {
      const parts = block
        .split("====")
        .map((part) => part.replace(/\r/g, "").trim())
        .filter(Boolean);

      if (parts.length < 5) return null;

      const question = parts[0];
      const rawOptions = parts.slice(1, 5);
      const correctIndex = rawOptions.findIndex((option) => option.startsWith("#"));

      if (!question || rawOptions.length !== 4 || correctIndex < 0) return null;

      return {
        id: `q-${index + 1}`,
        question,
        options: rawOptions.map((option) => option.replace(/^#/, "").trim()),
        answer: correctIndex,
      };
    })
    .filter(Boolean);
}

const allQuestions = parseQuestions(rawQuestionText);
const totalParts = Math.ceil(allQuestions.length / QUESTIONS_PER_PART);

function getQuestionsForMode(mode) {
  if (mode === "all") return allQuestions;
  const partIndex = Number(mode.replace("part-", "")) - 1;
  const start = partIndex * QUESTIONS_PER_PART;
  return allQuestions.slice(start, start + QUESTIONS_PER_PART);
}

const styles = {
  page: {
    minHeight: "100vh",
    background: "linear-gradient(135deg, #f8fafc 0%, #ffffff 50%, #eef2ff 100%)",
    color: "#0f172a",
    fontFamily: "Inter, system-ui, sans-serif",
    padding: 24,
  },
  container: {
    maxWidth: 1200,
    margin: "0 auto",
  },
  card: {
    background: "#ffffff",
    border: "1px solid #e2e8f0",
    borderRadius: 24,
    boxShadow: "0 10px 30px rgba(15, 23, 42, 0.08)",
  },
  softCard: {
    background: "#ffffff",
    border: "1px solid #e2e8f0",
    borderRadius: 20,
    padding: 16,
  },
  badge: {
    display: "inline-flex",
    alignItems: "center",
    gap: 8,
    padding: "8px 12px",
    borderRadius: 999,
    fontSize: 13,
    fontWeight: 700,
    background: "#e2e8f0",
    color: "#0f172a",
  },
  primaryBadge: {
    display: "inline-flex",
    alignItems: "center",
    gap: 8,
    padding: "8px 12px",
    borderRadius: 999,
    fontSize: 13,
    fontWeight: 700,
    background: "#0f172a",
    color: "#ffffff",
  },
  button: {
    border: "none",
    borderRadius: 16,
    padding: "12px 18px",
    fontSize: 15,
    fontWeight: 700,
    cursor: "pointer",
    background: "#0f172a",
    color: "#ffffff",
  },
  outlineButton: {
    border: "1px solid #cbd5e1",
    borderRadius: 16,
    padding: "12px 18px",
    fontSize: 15,
    fontWeight: 700,
    cursor: "pointer",
    background: "#ffffff",
    color: "#0f172a",
  },
  input: {
    width: "100%",
    padding: "12px 14px",
    borderRadius: 14,
    border: "1px solid #cbd5e1",
    fontSize: 15,
    boxSizing: "border-box",
    background: "#fff",
  },
  label: {
    display: "block",
    fontSize: 14,
    fontWeight: 700,
    marginBottom: 8,
  },
  progressWrap: {
    width: "100%",
    height: 10,
    background: "#e2e8f0",
    borderRadius: 999,
    overflow: "hidden",
  },
  progressFill: (value) => ({
    width: `${value}%`,
    height: "100%",
    background: "linear-gradient(90deg, #0f172a, #475569)",
  }),
  option: {
    width: "100%",
    textAlign: "left",
    border: "1px solid #e2e8f0",
    background: "#ffffff",
    borderRadius: 18,
    padding: 16,
    cursor: "pointer",
    fontSize: 15,
    lineHeight: 1.6,
  },
  optionSelected: {
    width: "100%",
    textAlign: "left",
    border: "1px solid #0f172a",
    background: "#0f172a",
    color: "#ffffff",
    borderRadius: 18,
    padding: 16,
    cursor: "pointer",
    fontSize: 15,
    lineHeight: 1.6,
  },
  paletteBtn: {
    width: 44,
    height: 44,
    borderRadius: 14,
    border: "1px solid #cbd5e1",
    background: "#ffffff",
    fontWeight: 700,
    cursor: "pointer",
  },
  paletteAnswered: {
    width: 44,
    height: 44,
    borderRadius: 14,
    border: "1px solid #86efac",
    background: "#f0fdf4",
    color: "#166534",
    fontWeight: 700,
    cursor: "pointer",
  },
  paletteActive: {
    width: 44,
    height: 44,
    borderRadius: 14,
    border: "1px solid #0f172a",
    background: "#0f172a",
    color: "#ffffff",
    fontWeight: 700,
    cursor: "pointer",
  },
};

export default function App() {
  const [phase, setPhase] = useState("start");
  const [studentName, setStudentName] = useState("");
  const [shuffleQuestions, setShuffleQuestions] = useState(true);
  const [shuffleAnswers, setShuffleAnswers] = useState(false);
  const [durationMinutes, setDurationMinutes] = useState("45");
  const [selectedMode, setSelectedMode] = useState("part-1");
  const [quizQuestions, setQuizQuestions] = useState([]);
  const [answers, setAnswers] = useState({});
  const [currentIndex, setCurrentIndex] = useState(0);
  const [remainingSeconds, setRemainingSeconds] = useState(45 * 60);
  const [startedAt, setStartedAt] = useState(null);
  const [submittedAt, setSubmittedAt] = useState(null);
  const [isAutoSubmitted, setIsAutoSubmitted] = useState(false);

  const intervalRef = useRef(null);

  const selectedModeQuestions = useMemo(() => getQuestionsForMode(selectedMode), [selectedMode]);

  const selectedModeLabel = useMemo(() => {
    if (selectedMode === "all") return `All Questions (${allQuestions.length})`;
    const n = Number(selectedMode.replace("part-", ""));
    const start = (n - 1) * QUESTIONS_PER_PART + 1;
    const end = Math.min(n * QUESTIONS_PER_PART, allQuestions.length);
    return `Part ${n} (${start}-${end})`;
  }, [selectedMode]);

  const totalQuestions = quizQuestions.length;
  const answeredCount = useMemo(
    () => Object.values(answers).filter((value) => typeof value === "number").length,
    [answers]
  );
  const unansweredCount = Math.max(totalQuestions - answeredCount, 0);
  const progressValue = totalQuestions ? ((currentIndex + 1) / totalQuestions) * 100 : 0;
  const isWarning = remainingSeconds <= 5 * 60;

  const preparedQuestions = useMemo(() => {
    const base = selectedModeQuestions.map((q) => {
      let options = [...q.options];
      let correctIndex = q.answer;

      if (shuffleAnswers) {
        const mapped = q.options.map((option, optionIndex) => ({
          text: option,
          isCorrect: optionIndex === q.answer,
        }));
        const shuffled = shuffleArray(mapped);
        options = shuffled.map((item) => item.text);
        correctIndex = shuffled.findIndex((item) => item.isCorrect);
      }

      return {
        id: q.id,
        question: q.question,
        options,
        correctIndex,
      };
    });

    return shuffleQuestions ? shuffleArray(base) : base;
  }, [selectedModeQuestions, shuffleAnswers, shuffleQuestions]);

  const summary = useMemo(() => {
    if (!quizQuestions.length) {
      return { correct: 0, incorrect: 0, percent: 0, timeUsed: 0, results: [] };
    }

    const results = quizQuestions.map((q, index) => {
      const selectedIndex = answers[index];
      const isCorrect = selectedIndex === q.correctIndex;
      return {
        question: q.question,
        selectedAnswer: typeof selectedIndex === "number" ? q.options[selectedIndex] : "",
        correctAnswer: q.options[q.correctIndex],
        isCorrect,
        selectedIndex,
        correctIndex: q.correctIndex,
        options: q.options,
      };
    });

    const correct = results.filter((item) => item.isCorrect).length;
    const incorrect = quizQuestions.length - correct;
    const totalDurationSeconds = Number(durationMinutes) * 60;
    const timeUsed =
      submittedAt && startedAt
        ? Math.max(0, Math.round((submittedAt - startedAt) / 1000))
        : Math.max(0, totalDurationSeconds - remainingSeconds);

    return {
      correct,
      incorrect,
      percent: Math.round((correct / quizQuestions.length) * 100),
      timeUsed,
      results,
    };
  }, [answers, durationMinutes, quizQuestions, remainingSeconds, startedAt, submittedAt]);

  useEffect(() => {
    if (phase !== "test") return undefined;

    intervalRef.current = window.setInterval(() => {
      setRemainingSeconds((prev) => {
        if (prev <= 1) {
          window.clearInterval(intervalRef.current);
          setIsAutoSubmitted(true);
          setSubmittedAt(Date.now());
          setPhase("results");
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => {
      if (intervalRef.current) window.clearInterval(intervalRef.current);
    };
  }, [phase]);

  const startQuiz = () => {
    const duration = Number(durationMinutes) * 60;
    setQuizQuestions(preparedQuestions);
    setAnswers({});
    setCurrentIndex(0);
    setRemainingSeconds(duration);
    setStartedAt(Date.now());
    setSubmittedAt(null);
    setIsAutoSubmitted(false);
    setPhase("test");
  };

  const submitQuiz = () => {
    if (intervalRef.current) window.clearInterval(intervalRef.current);
    setSubmittedAt(Date.now());
    setPhase("results");
  };

  const restartQuiz = () => {
    if (intervalRef.current) window.clearInterval(intervalRef.current);
    setPhase("start");
    setAnswers({});
    setCurrentIndex(0);
    setQuizQuestions([]);
    setRemainingSeconds(Number(durationMinutes) * 60);
    setStartedAt(null);
    setSubmittedAt(null);
    setIsAutoSubmitted(false);
  };

  const handleSelectAnswer = (optionIndex) => {
    setAnswers((prev) => ({ ...prev, [currentIndex]: optionIndex }));
  };

  const jumpToQuestion = (index) => {
    setCurrentIndex(index);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const exportCsv = () => {
    const rows = [
      ["Student Name", studentName || "Anonymous"],
      ["Quiz Title", "Economics Theory Test"],
      ["Mode", selectedModeLabel],
      ["Total Questions", String(quizQuestions.length)],
      ["Correct", String(summary.correct)],
      ["Incorrect", String(summary.incorrect)],
      ["Percent", `${summary.percent}%`],
      ["Time Used", formatTime(summary.timeUsed)],
      [],
      ["#", "Question", "Selected Answer", "Correct Answer", "Correct"],
    ];

    summary.results.forEach((item, index) => {
      rows.push([
        String(index + 1),
        item.question,
        item.selectedAnswer || "No answer",
        item.correctAnswer,
        item.isCorrect ? "Yes" : "No",
      ]);
    });

    const csvContent = rows.map((row) => row.map((cell) => toCsvCell(cell)).join(",")).join("\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    const safeName = (studentName || "student").trim().replace(/\s+/g, "-").toLowerCase();
    const safeMode = selectedMode.replace(/\s+/g, "-").toLowerCase();
    link.download = `economics-quiz-results-${safeMode}-${safeName}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const currentQuestion = quizQuestions[currentIndex];
  const twoCol = { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: 16 };
  const threeCol = { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 16 };
  const mainGrid = { display: "grid", gridTemplateColumns: "minmax(0, 1fr)", gap: 24 };

  return (
    <div style={styles.page}>
      <div style={styles.container}>
        {phase === "start" && (
          <div style={{ maxWidth: 900, margin: "0 auto" }}>
            <div style={{ ...styles.card, padding: 24 }}>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 10, marginBottom: 18 }}>
                <span style={styles.primaryBadge}>Economics Test</span>
                <span style={styles.badge}>{allQuestions.length} Total Questions</span>
                <span style={styles.badge}>{totalParts} Parts</span>
              </div>

              <h1 style={{ fontSize: 36, lineHeight: 1.1, margin: 0 }}>Economics Theory Quiz Bank</h1>
              <p style={{ color: "#475569", fontSize: 16, lineHeight: 1.7, marginTop: 12 }}>
                Clean reset version. No shadcn, no alias issues, no broken imports.
              </p>

              <div style={{ ...twoCol, marginTop: 24 }}>
                <div style={{ gridColumn: "1 / -1" }}>
                  <label style={styles.label}>Student Name (optional)</label>
                  <input
                    style={styles.input}
                    value={studentName}
                    onChange={(e) => setStudentName(e.target.value)}
                    placeholder="Enter student name"
                  />
                </div>

                <div>
                  <label style={styles.label}>Quiz Scope</label>
                  <select style={styles.input} value={selectedMode} onChange={(e) => setSelectedMode(e.target.value)}>
                    <option value="all">All Questions ({allQuestions.length})</option>
                    {Array.from({ length: totalParts }, (_, index) => {
                      const start = index * QUESTIONS_PER_PART + 1;
                      const end = Math.min((index + 1) * QUESTIONS_PER_PART, allQuestions.length);
                      return (
                        <option key={index} value={`part-${index + 1}`}>
                          Part {index + 1} ({start}-{end})
                        </option>
                      );
                    })}
                  </select>
                </div>

                <div>
                  <label style={styles.label}>Timer Duration</label>
                  <select style={styles.input} value={durationMinutes} onChange={(e) => setDurationMinutes(e.target.value)}>
                    {TIMER_OPTIONS.map((minutes) => (
                      <option key={minutes} value={String(minutes)}>
                        {minutes} minutes
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div style={{ ...styles.softCard, marginTop: 16 }}>
                <div style={{ fontWeight: 700, marginBottom: 12 }}>Selected Mode</div>
                <div style={{ display: "flex", flexWrap: "wrap", justifyContent: "space-between", alignItems: "center", gap: 12 }}>
                  <div>
                    <div style={{ fontWeight: 800, fontSize: 18 }}>{selectedModeLabel}</div>
                    <div style={{ color: "#64748b", marginTop: 4 }}>{selectedModeQuestions.length} questions will be loaded.</div>
                  </div>
                  <span style={styles.badge}>{selectedModeQuestions.length} questions</span>
                </div>
              </div>

              <div style={{ ...styles.softCard, marginTop: 16 }}>
                <div style={{ fontWeight: 700, marginBottom: 12 }}>Test Setup</div>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 20 }}>
                  <label style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <input type="checkbox" checked={shuffleQuestions} onChange={(e) => setShuffleQuestions(e.target.checked)} />
                    Shuffle questions
                  </label>
                  <label style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <input type="checkbox" checked={shuffleAnswers} onChange={(e) => setShuffleAnswers(e.target.checked)} />
                    Shuffle answer choices
                  </label>
                </div>
              </div>

              <div style={{ ...threeCol, marginTop: 16 }}>
                <div style={styles.softCard}><div style={{ color: "#64748b" }}>Question Bank</div><div style={{ fontSize: 28, fontWeight: 800, marginTop: 6 }}>{allQuestions.length}</div></div>
                <div style={styles.softCard}><div style={{ color: "#64748b" }}>Current Mode</div><div style={{ fontSize: 28, fontWeight: 800, marginTop: 6 }}>{selectedModeQuestions.length}</div></div>
                <div style={styles.softCard}><div style={{ color: "#64748b" }}>Timer</div><div style={{ fontSize: 28, fontWeight: 800, marginTop: 6 }}>{durationMinutes} min</div></div>
              </div>

              <button style={{ ...styles.button, width: "100%", marginTop: 20, padding: "14px 18px", fontSize: 16 }} onClick={startQuiz}>
                Start Test
              </button>
            </div>
          </div>
        )}

        {phase === "test" && currentQuestion && (
          <div style={{ ...mainGrid, gridTemplateColumns: "minmax(0, 1fr)", alignItems: "start" }}>
            <div style={{ ...styles.card, padding: 20, position: "sticky", top: 16, zIndex: 10 }}>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 10, alignItems: "center", justifyContent: "space-between" }}>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 10 }}>
                  <span style={styles.primaryBadge}>{selectedModeLabel}</span>
                  <span style={styles.badge}>Question {currentIndex + 1} of {totalQuestions}</span>
                  <span style={styles.badge}>Answered {answeredCount}/{totalQuestions}</span>
                  <span style={styles.badge}>Unanswered {unansweredCount}</span>
                </div>
                <span style={{ ...styles.badge, background: isWarning ? "#fee2e2" : "#e2e8f0", color: isWarning ? "#991b1b" : "#0f172a" }}>
                  {formatTime(remainingSeconds)}
                </span>
              </div>
              <div style={{ marginTop: 14, ...styles.progressWrap }}>
                <div style={styles.progressFill(progressValue)} />
              </div>
            </div>

            <div style={{ display: "grid", gap: 24, gridTemplateColumns: "minmax(0, 1fr)" }}>
              <div style={{ ...styles.card, padding: 24 }}>
                <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "flex-start", marginBottom: 16 }}>
                  <div>
                    <h2 style={{ margin: 0, fontSize: 28, lineHeight: 1.4 }}>{currentQuestion.question}</h2>
                    <div style={{ color: "#64748b", marginTop: 8 }}>Select one answer.</div>
                  </div>
                  <span style={styles.badge}>{answers[currentIndex] !== undefined ? "Answered" : "Pending"}</span>
                </div>

                <div style={{ display: "grid", gap: 12 }}>
                  {currentQuestion.options.map((option, optionIndex) => {
                    const isSelected = answers[currentIndex] === optionIndex;
                    return (
                      <button
                        key={`${currentQuestion.id}-${optionIndex}`}
                        type="button"
                        onClick={() => handleSelectAnswer(optionIndex)}
                        style={isSelected ? styles.optionSelected : styles.option}
                      >
                        <div style={{ display: "flex", gap: 12, alignItems: "flex-start" }}>
                          <div style={{
                            width: 30,
                            height: 30,
                            borderRadius: 999,
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            background: isSelected ? "#ffffff" : "#e2e8f0",
                            color: isSelected ? "#0f172a" : "#334155",
                            fontWeight: 800,
                            flexShrink: 0
                          }}>
                            {String.fromCharCode(65 + optionIndex)}
                          </div>
                          <div>{option}</div>
                        </div>
                      </button>
                    );
                  })}
                </div>

                <div style={{ display: "flex", flexWrap: "wrap", gap: 12, justifyContent: "space-between", marginTop: 20 }}>
                  <div style={{ display: "flex", gap: 12 }}>
                    <button
                      style={{ ...styles.outlineButton, opacity: currentIndex === 0 ? 0.5 : 1 }}
                      onClick={() => setCurrentIndex((prev) => Math.max(prev - 1, 0))}
                      disabled={currentIndex === 0}
                    >
                      Previous
                    </button>
                    <button
                      style={{ ...styles.outlineButton, opacity: currentIndex === totalQuestions - 1 ? 0.5 : 1 }}
                      onClick={() => setCurrentIndex((prev) => Math.min(prev + 1, totalQuestions - 1))}
                      disabled={currentIndex === totalQuestions - 1}
                    >
                      Next
                    </button>
                  </div>
                  <button
                    style={styles.button}
                    onClick={() => {
                      const ok = window.confirm(`Submit your test? You answered ${answeredCount} of ${totalQuestions}.`);
                      if (ok) submitQuiz();
                    }}
                  >
                    Submit Test
                  </button>
                </div>
              </div>

              <div style={{ ...styles.card, padding: 20 }}>
                <div style={{ fontWeight: 800, fontSize: 20, marginBottom: 12 }}>Question Palette</div>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(44px, 1fr))", gap: 10 }}>
                  {quizQuestions.map((_, index) => {
                    const isActive = index === currentIndex;
                    const isAnswered = answers[index] !== undefined;
                    const btnStyle = isActive ? styles.paletteActive : isAnswered ? styles.paletteAnswered : styles.paletteBtn;
                    return (
                      <button key={index} style={btnStyle} onClick={() => jumpToQuestion(index)}>
                        {index + 1}
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>
        )}

        {phase === "results" && (
          <div style={{ display: "grid", gap: 24 }}>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))", gap: 24, alignItems: "start" }}>
              <div style={{ ...styles.card, padding: 24 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12 }}>
                  <h2 style={{ margin: 0, fontSize: 30 }}>Results</h2>
                  {isAutoSubmitted && <span style={{ ...styles.badge, background: "#fee2e2", color: "#991b1b" }}>Auto-submitted</span>}
                </div>
                <div style={{ color: "#64748b", marginTop: 8 }}>{studentName ? `${studentName}'s score summary` : "Quiz score summary"}</div>

                <div style={{ background: "#0f172a", color: "#ffffff", borderRadius: 24, padding: 24, marginTop: 18 }}>
                  <div style={{ color: "#cbd5e1" }}>Total Score</div>
                  <div style={{ fontSize: 48, fontWeight: 900, marginTop: 8 }}>{summary.percent}%</div>
                  <div style={{ color: "#cbd5e1", marginTop: 8 }}>{summary.correct} correct out of {quizQuestions.length}</div>
                </div>

                <div style={{ ...styles.softCard, marginTop: 16 }}>
                  <div style={{ color: "#64748b" }}>Attempt</div>
                  <div style={{ fontWeight: 800, marginTop: 6 }}>{selectedModeLabel}</div>
                </div>

                <div style={{ ...threeCol, marginTop: 16 }}>
                  <div style={{ ...styles.softCard, background: "#f0fdf4", borderColor: "#bbf7d0", color: "#166534" }}><div>Correct</div><div style={{ fontSize: 28, fontWeight: 900, marginTop: 6 }}>{summary.correct}</div></div>
                  <div style={{ ...styles.softCard, background: "#fef2f2", borderColor: "#fecaca", color: "#991b1b" }}><div>Incorrect</div><div style={{ fontSize: 28, fontWeight: 900, marginTop: 6 }}>{summary.incorrect}</div></div>
                  <div style={styles.softCard}><div style={{ color: "#64748b" }}>Time Used</div><div style={{ fontSize: 28, fontWeight: 900, marginTop: 6 }}>{formatTime(summary.timeUsed)}</div></div>
                </div>

                <div style={{ display: "grid", gap: 12, marginTop: 18 }}>
                  <button style={styles.button} onClick={exportCsv}>Export CSV Results</button>
                  <button style={styles.outlineButton} onClick={restartQuiz}>Restart / Retake</button>
                </div>
              </div>

              <div style={{ ...styles.card, padding: 24 }}>
                <h2 style={{ marginTop: 0, fontSize: 30 }}>Review Mode</h2>
                <div style={{ color: "#64748b", marginBottom: 18 }}>Correct answers are green. Wrong selected answers are red.</div>

                <div style={{ display: "grid", gap: 18 }}>
                  {quizQuestions.map((q, index) => {
                    const selectedIndex = answers[index];
                    const hasAnswered = typeof selectedIndex === "number";
                    const isCorrect = selectedIndex === q.correctIndex;

                    return (
                      <div key={q.id} style={{ border: "1px solid #e2e8f0", borderRadius: 22, padding: 18 }}>
                        <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap", marginBottom: 12 }}>
                          <div>
                            <div style={{ color: "#64748b", fontWeight: 700 }}>Question {index + 1}</div>
                            <div style={{ fontSize: 20, fontWeight: 800, lineHeight: 1.5, marginTop: 6 }}>{q.question}</div>
                          </div>
                          <span style={{
                            ...styles.badge,
                            background: !hasAnswered ? "#e2e8f0" : isCorrect ? "#dcfce7" : "#fee2e2",
                            color: !hasAnswered ? "#334155" : isCorrect ? "#166534" : "#991b1b"
                          }}>
                            {!hasAnswered ? "No answer" : isCorrect ? "Correct" : "Incorrect"}
                          </span>
                        </div>

                        <div style={{ display: "grid", gap: 10 }}>
                          {q.options.map((option, optionIndex) => {
                            const isUserChoice = selectedIndex === optionIndex;
                            const isRightAnswer = q.correctIndex === optionIndex;

                            let bg = "#ffffff";
                            let color = "#334155";
                            let border = "1px solid #e2e8f0";

                            if (isRightAnswer) {
                              bg = "#f0fdf4";
                              color = "#166534";
                              border = "1px solid #bbf7d0";
                            }
                            if (isUserChoice && !isRightAnswer) {
                              bg = "#fef2f2";
                              color = "#991b1b";
                              border = "1px solid #fecaca";
                            }

                            return (
                              <div key={optionIndex} style={{ background: bg, color, border, borderRadius: 16, padding: 14 }}>
                                <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
                                  <div><strong>{String.fromCharCode(65 + optionIndex)}.</strong> {option}</div>
                                  <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                                    {isRightAnswer && <span style={{ ...styles.badge, background: "#166534", color: "#ffffff" }}>Correct answer</span>}
                                    {isUserChoice && <span style={{ ...styles.badge, background: isRightAnswer ? "#166534" : "#991b1b", color: "#ffffff" }}>Your answer</span>}
                                  </div>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
