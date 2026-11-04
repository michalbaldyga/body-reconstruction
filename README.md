# Body Reconstruction

Osobisty dziennik aktywności: zapis serii, monitoring samopoczucia, historia oraz kalendarz miesięczny. React + TypeScript + Vite, lokalna baza IndexedDB/Dexie.

## Prywatność

- Repozytorium i interfejs są publiczne. Nie zawierają indywidualnej dokumentacji medycznej ani danych użytkownika.
- Początkowe dawki są neutralnym szablonem (0 kg dodatkowego obciążenia). Własne wartości wpisuje się w aplikacji; nie są wysyłane do GitHuba.
- Wpisy przechowuje przeglądarka na urządzeniu. Brak konta, synchronizacji, analityki i serwera danych.
- Baza lokalna i eksport JSON **nie są szyfrowane hasłem**. Nie publikuj eksportów ani nie przechowuj rzeczywistych wpisów na współdzielonym profilu przeglądarki.
- Dokumenty prywatne, eksporty, katalog narzędzi i dane testów są wyłączone z Git. Do hostingu trafia wyłącznie katalog `dist`.
- Zmiana adresu strony, telefonu lub przeglądarki oznacza inną lokalną bazę. Kopie JSON umożliwiają ręczne przeniesienie danych.

## Uruchomienie lokalne

Node.js 22.12 lub nowszy LTS:

```powershell
npm ci
npm run build
npm run preview -- --port 4173
```

Otwórz http://localhost:4173. Na komputerze, na którym przygotowano projekt, można też użyć `powershell -ExecutionPolicy Bypass -File .\START.ps1`. Tryb programistyczny: `npm run dev`.

## GitHub Pages

Workflow `.github/workflows/pages.yml` testuje i buduje aplikację z bazą `/body-reconstruction/`, następnie zapisuje sam wynik w gałęzi `gh-pages` i zleca natywną budowę Pages. Konfiguracja repozytorium: **Settings → Pages → Source: Deploy from a branch → gh-pages → /(root)**. Publikacja uruchamia się po zmianach gałęzi main lub ręcznie w Actions. Plik `.nojekyll` wyłącza przetwarzanie gotowych plików przez Jekyll.

Darmowy GitHub Pages wymaga publicznego repozytorium. Adres docelowy: https://michalbaldyga.github.io/body-reconstruction/ — sam zapis adresu w dokumentacji nie potwierdza udanego wdrożenia; sprawdź wynik workflow.

Na iPhonie otwórz adres HTTPS w Safari → Udostępnij → Dodaj do ekranu początkowego. Po pierwszym pobraniu aplikacja obsługuje pracę offline. Aktualizacja może wymagać zamknięcia wszystkich kart aplikacji i ponownego otwarcia. Zachowanie na rzeczywistym Safari wymaga sprawdzenia na urządzeniu.

## Korzystanie

- Trening: wspólny wpis serii dla obu kończyn; rozpoczętą sesję można wznowić.
- Historia: dodawanie wcześniejszych treningów, edycja i usuwanie zapisów.
- Kalendarz: zielona kropka oznacza ukończony trening, pomarańczowa pomiar, obwódka trening w trakcie. Wybrany dzień otwiera formularze.
- Dziennik: codzienna ocena z datą, godziną i kontekstem. Wpisy można poprawić lub usunąć.
- Dane: eksport i import całej bazy. Import wymaga potwierdzenia zastąpienia danych.

Silnik reguł jest narzędziem pomocniczym, wymaga zatwierdzania propozycji i nie stanowi diagnozy ani indywidualnego zalecenia leczenia. Szablon i reguły należy dostosować przed użyciem rzeczywistym.

## Testowanie

```powershell
npm test
npm run build
npx playwright install chromium
npx playwright test
```

Test wersji z podkatalogiem GitHub Pages:

```powershell
$env:VITE_BASE_PATH = '/body-reconstruction/'
npm run build
npx playwright test
```

Po teście usuń zmienną poleceniem `Remove-Item Env:VITE_BASE_PATH`, aby wrócić do lokalnej ścieżki głównej. Szczegóły w [TESTOWANIE.md](TESTOWANIE.md).
