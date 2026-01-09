/**
 * JD Agent - Chat Debug Test Script
 * 
 * Tests the chat API endpoint to verify it works correctly
 */

const API_BASE = process.env.API_BASE || 'http://localhost:3000';

async function testChat() {
  console.log('\n🧪 Testing Chat API');
  console.log('='.repeat(60));
  console.log(`API Base: ${API_BASE}\n`);

  // Test 1: Check chat status
  console.log('1. Testing GET /api/chat/status');
  try {
    const statusRes = await fetch(`${API_BASE}/api/chat/status`);
    const statusData = await statusRes.json();
    console.log('   Status:', statusRes.status);
    console.log('   Response:', JSON.stringify(statusData, null, 2));
    console.log('   ✅ Status check passed\n');
  } catch (error) {
    console.log('   ❌ Status check failed:', error);
  }

  // Test 2: Send a chat message
  console.log('2. Testing POST /api/chat');
  try {
    const chatRes = await fetch(`${API_BASE}/api/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message: 'Hello, this is a test message' }),
    });
    
    const chatData = await chatRes.json();
    console.log('   Status:', chatRes.status);
    console.log('   Response structure:', JSON.stringify(chatData, null, 2));
    
    if (chatRes.ok && chatData.success) {
      // Check for both response formats
      if (chatData.data?.response) {
        console.log('   ✅ Found "response" field:', chatData.data.response.substring(0, 100) + '...');
      }
      if (chatData.data?.message) {
        console.log('   ✅ Found "message" field:', chatData.data.message.substring(0, 100) + '...');
      }
      if (!chatData.data?.response && !chatData.data?.message) {
        console.log('   ❌ Missing both "response" and "message" fields!');
      }
      console.log('   Tools used:', chatData.data?.toolsUsed || []);
    } else {
      console.log('   ⚠️  Chat request failed or agent not configured');
      console.log('   Error:', chatData.error || chatData.details);
    }
    console.log('');
  } catch (error) {
    console.log('   ❌ Chat request failed:', error);
  }

  // Test 3: Test validation
  console.log('3. Testing validation (empty message)');
  try {
    const validationRes = await fetch(`${API_BASE}/api/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message: '' }),
    });
    const validationData = await validationRes.json();
    console.log('   Status:', validationRes.status);
    if (validationRes.status === 400) {
      console.log('   ✅ Validation works correctly\n');
    } else {
      console.log('   ⚠️  Expected 400, got:', validationRes.status);
    }
  } catch (error) {
    console.log('   ❌ Validation test failed:', error);
  }

  // Test 4: Clear history
  console.log('4. Testing POST /api/chat/clear');
  try {
    const clearRes = await fetch(`${API_BASE}/api/chat/clear`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
    });
    const clearData = await clearRes.json();
    console.log('   Status:', clearRes.status);
    if (clearRes.ok && clearData.success) {
      console.log('   ✅ Clear history works\n');
    } else {
      console.log('   ⚠️  Clear history failed');
    }
  } catch (error) {
    console.log('   ❌ Clear history test failed:', error);
  }

  console.log('='.repeat(60));
  console.log('✅ Chat API tests completed\n');
}

testChat().catch(console.error);
