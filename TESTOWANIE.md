# Weryfikacja aplikacji

Testy używają danych syntetycznych. Nie zawierają dokumentacji ani indywidualnego profilu użytkownika.

Zakres: reguły i brakujące pomiary, walidacja importu, odtworzenie bazy, wspólna edycja serii, zgodność starszego formatu, daty historyczne, niedozwolone nakładanie treningów, kalendarz, zapis po odświeżeniu oraz działanie offline.

Komendy: `npm test`, `npm run build`, `npx playwright test`.

Playwright uruchamia podgląd na porcie 4176. Zmienna `VITE_BASE_PATH=/body-reconstruction/` umożliwia sprawdzenie tego samego podkatalogu co w GitHub Pages. Przed testem należy zbudować aplikację z tą samą zmienną i zakończyć wcześniejszy serwer testowy.

Chromium z emulacją telefonu nie zastępuje testu Safari na rzeczywistym iPhonie. Testy weryfikują zachowanie oprogramowania, nie skuteczność medyczną planu ani progów.
