# Google Play "Data safety" answers

These match what the app really does. Answer the form like this.

**Does your app collect or share any of the required user data types?** Yes.
**Is all of the user data collected by your app encrypted in transit?** Yes (everything goes over HTTPS to Google Firebase).
**Do you provide a way for users to request that their data is deleted?** Yes — in the app (Profile → Delete my account) and on the web: `https://<your-project-id>.web.app/delete-account.html`

| Data type | Collected? | Shared? | Optional? | Why |
|---|---|---|---|---|
| Personal info → Name | Yes | No | Required (a display name) | App functionality, account management |
| Personal info → Email address | Yes (Google sign-in only) | No | Optional (guests have none) | Account management |
| Personal info → User IDs | Yes | No | Required | App functionality, account management |
| Location → Precise location | Yes | No | Optional (only when you tap "Send my location") | App functionality |
| Messages → Other in-app messages | Yes (group chats) | No | Optional | App functionality |
| Photos and videos | No | — | — | (QR scanning stays on the phone) |
| App activity → Other user-generated content | Yes (plans, notes, polls, check-ins) | No | Optional | App functionality |
| App info and performance → Crash logs | Yes | No | Optional (can be turned off) | Analytics (fixing bugs) |

Notes for the form:
- "Near me", "How far?" and sorting by distance use your location **on the phone only**; it isn't saved.
- Recently viewed places, searches, star ratings, lists and settings stay **on the phone**: not "collected".
- Messages and locations you send to a group are seen by its members because you chose to send them: Google doesn't count that as "sharing".
- The AI request (vibe, time, a list of real places, and your optional note) goes to Google Gemini as a **service provider**: not "sharing".
- No ads, no analytics SDKs, no data sold.
