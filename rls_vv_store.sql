-- Ejecutar en: supabase.com > proyecto wjzxdevrnzvgklapolve > SQL Editor
-- Protege vv_store: solo usuarios autenticados (Supabase Auth) pueden leer/escribir

ALTER TABLE vv_store ENABLE ROW LEVEL SECURITY;

CREATE POLICY "solo_autenticados" ON vv_store
  FOR ALL
  USING (auth.role() = 'authenticated')
  WITH CHECK (auth.role() = 'authenticated');
