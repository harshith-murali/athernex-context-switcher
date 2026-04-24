#!/bin/bash

# Simple API test script for ContextMind backend

BACKEND_URL="http://localhost:37218"
TOKEN="test-token"

echo "🧪 Testing ContextMind API"
echo ""

# Test 1: Health check
echo "Test 1: Health check"
curl -s "$BACKEND_URL/health" | jq .
echo ""

# Test 2: Save context
echo "Test 2: Save context"
RESPONSE=$(curl -s -X POST "$BACKEND_URL/save" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{
    "source": "chrome",
    "timestamp": '$(date +%s)'000,
    "chrome": {
      "tabs": [
        {
          "url": "https://claude.ai/chat",
          "title": "Claude Conversation",
          "content": "User: What is machine learning?\nAssistant: Machine learning is a subset of artificial intelligence that enables systems to learn and improve from experience without being explicitly programmed."
        },
        {
          "url": "https://github.com/anthropics/claude-code",
          "title": "anthropics/claude-code - GitHub",
          "content": "# Claude Code\nOfficial CLI tool for Claude by Anthropic"
        }
      ],
      "windowId": 123
    }
  }')

echo "$RESPONSE" | jq .
SESSION_ID=$(echo "$RESPONSE" | jq -r '.sessionId')

echo ""

# Test 3: Get context
if [ ! -z "$SESSION_ID" ] && [ "$SESSION_ID" != "null" ]; then
  echo "Test 3: Get context (Session ID: ${SESSION_ID:0:8}...)"
  curl -s -X GET "$BACKEND_URL/context" \
    -H "Authorization: Bearer $TOKEN" | jq .
else
  echo "❌ Could not get Session ID from save response"
fi

echo ""
echo "✅ Tests complete"
