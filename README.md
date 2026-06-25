.\venv\Scripts\python.exe -m uvicorn backend.main:app --reload --port 8000

cd  frontend
npm run dev

cd frontend
npx @tailwindcss/cli -i ./src/input.css -o ./src/output.css --watch