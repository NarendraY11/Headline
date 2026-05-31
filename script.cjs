const fs = require('fs');

const questionsCode = fs.readFileSync('src/data/questions.ts', 'utf8');

const regex = /export const staticQuestionBank: Question\[\] = \[\s*\{[\s\S]*?\];/m;
const match = questionsCode.match(regex);

if (match) {
  const staticArray = match[0];
  
  const staticQuestionsFileContent = `import { Question } from "./questions";\n\n${staticArray}\n`;
  fs.writeFileSync('src/data/staticQuestions.ts', staticQuestionsFileContent);
  
  const updatedQuestionsCode = questionsCode.replace(
    regex,
    `// Moved staticQuestionBank to staticQuestions.ts to minimize bundle size\n// It will be lazily loaded when needed.\n`
  );
  
  fs.writeFileSync('src/data/questions.ts', updatedQuestionsCode);
  console.log("Successfully extracted staticQuestionBank.");
} else {
  console.log("Could not find staticQuestionBank array.");
}
