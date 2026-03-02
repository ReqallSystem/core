export const CLASSIFICATION_PROMPT = `Classify the work just completed into one or more categories:

| Work type                          | kind    | status     |
|------------------------------------|---------|------------|
| Bug fix                            | issue   | resolved   |
| New bug discovered (not yet fixed) | issue   | open       |
| Completed task                     | todo    | resolved   |
| New task identified (not yet done) | todo    | open       |
| Architectural change or decision   | arch    | resolved   |
| New or updated specification       | spec    | open       |
| Test scenario added                | test    | open       |
| Trivial / Q&A / unclassifiable     | —       | no action  |

A session may produce multiple records. For each non-trivial work item, save it via reqall:upsert_record with the appropriate kind, status, a short descriptive title, and a body with enough context for semantic search.
If the work created or modified relationships between records, also call reqall:upsert_link.`;
