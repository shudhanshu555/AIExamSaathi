
import { GoogleGenAI, Type, Modality } from "@google/genai";
import { SYSTEM_INSTRUCTION } from "../constants";

// Helper to get fresh AI instance
const getAI = () => new GoogleGenAI({ apiKey: process.env.API_KEY! });

export const generateNotes = async (topic: string, course: string, year: string, university: string, length: string) => {
  const ai = getAI();
  const prompt = `Generate comprehensive academic notes for the following:
  Topic: ${topic}
  Course: ${course}
  Year: ${year}
  University: ${university}
  Target Length: ${length}

  Include key concepts, formulas (with LaTeX notation), diagram descriptions, study tips, and practice points.
  Respond strictly in JSON format.`;

  const response = await ai.models.generateContent({
    model: 'gemini-3-pro-preview',
    contents: { parts: [{ text: prompt }] },
    config: {
      systemInstruction: SYSTEM_INSTRUCTION,
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          keyConcepts: { type: Type.ARRAY, items: { type: Type.STRING } },
          formulas: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                name: { type: Type.STRING },
                formula: { type: Type.STRING },
                explanation: { type: Type.STRING }
              },
              required: ["name", "formula", "explanation"]
            }
          },
          diagramDescriptions: { type: Type.ARRAY, items: { type: Type.STRING } },
          tips: { type: Type.ARRAY, items: { type: Type.STRING } },
          practicePoints: { type: Type.ARRAY, items: { type: Type.STRING } }
        },
        required: ["keyConcepts", "formulas", "diagramDescriptions", "tips", "practicePoints"]
      }
    }
  });

  return JSON.parse(response.text);
};

export const generateQuizQuestion = async (topic: string, difficulty: string, type: 'MCQ' | 'OPEN_ENDED' = 'OPEN_ENDED') => {
  const ai = getAI();
  const prompt = `Generate a unique ${type} quiz question about ${topic} with ${difficulty} difficulty. 
  ${type === 'MCQ' ? 'Provide exactly 4 distinct options. One must be correct.' : ''}
  Include a hint, the correct answer, and a detailed explanation.`;

  const response = await ai.models.generateContent({
    model: 'gemini-3-flash-preview',
    contents: { parts: [{ text: prompt }] },
    config: {
      systemInstruction: SYSTEM_INSTRUCTION,
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          text: { type: Type.STRING },
          hint: { type: Type.STRING },
          correctAnswer: { type: Type.STRING },
          explanation: { type: Type.STRING },
          options: { 
            type: Type.ARRAY, 
            items: { type: Type.STRING },
            description: "List of 4 options if it is an MCQ, otherwise empty."
          }
        },
        required: ["text", "hint", "correctAnswer", "explanation"]
      }
    }
  });

  const parsed = JSON.parse(response.text);
  return { ...parsed, type };
};

export const evaluateAnswer = async (question: string, correctAnswer: string, userAnswer: string) => {
  const ai = getAI();
  const prompt = `Question: ${question}
  Correct Answer: ${correctAnswer}
  User Answer: ${userAnswer}

  Evaluate if the answer is CORRECT, INCORRECT, or PARTIAL. Provide a score from 0 to 100.
  Also provide feedback on what was missed.`;

  const response = await ai.models.generateContent({
    model: 'gemini-3-flash-preview',
    contents: { parts: [{ text: prompt }] },
    config: {
      systemInstruction: SYSTEM_INSTRUCTION,
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          status: { type: Type.STRING, enum: ["CORRECT", "INCORRECT", "PARTIAL"] },
          score: { type: Type.NUMBER },
          feedback: { type: Type.STRING }
        },
        required: ["status", "score", "feedback"]
      }
    }
  });

  return JSON.parse(response.text);
};

export const generateStudyPlan = async (goal: string, daysRemaining: number, subjects: string[]) => {
  const ai = getAI();
  const prompt = `Create a detailed daily study plan for the next ${daysRemaining} days. 
  Goal: ${goal}
  Subjects: ${subjects.join(', ')}
  
  Format the response as a daily schedule with clear tasks for each day.`;

  const response = await ai.models.generateContent({
    model: 'gemini-3-flash-preview',
    contents: { parts: [{ text: prompt }] },
    config: {
      systemInstruction: SYSTEM_INSTRUCTION,
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          schedule: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                day: { type: Type.INTEGER },
                tasks: { type: Type.ARRAY, items: { type: Type.STRING } }
              },
              required: ["day", "tasks"]
            }
          }
        },
        required: ["schedule"]
      }
    }
  });

  return JSON.parse(response.text);
};

export const getMotivation = async (userState: string, historySummary: string) => {
  const ai = getAI();
  const prompt = `User is feeling: ${userState}. 
  History summary: ${historySummary}.
  Provide a brief motivational boost with an inspirational quote and personalized encouragement.`;

  const response = await ai.models.generateContent({
    model: 'gemini-3-flash-preview',
    contents: { parts: [{ text: prompt }] },
    config: {
      systemInstruction: SYSTEM_INSTRUCTION
    }
  });

  return response.text;
};

export const chatWithAssistant = async (message: string, context: any) => {
    const ai = getAI();
    const response = await ai.models.generateContent({
        model: 'gemini-3-flash-preview',
        contents: { parts: [{ text: `User Message: ${message}\nContext: ${JSON.stringify(context)}` }] },
        config: {
            systemInstruction: SYSTEM_INSTRUCTION
        }
    });
    return response.text;
}

export const generateSpeech = async (text: string) => {
    const safeText = text.length > 500 ? text.substring(0, 500) + "..." : text;
    const ai = getAI();
    
    try {
        const response = await ai.models.generateContent({
            model: "gemini-2.5-flash-preview-tts",
            contents: [{ parts: [{ text: safeText }] }],
            config: {
                responseModalities: [Modality.AUDIO],
                speechConfig: {
                    voiceConfig: {
                        prebuiltVoiceConfig: { voiceName: 'Zephyr' },
                    },
                },
            },
        });
        return response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
    } catch (error) {
        console.error("Gemini TTS Error:", error);
        return undefined;
    }
};
