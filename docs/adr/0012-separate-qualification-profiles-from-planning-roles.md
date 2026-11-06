# Separate qualification profiles from planning roles

Date: 2026-11-06.

Planning roles group demand and supply hours. Qualification profiles express minimum competency levels. The user chooses separate concepts with optional profile requirements on work nodes. Treating every qualified profile as a supply role would count the same person's hours more than once.

Import the selected competency sheet into a private text snapshot. The compiler consumes that snapshot with the other plan files. It does not read Excel or depend on a file system. This preserves ADR 0001 and ADR 0008 while allowing a workbook to remain the upstream assessment source. Refreshes are explicit.

Use positive profile levels as minimum requirements. In assessments, zero and absent values mean not assessed. Coverage counts requirements met, divided by positive requirements, including unknown assessments in the denominator. Excess proficiency does not compensate for another competency gap. An empty requirement set has no coverage value.

Profile checks warn about direct bookings against their target node's inherited profile. A pool does not identify which person performs each descendant task. Therefore, a pool does not imply qualification assignments to all descendants. Warnings retain booking hours and forecast status.

Name matching uses a unique normalized full name or an explicit alias to one exact matrix name. Ambiguous and unmatched names remain unassessed. Inactive assessments are excluded from suggestions by default. Missing assessments remain visible as unknown candidates. Matching describes qualifications, not available capacity or automatic staffing.

## Role declarations

ADR 0011 validates planning role IDs. It does not define qualification profiles. The competency importer can generate missing planning role declarations from existing references. This avoids requiring manual edits to existing private plans. Review these copied IDs for spelling errors. Later unknown references still produce E003.
