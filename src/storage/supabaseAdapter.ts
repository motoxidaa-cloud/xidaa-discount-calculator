/**
 * SupabaseAdapter — production persistence backed by Supabase PostgreSQL.
 * No login system: the app relies on the Supabase project's network-level
 * security (the anon/publishable key is only usable against this project).
 */
import type {
  AppSettings,
  AuditEntry,
  BatteryRecord,
  ModelRecord,
  FullOrder,
  SavedOrder,
} from '../types';
import { getSupabase } from '../lib/supabase';
import type { DataAdapter, StorageMode } from './types';

export class SupabaseAdapter implements DataAdapter {
  readonly mode: StorageMode = 'supabase';

  // --- Reference data ----------------------------------------------------
  async fetchSettings(): Promise<AppSettings> {
    const supabase = getSupabase();
    const { data, error } = await supabase.from('app_settings').select('data').eq('id', 1).single();
    if (error) throw new Error(`Could not load settings: ${error.message}`);
    return data.data as AppSettings;
  }

  async updateSettings(settings: AppSettings): Promise<void> {
    const supabase = getSupabase();
    const { error } = await supabase
      .from('app_settings')
      .update({ data: settings, updated_at: new Date().toISOString() })
      .eq('id', 1);
    if (error) throw new Error(`Could not save settings: ${error.message}`);
    await this.logAudit('settings_update', 'settings', 'Financial settings updated.');
  }

  async fetchModels(): Promise<ModelRecord[]> {
    const supabase = getSupabase();
    const { data, error } = await supabase.from('model_catalog').select('*').order('sort_order', { ascending: true });
    if (error) throw new Error(`Could not load model catalogue: ${error.message}`);
    return (data ?? []).map((r: any) => ({
      id: r.id,
      name: r.name,
      category: r.category,
      approvedPricePaise: r.approved_price_paise,
      costPaise: r.cost_paise,
      active: r.active,
      sortOrder: r.sort_order,
    }));
  }

  async upsertModel(model: ModelRecord): Promise<void> {
    const supabase = getSupabase();
    const { error } = await supabase.from('model_catalog').upsert(
      {
        id: model.id,
        name: model.name,
        category: model.category,
        approved_price_paise: model.approvedPricePaise,
        cost_paise: model.costPaise,
        active: model.active,
        sort_order: model.sortOrder,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'id' },
    );
    if (error) throw new Error(`Could not save model: ${error.message}`);
    await this.logAudit('model_update', 'model', `Model "${model.name}" updated.`);
  }

  async fetchBatteries(): Promise<BatteryRecord[]> {
    const supabase = getSupabase();
    const { data, error } = await supabase.from('battery_catalog').select('*').order('name');
    if (error) throw new Error(`Could not load battery catalogue: ${error.message}`);
    return (data ?? []).map((r: any) => ({
      id: r.id,
      name: r.name,
      capacityAh: r.capacity_ah,
      tech: r.tech,
      approvedPricePaise: r.approved_price_paise,
      costPaise: r.cost_paise,
      active: r.active,
    }));
  }

  async upsertBattery(battery: BatteryRecord): Promise<void> {
    const supabase = getSupabase();
    const { error } = await supabase.from('battery_catalog').upsert(
      {
        id: battery.id,
        name: battery.name,
        capacity_ah: battery.capacityAh,
        tech: battery.tech,
        approved_price_paise: battery.approvedPricePaise,
        cost_paise: battery.costPaise,
        active: battery.active,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'id' },
    );
    if (error) throw new Error(`Could not save battery: ${error.message}`);
    await this.logAudit('battery_update', 'battery', `Battery "${battery.name}" updated.`);
  }

  // --- Orders ------------------------------------------------------------
  async listOrders(opts?: { search?: string; limit?: number; offset?: number }): Promise<SavedOrder[]> {
    const supabase = getSupabase();
    let query = supabase
      .from('orders')
      .select('id, ref, customer_name, customer_phone, city, status, total_scooters, dl_qty, other_qty, battery_qty, distance_km, final_transport_paise, selected_option_key, recommended_key, profit_verified, created_by_name, created_at, updated_at, notes')
      .order('created_at', { ascending: false })
      .range(opts?.offset ?? 0, (opts?.offset ?? 0) + (opts?.limit ?? 50) - 1);
    const q = (opts?.search ?? '').trim();
    if (q) query = query.or(`ref.ilike.%${q}%,customer_name.ilike.%${q}%,city.ilike.%${q}%,customer_phone.ilike.%${q}%`);
    const { data, error } = await query;
    if (error) throw new Error(`Could not load orders: ${error.message}`);
    return (data ?? []).map((r: any) => ({
      id: r.id,
      orderRef: r.ref,
      customerName: r.customer_name,
      customerPhone: r.customer_phone,
      city: r.city,
      status: r.status,
      totalScooters: r.total_scooters,
      dlQty: r.dl_qty,
      otherQty: r.other_qty,
      batteryQty: r.battery_qty,
      distanceKm: r.distance_km,
      finalTransportPaise: r.final_transport_paise,
      selectedOptionKey: r.selected_option_key,
      recommendedKey: r.recommended_key,
      profitVerified: r.profit_verified,
      createdBy: r.created_by,
      createdByName: r.created_by_name,
      createdAt: r.created_at,
      updatedAt: r.updated_at,
      notes: r.notes,
    }));
  }

  async getOrder(id: string): Promise<FullOrder> {
    const supabase = getSupabase();
    const { data: order, error: orderError } = await supabase.from('orders').select('*').eq('id', id).single();
    if (orderError) throw new Error(`Could not load order: ${orderError.message}`);

    const { data: scooters } = await supabase.from('order_scooter_items').select('*').eq('order_id', id).order('sort');
    const { data: batteries } = await supabase.from('order_battery_items').select('*').eq('order_id', id).order('sort');
    const { data: trucks } = await supabase.from('truck_allocations').select('*').eq('order_id', id).order('sort');

    return {
      id: order.id,
      orderRef: order.ref,
      customerName: order.customer_name,
      customerPhone: order.customer_phone,
      city: order.city,
      status: order.status,
      notes: order.notes,
      totalScooters: order.total_scooters,
      dlQty: order.dl_qty,
      otherQty: order.other_qty,
      batteryQty: order.battery_qty,
      distanceKm: order.distance_km,
      finalTransportPaise: order.final_transport_paise,
      selectedOptionKey: order.selected_option_key,
      recommendedKey: order.recommended_key,
      profitVerified: order.profit_verified,
      createdBy: order.created_by,
      createdByName: order.created_by_name,
      createdAt: order.created_at,
      updatedAt: order.updated_at,
      scooterRows: (scooters ?? []).map((r: any) => ({
        id: r.id,
        modelId: r.model_id,
        modelName: r.model_name,
        category: r.category,
        qty: r.qty,
      })),
      batteryRows: (batteries ?? []).map((r: any) => ({
        id: r.id,
        variantId: r.variant_id,
        variantName: r.variant_name,
        capacityAh: r.capacity_ah,
        qty: r.qty,
        eligible: r.eligible,
      })),
      trucks: (trucks ?? []).map((r: any) => ({
        id: r.id,
        truckConfigId: r.truck_config_id,
        label: r.label,
        capacity: r.capacity,
        ratePerKmPaise: r.rate_per_km_paise,
        count: r.count,
        distanceKm: r.distance_km,
      })),
      snapshot: order.snapshot,
    };
  }

  async saveOrder(order: FullOrder): Promise<string> {
    const supabase = getSupabase();
    const isNew = order.id === '' || !order.id;
    const id = isNew ? crypto.randomUUID() : order.id;
    const now = new Date().toISOString();
    const s = order.snapshot;

    if (!isNew) {
      await supabase.from('order_scooter_items').delete().eq('order_id', id);
      await supabase.from('order_battery_items').delete().eq('order_id', id);
      await supabase.from('truck_allocations').delete().eq('order_id', id);
      await supabase.from('discount_options').delete().eq('order_id', id);
      await supabase.from('profitability_snapshots').delete().eq('order_id', id);
      await supabase.from('discount_recommendations').delete().eq('order_id', id);
    }

    const header = {
      id,
      ref: order.orderRef,
      customer_name: order.customerName,
      customer_phone: order.customerPhone || null,
      city: order.city || null,
      status: order.status,
      notes: order.notes || null,
      total_scooters: s.allowances.totalScooterQty,
      dl_qty: s.allowances.dlQty,
      other_qty: s.allowances.otherQty,
      battery_qty: order.batteryRows.reduce((sum, r) => sum + r.qty, 0),
      distance_km: order.trucks[0]?.distanceKm ?? 0,
      base_transport_paise: s.transport.basePaise,
      surcharge_paise: s.transport.surchargePaise,
      transport_subtotal_paise: s.transport.subtotalPaise,
      transport_gst_paise: s.transport.gstPaise,
      final_transport_paise: s.transport.finalPaise,
      scooter_discount_allowance_paise: s.allowances.scooterAllowanceTotalPaise,
      battery_discount_paise: s.allowances.batteryDiscountPaise,
      selected_option_key: s.selectedOptionKey,
      recommended_key: s.recommendation.recommendedKey,
      profit_verified: s.options.some((o) => o.profitStatus === 'verified'),
      snapshot: s,
      created_by: order.createdBy || null,
      created_by_name: order.createdByName || null,
      created_at: isNew ? now : order.createdAt,
      updated_at: now,
    };

    const { error: headerError } = await supabase.from('orders').upsert(header, { onConflict: 'id' });
    if (headerError) throw new Error(`Order could not be saved: ${headerError.message}`);

    const scooterRows = order.scooterRows.map((r, i) => ({
      order_id: id,
      model_id: r.modelId,
      model_name: r.modelName,
      category: r.category,
      qty: r.qty,
      unit_price_paise: null,
      unit_cost_paise: null,
      sort: i,
    }));
    if (scooterRows.length) {
      const { error } = await supabase.from('order_scooter_items').insert(scooterRows);
      if (error) throw new Error(`Order items could not be saved: ${error.message}`);
    }

    const batteryRows = order.batteryRows.map((r, i) => ({
      order_id: id,
      variant_id: r.variantId,
      variant_name: r.variantName,
      capacity_ah: r.capacityAh,
      qty: r.qty,
      eligible: r.eligible,
      unit_price_paise: null,
      unit_cost_paise: null,
      sort: i,
    }));
    if (batteryRows.length) {
      const { error } = await supabase.from('order_battery_items').insert(batteryRows);
      if (error) throw new Error(`Battery items could not be saved: ${error.message}`);
    }

    const truckRows = s.transport.trucks.map((t, i) => ({
      order_id: id,
      truck_config_id: t.truckConfigId,
      label: t.label,
      capacity: t.capacity,
      rate_per_km_paise: t.ratePerKmPaise,
      count: t.count,
      distance_km: t.distanceKm,
      base_paise: t.basePaise,
      surcharge_paise: t.surchargePaise,
      subtotal_paise: t.subtotalPaise,
      gst_paise: t.gstPaise,
      total_paise: t.totalPaise,
      sort: i,
    }));
    if (truckRows.length) {
      const { error } = await supabase.from('truck_allocations').insert(truckRows);
      if (error) throw new Error(`Truck allocations could not be saved: ${error.message}`);
    }

    const optionRows = s.options.map((o, i) => ({
      order_id: id,
      option_key: o.key,
      eligible: o.eligible,
      ineligible_reason: o.ineligibleReason ?? null,
      shortfall_paise: o.shortfallPaise ?? null,
      scooter_discount_paise: o.scooterDiscountPaise,
      company_support_paise: o.companyTransportSupportPaise,
      dealer_transport_paise: o.dealerTransportPayablePaise,
      battery_discount_paise: o.batteryDiscountPaise,
      profit_status: o.profitStatus,
      data: o,
      sort: i,
    }));
    const { error: optError } = await supabase.from('discount_options').insert(optionRows);
    if (optError) throw new Error(`Discount options could not be saved: ${optError.message}`);

    const snapRows = s.options.map((o) => {
      const p = o.profit;
      return {
        order_id: id,
        option_key: o.key,
        verified: p?.verified ?? false,
        missing_data: p?.missingData ?? [],
        revenue_total_paise: p?.revenueTotalPaise ?? 0,
        scooter_revenue_paise: p?.scooterRevenuePaise ?? 0,
        battery_revenue_paise: p?.batteryRevenuePaise ?? 0,
        transport_collected_ex_gst_paise: p?.transportCollectedExGstPaise ?? 0,
        cost_total_paise: p?.costTotalPaise ?? 0,
        scooter_cost_paise: p?.scooterCostPaise ?? 0,
        battery_cost_paise: p?.batteryCostPaise ?? 0,
        company_transport_expense_paise: p?.companyTransportExpensePaise ?? 0,
        other_expenses_paise: p?.otherExpensesPaise ?? 0,
        profit_paise: p?.profitPaise ?? 0,
        margin_pct: p?.marginPercent ?? 0,
        meets_minimum: p?.meetsMinimum ?? false,
        below_by_paise: p?.belowByPaise ?? 0,
      };
    });
    const { error: snapError } = await supabase.from('profitability_snapshots').insert(snapRows);
    if (snapError) throw new Error(`Profitability snapshots could not be saved: ${snapError.message}`);

    const { error: recError } = await supabase.from('discount_recommendations').insert({
      order_id: id,
      recommended_key: s.recommendation.recommendedKey,
      provisional: s.recommendation.provisional,
      rationale: s.recommendation.rationale,
    });
    if (recError) throw new Error(`Recommendation could not be saved: ${recError.message}`);

    return id;
  }

  async deleteOrder(id: string): Promise<void> {
    const supabase = getSupabase();
    const { error } = await supabase.from('orders').delete().eq('id', id);
    if (error) throw new Error(`Order could not be deleted: ${error.message}`);
    await this.logAudit('order_delete', 'order', `Deleted order ${id}.`);
  }

  // --- Audit -------------------------------------------------------------
  private async logAudit(action: string, entity: string, details: string) {
    try {
      const supabase = getSupabase();
      await supabase.from('audit_logs').insert({
        actor_user_id: null,
        actor_name: 'system',
        action,
        entity,
        details,
      });
    } catch {
      // Auditing failure must not break the main operation.
    }
  }

  async fetchAudits(limit = 100): Promise<AuditEntry[]> {
    const supabase = getSupabase();
    const { data, error } = await supabase
      .from('audit_logs')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(limit);
    if (error) throw new Error(`Could not load audit history: ${error.message}`);
    return (data ?? []).map((r: any) => ({
      id: r.id,
      actedAt: r.created_at,
      actorUserId: r.actor_user_id,
      actorName: r.actor_name ?? 'system',
      action: r.action,
      entity: r.entity,
      details: r.details ?? '',
    }));
  }
}
