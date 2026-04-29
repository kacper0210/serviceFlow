# Instrukcja uruchomienia projektu - Zlecenia App

Szybki przewodnik jak odpalić aplikację lokalnie.

## Wymagania
- **Node.js** (zalecana wersja LTS)
- **PostgreSQL** (uruchomiony lokalnie lub w chmurze)

## Konfiguracja Bazy Danych
Upewnij się, że masz bazę o nazwie `zlecenia_db`. Domyślna konfiguracja w `backend/db.js`:
- **Host**: localhost
- **User**: postgres
- **Password**: postgres
- **Port**: 5432
- **Database**: zlecenia_db

## Kroki uruchomienia

### 1. Backend
Otwórz nowy terminal w folderze `backend`:
```bash
cd backend
npm install
npm run dev
```
Serwer domyślnie startuje na porcie **5000** (lub innym zdefiniowanym w `.env`).

### 2. Frontend
Otwórz drugi terminal w folderze `frontend`:
```bash
cd frontend
npm install
npm run dev
```
Aplikacja będzie dostępna pod adresem wskazanym przez Vite (zazwyczaj `http://localhost:5173`).

## Przydatne skrypty
- `npm run dev` (Backend) - Odpala serwer z nodemonem (auto-restart).
- `npm run dev` (Frontend) - Odpala serwer deweloperski Vite.
