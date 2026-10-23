-- Storage bucket metadata from the supplied inventory; no files are inserted.

INSERT INTO storage.buckets(id,name,public,file_size_limit,allowed_mime_types) VALUES ('clinic-imaging','clinic-imaging',false,52428800,ARRAY['image/jpeg','image/png','image/webp','video/mp4','video/quicktime','video/webm']::text[]);

INSERT INTO storage.buckets(id,name,public,file_size_limit,allowed_mime_types) VALUES ('genblue','genblue',true,NULL,NULL);

CREATE POLICY "imaging_v61_cleanup" ON storage.objects AS PERMISSIVE FOR DELETE TO authenticated
USING (((bucket_id = 'clinic-imaging'::text) AND (split_part(name, '/'::text, 1) = public.current_tenant_id()) AND private.has_ability(public.current_tenant_id(), 'clinical'::text) AND (NOT (EXISTS ( SELECT 1
   FROM public.imaging_assets a
  WHERE ((a.tenant_id = public.current_tenant_id()) AND (a.storage_path = objects.name)))))));

CREATE POLICY "imaging_v61_read" ON storage.objects AS PERMISSIVE FOR SELECT TO authenticated
USING (((bucket_id = 'clinic-imaging'::text) AND (split_part(name, '/'::text, 1) = public.current_tenant_id()) AND private.has_ability(public.current_tenant_id(), 'read'::text) AND (EXISTS ( SELECT 1
   FROM public.pets p
  WHERE (((p.id)::text = split_part(objects.name, '/'::text, 2)) AND ((p.tenant_id)::text = public.current_tenant_id()))))));

CREATE POLICY "imaging_v61_upload" ON storage.objects AS PERMISSIVE FOR INSERT TO authenticated
WITH CHECK (((bucket_id = 'clinic-imaging'::text) AND (split_part(name, '/'::text, 1) = public.current_tenant_id()) AND private.has_ability(public.current_tenant_id(), 'clinical'::text) AND (name ~ '^[^/]+/[0-9a-f-]{36}/[0-9a-f-]{36}/[0-9a-f-]{36}\.(jpg|png|webp|mp4|mov|webm)$'::text) AND (EXISTS ( SELECT 1
   FROM public.pets p
  WHERE (((p.id)::text = split_part(objects.name, '/'::text, 2)) AND ((p.tenant_id)::text = public.current_tenant_id()))))));
