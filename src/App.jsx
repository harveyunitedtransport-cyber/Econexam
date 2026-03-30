import React, { useEffect, useMemo, useRef, useState } from "react";
import { rawQuestionText } from "./questions";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

import {
  AlertTriangle,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Clock,
  Download,
  FileQuestion,
  Layers3,
  Play,
  RotateCcw,
  User,
  XCircle,
} from "lucide-react";

const QUESTIONS_PER_PART = 45;
const timerOptions = [10, 15, 20, 30, 45, 60, 90, 120, 180];

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
    .map((block, blockIndex) => {
      const parts = block
        .split("====")
        .map((part) => part.replace(/\r/g, "").trim())
        .filter(Boolean);

      if (parts.length < 5) return null;

      const question = parts[0];
      const rawOptions = parts.slice(1, 5);
      const correctIndex = rawOptions.findIndex((option) => option.startsWith("#"));
      if (!question || correctIndex < 0 || rawOptions.length !== 4) return null;

      return {
        id: `q-${blockIndex + 1}`,
        question,
        options: rawOptions.map((option) => option.replace(/^#/, "").trim()),
        answer: correctIndex,
      };
    })
    .filter(Boolean);
}

const masterQuestions = parseQuestions(rawQuestionText);
const totalParts = Math.ceil(masterQuestions.length / QUESTIONS_PER_PART);

const partOptions = Array.from({ length: totalParts }, (_, index) => ({
  value: `part-${index + 1}`,
  label: `Part ${index + 1}`,
  start: index * QUESTIONS_PER_PART,
  end: Math.min((index + 1) * QUESTIONS_PER_PART, masterQuestions.length),
}));

function getQuestionsForMode(mode) {
  if (mode === "all") return masterQuestions;
  const partIndex = Number(mode.replace("part-", "")) - 1;
  const start = partIndex * QUESTIONS_PER_PART;
  return masterQuestions.slice(start, start + QUESTIONS_PER_PART);
}

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
    if (selectedMode === "all") return `All Questions (${masterQuestions.length})`;
    const option = partOptions.find((item) => item.value === selectedMode);
    return option ? `${option.label} (${option.start + 1}-${option.end})` : "Selected Part";
  }, [selectedMode]);

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

  const totalQuestions = quizQuestions.length;

  const answeredCount = useMemo(
    () => Object.values(answers).filter((value) => typeof value === "number").length,
    [answers]
  );

  const unansweredCount = Math.max(totalQuestions - answeredCount, 0);

  const progressValue = totalQuestions ? ((currentIndex + 1) / totalQuestions) * 100 : 0;

  const warningThreshold = 5 * 60;
  const isWarning = remainingSeconds <= warningThreshold;

  const summary = useMemo(() => {
    if (!quizQuestions.length) {
      return {
        correct: 0,
        incorrect: 0,
        percent: 0,
        timeUsed: 0,
        results: [],
      };
    }

    const results = quizQuestions.map((q, index) => {
      const selectedIndex = answers[index];
      const isCorrect = selectedIndex === q.correctIndex;

      return {
        questionNumber: index + 1,
        question: q.question,
        selectedIndex,
        selectedAnswer: typeof selectedIndex === "number" ? q.options[selectedIndex] : "",
        correctIndex: q.correctIndex,
        correctAnswer: q.options[q.correctIndex],
        isCorrect,
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
      if (intervalRef.current) {
        window.clearInterval(intervalRef.current);
      }
    };
  }, [phase]);

  function startQuiz() {
    const duration = Number(durationMinutes) * 60;
    setQuizQuestions(preparedQuestions);
    setAnswers({});
    setCurrentIndex(0);
    setRemainingSeconds(duration);
    setStartedAt(Date.now());
    setSubmittedAt(null);
    setIsAutoSubmitted(false);
    setPhase("test");
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function submitQuiz() {
    if (intervalRef.current) {
      window.clearInterval(intervalRef.current);
    }
    setSubmittedAt(Date.now());
    setPhase("results");
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function restartQuiz() {
    if (intervalRef.current) {
      window.clearInterval(intervalRef.current);
    }
    setPhase("start");
    setAnswers({});
    setCurrentIndex(0);
    setQuizQuestions([]);
    setRemainingSeconds(Number(durationMinutes) * 60);
    setStartedAt(null);
    setSubmittedAt(null);
    setIsAutoSubmitted(false);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function handleSelectAnswer(optionIndex) {
    setAnswers((prev) => ({ ...prev, [currentIndex]: optionIndex }));
  }

  function jumpToQuestion(index) {
    setCurrentIndex(index);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function exportCsv() {
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

    summary.results.forEach((item) => {
      rows.push([
        String(item.questionNumber),
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
  }

  const currentQuestion = quizQuestions[currentIndex];

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-slate-100 text-slate-900">
      <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
        {phase === "start" && (
          <div className="mx-auto flex min-h-[80vh] max-w-4xl items-center justify-center">
            <Card className="w-full rounded-3xl border-slate-200 shadow-xl">
              <CardHeader className="space-y-4 pb-2">
                <div className="flex flex-wrap items-center gap-3">
                  <Badge className="rounded-full px-3 py-1 text-sm">Economics Test</Badge>
                  <Badge variant="secondary" className="rounded-full px-3 py-1 text-sm">
                    {masterQuestions.length} Questions
                  </Badge>
                  <Badge variant="outline" className="rounded-full px-3 py-1 text-sm">
                    {totalParts} Parts
                  </Badge>
                </div>

                <CardTitle className="text-3xl font-bold tracking-tight sm:text-4xl">
                  Economics Theory Quiz
                </CardTitle>

                <CardDescription className="text-base leading-7 text-slate-600">
                  Full-featured quiz system with timer, parts, shuffle, review mode, palette navigation, and CSV export.
                </CardDescription>
              </CardHeader>

              <CardContent className="space-y-6 pt-4">
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2 md:col-span-2">
                    <Label htmlFor="studentName" className="text-sm font-medium">
                      Student Name (optional)
                    </Label>
                    <div className="relative">
                      <User className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                      <Input
                        id="studentName"
                        value={studentName}
                        onChange={(e) => setStudentName(e.target.value)}
                        placeholder="Enter student name"
                        className="h-11 rounded-2xl pl-10"
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label className="text-sm font-medium">Quiz Scope</Label>
                    <Select value={selectedMode} onValueChange={setSelectedMode}>
                      <SelectTrigger className="h-11 rounded-2xl">
                        <SelectValue placeholder="Select part" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All Questions ({masterQuestions.length})</SelectItem>
                        {partOptions.map((part) => (
                          <SelectItem key={part.value} value={part.value}>
                            {part.label} ({part.start + 1}-{part.end})
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label className="text-sm font-medium">Timer Duration</Label>
                    <Select value={durationMinutes} onValueChange={setDurationMinutes}>
                      <SelectTrigger className="h-11 rounded-2xl">
                        <SelectValue placeholder="Select duration" />
                      </SelectTrigger>
                      <SelectContent>
                        {timerOptions.map((minutes) => (
                          <SelectItem key={minutes} value={String(minutes)}>
                            {minutes} minutes
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 md:col-span-2">
                    <div className="mb-3 flex items-center gap-2">
                      <Layers3 className="h-4 w-4 text-slate-500" />
                      <span className="text-sm font-medium text-slate-700">Selected Mode</span>
                    </div>
                    <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                      <div>
                        <div className="text-base font-semibold text-slate-900">{selectedModeLabel}</div>
                        <div className="text-sm text-slate-500">
                          {selectedModeQuestions.length} questions will be loaded.
                        </div>
                      </div>
                      <Badge variant="secondary" className="rounded-full px-3 py-1">
                        {selectedModeQuestions.length} questions
                      </Badge>
                    </div>
                  </div>

                  <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                    <div className="mb-3 flex items-center gap-2">
                      <FileQuestion className="h-4 w-4 text-slate-500" />
                      <span className="text-sm font-medium text-slate-700">Test Setup</span>
                    </div>

                    <div className="space-y-4">
                      <div className="flex items-center space-x-3">
                        <Checkbox
                          id="shuffleQuestions"
                          checked={shuffleQuestions}
                          onCheckedChange={(checked) => setShuffleQuestions(Boolean(checked))}
                        />
                        <Label htmlFor="shuffleQuestions" className="cursor-pointer text-sm text-slate-700">
                          Shuffle questions
                        </Label>
                      </div>

                      <div className="flex items-center space-x-3">
                        <Checkbox
                          id="shuffleAnswers"
                          checked={shuffleAnswers}
                          onCheckedChange={(checked) => setShuffleAnswers(Boolean(checked))}
                        />
                        <Label htmlFor="shuffleAnswers" className="cursor-pointer text-sm text-slate-700">
                          Shuffle answer choices
                        </Label>
                      </div>
                    </div>
                  </div>

                  <div className="grid gap-4 sm:grid-cols-3 md:col-span-2">
                    <Card className="rounded-2xl border-slate-200 shadow-none">
                      <CardContent className="p-4">
                        <div className="text-sm text-slate-500">Question Bank</div>
                        <div className="mt-1 text-2xl font-bold">{masterQuestions.length}</div>
                      </CardContent>
                    </Card>

                    <Card className="rounded-2xl border-slate-200 shadow-none">
                      <CardContent className="p-4">
                        <div className="text-sm text-slate-500">Current Mode</div>
                        <div className="mt-1 text-2xl font-bold">{selectedModeQuestions.length}</div>
                      </CardContent>
                    </Card>

                    <Card className="rounded-2xl border-slate-200 shadow-none">
                      <CardContent className="p-4">
                        <div className="text-sm text-slate-500">Timer</div>
                        <div className="mt-1 text-2xl font-bold">{durationMinutes} min</div>
                      </CardContent>
                    </Card>
                  </div>
                </div>

                <Button
                  onClick={startQuiz}
                  className="h-12 w-full rounded-2xl text-base font-semibold shadow-lg"
                >
                  <Play className="mr-2 h-4 w-4" />
                  Start Test
                </Button>
              </CardContent>
            </Card>
          </div>
        )}

        {phase === "test" && currentQuestion && (
          <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
            <div className="space-y-6">
              <div className="sticky top-4 z-20 rounded-3xl border border-slate-200 bg-white/90 p-4 shadow-lg backdrop-blur">
                <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                  <div className="space-y-2">
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge className="rounded-full px-3 py-1">
                        {selectedModeLabel}
                      </Badge>
                      <Badge variant="secondary" className="rounded-full px-3 py-1">
                        Question {currentIndex + 1} of {totalQuestions}
                      </Badge>
                      <Badge variant="secondary" className="rounded-full px-3 py-1">
                        Answered {answeredCount}/{totalQuestions}
                      </Badge>
                      {unansweredCount > 0 && (
                        <Badge variant="outline" className="rounded-full px-3 py-1">
                          Unanswered {unansweredCount}
                        </Badge>
                      )}
                    </div>

                    <Progress value={progressValue} className="h-2.5 rounded-full" />
                  </div>

                  <div
                    className={`flex items-center gap-2 rounded-2xl px-4 py-3 text-sm font-semibold ${
                      isWarning ? "bg-red-50 text-red-700" : "bg-slate-100 text-slate-700"
                    }`}
                  >
                    {isWarning ? <AlertTriangle className="h-4 w-4" /> : <Clock className="h-4 w-4" />}
                    <span>{formatTime(remainingSeconds)}</span>
                  </div>
                </div>
              </div>

              <Card className="rounded-3xl border-slate-200 shadow-xl">
                <CardHeader className="space-y-4">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <CardTitle className="text-xl font-semibold leading-8 sm:text-2xl">
                        {currentQuestion.question}
                      </CardTitle>
                      <CardDescription className="mt-2 text-sm text-slate-500">
                        Select one answer.
                      </CardDescription>
                    </div>

                    <Badge variant="outline" className="shrink-0 rounded-full px-3 py-1">
                      {answers[currentIndex] !== undefined ? "Answered" : "Pending"}
                    </Badge>
                  </div>
                </CardHeader>

                <CardContent className="space-y-3">
                  {currentQuestion.options.map((option, optionIndex) => {
                    const isSelected = answers[currentIndex] === optionIndex;

                    return (
                      <button
                        key={`${currentQuestion.id}-${optionIndex}`}
                        type="button"
                        onClick={() => handleSelectAnswer(optionIndex)}
                        className={`w-full rounded-2xl border p-4 text-left transition-all ${
                          isSelected
                            ? "border-slate-900 bg-slate-900 text-white shadow-md"
                            : "border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50"
                        }`}
                      >
                        <div className="flex items-start gap-3">
                          <div
                            className={`mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-sm font-semibold ${
                              isSelected ? "bg-white text-slate-900" : "bg-slate-100 text-slate-700"
                            }`}
                          >
                            {String.fromCharCode(65 + optionIndex)}
                          </div>
                          <div className="text-sm leading-7 sm:text-base">{option}</div>
                        </div>
                      </button>
                    );
                  })}

                  <div className="flex flex-col gap-3 pt-4 sm:flex-row sm:items-center sm:justify-between">
                    <div className="flex gap-3">
                      <Button
                        type="button"
                        variant="outline"
                        className="rounded-2xl"
                        onClick={() => setCurrentIndex((prev) => Math.max(prev - 1, 0))}
                        disabled={currentIndex === 0}
                      >
                        <ChevronLeft className="mr-2 h-4 w-4" />
                        Previous
                      </Button>

                      <Button
                        type="button"
                        variant="outline"
                        className="rounded-2xl"
                        onClick={() => setCurrentIndex((prev) => Math.min(prev + 1, totalQuestions - 1))}
                        disabled={currentIndex === totalQuestions - 1}
                      >
                        Next
                        <ChevronRight className="ml-2 h-4 w-4" />
                      </Button>
                    </div>

                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button className="rounded-2xl">Submit Test</Button>
                      </AlertDialogTrigger>

                      <AlertDialogContent className="rounded-3xl">
                        <AlertDialogHeader>
                          <AlertDialogTitle>Submit your test?</AlertDialogTitle>
                          <AlertDialogDescription>
                            You have answered {answeredCount} out of {totalQuestions} questions.
                            Unanswered questions will be marked incorrect.
                          </AlertDialogDescription>
                        </AlertDialogHeader>

                        <AlertDialogFooter>
                          <AlertDialogCancel className="rounded-2xl">Cancel</AlertDialogCancel>
                          <AlertDialogAction className="rounded-2xl" onClick={submitQuiz}>
                            Final Submit
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </div>
                </CardContent>
              </Card>
            </div>

            <div className="space-y-6">
              <Card className="rounded-3xl border-slate-200 shadow-lg">
                <CardHeader>
                  <CardTitle className="text-lg">Question Palette</CardTitle>
                  <CardDescription>Jump directly to any question.</CardDescription>
                </CardHeader>

                <CardContent>
                  <div className="grid grid-cols-5 gap-2 sm:grid-cols-6 lg:grid-cols-5">
                    {quizQuestions.map((_, index) => {
                      const isActive = index === currentIndex;
                      const isAnswered = answers[index] !== undefined;

                      return (
                        <button
                          key={`nav-${index}`}
                          type="button"
                          onClick={() => jumpToQuestion(index)}
                          className={`flex h-11 w-full items-center justify-center rounded-2xl border text-sm font-semibold transition ${
                            isActive
                              ? "border-slate-900 bg-slate-900 text-white"
                              : isAnswered
                              ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                              : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
                          }`}
                        >
                          {index + 1}
                        </button>
                      );
                    })}
                  </div>

                  <div className="mt-4 space-y-2 text-sm text-slate-600">
                    <div className="flex items-center gap-2">
                      <span className="inline-block h-3 w-3 rounded-full bg-slate-900" /> Current
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="inline-block h-3 w-3 rounded-full bg-emerald-500" /> Answered
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="inline-block h-3 w-3 rounded-full bg-slate-300" /> Unanswered
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card className="rounded-3xl border-slate-200 shadow-lg">
                <CardHeader>
                  <CardTitle className="text-lg">Live Summary</CardTitle>
                  <CardDescription>Quick test status</CardDescription>
                </CardHeader>

                <CardContent className="space-y-3 text-sm">
                  <div className="flex items-center justify-between rounded-2xl bg-slate-50 px-4 py-3">
                    <span>Total</span>
                    <span className="font-semibold">{totalQuestions}</span>
                  </div>

                  <div className="flex items-center justify-between rounded-2xl bg-emerald-50 px-4 py-3 text-emerald-700">
                    <span>Answered</span>
                    <span className="font-semibold">{answeredCount}</span>
                  </div>

                  <div className="flex items-center justify-between rounded-2xl bg-amber-50 px-4 py-3 text-amber-700">
                    <span>Unanswered</span>
                    <span className="font-semibold">{unansweredCount}</span>
                  </div>

                  <div
                    className={`flex items-center justify-between rounded-2xl px-4 py-3 ${
                      isWarning ? "bg-red-50 text-red-700" : "bg-slate-50"
                    }`}
                  >
                    <span>Time Left</span>
                    <span className="font-semibold">{formatTime(remainingSeconds)}</span>
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        )}

        {phase === "results" && (
          <div className="space-y-6">
            <div className="grid gap-6 xl:grid-cols-[380px_minmax(0,1fr)]">
              <Card className="rounded-3xl border-slate-200 shadow-xl">
                <CardHeader>
                  <div className="flex items-center justify-between gap-3">
                    <CardTitle className="text-2xl">Results</CardTitle>
                    {isAutoSubmitted && (
                      <Badge variant="destructive" className="rounded-full px-3 py-1">
                        Auto-submitted
                      </Badge>
                    )}
                  </div>

                  <CardDescription>
                    {studentName ? `${studentName}'s score summary` : "Quiz score summary"}
                  </CardDescription>
                </CardHeader>

                <CardContent className="space-y-4">
                  <div className="rounded-3xl bg-slate-900 p-6 text-white">
                    <div className="text-sm text-slate-300">Total Score</div>
                    <div className="mt-2 text-4xl font-bold">{summary.percent}%</div>
                    <div className="mt-2 text-sm text-slate-300">
                      {summary.correct} correct out of {quizQuestions.length}
                    </div>
                  </div>

                  <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                    <div className="text-sm text-slate-500">Attempt</div>
                    <div className="mt-1 text-lg font-semibold">{selectedModeLabel}</div>
                  </div>

                  <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-1">
                    <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-emerald-700">
                      <div className="text-sm">Correct</div>
                      <div className="mt-1 text-2xl font-bold">{summary.correct}</div>
                    </div>

                    <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-red-700">
                      <div className="text-sm">Incorrect</div>
                      <div className="mt-1 text-2xl font-bold">{summary.incorrect}</div>
                    </div>

                    <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                      <div className="text-sm text-slate-500">Time Used</div>
                      <div className="mt-1 text-2xl font-bold">{formatTime(summary.timeUsed)}</div>
                    </div>

                    <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                      <div className="text-sm text-slate-500">Student</div>
                      <div className="mt-1 truncate text-lg font-semibold">
                        {studentName || "Anonymous"}
                      </div>
                    </div>
                  </div>

                  <div className="flex flex-col gap-3">
                    <Button onClick={exportCsv} className="rounded-2xl">
                      <Download className="mr-2 h-4 w-4" />
                      Export CSV Results
                    </Button>

                    <Button onClick={restartQuiz} variant="outline" className="rounded-2xl">
                      <RotateCcw className="mr-2 h-4 w-4" />
                      Restart / Retake
                    </Button>
                  </div>
                </CardContent>
              </Card>

              <Card className="rounded-3xl border-slate-200 shadow-xl">
                <CardHeader>
                  <CardTitle className="text-2xl">Review Mode</CardTitle>
                  <CardDescription>
                    Correct answers are shown in green. Wrong selected answers are shown in red.
                  </CardDescription>
                </CardHeader>

                <CardContent className="space-y-6">
                  {quizQuestions.map((q, index) => {
                    const selectedIndex = answers[index];
                    const hasAnswered = typeof selectedIndex === "number";
                    const isCorrect = selectedIndex === q.correctIndex;

                    return (
                      <div key={q.id} className="rounded-3xl border border-slate-200 p-5">
                        <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                          <div>
                            <div className="text-sm font-medium text-slate-500">Question {index + 1}</div>
                            <h3 className="mt-1 text-lg font-semibold leading-8">{q.question}</h3>
                          </div>

                          {hasAnswered ? (
                            isCorrect ? (
                              <Badge className="rounded-full bg-emerald-600 px-3 py-1 hover:bg-emerald-600">
                                <CheckCircle2 className="mr-1 h-4 w-4" /> Correct
                              </Badge>
                            ) : (
                              <Badge className="rounded-full bg-red-600 px-3 py-1 hover:bg-red-600">
                                <XCircle className="mr-1 h-4 w-4" /> Incorrect
                              </Badge>
                            )
                          ) : (
                            <Badge variant="outline" className="rounded-full px-3 py-1">
                              No answer
                            </Badge>
                          )}
                        </div>

                        <div className="space-y-3">
                          {q.options.map((option, optionIndex) => {
                            const isUserChoice = selectedIndex === optionIndex;
                            const isRightAnswer = q.correctIndex === optionIndex;

                            let itemClass = "border-slate-200 bg-white text-slate-700";
                            if (isRightAnswer) itemClass = "border-emerald-200 bg-emerald-50 text-emerald-800";
                            if (isUserChoice && !isRightAnswer) itemClass = "border-red-200 bg-red-50 text-red-800";

                            return (
                              <div
                                key={`${q.id}-review-${optionIndex}`}
                                className={`rounded-2xl border p-4 ${itemClass}`}
                              >
                                <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                                  <div className="flex items-start gap-3">
                                    <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-white/80 text-sm font-semibold">
                                      {String.fromCharCode(65 + optionIndex)}
                                    </div>
                                    <div className="text-sm leading-7 sm:text-base">{option}</div>
                                  </div>

                                  <div className="flex flex-wrap gap-2">
                                    {isRightAnswer && (
                                      <Badge className="rounded-full bg-emerald-600 hover:bg-emerald-600">
                                        Correct answer
                                      </Badge>
                                    )}
                                    {isUserChoice && (
                                      <Badge
                                        className={`rounded-full ${
                                          isRightAnswer
                                            ? "bg-emerald-700 hover:bg-emerald-700"
                                            : "bg-red-600 hover:bg-red-600"
                                        }`}
                                      >
                                        Your answer
                                      </Badge>
                                    )}
                                  </div>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })}
                </CardContent>
              </Card>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}