# 05: Inclusive or half-open date ranges?

Type: grilling
Status: resolved
Blocked by: None

## Question

How is the end of a range interpreted?

## Answer

Inclusive at the precision written; ISO only; legacy 'to 01.MM' imported as exclusive. See docs/adr/0004.
