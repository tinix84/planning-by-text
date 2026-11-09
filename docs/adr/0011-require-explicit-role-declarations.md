# Require explicit role declarations

Date: 2026-11-06.

Roles require explicit declarations so misspelled IDs cannot silently create separate demand and supply categories. Conditional validation would leave a missing role registry undetected. Qualified IDs require exact declarations, because role names do not define an implicit hierarchy.

Forward declarations remain valid because files have no semantic order. Errors identify explicit references, so inherited defaults do not multiply the same diagnostic across descendants. Validation reports missing roles without editing the plan. New spreadsheet imports include the declarations their role references need.
