# Date ranges are inclusive at the precision written; ISO only

`2024-01..2024-02` means 1 Jan to 29 Feb; `2024-Q2`, `2024-W10` and day dates work the same way, and relative ends (`..+3m`) are allowed. The legacy data mixed exclusive ends ("to 01.03") with inclusive ones ("to 31.12") and even produced 31.04; one rule removes the off-by-one-month phantom overloads that the mix creates. We rejected half-open `[start, end)` ranges because `2024-01..2024-03` reads as "until March" to almost everyone. The one-off legacy importer reads `to 01.MM.YYYY` as exclusive.
