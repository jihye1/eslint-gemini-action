import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import axios from 'axios';
import core from '@actions/core';

// GitHub 및 Gemini API 키 가져오기
const GITHUB_TOKEN = core.getInput('github_token');
const GEMINI_API_KEY = core.getInput('gemini_api_key');

// PR 정보 로드
const githubRepo = process.env.GITHUB_REPOSITORY;
const githubEventPath = process.env.GITHUB_EVENT_PATH;
const githubEvent = JSON.parse(fs.readFileSync(githubEventPath, 'utf8'));
const pullRequest = githubEvent.pull_request;

if (!pullRequest) {
  console.log('This action only runs on pull requests.');
  process.exit(0);
}

const PR_NUMBER = pullRequest.number;
const REPO_OWNER = githubRepo.split('/')[0];
const REPO_NAME = githubRepo.split('/')[1];
const COMMIT_ID = pullRequest.head.sha;

async function getChangedFileData() {
  const response = await axios.get(
    `https://api.github.com/repos/${REPO_OWNER}/${REPO_NAME}/pulls/${PR_NUMBER}/files`,
    {
      headers: { Authorization: `Bearer ${GITHUB_TOKEN}` },
    }
  );

  return response.data
    .filter(file => file.filename.endsWith('.js') || file.filename.endsWith('.ts'))
    .map(file => ({
      filename: file.filename,
      patch: file.patch,
      positionMap: buildLineToPositionMap(file.patch)
    }));
}

function buildLineToPositionMap(patch) {
  const map = {};
  if (!patch) return map;
  const lines = patch.split('\n');
  let newLine = 0, position = 0;
  for (const line of lines) {
    position++;
    if (line.startsWith('@@')) {
      const match = /\+([0-9]+)/.exec(line);
      newLine = match ? parseInt(match[1]) - 1 : newLine;
    } else if (!line.startsWith('-')) {
      newLine++;
      map[newLine] = position;
    }
  }
  return map;
}

function runESLint(files) {
  console.log('Running ESLint...');
  const filteredFiles = files.filter(f => !f.startsWith('action/') && !f.startsWith('node_modules/'));
  if (filteredFiles.length === 0) return [];
  const eslintCommand = `cd action && ./node_modules/.bin/eslint ${filteredFiles.map(f => `'../${f}'`).join(' ')} --format json -c .eslintrc.json -o ../eslint-report.json || true`;
  execSync(eslintCommand, { stdio: 'inherit' });
  return JSON.parse(fs.readFileSync('eslint-report.json', 'utf8'));
}

function extractJsonFromMarkdown(text) {
  const match = text.match(/```(?:json)?\n([\s\S]*?)```/) || [null, text];
  if (match[1]) {
    try {
      const cleaned = match[1]
        .replace(/```/g, '')
        .replace(/`/g, '"');
      return JSON.parse(cleaned);
    } catch (e) {
      console.error('Failed to parse cleaned JSON from Gemini response:', e);
    }
  }
  return { suggestions: [] };
}

async function getGeminiSuggestions(errorMessage, codeSnippet) {
  const prompt = `
Here is a JavaScript/TypeScript ESLint error message and a code snippet. 
Please suggest 1 alternative code snippet that fixes the issue.
Include a brief explanation including 2 or 3 sentences.

Respond ONLY in raw JSON. Do NOT use Markdown or backticks. 
Wrap all code and text in valid JSON strings using double quotes.

**ESLint Error:**
${errorMessage}

**Original Code:**
${codeSnippet}

**Expected JSON Response Format:**
{
  "suggestions": [
    {
      "code": "<alternative code snippet>",
      "explanation": "<brief explanation of why this is a better approach>"
    }
  ]
}`;

  try {
    const response = await axios.post(
      'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=' + GEMINI_API_KEY,
      {
        contents: [{ role: 'user', parts: [{ text: prompt }] }]
      }
    );
    const rawText = response.data.candidates?.[0]?.content?.parts?.[0]?.text || '{}';
    return extractJsonFromMarkdown(rawText).suggestions.slice(0, 1);
  } catch (error) {
    console.error('Error fetching AI suggestions:', error.response?.data || error.message);
    return [];
  }
}

async function createInlineComment(filePath, position, body) {
  try {
    await axios.post(
      `https://api.github.com/repos/${REPO_OWNER}/${REPO_NAME}/pulls/${PR_NUMBER}/comments`,
      {
        body,
        commit_id: COMMIT_ID,
        path: filePath,
        position: position
      },
      {
        headers: {
          Authorization: `Bearer ${GITHUB_TOKEN}`,
          'Accept': 'application/vnd.github+json'
        }
      }
    );
  } catch (err) {
    console.error('Failed to create inline comment:', err.response?.data || err.message);
  }
}

async function createCheckRun(title, summary, text) {
  const sha = pullRequest.head.sha;
  await axios.post(
    `https://api.github.com/repos/${REPO_OWNER}/${REPO_NAME}/check-runs`,
    {
      name: title,
      head_sha: sha,
      status: 'completed',
      conclusion: 'neutral',
      output: {
        title: title,
        summary: summary,
        text: text,
      },
    },
    {
      headers: {
        Authorization: `Bearer ${GITHUB_TOKEN}`,
        'Accept': 'application/vnd.github+json',
      },
    }
  );
}

(async function main() {
  try {
    const changedFiles = await getChangedFileData();
    if (changedFiles.length === 0) {
      console.log('No JS/TS files changed, skipping linting.');
      await createCheckRun('ESLint Gemini Suggestions', 'No files changed', 'No JS/TS files to lint. ✅');
      return;
    }

    const fileMap = Object.fromEntries(changedFiles.map(f => [f.filename, f]));
    const eslintResults = runESLint(changedFiles.map(f => f.filename));
    console.log('Done ESLint...');
    const repoRoot = process.cwd();

    let issuesFound = false;
    for (const result of eslintResults) {
       const relativePath = path.relative(repoRoot, result.filePath);
       const file = fileMap[relativePath];
       if (!file) continue;
 
       for (const message of result.messages) {
         const position = file.positionMap[message.line];
         if (!position) continue;
 
         const originalCode = fs.readFileSync(result.filePath, 'utf8')
           .split('\n')
           .slice(Math.max(message.line - 2, 0), message.line + 1)
           .join('\n');
 
         const suggestions = await getGeminiSuggestions(message.message, originalCode);
 
         if (suggestions.length > 0) {
           const s = suggestions[0];
           
          const ruleLink = message.ruleId
            ? `https://eslint.org/docs/latest/rules/${message.ruleId}`
            : null;
      
          let combinedComment = ruleLink
            ? `**ESLint [${message.ruleId}](${ruleLink})**: ${message.message}\n\n`
            : `**ESLint**: ${message.message}\n\n`;
           combinedComment += `💡 **AI Suggestion:**\n`;
           combinedComment += `\n\`\`\`js\n${s.code}\n\`\`\`\n\n📌 ${s.explanation}\n`;
           await createInlineComment(relativePath, position, combinedComment);
           issuesFound = true;
         }
       }
    }

    if (!issuesFound) {
      await createCheckRun('ESLint Gemini Suggestions', 'No ESLint issues found 🎉', 'Great job! No problems detected.');
    }
  } catch (error) {
    console.error('Error:', error);
    await createCheckRun('ESLint Gemini Suggestions', 'Action failed ❌', error.message);
  }
})();
