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

Na iPhonie otwórz adres HTTPS w Safari → Udostępnij → Dodaj do ekranu początkowego. Po pierwszym pobraniu aplikacja obsługuje pracę offline. Przycisk „Odśwież aplikację” na stałe na dole zakładki Dane sprawdza aktualizację, aktywuje nową wersję offline i przeładowuje aplikację bez kasowania lokalnej bazy. Wymaga internetu; podczas zapisu danych jest niedostępny. Przed odrzuceniem otwartego formularza pojawia się potwierdzenie. Zachowanie na rzeczywistym Safari wymaga sprawdzenia na urządzeniu.

## Korzystanie

- Plany: własne szablony (np. Lower A / Lower B), kopiowanie, kolejność ćwiczeń, 1–10 serii, powtórzenia, ciężar i notatki. Dotychczasowy zestaw pozostaje jako „Plan początkowy”.
- Baza: 30 ćwiczeń nóg z wyszukiwarką i filtrem sprzętu. Ćwiczenia z gumą mają pole notatki na opis oporu; ćwiczenia jednostronne opisują powtórzenia na stronę.
- Trening: wybór szablonu i modyfikacje tylko na tę sesję; zamiana jest dostępna również po rozpoczęciu. Nowe ćwiczenie po zamianie ma puste obciążenie i powtórzenia — nie przenosimy kilogramów z innej maszyny. Wpisy serii dla obu kończyn są wspólne; rozpoczętą sesję można wznowić.
- Każda sesja zachowuje własną kopię planu. Edycja lub usunięcie szablonu nie zmienia historii. Propozycje progresji dotyczą wyłącznie czterech pierwotnych ćwiczeń; nowe ćwiczenia ustawia się ręcznie.
- Historia: dodawanie wcześniejszych treningów, edycja i usuwanie zapisów oraz filtr według ćwiczenia.
- Kalendarz: zielona kropka oznacza ukończony trening, pomarańczowa pomiar, obwódka trening w trakcie. Wybrany dzień otwiera formularze.
- Dziennik: codzienna ocena z datą, godziną i kontekstem. Wpisy można poprawić lub usunąć.
- Dane: eksport JSON v2 obejmuje treningi, pomiary i szablony. Import przyjmuje również stare kopie v1 i wymaga potwierdzenia zastąpienia całej bazy. Aktualizacja zachowuje istniejącą bazę i dodaje tabelę szablonów.

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
