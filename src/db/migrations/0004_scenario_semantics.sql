ALTER TABLE "scenarios" ADD COLUMN "business_challenge_description" text;--> statement-breakpoint
ALTER TABLE "scenarios" ADD COLUMN "business_effect" text;
--> statement-breakpoint
-- The supplied FG workbook confirms these legacy dictionary entries. Their IDs
-- provide an explicit one-to-one mapping without deleting either old table.
INSERT INTO functional_groups (id, name, description, source_id, is_synthetic)
SELECT b.id, b.name, 'ctv-functional-groups-v1', b.source_id, true
FROM business_directions b
JOIN sources origin ON origin.id = b.source_id
WHERE b.is_synthetic AND origin.is_synthetic
  AND origin.name = 'Демонстрационная классификация: терминология предоставлена пользователем; связи вымышлены'
ON CONFLICT (id) DO NOTHING;
--> statement-breakpoint
CREATE VIEW scenario_functional_groups AS
SELECT item.id AS scenario_id,
  CASE WHEN raw_group.id IS NOT NULL AND direct.id IS NULL
         OR direct.id IS NOT NULL AND mapped.id IS NOT NULL AND direct.id <> mapped.id
       THEN NULL ELSE coalesce(direct.id, mapped.id) END AS group_id,
  CASE WHEN raw_group.id IS NOT NULL AND direct.id IS NULL
         OR direct.id IS NOT NULL AND mapped.id IS NOT NULL AND direct.id <> mapped.id
       THEN NULL ELSE coalesce(direct.name, mapped.name) END AS name,
  direct.id IS NOT NULL AND mapped.id IS NOT NULL AND direct.id <> mapped.id AS conflict,
  raw_group.id IS NOT NULL AND direct.id IS NULL
    OR classification.business_direction_id IS NOT NULL AND mapped.id IS NULL AS unmapped
FROM scenarios item
LEFT JOIN functional_groups raw_group ON raw_group.id = item.functional_group_id
LEFT JOIN functional_groups direct
  ON direct.description = 'ctv-functional-groups-v1'
  AND direct.name = CASE WHEN raw_group.name = 'Cнабжение' THEN 'Снабжение' ELSE raw_group.name END
LEFT JOIN scenario_classification classification ON classification.scenario_id = item.id
LEFT JOIN functional_groups mapped
  ON mapped.id = classification.business_direction_id
  AND mapped.description = 'ctv-functional-groups-v1';
