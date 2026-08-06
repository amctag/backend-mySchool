-- Keep only the latest session per parent before enforcing one session per person.
DELETE FROM "parent_sessions" AS old
USING "parent_sessions" AS newer
WHERE old.person_id = newer.person_id
  AND old.created_at < newer.created_at;

CREATE UNIQUE INDEX "parent_sessions_person_id_key" ON "parent_sessions"("person_id");
