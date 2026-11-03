-- Match the generator's provenance and complete legacy title before renaming.
WITH generated AS (
  SELECT scenario.id,
         substring(scenario.external_id FROM '^SYN-([0-9]{4,5})$')::integer AS ordinal,
         CASE process.name
           WHEN 'Техническое обслуживание' THEN 'техническое обслуживание'
           WHEN 'Складские операции' THEN 'складские операции'
           WHEN 'Согласование документов' THEN 'согласование документов'
           WHEN 'Обучение сотрудников' THEN 'обучение сотрудников'
         END AS process_name
  FROM scenarios AS scenario
  JOIN sources AS source ON source.id = scenario.source_id
  JOIN business_nodes AS process ON process.id = scenario.business_node_id
    AND process.source_id = source.id AND process.kind = 'process' AND process.is_synthetic
  WHERE scenario.is_synthetic
    AND source.is_synthetic AND source.kind = 'synthetic'
    AND source.name = 'Синтетический генератор v1 · seed '
      || substring(scenario.origin_namespace FROM '^synthetic-v1-(-?[0-9]+)$')
),
titles AS (
  SELECT id, ordinal,
         (ARRAY[
           'Прогнозирование отклонений',
           'Автоматический контроль качества',
           'Поддержка планирования',
           'Мониторинг состояния',
           'Анализ причин ошибок'
         ])[1 + (ordinal - 1) % 5] || ' в процессе «' || process_name || '»' AS clean_name
  FROM generated
  WHERE ordinal BETWEEN 1 AND 10000
)
UPDATE scenarios AS scenario
SET name = titles.clean_name
FROM titles
WHERE scenario.id = titles.id
  AND scenario.external_id = 'SYN-' || lpad(ordinal::text, greatest(4, length(ordinal::text)), '0')
  AND scenario.name = titles.clean_name || ' · ' || lpad(ordinal::text, greatest(3, length(ordinal::text)), '0');
