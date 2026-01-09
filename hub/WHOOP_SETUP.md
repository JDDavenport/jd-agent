# Whoop API Setup Guide

This guide will help you set up Whoop API access for JD Agent.

## Prerequisites

1. Whoop Developer Account (sign up at https://developer.whoop.com)
2. Running JD Agent server at `http://localhost:3000`

## Step 1: Create Whoop Application

1. Go to https://developer.whoop.com
2. Sign in or create a developer account
3. Create a new application
4. Fill in the application details:
   - **Application Name:** JD Agent
   - **Description:** Personal AI agent system for productivity and health tracking
   - **Privacy Policy URL:** `http://localhost:3000/privacy`
   - **Redirect URLs:** 
     - `http://localhost:3000/api/whoop/callback`
     - (Add production URL when deploying)

## Step 2: Configure Environment Variables

Add these to your `.env` file:

```bash
# Whoop API Credentials
WHOOP_CLIENT_ID=your_client_id_here
WHOOP_CLIENT_SECRET=your_client_secret_here
WHOOP_REDIRECT_URI=http://localhost:3000/api/whoop/callback
```

## Step 3: Start Your Server

Make sure your JD Agent server is running:

```bash
cd hub
bun run dev
```

## Step 4: Test the Setup

1. **Check Status:**
   ```bash
   curl http://localhost:3000/api/whoop/status
   ```

2. **Initiate OAuth Flow:**
   ```bash
   curl http://localhost:3000/api/whoop/authorize
   ```
   Or open in browser: `http://localhost:3000/api/whoop/authorize`

3. **Authorize the Application:**
   - You'll be redirected to Whoop's authorization page
   - Sign in with your Whoop account
   - Grant permissions for:
     - Read Recovery
     - Read Workout
     - Read Sleep

4. **OAuth Callback:**
   - After authorization, you'll be redirected back to:
     `http://localhost:3000/api/whoop/callback?code=...`
   - The app will exchange the code for an access token

## Step 5: Test API Endpoints

Once authorized, you can test the API:

```bash
# Get user profile
curl http://localhost:3000/api/whoop/user

# Get today's recovery score
curl http://localhost:3000/api/whoop/recovery/today

# Get last night's sleep data
curl http://localhost:3000/api/whoop/sleep/last-night
```

## URLs for Whoop Application Setup

When creating your Whoop application, use these values:

### Privacy Policy URL
```
http://localhost:3000/privacy
```

### Redirect URLs
```
http://localhost:3000/api/whoop/callback
```

For production deployment, you'll also need to add:
```
https://your-domain.com/api/whoop/callback
```

## What JD Agent Does With Whoop Data

- **Recovery Scores:** Integrated into morning briefings to adjust task recommendations
- **Sleep Data:** Used to optimize scheduling and energy-based task assignments
- **Workout Data:** Correlated with productivity metrics for insights
- **HRV & Heart Rate:** Analyzed alongside time tracking for health patterns

## Troubleshooting

### "Whoop integration not configured"
- Make sure `WHOOP_CLIENT_ID` and `WHOOP_CLIENT_SECRET` are set in your `.env` file
- Restart the server after adding environment variables

### "Invalid redirect URI"
- Ensure the redirect URI in your `.env` matches exactly what's configured in Whoop Developer Portal
- Check for trailing slashes or protocol mismatches

### "Authorization code expired"
- OAuth codes expire quickly (usually 10 minutes)
- Try initiating the flow again

### "Token exchange failed"
- Verify your `WHOOP_CLIENT_SECRET` is correct
- Check that the redirect URI matches exactly
- Ensure your Whoop application is approved (may take time for new apps)

## Next Steps

Once OAuth is working:
1. Store tokens securely in the database (currently in-memory)
2. Implement token refresh logic
3. Schedule daily sync jobs to fetch recovery/sleep data
4. Integrate Whoop metrics into ceremonies and task recommendations
