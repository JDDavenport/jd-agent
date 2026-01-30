#!/bin/bash

# Test script for Ryanair case
# Run this after starting the hub backend

CHAPTER_ID="a3b8b6e1-bf4a-46ef-802f-ded0954527b5"
API_BASE="http://localhost:3000/api/read-help"

echo "===== Read Help - Ryanair Case Test ====="
echo ""

# Test 1: Get chapter details
echo "1. Testing GET /chapters/${CHAPTER_ID}"
curl -s "${API_BASE}/chapters/${CHAPTER_ID}" | jq -r '.data.title // "Chapter not found"'
echo ""

# Test 2: Get 15-minute summary (medium)
echo "2. Testing 15-minute summary (medium length)"
echo "   Generating summary... (this may take 30-60 seconds)"
SUMMARY_15=$(curl -s "${API_BASE}/chapters/${CHAPTER_ID}/summary/medium")
WORD_COUNT_15=$(echo "$SUMMARY_15" | jq -r '.data.summary' | wc -w | xargs)
echo "   ✓ 15-minute summary: ${WORD_COUNT_15} words"
echo ""

# Test 3: Get 30-minute summary (long)
echo "3. Testing 30-minute summary (long length)"
echo "   Generating summary... (this may take 60-90 seconds)"
SUMMARY_30=$(curl -s "${API_BASE}/chapters/${CHAPTER_ID}/summary/long")
WORD_COUNT_30=$(echo "$SUMMARY_30" | jq -r '.data.summary' | wc -w | xargs)
echo "   ✓ 30-minute summary: ${WORD_COUNT_30} words"
echo ""

# Test 4: Compare lengths
echo "4. Comparing summary lengths:"
echo "   - 15-minute (medium): ${WORD_COUNT_15} words"
echo "   - 30-minute (long):   ${WORD_COUNT_30} words"
if [ "$WORD_COUNT_30" -gt "$WORD_COUNT_15" ]; then
    echo "   ✓ PASS: 30-minute summary is longer than 15-minute"
else
    echo "   ✗ FAIL: 30-minute summary should be longer!"
fi
echo ""

# Test 5: Test chat with chapter context
echo "5. Testing chat with chapter context"
BOOK_ID=$(curl -s "${API_BASE}/chapters/${CHAPTER_ID}" | jq -r '.data.bookId')
echo "   Book ID: ${BOOK_ID}"

CHAT_RESPONSE=$(curl -s -X POST "${API_BASE}/chat" \
  -H "Content-Type: application/json" \
  -d "{
    \"bookId\": \"${BOOK_ID}\",
    \"chapterId\": \"${CHAPTER_ID}\",
    \"message\": \"What is the main competitive advantage discussed in this case?\"
  }")

RESPONSE_TEXT=$(echo "$CHAT_RESPONSE" | jq -r '.data.response' | head -c 200)
echo "   ✓ Chat response (first 200 chars): ${RESPONSE_TEXT}..."
echo ""

echo "===== Test Complete ====="
echo ""
echo "To test in the UI:"
echo "1. Start frontend: cd apps/read-help && bun run dev"
echo "2. Open: http://localhost:5174"
echo "3. Navigate to the Ryanair case"
echo "4. Try all three reading modes: Full Case, 30-Min Summary, 15-Min Summary"
echo "5. In Full Case mode, click the chat icon on the right to test inline chat"
