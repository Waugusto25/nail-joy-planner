CREATE OR REPLACE FUNCTION public.create_unified_store_order(p_order_id uuid, p_client_id uuid, p_items jsonb, p_sources jsonb, p_count integer, p_offset integer, p_first_due date, p_payment_method text, p_status text, p_notes text) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE c public.store_clients%ROWTYPE; s public.store_order_installments%ROWTYPE; source_ids uuid[]; expected_ids uuid[]; old_total bigint := 0; new_total bigint; balance bigint; total bigint; moved_total bigint := 0; candidate uuid; i integer; base integer; remainder integer; due date;
BEGIN
 IF auth.uid() IS NULL OR NOT public.has_role(auth.uid(),'admin') THEN RAISE EXCEPTION 'Acesso restrito à administração'; END IF;
 SELECT * INTO c FROM public.store_clients WHERE id=p_client_id FOR UPDATE;
 IF c.id IS NULL THEN RAISE EXCEPTION 'Cliente não encontrado'; END IF;
 IF EXISTS(SELECT 1 FROM public.store_orders WHERE id=p_order_id AND store_client_id=p_client_id) THEN RETURN p_order_id; END IF;
 IF p_count NOT BETWEEN 1 AND 12 OR p_offset<0 OR jsonb_array_length(p_items)=0 THEN RAISE EXCEPTION 'Plano inválido'; END IF;
 SELECT sum((item->>'unit_price_cents')::integer) INTO new_total FROM jsonb_array_elements(p_items) item;
 IF new_total<=0 OR EXISTS(SELECT 1 FROM jsonb_array_elements(p_items) item WHERE coalesce(trim(item->>'name'),'')='' OR (item->>'unit_price_cents')::integer<=0) THEN RAISE EXCEPTION 'Produtos inválidos'; END IF;
 PERFORM o.id FROM public.store_orders o WHERE o.store_client_id=c.id OR (o.store_client_id IS NULL AND regexp_replace(o.client_phone,'\D','','g')=regexp_replace(c.phone,'\D','','g')) ORDER BY o.id FOR UPDATE;
 PERFORM p.id FROM public.store_order_installments p JOIN public.store_orders o ON o.id=p.order_id WHERE o.store_client_id=c.id OR (o.store_client_id IS NULL AND regexp_replace(o.client_phone,'\D','','g')=regexp_replace(c.phone,'\D','','g')) ORDER BY p.id FOR UPDATE OF p;
 SELECT array_agg((item->>'id')::uuid ORDER BY (item->>'id')::uuid) INTO source_ids FROM jsonb_array_elements(p_sources) item;
 SELECT array_agg(p.id ORDER BY p.id) INTO expected_ids FROM public.store_order_installments p JOIN public.store_orders o ON o.id=p.order_id WHERE (o.store_client_id=c.id OR (o.store_client_id IS NULL AND regexp_replace(o.client_phone,'\D','','g')=regexp_replace(c.phone,'\D','','g'))) AND p.merged_into_order_id IS NULL AND p.amount_cents > CASE WHEN p.paid_at IS NOT NULL THEN CASE WHEN p.paid_amount_cents=0 THEN p.amount_cents ELSE p.paid_amount_cents END ELSE coalesce((SELECT sum(a.amount_cents) FROM public.store_installment_advances a WHERE a.installment_id=p.id),0) END;
 IF expected_ids IS NULL OR source_ids IS DISTINCT FROM expected_ids THEN RAISE EXCEPTION 'As parcelas mudaram. Atualize os pedidos e confira a unificação novamente.'; END IF;
 FOREACH candidate IN ARRAY source_ids LOOP
  SELECT * INTO s FROM public.store_order_installments WHERE id=candidate;
  IF s.mp_payment_id IS NOT NULL AND coalesce(s.mp_status,'pending') NOT IN ('cancelled','rejected','expired') THEN RAISE EXCEPTION 'Existe cobrança Mercado Pago ativa. Cancele ou confirme o pagamento antes de unificar.'; END IF;
  balance:=greatest(0,s.amount_cents-CASE WHEN s.paid_at IS NOT NULL THEN CASE WHEN s.paid_amount_cents=0 THEN s.amount_cents ELSE s.paid_amount_cents END ELSE coalesce((SELECT sum(a.amount_cents) FROM public.store_installment_advances a WHERE a.installment_id=s.id),0) END);
  IF balance IS DISTINCT FROM (SELECT (item->>'remainingCents')::bigint FROM jsonb_array_elements(p_sources) item WHERE (item->>'id')::uuid=s.id) THEN RAISE EXCEPTION 'O saldo mudou. Confira a unificação novamente.'; END IF;
  old_total:=old_total+balance;
 END LOOP;
 total:=new_total+old_total;
 IF total>2147483647 THEN RAISE EXCEPTION 'Valor acima do limite'; END IF;
 INSERT INTO public.store_orders(id,store_client_id,client_name,client_phone,item_name,amount_cents,payment_method,installments,delivery_date,status,notes,delivered_on) VALUES(p_order_id,c.id,c.full_name,c.phone,(SELECT string_agg(item->>'name',', ') FROM jsonb_array_elements(p_items) item),new_total,p_payment_method,p_count,p_first_due,p_status,p_notes,CASE WHEN p_status='entregue' THEN (now() AT TIME ZONE 'America/Sao_Paulo')::date ELSE NULL END);
 INSERT INTO public.store_order_items(order_id,name,unit_price_cents,sort_order,start_installment,installments_count) SELECT p_order_id,item->>'name',(item->>'unit_price_cents')::integer,ordinality::integer-1,p_offset+1,p_count FROM jsonb_array_elements(p_items) WITH ORDINALITY AS t(item,ordinality);
 -- Completely unpaid sales can move their products without duplicating sales totals. Paid history stays in place.
 FOR candidate IN SELECT DISTINCT p.order_id FROM public.store_order_installments p WHERE p.id=ANY(source_ids) LOOP
  IF NOT EXISTS(SELECT 1 FROM public.store_order_installments p WHERE p.order_id=candidate AND (p.paid_at IS NOT NULL OR p.paid_amount_cents<>0 OR p.merged_into_order_id IS NOT NULL)) AND NOT EXISTS(SELECT 1 FROM public.store_installment_advances a JOIN public.store_order_installments p ON p.id=a.installment_id WHERE p.order_id=candidate) THEN
   SELECT coalesce(sum(unit_price_cents),0) INTO balance FROM public.store_order_items WHERE order_id=candidate;
   UPDATE public.store_order_items SET order_id=p_order_id,sort_order=sort_order+100,start_installment=p_offset+1,installments_count=p_count WHERE order_id=candidate;
   moved_total:=moved_total+balance;
   UPDATE public.store_orders SET amount_cents=greatest(0,amount_cents-balance),archived_at=now(),notes=concat_ws(E'\n',notes,'Produtos e parcelas unificados no pedido '||p_order_id) WHERE id=candidate;
  END IF;
 END LOOP;
 UPDATE public.store_orders SET amount_cents=new_total+moved_total,item_name=(SELECT string_agg(name,', ' ORDER BY sort_order) FROM public.store_order_items WHERE order_id=p_order_id) WHERE id=p_order_id;
 base:=total/p_count; remainder:=total%p_count;
 FOR i IN 0..p_count-1 LOOP
  due:=CASE WHEN p_first_due IS NULL THEN NULL ELSE (date_trunc('month',p_first_due)+make_interval(months=>i)+(least(extract(day FROM p_first_due)::integer,extract(day FROM (date_trunc('month',p_first_due)+make_interval(months=>i+1)-interval '1 day'))::integer)-1)*interval '1 day')::date END;
  INSERT INTO public.store_order_installments(order_id,number,amount_cents,due_date,merged_extra_cents) VALUES(p_order_id,p_offset+i+1,base+CASE WHEN i<remainder THEN 1 ELSE 0 END,due,greatest(0,old_total-moved_total)/p_count+CASE WHEN i<greatest(0,old_total-moved_total)%p_count THEN 1 ELSE 0 END);
 END LOOP;
 UPDATE public.store_order_installments SET merged_into_order_id=p_order_id WHERE id=ANY(source_ids);
 RETURN p_order_id;
END $$;
REVOKE ALL ON FUNCTION public.create_unified_store_order(uuid,uuid,jsonb,jsonb,integer,integer,date,text,text,text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.create_unified_store_order(uuid,uuid,jsonb,jsonb,integer,integer,date,text,text,text) TO authenticated;