# Weryfikacja aplikacji

Testy używają danych syntetycznych. Nie zawierają dokumentacji ani indywidualnego profilu użytkownika.

Zakres: reguły i brakujące pomiary, walidacja importu, odtworzenie bazy, wspólna edycja serii, zgodność starszego formatu, daty historyczne, niedozwolone nakładanie treningów, kalendarz, zapis po odświeżeniu oraz działanie offline.

Komendy: `npm test`, `npm run build`, `npx playwright test`.

Playwright uruchamia podgląd na porcie 4176. Zmienna `VITE_BASE_PATH=/body-reconstruction/` umożliwia sprawdzenie tego samego podkatalogu co w GitHub Pages. Przed testem należy zbudować aplikację z tą samą zmienną i zakończyć wcześniejszy serwer testowy.

Chromium z emulacją telefonu nie zastępuje testu Safari na rzeczywistym iPhonie. Testy weryfikują zachowanie oprogramowania, nie skuteczność medyczną planu ani progów.


Szablony i migracja: `src/plans.test.ts`, `src/db.test.ts` i `e2e/plans.spec.ts` sprawdzają zmienną liczbę serii, kopię planu w sesji, zamianę bez przenoszenia obciążeń, filtrowanie bazy, tworzenie/kopiowanie/edycję/usunięcie szablonu, import/eksport v2 i aktualizację rzeczywistej bazy IndexedDB v1 bez usuwania starego treningu.

W środowisku chmurowym można użyć zainstalowanego systemowego Chromium przez lokalną konfigurację `.tools/playwright.cloud.config.ts`: `CI=1 npx playwright test --config .tools/playwright.cloud.config.ts`. Emulacja telefonu nie potwierdza działania na fizycznym Safari.


`e2e/update.spec.ts` sprawdza rzeczywistą instalację i aktywację nowej wersji service workera w otwartej aplikacji, zachowanie treningu i planu, ponowne działanie offline oraz stałą obecność przycisku wyłącznie na dole zakładki Dane. Test tymczasowo zmienia wygenerowane pliki `dist` i przywraca je w `finally`; testy uruchamiamy z jednym workerem.
