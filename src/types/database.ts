export type LocaleMap = Record<string, string | null>

export interface Product {
  id: string
  sku: string

  // Localized
  name_en: string
  name_de?: string | null
  name_sl?: string | null
  name_fr?: string | null
  name_it?: string | null
  name_es?: string | null
  name_nl?: string | null
  name_pl?: string | null
  name_sk?: string | null
  name_sv?: string | null
  name_da?: string | null
  name_ro?: string | null
  name_sr?: string | null
  name_mk?: string | null
  name_hr?: string | null
  name_cs?: string | null

  description_en?: string | null
  description_de?: string | null
  description_sl?: string | null
  description_fr?: string | null
  description_it?: string | null
  description_es?: string | null
  description_nl?: string | null
  description_pl?: string | null
  description_sk?: string | null
  description_sv?: string | null
  description_da?: string | null
  description_ro?: string | null
  description_sr?: string | null
  description_mk?: string | null
  description_hr?: string | null
  description_cs?: string | null

  category: string
  subcategory?: string | null

  // Pricing
  cost_eur: number
  price_eur: number
  b2b_price_eur?: number | null
  currency?: string | null

  // Inventory
  stock_quantity?: number | null
  reserved_quantity?: number | null
  low_stock_threshold?: number | null
  stock_status?: 'in_stock' | 'out_of_stock' | 'coming_soon' | 'special_order' | 'available_to_order' | null
  units_per_box?: number | null

  // Shipping
  weight_kg: number
  packaging_weight_kg?: number | null
  packaging_material_weights?: Record<string, number> | null
  dimensions_cm?: Record<string, number> | null
  package_dimensions_cm?: Record<string, number> | null

  // Customs & Compliance
  cn_code?: string | null
  country_of_origin?: string | null
  country_of_purchase?: string | null

  // TROD (Waste Electrical Equipment) Compliance
  is_electrical_equipment?: boolean
  trod_category_code?: '1' | '2' | '3' | '4' | '5' | '6' | '7' | null

  // Packaging Waste Compliance
  default_packaging_type?: 'cardboard' | 'plastic' | 'foam' | 'metal' | 'glass' | 'wood' | 'none' | 'mixed' | null
  packaging_weight_per_unit_kg?: number | null
  supplier_invoices?: {
    id: string
    url: string
    filename: string
    description?: string
    invoice_number?: string
    invoice_date?: string
    quantity?: number
    unit_cost_gross?: number
    currency?: string
    original_unit_cost?: number
    uploaded_at: string
  }[] | null

  quantity_discounts?: {
    quantity: number
    unit_price: number
    unit_price_b2b?: number
    label?: string
  }[] | null

  // Media & specs
  images?: string[] | null
  datasheet_url?: string | null
  manual_url?: string | null
  specifications?: Record<string, any> | null
  downloads?: { title: string; languages: { lang: string; url: string }[] }[] | null

  // SEO
  slug?: string | null
  meta_title?: Record<string, string> | null
  meta_description?: Record<string, string> | null

  active?: boolean
  featured?: boolean
  production_type?: string | null
  related_products?: string[] | null

  created_at?: string | null
  updated_at?: string | null
}

export interface Customer {
  id: string
  email: string
  company_name?: string | null
  vat_id?: string | null
  vat_validated?: boolean
  vat_validated_at?: string | null

  first_name?: string | null
  last_name?: string | null
  phone?: string | null

  is_b2b?: boolean
  customer_type?: string | null

  account_status?: string | null

  addresses?: any[] | null
  default_shipping_address_id?: string | null
  default_billing_address_id?: string | null

  newsletter_subscribed?: boolean
  marketing_consent?: boolean
  terms_agreed_at?: string | null

  internal_notes?: string | null

  created_at?: string | null
  updated_at?: string | null
}

export interface OrderItem {
  id: string
  order_id: string
  product_id?: string | null
  sku: string
  product_name: string
  quantity: number
  unit_price: number
  total_price: number
  unit_cost?: number | null
  weight_kg?: number | null
  cn_code?: string | null

  // Compliance fields
  applies_trod_fee?: boolean
  trod_category_code?: string | null
  applies_packaging_fee?: boolean
  packaging_weight_kg?: number | null
  packaging_type?: 'cardboard' | 'plastic' | 'foam' | 'metal' | 'glass' | 'wood' | 'none' | 'mixed' | null
  packaging_data?: Record<string, number> | null

  // Pricing Breakdown
  b2c_unit_price?: number | null
  discount_amount?: number | null

  created_at?: string | null
}

export interface Order {
  id: string
  order_number: string

  customer_id?: string | null
  customer_email: string
  customer_phone?: string | null

  company_name?: string | null
  vat_id?: string | null
  vat_validated?: boolean

  shipping_address: any
  billing_address: any

  subtotal: number
  shipping_cost: number
  vat_rate: number
  vat_amount: number
  total: number
  currency?: string | null

  market: string
  language: string
  is_b2b?: boolean

  // Compliance tracking
  delivery_country?: string | null
  supplier_country?: string | null
  transaction_type?: 'domestic' | 'eu' | 'export' | null

  status?: string | null
  payment_status?: string | null
  fulfillment_status?: string | null

  payment_method?: string | null
  payment_intent_id?: string | null
  confirmed_at?: string | null
  paid_at?: string | null

  shipping_carrier?: string | null
  shipping_method?: string | null
  tracking_number?: string | null
  tracking_url?: string | null
  shipped_at?: string | null
  delivered_at?: string | null

  estimated_delivery?: string | null
  shipping_label_url?: string | null
  shipping_label_created_at?: string | null
  packing_slip_url?: string | null

  intrastat_reported?: boolean
  intrastat_report_date?: string | null

  invoice_number?: string | null
  invoice_url?: string | null
  invoice_created_at?: string | null

  total_weight_kg?: number | null
  commercial_access?: boolean | null
  truck_access_notes?: string | null

  customer_notes?: string | null
  internal_notes?: string | null

  cancelled_at?: string | null
  terms_agreed_at?: string | null

  created_at?: string | null
  updated_at?: string | null
}

export interface CartItem {
  product_id: string
  sku: string
  name: string
  quantity: number
  unit_price: number
  total_price?: number
  weight_kg?: number
  image_url?: string
  b2c_unit_price?: number
  discount_amount?: number
  applied_schema_name?: string
  metadata?: Record<string, any>
}

export interface Cart {
  id: string
  user_id?: string | null
  items: CartItem[]
  updated_at?: string | null
  created_at?: string | null
}

export interface Supplier {
  id: string
  name: string
  contact_person?: string | null
  email?: string | null
  phone?: string | null
  vat_id?: string | null
  website?: string | null

  address_line1?: string | null
  address_line2?: string | null
  city?: string | null
  postal_code?: string | null
  country?: string | null

  notes?: string | null

  created_at?: string | null
  updated_at?: string | null
}

export interface Review {
  id: string
  product_id: string
  user_id?: string | null
  reviewer_name: string
  rating: number
  comment?: string | null
  created_at: string
  // product Join
  products?: { name_en: string } | null
}

export interface SavedCart {
  id: string
  user_id: string
  name: string
  created_at: string
  items?: SavedCartItem[]
}

export interface SavedCartItem {
  id: string
  saved_cart_id: string
  product_id?: string | null
  quantity: number
  sku?: string | null
  name?: string | null
  unit_price?: number | null
  image_url?: string | null
}
export interface PricingSchema {
  id: string
  name: string
  description?: string | null
  created_at?: string | null
  updated_at?: string | null
  rules?: PricingSchemaRule[]
}

export interface PricingSchemaRule {
  id: string
  schema_id: string
  type: 'category_discount' | 'subcategory_discount' | 'product_fixed_price' | 'global_discount'
  category?: string | null
  subcategory?: string | null
  product_id?: string | null
  discount_percentage?: number | null
  fixed_price_eur?: number | null
  created_at?: string | null
  updated_at?: string | null
}

export interface CustomerPricingSchema {
  customer_id: string
  schema_id: string
  priority: number
  created_at?: string | null
}
