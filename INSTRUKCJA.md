# Instrukcja uruchomienia gry Wind Runner

## Wymagania

- Nowoczesna przeglądarka internetowa (Chrome, Firefox, Edge, Safari)
- Serwer lokalny (opcjonalny, ale zalecany)

## Sposób uruchomienia

### Metoda 1: Bezpośrednie otwarcie w przeglądarce

1. Otwórz plik `index.html` w przeglądarce internetowej
2. Gra powinna się automatycznie załadować

**Uwaga:** Niektóre przeglądarki mogą blokować ładowanie plików lokalnych (CORS). W takim przypadku użyj metody 2.

### Metoda 2: Uruchomienie przez serwer lokalny (ZALECANE)

#### Python 3:
```bash
python3 -m http.server 8000
```
Następnie otwórz w przeglądarce: `http://localhost:8000`

#### Python 2:
```bash
python -m SimpleHTTPServer 8000
```

#### Node.js (z http-server):
```bash
npx http-server -p 8000
```

#### PHP:
```bash
php -S localhost:8000
```

### Metoda 3: Użycie rozszerzenia przeglądarki

Zainstaluj rozszerzenie do serwera lokalnego (np. "Live Server" dla VS Code lub podobne).

## Sterowanie

- **Kliknięcie myszką** lub **dotknięcie ekranu** - bohater wzlatuje w górę
- Gra działa automatycznie - świat przesuwa się w lewo
- Unikaj przeszkód (platformy, chmury, ptaki)
- Zbieraj monety, aby zwiększyć wynik

## Struktura plików

```
MAX_BOEGL/
├── index.html      # Główny plik HTML
├── style.css       # Style CSS
├── game.js         # Logika gry
├── logo.svg        # Logo klienta
└── INSTRUKCJA.md   # Ten plik
```

## Funkcjonalności gry

- ✅ Responsywna gra działająca na komputerach i urządzeniach mobilnych
- ✅ Fizyka wiatru z turbin wiatrowych
- ✅ Animowane turbiny z wizualną "linią wiatru"
- ✅ Różne typy przeszkód (platformy, chmury, ptaki)
- ✅ Monety z animacją pulsowania
- ✅ Logo klienta wyświetlane na postaci
- ✅ Ekran startowy i ekran Game Over
- ✅ Licznik punktów
- ✅ Automatyczne zwiększanie trudności

## Rozwiązywanie problemów

### Logo nie wyświetla się
- Upewnij się, że plik `logo.svg` znajduje się w tym samym katalogu co `index.html`
- Sprawdź konsolę przeglądarki pod kątem błędów CORS (użyj serwera lokalnego)

### Gra nie działa na urządzeniu mobilnym
- Upewnij się, że używasz nowoczesnej przeglądarki
- Sprawdź, czy urządzenie obsługuje HTML5 Canvas

### Problemy z wydajnością
- Zamknij inne zakładki w przeglądarce
- Sprawdź, czy przeglądarka ma włączone przyspieszenie sprzętowe

## Wsparcie

W razie problemów sprawdź konsolę przeglądarki (F12) pod kątem błędów JavaScript.

