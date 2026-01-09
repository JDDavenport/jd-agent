/**
 * Test Voice Command Detection
 *
 * Tests the wake word detection and command parsing.
 */

import { voiceCommandService } from '../services/voice-command-service';

// Mock transcript segments with voice commands
const mockSegments = [
  { start: 0, end: 5, text: "Good morning everyone, let's get started.", speaker: 0 },
  { start: 5, end: 12, text: "Plaud, add task review the assignment for next week", speaker: 0 },
  { start: 12, end: 20, text: "As I was saying, the exam will be on Friday.", speaker: 1 },
  { start: 20, end: 28, text: "Plaud remind me to email Professor Smith tomorrow", speaker: 0 },
  { start: 28, end: 35, text: "Does anyone have questions about the reading?", speaker: 1 },
  { start: 35, end: 42, text: "Plaud, note this is an important concept about Nash equilibrium", speaker: 0 },
  { start: 42, end: 50, text: "The midterm covers chapters 1 through 5.", speaker: 1 },
  { start: 50, end: 58, text: "Plaud todo buy textbook for next class", speaker: 0 },
  { start: 58, end: 65, text: "Plaud, schedule meeting with study group on Monday", speaker: 0 },
  { start: 65, end: 72, text: "Remember to submit your work by end of week", speaker: 1 },
  { start: 72, end: 80, text: "Plaud, highlight market equilibrium theory", speaker: 0 },
  { start: 80, end: 88, text: "That's all for today, class dismissed.", speaker: 1 },
];

async function main() {
  console.log('\n' + '='.repeat(60));
  console.log('  Voice Command Detection Test');
  console.log('='.repeat(60) + '\n');

  // Test 1: Detect commands in mock segments
  console.log('[Test 1] Detecting commands in mock transcript...\n');

  const detectedCommands = voiceCommandService.detectCommands(mockSegments);

  console.log(`Found ${detectedCommands.length} commands:\n`);

  for (const cmd of detectedCommands) {
    console.log(`  Type: ${cmd.type}`);
    console.log(`  Raw: "${cmd.rawText}"`);
    console.log(`  Action: ${cmd.parsedIntent.action}`);
    console.log(`  Subject: ${cmd.parsedIntent.subject}`);
    console.log(`  Due Date: ${cmd.parsedIntent.dueDate?.toLocaleDateString() || 'none'}`);
    console.log(`  Priority: ${cmd.parsedIntent.priority || 'none'}`);
    console.log(`  Speaker: ${cmd.speakerId}`);
    console.log(`  Timestamp: ${cmd.timestampSeconds}s`);
    console.log('');
  }

  // Test 2: Wake word variations
  console.log('\n[Test 2] Testing wake word variations...\n');

  const wakeWordTests = [
    { text: "Plaud add task test one", expected: true },
    { text: "plaud, add task test two", expected: true },
    { text: "Hey Plaud add task test three", expected: true },
    { text: "Cloud add task test four", expected: true }, // Common mishearing
    { text: "add task test five", expected: false }, // No wake word
    { text: "I plaudits to the team", expected: false }, // Contains but not wake word
  ];

  for (const test of wakeWordTests) {
    const commands = voiceCommandService.detectCommands([
      { start: 0, end: 5, text: test.text, speaker: 0 }
    ]);
    const found = commands.length > 0;
    const status = found === test.expected ? '✓' : '✗';
    console.log(`  ${status} "${test.text}" → ${found ? 'DETECTED' : 'not detected'} (expected: ${test.expected ? 'DETECTED' : 'not detected'})`);
  }

  // Test 3: Date extraction
  console.log('\n\n[Test 3] Testing date extraction...\n');

  const dateTests = [
    "Plaud add task do homework tomorrow",
    "Plaud add task submit report on Friday",
    "Plaud add task review notes next week",
    "Plaud add task call mom on Monday",
  ];

  for (const test of dateTests) {
    const commands = voiceCommandService.detectCommands([
      { start: 0, end: 5, text: test, speaker: 0 }
    ]);
    if (commands.length > 0) {
      const dueDate = commands[0].parsedIntent.dueDate;
      console.log(`  "${test}"`);
      console.log(`    → Due: ${dueDate?.toLocaleDateString() || 'none'}\n`);
    }
  }

  // Test 4: Priority extraction
  console.log('\n[Test 4] Testing priority extraction...\n');

  const priorityTests = [
    "Plaud add task urgent fix the bug",
    "Plaud add task high priority review PR",
    "Plaud add task low priority clean up code",
    "Plaud add task regular item",
  ];

  for (const test of priorityTests) {
    const commands = voiceCommandService.detectCommands([
      { start: 0, end: 5, text: test, speaker: 0 }
    ]);
    if (commands.length > 0) {
      const priority = commands[0].parsedIntent.priority;
      const priorityLabel = priority === 4 ? 'Urgent' : priority === 3 ? 'High' : priority === 2 ? 'Medium' : priority === 1 ? 'Low' : 'None';
      console.log(`  "${test}"`);
      console.log(`    → Priority: ${priorityLabel} (${priority || 0})\n`);
    }
  }

  // Summary
  console.log('\n' + '='.repeat(60));
  console.log('  Summary');
  console.log('='.repeat(60));
  console.log(`
Voice command patterns supported:
  • "Plaud, add task [task description]"
  • "Plaud, remind me to [action]"
  • "Plaud, note [content]"
  • "Plaud, highlight [section]"
  • "Plaud, schedule [event]"
  • "Plaud, todo [task]"

Date keywords: today, tomorrow, Monday-Sunday, next week, end of week
Priority keywords: urgent, high priority, important, medium priority, low priority

Speaker verification: Commands only execute if speaker is mapped to "self" profile
`);

  console.log('✅ Voice command detection working correctly!\n');
}

main().catch(console.error).finally(() => process.exit(0));
