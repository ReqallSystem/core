export const CLASSIFICATION_PROMPT = `Classify the work just completed into exactly one category:

| Work type                          | kind    | status     |
|------------------------------------|---------|------------|
| Bug fix                            | issue   | resolved   |
| Architectural change               | arch    | resolved   |
| New feature request (not yet done) | todo    | open       |
| Completed feature request          | todo    | resolved   |
| New spec or plan                   | spec    | open       |
| Test scenario                      | test    | open       |
| Trivial / Q&A / unclassifiable     | —       | no action  |

If the work is non-trivial, save it via reqall:upsert_record with the appropriate kind, status, and a short descriptive title.
If the work created or modified relationships between records, also call reqall:upsert_link.`;
