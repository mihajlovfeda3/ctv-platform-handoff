-- Reject cycles in the business landscape; technology levels are enforced by FKs.
CREATE FUNCTION ctv_check_business_hierarchy() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.parent_id IS NOT NULL AND EXISTS (
    WITH RECURSIVE ancestors AS (
      SELECT id, parent_id FROM business_nodes WHERE id = NEW.parent_id
      UNION
      SELECT b.id, b.parent_id FROM business_nodes b JOIN ancestors a ON b.id = a.parent_id
    ) SELECT 1 FROM ancestors WHERE id = NEW.id
  ) THEN
    RAISE EXCEPTION 'Business hierarchy must be acyclic' USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END;
$$;
--> statement-breakpoint
CREATE TRIGGER business_hierarchy_acyclic BEFORE INSERT OR UPDATE OF parent_id
ON business_nodes FOR EACH ROW EXECUTE FUNCTION ctv_check_business_hierarchy();
