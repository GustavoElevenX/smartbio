create or replace function public.issue_benefit_claim(
 target_project uuid, target_activation uuid, target_offer uuid, target_customer uuid, target_session uuid,
 claim_code text, claim_expires_at timestamptz, eligibility jsonb, benefit jsonb
) returns public.benefit_claims language plpgsql security definer set search_path=public as $$
declare result public.benefit_claims; activation_row public.conversion_activations; existing public.benefit_claims; current_count bigint; max_claims integer;
begin
 select * into activation_row from public.conversion_activations where id=target_activation and project_id=target_project for update;
 if not found or activation_row.published_at is null or activation_row.status not in ('active','scheduled') or (activation_row.starts_at is not null and activation_row.starts_at>now()) or (activation_row.ends_at is not null and activation_row.ends_at<=now()) then raise exception 'invalid_activation'; end if;
 select * into existing from public.benefit_claims where activation_id=target_activation and customer_identity_id=target_customer and status in ('issued','presented') and (expires_at is null or expires_at>now()) order by issued_at desc limit 1;
 if found then return existing; end if;
 if exists(select 1 from public.benefit_claims where activation_id=target_activation and customer_identity_id=target_customer and status='redeemed') then raise exception 'already_redeemed'; end if;
 max_claims := nullif(activation_row.limits->>'maxClaims','')::integer;
 if max_claims is not null then select count(*) into current_count from public.benefit_claims where activation_id=target_activation and status not in ('cancelled','expired'); if current_count>=max_claims then raise exception 'global_limit_reached'; end if;
 insert into public.benefit_claims(workspace_id,project_id,activation_id,offer_id,customer_identity_id,visitor_session_id,code,expires_at,eligibility_snapshot,benefit_snapshot)
 values(activation_row.workspace_id,target_project,target_activation,target_offer,target_customer,target_session,upper(claim_code),claim_expires_at,eligibility,benefit) returning * into result;
 return result;
end $$;

create or replace function public.redeem_benefit_claim(
 claim_code text, target_project uuid, target_location uuid, target_validator uuid, redemption_mode text,
 subtotal numeric, discount numeric, delivery_discount numeric, final_amount numeric, currency text, target_opportunity uuid default null, idempotency_key text default null
) returns public.benefit_redemptions language plpgsql security definer set search_path=public as $$
declare claim_row public.benefit_claims; activation_row public.conversion_activations; validator_row public.redemption_validators; result public.benefit_redemptions; current_count bigint; max_redemptions integer;
begin
 select * into claim_row from public.benefit_claims where project_id=target_project and code=upper(claim_code) for update;
 if not found then raise exception 'claim_not_found'; end if;
 if claim_row.status='redeemed' then raise exception 'already_redeemed'; end if;
 if claim_row.status not in ('issued','presented') then raise exception 'invalid_claim'; end if;
 if claim_row.expires_at is not null and claim_row.expires_at<=now() then update public.benefit_claims set status='expired' where id=claim_row.id; raise exception 'claim_expired'; end if;
 select * into activation_row from public.conversion_activations where id=claim_row.activation_id for update;
 if target_validator is not null then select * into validator_row from public.redemption_validators where id=target_validator and project_id=target_project and is_active=true; if not found then raise exception 'validator_revoked'; end if; if validator_row.location_id is not null and target_location is distinct from validator_row.location_id then raise exception 'location_not_allowed'; end if; end if;
 if target_location is not null and exists(select 1 from public.activation_locations where activation_id=claim_row.activation_id) and not exists(select 1 from public.activation_locations where activation_id=claim_row.activation_id and location_id=target_location) then raise exception 'location_not_allowed'; end if;
 max_redemptions := nullif(activation_row.limits->>'maxRedemptions','')::integer;
 if max_redemptions is not null then select count(*) into current_count from public.benefit_redemptions where activation_id=claim_row.activation_id; if current_count>=max_redemptions then raise exception 'global_limit_reached'; end if;
 insert into public.benefit_redemptions(workspace_id,project_id,claim_id,activation_id,offer_id,customer_identity_id,opportunity_id,location_id,subtotal_before,discount_amount,delivery_discount,final_amount,currency,redemption_mode,validator_id,metadata)
 values(claim_row.workspace_id,target_project,claim_row.id,claim_row.activation_id,claim_row.offer_id,claim_row.customer_identity_id,coalesce(target_opportunity,claim_row.opportunity_id),target_location,subtotal,discount,delivery_discount,final_amount,currency,redemption_mode,target_validator,jsonb_build_object('idempotencyKey',idempotency_key,'activationVersion',activation_row.version)) returning * into result;
 update public.benefit_claims set status='redeemed',redeemed_at=now(),opportunity_id=coalesce(target_opportunity,opportunity_id) where id=claim_row.id;
 insert into public.customer_identity_evidence(customer_identity_id,project_id,evidence_type,source_type,source_id) values(claim_row.customer_identity_id,target_project,'benefit_redeemed','benefit_redemption',result.id::text) on conflict do nothing;
 if coalesce(activation_row.settings->>'conversionPolicy','manual_conversion')='redemption_marks_conversion' and coalesce(target_opportunity,claim_row.opportunity_id) is not null then
  update public.commercial_opportunities set status='converted',confirmed_value=final_amount,converted_at=now(),updated_at=now() where id=coalesce(target_opportunity,claim_row.opportunity_id) and status in ('new','in_progress');
 end if;
 insert into public.commercial_audit_log(workspace_id,project_id,object_type,object_id,action,after_state) values(claim_row.workspace_id,target_project,'benefit_claim',claim_row.id,'redeemed',to_jsonb(result));
 return result;
end $$;
revoke all on function public.issue_benefit_claim(uuid,uuid,uuid,uuid,uuid,text,timestamptz,jsonb,jsonb) from public,anon,authenticated;
revoke all on function public.redeem_benefit_claim(text,uuid,uuid,uuid,text,numeric,numeric,numeric,numeric,text,uuid,text) from public,anon,authenticated;
grant execute on function public.issue_benefit_claim(uuid,uuid,uuid,uuid,uuid,text,timestamptz,jsonb,jsonb) to service_role;
grant execute on function public.redeem_benefit_claim(text,uuid,uuid,uuid,text,numeric,numeric,numeric,numeric,text,uuid,text) to service_role;
