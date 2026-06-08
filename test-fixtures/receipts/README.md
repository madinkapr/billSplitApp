# Sample receipt fixtures

Dev/test fixtures for the receipt OCR feature. These images are used while building and
testing OCR price extraction. They are **not** shipped to end users.

## Why this lives outside `public/`

Anything in `public/` is copied into the production `dist/` build by Vite and served to
every user. These fixtures are development-only, so they live here (a top-level
`test-fixtures/` dir) to stay out of the bundle and off the served site. Tests, dev scripts,
or a future backend can read them directly from disk by relative path.

## Privacy

**Do not commit real receipts containing other people's personal or payment data** (names,
card numbers, full addresses). Use your own receipts with sensitive details redacted, or
synthetic/sample receipts.

## Naming

Use descriptive, kebab-case names that hint at the test case, e.g. `receipt-grocery.jpg`,
not `receipt-1.jpg`.

## Samples

Document each image below — its source and what makes it a useful test case (faded text,
multiple columns, foreign currency, line-item discounts, etc.).

| File | Store type | Format | Notable test characteristics | Provenance |
|------|------------|--------|------------------------------|------------|
| _e.g._ `receipt-cafe.jpg` | Cafe | JPG | Few items, clear print | _redacted personal receipt_ |
| _e.g._ `receipt-grocery.jpg` | Grocery | JPG | Many line items, per-item discounts | _redacted personal receipt_ |
| _e.g._ `receipt-restaurant.png` | Restaurant | PNG | Tax + tip lines, faded thermal print | _synthetic_ |

_(Replace the example rows above as you add real fixtures.)_
