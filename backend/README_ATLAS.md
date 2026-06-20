Setup MongoDB Atlas (free) and connect to this project

1. Create a free Atlas account
   - Visit https://www.mongodb.com/cloud/atlas and sign up.

2. Create a free cluster
   - Choose the free tier (M0) and a nearby region.

3. Create a database user
   - In "Database Access" add a user (username + password) and note these credentials.

4. Allow connections from your IP
   - In "Network Access" add your current IP address or temporarily allow 0.0.0.0/0 for testing.

5. Get the connection string
   - In "Clusters" click "Connect" → "Connect your application" and copy the `mongodb+srv://` string.
   - Replace `<username>`, `<password>` and the DB name (use `smarttouristsafety`).

6. Update `backend/.env`
   - Open `backend/.env` and uncomment the `MONGO_URI` example at the top, replacing placeholders.
   - Example:

```
MONGO_URI=mongodb+srv://myUser:myPass@cluster0.xxxxxx.mongodb.net/smarttouristsafety?retryWrites=true&w=majority
JWT_SECRET=keep_this_secret_and_long
PORT=5000
```

7. Run the backend

```bash
cd backend
npm install
npm run dev   # or `node server.js`
```

8. Verify
   - Server should print `MongoDB connected:` and `Server running on port 5000`.
   - Open http://localhost:5000 and test register/login.

Notes
- Atlas free tier is free for development. No payment required for the M0 tier.
- For production, secure your IP access and use strong passwords and secret management.
