
export enum View {
  DASHBOARD = 'DASHBOARD',
  NOTES_GENERATOR = 'NOTES_GENERATOR',
  QUIZ = 'QUIZ',
  HISTORY = 'HISTORY',
  PLANNER = 'PLANNER',
  POMODORO = 'POMODORO',
  AI_ASSISTANT = 'AI_ASSISTANT'
}

export enum Theme {
  LIGHT = 'light',
  DARK = 'dark'
}

export interface Note {
  id: string;
  topic: string;
  course: string;
  year: string;
  university: string;
  length: 'SHORT' | 'MODERATE' | 'LONG';
  content: {
    keyConcepts: string[];
    formulas: { name: string; formula: string; explanation: string }[];
    diagramDescriptions: string[];
    tips: string[];
    practicePoints: string[];
  };
  timestamp: number;
}

export interface QuizQuestion {
  id: string;
  text: string;
  difficulty: 'EASY' | 'MEDIUM' | 'HARD';
  topic: string;
  hint: string;
  correctAnswer: string;
  explanation: string;
  type: 'MCQ' | 'OPEN_ENDED';
  options?: string[];
}

export interface QuizAttempt {
  questionId: string;
  userAnswer: string;
  status: 'CORRECT' | 'INCORRECT' | 'PARTIAL';
  timestamp: number;
}

export interface StudyPlan {
  id: string;
  goal: string;
  daysRemaining: number;
  subjects: string[];
  schedule: {
    day: number;
    tasks: string[];
  }[];
}

export interface AppState {
  view: View;
  theme: Theme;
  notes: Note[];
  quizHistory: QuizAttempt[];
  studyPlans: StudyPlan[];
  streak: number;
  lastActive: number;
}
