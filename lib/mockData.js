import examsData from "@/mock/mockExams.json";
import questionsData from "@/mock/mockQuestions.json";
import meritData from "@/mock/mockMerit.json";

// These functions are the ONLY place that touches the mock JSON files.
// In Phase 2, each function body gets swapped for a Firestore query —
// nothing in the components below needs to change.

export function getAllExams() {
  return examsData.exams;
}

export function getExamsByType(type) {
  return examsData.exams.filter((e) => e.type === type);
}

export function getExamById(id) {
  return examsData.exams.find((e) => e.id === id) || null;
}

export function getQuestionsForExam(examId) {
  return questionsData[examId] || [];
}

// Combined merit list: registered students + public/guest entries, ranked
// together as one list. Guest rows carry a `college` field so the UI can
// show it next to their name. Phase 2: this becomes a Firestore query over
// `attempts` where `examId == X`, sorted by score, computed by a Cloud
// Function once the exam window closes (never computed client-side, so a
// student can't infer others' scores while an exam is still live).
export function getMeritList(examId) {
  return meritData[examId] || [];
}

// Mock signed-in student — Phase 2 replaces this with the authenticated
// student's Firestore document.
export function getCurrentStudent() {
  return {
    id: "STU10492",
    name: "Tahmid Rahman",
    mobile: "01812345678",
    unitPermission: "BOTH", // "A_ONLY" | "B_ONLY" | "BOTH"
    track: "science", // "science" | "humanities" | "commerce" — relevant for B-Unit
  };
}
