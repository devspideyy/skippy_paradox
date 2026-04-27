# 🚀 Quick Start Guide

## Starting CodeCollab Locally

### 1. Start the Backend (Python FastAPI)

```bash
cd backend
python -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate
pip install -r requirements.txt
python main.py
```

Backend will run on: `http://localhost:8000`

### 2. Start the Socket Server (Node.js)

```bash
cd backend-socket
npm install
npm start
```

Socket server will run on: `http://localhost:4000`

### 3. Start the Frontend (React + Vite)

```bash
cd frontend
npm install
npm run dev
```

Frontend will run on: `http://localhost:5173` (or next available port)

---

## ✅ Verification

Once all three servers are running:

1. Open `http://localhost:5173` in your browser
2. You should see the **DotField animation** on the welcome screen (purple dots that react to your mouse)
3. Click "New Snippet" to create a file
4. The **Code Runner** should work (click "Run Code" button)

---

## 🐛 Troubleshooting

### DotField Not Visible?
- Make sure you're on the **welcome screen** (no file open)
- Try refreshing the page
- Check browser console for errors

### Code Runner Shows "Failed to fetch"?
- Make sure the **backend server** is running on port 8000
- Check that `backend/main.py` is running without errors
- Verify the backend URL in `frontend/.env` is correct

### Collaboration Not Working?
- Make sure the **socket server** is running on port 4000
- Check that `backend-socket/server.js` is running
- Verify the socket URL in `frontend/.env` is correct

---

## 📝 Notes

- **DotField** appears on:
  - Welcome screen (100% opacity)
  - Chat panel (30% opacity)
  - Gemini AI panel (30% opacity)
  - All modals (20% opacity)

- **Code Runner** requires the backend server to be running
- **GitHub Import** requires GitHub OAuth credentials in `backend/.env`
- **Collaboration** requires the socket server to be running

---

## 🎨 DotField Features

The interactive dot animation:
- ✨ Reacts to mouse movement (bulge effect)
- 🌟 Has sparkle animation
- 🎨 Adapts to dark/light theme
- 💫 Smooth transitions
- 🖱️ Interactive glow effect

Move your mouse over the welcome screen to see it in action!
